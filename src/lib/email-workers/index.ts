// Email Workers System - Main Entry Point

export * from './types';
export * from './job-queue';
export * from './email-worker';
export * from './worker-manager';
export * from './retry-system';
export * from './monitoring';

import { emailWorkerManager } from './worker-manager';
import { emailRetrySystem } from './retry-system';
import { emailWorkerMonitoring } from './monitoring';
import { logger } from '@/lib/logger';

/**
 * Email Workers Service - Main orchestrator for the email worker system
 */
export class EmailWorkersService {
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  /**
   * Initialize the email workers system
   */
  async initialize(config?: {
    autoStart?: boolean;
    maxWorkers?: number;
    minWorkers?: number;
    targetThroughput?: number;
  }): Promise<void> {
    try {
      if (this.isInitialized) {
        logger.warn('Email workers system already initialized');
        return;
      }

      logger.info('Initializing Email Workers System', {
        metadata: { config }
      });

      // Initialize monitoring first
      await emailWorkerMonitoring.start();

      // Initialize retry system
      await emailRetrySystem.start();

      // Initialize worker manager
      if (config?.autoStart !== false) {
        await emailWorkerManager.start();
        this.isRunning = true;
      }

      this.isInitialized = true;

      logger.info('Email Workers System initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Email Workers System', {}, error as Error);
      throw error;
    }
  }

  /**
   * Start the email workers system
   */
  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.isRunning) {
        logger.warn('Email workers system already running');
        return;
      }

      logger.info('Starting Email Workers System');

      await emailWorkerManager.start();
      this.isRunning = true;

      logger.info('Email Workers System started successfully');
    } catch (error) {
      logger.error('Failed to start Email Workers System', {}, error as Error);
      throw error;
    }
  }

  /**
   * Stop the email workers system
   */
  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        logger.warn('Email workers system not running');
        return;
      }

      logger.info('Stopping Email Workers System');

      // Stop components in reverse order
      await emailWorkerManager.stop();
      await emailRetrySystem.stop();
      await emailWorkerMonitoring.stop();

      this.isRunning = false;
      this.isInitialized = false;

      logger.info('Email Workers System stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Email Workers System', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get system status
   */
  getStatus(): {
    initialized: boolean;
    running: boolean;
    active_workers: number;
    active_worker_ids: string[];
  } {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      active_workers: emailWorkerManager.getWorkerCount(),
      active_worker_ids: emailWorkerManager.getActiveWorkerIds()
    };
  }

  /**
   * Get comprehensive system statistics
   */
  async getComprehensiveStats(): Promise<{
    system_stats: any;
    worker_health: any;
    retry_stats: any;
    throughput_analytics: any;
    alerts: any;
  }> {
    try {
      const [
        systemStats,
        workerHealth,
        retryStats,
        throughputAnalytics,
        alerts
      ] = await Promise.all([
        emailWorkerManager.getSystemStats(),
        emailWorkerMonitoring.getWorkerHealth(),
        emailRetrySystem.getRetryStats(),
        emailWorkerMonitoring.getThroughputAnalytics(),
        emailWorkerMonitoring.checkPerformanceAlerts()
      ]);

      return {
        system_stats: systemStats,
        worker_health: workerHealth,
        retry_stats: retryStats,
        throughput_analytics: throughputAnalytics,
        alerts: alerts
      };
    } catch (error) {
      logger.error('Error getting comprehensive stats', {}, error as Error);
      throw error;
    }
  }

  /**
   * Health check for the entire system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: {
      worker_manager: boolean;
      retry_system: boolean;
      monitoring: boolean;
    };
    issues: string[];
  }> {
    try {
      const issues: string[] = [];
      const components = {
        worker_manager: false,
        retry_system: false,
        monitoring: false
      };

      // Check worker manager
      try {
        const stats = await emailWorkerManager.getSystemStats();
        components.worker_manager = true;
        
        if (stats.active_workers === 0) {
          issues.push('No active workers');
        }
        
        if (stats.pending_jobs > 100) {
          issues.push('High number of pending jobs');
        }
      } catch (error) {
        issues.push('Worker manager not responding');
      }

      // Check retry system
      try {
        const retryStats = await emailRetrySystem.getRetryStats();
        components.retry_system = true;
        
        if (retryStats.abandoned_retries > 10) {
          issues.push('High number of abandoned retries');
        }
      } catch (error) {
        issues.push('Retry system not responding');
      }

      // Check monitoring
      try {
        const alerts = await emailWorkerMonitoring.checkPerformanceAlerts();
        components.monitoring = true;
        
        if (alerts.alerts.length > 0) {
          issues.push(`${alerts.alerts.length} performance alerts`);
        }
      } catch (error) {
        issues.push('Monitoring system not responding');
      }

      const healthy = issues.length === 0 && 
        components.worker_manager && 
        components.retry_system && 
        components.monitoring;

      return {
        healthy,
        components,
        issues
      };
    } catch (error) {
      logger.error('Error in health check', {}, error as Error);
      return {
        healthy: false,
        components: {
          worker_manager: false,
          retry_system: false,
          monitoring: false
        },
        issues: ['System health check failed']
      };
    }
  }
}

// Export singleton instance
export const emailWorkersService = new EmailWorkersService();

// Export individual services for direct access
export {
  emailWorkerManager,
  emailRetrySystem,
  emailWorkerMonitoring
};

// Auto-initialize in production
if (process.env.NODE_ENV === 'production' && process.env.AUTO_START_WORKERS === 'true') {
  emailWorkersService.initialize({ autoStart: true }).catch(error => {
    logger.error('Failed to auto-initialize email workers', {}, error);
  });
}