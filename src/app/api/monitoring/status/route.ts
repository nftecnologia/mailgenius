import { NextRequest, NextResponse } from 'next/server'
import { monitoringDashboard } from '@/lib/monitoring/dashboard'
import { logger } from '@/lib/logger'

// Public status page endpoint (no authentication required)
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const statusData = await monitoringDashboard.getStatusPageData()
    
    logger.info('Status page data retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { status: statusData.status }
    })
    
    return NextResponse.json(statusData, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'Access-Control-Allow-Origin': '*', // Allow public access
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve status page data', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      status: 'outage',
      error: errorMessage,
      timestamp: Date.now()
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}