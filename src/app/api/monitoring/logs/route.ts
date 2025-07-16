import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { structuredLogger } from '@/lib/monitoring/structured-logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    
    const query = {
      level: searchParams.get('level') || undefined,
      service: searchParams.get('service') || undefined,
      component: searchParams.get('component') || undefined,
      traceId: searchParams.get('traceId') || undefined,
      userId: searchParams.get('userId') || undefined,
      startTime: searchParams.get('startTime') ? parseInt(searchParams.get('startTime')!) : undefined,
      endTime: searchParams.get('endTime') ? parseInt(searchParams.get('endTime')!) : undefined,
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined
    }

    const logs = await structuredLogger.query(query)

    logger.info('Logs retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        count: logs.length,
        query: Object.fromEntries(Object.entries(query).filter(([_, v]) => v !== undefined))
      }
    })

    return NextResponse.json(logs, {
      headers: {
        'X-Total-Count': logs.length.toString(),
        'X-Offset': query.offset.toString(),
        'X-Limit': query.limit.toString()
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve logs', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}