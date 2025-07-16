import { NextRequest, NextResponse } from 'next/server'
import { metricsCollector } from '@/lib/monitoring/metrics'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const metric = searchParams.get('metric')
    const hours = parseInt(searchParams.get('hours') || '1')
    const type = searchParams.get('type') || 'timeseries'
    
    if (!metric) {
      return NextResponse.json({
        error: 'Missing metric parameter'
      }, { status: 400 })
    }

    let data
    
    switch (type) {
      case 'timeseries':
        data = await metricsCollector.getTimeSeriesMetric(metric, hours)
        break
      case 'points':
        data = await metricsCollector.getMetric(metric, hours)
        break
      case 'windows':
        const windowMinutes = parseInt(searchParams.get('window') || '5')
        const windowsCount = parseInt(searchParams.get('count') || '12')
        data = await metricsCollector.getMetricsByWindow(metric, windowMinutes, windowsCount)
        break
      default:
        return NextResponse.json({
          error: 'Invalid type parameter. Must be: timeseries, points, or windows'
        }, { status: 400 })
    }
    
    logger.info('Metrics retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { metric, hours, type }
    })
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=30', // Cache for 30 seconds
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve metrics', {
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
    const { metric, value, tags } = body
    
    if (!metric || typeof value !== 'number') {
      return NextResponse.json({
        error: 'Missing or invalid metric or value'
      }, { status: 400 })
    }
    
    await metricsCollector.recordMetric(metric, value, tags)
    
    logger.info('Metric recorded', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { metric, value, tags }
    })
    
    return NextResponse.json({ success: true })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to record metric', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}