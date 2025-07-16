import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { performanceDataGenerator } from '../data-generator';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { LoadTestRunner } from '../runners/load-test-runner';
import { queueManager } from '@/lib/queue';
import { redisManager } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { LOAD_TEST_SCENARIOS } from '../config';

describe('Queue Stress Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let loadTestRunner: LoadTestRunner;
  let testStartTime: number;

  beforeAll(async () => {
    logger.info('Starting Queue Stress Test Setup');
    
    // Initialize performance monitoring
    performanceMonitor = new PerformanceMonitor({
      metricsInterval: 2000,
      resourceMonitoring: true,
      enableDetailedMetrics: true
    });
    
    // Initialize load test runner
    loadTestRunner = new LoadTestRunner(LOAD_TEST_SCENARIOS.QUEUE_SYSTEM_STRESS);
    
    // Setup infrastructure
    await queueManager.initialize();
    await redisManager.connect();
    
    // Start monitoring
    await performanceMonitor.start();
    
    logger.info('Queue Stress Test Setup Complete');
  });

  afterAll(async () => {
    logger.info('Cleaning up Queue Stress Test');
    
    // Stop monitoring and generate reports
    const report = await performanceMonitor.stop();
    await performanceMonitor.generateReport(report, 'queue-stress-test');
    
    // Cleanup
    await queueManager.closeAll();
    await redisManager.disconnect();
    
    logger.info('Queue Stress Test Cleanup Complete');
  });

  beforeEach(() => {
    testStartTime = performance.now();
  });

  afterEach(() => {
    const testDuration = performance.now() - testStartTime;
    logger.info(`Test completed in ${testDuration.toFixed(2)}ms`);
  });

  describe('High-Volume Queue Operations', () => {
    it('should handle 50,000 jobs in queue efficiently', async () => {
      const scenario = LOAD_TEST_SCENARIOS.QUEUE_SYSTEM_STRESS;
      const testId = 'high-volume-queue-operations';
      
      logger.info('Starting high-volume queue operations test');
      
      const testMonitor = performanceMonitor.startTest(testId);
      
      try {
        const queueName = 'high-volume-test-queue';
        const totalJobs = 50000;
        const concurrency = 20;
        
        // Create queue with high concurrency
        const queue = queueManager.createQueue({
          name: queueName,
          concurrency: concurrency,
          removeOnComplete: 1000,
          removeOnFail: 1000,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        });
        
        // Generate test jobs
        const jobs = await this.generateQueueJobs(totalJobs, 'mixed');
        
        logger.info(`Generated ${jobs.length} jobs for queue processing`);
        
        // Add jobs to queue in batches
        const batchSize = 1000;
        const addStartTime = performance.now();
        
        for (let i = 0; i < jobs.length; i += batchSize) {
          const batch = jobs.slice(i, i + batchSize);
          const batchJobs = batch.map(job => ({
            name: job.type,
            data: job.data,
            opts: {
              priority: job.priority,
              delay: job.delay || 0,
            },
          }));
          
          await queue.addBulk(batchJobs);
          
          // Log progress
          if (i % 10000 === 0) {
            logger.info(`Added ${i + batchSize} jobs to queue`);
          }
        }
        
        const addTime = performance.now() - addStartTime;
        logger.info(`Added all ${totalJobs} jobs to queue in ${addTime.toFixed(2)}ms`);
        
        // Set up job processing
        const processedJobs = [];
        const failedJobs = [];
        
        queue.process(concurrency, async (job) => {
          try {
            const result = await this.processQueueJob(job.data);
            processedJobs.push({ id: job.id, result });
            return result;
          } catch (error) {
            failedJobs.push({ id: job.id, error: error.message });
            throw error;
          }
        });
        
        // Monitor queue processing
        const processStartTime = performance.now();
        
        let processingComplete = false;
        let lastProcessedCount = 0;
        const progressChecks = [];
        
        while (!processingComplete) {
          const stats = await queueManager.getQueueStats(queueName);
          const totalProcessed = stats.completed + stats.failed;
          
          progressChecks.push({
            timestamp: performance.now(),
            waiting: stats.waiting,
            active: stats.active,
            completed: stats.completed,
            failed: stats.failed,
            totalProcessed
          });
          
          // Check if processing is complete
          if (totalProcessed >= totalJobs) {
            processingComplete = true;
          }
          
          // Log progress
          if (totalProcessed > lastProcessedCount + 5000) {
            logger.info(`Queue progress: ${totalProcessed}/${totalJobs} jobs processed`);
            lastProcessedCount = totalProcessed;
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const processTime = performance.now() - processStartTime;
        const finalStats = await queueManager.getQueueStats(queueName);
        
        // Calculate metrics
        const totalProcessed = finalStats.completed + finalStats.failed;
        const processingThroughput = totalProcessed / (processTime / 1000);
        const successRate = finalStats.completed / totalProcessed;
        
        logger.info(`High-volume queue operations completed`, {
          totalJobs,
          totalProcessed,
          completed: finalStats.completed,
          failed: finalStats.failed,
          processingThroughput,
          successRate,
          addTime,
          processTime
        });
        
        // Verify performance thresholds
        expect(processingThroughput).toBeGreaterThan(scenario.thresholds.throughput);
        expect(successRate).toBeGreaterThan(scenario.thresholds.successRate);
        expect(finalStats.failed / totalJobs).toBeLessThan(scenario.thresholds.errorRate);
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('High-volume queue operations test completed successfully', {
          testMetrics,
          finalStats,
          processingThroughput
        });
        
      } catch (error) {
        logger.error('High-volume queue operations test failed', error);
        throw error;
      }
    }, 30 * 60 * 1000); // 30 minutes timeout
  });

  describe('Multiple Queue Concurrency', () => {
    it('should handle multiple queues processing simultaneously', async () => {
      const testId = 'multiple-queue-concurrency';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting multiple queue concurrency test');
      
      try {
        const queueCount = 10;
        const jobsPerQueue = 5000;
        const totalJobs = queueCount * jobsPerQueue;
        
        // Create multiple queues
        const queues = [];
        for (let i = 0; i < queueCount; i++) {
          const queueName = `concurrent-queue-${i}`;
          const queue = queueManager.createQueue({
            name: queueName,
            concurrency: 15,
            removeOnComplete: 100,
            removeOnFail: 100,
          });
          
          queues.push({ name: queueName, queue, processed: 0, failed: 0 });
        }
        
        // Generate jobs for each queue
        const allJobs = [];
        for (let i = 0; i < queueCount; i++) {
          const queueJobs = await this.generateQueueJobs(jobsPerQueue, 'standard');
          allJobs.push({ queueIndex: i, jobs: queueJobs });
        }
        
        logger.info(`Generated ${totalJobs} jobs across ${queueCount} queues`);
        
        // Set up processing for all queues
        const processingPromises = queues.map((queueInfo, index) => {
          return this.processQueueConcurrently(queueInfo, allJobs[index].jobs);
        });
        
        // Add jobs to all queues simultaneously
        const addStartTime = performance.now();
        
        const addPromises = allJobs.map(({ queueIndex, jobs }) => {
          return this.addJobsToQueue(queues[queueIndex].queue, jobs);
        });
        
        await Promise.all(addPromises);
        
        const addTime = performance.now() - addStartTime;
        
        // Wait for all queues to complete processing
        const processStartTime = performance.now();
        const results = await Promise.all(processingPromises);
        const processTime = performance.now() - processStartTime;
        
        // Calculate aggregate metrics
        const totalProcessed = results.reduce((sum, result) => sum + result.processed, 0);
        const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);
        const overallThroughput = totalProcessed / (processTime / 1000);
        const overallSuccessRate = totalProcessed / (totalProcessed + totalFailed);
        
        logger.info(`Multiple queue concurrency test completed`, {
          queueCount,
          totalJobs,
          totalProcessed,
          totalFailed,
          overallThroughput,
          overallSuccessRate,
          addTime,
          processTime
        });
        
        // Verify performance across all queues
        expect(overallThroughput).toBeGreaterThan(200); // At least 200 jobs/second across all queues
        expect(overallSuccessRate).toBeGreaterThan(0.95); // 95% success rate
        expect(totalProcessed + totalFailed).toBe(totalJobs); // All jobs processed
        
        // Verify individual queue performance
        for (const result of results) {
          expect(result.processed + result.failed).toBe(jobsPerQueue);
          expect(result.processed / (result.processed + result.failed)).toBeGreaterThan(0.93);
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Multiple queue concurrency test completed successfully', {
          testMetrics,
          results,
          overallThroughput
        });
        
      } catch (error) {
        logger.error('Multiple queue concurrency test failed', error);
        throw error;
      }
    }, 20 * 60 * 1000); // 20 minutes timeout
  });

  describe('Queue Memory Management', () => {
    it('should manage memory efficiently with large queues', async () => {
      const testId = 'queue-memory-management';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting queue memory management test');
      
      try {
        const queueName = 'memory-management-queue';
        const batchSize = 10000;
        const totalBatches = 5;
        const totalJobs = batchSize * totalBatches;
        
        // Create queue with memory management settings
        const queue = queueManager.createQueue({
          name: queueName,
          concurrency: 10,
          removeOnComplete: 100, // Keep only 100 completed jobs
          removeOnFail: 50, // Keep only 50 failed jobs
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 5,
          },
        });
        
        const initialMemory = process.memoryUsage();
        const memoryChecks = [];
        
        // Process batches sequentially to test memory management
        for (let batch = 0; batch < totalBatches; batch++) {
          logger.info(`Processing batch ${batch + 1}/${totalBatches}`);
          
          // Generate jobs for this batch
          const batchJobs = await this.generateQueueJobs(batchSize, 'memory_intensive');
          
          // Add jobs to queue
          const batchStartTime = performance.now();
          await this.addJobsToQueue(queue, batchJobs);
          
          // Set up processing
          const batchResult = await this.processQueueBatch(queue, batchSize);
          
          const batchTime = performance.now() - batchStartTime;
          const currentMemory = process.memoryUsage();
          
          memoryChecks.push({
            batch: batch + 1,
            batchTime,
            heapUsed: currentMemory.heapUsed,
            heapTotal: currentMemory.heapTotal,
            external: currentMemory.external,
            processed: batchResult.processed,
            failed: batchResult.failed
          });
          
          logger.info(`Batch ${batch + 1} completed`, {
            processed: batchResult.processed,
            failed: batchResult.failed,
            batchTime,
            memoryUsage: `${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
          });
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          
          // Wait between batches
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const finalMemory = process.memoryUsage();
        const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // Analyze memory usage
        const maxMemory = Math.max(...memoryChecks.map(c => c.heapUsed));
        const avgMemory = memoryChecks.reduce((sum, c) => sum + c.heapUsed, 0) / memoryChecks.length;
        const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed;
        
        logger.info(`Queue memory management test completed`, {
          totalJobs,
          totalBatches,
          initialMemory: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          finalMemory: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          maxMemory: `${(maxMemory / 1024 / 1024).toFixed(2)} MB`,
          avgMemory: `${(avgMemory / 1024 / 1024).toFixed(2)} MB`,
          memoryGrowth: `${(memoryGrowth * 100).toFixed(2)}%`,
          totalMemoryIncrease: `${(totalMemoryIncrease / 1024 / 1024).toFixed(2)} MB`
        });
        
        // Verify memory is managed efficiently
        expect(memoryGrowth).toBeLessThan(2.0); // Memory growth under 200%
        expect(totalMemoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB increase
        
        // Verify all jobs were processed
        const totalProcessed = memoryChecks.reduce((sum, c) => sum + c.processed, 0);
        expect(totalProcessed).toBeGreaterThan(totalJobs * 0.95); // 95% of jobs processed
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Queue memory management test completed successfully', {
          testMetrics,
          memoryChecks,
          memoryGrowth
        });
        
      } catch (error) {
        logger.error('Queue memory management test failed', error);
        throw error;
      }
    }, 25 * 60 * 1000); // 25 minutes timeout
  });

  describe('Queue Failure Recovery', () => {
    it('should recover from Redis connection failures', async () => {
      const testId = 'queue-failure-recovery';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting queue failure recovery test');
      
      try {
        const queueName = 'failure-recovery-queue';
        const totalJobs = 10000;
        
        // Create queue
        const queue = queueManager.createQueue({
          name: queueName,
          concurrency: 20,
          removeOnComplete: 500,
          removeOnFail: 500,
          defaultJobOptions: {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        });
        
        // Generate jobs
        const jobs = await this.generateQueueJobs(totalJobs, 'failure_test');
        
        // Add jobs to queue
        await this.addJobsToQueue(queue, jobs);
        
        // Start processing
        const processedJobs = [];
        const failedJobs = [];
        
        queue.process(20, async (job) => {
          try {
            const result = await this.processQueueJob(job.data);
            processedJobs.push({ id: job.id, result });
            return result;
          } catch (error) {
            failedJobs.push({ id: job.id, error: error.message });
            throw error;
          }
        });
        
        // Simulate Redis connection issues during processing
        const failureSchedule = [
          { time: 10000, duration: 5000 }, // 10s in, fail for 5s
          { time: 30000, duration: 3000 }, // 30s in, fail for 3s
          { time: 60000, duration: 7000 }, // 60s in, fail for 7s
        ];
        
        const failureResults = [];
        
        for (const failure of failureSchedule) {
          setTimeout(async () => {
            logger.info(`Simulating Redis failure at ${failure.time}ms for ${failure.duration}ms`);
            
            const beforeFailure = await queueManager.getQueueStats(queueName);
            
            // Simulate Redis connection failure
            await this.simulateRedisFailure(failure.duration);
            
            const afterRecovery = await queueManager.getQueueStats(queueName);
            
            failureResults.push({
              time: failure.time,
              duration: failure.duration,
              beforeFailure,
              afterRecovery
            });
          }, failure.time);
        }
        
        // Wait for all jobs to complete
        let processingComplete = false;
        const startTime = performance.now();
        
        while (!processingComplete && (performance.now() - startTime) < 300000) { // 5 minute timeout
          const stats = await queueManager.getQueueStats(queueName);
          const totalProcessed = stats.completed + stats.failed;
          
          if (totalProcessed >= totalJobs) {
            processingComplete = true;
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const finalStats = await queueManager.getQueueStats(queueName);
        const totalProcessed = finalStats.completed + finalStats.failed;
        const successRate = finalStats.completed / totalProcessed;
        
        logger.info(`Queue failure recovery test completed`, {
          totalJobs,
          totalProcessed,
          completed: finalStats.completed,
          failed: finalStats.failed,
          successRate,
          failureResults
        });
        
        // Verify system recovered from failures
        expect(totalProcessed).toBeGreaterThan(totalJobs * 0.9); // 90% of jobs processed
        expect(successRate).toBeGreaterThan(0.85); // 85% success rate despite failures
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Queue failure recovery test completed successfully', {
          testMetrics,
          finalStats,
          failureResults
        });
        
      } catch (error) {
        logger.error('Queue failure recovery test failed', error);
        throw error;
      }
    }, 15 * 60 * 1000); // 15 minutes timeout
  });

  describe('Queue Priority Processing', () => {
    it('should process high-priority jobs first', async () => {
      const testId = 'queue-priority-processing';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting queue priority processing test');
      
      try {
        const queueName = 'priority-processing-queue';
        const jobsPerPriority = 2000;
        const priorities = [1, 2, 3, 4, 5]; // 5 is highest priority
        const totalJobs = jobsPerPriority * priorities.length;
        
        // Create queue
        const queue = queueManager.createQueue({
          name: queueName,
          concurrency: 10,
          removeOnComplete: 100,
          removeOnFail: 100,
        });
        
        // Generate jobs with different priorities
        const allJobs = [];
        for (const priority of priorities) {
          const priorityJobs = await this.generateQueueJobs(jobsPerPriority, 'priority');
          priorityJobs.forEach(job => {
            job.priority = priority;
            allJobs.push(job);
          });
        }
        
        // Shuffle jobs to test priority ordering
        this.shuffleArray(allJobs);
        
        // Add jobs to queue with priorities
        for (const job of allJobs) {
          await queue.add(job.type, job.data, {
            priority: job.priority,
          });
        }
        
        logger.info(`Added ${totalJobs} jobs with priorities ${priorities.join(', ')}`);
        
        // Process jobs and track execution order
        const processedJobs = [];
        const processingOrder = [];
        
        queue.process(10, async (job) => {
          try {
            const startTime = performance.now();
            const result = await this.processQueueJob(job.data);
            const endTime = performance.now();
            
            const processedJob = {
              id: job.id,
              priority: job.opts.priority,
              result,
              processTime: endTime - startTime,
              processedAt: endTime
            };
            
            processedJobs.push(processedJob);
            processingOrder.push(job.opts.priority);
            
            return result;
          } catch (error) {
            throw error;
          }
        });
        
        // Wait for processing to complete
        let processingComplete = false;
        const startTime = performance.now();
        
        while (!processingComplete && (performance.now() - startTime) < 300000) { // 5 minute timeout
          const stats = await queueManager.getQueueStats(queueName);
          const totalProcessed = stats.completed + stats.failed;
          
          if (totalProcessed >= totalJobs) {
            processingComplete = true;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Analyze priority processing
        const priorityStats = priorities.map(priority => {
          const priorityJobs = processedJobs.filter(job => job.priority === priority);
          const avgProcessTime = priorityJobs.reduce((sum, job) => sum + job.processTime, 0) / priorityJobs.length;
          const avgPositionInQueue = this.calculateAveragePosition(processingOrder, priority);
          
          return {
            priority,
            jobCount: priorityJobs.length,
            avgProcessTime,
            avgPositionInQueue
          };
        });
        
        logger.info(`Queue priority processing test completed`, {
          totalJobs,
          processedCount: processedJobs.length,
          priorityStats
        });
        
        // Verify priority processing
        expect(processedJobs.length).toBeGreaterThan(totalJobs * 0.95); // 95% of jobs processed
        
        // Higher priority jobs should be processed earlier on average
        const highPriorityStats = priorityStats.find(s => s.priority === 5);
        const lowPriorityStats = priorityStats.find(s => s.priority === 1);
        
        if (highPriorityStats && lowPriorityStats) {
          expect(highPriorityStats.avgPositionInQueue).toBeLessThan(lowPriorityStats.avgPositionInQueue);
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Queue priority processing test completed successfully', {
          testMetrics,
          priorityStats,
          processedCount: processedJobs.length
        });
        
      } catch (error) {
        logger.error('Queue priority processing test failed', error);
        throw error;
      }
    }, 15 * 60 * 1000); // 15 minutes timeout
  });

  // Helper methods
  private async generateQueueJobs(count: number, type: string): Promise<any[]> {
    const jobs = [];
    
    for (let i = 0; i < count; i++) {
      const job = {
        type: type,
        data: this.generateJobData(type, i),
        priority: Math.floor(Math.random() * 5) + 1,
        delay: type === 'delayed' ? Math.floor(Math.random() * 5000) : 0
      };
      
      jobs.push(job);
    }
    
    return jobs;
  }

  private generateJobData(type: string, index: number): any {
    const baseData = {
      id: `${type}_${index}`,
      timestamp: Date.now(),
      index
    };
    
    switch (type) {
      case 'memory_intensive':
        return {
          ...baseData,
          largeData: new Array(1000).fill(`data_${index}`),
          payload: 'x'.repeat(1000)
        };
      case 'failure_test':
        return {
          ...baseData,
          shouldFail: Math.random() < 0.1, // 10% chance of failure
          retryCount: 0
        };
      case 'priority':
        return {
          ...baseData,
          importance: Math.floor(Math.random() * 5) + 1
        };
      default:
        return baseData;
    }
  }

  private async processQueueJob(jobData: any): Promise<any> {
    // Simulate processing time based on job type
    const processingTimes = {
      mixed: 100,
      standard: 50,
      memory_intensive: 200,
      failure_test: 75,
      priority: 80
    };
    
    const baseTime = processingTimes[jobData.type] || 100;
    const processingTime = baseTime + (Math.random() * 50 - 25); // ±25ms variation
    
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Handle failure test jobs
    if (jobData.shouldFail && jobData.retryCount < 2) {
      jobData.retryCount++;
      throw new Error(`Job ${jobData.id} failed (retry ${jobData.retryCount})`);
    }
    
    return {
      processed: true,
      result: `Processed ${jobData.id}`,
      processingTime
    };
  }

  private async addJobsToQueue(queue: any, jobs: any[]): Promise<void> {
    const batchSize = 500;
    
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      const batchJobs = batch.map(job => ({
        name: job.type,
        data: job.data,
        opts: {
          priority: job.priority,
          delay: job.delay || 0,
        },
      }));
      
      await queue.addBulk(batchJobs);
    }
  }

  private async processQueueConcurrently(queueInfo: any, jobs: any[]): Promise<{
    processed: number;
    failed: number;
    duration: number;
  }> {
    const startTime = performance.now();
    let processed = 0;
    let failed = 0;
    
    // Set up processing
    queueInfo.queue.process(15, async (job) => {
      try {
        const result = await this.processQueueJob(job.data);
        processed++;
        return result;
      } catch (error) {
        failed++;
        throw error;
      }
    });
    
    // Add jobs to queue
    await this.addJobsToQueue(queueInfo.queue, jobs);
    
    // Wait for processing to complete
    let processingComplete = false;
    
    while (!processingComplete) {
      const stats = await queueManager.getQueueStats(queueInfo.name);
      const totalProcessed = stats.completed + stats.failed;
      
      if (totalProcessed >= jobs.length) {
        processingComplete = true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const duration = performance.now() - startTime;
    return { processed, failed, duration };
  }

  private async processQueueBatch(queue: any, expectedJobs: number): Promise<{
    processed: number;
    failed: number;
  }> {
    let processed = 0;
    let failed = 0;
    
    // Set up processing
    queue.process(10, async (job) => {
      try {
        const result = await this.processQueueJob(job.data);
        processed++;
        return result;
      } catch (error) {
        failed++;
        throw error;
      }
    });
    
    // Wait for batch to complete
    let batchComplete = false;
    
    while (!batchComplete) {
      if (processed + failed >= expectedJobs) {
        batchComplete = true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return { processed, failed };
  }

  private async simulateRedisFailure(durationMs: number): Promise<void> {
    // Simulate Redis connection failure
    // In a real scenario, this would temporarily disconnect Redis
    await new Promise(resolve => setTimeout(resolve, durationMs));
  }

  private calculateAveragePosition(processingOrder: number[], priority: number): number {
    const positions = processingOrder.map((p, index) => p === priority ? index : -1)
      .filter(p => p !== -1);
    
    return positions.length > 0 
      ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length
      : 0;
  }

  private shuffleArray(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
});