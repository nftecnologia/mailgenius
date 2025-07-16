// Email Retry System - Handles failed email retries with exponential backoff

import { createSupabaseServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { sendEmail, replaceEmailVariables } from '@/lib/resend';
import { EmailRetryJob, RetryStatus } from './types';

export class EmailRetrySystem {
  private supabase = createSupabaseServerClient();
  private isRunning: boolean = false;
  private retryInterval: NodeJS.Timeout | null = null;
  private retryCheckInterval: number = 60000; // 1 minute

  /**
   * Start the retry system
   */
  async start(): Promise<void> {
    try {
      this.isRunning = true;
      
      logger.info('Starting Email Retry System');
      
      // Start retry processing loop
      this.startRetryLoop();
      
      logger.info('Email Retry System started successfully');
    } catch (error) {
      logger.error('Failed to start Email Retry System', {}, error as Error);
      throw error;
    }
  }

  /**
   * Stop the retry system
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.retryInterval) {
        clearInterval(this.retryInterval);
      }
      
      logger.info('Email Retry System stopped');
    } catch (error) {
      logger.error('Error stopping Email Retry System', {}, error as Error);
    }
  }

  /**
   * Create a retry job for a failed email
   */
  async createRetryJob(params: {
    original_job_id: string;
    email_send_id: string;
    max_retries?: number;
    delay_seconds?: number;
  }): Promise<string> {
    try {
      const {
        original_job_id,
        email_send_id,
        max_retries = 3,
        delay_seconds = 300 // 5 minutes default
      } = params;

      const nextRetryAt = new Date();
      nextRetryAt.setSeconds(nextRetryAt.getSeconds() + delay_seconds);

      const { data: retryJob, error } = await this.supabase
        .from('email_retry_jobs')
        .insert({
          original_job_id,
          email_send_id,
          max_retries,
          next_retry_at: nextRetryAt.toISOString(),
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Error creating retry job', {
          metadata: { original_job_id, email_send_id }
        }, error);
        throw error;
      }

      logger.info('Retry job created', {
        metadata: { 
          retryJobId: retryJob.id,
          originalJobId: original_job_id,
          nextRetryAt: nextRetryAt.toISOString()
        }
      });

      return retryJob.id;
    } catch (error) {
      logger.error('Error creating retry job', {
        metadata: { original_job_id: params.original_job_id }
      }, error as Error);
      throw error;
    }
  }

  /**
   * Process retry jobs
   */
  private async processRetryJobs(): Promise<void> {
    try {
      // Get retry jobs that are ready to be processed
      const { data: retryJobs, error } = await this.supabase
        .from('email_retry_jobs')
        .select(`
          *,
          email_sends (
            id,
            email,
            workspace_id,
            campaign_id,
            lead_id,
            error_message
          )
        `)
        .eq('status', 'pending')
        .lt('next_retry_at', new Date().toISOString())
        .order('next_retry_at')
        .limit(50); // Process up to 50 retry jobs at once

      if (error) {
        logger.error('Error fetching retry jobs', {}, error);
        return;
      }

      if (!retryJobs || retryJobs.length === 0) {
        return;
      }

      logger.info(`Processing ${retryJobs.length} retry jobs`);

      // Process each retry job
      for (const retryJob of retryJobs) {
        await this.processRetryJob(retryJob);
      }
    } catch (error) {
      logger.error('Error processing retry jobs', {}, error as Error);
    }
  }

  /**
   * Process a single retry job
   */
  private async processRetryJob(retryJob: any): Promise<void> {
    try {
      // Mark as processing
      await this.updateRetryJobStatus(retryJob.id, 'processing');

      // Get original job and email details
      const { data: originalJob, error: jobError } = await this.supabase
        .from('email_jobs')
        .select('*')
        .eq('id', retryJob.original_job_id)
        .single();

      if (jobError || !originalJob) {
        logger.error('Original job not found for retry', {
          metadata: { retryJobId: retryJob.id, originalJobId: retryJob.original_job_id }
        });
        await this.updateRetryJobStatus(retryJob.id, 'failed', 'Original job not found');
        return;
      }

      // Get lead details
      const { data: lead, error: leadError } = await this.supabase
        .from('leads')
        .select('*')
        .eq('id', retryJob.email_sends.lead_id)
        .single();

      if (leadError || !lead) {
        logger.error('Lead not found for retry', {
          metadata: { retryJobId: retryJob.id, leadId: retryJob.email_sends.lead_id }
        });
        await this.updateRetryJobStatus(retryJob.id, 'failed', 'Lead not found');
        return;
      }

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
        originalJob.payload.template_data.subject,
        variables
      );
      const htmlContent = replaceEmailVariables(
        originalJob.payload.template_data.html_content,
        variables
      );
      const textContent = originalJob.payload.template_data.text_content
        ? replaceEmailVariables(originalJob.payload.template_data.text_content, variables)
        : undefined;

      // Attempt to send email
      const emailResult = await sendEmail({
        to: [lead.email],
        subject,
        html: htmlContent,
        text: textContent,
        from: originalJob.payload.sender_info.from,
        replyTo: originalJob.payload.sender_info.reply_to,
        tags: originalJob.payload.tracking_config ? [
          { name: 'campaign_id', value: originalJob.payload.tracking_config.campaign_id },
          { name: 'workspace_id', value: originalJob.payload.tracking_config.workspace_id },
          { name: 'retry_attempt', value: (retryJob.retry_count + 1).toString() }
        ] : undefined
      });

      if (emailResult.success) {
        // Update email send record
        await this.supabase
          .from('email_sends')
          .update({
            status: 'sent',
            resend_id: emailResult.id,
            sent_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', retryJob.email_send_id);

        // Mark retry job as completed
        await this.updateRetryJobStatus(retryJob.id, 'completed');

        logger.info('Email retry successful', {
          metadata: { 
            retryJobId: retryJob.id,
            email: lead.email,
            attempt: retryJob.retry_count + 1
          }
        });
      } else {
        // Retry failed
        await this.handleRetryFailure(retryJob, emailResult.error || 'Unknown error');
      }
    } catch (error) {
      logger.error('Error processing retry job', {
        metadata: { retryJobId: retryJob.id }
      }, error as Error);
      
      await this.handleRetryFailure(retryJob, (error as Error).message);
    }
  }

  /**
   * Handle retry failure
   */
  private async handleRetryFailure(retryJob: any, errorMessage: string): Promise<void> {
    try {
      const newRetryCount = retryJob.retry_count + 1;

      if (newRetryCount >= retryJob.max_retries) {
        // Max retries reached, abandon
        await this.updateRetryJobStatus(retryJob.id, 'abandoned', errorMessage);
        
        // Update email send record as permanently failed
        await this.supabase
          .from('email_sends')
          .update({
            status: 'failed',
            error_message: `Failed after ${retryJob.max_retries} retry attempts: ${errorMessage}`
          })
          .eq('id', retryJob.email_send_id);

        logger.warn('Email retry abandoned after max attempts', {
          metadata: { 
            retryJobId: retryJob.id,
            maxRetries: retryJob.max_retries,
            errorMessage
          }
        });
      } else {
        // Schedule next retry with exponential backoff
        const delaySeconds = this.calculateRetryDelay(newRetryCount);
        const nextRetryAt = new Date();
        nextRetryAt.setSeconds(nextRetryAt.getSeconds() + delaySeconds);

        await this.supabase
          .from('email_retry_jobs')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            next_retry_at: nextRetryAt.toISOString(),
            error_message: errorMessage
          })
          .eq('id', retryJob.id);

        logger.info('Email retry scheduled', {
          metadata: { 
            retryJobId: retryJob.id,
            attempt: newRetryCount + 1,
            nextRetryAt: nextRetryAt.toISOString(),
            delaySeconds
          }
        });
      }
    } catch (error) {
      logger.error('Error handling retry failure', {
        metadata: { retryJobId: retryJob.id }
      }, error as Error);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 5min, 15min, 45min, 135min, etc.
    const baseDelay = 300; // 5 minutes
    const multiplier = 3;
    const maxDelay = 7200; // 2 hours
    
    const delay = baseDelay * Math.pow(multiplier, retryCount - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Update retry job status
   */
  private async updateRetryJobStatus(
    retryJobId: string,
    status: RetryStatus,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status
      };

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await this.supabase
        .from('email_retry_jobs')
        .update(updateData)
        .eq('id', retryJobId);

      if (error) {
        logger.error('Error updating retry job status', {
          metadata: { retryJobId, status }
        }, error);
      }
    } catch (error) {
      logger.error('Error updating retry job status', {
        metadata: { retryJobId, status }
      }, error as Error);
    }
  }

  /**
   * Start retry processing loop
   */
  private startRetryLoop(): void {
    this.retryInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.processRetryJobs();
      }
    }, this.retryCheckInterval);
  }

  /**
   * Get retry statistics
   */
  async getRetryStats(): Promise<{
    total_retries: number;
    pending_retries: number;
    processing_retries: number;
    completed_retries: number;
    failed_retries: number;
    abandoned_retries: number;
    success_rate: number;
  }> {
    try {
      const { data: retryJobs, error } = await this.supabase
        .from('email_retry_jobs')
        .select('status');

      if (error) {
        logger.error('Error fetching retry stats', {}, error);
        return {
          total_retries: 0,
          pending_retries: 0,
          processing_retries: 0,
          completed_retries: 0,
          failed_retries: 0,
          abandoned_retries: 0,
          success_rate: 0
        };
      }

      const stats = {
        total_retries: retryJobs.length,
        pending_retries: retryJobs.filter(r => r.status === 'pending').length,
        processing_retries: retryJobs.filter(r => r.status === 'processing').length,
        completed_retries: retryJobs.filter(r => r.status === 'completed').length,
        failed_retries: retryJobs.filter(r => r.status === 'failed').length,
        abandoned_retries: retryJobs.filter(r => r.status === 'abandoned').length,
        success_rate: 0
      };

      if (stats.total_retries > 0) {
        stats.success_rate = (stats.completed_retries / stats.total_retries) * 100;
      }

      return stats;
    } catch (error) {
      logger.error('Error getting retry stats', {}, error as Error);
      return {
        total_retries: 0,
        pending_retries: 0,
        processing_retries: 0,
        completed_retries: 0,
        failed_retries: 0,
        abandoned_retries: 0,
        success_rate: 0
      };
    }
  }

  /**
   * Cleanup old retry jobs
   */
  async cleanupOldRetryJobs(olderThanDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { error } = await this.supabase
        .from('email_retry_jobs')
        .delete()
        .in('status', ['completed', 'failed', 'abandoned'])
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        logger.error('Error cleaning up old retry jobs', {
          metadata: { olderThanDays }
        }, error);
      } else {
        logger.info('Old retry jobs cleaned up successfully', {
          metadata: { olderThanDays }
        });
      }
    } catch (error) {
      logger.error('Error in cleanupOldRetryJobs', {
        metadata: { olderThanDays }
      }, error as Error);
    }
  }
}

// Export singleton instance
export const emailRetrySystem = new EmailRetrySystem();