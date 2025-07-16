import { NextRequest, NextResponse } from 'next/server'
import { monitoringDashboard } from '@/lib/monitoring/dashboard'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'full'
    
    let data
    
    switch (type) {
      case 'full':
        data = await monitoringDashboard.getDashboardData()
        break
      case 'status':
        data = await monitoringDashboard.getStatusPageData()
        break
      case 'cards':
        data = await monitoringDashboard.getMetricCards()
        break
      case 'realtime':
        data = await monitoringDashboard.getRealtimeUpdates()
        break
      default:
        return NextResponse.json({
          error: 'Invalid type parameter. Must be: full, status, cards, or realtime'
        }, { status: 400 })
    }
    
    logger.info('Dashboard data retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { type }
    })
    
    // Set appropriate cache headers based on type
    const cacheControl = type === 'realtime' ? 'no-cache' : 'public, max-age=30'
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': cacheControl,
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve dashboard data', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const body = await request.json()
    const { action, ...data } = body
    
    let result
    
    switch (action) {
      case 'export_metrics':
        const { format, startTime: exportStart, endTime: exportEnd } = data
        result = await monitoringDashboard.exportMetrics(format, exportStart, exportEnd)
        break
      default:
        return NextResponse.json({
          error: 'Invalid action parameter'
        }, { status: 400 })
    }
    
    logger.info('Dashboard action completed', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { action }
    })
    
    return NextResponse.json({ data: result })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to process dashboard action', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}