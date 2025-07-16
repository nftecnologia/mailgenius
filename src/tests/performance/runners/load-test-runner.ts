import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '@/lib/logger';
import { PerformanceMonitor } from '../monitoring/performance-monitor';

export interface LoadTestConfig {
  name: string;
  maxConcurrency: number;
  rampUpTime: number;
  sustainDuration: number;
  rampDownTime: number;
  thresholds: {
    avgResponseTime: number;
    maxResponseTime: number;
    errorRate: number;
    successRate: number;
    throughput: number;
  };
}

export interface LoadTestRequest {
  id: string;
  method: string;
  url?: string;
  payload?: any;
  headers?: Record<string, string>;
  timeout?: number;
  execute?: () => Promise<any>;
}

export interface LoadTestResponse {
  id: string;
  success: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  data?: any;
}

export interface LoadTestResult {
  testName: string;
  startTime: number;
  endTime: number;
  totalDuration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  responses: LoadTestResponse[];
  phaseResults: {
    rampUp: PhaseResult;
    sustain: PhaseResult;
    rampDown: PhaseResult;
  };
  thresholdResults: {
    avgResponseTime: boolean;
    maxResponseTime: boolean;
    errorRate: boolean;
    successRate: boolean;
    throughput: boolean;
  };
}

export interface PhaseResult {
  phase: 'rampUp' | 'sustain' | 'rampDown';
  startTime: number;
  endTime: number;
  duration: number;
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  throughput: number;
  errorRate: number;
}

export class LoadTestRunner extends EventEmitter {
  private config: LoadTestConfig;
  private isRunning: boolean = false;
  private performanceMonitor?: PerformanceMonitor;
  private activeRequests: Map<string, Promise<LoadTestResponse>> = new Map();
  private responses: LoadTestResponse[] = [];

  constructor(config: LoadTestConfig) {
    super();
    this.config = config;
  }

