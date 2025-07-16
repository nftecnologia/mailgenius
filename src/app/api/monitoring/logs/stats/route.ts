import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { structuredLogger } from '@/lib/monitoring/structured-logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')

    const stats = await structuredLogger.getStats(hours)

    logger.info('Log stats retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        hours,
        totalLogs: stats.total,
        errorRate: stats.errorRate,
        topErrorsCount: stats.topErrors.length
      }
    })

    return NextResponse.json(stats)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve log stats', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}