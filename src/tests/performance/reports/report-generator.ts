import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';
import { PerformanceMetrics, TestMetrics } from '../monitoring/performance-monitor';
import { LoadTestResult } from '../runners/load-test-runner';

export interface PerformanceReport {
  id: string;
  testName: string;
  generatedAt: string;
  executionTime: number;
  summary: ReportSummary;
  systemInfo: SystemInfo;
  testResults: TestResult[];
  metrics: PerformanceMetrics[];
  recommendations: string[];
  alerts: Alert[];
}

export interface ReportSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallScore: number;
  avgResponseTime: number;
  maxResponseTime: number;
  totalRequests: number;
  totalErrors: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  resourceUtilization: {
    avgCpuUsage: number;
    maxCpuUsage: number;
    avgMemoryUsage: number;
    maxMemoryUsage: number;
  };
}

export interface SystemInfo {
  cpuCores: number;
  totalMemory: number;
  freeMemory: number;
  platform: string;
  nodeVersion: string;
  testEnvironment: string;
  timestamp: string;
}

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'warning';
  duration: number;
  metrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
  };
  thresholds: {
    [key: string]: {
      value: number;
      threshold: number;
      passed: boolean;
    };
  };
  details: any;
}

export interface Alert {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export class PerformanceReportGenerator {
  private reportsDir: string;
  
  constructor(reportsDir: string = 'performance-reports') {
    this.reportsDir = join(process.cwd(), reportsDir);
    this.ensureReportsDirectory();
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(
    testName: string,
    metrics: PerformanceMetrics[],
    testResults: LoadTestResult[],
    testMetrics: TestMetrics[] = []
  ): Promise<PerformanceReport> {
    const reportId = `${testName}-${Date.now()}`;
    const generatedAt = new Date().toISOString();
    
    logger.info(`Generating performance report: ${reportId}`);
    
    // Calculate summary
    const summary = this.calculateSummary(metrics, testResults);
    
    // Get system info
    const systemInfo = this.getSystemInfo();
    
    // Convert test results
    const convertedTestResults = this.convertTestResults(testResults);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, convertedTestResults, metrics);
    
    // Generate alerts
    const alerts = this.generateAlerts(summary, convertedTestResults, metrics);
    
    const report: PerformanceReport = {
      id: reportId,
      testName,
      generatedAt,
      executionTime: this.calculateExecutionTime(testResults),
      summary,
      systemInfo,
      testResults: convertedTestResults,
      metrics,
      recommendations,
      alerts
    };
    
    // Save report files
    await this.saveReport(report);
    
    logger.info(`Performance report generated: ${reportId}`);
    return report;
  }

  /**
   * Generate HTML report
   */
  async generateHtmlReport(report: PerformanceReport): Promise<string> {
    const htmlContent = this.generateHtmlContent(report);
    const filename = `${report.id}.html`;
    const filepath = join(this.reportsDir, filename);
    
    writeFileSync(filepath, htmlContent);
    
    logger.info(`HTML report generated: ${filepath}`);
    return filepath;
  }

  /**
   * Generate JSON report
   */
  async generateJsonReport(report: PerformanceReport): Promise<string> {
    const filename = `${report.id}.json`;
    const filepath = join(this.reportsDir, filename);
    
    writeFileSync(filepath, JSON.stringify(report, null, 2));
    
    logger.info(`JSON report generated: ${filepath}`);
    return filepath;
  }

