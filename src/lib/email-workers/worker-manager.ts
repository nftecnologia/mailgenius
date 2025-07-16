// Email Worker Manager - Orchestrates multiple workers and load balancing

import { createSupabaseServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { emailJobQueue } from './job-queue';
import { createEmailWorker, EmailWorkerInstance } from './email-worker';
import { 
  EmailWorker, 
  WorkerStatus, 
  SystemStats, 
  WorkerHealth,
  WorkerRegistrationParams,
  JobCreationParams
} from './types';

export class EmailWorkerManager {
  private supabase = createSupabaseServerClient();
  private workers: Map<string, EmailWorkerInstance> = new Map();
  private isRunning: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private maxWorkers: number = 10;
  private minWorkers: number = 2;
  private targetThroughput: number = 10000; // 10k emails per hour

  constructor(config?: {
    maxWorkers?: number;
    minWorkers?: number;
    targetThroughput?: number;
  }) {
    if (config) {
      this.maxWorkers = config.maxWorkers || 10;
      this.minWorkers = config.minWorkers || 2;
      this.targetThroughput = config.targetThroughput || 10000;
    }
  }

  /**
   * Start the worker manager
   */
  async start(): Promise<void> {
    try {
      this.isRunning = true;
      
      logger.info('Starting Email Worker Manager', {
        metadata: { 
          maxWorkers: this.maxWorkers,
          minWorkers: this.minWorkers,
          targetThroughput: this.targetThroughput
        }
      });

      // Start with minimum workers
      await this.scaleWorkers(this.minWorkers);

      // Start monitoring
      this.startMonitoring();
      this.startHealthChecks();

      logger.info('Email Worker Manager started successfully');
    } catch (error) {
      logger.error('Failed to start Email Worker Manager', {}, error as Error);
      throw error;
    }
  }

  /**
   * Stop the worker manager
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;

      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Stop all workers
      const stopPromises = Array.from(this.workers.values()).map(worker => worker.stop());
      await Promise.all(stopPromises);

      this.workers.clear();

      logger.info('Email Worker Manager stopped');
    } catch (error) {
      logger.error('Error stopping Email Worker Manager', {}, error as Error);
    }
  }

  /**
   * Create a new email campaign job
   */
  async createCampaignJob(params: JobCreationParams): Promise<string> {
    try {
      const jobId = await emailJobQueue.createJob(params);
      
      // Check if we need to scale up workers
      await this.checkAndScale();

      return jobId;
    } catch (error) {
      logger.error('Error creating campaign job', {
        metadata: { campaignId: params.campaign_id }
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<SystemStats> {
    try {
      const [workerStats, jobStats] = await Promise.all([
        this.getWorkerStats(),
        emailJobQueue.getJobStats()
      ]);

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get jobs from last hour
      const { data: recentJobs } = await this.supabase
        .from('email_jobs')
        .select('status, total_emails, processed_emails, created_at')
        .gte('created_at', oneHourAgo.toISOString());

      const completedJobsLastHour = recentJobs?.filter(j => j.status === 'completed').length || 0;
      const failedJobsLastHour = recentJobs?.filter(j => j.status === 'failed').length || 0;
      const totalEmailsLastHour = recentJobs?.reduce((sum, j) => sum + j.processed_emails, 0) || 0;

      return {
        total_workers: workerStats.total,
        active_workers: workerStats.active,
        idle_workers: workerStats.idle,
        busy_workers: workerStats.busy,
        offline_workers: workerStats.offline,
        pending_jobs: jobStats?.pending_jobs || 0,
        processing_jobs: jobStats?.processing_jobs || 0,
        completed_jobs_last_hour: completedJobsLastHour,
        failed_jobs_last_hour: failedJobsLastHour,
        total_emails_sent_last_hour: totalEmailsLastHour,
        avg_system_throughput: totalEmailsLastHour // emails per hour
      };
    } catch (error) {
      logger.error('Error getting system stats', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get worker health status
   */
  async getWorkerHealth(): Promise<WorkerHealth[]> {
    try {
      const { data: workers } = await this.supabase
        .from('email_workers')
        .select('*')
        .order('created_at');

      if (!workers) return [];

      return workers.map(worker => ({
        worker_id: worker.id,
        is_healthy: this.isWorkerHealthy(worker),
        last_heartbeat: new Date(worker.last_heartbeat),
        last_job_completed: worker.last_job_completed ? new Date(worker.last_job_completed) : undefined,
        consecutive_failures: worker.total_errors || 0,
        response_time: worker.performance_metrics?.avg_processing_time || 0
      }));
    } catch (error) {
      logger.error('Error getting worker health', {}, error as Error);
      return [];
    }
  }

  /**
   * Scale workers up or down
   */
  async scaleWorkers(targetCount: number): Promise<void> {
    try {
      const currentCount = this.workers.size;
      
      if (targetCount > currentCount) {
        // Scale up
        const workersToAdd = targetCount - currentCount;
        const addPromises = [];

        for (let i = 0; i < workersToAdd; i++) {
          addPromises.push(this.addWorker());
        }

        await Promise.all(addPromises);
        
        logger.info(`Scaled up workers`, {
          metadata: { from: currentCount, to: targetCount }
        });
      } else if (targetCount < currentCount) {
        // Scale down
        const workersToRemove = currentCount - targetCount;
        const removePromises = [];

        // Remove idle workers first
        const workerEntries = Array.from(this.workers.entries());
        const idleWorkers = workerEntries.filter(([_, worker]) => !worker['currentJob']);
        
        for (let i = 0; i < Math.min(workersToRemove, idleWorkers.length); i++) {
          removePromises.push(this.removeWorker(idleWorkers[i][0]));
        }

        await Promise.all(removePromises);
        
        logger.info(`Scaled down workers`, {
          metadata: { from: currentCount, to: this.workers.size }
        });
      }
    } catch (error) {
      logger.error('Error scaling workers', {
        metadata: { targetCount }
      }, error as Error);
    }
  }

  /**
   * Add a new worker
   */
  private async addWorker(): Promise<void> {
    try {
      const worker = createEmailWorker({
        name: `EmailWorker-${Date.now()}`,
        max_concurrent_jobs: 1,
        rate_limit_per_minute: 100,
        rate_limit_per_hour: 1000,
        config: {
          max_batch_size: 100,
          retry_delay_seconds: 30,
          max_retry_attempts: 3,
          health_check_interval: 30000,
          email_provider: 'resend',
          rate_limit_buffer: 10,
          enable_metrics: true,
          enable_detailed_logging: false
        }
      });

      await worker.start();
      this.workers.set(worker['workerId'], worker);

      logger.info(`Added new worker`, {
        metadata: { workerId: worker['workerId'] }
      });
    } catch (error) {
      logger.error('Error adding worker', {}, error as Error);
    }
  }

  /**
   * Remove a worker
   */
  private async removeWorker(workerId: string): Promise<void> {
    try {
      const worker = this.workers.get(workerId);
      if (worker) {
        await worker.stop();
        this.workers.delete(workerId);
        
        logger.info(`Removed worker`, {
          metadata: { workerId }
        });
      }
    } catch (error) {
      logger.error('Error removing worker', {
        metadata: { workerId }
      }, error as Error);
    }
  }

  /**
   * Check if we need to scale and do it
   */
  private async checkAndScale(): Promise<void> {
    try {
      const stats = await this.getSystemStats();
      
      // Calculate current load
      const currentLoad = stats.processing_jobs + stats.pending_jobs;
      const currentThroughput = stats.avg_system_throughput;
      
      // Scale up if:
      // 1. We have pending jobs and all workers are busy
      // 2. Current throughput is below target and we have capacity
      if (currentLoad > 0 && stats.idle_workers === 0 && this.workers.size < this.maxWorkers) {
        const targetWorkers = Math.min(
          this.maxWorkers,
          this.workers.size + Math.ceil(currentLoad / 10)
        );
        await this.scaleWorkers(targetWorkers);
      }
      
      // Scale down if:
      // 1. We have many idle workers
      // 2. Current throughput is well above target
      else if (stats.idle_workers > 2 && currentLoad < 5 && this.workers.size > this.minWorkers) {
        const targetWorkers = Math.max(
          this.minWorkers,
          this.workers.size - Math.floor(stats.idle_workers / 2)
        );
        await this.scaleWorkers(targetWorkers);
      }
    } catch (error) {
      logger.error('Error in checkAndScale', {}, error as Error);
    }
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAndScale();
        await this.collectSystemMetrics();
      } catch (error) {
        logger.error('Error in monitoring', {}, error as Error);
      }
    }, 60000); // Every minute
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error('Error in health checks', {}, error as Error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health checks on all workers
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const { data: workers } = await this.supabase
        .from('email_workers')
        .select('*');

      if (!workers) return;

      for (const worker of workers) {
        const isHealthy = this.isWorkerHealthy(worker);
        
        if (!isHealthy) {
          logger.warn(`Unhealthy worker detected`, {
            metadata: { workerId: worker.id }
          });
          
          // Remove unhealthy worker from our local map
          if (this.workers.has(worker.id)) {
            await this.removeWorker(worker.id);
          }
          
          // Mark as offline in database
          await this.supabase
            .from('email_workers')
            .update({ status: 'offline' })
            .eq('id', worker.id);
        }
      }
    } catch (error) {
      logger.error('Error performing health checks', {}, error as Error);
    }
  }

  /**
   * Check if worker is healthy
   */
  private isWorkerHealthy(worker: EmailWorker): boolean {
    const now = new Date();
    const lastHeartbeat = new Date(worker.last_heartbeat);
    const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
    
    // Consider unhealthy if no heartbeat for 2 minutes
    return timeSinceHeartbeat < 120000;
  }

  /**
   * Get worker statistics
   */
  private async getWorkerStats(): Promise<{
    total: number;
    active: number;
    idle: number;
    busy: number;
    offline: number;
  }> {
    try {
      const { data: workers } = await this.supabase
        .from('email_workers')
        .select('status');

      if (!workers) return { total: 0, active: 0, idle: 0, busy: 0, offline: 0 };

      const stats = {
        total: workers.length,
        active: 0,
        idle: 0,
        busy: 0,
        offline: 0
      };

      workers.forEach(worker => {
        switch (worker.status) {
          case 'idle':
            stats.idle++;
            stats.active++;
            break;
          case 'busy':
            stats.busy++;
            stats.active++;
            break;
          case 'offline':
            stats.offline++;
            break;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting worker stats', {}, error as Error);
      return { total: 0, active: 0, idle: 0, busy: 0, offline: 0 };
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const stats = await this.getSystemStats();
      
      // Log system metrics
      logger.info('System metrics collected', {
        metadata: {
          totalWorkers: stats.total_workers,
          activeWorkers: stats.active_workers,
          pendingJobs: stats.pending_jobs,
          processingJobs: stats.processing_jobs,
          throughput: stats.avg_system_throughput
        }
      });
    } catch (error) {
      logger.error('Error collecting system metrics', {}, error as Error);
    }
  }

  /**
   * Get current worker count
   */
  getWorkerCount(): number {
    return this.workers.size;
  }

  /**
   * Get active worker IDs
   */
  getActiveWorkerIds(): string[] {
    return Array.from(this.workers.keys());
  }
}

// Export singleton instance
export const emailWorkerManager = new EmailWorkerManager({
  maxWorkers: 10,
  minWorkers: 2,
  targetThroughput: 10000
});