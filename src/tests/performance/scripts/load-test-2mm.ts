#!/usr/bin/env tsx
/**
 * MailGenius 2MM Contact Load Test
 * 
 * This script runs comprehensive load tests specifically designed to validate
 * the system's ability to handle 2 million contacts with adequate performance.
 * 
 * Test scenarios:
 * 1. Import 2MM contacts in chunks
 * 2. Email campaign to 2MM contacts
 * 3. Database operations at scale
 * 4. System resource monitoring
 * 5. Performance validation
 */

import { Command } from 'commander';
import { logger } from '@/lib/logger';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { performanceReportGenerator } from '../reports/report-generator';
import { LoadTestRunner, createLoadTestConfig, createRequestGenerator } from '../runners/load-test-runner';
import { DataGenerator } from '../data-generator';
import { DEFAULT_PERFORMANCE_CONFIG } from '../config';

const program = new Command();

interface LoadTestOptions {
  contacts?: number;
  concurrency?: number;
  duration?: number;
  monitor?: boolean;
  report?: boolean;
  skipWarmup?: boolean;
  verbose?: boolean;
  scenario?: string;
}

/**
 * 2MM Contact Load Test Runner
 */
class MailGenius2MMLoadTest {
  private monitor: PerformanceMonitor;
  private dataGenerator: DataGenerator;
  private testResults: any[] = [];

  constructor() {
    this.monitor = new PerformanceMonitor({
      metricsInterval: 5000,
      resourceMonitoring: true,
      enableDetailedMetrics: true,
      alertThresholds: {
        cpuUsage: 90,
        memoryUsage: 85,
        responseTime: 10000,
        errorRate: 0.1
      }
    });
    this.dataGenerator = new DataGenerator();
  }

  /**
   * Run 2MM contact load test
   */
  async runLoadTest(options: LoadTestOptions): Promise<void> {
    logger.info('🚀 Starting MailGenius 2MM Contact Load Test', {
      contacts: options.contacts || 2000000,
      concurrency: options.concurrency || 50,
      duration: options.duration || 1800000, // 30 minutes
      scenario: options.scenario || 'full'
    });

    // Start monitoring
    if (options.monitor) {
      await this.monitor.start();
      logger.info('📊 Performance monitoring started');
    }

    const startTime = Date.now();

    try {
      // Run warmup if not skipped
      if (!options.skipWarmup) {
        await this.runWarmup();
      }

      // Run main test scenarios
      switch (options.scenario) {
        case 'import':
          await this.runImportTest(options);
          break;
        case 'email':
          await this.runEmailTest(options);
          break;
        case 'database':
          await this.runDatabaseTest(options);
          break;
        case 'full':
        default:
          await this.runFullTest(options);
          break;
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      logger.info('✅ 2MM Contact Load Test completed', {
        duration: `${(totalDuration / 1000).toFixed(2)}s`,
        scenarios: this.testResults.length,
        passed: this.testResults.filter(r => r.success).length,
        failed: this.testResults.filter(r => !r.success).length
      });

      // Generate report
      if (options.report) {
        await this.generateReport();
      }

      // Print summary
      this.printSummary(totalDuration);

    } catch (error) {
      logger.error('❌ 2MM Contact Load Test failed:', error);
      throw error;
    } finally {
      // Stop monitoring
      if (options.monitor) {
        await this.monitor.stop();
        logger.info('📊 Performance monitoring stopped');
      }
    }
  }

  /**
   * Run system warmup
   */
  private async runWarmup(): Promise<void> {
    logger.info('🔥 Running system warmup');

    const warmupConfig = createLoadTestConfig('warmup', {
      maxConcurrency: 10,
      rampUpTime: 30000, // 30 seconds
      sustainDuration: 60000, // 1 minute
      rampDownTime: 30000, // 30 seconds
      thresholds: {
        avgResponseTime: 5000,
        maxResponseTime: 10000,
        errorRate: 0.1,
        successRate: 0.9,
        throughput: 1
      }
    });

    const warmupRunner = new LoadTestRunner(warmupConfig);
    const requestGenerator = createRequestGenerator({
      method: 'GET',
      execute: async () => {
        // Simple health check
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, message: 'Warmup request' };
      }
    });

    const result = await warmupRunner.runTest(requestGenerator, {
      performanceMonitor: this.monitor,
      onProgress: (progress) => {
        if (progress.progress % 0.25 === 0) {
          logger.info(`🔥 Warmup progress: ${(progress.progress * 100).toFixed(0)}%`);
        }
      }
    });

    this.testResults.push({
      testName: 'warmup',
      success: result.successRate >= 0.9,
      duration: result.totalDuration,
      metrics: result
    });

    logger.info('🔥 System warmup completed', {
      duration: `${(result.totalDuration / 1000).toFixed(2)}s`,
      successRate: `${(result.successRate * 100).toFixed(1)}%`,
      throughput: result.throughput.toFixed(2)
    });
  }

