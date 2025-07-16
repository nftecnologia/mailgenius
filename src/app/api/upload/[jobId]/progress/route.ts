import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/services/upload-service';
import { logger } from '@/lib/logger';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface RouteParams {
  jobId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { jobId } = params;

    // Get authenticated user
    const supabaseClient = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user owns this upload job
    const { data: uploadJob } = await supabaseClient
      .from('file_upload_jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (!uploadJob) {
      return NextResponse.json(
        { error: 'Upload job not found' },
        { status: 404 }
      );
    }

    // Get upload progress
    const progress = await uploadService.getUploadProgress(jobId);

    return NextResponse.json({
      success: true,
      data: progress
    });

  } catch (error) {
    logger.error('Error getting upload progress:', error);
    
    return NextResponse.json(
      { error: 'Failed to get upload progress' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { jobId } = params;
    const { action } = await request.json();

    // Get authenticated user
    const supabaseClient = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user owns this upload job
    const { data: uploadJob } = await supabaseClient
      .from('file_upload_jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (!uploadJob) {
      return NextResponse.json(
        { error: 'Upload job not found' },
        { status: 404 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'cancel':
        await uploadService.cancelUpload(jobId);
        break;
      
      case 'retry':
        // Retry failed chunks
        await retryFailedChunks(supabaseClient, jobId);
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Action ${action} completed successfully`
    });

  } catch (error) {
    logger.error('Error handling upload action:', error);
    
    return NextResponse.json(
      { error: 'Failed to handle upload action' },
      { status: 500 }
    );
  }
}

async function retryFailedChunks(supabaseClient: any, jobId: string) {
  // Reset failed chunks to pending status
  const { error } = await supabaseClient
    .from('file_upload_chunks')
    .update({
      status: 'pending',
      error_message: null,
      retry_count: 0
    })
    .eq('upload_job_id', jobId)
    .eq('status', 'failed');

  if (error) {
    throw new Error('Failed to retry failed chunks');
  }

  // Update job status back to pending
  await supabaseClient
    .from('file_upload_jobs')
    .update({
      status: 'pending',
      error_message: null
    })
    .eq('id', jobId);
}