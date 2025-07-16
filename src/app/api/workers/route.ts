// API Routes for Email Worker Management

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { emailWorkerManager } from '@/lib/email-workers/worker-manager';
import { emailWorkerMonitoring } from '@/lib/email-workers/monitoring';

export async function GET(request: NextRequest) {
  const context = logger.createRequestContext(request);
  
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    logger.api('Worker management request', 'GET', undefined, { 
      ...context, 
      metadata: { action } 
    });

    switch (action) {
      case 'stats':
        const stats = await emailWorkerManager.getSystemStats();
        return NextResponse.json({ success: true, data: stats });

      case 'health':
        const health = await emailWorkerMonitoring.getWorkerHealth();
        return NextResponse.json({ success: true, data: health });

      case 'metrics':
        const workerId = searchParams.get('worker_id');
        const metricType = searchParams.get('metric_type') as any;
        const startTime = searchParams.get('start_time') ? new Date(searchParams.get('start_time')!) : undefined;
        const endTime = searchParams.get('end_time') ? new Date(searchParams.get('end_time')!) : undefined;

        const metrics = await emailWorkerMonitoring.getPerformanceMetrics(
          workerId || undefined,
          metricType,
          startTime,
          endTime
        );
        return NextResponse.json({ success: true, data: metrics });

      case 'throughput':
        const hours = parseInt(searchParams.get('hours') || '24');
        const throughput = await emailWorkerMonitoring.getThroughputAnalytics(hours);
        return NextResponse.json({ success: true, data: throughput });

      case 'alerts':
        const alerts = await emailWorkerMonitoring.checkPerformanceAlerts();
        return NextResponse.json({ success: true, data: alerts });

      case 'worker-stats':
        const workerStatsId = searchParams.get('worker_id');
        if (!workerStatsId) {
          return NextResponse.json(
            { error: 'Worker ID is required for worker-stats' },
            { status: 400 }
          );
        }
        const workerStats = await emailWorkerMonitoring.getWorkerStatistics(workerStatsId);
        return NextResponse.json({ success: true, data: workerStats });

      default:
        // List all workers
        const supabase = createSupabaseServerClient();
        const { data: workers, error } = await supabase
          .from('email_workers')
          .select('*')
          .order('created_at');

        if (error) {
          logger.error('Error fetching workers', context, error);
          return NextResponse.json(
            { error: 'Failed to fetch workers' },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          success: true, 
          data: workers || [],
          active_workers: emailWorkerManager.getWorkerCount(),
          active_worker_ids: emailWorkerManager.getActiveWorkerIds()
        });
    }
  } catch (error) {
    logger.error('Error in worker management API', context, error as Error);
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

    logger.api('Worker management action', 'POST', undefined, { 
      ...context, 
      metadata: { action } 
    });

    switch (action) {
      case 'start':
        await emailWorkerManager.start();
        return NextResponse.json({ 
          success: true, 
          message: 'Worker manager started successfully' 
        });

      case 'stop':
        await emailWorkerManager.stop();
        return NextResponse.json({ 
          success: true, 
          message: 'Worker manager stopped successfully' 
        });

      case 'scale':
        const { target_workers } = body;
        if (!target_workers || target_workers < 1 || target_workers > 20) {
          return NextResponse.json(
            { error: 'target_workers must be between 1 and 20' },
            { status: 400 }
          );
        }
        await emailWorkerManager.scaleWorkers(target_workers);
        return NextResponse.json({ 
          success: true, 
          message: `Scaled to ${target_workers} workers` 
        });

      case 'create-job':
        const { 
          workspace_id, 
          campaign_id, 
          priority, 
          job_type, 
          leads, 
          template_data,
          sender_info,
          tracking_config,
          batch_size,
          max_retries,
          scheduled_at
        } = body;

        if (!workspace_id || !campaign_id || !job_type || !leads || !template_data || !sender_info) {
          return NextResponse.json(
            { error: 'Missing required fields for job creation' },
            { status: 400 }
          );
        }

        const jobId = await emailWorkerManager.createCampaignJob({
          workspace_id,
          campaign_id,
          priority,
          job_type,
          payload: {
            campaign_id,
            leads,
            template_data,
            sender_info,
            tracking_config
          },
          batch_size,
          max_retries,
          scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined
        });

        return NextResponse.json({ 
          success: true, 
          job_id: jobId,
          message: 'Job created successfully' 
        });

      case 'record-metric':
        const { worker_id, metric_type, value, metadata } = body;
        
        if (!worker_id || !metric_type || value === undefined) {
          return NextResponse.json(
            { error: 'worker_id, metric_type, and value are required' },
            { status: 400 }
          );
        }

        await emailWorkerMonitoring.recordMetric(worker_id, metric_type, value, metadata);
        return NextResponse.json({ 
          success: true, 
          message: 'Metric recorded successfully' 
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error in worker management POST API', context, error as Error);
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
    const workerId = searchParams.get('worker_id');

    if (!workerId) {
      return NextResponse.json(
        { error: 'Worker ID is required' },
        { status: 400 }
      );
    }

    logger.api('Worker deletion request', 'DELETE', undefined, { 
      ...context, 
      metadata: { workerId } 
    });

    // Mark worker as offline in database
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from('email_workers')
      .update({ status: 'offline' })
      .eq('id', workerId);

    if (error) {
      logger.error('Error marking worker as offline', context, error);
      return NextResponse.json(
        { error: 'Failed to remove worker' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Worker removed successfully' 
    });
  } catch (error) {
    logger.error('Error in worker deletion API', context, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}