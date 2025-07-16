// Email Worker Implementation

import { createSupabaseServerClient } from '@/lib/supabase';
import { sendEmail, replaceEmailVariables } from '@/lib/resend';
import { logger } from '@/lib/logger';
import { emailJobQueue } from './job-queue';
import { 
  EmailWorker, 
  EmailJob, 
  EmailJobBatch,
  WorkerStatus,
  WorkerConfig,
  WorkerMetrics,
  BatchProcessingResult,
  EmailError,
  Lead,
  WorkerRegistrationParams 
} from './types';

export class EmailWorkerInstance {
  private supabase = createSupabaseServerClient();
  private workerId: string;
  private workerName: string;
  private isRunning: boolean = false;
  private currentJob: EmailJob | null = null;
  private config: WorkerConfig;
  private metrics: WorkerMetrics;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(params: WorkerRegistrationParams) {
    this.workerId = this.generateWorkerId();
    this.workerName = params.name;
    this.config = {
      max_batch_size: 100,
      retry_delay_seconds: 30,
      max_retry_attempts: 3,
      health_check_interval: 30000, // 30 seconds
      email_provider: 'resend',
      rate_limit_buffer: 10, // 10% buffer
      enable_metrics: true,
      enable_detailed_logging: true,
      ...params.config
    };

    this.metrics = {
      avg_processing_time: 0,
      success_rate: 0,
      error_rate: 0,
      throughput_per_hour: 0,
      uptime_percentage: 100
    };
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    try {
      // Register worker in database
      await this.registerWorker();
      
      this.isRunning = true;
      logger.info(`Email worker ${this.workerId} started`, {
        metadata: { workerId: this.workerId, workerName: this.workerName }
      });

      // Start heartbeat
      this.startHeartbeat();

      // Start metrics collection
      if (this.config.enable_metrics) {
        this.startMetricsCollection();
      }

      // Start main processing loop
      this.startProcessingLoop();
    } catch (error) {
      logger.error(`Failed to start worker ${this.workerId}`, {
        metadata: { workerId: this.workerId }
      }, error as Error);
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      // Stop intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }

      // Update worker status
      await this.updateWorkerStatus('offline');

      logger.info(`Email worker ${this.workerId} stopped`, {
        metadata: { workerId: this.workerId }
      });
    } catch (error) {
      logger.error(`Error stopping worker ${this.workerId}`, {
        metadata: { workerId: this.workerId }
      }, error as Error);
    }
  }

  /**
   * Main processing loop
   */
  private async startProcessingLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can process more jobs
        if (this.currentJob) {
          await this.sleep(1000); // Wait 1 second before checking again
          continue;
        }

        // Get next job
        const job = await emailJobQueue.getNextJob(this.workerId);
        if (!job) {
          await this.sleep(5000); // Wait 5 seconds before checking for new jobs
          continue;
        }

