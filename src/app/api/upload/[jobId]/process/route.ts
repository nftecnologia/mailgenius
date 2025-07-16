import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { uploadService } from '@/lib/services/upload-service';
import { csvProcessor } from '@/lib/services/csv-processor';
import { logger } from '@/lib/logger';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const processUploadSchema = z.object({
  force_reprocess: z.boolean().optional(),
  batch_size: z.number().min(100).max(10000).optional(),
  csv_config: z.object({
    columns: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'email', 'phone', 'number', 'date', 'boolean']),
      required: z.boolean()
    })),
    field_mapping: z.record(z.string()),
    skip_header: z.boolean().optional(),
    delimiter: z.string().optional(),
    encoding: z.string().optional()
  }).optional(),
  import_config: z.object({
    duplicate_handling: z.enum(['skip', 'overwrite', 'error']).optional(),
    tag_new_leads: z.boolean().optional(),
    default_tags: z.array(z.string()).optional(),
    segment_id: z.string().optional(),
    source: z.string().optional(),
    custom_field_mapping: z.record(z.string()).optional()
  }).optional()
});

interface RouteParams {
  jobId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { jobId } = params;

    // Parse request body
    const body = await request.json();
    const validatedData = processUploadSchema.parse(body);

    // Get authenticated user
    const supabaseClient = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      logger.warn('Unauthorized process upload attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user owns this upload job
    const { data: uploadJob } = await supabaseClient
      .from('file_upload_jobs')
      .select('*')
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

    // Check if job is ready for processing
    if (uploadJob.status !== 'uploading' && uploadJob.status !== 'completed' && !validatedData.force_reprocess) {
      return NextResponse.json(
        { error: 'Upload job is not ready for processing' },
        { status: 400 }
      );
    }

    // Check if all chunks are uploaded
    const { data: chunks } = await supabaseClient
      .from('file_upload_chunks')
      .select('status')
      .eq('upload_job_id', jobId);

    if (!chunks || chunks.some(chunk => chunk.status !== 'uploaded')) {
      return NextResponse.json(
        { error: 'Not all chunks have been uploaded' },
        { status: 400 }
      );
    }

    // Start processing based on upload type
    let result;
    
    if (uploadJob.upload_type === 'leads_import') {
      if (!validatedData.csv_config || !validatedData.import_config) {
        return NextResponse.json(
          { error: 'CSV configuration and import configuration are required for leads import' },
          { status: 400 }
        );
      }

      // Process CSV file
      const csvConfig = {
        ...validatedData.csv_config,
        skip_header: validatedData.csv_config.skip_header ?? true,
        delimiter: validatedData.csv_config.delimiter ?? ',',
        encoding: validatedData.csv_config.encoding ?? 'utf8'
      };

      const importConfig = {
        duplicate_handling: validatedData.import_config.duplicate_handling ?? 'skip',
        tag_new_leads: validatedData.import_config.tag_new_leads ?? false,
        default_tags: validatedData.import_config.default_tags ?? [],
        source: validatedData.import_config.source ?? 'csv_import',
        custom_field_mapping: validatedData.import_config.custom_field_mapping ?? {}
      };

      // Start CSV processing (this would run in background)
      result = await this.processCSVAsync(jobId, csvConfig, importConfig);
    } else {
      // For other upload types, use the upload service
      result = await uploadService.startProcessing({
        upload_job_id: jobId,
        force_reprocess: validatedData.force_reprocess,
        batch_size: validatedData.batch_size
      });
    }

    logger.info(`Processing started for upload job ${jobId}`);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error processing upload:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
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

    // Get processing statistics
    const stats = await uploadService.getProcessingStats(jobId);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting processing status:', error);
    
    return NextResponse.json(
      { error: 'Failed to get processing status' },
      { status: 500 }
    );
  }
}

// Helper method to process CSV asynchronously
async function processCSVAsync(
  jobId: string,
  csvConfig: any,
  importConfig: any
): Promise<any> {
  // In a real implementation, this would:
  // 1. Reconstruct the file from chunks
  // 2. Start background processing
  // 3. Return immediately with job status
  
  // For now, we'll simulate the process
  const filePath = `/tmp/reconstructed_${jobId}.csv`;
  
  // This would run in a background worker/queue
  setTimeout(async () => {
    try {
      await csvProcessor.processCSVFile(
        jobId,
        filePath,
        csvConfig,
        importConfig
      );
    } catch (error) {
      logger.error(`Background CSV processing failed for job ${jobId}:`, error);
    }
  }, 100);

  return {
    processing_job_id: jobId,
    estimated_completion: new Date(Date.now() + 60000).toISOString(), // 1 minute estimate
    status: 'processing'
  };
}