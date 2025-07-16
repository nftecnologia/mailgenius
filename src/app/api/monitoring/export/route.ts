import { NextRequest, NextResponse } from 'next/server'
import { monitoringDashboard } from '@/lib/monitoring/dashboard'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'
    const startTimeParam = searchParams.get('start')
    const endTimeParam = searchParams.get('end')
    
    if (!startTimeParam || !endTimeParam) {
      return NextResponse.json({
        error: 'Missing start or end time parameters'
      }, { status: 400 })
    }

    const startTimestamp = parseInt(startTimeParam)
    const endTimestamp = parseInt(endTimeParam)
    
    if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
      return NextResponse.json({
        error: 'Invalid timestamp parameters'
      }, { status: 400 })
    }

    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json({
        error: 'Invalid format. Must be json or csv'
      }, { status: 400 })
    }

    const data = await monitoringDashboard.exportMetrics(
      format as 'json' | 'csv',
      startTimestamp,
      endTimestamp
    )
    
    logger.info('Metrics exported', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { format, startTimestamp, endTimestamp }
    })
    
    const contentType = format === 'csv' ? 'text/csv' : 'application/json'
    const filename = `metrics-${new Date().toISOString().split('T')[0]}.${format}`
    
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to export metrics', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}