import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { uploadService } from '@/lib/services/upload-service';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const createUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  file_size: z.number().min(1).max(104_857_600), // 100MB max
  file_type: z.string().min(1),
  upload_type: z.enum(['leads_import', 'template_assets', 'bulk_email_assets']),
  chunk_size: z.number().min(1024).max(1_048_576).optional(), // 1KB to 1MB
  validation_rules: z.object({
    required_fields: z.array(z.string()).optional(),
    email_validation: z.boolean().optional(),
    phone_validation: z.boolean().optional(),
    max_records: z.number().optional(),
    duplicate_handling: z.enum(['skip', 'overwrite', 'error']).optional()
  }).optional(),
  processing_config: z.record(z.any()).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const validatedData = createUploadSchema.parse(body);

    // Get authenticated user
    const supabaseClient = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      logger.warn('Unauthorized upload attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's workspace (assuming user has a default workspace)
    const { data: workspaceMember } = await supabaseClient
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!workspaceMember) {
      logger.warn('User has no workspace access');
      return NextResponse.json(
        { error: 'No workspace access' },
        { status: 403 }
      );
    }

    // Validate file type for upload type
    const allowedTypes = {
      leads_import: ['text/csv', 'application/csv', 'text/plain'],
      template_assets: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      bulk_email_assets: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/zip']
    };

    if (!allowedTypes[validatedData.upload_type].includes(validatedData.file_type)) {
      return NextResponse.json(
        { error: `File type ${validatedData.file_type} not allowed for ${validatedData.upload_type}` },
        { status: 400 }
      );
    }

    // Create upload job
    const uploadJob = await uploadService.createUploadJob(
      validatedData,
      user.id,
      workspaceMember.workspace_id
    );

    logger.info(`Upload job created: ${uploadJob.upload_job.id} for user: ${user.id}`);

    return NextResponse.json({
      success: true,
      data: uploadJob
    });

  } catch (error) {
    logger.error('Error creating upload job:', error);

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
      { error: 'Failed to create upload job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    // Get authenticated user
    const supabaseClient = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's upload jobs
    let query = supabaseClient
      .from('file_upload_jobs')
      .select(`
        *,
        upload_progress_events (
          event_type,
          message,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data: uploadJobs, error } = await query;

    if (error) {
      logger.error('Error fetching upload jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch upload jobs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: uploadJobs
    });

  } catch (error) {
    logger.error('Error fetching upload jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload jobs' },
      { status: 500 }
    );
  }
}