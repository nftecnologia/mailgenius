import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/services/upload-service';
import { logger } from '@/lib/logger';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface RouteParams {
  jobId: string;
  chunkIndex: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { jobId, chunkIndex } = params;
    const chunkIndexNum = parseInt(chunkIndex, 10);

    if (isNaN(chunkIndexNum) || chunkIndexNum < 0) {
      return NextResponse.json(
        { error: 'Invalid chunk index' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabaseClient = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      logger.warn('Unauthorized chunk upload attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user owns this upload job
    const { data: uploadJob } = await supabaseClient
      .from('file_upload_jobs')
      .select('id, user_id, status')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (!uploadJob) {
      logger.warn(`Upload job ${jobId} not found for user ${user.id}`);
      return NextResponse.json(
        { error: 'Upload job not found' },
        { status: 404 }
      );
    }

    if (uploadJob.status !== 'pending' && uploadJob.status !== 'uploading') {
      return NextResponse.json(
        { error: 'Upload job is not in uploadable state' },
        { status: 400 }
      );
    }

    // Get chunk data from request
    const arrayBuffer = await request.arrayBuffer();
    
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'Chunk data is empty' },
        { status: 400 }
      );
    }

    // Get chunk hash from header if provided
    const chunkHash = request.headers.get('x-chunk-hash') || undefined;

    // Upload chunk
    const result = await uploadService.uploadChunk({
      upload_job_id: jobId,
      chunk_index: chunkIndexNum,
      chunk_data: arrayBuffer,
      chunk_hash: chunkHash
    });

    logger.info(`Chunk ${chunkIndexNum} uploaded for job ${jobId}`);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error uploading chunk:', error);
    
    return NextResponse.json(
      { error: 'Failed to upload chunk' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { jobId, chunkIndex } = params;
    const chunkIndexNum = parseInt(chunkIndex, 10);

    if (isNaN(chunkIndexNum) || chunkIndexNum < 0) {
      return NextResponse.json(
        { error: 'Invalid chunk index' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabaseClient = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get chunk status
    const { data: chunk, error } = await supabaseClient
      .from('file_upload_chunks')
      .select('*')
      .eq('upload_job_id', jobId)
      .eq('chunk_index', chunkIndexNum)
      .single();

    if (error || !chunk) {
      logger.warn(`Chunk ${chunkIndexNum} not found for job ${jobId}`);
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    // Verify user owns this upload job
    const { data: uploadJob } = await supabaseClient
      .from('file_upload_jobs')
      .select('user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (!uploadJob) {
      return NextResponse.json(
        { error: 'Upload job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: chunk
    });

  } catch (error) {
    logger.error('Error getting chunk status:', error);
    
    return NextResponse.json(
      { error: 'Failed to get chunk status' },
      { status: 500 }
    );
  }
}