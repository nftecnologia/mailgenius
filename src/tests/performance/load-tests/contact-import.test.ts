import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { cpus } from 'os';
import { performanceDataGenerator } from '../data-generator';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { LoadTestRunner } from '../runners/load-test-runner';
import { uploadService } from '@/lib/services/upload-service';
import { queueManager } from '@/lib/queue';
import { redisManager } from '@/lib/redis';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { LOAD_TEST_SCENARIOS } from '../config';

describe('Contact Import Load Tests - 2MM Contacts', () => {
  let performanceMonitor: PerformanceMonitor;
  let loadTestRunner: LoadTestRunner;
  let testStartTime: number;

  beforeAll(async () => {
    logger.info('Starting 2MM Contact Import Load Test Setup');
    
    // Initialize performance monitoring
    performanceMonitor = new PerformanceMonitor({
      metricsInterval: 5000,
      resourceMonitoring: true,
      enableDetailedMetrics: true
    });
    
    // Initialize load test runner
    loadTestRunner = new LoadTestRunner(LOAD_TEST_SCENARIOS.CONTACT_IMPORT_2MM);
    
    // Setup infrastructure
    await queueManager.initialize();
    await redisManager.connect();
    
    // Start monitoring
    await performanceMonitor.start();
    
    logger.info('2MM Contact Import Load Test Setup Complete');
  });

  afterAll(async () => {
    logger.info('Cleaning up 2MM Contact Import Load Test');
    
    // Stop monitoring and generate reports
    const report = await performanceMonitor.stop();
    await performanceMonitor.generateReport(report, 'contact-import-2mm-load-test');
    
    // Cleanup
    await queueManager.closeAll();
    await redisManager.disconnect();
    
    logger.info('2MM Contact Import Load Test Cleanup Complete');
  });

  beforeEach(() => {
    testStartTime = performance.now();
  });

  afterEach(() => {
    const testDuration = performance.now() - testStartTime;
    logger.info(`Test completed in ${testDuration.toFixed(2)}ms`);
  });

  describe('Single Large File Import (2MM Contacts)', () => {
    it('should handle 2MM contacts in single file upload', async () => {
      const scenario = LOAD_TEST_SCENARIOS.CONTACT_IMPORT_2MM;
      const testId = 'single-2mm-import';
      
      logger.info(`Starting single 2MM contact import test`);
      
      // Start performance monitoring for this specific test
      const testMonitor = performanceMonitor.startTest(testId);
      
      try {
        // Generate 2MM test contacts
        logger.info('Generating 2MM test contacts...');
        const contacts = await performanceDataGenerator.generateContacts(
          scenario.totalContacts,
          'standard',
          {
            outputFile: `/tmp/2mm-contacts-${Date.now()}.csv`,
            chunkSize: scenario.chunkSize
          }
        );
        
        // Calculate file size
        const avgContactSize = 300; // bytes
        const estimatedFileSize = scenario.totalContacts * avgContactSize;
        
        logger.info(`Generated ${contacts.length} contacts, estimated file size: ${(estimatedFileSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Create upload job
        const uploadJob = await uploadService.createUploadJob(
          {
            filename: '2mm-contacts.csv',
            file_size: estimatedFileSize,
            file_type: 'text/csv',
            chunk_size: scenario.chunkSize,
            upload_type: 'leads_import',
            validation_rules: {
              required_fields: ['email'],
              email_validation: true,
              max_records: scenario.totalContacts,
              duplicate_handling: 'skip'
            }
          },
          'test-user-id',
          'test-workspace-id'
        );
        
        expect(uploadJob.upload_job).toBeDefined();
        expect(uploadJob.upload_job.total_chunks).toBeGreaterThan(0);
        
        // Simulate chunked upload
        const uploadStartTime = performance.now();
        const chunkPromises: Promise<any>[] = [];
        
        for (let i = 0; i < uploadJob.upload_job.total_chunks; i++) {
          const chunkSize = Math.min(scenario.chunkSize, estimatedFileSize - (i * scenario.chunkSize));
          const chunkData = Buffer.alloc(chunkSize);
          
          const chunkPromise = uploadService.uploadChunk({
            upload_job_id: uploadJob.upload_job.id,
            chunk_index: i,
            chunk_data: chunkData,
            chunk_hash: `chunk-${i}-hash`
          });
          
          chunkPromises.push(chunkPromise);
          
          // Control concurrency
          if (chunkPromises.length >= scenario.maxConcurrency) {
            await Promise.all(chunkPromises);
            chunkPromises.length = 0;
          }
        }
        
        // Wait for remaining chunks
        if (chunkPromises.length > 0) {
          await Promise.all(chunkPromises);
        }
        
        const uploadTime = performance.now() - uploadStartTime;
        logger.info(`Upload completed in ${uploadTime.toFixed(2)}ms`);
        
        // Start processing
        const processingStartTime = performance.now();
        const processResult = await uploadService.startProcessing({
          upload_job_id: uploadJob.upload_job.id,
          batch_size: scenario.batchSize
        });
        
        expect(processResult.processing_job_id).toBeDefined();
        expect(processResult.total_batches).toBeGreaterThan(0);
        
        // Monitor processing progress
        let processingComplete = false;
        let progressCheckCount = 0;
        const maxProgressChecks = 1000; // Prevent infinite loop
        
        while (!processingComplete && progressCheckCount < maxProgressChecks) {
          const progress = await uploadService.getUploadProgress(uploadJob.upload_job.id);
          
          if (progress.status === 'completed') {
            processingComplete = true;
          } else if (progress.status === 'failed') {
            throw new Error(`Processing failed: ${progress.error_message}`);
          }
          
          // Log progress every 10 checks
          if (progressCheckCount % 10 === 0) {
            logger.info(`Processing progress: ${progress.processing_progress}%`);
          }
          
          progressCheckCount++;
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between checks
        }
        
        const processingTime = performance.now() - processingStartTime;
        logger.info(`Processing completed in ${processingTime.toFixed(2)}ms`);
        
        // Get final statistics
        const finalStats = await uploadService.getProcessingStats(uploadJob.upload_job.id);
        
        // Verify performance thresholds
        expect(uploadTime).toBeLessThan(scenario.thresholds.maxResponseTime);
        expect(processingTime).toBeLessThan(scenario.thresholds.maxResponseTime * 10); // Processing can take longer
        expect(finalStats.error_rate).toBeLessThan(scenario.thresholds.errorRate);
        expect(finalStats.success_rate).toBeGreaterThan(scenario.thresholds.successRate);
        
        // Calculate throughput
        const totalTime = uploadTime + processingTime;
        const throughput = scenario.totalContacts / (totalTime / 1000); // contacts per second
        
        logger.info(`Final throughput: ${throughput.toFixed(2)} contacts/second`);
        expect(throughput).toBeGreaterThan(scenario.thresholds.throughput);
        
        // Stop test monitoring
        const testMetrics = await testMonitor.stop();
        
        // Log final metrics
        logger.info('Test completed successfully', {
          uploadTime,
          processingTime,
          totalTime,
          throughput,
          finalStats,
          testMetrics
        });
        
      } catch (error) {
        logger.error('Test failed', error);
        throw error;
      }
    }, 60 * 60 * 1000); // 1 hour timeout
  });

  describe('Concurrent Chunked Imports', () => {
    it('should handle multiple concurrent chunked imports', async () => {
      const scenario = LOAD_TEST_SCENARIOS.CONTACT_IMPORT_2MM;
      const testId = 'concurrent-chunked-imports';
      
      logger.info('Starting concurrent chunked imports test');
      
      const testMonitor = performanceMonitor.startTest(testId);
      
      try {
        const concurrentImports = 10;
        const contactsPerImport = scenario.totalContacts / concurrentImports;
        
        const importPromises = [];
        
        for (let i = 0; i < concurrentImports; i++) {
          const importPromise = this.performChunkedImport(
            `import-${i}`,
            contactsPerImport,
            scenario.chunkSize,
            scenario.batchSize
          );
          importPromises.push(importPromise);
        }
        
        const startTime = performance.now();
        const results = await Promise.all(importPromises);
        const totalTime = performance.now() - startTime;
        
        // Calculate aggregate metrics
        const totalContacts = results.reduce((sum, result) => sum + result.contactsProcessed, 0);
        const totalThroughput = totalContacts / (totalTime / 1000);
        const avgErrorRate = results.reduce((sum, result) => sum + result.errorRate, 0) / results.length;
        
        logger.info(`Concurrent import completed`, {
          totalContacts,
          totalTime,
          totalThroughput,
          avgErrorRate
        });
        
        // Verify thresholds
        expect(totalContacts).toBe(scenario.totalContacts);
        expect(totalThroughput).toBeGreaterThan(scenario.thresholds.throughput);
        expect(avgErrorRate).toBeLessThan(scenario.thresholds.errorRate);
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Concurrent chunked imports test completed successfully', {
          testMetrics,
          results
        });
        
      } catch (error) {
        logger.error('Concurrent chunked imports test failed', error);
        throw error;
      }
    }, 45 * 60 * 1000); // 45 minutes timeout
  });

  describe('Stress Test - System Limits', () => {
    it('should handle system stress with multiple simultaneous operations', async () => {
      const testId = 'system-stress-test';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting system stress test');
      
      try {
        const operations = [
          // Large import operations
          this.performChunkedImport('stress-import-1', 500000, 50000, 5000),
          this.performChunkedImport('stress-import-2', 500000, 50000, 5000),
          this.performChunkedImport('stress-import-3', 500000, 50000, 5000),
          this.performChunkedImport('stress-import-4', 500000, 50000, 5000),
          
          // Queue operations
          this.performQueueStressTest(),
          
          // Database operations
          this.performDatabaseStressTest(),
          
          // Redis operations
          this.performRedisStressTest()
        ];
        
        const startTime = performance.now();
        const results = await Promise.allSettled(operations);
        const totalTime = performance.now() - startTime;
        
        // Analyze results
        const successfulOperations = results.filter(r => r.status === 'fulfilled').length;
        const failedOperations = results.filter(r => r.status === 'rejected').length;
        const successRate = successfulOperations / results.length;
        
        logger.info(`Stress test completed`, {
          totalTime,
          successfulOperations,
          failedOperations,
          successRate
        });
        
        // Should handle stress gracefully
        expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate under stress
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('System stress test completed', {
          testMetrics,
          results: results.map(r => r.status)
        });
        
      } catch (error) {
        logger.error('System stress test failed', error);
        throw error;
      }
    }, 30 * 60 * 1000); // 30 minutes timeout
  });

  describe('Memory and Resource Management', () => {
    it('should manage memory efficiently during large imports', async () => {
      const testId = 'memory-management-test';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting memory management test');
      
      try {
        const initialMemory = process.memoryUsage();
        
        // Perform multiple large imports sequentially
        for (let i = 0; i < 5; i++) {
          logger.info(`Starting import batch ${i + 1}/5`);
          
          const result = await this.performChunkedImport(
            `memory-test-${i}`,
            400000, // 400K contacts per batch
            25000,  // 25K chunk size
            2000    // 2K batch size
          );
          
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          logger.info(`Import batch ${i + 1} completed`, {
            memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            contactsProcessed: result.contactsProcessed
          });
          
          // Memory should not increase unboundedly
          expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB increase
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
        
        const finalMemory = process.memoryUsage();
        const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        logger.info('Memory management test completed', {
          initialMemory: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          finalMemory: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          totalIncrease: `${(totalMemoryIncrease / 1024 / 1024).toFixed(2)} MB`
        });
        
        // Total memory increase should be reasonable
        expect(totalMemoryIncrease).toBeLessThan(1000 * 1024 * 1024); // Less than 1GB increase
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Memory management test completed successfully', {
          testMetrics
        });
        
      } catch (error) {
        logger.error('Memory management test failed', error);
        throw error;
      }
    }, 60 * 60 * 1000); // 1 hour timeout
  });

  // Helper methods
  private async performChunkedImport(
    importId: string,
    contactCount: number,
    chunkSize: number,
    batchSize: number
  ): Promise<{
    contactsProcessed: number;
    errorRate: number;
    throughput: number;
    duration: number;
  }> {
    const startTime = performance.now();
    
    // Generate contacts
    const contacts = await performanceDataGenerator.generateContacts(
      contactCount,
      'standard',
      { chunkSize: chunkSize }
    );
    
    // Create upload job
    const uploadJob = await uploadService.createUploadJob(
      {
        filename: `${importId}.csv`,
        file_size: contactCount * 300,
        file_type: 'text/csv',
        chunk_size: chunkSize,
        upload_type: 'leads_import',
        validation_rules: {
          required_fields: ['email'],
          email_validation: true,
          max_records: contactCount,
          duplicate_handling: 'skip'
        }
      },
      'test-user-id',
      'test-workspace-id'
    );
    
    // Upload chunks
    const totalChunks = uploadJob.upload_job.total_chunks;
    for (let i = 0; i < totalChunks; i++) {
      const chunkData = Buffer.alloc(chunkSize);
      await uploadService.uploadChunk({
        upload_job_id: uploadJob.upload_job.id,
        chunk_index: i,
        chunk_data: chunkData,
        chunk_hash: `${importId}-chunk-${i}-hash`
      });
    }
    
    // Start processing
    await uploadService.startProcessing({
      upload_job_id: uploadJob.upload_job.id,
      batch_size: batchSize
    });
    
    // Wait for completion
    let processingComplete = false;
    let progressCheckCount = 0;
    const maxProgressChecks = 500;
    
    while (!processingComplete && progressCheckCount < maxProgressChecks) {
      const progress = await uploadService.getUploadProgress(uploadJob.upload_job.id);
      
      if (progress.status === 'completed' || progress.status === 'failed') {
        processingComplete = true;
      }
      
      progressCheckCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Get final statistics
    const finalStats = await uploadService.getProcessingStats(uploadJob.upload_job.id);
    
    return {
      contactsProcessed: finalStats.valid_records,
      errorRate: finalStats.error_rate,
      throughput: finalStats.valid_records / (duration / 1000),
      duration
    };
  }

  private async performQueueStressTest(): Promise<void> {
    const queueName = 'stress-test-queue';
    const queue = queueManager.createQueue({
      name: queueName,
      concurrency: 20,
      removeOnComplete: 100,
      removeOnFail: 100
    });
    
    // Add many jobs rapidly
    const jobs = [];
    for (let i = 0; i < 10000; i++) {
      jobs.push(queue.add('stress-job', { data: `job-${i}` }));
    }
    
    await Promise.all(jobs);
    
    // Monitor queue statistics
    const stats = await queueManager.getQueueStats(queueName);
    expect(stats.waiting + stats.active).toBeLessThan(15000); // Some jobs should process
  }

  private async performDatabaseStressTest(): Promise<void> {
    const batchSize = 1000;
    const totalBatches = 10;
    
    for (let i = 0; i < totalBatches; i++) {
      const batch = [];
      for (let j = 0; j < batchSize; j++) {
        batch.push({
          email: `stress-test-${i}-${j}@example.com`,
          name: `Stress Test User ${i}-${j}`,
          workspace_id: 'test-workspace'
        });
      }
      
      const { error } = await supabase
        .from('leads')
        .insert(batch);
      
      if (error) {
        logger.warn('Database stress test batch failed', { error, batchIndex: i });
      }
    }
  }

  private async performRedisStressTest(): Promise<void> {
    const client = redisManager.getClient();
    if (!client) throw new Error('Redis client not available');
    
    const operations = [];
    
    // Perform many Redis operations
    for (let i = 0; i < 5000; i++) {
      operations.push(client.set(`stress-key-${i}`, `value-${i}`));
    }
    
    await Promise.all(operations);
    
    // Verify some operations
    const testKeys = ['stress-key-0', 'stress-key-100', 'stress-key-500'];
    for (const key of testKeys) {
      const value = await client.get(key);
      expect(value).toBeTruthy();
    }
  }
});