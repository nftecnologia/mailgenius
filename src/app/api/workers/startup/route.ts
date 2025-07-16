// Worker System Startup API

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { emailWorkersService } from '@/lib/email-workers';

export async function POST(request: NextRequest) {
  const context = logger.createRequestContext(request);
  
  try {
    const body = await request.json();
    const { 
      action,
      max_workers = 10,
      min_workers = 2,
      target_throughput = 10000,
      auto_start = true
    } = body;

    logger.api('Worker system startup', 'POST', undefined, { 
      ...context, 
      metadata: { action, max_workers, min_workers, target_throughput } 
    });

    switch (action) {
      case 'initialize':
        await emailWorkersService.initialize({
          autoStart: auto_start,
          maxWorkers: max_workers,
          minWorkers: min_workers,
          targetThroughput: target_throughput
        });
        
        return NextResponse.json({
          success: true,
          message: 'Email Workers Service initialized successfully',
          config: {
            max_workers,
            min_workers,
            target_throughput,
            auto_start
          }
        });

      case 'start':
        await emailWorkersService.start();
        
        return NextResponse.json({
          success: true,
          message: 'Email Workers Service started successfully'
        });

      case 'stop':
        await emailWorkersService.stop();
        
        return NextResponse.json({
          success: true,
          message: 'Email Workers Service stopped successfully'
        });

      case 'status':
        const status = emailWorkersService.getStatus();
        
        return NextResponse.json({
          success: true,
          data: status
        });

      case 'health':
        const health = await emailWorkersService.healthCheck();
        
        return NextResponse.json({
          success: true,
          data: health
        });

      case 'comprehensive-stats':
        const stats = await emailWorkersService.getComprehensiveStats();
        
        return NextResponse.json({
          success: true,
          data: stats
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: initialize, start, stop, status, health, or comprehensive-stats' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Error in worker system startup API', context, error as Error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const context = logger.createRequestContext(request);
  
  try {
    logger.api('Worker system status check', 'GET', undefined, context);

    const status = emailWorkersService.getStatus();
    
    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting worker system status', context, error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}