  /**
   * Generate CSV report
   */
  async generateCsvReport(report: PerformanceReport): Promise<string> {
    const csvContent = this.generateCsvContent(report);
    const filename = `${report.id}.csv`;
    const filepath = join(this.reportsDir, filename);
    
    writeFileSync(filepath, csvContent);
    
    logger.info(`CSV report generated: ${filepath}`);
    return filepath;
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(report: PerformanceReport): Promise<string> {
    const summaryContent = this.generateExecutiveSummaryContent(report);
    const filename = `${report.id}-executive-summary.md`;
    const filepath = join(this.reportsDir, filename);
    
    writeFileSync(filepath, summaryContent);
    
    logger.info(`Executive summary generated: ${filepath}`);
    return filepath;
  }

  /**
   * Generate comparison report
   */
  async generateComparisonReport(
    currentReport: PerformanceReport,
    previousReport: PerformanceReport
  ): Promise<string> {
    const comparisonContent = this.generateComparisonContent(currentReport, previousReport);
    const filename = `${currentReport.id}-comparison.html`;
    const filepath = join(this.reportsDir, filename);
    
    writeFileSync(filepath, comparisonContent);
    
    logger.info(`Comparison report generated: ${filepath}`);
    return filepath;
  }

  /**
   * Calculate summary metrics
   */
  private calculateSummary(metrics: PerformanceMetrics[], testResults: LoadTestResult[]): ReportSummary {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.successRate >= r.thresholds.successRate).length;
    const failedTests = totalTests - passedTests;
    const overallScore = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    const allResponseTimes = testResults.flatMap(r => r.responses.map(res => res.responseTime));
    const avgResponseTime = allResponseTimes.length > 0 
      ? allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length 
      : 0;
    const maxResponseTime = allResponseTimes.length > 0 ? Math.max(...allResponseTimes) : 0;
    
    const totalRequests = testResults.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalErrors = testResults.reduce((sum, r) => sum + r.failedRequests, 0);
    const throughput = testResults.reduce((sum, r) => sum + r.throughput, 0) / testResults.length;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    const successRate = totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 0;
    
    const cpuUsages = metrics.map(m => m.cpuUsage);
    const memoryUsages = metrics.map(m => m.memoryUsage.percentage);
    
    return {
      totalTests,
      passedTests,
      failedTests,
      overallScore,
      avgResponseTime,
      maxResponseTime,
      totalRequests,
      totalErrors,
      throughput,
      errorRate,
      successRate,
      resourceUtilization: {
        avgCpuUsage: cpuUsages.length > 0 ? cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length : 0,
        maxCpuUsage: cpuUsages.length > 0 ? Math.max(...cpuUsages) : 0,
        avgMemoryUsage: memoryUsages.length > 0 ? memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length : 0,
        maxMemoryUsage: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0
      }
    };
  }