  /**
   * Run load test
   */
  async runTest(
    requestGenerator: () => LoadTestRequest,
    options: {
      performanceMonitor?: PerformanceMonitor;
      onProgress?: (progress: LoadTestProgress) => void;
    } = {}
  ): Promise<LoadTestResult> {
    if (this.isRunning) {
      throw new Error('Load test is already running');
    }

    this.isRunning = true;
    this.responses = [];
    this.activeRequests.clear();
    this.performanceMonitor = options.performanceMonitor;

    logger.info(`Starting load test: ${this.config.name}`, {
      maxConcurrency: this.config.maxConcurrency,
      rampUpTime: this.config.rampUpTime,
      sustainDuration: this.config.sustainDuration,
      rampDownTime: this.config.rampDownTime
    });

    const startTime = performance.now();
    let testMonitor;

    try {
      // Start performance monitoring
      if (this.performanceMonitor) {
        testMonitor = this.performanceMonitor.startTest(`load-test-${this.config.name}`);
      }

      // Run test phases
      const rampUpResult = await this.runRampUpPhase(requestGenerator, options.onProgress);
      const sustainResult = await this.runSustainPhase(requestGenerator, options.onProgress);
      const rampDownResult = await this.runRampDownPhase(requestGenerator, options.onProgress);

      // Wait for all active requests to complete
      await this.waitForActiveRequests();

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Calculate overall results
      const result = this.calculateResults(startTime, endTime, totalDuration, {
        rampUp: rampUpResult,
        sustain: sustainResult,
        rampDown: rampDownResult
      });

      // Stop performance monitoring
      if (testMonitor) {
        await testMonitor.stop();
      }

      logger.info(`Load test completed: ${this.config.name}`, {
        totalRequests: result.totalRequests,
        successfulRequests: result.successfulRequests,
        failedRequests: result.failedRequests,
        avgResponseTime: result.avgResponseTime,
        throughput: result.throughput,
        errorRate: result.errorRate
      });

      // Emit completion event
      this.emit('complete', result);

      return result;

    } catch (error) {
      logger.error(`Load test failed: ${this.config.name}`, error);
      this.emit('error', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop load test
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info(`Stopping load test: ${this.config.name}`);
    this.isRunning = false;

    // Wait for active requests to complete
    await this.waitForActiveRequests();

    this.emit('stopped');
  }

  /**
   * Run ramp-up phase
   */
  private async runRampUpPhase(
    requestGenerator: () => LoadTestRequest,
    onProgress?: (progress: LoadTestProgress) => void
  ): Promise<PhaseResult> {
    logger.info(`Starting ramp-up phase: ${this.config.rampUpTime}ms`);

    const startTime = performance.now();
    const endTime = startTime + this.config.rampUpTime;
    const phaseResponses: LoadTestResponse[] = [];

    while (performance.now() < endTime && this.isRunning) {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / this.config.rampUpTime;
      const targetConcurrency = Math.floor(this.config.maxConcurrency * progress);

      // Adjust concurrency based on progress
      await this.adjustConcurrency(targetConcurrency, requestGenerator, phaseResponses);

      // Report progress
      if (onProgress) {
        onProgress({
          phase: 'rampUp',
          progress: progress,
          currentConcurrency: this.activeRequests.size,
          targetConcurrency: targetConcurrency,
          completedRequests: phaseResponses.length,
          avgResponseTime: this.calculateAverageResponseTime(phaseResponses)
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.calculatePhaseResult('rampUp', startTime, performance.now(), phaseResponses);
  }

  /**
   * Run sustain phase
   */
  private async runSustainPhase(
    requestGenerator: () => LoadTestRequest,
    onProgress?: (progress: LoadTestProgress) => void
  ): Promise<PhaseResult> {
    logger.info(`Starting sustain phase: ${this.config.sustainDuration}ms`);

    const startTime = performance.now();
    const endTime = startTime + this.config.sustainDuration;
    const phaseResponses: LoadTestResponse[] = [];

    while (performance.now() < endTime && this.isRunning) {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / this.config.sustainDuration;

      // Maintain maximum concurrency
      await this.adjustConcurrency(this.config.maxConcurrency, requestGenerator, phaseResponses);

      // Report progress
      if (onProgress) {
        onProgress({
          phase: 'sustain',
          progress: progress,
          currentConcurrency: this.activeRequests.size,
          targetConcurrency: this.config.maxConcurrency,
          completedRequests: phaseResponses.length,
          avgResponseTime: this.calculateAverageResponseTime(phaseResponses)
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.calculatePhaseResult('sustain', startTime, performance.now(), phaseResponses);
  }

  /**
   * Run ramp-down phase
   */
  private async runRampDownPhase(
    requestGenerator: () => LoadTestRequest,
    onProgress?: (progress: LoadTestProgress) => void
  ): Promise<PhaseResult> {
    logger.info(`Starting ramp-down phase: ${this.config.rampDownTime}ms`);

    const startTime = performance.now();
    const endTime = startTime + this.config.rampDownTime;
    const phaseResponses: LoadTestResponse[] = [];

    while (performance.now() < endTime && this.isRunning) {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / this.config.rampDownTime;
      const targetConcurrency = Math.floor(this.config.maxConcurrency * (1 - progress));

      // Reduce concurrency based on progress
      await this.adjustConcurrency(targetConcurrency, requestGenerator, phaseResponses);

      // Report progress
      if (onProgress) {
        onProgress({
          phase: 'rampDown',
          progress: progress,
          currentConcurrency: this.activeRequests.size,
          targetConcurrency: targetConcurrency,
          completedRequests: phaseResponses.length,
          avgResponseTime: this.calculateAverageResponseTime(phaseResponses)
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.calculatePhaseResult('rampDown', startTime, performance.now(), phaseResponses);
  }

  /**
   * Adjust concurrency level
   */
  private async adjustConcurrency(
    targetConcurrency: number,
    requestGenerator: () => LoadTestRequest,
    phaseResponses: LoadTestResponse[]
  ): Promise<void> {
    const currentConcurrency = this.activeRequests.size;

    if (currentConcurrency < targetConcurrency) {
      // Increase concurrency
      const requestsToAdd = targetConcurrency - currentConcurrency;
      
      for (let i = 0; i < requestsToAdd; i++) {
        const request = requestGenerator();
        const promise = this.executeRequest(request);
        
        this.activeRequests.set(request.id, promise);
        
        // Handle request completion
        promise.then(response => {
          this.activeRequests.delete(request.id);
          this.responses.push(response);
          phaseResponses.push(response);
          
          // Update performance metrics
          if (this.performanceMonitor) {
            this.performanceMonitor.getCurrentMetrics();
          }
        }).catch(error => {
          this.activeRequests.delete(request.id);
          logger.error(`Request ${request.id} failed:`, error);
        });
      }
    } else if (currentConcurrency > targetConcurrency) {
      // Decrease concurrency by not starting new requests
      // Active requests will naturally complete
    }
  }

  /**
   * Execute a single request
   */
  private async executeRequest(request: LoadTestRequest): Promise<LoadTestResponse> {
    const startTime = performance.now();
    
    try {
      let result;
      
      if (request.execute) {
        // Execute custom function
        result = await request.execute();
      } else {
        // Simulate HTTP request
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        result = { success: true };
      }
      
      const responseTime = performance.now() - startTime;
      
      return {
        id: request.id,
        success: true,
        responseTime,
        statusCode: 200,
        data: result
      };
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      return {
        id: request.id,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Wait for all active requests to complete
   */
  private async waitForActiveRequests(): Promise<void> {
    if (this.activeRequests.size === 0) {
      return;
    }

    logger.info(`Waiting for ${this.activeRequests.size} active requests to complete`);
    
    const activePromises = Array.from(this.activeRequests.values());
    await Promise.allSettled(activePromises);
    
    this.activeRequests.clear();
  }

  /**
   * Calculate phase result
   */
  private calculatePhaseResult(
    phase: 'rampUp' | 'sustain' | 'rampDown',
    startTime: number,
    endTime: number,
    responses: LoadTestResponse[]
  ): PhaseResult {
    const duration = endTime - startTime;
    const successfulRequests = responses.filter(r => r.success).length;
    const failedRequests = responses.filter(r => !r.success).length;
    const avgResponseTime = this.calculateAverageResponseTime(responses);
    const throughput = responses.length / (duration / 1000);
    const errorRate = responses.length > 0 ? failedRequests / responses.length : 0;

    return {
      phase,
      startTime,
      endTime,
      duration,
      requests: responses.length,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      throughput,
      errorRate
    };
  }

  /**
   * Calculate final test results
   */
  private calculateResults(
    startTime: number,
    endTime: number,
    totalDuration: number,
    phaseResults: {
      rampUp: PhaseResult;
      sustain: PhaseResult;
      rampDown: PhaseResult;
    }
  ): LoadTestResult {
    const successfulRequests = this.responses.filter(r => r.success).length;
    const failedRequests = this.responses.filter(r => !r.success).length;
    const responseTimes = this.responses.map(r => r.responseTime);
    
    const avgResponseTime = this.calculateAverageResponseTime(this.responses);
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const throughput = this.responses.length / (totalDuration / 1000);
    const errorRate = this.responses.length > 0 ? failedRequests / this.responses.length : 0;
    const successRate = this.responses.length > 0 ? successfulRequests / this.responses.length : 0;

    // Check thresholds
    const thresholdResults = {
      avgResponseTime: avgResponseTime <= this.config.thresholds.avgResponseTime,
      maxResponseTime: maxResponseTime <= this.config.thresholds.maxResponseTime,
      errorRate: errorRate <= this.config.thresholds.errorRate,
      successRate: successRate >= this.config.thresholds.successRate,
      throughput: throughput >= this.config.thresholds.throughput
    };

    return {
      testName: this.config.name,
      startTime,
      endTime,
      totalDuration,
      totalRequests: this.responses.length,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      maxResponseTime,
      minResponseTime,
      throughput,
      errorRate,
      successRate,
      responses: this.responses,
      phaseResults,
      thresholdResults
    };
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(responses: LoadTestResponse[]): number {
    if (responses.length === 0) {
      return 0;
    }
    
    const totalResponseTime = responses.reduce((sum, r) => sum + r.responseTime, 0);
    return totalResponseTime / responses.length;
  }
}

// Load test progress interface
export interface LoadTestProgress {
  phase: 'rampUp' | 'sustain' | 'rampDown';
  progress: number;
  currentConcurrency: number;
  targetConcurrency: number;
  completedRequests: number;
  avgResponseTime: number;
}

// Utility function to create request generators
export function createRequestGenerator(
  baseRequest: Partial<LoadTestRequest>,
  customizer?: (request: LoadTestRequest, index: number) => LoadTestRequest
): () => LoadTestRequest {
  let requestIndex = 0;
  
  return () => {
    const request: LoadTestRequest = {
      id: `request-${requestIndex++}`,
      method: 'GET',
      ...baseRequest
    };
    
    if (customizer) {
      return customizer(request, requestIndex - 1);
    }
    
    return request;
  };
}

// Utility function to create simple load test configs
export function createLoadTestConfig(
  name: string,
  overrides: Partial<LoadTestConfig> = {}
): LoadTestConfig {
  return {
    name,
    maxConcurrency: 10,
    rampUpTime: 10000,
    sustainDuration: 30000,
    rampDownTime: 10000,
    thresholds: {
      avgResponseTime: 1000,
      maxResponseTime: 5000,
      errorRate: 0.05,
      successRate: 0.95,
      throughput: 5
    },
    ...overrides
  };
}