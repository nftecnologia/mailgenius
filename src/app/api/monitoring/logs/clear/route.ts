import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { structuredLogger } from '@/lib/monitoring/structured-logger'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const body = await request.json()
    const { service, component } = body

    await structuredLogger.clearLogs(service, component)

    logger.info('Logs cleared', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { service, component }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to clear logs', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}