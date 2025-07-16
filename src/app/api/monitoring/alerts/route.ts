import { NextRequest, NextResponse } from 'next/server'
import { alertManager } from '@/lib/monitoring/alerts'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'incidents'
    
    let data
    
    switch (type) {
      case 'incidents':
        data = alertManager.getIncidents()
        break
      case 'rules':
        data = alertManager.getRules()
        break
      case 'stats':
        data = alertManager.getStats()
        break
      case 'notifications':
        data = alertManager.getNotifications()
        break
      default:
        return NextResponse.json({
          error: 'Invalid type parameter. Must be: incidents, rules, stats, or notifications'
        }, { status: 400 })
    }
    
    logger.info('Alerts data retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { type }
    })
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=10', // Cache for 10 seconds
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve alerts data', {
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
      case 'create_rule':
        result = alertManager.addRule(data)
        break
      case 'update_rule':
        const { id, ...updates } = data
        result = alertManager.updateRule(id, updates)
        break
      case 'delete_rule':
        result = alertManager.deleteRule(data.id)
        break
      case 'acknowledge_incident':
        result = alertManager.acknowledgeIncident(data.id, data.acknowledgedBy)
        break
      case 'resolve_incident':
        result = alertManager.resolveIncident(data.id, data.resolvedBy)
        break
      case 'run_check':
        await alertManager.runAlertCheck()
        result = true
        break
      default:
        return NextResponse.json({
          error: 'Invalid action parameter'
        }, { status: 400 })
    }
    
    logger.info('Alert action completed', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { action, result }
    })
    
    return NextResponse.json({ success: result })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to process alert action', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}