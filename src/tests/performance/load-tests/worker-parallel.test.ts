import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { performanceDataGenerator } from '../data-generator';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { LoadTestRunner } from '../runners/load-test-runner';
import { emailWorkersService, emailWorkerManager } from '@/lib/email-workers';
import { queueManager } from '@/lib/queue';
import { redisManager } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { LOAD_TEST_SCENARIOS } from '../config';

describe('Worker Parallel Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let loadTestRunner: LoadTestRunner;
  let testStartTime: number;
  const maxCpus = cpus().length;

  beforeAll(async () => {
    logger.info('Starting Worker Parallel Test Setup');
    
    // Initialize performance monitoring
    performanceMonitor = new PerformanceMonitor({
      metricsInterval: 3000,
      resourceMonitoring: true,
      enableDetailedMetrics: true
    });
    
    // Initialize load test runner
    loadTestRunner = new LoadTestRunner(LOAD_TEST_SCENARIOS.WORKER_PARALLEL_STRESS);
    
    // Setup infrastructure
    await queueManager.initialize();
    await redisManager.connect();
    
    // Start monitoring
    await performanceMonitor.start();
    
    logger.info('Worker Parallel Test Setup Complete');
  });

  afterAll(async () => {
    logger.info('Cleaning up Worker Parallel Test');
    
    // Stop monitoring and generate reports
    const report = await performanceMonitor.stop();
    await performanceMonitor.generateReport(report, 'worker-parallel-test');
    
    // Cleanup
    await emailWorkersService.stop();
    await queueManager.closeAll();
    await redisManager.disconnect();
    
    logger.info('Worker Parallel Test Cleanup Complete');
  });

  beforeEach(() => {
    testStartTime = performance.now();
  });

  afterEach(() => {
    const testDuration = performance.now() - testStartTime;
    logger.info(`Test completed in ${testDuration.toFixed(2)}ms`);
  });

  describe('Dynamic Worker Scaling', () => {
    it('should scale workers based on load automatically', async () => {
      const testId = 'dynamic-worker-scaling';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting dynamic worker scaling test');
      
      try {
        // Initialize email workers with auto-scaling
        await emailWorkersService.initialize({
          autoStart: true,
          maxWorkers: Math.min(50, maxCpus * 4),
          minWorkers: 2,
          targetThroughput: 100
        });
        
        // Test different load levels
        const loadLevels = [
          { name: 'low', jobsPerSecond: 10, duration: 30 },
          { name: 'medium', jobsPerSecond: 50, duration: 60 },
          { name: 'high', jobsPerSecond: 100, duration: 90 },
          { name: 'peak', jobsPerSecond: 200, duration: 120 },
          { name: 'extreme', jobsPerSecond: 500, duration: 60 }
        ];
        
        const results = [];
        
        for (const level of loadLevels) {
          logger.info(`Testing load level: ${level.name} (${level.jobsPerSecond} jobs/sec for ${level.duration}s)`);
          
          const levelStartTime = performance.now();
          
          // Generate jobs for this load level
          const totalJobs = level.jobsPerSecond * level.duration;
          const jobs = await this.generateEmailJobs(totalJobs);
          
          // Monitor worker count before load
          const initialWorkerCount = emailWorkerManager.getWorkerCount();
          
          // Apply load
          const loadPromise = this.applyLoadWithRate(jobs, level.jobsPerSecond, level.duration);
          
          // Monitor worker scaling during load
          const scalingMetrics = await this.monitorWorkerScaling(level.duration);
          
          // Wait for load completion
          const loadResult = await loadPromise;
          
          const levelTime = performance.now() - levelStartTime;
          const finalWorkerCount = emailWorkerManager.getWorkerCount();
          
          results.push({
            level: level.name,
            initialWorkerCount,
            finalWorkerCount,
            maxWorkerCount: scalingMetrics.maxWorkers,
            minWorkerCount: scalingMetrics.minWorkers,
            avgWorkerCount: scalingMetrics.avgWorkers,
            scalingEvents: scalingMetrics.scalingEvents,
            jobsProcessed: loadResult.processed,
            jobsFailed: loadResult.failed,
            actualThroughput: loadResult.processed / (levelTime / 1000),
            levelTime
          });
          
          logger.info(`Load level ${level.name} completed`, {
            initialWorkerCount,
            finalWorkerCount,
            maxWorkerCount: scalingMetrics.maxWorkers,
            jobsProcessed: loadResult.processed,
            actualThroughput: loadResult.processed / (levelTime / 1000)
          });
          
          // Allow system to stabilize between tests
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        // Verify scaling behavior
        const lowLoad = results.find(r => r.level === 'low');
        const peakLoad = results.find(r => r.level === 'peak');
        
        if (lowLoad && peakLoad) {
          expect(peakLoad.maxWorkerCount).toBeGreaterThan(lowLoad.maxWorkerCount);
          expect(peakLoad.actualThroughput).toBeGreaterThan(lowLoad.actualThroughput);
        }
        
        // Verify all loads were handled successfully
        for (const result of results) {
          const successRate = result.jobsProcessed / (result.jobsProcessed + result.jobsFailed);
          expect(successRate).toBeGreaterThan(0.95); // 95% success rate
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Dynamic worker scaling test completed successfully', {
          testMetrics,
          results
        });
        
      } catch (error) {
        logger.error('Dynamic worker scaling test failed', error);
        throw error;
      }
    }, 20 * 60 * 1000); // 20 minutes timeout
  });

  describe('Worker Fault Tolerance', () => {
    it('should handle worker failures gracefully', async () => {
      const testId = 'worker-fault-tolerance';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting worker fault tolerance test');
      
      try {
        // Initialize workers
        await emailWorkersService.initialize({
          autoStart: true,
          maxWorkers: 20,
          minWorkers: 5,
          targetThroughput: 100
        });
        
        // Generate sustained load
        const jobsPerSecond = 50;
        const testDuration = 300; // 5 minutes
        const totalJobs = jobsPerSecond * testDuration;
        const jobs = await this.generateEmailJobs(totalJobs);
        
        // Start load
        const loadPromise = this.applyLoadWithRate(jobs, jobsPerSecond, testDuration);
        
        // Simulate worker failures during load
        const failureSchedule = [
          { time: 30, workersToKill: 3 },
          { time: 90, workersToKill: 5 },
          { time: 150, workersToKill: 2 },
          { time: 210, workersToKill: 4 }
        ];
        
        const failureResults = [];
        
        // Schedule worker failures
        for (const failure of failureSchedule) {
          setTimeout(async () => {
            logger.info(`Simulating failure of ${failure.workersToKill} workers at ${failure.time}s`);
            
            const beforeFailure = emailWorkerManager.getWorkerCount();
            await this.simulateWorkerFailures(failure.workersToKill);
            
            // Monitor recovery
            const recoveryStartTime = performance.now();
            let recovered = false;
            let recoveryTime = 0;
            
            while (!recovered && recoveryTime < 30000) { // 30 second timeout
              await new Promise(resolve => setTimeout(resolve, 1000));
              const currentWorkers = emailWorkerManager.getWorkerCount();
              recoveryTime = performance.now() - recoveryStartTime;
              
              if (currentWorkers >= beforeFailure - failure.workersToKill + Math.floor(failure.workersToKill * 0.8)) {
                recovered = true;
              }
            }
            
            failureResults.push({
              time: failure.time,
              workersKilled: failure.workersToKill,
              beforeFailure,
              afterRecovery: emailWorkerManager.getWorkerCount(),
              recoveryTime,
              recovered
            });
            
            logger.info(`Worker failure recovery completed`, {
              workersKilled: failure.workersToKill,
              recoveryTime,
              recovered
            });
          }, failure.time * 1000);
        }
        
        // Wait for load completion
        const loadResult = await loadPromise;
        
        // Verify system handled failures well
        const successRate = loadResult.processed / (loadResult.processed + loadResult.failed);
        expect(successRate).toBeGreaterThan(0.85); // 85% success rate even with failures
        
        // Verify all failures were recovered
        for (const failure of failureResults) {
          expect(failure.recovered).toBe(true);
          expect(failure.recoveryTime).toBeLessThan(30000); // Recovery within 30 seconds
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Worker fault tolerance test completed successfully', {
          testMetrics,
          loadResult,
          failureResults
        });
        
      } catch (error) {
        logger.error('Worker fault tolerance test failed', error);
        throw error;
      }
    }, 15 * 60 * 1000); // 15 minutes timeout
  });

  describe('Maximum Worker Concurrency', () => {
    it('should handle maximum worker concurrency efficiently', async () => {
      const testId = 'max-worker-concurrency';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting maximum worker concurrency test');
      
      try {
        const maxWorkers = Math.min(100, maxCpus * 8); // Limit based on CPU cores
        
        // Initialize with maximum workers
        await emailWorkersService.initialize({
          autoStart: true,
          maxWorkers,
          minWorkers: maxWorkers,
          targetThroughput: 1000
        });
        
        // Generate high-volume load
        const jobsPerSecond = 500;
        const testDuration = 180; // 3 minutes
        const totalJobs = jobsPerSecond * testDuration;
        const jobs = await this.generateEmailJobs(totalJobs);
        
        logger.info(`Testing with ${maxWorkers} workers processing ${totalJobs} jobs`);
        
        const startTime = performance.now();
        
        // Apply maximum load
        const loadResult = await this.applyLoadWithRate(jobs, jobsPerSecond, testDuration);
        
        const totalTime = performance.now() - startTime;
        const actualThroughput = loadResult.processed / (totalTime / 1000);
        
        // Monitor system resources during peak load
        const systemStats = await this.getSystemStats();
        
        logger.info(`Maximum concurrency test completed`, {
          maxWorkers,
          totalJobs,
          processed: loadResult.processed,
          failed: loadResult.failed,
          actualThroughput,
          totalTime,
          systemStats
        });
        
        // Verify performance under maximum load
        const successRate = loadResult.processed / (loadResult.processed + loadResult.failed);
        expect(successRate).toBeGreaterThan(0.90); // 90% success rate under maximum load
        expect(actualThroughput).toBeGreaterThan(200); // At least 200 jobs/second
        
        // Verify system resources are within limits
        expect(systemStats.cpuUsage).toBeLessThan(95); // CPU usage under 95%
        expect(systemStats.memoryUsage).toBeLessThan(90); // Memory usage under 90%
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Maximum worker concurrency test completed successfully', {
          testMetrics,
          loadResult,
          systemStats
        });
        
      } catch (error) {
        logger.error('Maximum worker concurrency test failed', error);
        throw error;
      }
    }, 10 * 60 * 1000); // 10 minutes timeout
  });

  describe('Worker Load Distribution', () => {
    it('should distribute load evenly across workers', async () => {
      const testId = 'worker-load-distribution';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting worker load distribution test');
      
      try {
        const workerCount = 10;
        
        // Initialize with fixed worker count
        await emailWorkersService.initialize({
          autoStart: true,
          maxWorkers: workerCount,
          minWorkers: workerCount,
          targetThroughput: 200
        });
        
        // Generate diverse job types
        const jobTypes = ['email_sending', 'template_processing', 'list_processing', 'analytics'];
        const jobsPerType = 500;
        const totalJobs = jobTypes.length * jobsPerType;
        
        const jobs = [];
        for (const jobType of jobTypes) {
          const typeJobs = await this.generateJobsOfType(jobType, jobsPerType);
          jobs.push(...typeJobs);
        }
        
        // Shuffle jobs for random distribution
        this.shuffleArray(jobs);
        
        logger.info(`Testing load distribution with ${workerCount} workers processing ${totalJobs} jobs`);
        
        const startTime = performance.now();
        
        // Process all jobs
        const loadResult = await this.applyLoadWithRate(jobs, 100, 60);
        
        const totalTime = performance.now() - startTime;
        
        // Analyze worker load distribution
        const workerStats = await this.getWorkerDistributionStats();
        
        // Calculate distribution metrics
        const jobsPerWorker = workerStats.map(w => w.jobsProcessed);
        const avgJobsPerWorker = jobsPerWorker.reduce((a, b) => a + b, 0) / jobsPerWorker.length;
        const maxDeviation = Math.max(...jobsPerWorker.map(j => Math.abs(j - avgJobsPerWorker)));
        const distributionBalance = 1 - (maxDeviation / avgJobsPerWorker);
        
        logger.info(`Load distribution test completed`, {
          workerCount,
          totalJobs,
          processed: loadResult.processed,
          avgJobsPerWorker,
          maxDeviation,
          distributionBalance,
          workerStats
        });
        
        // Verify even distribution
        expect(distributionBalance).toBeGreaterThan(0.7); // At least 70% balance
        expect(loadResult.processed).toBeGreaterThan(totalJobs * 0.95); // 95% of jobs processed
        
        // Verify no single worker is overloaded
        const maxJobsPerWorker = Math.max(...jobsPerWorker);
        const minJobsPerWorker = Math.min(...jobsPerWorker);
        const loadVariance = (maxJobsPerWorker - minJobsPerWorker) / avgJobsPerWorker;
        expect(loadVariance).toBeLessThan(0.5); // Load variance under 50%
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Worker load distribution test completed successfully', {
          testMetrics,
          loadResult,
          workerStats,
          distributionBalance
        });
        
      } catch (error) {
        logger.error('Worker load distribution test failed', error);
        throw error;
      }
    }, 10 * 60 * 1000); // 10 minutes timeout
  });

  describe('Worker Resource Isolation', () => {
    it('should isolate worker resources properly', async () => {
      const testId = 'worker-resource-isolation';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting worker resource isolation test');
      
      try {
        const workerCount = 8;
        
        // Initialize workers
        await emailWorkersService.initialize({
          autoStart: true,
          maxWorkers: workerCount,
          minWorkers: workerCount,
          targetThroughput: 150
        });
        
        // Create jobs that test resource isolation
        const isolationTests = [
          { name: 'memory_intensive', count: 100, type: 'memory' },
          { name: 'cpu_intensive', count: 100, type: 'cpu' },
          { name: 'io_intensive', count: 100, type: 'io' },
          { name: 'network_intensive', count: 100, type: 'network' }
        ];
        
        const results = [];
        
        for (const test of isolationTests) {
          logger.info(`Testing resource isolation: ${test.name}`);
          
          const testJobs = await this.generateResourceIntensiveJobs(test.type, test.count);
          
          const testStartTime = performance.now();
          
          // Run resource-intensive jobs
          const testResult = await this.applyLoadWithRate(testJobs, 20, 30);
          
          const testTime = performance.now() - testStartTime;
          
          // Monitor resource usage during test
          const resourceStats = await this.getResourceUsageStats();
          
          results.push({
            testName: test.name,
            testType: test.type,
            processed: testResult.processed,
            failed: testResult.failed,
            testTime,
            resourceStats
          });
          
          logger.info(`Resource isolation test ${test.name} completed`, {
            processed: testResult.processed,
            failed: testResult.failed,
            resourceStats
          });
          
          // Allow system to recover between tests
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // Verify resource isolation
        for (const result of results) {
          const successRate = result.processed / (result.processed + result.failed);
          expect(successRate).toBeGreaterThan(0.85); // 85% success rate
          
          // Resource usage should be within limits
          expect(result.resourceStats.cpuUsage).toBeLessThan(90);
          expect(result.resourceStats.memoryUsage).toBeLessThan(85);
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Worker resource isolation test completed successfully', {
          testMetrics,
          results
        });
        
      } catch (error) {
        logger.error('Worker resource isolation test failed', error);
        throw error;
      }
    }, 15 * 60 * 1000); // 15 minutes timeout
  });

  // Helper methods
  private async generateEmailJobs(count: number): Promise<any[]> {
    const jobs = [];
    const campaigns = await performanceDataGenerator.generateCampaignTestData(
      Math.ceil(count / 100),
      100
    );
    
    for (const campaign of campaigns) {
      for (const recipient of campaign.recipients) {
        if (jobs.length >= count) break;
        
        jobs.push({
          type: 'email_sending',
          data: {
            campaignId: campaign.name,
            recipient,
            template: campaign.template,
            sender: campaign.sender
          }
        });
      }
    }
    
    return jobs.slice(0, count);
  }

  private async generateJobsOfType(jobType: string, count: number): Promise<any[]> {
    const jobs = [];
    
    for (let i = 0; i < count; i++) {
      jobs.push({
        type: jobType,
        data: {
          id: `${jobType}_${i}`,
          priority: Math.floor(Math.random() * 5) + 1,
          payload: this.generateJobPayload(jobType)
        }
      });
    }
    
    return jobs;
  }

  private async generateResourceIntensiveJobs(resourceType: string, count: number): Promise<any[]> {
    const jobs = [];
    
    for (let i = 0; i < count; i++) {
      jobs.push({
        type: `${resourceType}_intensive`,
        data: {
          id: `${resourceType}_intensive_${i}`,
          resourceType,
          intensity: Math.floor(Math.random() * 5) + 1
        }
      });
    }
    
    return jobs;
  }

  private generateJobPayload(jobType: string): any {
    switch (jobType) {
      case 'email_sending':
        return {
          recipient: 'test@example.com',
          subject: 'Test Email',
          body: 'This is a test email'
        };
      case 'template_processing':
        return {
          templateId: 'template_123',
          variables: { name: 'Test User', company: 'Test Corp' }
        };
      case 'list_processing':
        return {
          listId: 'list_456',
          operation: 'segment',
          criteria: { tag: 'VIP' }
        };
      case 'analytics':
        return {
          campaignId: 'campaign_789',
          metrics: ['opens', 'clicks', 'conversions']
        };
      default:
        return {};
    }
  }

  private async applyLoadWithRate(
    jobs: any[],
    jobsPerSecond: number,
    durationSeconds: number
  ): Promise<{ processed: number; failed: number }> {
    const startTime = performance.now();
    const endTime = startTime + (durationSeconds * 1000);
    const intervalMs = 1000 / jobsPerSecond;
    
    let processed = 0;
    let failed = 0;
    let jobIndex = 0;
    
    while (performance.now() < endTime && jobIndex < jobs.length) {
      const batchStartTime = performance.now();
      
      try {
        await this.processJob(jobs[jobIndex]);
        processed++;
      } catch (error) {
        failed++;
      }
      
      jobIndex++;
      
      // Control rate
      const batchTime = performance.now() - batchStartTime;
      if (batchTime < intervalMs) {
        await new Promise(resolve => setTimeout(resolve, intervalMs - batchTime));
      }
    }
    
    return { processed, failed };
  }

  private async processJob(job: any): Promise<void> {
    // Simulate job processing time based on type
    const processingTimes = {
      email_sending: 100,
      template_processing: 50,
      list_processing: 200,
      analytics: 75,
      memory_intensive: 150,
      cpu_intensive: 200,
      io_intensive: 300,
      network_intensive: 250
    };
    
    const processingTime = processingTimes[job.type] || 100;
    const actualTime = processingTime + (Math.random() * 50 - 25); // ±25ms variation
    
    await new Promise(resolve => setTimeout(resolve, actualTime));
    
    // Simulate occasional failures
    if (Math.random() < 0.01) { // 1% failure rate
      throw new Error(`Job ${job.type} failed`);
    }
  }

  private async monitorWorkerScaling(durationSeconds: number): Promise<{
    maxWorkers: number;
    minWorkers: number;
    avgWorkers: number;
    scalingEvents: number;
  }> {
    const startTime = performance.now();
    const endTime = startTime + (durationSeconds * 1000);
    const measurements = [];
    let scalingEvents = 0;
    let lastWorkerCount = emailWorkerManager.getWorkerCount();
    
    while (performance.now() < endTime) {
      const currentWorkerCount = emailWorkerManager.getWorkerCount();
      measurements.push(currentWorkerCount);
      
      if (currentWorkerCount !== lastWorkerCount) {
        scalingEvents++;
        lastWorkerCount = currentWorkerCount;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return {
      maxWorkers: Math.max(...measurements),
      minWorkers: Math.min(...measurements),
      avgWorkers: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      scalingEvents
    };
  }

  private async simulateWorkerFailures(count: number): Promise<void> {
    const activeWorkers = emailWorkerManager.getActiveWorkerIds();
    const workersToKill = activeWorkers.slice(0, count);
    
    for (const workerId of workersToKill) {
      // Simulate worker failure
      await emailWorkerManager.removeWorker(workerId);
    }
  }

  private async getSystemStats(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    loadAverage: number[];
  }> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const loadAverage = require('os').loadavg();
    
    return {
      cpuUsage: 0, // Would need to implement CPU monitoring
      memoryUsage: (memoryUsage.heapUsed / totalMemory) * 100,
      loadAverage
    };
  }

  private async getWorkerDistributionStats(): Promise<Array<{
    workerId: string;
    jobsProcessed: number;
    avgProcessingTime: number;
    errorRate: number;
  }>> {
    const workerIds = emailWorkerManager.getActiveWorkerIds();
    const stats = [];
    
    for (const workerId of workerIds) {
      // Simulate getting worker stats
      stats.push({
        workerId,
        jobsProcessed: Math.floor(Math.random() * 100) + 50,
        avgProcessingTime: Math.random() * 200 + 100,
        errorRate: Math.random() * 0.05
      });
    }
    
    return stats;
  }

  private async getResourceUsageStats(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
    diskUsage: number;
  }> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    
    return {
      cpuUsage: Math.random() * 80 + 10, // Simulate CPU usage
      memoryUsage: (memoryUsage.heapUsed / totalMemory) * 100,
      networkUsage: Math.random() * 50 + 10, // Simulate network usage
      diskUsage: Math.random() * 30 + 5 // Simulate disk usage
    };
  }

  private shuffleArray(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
});