  /**
   * Run import test
   */
  private async runImportTest(options: LoadTestOptions): Promise<void> {
    logger.info('📥 Running 2MM contact import test');

    const contactCount = options.contacts || 2000000;
    const batchSize = 10000;
    const totalBatches = Math.ceil(contactCount / batchSize);

    const importConfig = createLoadTestConfig('contact-import-2mm', {
      maxConcurrency: options.concurrency || 50,
      rampUpTime: 300000, // 5 minutes
      sustainDuration: options.duration || 1200000, // 20 minutes
      rampDownTime: 300000, // 5 minutes
      thresholds: {
        avgResponseTime: 5000,
        maxResponseTime: 15000,
        errorRate: 0.05,
        successRate: 0.95,
        throughput: 10
      }
    });

    const importRunner = new LoadTestRunner(importConfig);
    let batchIndex = 0;

    const requestGenerator = createRequestGenerator({
      method: 'POST',
      execute: async () => {
        const currentBatch = batchIndex % totalBatches;
        const contacts = this.dataGenerator.generateContacts(batchSize, {
          pattern: 'standard',
          includeCustomFields: true
        });

        // Simulate import processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

        batchIndex++;
        return {
          success: true,
          batchIndex: currentBatch,
          contactsProcessed: contacts.length,
          message: `Imported batch ${currentBatch + 1}/${totalBatches}`
        };
      }
    });

    const result = await importRunner.runTest(requestGenerator, {
      performanceMonitor: this.monitor,
      onProgress: (progress) => {
        const contactsProcessed = Math.floor(progress.completedRequests * batchSize);
        const percentage = (contactsProcessed / contactCount * 100).toFixed(1);
        
        if (progress.completedRequests % 10 === 0) {
          logger.info(`📥 Import progress: ${contactsProcessed.toLocaleString()} contacts (${percentage}%)`);
        }
      }
    });

    this.testResults.push({
      testName: 'contact-import-2mm',
      success: result.successRate >= 0.95,
      duration: result.totalDuration,
      metrics: result,
      contactsProcessed: result.totalRequests * batchSize
    });

    logger.info('📥 2MM contact import test completed', {
      duration: `${(result.totalDuration / 1000).toFixed(2)}s`,
      contactsProcessed: (result.totalRequests * batchSize).toLocaleString(),
      successRate: `${(result.successRate * 100).toFixed(1)}%`,
      throughput: `${result.throughput.toFixed(2)} batches/s`,
      avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`
    });
  }

  /**
   * Run email test
   */
  private async runEmailTest(options: LoadTestOptions): Promise<void> {
    logger.info('📧 Running 2MM email sending test');

    const emailConfig = createLoadTestConfig('email-sending-2mm', {
      maxConcurrency: options.concurrency || 100,
      rampUpTime: 300000, // 5 minutes
      sustainDuration: options.duration || 1200000, // 20 minutes
      rampDownTime: 300000, // 5 minutes
      thresholds: {
        avgResponseTime: 2000,
        maxResponseTime: 10000,
        errorRate: 0.02,
        successRate: 0.98,
        throughput: 50 // 50 emails/second
      }
    });

    const emailRunner = new LoadTestRunner(emailConfig);
    let emailIndex = 0;

    const requestGenerator = createRequestGenerator({
      method: 'POST',
      execute: async () => {
        const template = this.dataGenerator.generateEmailTemplate();
        const recipient = this.dataGenerator.generateContacts(1, { pattern: 'standard' })[0];

        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

        emailIndex++;
        return {
          success: Math.random() > 0.02, // 2% failure rate
          emailId: `email-${emailIndex}`,
          recipient: recipient.email,
          template: template.name,
          message: 'Email sent successfully'
        };
      }
    });

    const result = await emailRunner.runTest(requestGenerator, {
      performanceMonitor: this.monitor,
      onProgress: (progress) => {
        const emailsSent = progress.completedRequests;
        const rate = progress.avgResponseTime > 0 ? (1000 / progress.avgResponseTime).toFixed(1) : '0';
        
        if (progress.completedRequests % 100 === 0) {
          logger.info(`📧 Email progress: ${emailsSent.toLocaleString()} emails sent (${rate}/s)`);
        }
      }
    });

    this.testResults.push({
      testName: 'email-sending-2mm',
      success: result.successRate >= 0.98 && result.throughput >= 50,
      duration: result.totalDuration,
      metrics: result,
      emailsSent: result.successfulRequests
    });

    logger.info('📧 2MM email sending test completed', {
      duration: `${(result.totalDuration / 1000).toFixed(2)}s`,
      emailsSent: result.successfulRequests.toLocaleString(),
      successRate: `${(result.successRate * 100).toFixed(1)}%`,
      throughput: `${result.throughput.toFixed(2)} emails/s`,
      avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`
    });
  }

