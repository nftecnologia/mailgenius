import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { cpus, totalmem, freemem, loadavg } from 'os';
import { logger } from '@/lib/logger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface PerformanceMetrics {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  loadAverage: number[];
  activeHandles: number;
  activeRequests: number;
  eventLoopDelay: number;
  networkConnections?: number;
  responseTime?: number;
  throughput?: number;
  errorRate?: number;
  customMetrics?: Record<string, any>;
}

export interface TestMetrics {
  testId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metrics: PerformanceMetrics[];
  summary: {
    avgCpuUsage: number;
    maxCpuUsage: number;
    avgMemoryUsage: number;
    maxMemoryUsage: number;
    avgResponseTime: number;
    maxResponseTime: number;
    totalRequests: number;
    errorCount: number;
    throughput: number;
  };
}

export interface MonitoringConfig {
  metricsInterval: number;
  resourceMonitoring: boolean;
  enableDetailedMetrics: boolean;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    errorRate: number;
  };
}

export class PerformanceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private isMonitoring: boolean = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private metrics: PerformanceMetrics[] = [];
  private activeTests: Map<string, TestMetrics> = new Map();
  private startTime: number = 0;
  private eventLoopMonitor: any = null;
  private resourceCounters: Map<string, number> = new Map();

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.config = {
      metricsInterval: 5000,
      resourceMonitoring: true,
      enableDetailedMetrics: false,
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 80,
        responseTime: 5000,
        errorRate: 0.05
      },
      ...config
    };
  }

  /**
   * Start performance monitoring
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already started');
      return;
    }

    logger.info('Starting performance monitoring', {
      metricsInterval: this.config.metricsInterval,
      resourceMonitoring: this.config.resourceMonitoring,
      enableDetailedMetrics: this.config.enableDetailedMetrics
    });

    this.isMonitoring = true;
    this.startTime = performance.now();
    this.metrics = [];

    // Start event loop monitoring
    if (this.config.enableDetailedMetrics) {
      this.startEventLoopMonitoring();
    }

    // Start metrics collection
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        
        // Check for alerts
        this.checkAlerts(metrics);
        
        // Emit metrics event
        this.emit('metrics', metrics);
        
      } catch (error) {
        logger.error('Error collecting performance metrics:', error);
      }
    }, this.config.metricsInterval);

    logger.info('Performance monitoring started successfully');
  }

  /**
   * Stop performance monitoring
   */
  async stop(): Promise<PerformanceMetrics[]> {
    if (!this.isMonitoring) {
      logger.warn('Performance monitoring not started');
      return [];
    }

    logger.info('Stopping performance monitoring');

    this.isMonitoring = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.disable();
      this.eventLoopMonitor = null;
    }

    // Finalize any active tests
    for (const [testId, testMetrics] of this.activeTests) {
      if (!testMetrics.endTime) {
        await this.stopTest(testId);
      }
    }

    logger.info('Performance monitoring stopped');
    return this.metrics;
  }

  /**
   * Start monitoring a specific test
   */
  startTest(testId: string): {
    stop: () => Promise<TestMetrics>;
    addMetric: (key: string, value: any) => void;
    incrementCounter: (key: string) => void;
  } {
    const testMetrics: TestMetrics = {
      testId,
      startTime: performance.now(),
      metrics: [],
      summary: {
        avgCpuUsage: 0,
        maxCpuUsage: 0,
        avgMemoryUsage: 0,
        maxMemoryUsage: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        totalRequests: 0,
        errorCount: 0,
        throughput: 0
      }
    };

    this.activeTests.set(testId, testMetrics);

    logger.info(`Started monitoring test: ${testId}`);

    return {
      stop: () => this.stopTest(testId),
      addMetric: (key: string, value: any) => this.addTestMetric(testId, key, value),
      incrementCounter: (key: string) => this.incrementTestCounter(testId, key)
    };
  }

  /**
   * Stop monitoring a specific test
   */
  async stopTest(testId: string): Promise<TestMetrics> {
    const testMetrics = this.activeTests.get(testId);
    if (!testMetrics) {
      throw new Error(`Test ${testId} not found`);
    }

    testMetrics.endTime = performance.now();
    testMetrics.duration = testMetrics.endTime - testMetrics.startTime;

    // Calculate test summary
    const testSpecificMetrics = this.metrics.filter(m => 
      m.timestamp >= testMetrics.startTime && 
      (!testMetrics.endTime || m.timestamp <= testMetrics.endTime)
    );

    testMetrics.metrics = testSpecificMetrics;
    testMetrics.summary = this.calculateTestSummary(testSpecificMetrics);

    this.activeTests.delete(testId);

    logger.info(`Stopped monitoring test: ${testId}`, {
      duration: testMetrics.duration,
      metricsCount: testMetrics.metrics.length,
      summary: testMetrics.summary
    });

    return testMetrics;
  }

  /**
   * Add custom metric to test
   */
  addTestMetric(testId: string, key: string, value: any): void {
    const testMetrics = this.activeTests.get(testId);
    if (!testMetrics) {
      logger.warn(`Test ${testId} not found for adding metric`);
      return;
    }

    if (!testMetrics.summary.customMetrics) {
      testMetrics.summary.customMetrics = {};
    }

    testMetrics.summary.customMetrics[key] = value;
  }

  /**
   * Increment test counter
   */
  incrementTestCounter(testId: string, key: string): void {
    const testMetrics = this.activeTests.get(testId);
    if (!testMetrics) {
      logger.warn(`Test ${testId} not found for incrementing counter`);
      return;
    }

    if (!testMetrics.summary.customMetrics) {
      testMetrics.summary.customMetrics = {};
    }

    testMetrics.summary.customMetrics[key] = (testMetrics.summary.customMetrics[key] || 0) + 1;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get test metrics
   */
  getTestMetrics(testId: string): TestMetrics | null {
    return this.activeTests.get(testId) || null;
  }

  /**
   * Generate performance report
   */
  async generateReport(metrics: PerformanceMetrics[], filename: string): Promise<void> {
    try {
      const reportDir = join(process.cwd(), 'performance-reports');
      mkdirSync(reportDir, { recursive: true });

      const report = {
        generatedAt: new Date().toISOString(),
        testDuration: metrics.length > 0 ? metrics[metrics.length - 1].timestamp - metrics[0].timestamp : 0,
        totalMetrics: metrics.length,
        summary: this.calculateTestSummary(metrics),
        metrics: metrics,
        system: {
          cpuCount: cpus().length,
          totalMemory: totalmem(),
          platform: process.platform,
          nodeVersion: process.version
        }
      };

      const reportPath = join(reportDir, `${filename}-${Date.now()}.json`);
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      logger.info(`Performance report generated: ${reportPath}`);

      // Generate HTML report
      await this.generateHtmlReport(report, reportPath.replace('.json', '.html'));

    } catch (error) {
      logger.error('Error generating performance report:', error);
    }
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = performance.now();
    const memoryUsage = process.memoryUsage();
    const totalMemory = totalmem();
    const freeMemory = freemem();
    const usedMemory = totalMemory - freeMemory;

    const metrics: PerformanceMetrics = {
      timestamp,
      cpuUsage: await this.getCpuUsage(),
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      loadAverage: loadavg(),
      activeHandles: (process as any)._getActiveHandles().length,
      activeRequests: (process as any)._getActiveRequests().length,
      eventLoopDelay: this.getEventLoopDelay(),
      customMetrics: {}
    };

    // Add network metrics if available
    if (this.config.enableDetailedMetrics) {
      metrics.networkConnections = this.getNetworkConnections();
    }

    return metrics;
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    const startUsage = process.cpuUsage();
    const startTime = performance.now();

    // Wait a small amount to calculate usage
    await new Promise(resolve => setTimeout(resolve, 100));

    const endUsage = process.cpuUsage(startUsage);
    const endTime = performance.now();

    const timeDiff = (endTime - startTime) * 1000; // Convert to microseconds
    const cpuUsage = ((endUsage.user + endUsage.system) / timeDiff) * 100;

    return Math.min(cpuUsage, 100); // Cap at 100%
  }

  /**
   * Get event loop delay
   */
  private getEventLoopDelay(): number {
    if (this.eventLoopMonitor) {
      return this.eventLoopMonitor.mean;
    }
    return 0;
  }

  /**
   * Get network connections count
   */
  private getNetworkConnections(): number {
    // This is a simplified implementation
    // In a real scenario, you'd need to use system tools or libraries
    return 0;
  }

  /**
   * Start event loop monitoring
   */
  private startEventLoopMonitoring(): void {
    try {
      // Use perf_hooks for event loop monitoring
      const { monitorEventLoopDelay } = require('perf_hooks');
      this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
      this.eventLoopMonitor.enable();
    } catch (error) {
      logger.warn('Event loop monitoring not available:', error);
    }
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const alerts = [];

    if (metrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
      alerts.push({
        type: 'cpu_usage',
        message: `CPU usage is ${metrics.cpuUsage.toFixed(2)}% (threshold: ${this.config.alertThresholds.cpuUsage}%)`,
        severity: 'warning'
      });
    }

    if (metrics.memoryUsage.percentage > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'memory_usage',
        message: `Memory usage is ${metrics.memoryUsage.percentage.toFixed(2)}% (threshold: ${this.config.alertThresholds.memoryUsage}%)`,
        severity: 'warning'
      });
    }

    if (metrics.responseTime && metrics.responseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        message: `Response time is ${metrics.responseTime}ms (threshold: ${this.config.alertThresholds.responseTime}ms)`,
        severity: 'warning'
      });
    }

    if (alerts.length > 0) {
      this.emit('alerts', alerts);
      logger.warn('Performance alerts triggered:', alerts);
    }
  }

  /**
   * Calculate test summary from metrics
   */
  private calculateTestSummary(metrics: PerformanceMetrics[]): TestMetrics['summary'] {
    if (metrics.length === 0) {
      return {
        avgCpuUsage: 0,
        maxCpuUsage: 0,
        avgMemoryUsage: 0,
        maxMemoryUsage: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        totalRequests: 0,
        errorCount: 0,
        throughput: 0
      };
    }

    const cpuUsages = metrics.map(m => m.cpuUsage);
    const memoryUsages = metrics.map(m => m.memoryUsage.percentage);
    const responseTimes = metrics.map(m => m.responseTime || 0).filter(t => t > 0);

    return {
      avgCpuUsage: cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length,
      maxCpuUsage: Math.max(...cpuUsages),
      avgMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      maxMemoryUsage: Math.max(...memoryUsages),
      avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      totalRequests: metrics.reduce((sum, m) => sum + (m.customMetrics?.requests || 0), 0),
      errorCount: metrics.reduce((sum, m) => sum + (m.customMetrics?.errors || 0), 0),
      throughput: metrics.reduce((sum, m) => sum + (m.throughput || 0), 0) / metrics.length
    };
  }

  /**
   * Generate HTML report
   */
  private async generateHtmlReport(report: any, filename: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 3px; }
        .chart { width: 100%; height: 300px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .alert { background: #fee; color: #c00; padding: 10px; margin: 10px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Report</h1>
        <p>Generated: ${report.generatedAt}</p>
        <p>Test Duration: ${(report.testDuration / 1000).toFixed(2)} seconds</p>
        <p>Total Metrics: ${report.totalMetrics}</p>
    </div>

    <div class="metric">
        <h2>System Information</h2>
        <p>CPU Cores: ${report.system.cpuCount}</p>
        <p>Total Memory: ${(report.system.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB</p>
        <p>Platform: ${report.system.platform}</p>
        <p>Node Version: ${report.system.nodeVersion}</p>
    </div>

    <div class="metric">
        <h2>Performance Summary</h2>
        <table>
            <tr><th>Metric</th><th>Average</th><th>Maximum</th></tr>
            <tr><td>CPU Usage</td><td>${report.summary.avgCpuUsage.toFixed(2)}%</td><td>${report.summary.maxCpuUsage.toFixed(2)}%</td></tr>
            <tr><td>Memory Usage</td><td>${report.summary.avgMemoryUsage.toFixed(2)}%</td><td>${report.summary.maxMemoryUsage.toFixed(2)}%</td></tr>
            <tr><td>Response Time</td><td>${report.summary.avgResponseTime.toFixed(2)}ms</td><td>${report.summary.maxResponseTime.toFixed(2)}ms</td></tr>
            <tr><td>Total Requests</td><td colspan="2">${report.summary.totalRequests}</td></tr>
            <tr><td>Error Count</td><td colspan="2">${report.summary.errorCount}</td></tr>
            <tr><td>Throughput</td><td colspan="2">${report.summary.throughput.toFixed(2)} req/s</td></tr>
        </table>
    </div>

    <div class="metric">
        <h2>Detailed Metrics</h2>
        <p>Total data points: ${report.metrics.length}</p>
        <p>First metric: ${new Date(report.metrics[0]?.timestamp || 0).toISOString()}</p>
        <p>Last metric: ${new Date(report.metrics[report.metrics.length - 1]?.timestamp || 0).toISOString()}</p>
    </div>

    <script>
        console.log('Performance Report Data:', ${JSON.stringify(report)});
    </script>
</body>
</html>
    `;

    writeFileSync(filename, html);
    logger.info(`HTML performance report generated: ${filename}`);
  }
}

// Resource usage monitor utility
export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private isRunning: boolean = false;

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.collect();
  }

  stop(): void {
    this.isRunning = false;
  }

  private async collect(): Promise<void> {
    while (this.isRunning) {
      const timestamp = Date.now();
      const memoryUsage = process.memoryUsage();
      
      this.recordMetric('memory_heap_used', memoryUsage.heapUsed);
      this.recordMetric('memory_heap_total', memoryUsage.heapTotal);
      this.recordMetric('memory_external', memoryUsage.external);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }

  getMetrics(): Map<string, number[]> {
    return new Map(this.metrics);
  }

  getMetric(name: string): number[] {
    return this.metrics.get(name) || [];
  }
}

// Export singleton instance
export const resourceMonitor = ResourceMonitor.getInstance();