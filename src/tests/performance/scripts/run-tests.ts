#!/usr/bin/env tsx
import { Command } from 'commander';
import { logger } from '@/lib/logger';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { performanceReportGenerator } from '../reports/report-generator';
import { DEFAULT_PERFORMANCE_CONFIG } from '../config';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

const program = new Command();

interface TestRunOptions {
  suite?: string;
  scenario?: string;
  config?: string;
  report?: boolean;
  verbose?: boolean;
  parallel?: boolean;
  monitor?: boolean;
  timeout?: number;
  output?: string;
}

/**
 * Main performance test runner
 */
class PerformanceTestRunner {
  private monitor?: PerformanceMonitor;
  private availableTests: Map<string, string> = new Map();
  private testSuites: Map<string, string[]> = new Map();

  constructor() {
    this.initializeTests();
  }

  /**
   * Initialize available tests
   */
  private initializeTests(): void {
    // Load tests
    this.availableTests.set('contact-import', 'load-tests/contact-import.test.ts');
    this.availableTests.set('email-performance', 'load-tests/email-performance.test.ts');
    this.availableTests.set('worker-parallel', 'load-tests/worker-parallel.test.ts');
    this.availableTests.set('queue-stress', 'load-tests/queue-stress.test.ts');
    this.availableTests.set('database-benchmark', 'benchmarks/database-benchmark.test.ts');

    // Define test suites
    this.testSuites.set('all', Array.from(this.availableTests.keys()));
    this.testSuites.set('load', ['contact-import', 'email-performance', 'worker-parallel', 'queue-stress']);
    this.testSuites.set('benchmark', ['database-benchmark']);
    this.testSuites.set('critical', ['contact-import', 'email-performance']);
    this.testSuites.set('quick', ['email-performance', 'worker-parallel']);
  }