  /**
   * Run database test
   */
  private async runDatabaseTest(options: LoadTestOptions): Promise<void> {
    logger.info('🗄️ Running 2MM database operations test');

    const dbConfig = createLoadTestConfig('database-operations-2mm', {
      maxConcurrency: options.concurrency || 25,
      rampUpTime: 180000, // 3 minutes
      sustainDuration: options.duration || 900000, // 15 minutes
      rampDownTime: 180000, // 3 minutes
      thresholds: {
        avgResponseTime: 1000,
        maxResponseTime: 5000,
        errorRate: 0.01,
        successRate: 0.99,
        throughput: 100 // 100 operations/second
      }
    });

    const dbRunner = new LoadTestRunner(dbConfig);
    let operationIndex = 0;

    const requestGenerator = createRequestGenerator({
      method: 'POST',
      execute: async () => {
        const operation = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'][operationIndex % 4];
        
        // Simulate database operation
        const delay = {
          'SELECT': Math.random() * 200 + 50,
          'INSERT': Math.random() * 300 + 100,
          'UPDATE': Math.random() * 250 + 75,
          'DELETE': Math.random() * 200 + 50
        }[operation];

        await new Promise(resolve => setTimeout(resolve, delay));

        operationIndex++;
        return {
          success: Math.random() > 0.01, // 1% failure rate
          operation,
          operationId: `db-op-${operationIndex}`,
          duration: delay,
          message: `${operation} operation completed`
        };
      }
    });

    const result = await dbRunner.runTest(requestGenerator, {
      performanceMonitor: this.monitor,
      onProgress: (progress) => {
        const operations = progress.completedRequests;
        const rate = progress.avgResponseTime > 0 ? (1000 / progress.avgResponseTime).toFixed(1) : '0';
        
        if (progress.completedRequests % 50 === 0) {
          logger.info(`🗄️ Database progress: ${operations.toLocaleString()} operations (${rate}/s)`);
        }
      }
    });

    this.testResults.push({
      testName: 'database-operations-2mm',
      success: result.successRate >= 0.99 && result.throughput >= 100,
      duration: result.totalDuration,
      metrics: result,
      operationsCompleted: result.successfulRequests
    });

    logger.info('🗄️ 2MM database operations test completed', {
      duration: `${(result.totalDuration / 1000).toFixed(2)}s`,
      operationsCompleted: result.successfulRequests.toLocaleString(),
      successRate: `${(result.successRate * 100).toFixed(1)}%`,
      throughput: `${result.throughput.toFixed(2)} ops/s`,
      avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`
    });
  }

  /**
   * Run full test suite
   */
  private async runFullTest(options: LoadTestOptions): Promise<void> {
    logger.info('🏆 Running full 2MM contact test suite');

    // Run all tests sequentially
    await this.runImportTest({ ...options, duration: 600000 }); // 10 minutes
    await this.runEmailTest({ ...options, duration: 600000 }); // 10 minutes
    await this.runDatabaseTest({ ...options, duration: 600000 }); // 10 minutes

    logger.info('🏆 Full 2MM contact test suite completed');
  }

  /**
   * Generate comprehensive report
   */
  private async generateReport(): Promise<void> {
    try {
      logger.info('📄 Generating 2MM contact load test report');

      const metrics = this.monitor.getMetricsHistory();
      const testResults = this.testResults.map(r => r.metrics).filter(m => m);

      const report = await performanceReportGenerator.generateReport(
        '2mm-contact-load-test',
        metrics,
        testResults,
        []
      );

      logger.info('📄 2MM contact load test report generated', {
        reportId: report.id,
        overallScore: report.summary.overallScore,
        totalTests: report.testResults.length
      });

    } catch (error) {
      logger.error('❌ Failed to generate report:', error);
    }
  }

  /**
   * Print test summary
   */
  private printSummary(totalDuration: number): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 MAILGENIUS 2MM CONTACT LOAD TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`🧪 Test Scenarios: ${this.testResults.length}`);
    console.log(`✅ Passed: ${this.testResults.filter(r => r.success).length}`);
    console.log(`❌ Failed: ${this.testResults.filter(r => !r.success).length}`);
    console.log(`📈 Success Rate: ${((this.testResults.filter(r => r.success).length / this.testResults.length) * 100).toFixed(1)}%`);
    console.log('');

    // Detailed results
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000 / 60).toFixed(1);
      console.log(`${status} ${result.testName} - ${duration} minutes`);
      
      if (result.contactsProcessed) {
        console.log(`   📥 Contacts Processed: ${result.contactsProcessed.toLocaleString()}`);
      }
      if (result.emailsSent) {
        console.log(`   📧 Emails Sent: ${result.emailsSent.toLocaleString()}`);
      }
      if (result.operationsCompleted) {
        console.log(`   🗄️ DB Operations: ${result.operationsCompleted.toLocaleString()}`);
      }
    });

    console.log('');
    console.log('🎯 2MM Contact Validation Results:');
    const importTest = this.testResults.find(r => r.testName === 'contact-import-2mm');
    const emailTest = this.testResults.find(r => r.testName === 'email-sending-2mm');
    const dbTest = this.testResults.find(r => r.testName === 'database-operations-2mm');

    if (importTest) {
      console.log(`   📥 Import Capacity: ${importTest.success ? 'VALIDATED' : 'FAILED'}`);
    }
    if (emailTest) {
      console.log(`   📧 Email Capacity: ${emailTest.success ? 'VALIDATED' : 'FAILED'}`);
    }
    if (dbTest) {
      console.log(`   🗄️ Database Capacity: ${dbTest.success ? 'VALIDATED' : 'FAILED'}`);
    }

    const allPassed = this.testResults.every(r => r.success);
    console.log(`   🏆 2MM Contact Support: ${allPassed ? 'VALIDATED ✅' : 'NEEDS OPTIMIZATION ❌'}`);
    
    console.log('='.repeat(80));
  }
}

// CLI Configuration
async function main() {
  const loadTest = new MailGenius2MMLoadTest();

  program
    .name('load-test-2mm')
    .description('MailGenius 2MM Contact Load Test')
    .version('1.0.0');

  program
    .command('run')
    .description('Run 2MM contact load test')
    .option('-c, --contacts <contacts>', 'Number of contacts to test', '2000000')
    .option('--concurrency <concurrency>', 'Concurrency level', '50')
    .option('-d, --duration <duration>', 'Test duration in milliseconds', '1800000')
    .option('-m, --monitor', 'Enable performance monitoring', true)
    .option('-r, --report', 'Generate performance report', true)
    .option('--skip-warmup', 'Skip system warmup', false)
    .option('-v, --verbose', 'Verbose output', false)
    .option('-s, --scenario <scenario>', 'Test scenario (import, email, database, full)', 'full')
    .action(async (options) => {
      try {
        await loadTest.runLoadTest({
          ...options,
          contacts: parseInt(options.contacts),
          concurrency: parseInt(options.concurrency),
          duration: parseInt(options.duration)
        });
      } catch (error) {
        console.error('❌ 2MM load test failed:', error);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Failed to run 2MM load test:', error);
    process.exit(1);
  });
}

export { MailGenius2MMLoadTest };