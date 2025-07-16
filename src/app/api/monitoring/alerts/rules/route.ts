import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { alertManager } from '@/lib/monitoring/alerts'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const enabled = searchParams.get('enabled')
    const severity = searchParams.get('severity') as 'low' | 'medium' | 'high' | 'critical' | null
    const type = searchParams.get('type') as 'metric' | 'log' | 'heartbeat' | 'synthetic' | null

    // Get all alert rules
    let rules = alertManager.getRules()

    // Apply filters
    if (enabled !== null) {
      const enabledFilter = enabled === 'true'
      rules = rules.filter(rule => rule.enabled === enabledFilter)
    }

    if (severity) {
      rules = rules.filter(rule => rule.severity === severity)
    }

    if (type) {
      rules = rules.filter(rule => rule.type === type)
    }

    // Transform for API response
    const transformedRules = rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      type: rule.type,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      severity: rule.severity,
      enabled: rule.enabled,
      description: rule.description,
      tags: rule.tags || [],
      notifications: rule.notifications || [],
      lastTriggered: rule.lastTriggered,
      triggerCount: rule.triggerCount || 0
    }))

    logger.info('Alert rules retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        total: transformedRules.length,
        filters: { enabled, severity, type }
      }
    })

    return NextResponse.json(transformedRules)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve alert rules', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}