        // Process the job
        await this.processJob(job);
      } catch (error) {
        logger.error(`Error in processing loop for worker ${this.workerId}`, {
          metadata: { workerId: this.workerId }
        }, error as Error);
        
        // Wait before retrying
        await this.sleep(10000);
      }
    }
  }

  /**
   * Process a job
   */
  private async processJob(job: EmailJob): Promise<void> {
    this.currentJob = job;
    const startTime = Date.now();

    try {
      logger.info(`Processing job ${job.id}`, {
        metadata: { 
          workerId: this.workerId,
          jobId: job.id,
          totalEmails: job.total_emails 
        }
      });

      // Get job batches
      const batches = await emailJobQueue.getJobBatches(job.id);
      
      let totalProcessed = 0;
      let totalFailed = 0;

      // Process each batch
      for (const batch of batches) {
        // Check rate limits before processing batch
        if (!await this.checkRateLimit(batch.leads_data.length)) {
          logger.warn(`Rate limit exceeded for worker ${this.workerId}`, {
            metadata: { workerId: this.workerId, batchId: batch.id }
          });
          
          // Wait and retry
          await this.sleep(60000); // Wait 1 minute
          continue;
        }

        const result = await this.processBatch(batch, job.payload);
        
        totalProcessed += result.successful_emails;
        totalFailed += result.failed_emails;

        // Update batch status
        await emailJobQueue.updateBatchStatus(
          batch.id,
          result.failed_emails === 0 ? 'completed' : 'failed',
          result.successful_emails,
          result.failed_emails,
          result.errors.length > 0 ? result.errors[0].error_message : undefined
        );

        // Update rate limit counters
        await this.updateRateLimit(result.successful_emails);
      }

      // Update job status
      await emailJobQueue.updateJobStatus(
        job.id,
        totalFailed === 0 ? 'completed' : 'failed',
        totalProcessed,
        totalFailed
      );

      // Complete job
      if (totalFailed === 0) {
        await emailJobQueue.completeJob(job.id, this.workerId);
      } else {
        await emailJobQueue.failJob(job.id, this.workerId, `Failed to send ${totalFailed} emails`);
      }

      // Update metrics
      const processingTime = Date.now() - startTime;
      await this.updateMetrics(totalProcessed, totalFailed, processingTime);

      logger.info(`Job ${job.id} completed`, {
        metadata: { 
          workerId: this.workerId,
          jobId: job.id,
          totalProcessed,
          totalFailed,
          processingTime 
        }
      });
    } catch (error) {
      logger.error(`Error processing job ${job.id}`, {
        metadata: { workerId: this.workerId, jobId: job.id }
      }, error as Error);

      await emailJobQueue.failJob(job.id, this.workerId, (error as Error).message);
    } finally {
      this.currentJob = null;
    }
  }

  /**
   * Process a batch of emails
   */
  private async processBatch(batch: EmailJobBatch, jobPayload: any): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    const errors: EmailError[] = [];

    // Update batch status to processing
    await emailJobQueue.updateBatchStatus(batch.id, 'processing');

    logger.info(`Processing batch ${batch.id}`, {
      metadata: { 
        workerId: this.workerId,
        batchId: batch.id,
        emailCount: batch.leads_data.length 
      }
    });

    // Process each lead in the batch
    for (const lead of batch.leads_data) {
      try {
        // Prepare email variables
        const variables = {
          name: lead.name || 'Cliente',
          email: lead.email,
          company: lead.company || '',
          position: lead.position || '',
          phone: lead.phone || '',
          ...lead.custom_fields,
        };

        // Replace variables in email content
        const subject = replaceEmailVariables(
          jobPayload.template_data.subject,
          variables
        );
        const htmlContent = replaceEmailVariables(
          jobPayload.template_data.html_content,
          variables
        );
        const textContent = jobPayload.template_data.text_content
          ? replaceEmailVariables(jobPayload.template_data.text_content, variables)
          : undefined;

        // Send email
        const emailResult = await sendEmail({
          to: [lead.email],
          subject,
          html: htmlContent,
          text: textContent,
          from: jobPayload.sender_info.from,
          replyTo: jobPayload.sender_info.reply_to,
          tags: jobPayload.tracking_config ? [
            { name: 'campaign_id', value: jobPayload.tracking_config.campaign_id },
            { name: 'workspace_id', value: jobPayload.tracking_config.workspace_id }
          ] : undefined
        });

        // Record email send status
        await this.supabase
          .from('email_sends')
          .insert({
            workspace_id: jobPayload.tracking_config?.workspace_id,
            campaign_id: jobPayload.campaign_id,
            lead_id: lead.id,
            email: lead.email,
            status: emailResult.success ? 'sent' : 'failed',
            resend_id: emailResult.id,
            sent_at: emailResult.success ? new Date().toISOString() : null,
            error_message: emailResult.error || null
          });

        if (emailResult.success) {
          successful++;
        } else {
          failed++;
          errors.push({
            lead_id: lead.id,
            email: lead.email,
            error_message: emailResult.error || 'Unknown error',
            timestamp: new Date()
          });
        }

        // Small delay to avoid overwhelming the email provider
        await this.sleep(100);
      } catch (error) {
        failed++;
        errors.push({
          lead_id: lead.id,
          email: lead.email,
          error_message: (error as Error).message,
          timestamp: new Date()
        });

        logger.error(`Error sending email to ${lead.email}`, {
          metadata: { workerId: this.workerId, leadId: lead.id }
        }, error as Error);
      }
    }

    const processingTime = Date.now() - startTime;

    logger.info(`Batch ${batch.id} processed`, {
      metadata: { 
        workerId: this.workerId,
        batchId: batch.id,
        successful,
        failed,
        processingTime 
      }
    });

    return {
      batch_id: batch.id,
      total_emails: batch.leads_data.length,
      successful_emails: successful,
      failed_emails: failed,
      processing_time: processingTime,
      errors
    };
  }

  /**
   * Register worker in database
   */
  private async registerWorker(): Promise<void> {
    const { error } = await this.supabase
      .from('email_workers')
      .upsert({
        id: this.workerId,
        name: this.workerName,
        status: 'idle',
        max_concurrent_jobs: this.config.max_batch_size,
        rate_limit_per_minute: 100,
        rate_limit_per_hour: 1000,
        performance_metrics: this.metrics,
        config: this.config,
        last_heartbeat: new Date().toISOString()
      });

    if (error) {
      logger.error(`Error registering worker ${this.workerId}`, {
        metadata: { workerId: this.workerId }
      }, error);
      throw error;
    }
  }

  /**
   * Update worker status
   */
  private async updateWorkerStatus(status: WorkerStatus): Promise<void> {
    const { error } = await this.supabase
      .from('email_workers')
      .update({
        status,
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', this.workerId);

    if (error) {
      logger.error(`Error updating worker status ${this.workerId}`, {
        metadata: { workerId: this.workerId, status }
      }, error);
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.updateWorkerStatus(this.currentJob ? 'busy' : 'idle');
      } catch (error) {
        logger.error(`Heartbeat error for worker ${this.workerId}`, {
          metadata: { workerId: this.workerId }
        }, error as Error);
      }
    }, this.config.health_check_interval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error(`Metrics collection error for worker ${this.workerId}`, {
          metadata: { workerId: this.workerId }
        }, error as Error);
      }
    }, 60000); // Every minute
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(emailCount: number): Promise<boolean> {
    try {
      const { data: minuteCheck } = await this.supabase
        .rpc('check_rate_limit', { 
          worker_id_param: this.workerId,
          window_type_param: 'minute'
        });

      const { data: hourCheck } = await this.supabase
        .rpc('check_rate_limit', { 
          worker_id_param: this.workerId,
          window_type_param: 'hour'
        });

      return minuteCheck && hourCheck;
    } catch (error) {
      logger.error(`Error checking rate limit for worker ${this.workerId}`, {
        metadata: { workerId: this.workerId }
      }, error as Error);
      return false;
    }
  }

  /**
   * Update rate limit counters
   */
  private async updateRateLimit(emailCount: number): Promise<void> {
    try {
      await this.supabase
        .rpc('increment_rate_limit', { 
          worker_id_param: this.workerId,
          window_type_param: 'minute',
          count_param: emailCount
        });

      await this.supabase
        .rpc('increment_rate_limit', { 
          worker_id_param: this.workerId,
          window_type_param: 'hour',
          count_param: emailCount
        });
    } catch (error) {
      logger.error(`Error updating rate limit for worker ${this.workerId}`, {
        metadata: { workerId: this.workerId }
      }, error as Error);
    }
  }

  /**
   * Update metrics
   */
  private async updateMetrics(successful: number, failed: number, processingTime: number): Promise<void> {
    try {
      // Update worker metrics
      await this.supabase
        .from('email_workers')
        .update({
          total_emails_sent: successful,
          total_errors: failed,
          performance_metrics: this.metrics,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.workerId);

      // Insert metric records
      const currentWindow = new Date();
      currentWindow.setMinutes(0, 0, 0); // Round to hour

      await this.supabase
        .from('worker_metrics')
        .insert([
          {
            worker_id: this.workerId,
            metric_type: 'throughput',
            metric_value: successful,
            time_window: currentWindow.toISOString()
          },
          {
            worker_id: this.workerId,
            metric_type: 'success_rate',
            metric_value: successful / (successful + failed) * 100,
            time_window: currentWindow.toISOString()
          },
          {
            worker_id: this.workerId,
            metric_type: 'response_time',
            metric_value: processingTime,
            time_window: currentWindow.toISOString()
          }
        ]);
    } catch (error) {
      logger.error(`Error updating metrics for worker ${this.workerId}`, {
        metadata: { workerId: this.workerId }
      }, error as Error);
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    // This would collect system metrics like CPU, memory, etc.
    // For now, we'll just update the heartbeat
    await this.updateWorkerStatus(this.currentJob ? 'busy' : 'idle');
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(): string {
    return `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export a factory function for creating workers
export function createEmailWorker(params: WorkerRegistrationParams): EmailWorkerInstance {
  return new EmailWorkerInstance(params);
}