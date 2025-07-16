import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { alertManager } from '@/lib/monitoring/alerts'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as 'open' | 'acknowledged' | 'resolved' | null
    const severity = searchParams.get('severity') as 'low' | 'medium' | 'high' | 'critical' | null
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get incidents with filtering
    let incidents = alertManager.getIncidents()

    if (status) {
      incidents = incidents.filter(incident => incident.status === status)
    }

    if (severity) {
      incidents = incidents.filter(incident => incident.severity === severity)
    }

    // Sort by triggered time (newest first)
    incidents.sort((a, b) => b.triggeredAt - a.triggeredAt)

    // Apply pagination
    const paginatedIncidents = incidents.slice(offset, offset + limit)

    // Transform for API response
    const transformedIncidents = paginatedIncidents.map(incident => ({
      id: incident.id,
      ruleName: incident.ruleName,
      ruleId: incident.ruleId,
      severity: incident.severity,
      status: incident.status,
      message: incident.message,
      details: incident.details,
      triggeredAt: incident.triggeredAt,
      acknowledgedAt: incident.acknowledgedAt,
      acknowledgedBy: incident.acknowledgedBy,
      resolvedAt: incident.resolvedAt,
      resolvedBy: incident.resolvedBy,
      updates: incident.updates || [],
      metrics: {
        currentValue: incident.currentValue || 0,
        threshold: incident.threshold || 0,
        duration: incident.duration || 0
      },
      affectedServices: incident.affectedServices || [],
      escalationLevel: incident.escalationLevel || 0,
      notificationsSent: incident.notificationsSent || 0
    }))

    logger.info('Incidents retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        total: incidents.length,
        returned: transformedIncidents.length,
        filters: { status, severity }
      }
    })

    return NextResponse.json(transformedIncidents, {
      headers: {
        'X-Total-Count': incidents.length.toString(),
        'X-Offset': offset.toString(),
        'X-Limit': limit.toString()
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve incidents', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}