import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { alertManager } from '@/lib/monitoring/alerts'
import { metricsCollector } from '@/lib/monitoring/metrics'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    // Get alert statistics
    const stats = await alertManager.getStats()
    const incidents = alertManager.getIncidents()
    const rules = alertManager.getRules()

    // Calculate MTTR (Mean Time To Resolution)
    const resolvedIncidents = incidents.filter(i => i.resolvedAt && i.triggeredAt)
    const mttr = resolvedIncidents.length > 0 
      ? resolvedIncidents.reduce((sum, incident) => sum + (incident.resolvedAt! - incident.triggeredAt), 0) / resolvedIncidents.length
      : 0

    // Calculate MTBF (Mean Time Between Failures)
    const sortedIncidents = incidents.sort((a, b) => a.triggeredAt - b.triggeredAt)
    let mtbf = 0
    if (sortedIncidents.length > 1) {
      const intervals = []
      for (let i = 1; i < sortedIncidents.length; i++) {
        intervals.push(sortedIncidents[i].triggeredAt - sortedIncidents[i-1].triggeredAt)
      }
      mtbf = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    }

    const overview = {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.enabled).length,
      openIncidents: stats.openIncidents,
      acknowledgedIncidents: stats.acknowledgedIncidents,
      resolvedIncidents: stats.resolvedIncidents,
      mttr,
      mtbf
    }

    // Get trend data for incidents
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000)
    const incidentTrends = await metricsCollector.getMetricsByWindow('alerts.incidents', 60, 24)
    const resolutionTrends = await metricsCollector.getMetricsByWindow('alerts.resolution_time', 60, 24)
    const notificationTrends = await metricsCollector.getMetricsByWindow('alerts.notifications', 60, 24)

    const trends = {
      incidents: incidentTrends.map(point => ({
        timestamp: point.timestamp,
        count: point.value,
        severity: point.tags?.severity || 'unknown'
      })),
      resolution: resolutionTrends.map(point => ({
        timestamp: point.timestamp,
        time: point.value
      })),
      notifications: notificationTrends.map(point => ({
        timestamp: point.timestamp,
        count: point.value
      }))
    }

    // Get top alerting rules
    const ruleTriggerCounts = rules.map(rule => ({
      rule: rule.name,
      count: rule.triggerCount || 0,
      avgDuration: rule.avgDuration || 0,
      severity: rule.severity
    })).sort((a, b) => b.count - a.count).slice(0, 10)

    const metrics = {
      overview,
      trends,
      topAlerts: ruleTriggerCounts
    }

    logger.info('Alert metrics retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        totalRules: overview.totalRules,
        activeRules: overview.activeRules,
        openIncidents: overview.openIncidents,
        mttr,
        mtbf
      }
    })

    return NextResponse.json(metrics)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve alert metrics', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}