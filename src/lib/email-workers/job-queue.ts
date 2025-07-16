// Email Job Queue Management

import { createSupabaseServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { 
  EmailJob, 
  JobCreationParams, 
  JobStatus, 
  JobPayload,
  Lead,
  EmailJobBatch,
  BatchStatus 
} from './types';

export class EmailJobQueue {
  private supabase = createSupabaseServerClient();

  /**
   * Create a new email job
   */
  async createJob(params: JobCreationParams): Promise<string> {
    try {
      const {
        workspace_id,
        campaign_id,
        priority = 0,
        job_type,
        payload,
        batch_size = 100,
        max_retries = 3,
        scheduled_at
      } = params;

      // Validate payload
      if (!payload.leads || payload.leads.length === 0) {
        throw new Error('Job payload must contain at least one lead');
      }

      // Create the job
      const { data: job, error } = await this.supabase
        .from('email_jobs')
        .insert({
          workspace_id,
          campaign_id,
          priority,
          status: 'pending',
          job_type,
          payload,
          batch_size,
          total_emails: payload.leads.length,
          max_retries,
          scheduled_at: scheduled_at?.toISOString()
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to create email job', {}, error);
        throw error;
      }

      // Create batches for the job
      await this.createJobBatches(job.id, payload.leads, batch_size);

      logger.info('Email job created successfully', {
        metadata: {
          jobId: job.id,
          campaignId: campaign_id,
          totalEmails: payload.leads.length,
          batchSize: batch_size
        }
      });

      return job.id;
    } catch (error) {
      logger.error('Error creating email job', {}, error as Error);
      throw error;
    }
  }

  /**
   * Get next job for a worker
   */
  async getNextJob(workerId: string): Promise<EmailJob | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_next_job_for_worker', { worker_id_param: workerId });

      if (error) {
        logger.error('Error getting next job for worker', {
          metadata: { workerId }
        }, error);
        return null;
      }

      if (!data) {
        return null;
      }

      // Get the full job details
      const { data: job, error: jobError } = await this.supabase
        .from('email_jobs')
        .select('*')
        .eq('id', data)
        .single();

      if (jobError) {
        logger.error('Error fetching job details', {
          metadata: { jobId: data }
        }, jobError);
        return null;
      }

      return job;
    } catch (error) {
      logger.error('Error in getNextJob', {
        metadata: { workerId }
      }, error as Error);
      return null;
    }
  }

  /**
   * Get job batches for processing
   */
  async getJobBatches(jobId: string): Promise<EmailJobBatch[]> {
    try {
      const { data: batches, error } = await this.supabase
        .from('email_job_batches')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'pending')
        .order('batch_number');

      if (error) {
        logger.error('Error fetching job batches', {
          metadata: { jobId }
        }, error);
        return [];
      }

      return batches || [];
    } catch (error) {
      logger.error('Error in getJobBatches', {
        metadata: { jobId }
      }, error as Error);
      return [];
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    processedEmails?: number,
    failedEmails?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (processedEmails !== undefined) {
        updateData.processed_emails = processedEmails;
      }

      if (failedEmails !== undefined) {
        updateData.failed_emails = failedEmails;
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (status === 'failed') {
        updateData.failed_at = new Date().toISOString();
      }

      const { error } = await this.supabase
        .from('email_jobs')
        .update(updateData)
        .eq('id', jobId);

      if (error) {
        logger.error('Error updating job status', {
          metadata: { jobId, status }
        }, error);
        throw error;
      }
    } catch (error) {
      logger.error('Error in updateJobStatus', {
        metadata: { jobId, status }
      }, error as Error);
      throw error;
    }
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    emailsSent?: number,
    emailsFailed?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (emailsSent !== undefined) {
        updateData.emails_sent = emailsSent;
      }

      if (emailsFailed !== undefined) {
        updateData.emails_failed = emailsFailed;
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      if (status === 'processing') {
        updateData.started_at = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await this.supabase
        .from('email_job_batches')
        .update(updateData)
        .eq('id', batchId);

      if (error) {
        logger.error('Error updating batch status', {
          metadata: { batchId, status }
        }, error);
        throw error;
      }
    } catch (error) {
      logger.error('Error in updateBatchStatus', {
        metadata: { batchId, status }
      }, error as Error);
      throw error;
    }
  }

  /**
   * Complete job
   */
  async completeJob(jobId: string, workerId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('complete_job', { 
          job_id_param: jobId, 
          worker_id_param: workerId 
        });

      if (error) {
        logger.error('Error completing job', {
          metadata: { jobId, workerId }
        }, error);
        throw error;
      }

      logger.info('Job completed successfully', {
        metadata: { jobId, workerId }
      });
    } catch (error) {
      logger.error('Error in completeJob', {
        metadata: { jobId, workerId }
      }, error as Error);
      throw error;
    }
  }

  /**
   * Fail job
   */
  async failJob(jobId: string, workerId: string, errorMessage: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('fail_job', { 
          job_id_param: jobId, 
          worker_id_param: workerId,
          error_msg: errorMessage
        });

      if (error) {
        logger.error('Error failing job', {
          metadata: { jobId, workerId }
        }, error);
        throw error;
      }

      logger.warn('Job failed', {
        metadata: { jobId, workerId, errorMessage }
      });
    } catch (error) {
      logger.error('Error in failJob', {
        metadata: { jobId, workerId }
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  async getJobStats(workspaceId?: string): Promise<any> {
    try {
      let query = this.supabase
        .from('email_jobs')
        .select('status, created_at, total_emails, processed_emails, failed_emails');

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { data: jobs, error } = await query;

      if (error) {
        logger.error('Error fetching job stats', {
          metadata: { workspaceId }
        }, error);
        return null;
      }

      // Calculate statistics
      const stats = {
        total_jobs: jobs.length,
        pending_jobs: jobs.filter(j => j.status === 'pending').length,
        processing_jobs: jobs.filter(j => j.status === 'processing').length,
        completed_jobs: jobs.filter(j => j.status === 'completed').length,
        failed_jobs: jobs.filter(j => j.status === 'failed').length,
        total_emails: jobs.reduce((sum, j) => sum + j.total_emails, 0),
        processed_emails: jobs.reduce((sum, j) => sum + j.processed_emails, 0),
        failed_emails: jobs.reduce((sum, j) => sum + j.failed_emails, 0)
      };

      return stats;
    } catch (error) {
      logger.error('Error in getJobStats', {
        metadata: { workspaceId }
      }, error as Error);
      return null;
    }
  }

  /**
   * Create job batches
   */
  private async createJobBatches(jobId: string, leads: Lead[], batchSize: number): Promise<void> {
    const batches = [];
    let batchNumber = 1;

    for (let i = 0; i < leads.length; i += batchSize) {
      const batchLeads = leads.slice(i, i + batchSize);
      batches.push({
        job_id: jobId,
        batch_number: batchNumber++,
        leads_data: batchLeads,
        status: 'pending' as BatchStatus
      });
    }

    const { error } = await this.supabase
      .from('email_job_batches')
      .insert(batches);

    if (error) {
      logger.error('Error creating job batches', {
        metadata: { jobId, batchCount: batches.length }
      }, error);
      throw error;
    }
  }

  /**
   * Cleanup old completed/failed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { error } = await this.supabase
        .from('email_jobs')
        .delete()
        .in('status', ['completed', 'failed'])
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        logger.error('Error cleaning up old jobs', {
          metadata: { olderThanDays }
        }, error);
      } else {
        logger.info('Old jobs cleaned up successfully', {
          metadata: { olderThanDays }
        });
      }
    } catch (error) {
      logger.error('Error in cleanupOldJobs', {
        metadata: { olderThanDays }
      }, error as Error);
    }
  }
}

export const emailJobQueue = new EmailJobQueue();