  /**
   * Get system information
   */
  private getSystemInfo(): SystemInfo {
    const os = require('os');
    
    return {
      cpuCores: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      platform: os.platform(),
      nodeVersion: process.version,
      testEnvironment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Convert test results
   */
  private convertTestResults(testResults: LoadTestResult[]): TestResult[] {
    return testResults.map(result => ({
      testName: result.testName,
      status: this.determineTestStatus(result),
      duration: result.totalDuration,
      metrics: {
        responseTime: result.avgResponseTime,
        throughput: result.throughput,
        errorRate: result.errorRate,
        successRate: result.successRate
      },
      thresholds: {
        avgResponseTime: {
          value: result.avgResponseTime,
          threshold: result.thresholds.avgResponseTime,
          passed: result.thresholdResults.avgResponseTime
        },
        maxResponseTime: {
          value: result.maxResponseTime,
          threshold: result.thresholds.maxResponseTime,
          passed: result.thresholdResults.maxResponseTime
        },
        errorRate: {
          value: result.errorRate,
          threshold: result.thresholds.errorRate,
          passed: result.thresholdResults.errorRate
        },
        successRate: {
          value: result.successRate,
          threshold: result.thresholds.successRate,
          passed: result.thresholdResults.successRate
        },
        throughput: {
          value: result.throughput,
          threshold: result.thresholds.throughput,
          passed: result.thresholdResults.throughput
        }
      },
      details: result
    }));
  }

  /**
   * Determine test status
   */
  private determineTestStatus(result: LoadTestResult): 'passed' | 'failed' | 'warning' {
    const thresholdResults = Object.values(result.thresholdResults);
    const passedThresholds = thresholdResults.filter(passed => passed).length;
    const totalThresholds = thresholdResults.length;
    
    if (passedThresholds === totalThresholds) {
      return 'passed';
    } else if (passedThresholds / totalThresholds >= 0.8) {
      return 'warning';
    } else {
      return 'failed';
    }
  }

  /**
   * Calculate execution time
   */
  private calculateExecutionTime(testResults: LoadTestResult[]): number {
    if (testResults.length === 0) return 0;
    
    const startTime = Math.min(...testResults.map(r => r.startTime));
    const endTime = Math.max(...testResults.map(r => r.endTime));
    
    return endTime - startTime;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    summary: ReportSummary,
    testResults: TestResult[],
    metrics: PerformanceMetrics[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Performance recommendations
    if (summary.avgResponseTime > 2000) {
      recommendations.push('Consider optimizing response times. Average response time is above 2 seconds.');
    }
    
    if (summary.errorRate > 0.05) {
      recommendations.push('Error rate is high. Investigate and fix failing requests.');
    }
    
    if (summary.resourceUtilization.avgCpuUsage > 70) {
      recommendations.push('High CPU usage detected. Consider optimizing algorithms or scaling horizontally.');
    }
    
    if (summary.resourceUtilization.avgMemoryUsage > 80) {
      recommendations.push('High memory usage detected. Check for memory leaks or consider increasing memory allocation.');
    }
    
    // Test-specific recommendations
    const failedTests = testResults.filter(t => t.status === 'failed');
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed. Review test thresholds and system performance.`);
    }
    
    // Throughput recommendations
    if (summary.throughput < 10) {
      recommendations.push('Low throughput detected. Consider optimizing bottlenecks or increasing concurrency.');
    }
    
    // Database recommendations
    const dbMetrics = metrics.filter(m => m.customMetrics?.database);
    if (dbMetrics.length > 0) {
      recommendations.push('Monitor database performance and consider query optimization.');
    }
    
    return recommendations;
  }

  /**
   * Generate alerts
   */
  private generateAlerts(
    summary: ReportSummary,
    testResults: TestResult[],
    metrics: PerformanceMetrics[]
  ): Alert[] {
    const alerts: Alert[] = [];
    const timestamp = new Date().toISOString();
    
    // Critical alerts
    if (summary.errorRate > 0.1) {
      alerts.push({
        level: 'critical',
        message: 'Critical error rate detected',
        metric: 'errorRate',
        value: summary.errorRate,
        threshold: 0.1,
        timestamp
      });
    }
    
    if (summary.resourceUtilization.maxCpuUsage > 90) {
      alerts.push({
        level: 'critical',
        message: 'Critical CPU usage detected',
        metric: 'cpuUsage',
        value: summary.resourceUtilization.maxCpuUsage,
        threshold: 90,
        timestamp
      });
    }
    
    // Warning alerts
    if (summary.avgResponseTime > 5000) {
      alerts.push({
        level: 'warning',
        message: 'High response time detected',
        metric: 'responseTime',
        value: summary.avgResponseTime,
        threshold: 5000,
        timestamp
      });
    }
    
    if (summary.resourceUtilization.avgMemoryUsage > 80) {
      alerts.push({
        level: 'warning',
        message: 'High memory usage detected',
        metric: 'memoryUsage',
        value: summary.resourceUtilization.avgMemoryUsage,
        threshold: 80,
        timestamp
      });
    }
    
    // Info alerts
    if (summary.overallScore < 90) {
      alerts.push({
        level: 'info',
        message: 'Overall test score below 90%',
        metric: 'overallScore',
        value: summary.overallScore,
        threshold: 90,
        timestamp
      });
    }
    
    return alerts;
  }

  /**
   * Generate HTML content
   */
  private generateHtmlContent(report: PerformanceReport): string {
    const alertsHtml = report.alerts.map(alert => `
      <div class="alert alert-${alert.level}">
        <strong>${alert.level.toUpperCase()}:</strong> ${alert.message} 
        (${alert.metric}: ${alert.value} > ${alert.threshold})
      </div>
    `).join('');
    
    const testsHtml = report.testResults.map(test => `
      <tr class="test-${test.status}">
        <td>${test.testName}</td>
        <td><span class="status status-${test.status}">${test.status}</span></td>
        <td>${test.duration.toFixed(2)}ms</td>
        <td>${test.metrics.responseTime.toFixed(2)}ms</td>
        <td>${test.metrics.throughput.toFixed(2)}</td>
        <td>${(test.metrics.errorRate * 100).toFixed(2)}%</td>
        <td>${(test.metrics.successRate * 100).toFixed(2)}%</td>
      </tr>
    `).join('');
    
    const recommendationsHtml = report.recommendations.map(rec => `
      <li>${rec}</li>
    `).join('');
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - ${report.testName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .alert-critical { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .alert-warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .alert-info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f8f9fa; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-warning { background: #fff3cd; color: #856404; }
        .test-passed { background: #f8fff8; }
        .test-failed { background: #fff8f8; }
        .test-warning { background: #fffef8; }
        .chart { width: 100%; height: 300px; margin: 20px 0; }
        .section { margin: 30px 0; }
        h1, h2 { color: #333; }
        h1 { border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Report: ${report.testName}</h1>
        <p><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
        <p><strong>Execution Time:</strong> ${(report.executionTime / 1000).toFixed(2)} seconds</p>
        <p><strong>Overall Score:</strong> ${report.summary.overallScore.toFixed(1)}%</p>
    </div>

    <div class="section">
        <h2>Performance Summary</h2>
        <div class="summary">
            <div class="metric-card">
                <div class="metric-value">${report.summary.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.passedTests}</div>
                <div class="metric-label">Passed Tests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.avgResponseTime.toFixed(0)}ms</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.throughput.toFixed(1)}</div>
                <div class="metric-label">Throughput (req/s)</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${(report.summary.errorRate * 100).toFixed(1)}%</div>
                <div class="metric-label">Error Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.resourceUtilization.avgCpuUsage.toFixed(1)}%</div>
                <div class="metric-label">Avg CPU Usage</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Alerts</h2>
        ${alertsHtml || '<p>No alerts generated.</p>'}
    </div>

    <div class="section">
        <h2>Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Avg Response Time</th>
                    <th>Throughput</th>
                    <th>Error Rate</th>
                    <th>Success Rate</th>
                </tr>
            </thead>
            <tbody>
                ${testsHtml}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${recommendationsHtml}
        </ul>
    </div>

    <div class="section">
        <h2>System Information</h2>
        <table>
            <tr><th>CPU Cores</th><td>${report.systemInfo.cpuCores}</td></tr>
            <tr><th>Total Memory</th><td>${(report.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB</td></tr>
            <tr><th>Free Memory</th><td>${(report.systemInfo.freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB</td></tr>
            <tr><th>Platform</th><td>${report.systemInfo.platform}</td></tr>
            <tr><th>Node Version</th><td>${report.systemInfo.nodeVersion}</td></tr>
            <tr><th>Test Environment</th><td>${report.systemInfo.testEnvironment}</td></tr>
        </table>
    </div>

    <script>
        // Add interactivity
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Performance Report Data:', ${JSON.stringify(report, null, 2)});
        });
    </script>
</body>
</html>
    `;
  }

  /**
   * Generate CSV content
   */
  private generateCsvContent(report: PerformanceReport): string {
    const headers = [
      'Test Name',
      'Status',
      'Duration (ms)',
      'Avg Response Time (ms)',
      'Max Response Time (ms)',
      'Throughput (req/s)',
      'Error Rate (%)',
      'Success Rate (%)',
      'Total Requests',
      'Failed Requests'
    ];
    
    const rows = report.testResults.map(test => [
      test.testName,
      test.status,
      test.duration.toFixed(2),
      test.metrics.responseTime.toFixed(2),
      test.details.maxResponseTime.toFixed(2),
      test.metrics.throughput.toFixed(2),
      (test.metrics.errorRate * 100).toFixed(2),
      (test.metrics.successRate * 100).toFixed(2),
      test.details.totalRequests,
      test.details.failedRequests
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Generate executive summary content
   */
  private generateExecutiveSummaryContent(report: PerformanceReport): string {
    const passRate = (report.summary.passedTests / report.summary.totalTests * 100).toFixed(1);
    const performanceGrade = this.getPerformanceGrade(report.summary.overallScore);
    
    return `
# Performance Test Executive Summary

## Test: ${report.testName}
**Generated:** ${new Date(report.generatedAt).toLocaleString()}  
**Execution Time:** ${(report.executionTime / 1000).toFixed(2)} seconds  
**Overall Score:** ${report.summary.overallScore.toFixed(1)}% (${performanceGrade})

## Key Metrics
- **Test Pass Rate:** ${passRate}% (${report.summary.passedTests}/${report.summary.totalTests})
- **Average Response Time:** ${report.summary.avgResponseTime.toFixed(0)}ms
- **Throughput:** ${report.summary.throughput.toFixed(1)} requests/second
- **Error Rate:** ${(report.summary.errorRate * 100).toFixed(1)}%
- **System Resource Usage:** CPU ${report.summary.resourceUtilization.avgCpuUsage.toFixed(1)}%, Memory ${report.summary.resourceUtilization.avgMemoryUsage.toFixed(1)}%

## Critical Issues
${report.alerts.filter(a => a.level === 'critical').length > 0 
  ? report.alerts.filter(a => a.level === 'critical').map(a => `- ${a.message}`).join('\n')
  : '- No critical issues detected'
}

## Recommendations
${report.recommendations.slice(0, 5).map(rec => `- ${rec}`).join('\n')}

## System Information
- **CPU Cores:** ${report.systemInfo.cpuCores}
- **Total Memory:** ${(report.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB
- **Platform:** ${report.systemInfo.platform}
- **Node Version:** ${report.systemInfo.nodeVersion}
- **Test Environment:** ${report.systemInfo.testEnvironment}

---
*This executive summary provides a high-level overview of the performance test results. For detailed analysis, please refer to the complete HTML report.*
    `;
  }

  /**
   * Generate comparison content
   */
  private generateComparisonContent(
    currentReport: PerformanceReport,
    previousReport: PerformanceReport
  ): string {
    const scoreDiff = currentReport.summary.overallScore - previousReport.summary.overallScore;
    const responseDiff = currentReport.summary.avgResponseTime - previousReport.summary.avgResponseTime;
    const throughputDiff = currentReport.summary.throughput - previousReport.summary.throughput;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .comparison { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 20px 0; }
        .comparison-item { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .improvement { color: #28a745; }
        .degradation { color: #dc3545; }
        .neutral { color: #6c757d; }
        .metric-value { font-size: 1.5em; font-weight: bold; }
        .metric-change { font-size: 1.2em; }
    </style>
</head>
<body>
    <h1>Performance Comparison Report</h1>
    
    <div class="comparison">
        <div class="comparison-item">
            <h3>Overall Score</h3>
            <div class="metric-value">${currentReport.summary.overallScore.toFixed(1)}%</div>
            <div class="metric-change ${scoreDiff >= 0 ? 'improvement' : 'degradation'}">
                ${scoreDiff >= 0 ? '+' : ''}${scoreDiff.toFixed(1)}%
            </div>
        </div>
        
        <div class="comparison-item">
            <h3>Response Time</h3>
            <div class="metric-value">${currentReport.summary.avgResponseTime.toFixed(0)}ms</div>
            <div class="metric-change ${responseDiff <= 0 ? 'improvement' : 'degradation'}">
                ${responseDiff >= 0 ? '+' : ''}${responseDiff.toFixed(0)}ms
            </div>
        </div>
        
        <div class="comparison-item">
            <h3>Throughput</h3>
            <div class="metric-value">${currentReport.summary.throughput.toFixed(1)}</div>
            <div class="metric-change ${throughputDiff >= 0 ? 'improvement' : 'degradation'}">
                ${throughputDiff >= 0 ? '+' : ''}${throughputDiff.toFixed(1)} req/s
            </div>
        </div>
    </div>
    
    <h2>Analysis</h2>
    <ul>
        <li>Overall performance ${scoreDiff >= 0 ? 'improved' : 'degraded'} by ${Math.abs(scoreDiff).toFixed(1)}%</li>
        <li>Response time ${responseDiff <= 0 ? 'improved' : 'degraded'} by ${Math.abs(responseDiff).toFixed(0)}ms</li>
        <li>Throughput ${throughputDiff >= 0 ? 'increased' : 'decreased'} by ${Math.abs(throughputDiff).toFixed(1)} requests/second</li>
    </ul>
</body>
</html>
    `;
  }

  /**
   * Get performance grade
   */
  private getPerformanceGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Ensure reports directory exists
   */
  private ensureReportsDirectory(): void {
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Save report files
   */
  private async saveReport(report: PerformanceReport): Promise<void> {
    // Save JSON report
    await this.generateJsonReport(report);
    
    // Save HTML report
    await this.generateHtmlReport(report);
    
    // Save CSV report
    await this.generateCsvReport(report);
    
    // Save executive summary
    await this.generateExecutiveSummary(report);
  }
}

// Export singleton instance
export const performanceReportGenerator = new PerformanceReportGenerator();