import { NextRequest, NextResponse } from 'next/server';
import { uploadService } from '@/lib/services/upload-service';
import { logger } from '@/lib/logger';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabaseClient = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin access (simplified check)
    const { data: userRole } = await supabaseClient
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    let data;
    switch (action) {
      case 'health':
        data = await uploadService.getSystemHealth();
        break;
      
      case 'stats':
      default:
        data = await uploadService.getMonitoringData();
        break;
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    logger.error('Error getting monitoring data:', error);
    
    return NextResponse.json(
      { error: 'Failed to get monitoring data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Check if user has admin access
    const { data: userRole } = await supabaseClient
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    let result;
    switch (action) {
      case 'cleanup':
        result = await uploadService.cleanupExpiredUploads();
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error handling monitoring action:', error);
    
    return NextResponse.json(
      { error: 'Failed to handle monitoring action' },
      { status: 500 }
    );
  }
}