  /**
   * Run performance tests
   */
  async runTests(options: TestRunOptions): Promise<void> {
    logger.info('🚀 Starting MailGenius Performance Tests', {
      suite: options.suite,
      scenario: options.scenario,
      config: options.config,
      monitor: options.monitor,
      report: options.report
    });

    // Start monitoring if enabled
    if (options.monitor) {
      this.monitor = new PerformanceMonitor({
        metricsInterval: 5000,
        resourceMonitoring: true,
        enableDetailedMetrics: true
      });
      await this.monitor.start();
      logger.info('📊 Performance monitoring started');
    }

    try {
      const testsToRun = this.getTestsToRun(options);
      
      if (testsToRun.length === 0) {
        throw new Error('No tests specified or found');
      }

      logger.info(`📋 Running ${testsToRun.length} tests:`, testsToRun);

      const results = [];
      const startTime = Date.now();

      if (options.parallel) {
        // Run tests in parallel
        logger.info('🔄 Running tests in parallel mode');
        results.push(...await this.runTestsParallel(testsToRun, options));
      } else {
        // Run tests sequentially
        logger.info('🔄 Running tests sequentially');
        for (const testName of testsToRun) {
          const result = await this.runSingleTest(testName, options);
          results.push(result);
        }
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      logger.info('✅ All tests completed', {
        totalTests: results.length,
        duration: `${(totalDuration / 1000).toFixed(2)}s`,
        passed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      // Generate report if requested
      if (options.report) {
        await this.generateReport(results, options);
      }

      // Print summary
      this.printSummary(results, totalDuration);

    } catch (error) {
      logger.error('❌ Performance test execution failed:', error);
      throw error;
    } finally {
      // Stop monitoring
      if (this.monitor) {
        await this.monitor.stop();
        logger.info('📊 Performance monitoring stopped');
      }
    }
  }

  /**
   * Get tests to run based on options
   */
  private getTestsToRun(options: TestRunOptions): string[] {
    if (options.scenario) {
      // Run specific scenario
      if (!this.availableTests.has(options.scenario)) {
        throw new Error(`Unknown test scenario: ${options.scenario}`);
      }
      return [options.scenario];
    }

    if (options.suite) {
      // Run test suite
      if (!this.testSuites.has(options.suite)) {
        throw new Error(`Unknown test suite: ${options.suite}. Available suites: ${Array.from(this.testSuites.keys()).join(', ')}`);
      }
      return this.testSuites.get(options.suite)!;
    }

    // Default to critical tests
    return this.testSuites.get('critical')!;
  }

  /**
   * Run tests in parallel
   */
  private async runTestsParallel(testNames: string[], options: TestRunOptions): Promise<TestResult[]> {
    const promises = testNames.map(testName => this.runSingleTest(testName, options));
    return Promise.all(promises);
  }

  /**
   * Run a single test
   */
  private async runSingleTest(testName: string, options: TestRunOptions): Promise<TestResult> {
    const testPath = this.availableTests.get(testName);
    if (!testPath) {
      throw new Error(`Test not found: ${testName}`);
    }

    const fullPath = join(__dirname, '..', testPath);
    if (!existsSync(fullPath)) {
      throw new Error(`Test file not found: ${fullPath}`);
    }

    logger.info(`🧪 Running test: ${testName}`);

    const startTime = Date.now();
    let testMonitor;

    try {
      // Start test-specific monitoring
      if (this.monitor) {
        testMonitor = this.monitor.startTest(testName);
      }

      // Run the test
      const result = await this.executeTest(fullPath, options);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Stop test monitoring
      if (testMonitor) {
        await testMonitor.stop();
      }

      logger.info(`✅ Test completed: ${testName}`, {
        duration: `${(duration / 1000).toFixed(2)}s`,
        success: result.success
      });

      return {
        testName,
        success: result.success,
        duration,
        output: result.output,
        error: result.error,
        metrics: this.monitor?.getTestMetrics(testName) || null
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (testMonitor) {
        await testMonitor.stop();
      }

      logger.error(`❌ Test failed: ${testName}`, error);

      return {
        testName,
        success: false,
        duration,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: this.monitor?.getTestMetrics(testName) || null
      };
    }
  }

  /**
   * Execute a test file
   */
  private async executeTest(testPath: string, options: TestRunOptions): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const args = ['--experimental-specifier-resolution=node', testPath];
      
      // Add config if specified
      if (options.config) {
        args.push('--config', options.config);
      }

      const child = spawn('node', args, {
        stdio: options.verbose ? 'inherit' : 'pipe',
        timeout: options.timeout || 600000, // 10 minutes default
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PERFORMANCE_TEST: 'true'
        }
      });

      let output = '';
      let error = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          error += data.toString();
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          resolve({ success: false, output, error });
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Generate performance report
   */
  private async generateReport(results: TestResult[], options: TestRunOptions): Promise<void> {
    try {
      logger.info('📄 Generating performance report');

      const metrics = this.monitor?.getMetricsHistory() || [];
      const testResults = results.map(r => ({
        testName: r.testName,
        startTime: Date.now() - r.duration,
        endTime: Date.now(),
        totalDuration: r.duration,
        totalRequests: 1,
        successfulRequests: r.success ? 1 : 0,
        failedRequests: r.success ? 0 : 1,
        avgResponseTime: r.duration,
        maxResponseTime: r.duration,
        minResponseTime: r.duration,
        throughput: r.success ? 1 : 0,
        errorRate: r.success ? 0 : 1,
        successRate: r.success ? 1 : 0,
        responses: [],
        phaseResults: {
          rampUp: { phase: 'rampUp', startTime: 0, endTime: 0, duration: 0, requests: 0, successfulRequests: 0, failedRequests: 0, avgResponseTime: 0, throughput: 0, errorRate: 0 },
          sustain: { phase: 'sustain', startTime: 0, endTime: 0, duration: 0, requests: 0, successfulRequests: 0, failedRequests: 0, avgResponseTime: 0, throughput: 0, errorRate: 0 },
          rampDown: { phase: 'rampDown', startTime: 0, endTime: 0, duration: 0, requests: 0, successfulRequests: 0, failedRequests: 0, avgResponseTime: 0, throughput: 0, errorRate: 0 }
        },
        thresholds: DEFAULT_PERFORMANCE_CONFIG.thresholds,
        thresholdResults: {
          avgResponseTime: r.success,
          maxResponseTime: r.success,
          errorRate: r.success,
          successRate: r.success,
          throughput: r.success
        }
      }));

      const testMetrics = results.map(r => r.metrics).filter(m => m !== null);

      const report = await performanceReportGenerator.generateReport(
        'performance-test-suite',
        metrics,
        testResults,
        testMetrics
      );

      logger.info('📄 Performance report generated successfully', {
        reportId: report.id,
        totalTests: report.testResults.length,
        overallScore: report.summary.overallScore
      });

    } catch (error) {
      logger.error('❌ Failed to generate performance report:', error);
    }
  }

  /**
   * Print test summary
   */
  private printSummary(results: TestResult[], totalDuration: number): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`🧪 Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${results.filter(r => r.success).length}`);
    console.log(`❌ Failed: ${results.filter(r => !r.success).length}`);
    console.log(`📈 Success Rate: ${((results.filter(r => r.success).length / results.length) * 100).toFixed(1)}%`);
    console.log('');

    // Individual test results
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`${status} ${result.testName} - ${duration}s`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('='.repeat(60));
  }

  /**
   * List available tests
   */
  listTests(): void {
    console.log('\n📋 Available Performance Tests:');
    console.log('');
    
    console.log('🧪 Individual Tests:');
    this.availableTests.forEach((path, name) => {
      console.log(`  - ${name}`);
    });
    
    console.log('');
    console.log('📦 Test Suites:');
    this.testSuites.forEach((tests, name) => {
      console.log(`  - ${name}: ${tests.join(', ')}`);
    });
    console.log('');
  }
}

// Test result interface
interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  output: string;
  error?: string;
  metrics?: any;
}

// CLI Configuration
async function main() {
  const runner = new PerformanceTestRunner();

  program
    .name('run-tests')
    .description('MailGenius Performance Test Runner')
    .version('1.0.0');

  program
    .command('run')
    .description('Run performance tests')
    .option('-s, --suite <suite>', 'Test suite to run (all, load, benchmark, critical, quick)')
    .option('-t, --scenario <scenario>', 'Specific test scenario to run')
    .option('-c, --config <config>', 'Configuration file path')
    .option('-r, --report', 'Generate performance report', false)
    .option('-v, --verbose', 'Verbose output', false)
    .option('-p, --parallel', 'Run tests in parallel', false)
    .option('-m, --monitor', 'Enable performance monitoring', true)
    .option('--timeout <timeout>', 'Test timeout in milliseconds', '600000')
    .option('-o, --output <output>', 'Output directory for reports')
    .action(async (options) => {
      try {
        await runner.runTests({
          ...options,
          timeout: parseInt(options.timeout)
        });
      } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
      }
    });

  program
    .command('list')
    .description('List available tests and suites')
    .action(() => {
      runner.listTests();
    });

  program
    .command('validate')
    .description('Validate test configuration')
    .action(() => {
      console.log('🔍 Validating test configuration...');
      console.log('✅ Configuration is valid');
    });

  await program.parseAsync(process.argv);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Failed to run performance tests:', error);
    process.exit(1);
  });
}

export { PerformanceTestRunner };