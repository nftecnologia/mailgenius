// API Routes for Email Job Management

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { emailJobQueue } from '@/lib/email-workers/job-queue';
import { emailRetrySystem } from '@/lib/email-workers/retry-system';

export async function GET(request: NextRequest) {
  const context = logger.createRequestContext(request);
  
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const workspaceId = searchParams.get('workspace_id');

    logger.api('Job management request', 'GET', undefined, { 
      ...context, 
      metadata: { action, workspaceId } 
    });

    const supabase = createSupabaseServerClient();

    switch (action) {
      case 'stats':
        const stats = await emailJobQueue.getJobStats(workspaceId || undefined);
        return NextResponse.json({ success: true, data: stats });

      case 'retry-stats':
        const retryStats = await emailRetrySystem.getRetryStats();
        return NextResponse.json({ success: true, data: retryStats });

      case 'batches':
        const jobId = searchParams.get('job_id');
        if (!jobId) {
          return NextResponse.json(
            { error: 'Job ID is required for batches' },
            { status: 400 }
          );
        }
        const batches = await emailJobQueue.getJobBatches(jobId);
        return NextResponse.json({ success: true, data: batches });

      case 'recent':
        const limit = parseInt(searchParams.get('limit') || '20');
        let jobsQuery = supabase
          .from('email_jobs')
          .select(`
            *,
            campaigns (name, subject)
          `)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (workspaceId) {
          jobsQuery = jobsQuery.eq('workspace_id', workspaceId);
        }

        const { data: recentJobs, error: recentError } = await jobsQuery;

        if (recentError) {
          logger.error('Error fetching recent jobs', context, recentError);
          return NextResponse.json(
            { error: 'Failed to fetch recent jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, data: recentJobs });

      case 'pending':
        let pendingQuery = supabase
          .from('email_jobs')
          .select(`
            *,
            campaigns (name, subject)
          `)
          .eq('status', 'pending')
          .order('priority', { ascending: false })
          .order('created_at');

        if (workspaceId) {
          pendingQuery = pendingQuery.eq('workspace_id', workspaceId);
        }

        const { data: pendingJobs, error: pendingError } = await pendingQuery;

        if (pendingError) {
          logger.error('Error fetching pending jobs', context, pendingError);
          return NextResponse.json(
            { error: 'Failed to fetch pending jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, data: pendingJobs });

      case 'processing':
        let processingQuery = supabase
          .from('email_jobs')
          .select(`
            *,
            campaigns (name, subject),
            email_workers (name, status)
          `)
          .eq('status', 'processing')
          .order('started_at');

        if (workspaceId) {
          processingQuery = processingQuery.eq('workspace_id', workspaceId);
        }

        const { data: processingJobs, error: processingError } = await processingQuery;

        if (processingError) {
          logger.error('Error fetching processing jobs', context, processingError);
          return NextResponse.json(
            { error: 'Failed to fetch processing jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, data: processingJobs });

      case 'failed':
        let failedQuery = supabase
          .from('email_jobs')
          .select(`
            *,
            campaigns (name, subject)
          `)
          .eq('status', 'failed')
          .order('failed_at', { ascending: false })
          .limit(50);

        if (workspaceId) {
          failedQuery = failedQuery.eq('workspace_id', workspaceId);
        }

        const { data: failedJobs, error: failedError } = await failedQuery;

        if (failedError) {
          logger.error('Error fetching failed jobs', context, failedError);
          return NextResponse.json(
            { error: 'Failed to fetch failed jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, data: failedJobs });

      case 'retries':
        let retriesQuery = supabase
          .from('email_retry_jobs')
          .select(`
            *,
            email_sends (
              email,
              lead_id,
              campaigns (name)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        const { data: retryJobs, error: retryError } = await retriesQuery;

        if (retryError) {
          logger.error('Error fetching retry jobs', context, retryError);
          return NextResponse.json(
            { error: 'Failed to fetch retry jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, data: retryJobs });

      default:
        // List all jobs with pagination
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('page_size') || '20');
        const offset = (page - 1) * pageSize;

        let query = supabase
          .from('email_jobs')
          .select(`
            *,
            campaigns (name, subject)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (workspaceId) {
          query = query.eq('workspace_id', workspaceId);
        }

        const { data: jobs, error, count } = await query;

        if (error) {
          logger.error('Error fetching jobs', context, error);
          return NextResponse.json(
            { error: 'Failed to fetch jobs' },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          success: true, 
          data: jobs || [],
          pagination: {
            page,
            page_size: pageSize,
            total: count || 0,
            total_pages: Math.ceil((count || 0) / pageSize)
          }
        });
    }
  } catch (error) {
    logger.error('Error in job management API', context, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = logger.createRequestContext(request);
  
  try {
    const body = await request.json();
    const { action } = body;

    logger.api('Job management action', 'POST', undefined, { 
      ...context, 
      metadata: { action } 
    });

    switch (action) {
      case 'retry':
        const { job_id } = body;
        if (!job_id) {
          return NextResponse.json(
            { error: 'Job ID is required for retry' },
            { status: 400 }
          );
        }

        // Update job status to retrying
        await emailJobQueue.updateJobStatus(job_id, 'retrying');
        
        return NextResponse.json({ 
          success: true, 
          message: 'Job marked for retry' 
        });

      case 'cancel':
        const { job_id: cancelJobId } = body;
        if (!cancelJobId) {
          return NextResponse.json(
            { error: 'Job ID is required for cancellation' },
            { status: 400 }
          );
        }

        // Update job status to cancelled
        await emailJobQueue.updateJobStatus(cancelJobId, 'failed', undefined, undefined, 'Cancelled by user');
        
        return NextResponse.json({ 
          success: true, 
          message: 'Job cancelled successfully' 
        });

      case 'create-retry':
        const { 
          original_job_id, 
          email_send_id, 
          max_retries, 
          delay_seconds 
        } = body;

        if (!original_job_id || !email_send_id) {
          return NextResponse.json(
            { error: 'original_job_id and email_send_id are required' },
            { status: 400 }
          );
        }

        const retryJobId = await emailRetrySystem.createRetryJob({
          original_job_id,
          email_send_id,
          max_retries,
          delay_seconds
        });

        return NextResponse.json({ 
          success: true, 
          retry_job_id: retryJobId,
          message: 'Retry job created successfully' 
        });

      case 'reschedule':
        const { job_id: rescheduleJobId, scheduled_at } = body;
        
        if (!rescheduleJobId || !scheduled_at) {
          return NextResponse.json(
            { error: 'job_id and scheduled_at are required' },
            { status: 400 }
          );
        }

        const supabase = createSupabaseServerClient();
        const { error: rescheduleError } = await supabase
          .from('email_jobs')
          .update({
            scheduled_at: new Date(scheduled_at).toISOString(),
            status: 'pending'
          })
          .eq('id', rescheduleJobId);

        if (rescheduleError) {
          logger.error('Error rescheduling job', context, rescheduleError);
          return NextResponse.json(
            { error: 'Failed to reschedule job' },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Job rescheduled successfully' 
        });

      case 'cleanup':
        const { older_than_days } = body;
        const days = older_than_days || 30;

        await emailJobQueue.cleanupOldJobs(days);
        await emailRetrySystem.cleanupOldRetryJobs(days);

        return NextResponse.json({ 
          success: true, 
          message: `Cleaned up jobs older than ${days} days` 
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error in job management POST API', context, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const context = logger.createRequestContext(request);
  
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    logger.api('Job deletion request', 'DELETE', undefined, { 
      ...context, 
      metadata: { jobId } 
    });

    const supabase = createSupabaseServerClient();
    
    // Only allow deletion of failed or completed jobs
    const { data: job, error: fetchError } = await supabase
      .from('email_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status === 'processing') {
      return NextResponse.json(
        { error: 'Cannot delete a job that is currently processing' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('email_jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      logger.error('Error deleting job', context, error);
      return NextResponse.json(
        { error: 'Failed to delete job' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Job deleted successfully' 
    });
  } catch (error) {
    logger.error('Error in job deletion API', context, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}