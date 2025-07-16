import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { structuredLogger } from '@/lib/monitoring/structured-logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'
    
    const query = {
      level: searchParams.get('level') || undefined,
      service: searchParams.get('service') || undefined,
      component: searchParams.get('component') || undefined,
      traceId: searchParams.get('traceId') || undefined,
      userId: searchParams.get('userId') || undefined,
      startTime: searchParams.get('startTime') ? parseInt(searchParams.get('startTime')!) : undefined,
      endTime: searchParams.get('endTime') ? parseInt(searchParams.get('endTime')!) : undefined,
      limit: parseInt(searchParams.get('limit') || '10000'),
      offset: parseInt(searchParams.get('offset') || '0'),
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined
    }

    const logs = await structuredLogger.query(query)

    let content: string
    let contentType: string
    let filename: string

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'timestamp',
        'level',
        'service',
        'component',
        'message',
        'traceId',
        'userId',
        'duration',
        'tags',
        'metadata'
      ]
      
      const csvRows = [headers.join(',')]
      
      logs.forEach(log => {
        const row = [
          new Date(log.timestamp).toISOString(),
          log.level,
          log.service,
          log.component,
          `"${log.message.replace(/"/g, '""')}"`,
          log.traceId || '',
          log.userId || '',
          log.duration || '',
          `"${log.tags.join(';')}"`,
          `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"`
        ]
        csvRows.push(row.join(','))
      })
      
      content = csvRows.join('\n')
      contentType = 'text/csv'
      filename = `logs-${new Date().toISOString().split('T')[0]}.csv`
    } else {
      // JSON format
      content = JSON.stringify(logs, null, 2)
      contentType = 'application/json'
      filename = `logs-${new Date().toISOString().split('T')[0]}.json`
    }

    logger.info('Logs exported', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        format,
        count: logs.length,
        query: Object.fromEntries(Object.entries(query).filter(([_, v]) => v !== undefined))
      }
    })

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Total-Count': logs.length.toString()
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to export logs', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}