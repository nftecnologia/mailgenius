// Email Worker Monitoring System - Tracks performance, throughput, and health

import { createSupabaseServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { 
  WorkerMetric, 
  MetricType, 
  SystemStats, 
  WorkerStats,
  WorkerHealth 
} from './types';

export class EmailWorkerMonitoring {
  private supabase = createSupabaseServerClient();
  private metricsInterval: NodeJS.Timeout | null = null;
  private alertsInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private metricsCollectionInterval: number = 60000; // 1 minute
  private alertsCheckInterval: number = 300000; // 5 minutes

  // Performance thresholds
  private readonly thresholds = {
    max_response_time: 30000, // 30 seconds
    min_success_rate: 95, // 95%
    max_error_rate: 5, // 5%
    min_throughput: 1000, // 1000 emails per hour
    max_queue_size: 1000, // 1000 pending jobs
    worker_timeout: 300000, // 5 minutes since last heartbeat
  };

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    try {
      this.isRunning = true;
      
      logger.info('Starting Email Worker Monitoring System');
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Start alerts checking
      this.startAlertsChecking();
      
      logger.info('Email Worker Monitoring System started');
    } catch (error) {
      logger.error('Failed to start Email Worker Monitoring System', {}, error as Error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      if (this.alertsInterval) {
        clearInterval(this.alertsInterval);
      }
      
      logger.info('Email Worker Monitoring System stopped');
    } catch (error) {
      logger.error('Error stopping Email Worker Monitoring System', {}, error as Error);
    }
  }

  /**
   * Record metric
   */
  async recordMetric(
    workerId: string,
    metricType: MetricType,
    value: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const timeWindow = new Date();
      timeWindow.setMinutes(0, 0, 0); // Round to hour

      const { error } = await this.supabase
        .from('worker_metrics')
        .insert({
          worker_id: workerId,
          metric_type: metricType,
          metric_value: value,
          time_window: timeWindow.toISOString(),
          metadata: metadata || {}
        });

      if (error) {
        logger.error('Error recording metric', {
          metadata: { workerId, metricType, value }
        }, error);
      }
    } catch (error) {
      logger.error('Error recording metric', {
        metadata: { workerId, metricType, value }
      }, error as Error);
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<SystemStats> {
    try {
      const [workerStats, jobStats, emailStats] = await Promise.all([
        this.getWorkerStats(),
        this.getJobStats(),
        this.getEmailStats()
      ]);

      return {
        total_workers: workerStats.total_workers,
        active_workers: workerStats.active_workers,
        idle_workers: workerStats.idle_workers,
        busy_workers: workerStats.busy_workers,
        offline_workers: workerStats.offline_workers,
        pending_jobs: jobStats.pending_jobs,
        processing_jobs: jobStats.processing_jobs,
        completed_jobs_last_hour: jobStats.completed_jobs_last_hour,
        failed_jobs_last_hour: jobStats.failed_jobs_last_hour,
        total_emails_sent_last_hour: emailStats.total_emails_sent_last_hour,
        avg_system_throughput: emailStats.avg_system_throughput
      };
    } catch (error) {
      logger.error('Error getting system stats', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get worker statistics
   */
  async getWorkerStatistics(workerId: string): Promise<WorkerStats> {
    try {
      const { data: worker, error } = await this.supabase
        .from('email_workers')
        .select('*')
        .eq('id', workerId)
        .single();

      if (error || !worker) {
        throw new Error(`Worker ${workerId} not found`);
      }

      // Get recent metrics
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data: metrics } = await this.supabase
        .from('worker_metrics')
        .select('*')
        .eq('worker_id', workerId)
        .gte('created_at', oneHourAgo.toISOString());

      // Calculate statistics
      const throughputMetrics = metrics?.filter(m => m.metric_type === 'throughput') || [];
      const successMetrics = metrics?.filter(m => m.metric_type === 'success_rate') || [];
      const responseTimeMetrics = metrics?.filter(m => m.metric_type === 'response_time') || [];

      const avgThroughput = throughputMetrics.length > 0
        ? throughputMetrics.reduce((sum, m) => sum + m.metric_value, 0) / throughputMetrics.length
        : 0;

      const avgSuccessRate = successMetrics.length > 0
        ? successMetrics.reduce((sum, m) => sum + m.metric_value, 0) / successMetrics.length
        : 0;

      const avgResponseTime = responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.metric_value, 0) / responseTimeMetrics.length
        : 0;

      // Get rate limit usage
      const { data: rateLimits } = await this.supabase
        .from('worker_rate_limits')
        .select('*')
        .eq('worker_id', workerId)
        .gte('time_window', oneHourAgo.toISOString());

      const minuteUsage = rateLimits?.find(r => r.window_type === 'minute')?.emails_sent || 0;
      const hourUsage = rateLimits?.find(r => r.window_type === 'hour')?.emails_sent || 0;

      return {
        total_jobs_processed: worker.total_jobs_processed,
        total_emails_sent: worker.total_emails_sent,
        success_rate: avgSuccessRate,
        avg_processing_time: avgResponseTime,
        current_throughput: avgThroughput,
        rate_limit_usage: {
          per_minute: (minuteUsage / worker.rate_limit_per_minute) * 100,
          per_hour: (hourUsage / worker.rate_limit_per_hour) * 100
        }
      };
    } catch (error) {
      logger.error('Error getting worker statistics', {
        metadata: { workerId }
      }, error as Error);
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

      const healthChecks: WorkerHealth[] = [];

      for (const worker of workers) {
        const isHealthy = this.isWorkerHealthy(worker);
        const consecutiveFailures = await this.getConsecutiveFailures(worker.id);

        healthChecks.push({
          worker_id: worker.id,
          is_healthy: isHealthy,
          last_heartbeat: new Date(worker.last_heartbeat),
          last_job_completed: worker.last_job_completed ? new Date(worker.last_job_completed) : undefined,
          consecutive_failures: consecutiveFailures,
          response_time: worker.performance_metrics?.avg_processing_time || 0,
          memory_usage: worker.performance_metrics?.memory_usage,
          cpu_usage: worker.performance_metrics?.cpu_usage
        });
      }

      return healthChecks;
    } catch (error) {
      logger.error('Error getting worker health', {}, error as Error);
      return [];
    }
  }

  /**
   * Get performance metrics for a time range
   */
  async getPerformanceMetrics(
    workerId?: string,
    metricType?: MetricType,
    startTime?: Date,
    endTime?: Date
  ): Promise<WorkerMetric[]> {
    try {
      let query = this.supabase
        .from('worker_metrics')
        .select('*')
        .order('time_window');

      if (workerId) {
        query = query.eq('worker_id', workerId);
      }

      if (metricType) {
        query = query.eq('metric_type', metricType);
      }

      if (startTime) {
        query = query.gte('time_window', startTime.toISOString());
      }

      if (endTime) {
        query = query.lte('time_window', endTime.toISOString());
      }

      const { data: metrics, error } = await query;

      if (error) {
        logger.error('Error getting performance metrics', {}, error);
        return [];
      }

      return metrics || [];
    } catch (error) {
      logger.error('Error getting performance metrics', {}, error as Error);
      return [];
    }
  }

  /**
   * Get throughput analytics
   */
  async getThroughputAnalytics(hours: number = 24): Promise<{
    hourly_throughput: { hour: string; emails_sent: number }[];
    total_emails_sent: number;
    avg_emails_per_hour: number;
    peak_hour: string;
    peak_throughput: number;
  }> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

      const { data: metrics } = await this.supabase
        .from('worker_metrics')
        .select('*')
        .eq('metric_type', 'throughput')
        .gte('time_window', startTime.toISOString())
        .lte('time_window', endTime.toISOString())
        .order('time_window');

      const hourlyThroughput = new Map<string, number>();
      let totalEmailsSent = 0;

      metrics?.forEach(metric => {
        const hour = metric.time_window.substring(0, 13); // YYYY-MM-DDTHH
        const current = hourlyThroughput.get(hour) || 0;
        hourlyThroughput.set(hour, current + metric.metric_value);
        totalEmailsSent += metric.metric_value;
      });

      const hourlyData = Array.from(hourlyThroughput.entries())
        .map(([hour, emails_sent]) => ({ hour, emails_sent }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      const avgEmailsPerHour = hourlyData.length > 0 ? totalEmailsSent / hourlyData.length : 0;
      const peakHour = hourlyData.reduce((max, current) => 
        current.emails_sent > max.emails_sent ? current : max,
        { hour: '', emails_sent: 0 }
      );

      return {
        hourly_throughput: hourlyData,
        total_emails_sent: totalEmailsSent,
        avg_emails_per_hour: avgEmailsPerHour,
        peak_hour: peakHour.hour,
        peak_throughput: peakHour.emails_sent
      };
    } catch (error) {
      logger.error('Error getting throughput analytics', {}, error as Error);
      return {
        hourly_throughput: [],
        total_emails_sent: 0,
        avg_emails_per_hour: 0,
        peak_hour: '',
        peak_throughput: 0
      };
    }
  }

  /**
   * Check for performance alerts
   */
  async checkPerformanceAlerts(): Promise<{
    alerts: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      worker_id?: string;
      metric_value?: number;
      threshold?: number;
    }>;
  }> {
    try {
      const alerts = [];
      const systemStats = await this.getSystemStats();
      const workerHealth = await this.getWorkerHealth();

      // Check system-wide alerts
      if (systemStats.pending_jobs > this.thresholds.max_queue_size) {
        alerts.push({
          type: 'high_queue_size',
          severity: 'high' as const,
          message: `High queue size: ${systemStats.pending_jobs} pending jobs`,
          metric_value: systemStats.pending_jobs,
          threshold: this.thresholds.max_queue_size
        });
      }

      if (systemStats.avg_system_throughput < this.thresholds.min_throughput) {
        alerts.push({
          type: 'low_throughput',
          severity: 'medium' as const,
          message: `Low system throughput: ${systemStats.avg_system_throughput} emails/hour`,
          metric_value: systemStats.avg_system_throughput,
          threshold: this.thresholds.min_throughput
        });
      }

      if (systemStats.offline_workers > 0) {
        alerts.push({
          type: 'workers_offline',
          severity: 'medium' as const,
          message: `${systemStats.offline_workers} workers are offline`,
          metric_value: systemStats.offline_workers
        });
      }

      // Check worker-specific alerts
      for (const worker of workerHealth) {
        if (!worker.is_healthy) {
          alerts.push({
            type: 'worker_unhealthy',
            severity: 'high' as const,
            message: `Worker ${worker.worker_id} is unhealthy`,
            worker_id: worker.worker_id
          });
        }

        if (worker.consecutive_failures > 5) {
          alerts.push({
            type: 'high_failure_rate',
            severity: 'high' as const,
            message: `Worker ${worker.worker_id} has ${worker.consecutive_failures} consecutive failures`,
            worker_id: worker.worker_id,
            metric_value: worker.consecutive_failures
          });
        }

        if (worker.response_time > this.thresholds.max_response_time) {
          alerts.push({
            type: 'high_response_time',
            severity: 'medium' as const,
            message: `Worker ${worker.worker_id} has high response time: ${worker.response_time}ms`,
            worker_id: worker.worker_id,
            metric_value: worker.response_time,
            threshold: this.thresholds.max_response_time
          });
        }
      }

      return { alerts };
    } catch (error) {
      logger.error('Error checking performance alerts', {}, error as Error);
      return { alerts: [] };
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.collectSystemMetrics();
      }
    }, this.metricsCollectionInterval);
  }

  /**
   * Start alerts checking
   */
  private startAlertsChecking(): void {
    this.alertsInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.checkAndLogAlerts();
      }
    }, this.alertsCheckInterval);
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const systemStats = await this.getSystemStats();
      
      // Log system metrics
      logger.info('System metrics collected', {
        metadata: {
          totalWorkers: systemStats.total_workers,
          activeWorkers: systemStats.active_workers,
          pendingJobs: systemStats.pending_jobs,
          processingJobs: systemStats.processing_jobs,
          throughput: systemStats.avg_system_throughput,
          emailsSentLastHour: systemStats.total_emails_sent_last_hour
        }
      });

      // Record system-wide metrics
      await this.recordMetric('system', 'throughput', systemStats.avg_system_throughput);
      
      const successRate = systemStats.completed_jobs_last_hour / 
        (systemStats.completed_jobs_last_hour + systemStats.failed_jobs_last_hour) * 100;
      
      if (!isNaN(successRate)) {
        await this.recordMetric('system', 'success_rate', successRate);
      }
    } catch (error) {
      logger.error('Error collecting system metrics', {}, error as Error);
    }
  }

  /**
   * Check and log alerts
   */
  private async checkAndLogAlerts(): Promise<void> {
    try {
      const { alerts } = await this.checkPerformanceAlerts();
      
      alerts.forEach(alert => {
        const logLevel = alert.severity === 'critical' || alert.severity === 'high' ? 'error' : 'warn';
        
        logger[logLevel](`Performance alert: ${alert.message}`, {
          metadata: {
            type: alert.type,
            severity: alert.severity,
            worker_id: alert.worker_id,
            metric_value: alert.metric_value,
            threshold: alert.threshold
          }
        });
      });
    } catch (error) {
      logger.error('Error checking and logging alerts', {}, error as Error);
    }
  }

  /**
   * Helper methods
   */
  private async getWorkerStats(): Promise<{
    total_workers: number;
    active_workers: number;
    idle_workers: number;
    busy_workers: number;
    offline_workers: number;
  }> {
    const { data: workers } = await this.supabase
      .from('email_workers')
      .select('status');

    const stats = { total_workers: 0, active_workers: 0, idle_workers: 0, busy_workers: 0, offline_workers: 0 };

    workers?.forEach(worker => {
      stats.total_workers++;
      switch (worker.status) {
        case 'idle':
          stats.idle_workers++;
          stats.active_workers++;
          break;
        case 'busy':
          stats.busy_workers++;
          stats.active_workers++;
          break;
        case 'offline':
          stats.offline_workers++;
          break;
      }
    });

    return stats;
  }

  private async getJobStats(): Promise<{
    pending_jobs: number;
    processing_jobs: number;
    completed_jobs_last_hour: number;
    failed_jobs_last_hour: number;
  }> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: jobs } = await this.supabase
      .from('email_jobs')
      .select('status, created_at');

    const stats = { pending_jobs: 0, processing_jobs: 0, completed_jobs_last_hour: 0, failed_jobs_last_hour: 0 };

    jobs?.forEach(job => {
      switch (job.status) {
        case 'pending':
          stats.pending_jobs++;
          break;
        case 'processing':
          stats.processing_jobs++;
          break;
        case 'completed':
          if (new Date(job.created_at) >= oneHourAgo) {
            stats.completed_jobs_last_hour++;
          }
          break;
        case 'failed':
          if (new Date(job.created_at) >= oneHourAgo) {
            stats.failed_jobs_last_hour++;
          }
          break;
      }
    });

    return stats;
  }

  private async getEmailStats(): Promise<{
    total_emails_sent_last_hour: number;
    avg_system_throughput: number;
  }> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: sends } = await this.supabase
      .from('email_sends')
      .select('created_at')
      .eq('status', 'sent')
      .gte('created_at', oneHourAgo.toISOString());

    const totalEmailsLastHour = sends?.length || 0;

    return {
      total_emails_sent_last_hour: totalEmailsLastHour,
      avg_system_throughput: totalEmailsLastHour // emails per hour
    };
  }

  private isWorkerHealthy(worker: any): boolean {
    const now = new Date();
    const lastHeartbeat = new Date(worker.last_heartbeat);
    const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
    
    return timeSinceHeartbeat < this.thresholds.worker_timeout;
  }

  private async getConsecutiveFailures(workerId: string): Promise<number> {
    const { data: jobs } = await this.supabase
      .from('email_jobs')
      .select('status')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })
      .limit(10);

    let consecutiveFailures = 0;
    
    for (const job of jobs || []) {
      if (job.status === 'failed') {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    return consecutiveFailures;
  }
}

// Export singleton instance
export const emailWorkerMonitoring = new EmailWorkerMonitoring();