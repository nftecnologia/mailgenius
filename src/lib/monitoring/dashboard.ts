import { healthChecker, SystemHealthReport } from './health-check'
import { metricsCollector, PerformanceMetrics, BusinessMetrics } from './metrics'
import { alertManager, AlertIncident } from './alerts'
import { rateLimiter } from '../rate-limiter'
import { logger } from '../logger'

export interface DashboardData {
  health: SystemHealthReport
  performance: PerformanceMetrics
  business: BusinessMetrics
  alerts: {
    incidents: AlertIncident[]
    stats: {
      totalRules: number
      enabledRules: number
      openIncidents: number
      acknowledgedIncidents: number
      resolvedIncidents: number
      notificationsSent: number
    }
  }
  rateLimits: {
    totalHits: number
    blocked: number
    activeEndpoints: string[]
  }
  systemInfo: {
    uptime: number
    nodeVersion: string
    platform: string
    environment: string
    timestamp: number
  }
}

export interface StatusPageData {
  status: 'operational' | 'degraded' | 'outage'
  services: Array<{
    name: string
    status: 'operational' | 'degraded' | 'outage'
    uptime: number
    description: string
  }>
  incidents: Array<{
    id: string
    title: string
    description: string
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
    severity: 'low' | 'medium' | 'high' | 'critical'
    createdAt: number
    updatedAt: number
    updates: Array<{
      message: string
      timestamp: number
      status: string
    }>
  }>
  uptime: {
    overall: number
    last30Days: number[]
    last7Days: number[]
    last24Hours: number[]
  }
  metrics: {
    responseTime: number
    uptime: number
    incidents: number
  }
}

export interface MetricCard {
  title: string
  value: string | number
  change: number
  changeType: 'positive' | 'negative' | 'neutral'
  unit?: string
  description?: string
  sparkline?: number[]
}

class MonitoringDashboard {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private readonly cacheTimeout = 30000 // 30 seconds

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T
    }
    return null
  }

  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  async getDashboardData(): Promise<DashboardData> {
    const cached = this.getCachedData<DashboardData>('dashboard')
    if (cached) return cached

    try {
      const [health, performance, business, alertStats, rateLimitStats] = await Promise.all([
        healthChecker.performFullHealthCheck(),
        metricsCollector.getPerformanceMetrics(1),
        metricsCollector.getBusinessMetrics(24),
        alertManager.getStats(),
        this.getRateLimitStats()
      ])

      const data: DashboardData = {
        health,
        performance,
        business,
        alerts: {
          incidents: alertManager.getIncidents().slice(0, 10), // Latest 10 incidents
          stats: alertStats
        },
        rateLimits: rateLimitStats,
        systemInfo: {
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          environment: process.env.NODE_ENV || 'development',
          timestamp: Date.now()
        }
      }

      this.setCachedData('dashboard', data)
      return data

    } catch (error) {
      logger.error('Failed to get dashboard data', {
        error: error instanceof Error ? error : new Error('Unknown error')
      })
      throw error
    }
  }

  async getStatusPageData(): Promise<StatusPageData> {
    const cached = this.getCachedData<StatusPageData>('status-page')
    if (cached) return cached

    try {
      const health = await healthChecker.performFullHealthCheck()
      const incidents = alertManager.getIncidents()
        .filter(i => i.severity === 'high' || i.severity === 'critical')
        .slice(0, 5)

      // Map health status to status page format
      const statusMap = {
        'healthy': 'operational',
        'degraded': 'degraded',
        'unhealthy': 'outage'
      } as const

      const services = health.services.map(service => ({
        name: service.service,
        status: statusMap[service.status] || 'outage',
        uptime: this.calculateServiceUptime(service.service),
        description: service.error || `${service.service} is ${service.status}`
      }))

      const statusPageIncidents = incidents.map(incident => ({
        id: incident.id,
        title: incident.ruleName,
        description: incident.message,
        status: incident.status === 'open' ? 'investigating' : 
                incident.status === 'acknowledged' ? 'identified' : 'resolved',
        severity: incident.severity,
        createdAt: incident.triggeredAt,
        updatedAt: incident.resolvedAt || incident.acknowledgedAt || incident.triggeredAt,
        updates: [
          {
            message: `Alert triggered: ${incident.message}`,
            timestamp: incident.triggeredAt,
            status: 'investigating'
          },
          ...(incident.acknowledgedAt ? [{
            message: `Incident acknowledged by ${incident.acknowledgedBy}`,
            timestamp: incident.acknowledgedAt,
            status: 'identified'
          }] : []),
          ...(incident.resolvedAt ? [{
            message: `Incident resolved by ${incident.resolvedBy}`,
            timestamp: incident.resolvedAt,
            status: 'resolved'
          }] : [])
        ]
      }))

      const uptime = await this.calculateUptime()
      const metrics = await this.getStatusMetrics()

      const data: StatusPageData = {
        status: statusMap[health.overall] || 'outage',
        services,
        incidents: statusPageIncidents,
        uptime,
        metrics
      }

      this.setCachedData('status-page', data)
      return data

    } catch (error) {
      logger.error('Failed to get status page data', {
        error: error instanceof Error ? error : new Error('Unknown error')
      })
      throw error
    }
  }

  async getMetricCards(): Promise<MetricCard[]> {
    const cached = this.getCachedData<MetricCard[]>('metric-cards')
    if (cached) return cached

    try {
      const [
        currentPerf,
        previousPerf,
        currentBusiness,
        previousBusiness
      ] = await Promise.all([
        metricsCollector.getPerformanceMetrics(1),
        metricsCollector.getPerformanceMetrics(2), // Previous hour for comparison
        metricsCollector.getBusinessMetrics(24),
        metricsCollector.getBusinessMetrics(48) // Previous 24h for comparison
      ])

      const cards: MetricCard[] = [
        {
          title: 'API Response Time',
          value: `${currentPerf.apiLatency.aggregation.avg.toFixed(0)}ms`,
          change: this.calculateChange(
            currentPerf.apiLatency.aggregation.avg,
            previousPerf.apiLatency.aggregation.avg
          ),
          changeType: this.getChangeType(
            currentPerf.apiLatency.aggregation.avg,
            previousPerf.apiLatency.aggregation.avg,
            'lower'
          ),
          unit: 'ms',
          description: 'Average API response time',
          sparkline: await this.getSparklineData('api.latency')
        },
        {
          title: 'Emails Sent',
          value: currentBusiness.totalEmailsSent,
          change: this.calculateChange(
            currentBusiness.totalEmailsSent,
            previousBusiness.totalEmailsSent
          ),
          changeType: this.getChangeType(
            currentBusiness.totalEmailsSent,
            previousBusiness.totalEmailsSent,
            'higher'
          ),
          description: 'Total emails sent today',
          sparkline: await this.getSparklineData('email.sent')
        },
        {
          title: 'Active Users',
          value: currentBusiness.totalActiveUsers,
          change: this.calculateChange(
            currentBusiness.totalActiveUsers,
            previousBusiness.totalActiveUsers
          ),
          changeType: this.getChangeType(
            currentBusiness.totalActiveUsers,
            previousBusiness.totalActiveUsers,
            'higher'
          ),
          description: 'Active users today',
          sparkline: await this.getSparklineData('user.active')
        },
        {
          title: 'Error Rate',
          value: `${(currentPerf.errorRate.aggregation.avg * 100).toFixed(1)}%`,
          change: this.calculateChange(
            currentPerf.errorRate.aggregation.avg,
            previousPerf.errorRate.aggregation.avg
          ),
          changeType: this.getChangeType(
            currentPerf.errorRate.aggregation.avg,
            previousPerf.errorRate.aggregation.avg,
            'lower'
          ),
          unit: '%',
          description: 'API error rate',
          sparkline: await this.getSparklineData('api.errors')
        },
        {
          title: 'Memory Usage',
          value: `${currentPerf.memoryUsage.aggregation.avg.toFixed(1)}%`,
          change: this.calculateChange(
            currentPerf.memoryUsage.aggregation.avg,
            previousPerf.memoryUsage.aggregation.avg
          ),
          changeType: this.getChangeType(
            currentPerf.memoryUsage.aggregation.avg,
            previousPerf.memoryUsage.aggregation.avg,
            'lower'
          ),
          unit: '%',
          description: 'System memory usage',
          sparkline: await this.getSparklineData('system.memory.usage_percent')
        },
        {
          title: 'Click Rate',
          value: `${currentBusiness.clickThroughRate.toFixed(1)}%`,
          change: this.calculateChange(
            currentBusiness.clickThroughRate,
            previousBusiness.clickThroughRate
          ),
          changeType: this.getChangeType(
            currentBusiness.clickThroughRate,
            previousBusiness.clickThroughRate,
            'higher'
          ),
          unit: '%',
          description: 'Email click-through rate',
          sparkline: await this.getSparklineData('email.clicked')
        }
      ]

      this.setCachedData('metric-cards', cards)
      return cards

    } catch (error) {
      logger.error('Failed to get metric cards', {
        error: error instanceof Error ? error : new Error('Unknown error')
      })
      throw error
    }
  }

  private async getRateLimitStats(): Promise<{
    totalHits: number
    blocked: number
    activeEndpoints: string[]
  }> {
    const rateLimitHits = await metricsCollector.getTimeSeriesMetric('ratelimit.hits', 1)
    const rateLimitBlocked = await metricsCollector.getTimeSeriesMetric('ratelimit.blocked', 1)
    
    const totalHits = rateLimitHits.aggregation.sum
    const blocked = rateLimitBlocked.aggregation.sum
    
    // Get unique endpoints from tags
    const endpoints = new Set<string>()
    rateLimitHits.points.forEach(point => {
      if (point.tags?.endpoint) {
        endpoints.add(point.tags.endpoint)
      }
    })
    
    return {
      totalHits,
      blocked,
      activeEndpoints: Array.from(endpoints)
    }
  }

  private calculateServiceUptime(serviceName: string): number {
    // TODO: Implement actual uptime calculation based on historical data
    // For now, return a mock value
    return 99.9
  }

  private async calculateUptime(): Promise<{
    overall: number
    last30Days: number[]
    last7Days: number[]
    last24Hours: number[]
  }> {
    // TODO: Implement actual uptime calculation
    // For now, return mock data
    return {
      overall: 99.9,
      last30Days: Array.from({ length: 30 }, (_, i) => 99.5 + Math.random() * 0.5),
      last7Days: Array.from({ length: 7 }, (_, i) => 99.8 + Math.random() * 0.2),
      last24Hours: Array.from({ length: 24 }, (_, i) => 99.9 + Math.random() * 0.1)
    }
  }

  private async getStatusMetrics(): Promise<{
    responseTime: number
    uptime: number
    incidents: number
  }> {
    const latency = await metricsCollector.getTimeSeriesMetric('api.latency', 1)
    const incidents = alertManager.getIncidents().filter(i => i.status === 'open').length
    
    return {
      responseTime: latency.aggregation.avg,
      uptime: 99.9, // TODO: Calculate actual uptime
      incidents
    }
  }

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  private getChangeType(current: number, previous: number, desired: 'higher' | 'lower'): 'positive' | 'negative' | 'neutral' {
    if (current === previous) return 'neutral'
    
    const isIncrease = current > previous
    
    if (desired === 'higher') {
      return isIncrease ? 'positive' : 'negative'
    } else {
      return isIncrease ? 'negative' : 'positive'
    }
  }

  private async getSparklineData(metric: string): Promise<number[]> {
    const points = await metricsCollector.getMetricsByWindow(metric, 5, 12) // Last hour in 5-minute windows
    return points.map(p => p.value)
  }

  // Real-time updates
  async getRealtimeUpdates(): Promise<{
    timestamp: number
    metrics: {
      apiLatency: number
      errorRate: number
      memoryUsage: number
      activeUsers: number
    }
    alerts: {
      open: number
      recent: AlertIncident[]
    }
  }> {
    const [
      apiLatency,
      errorRate,
      memoryUsage,
      activeUsers
    ] = await Promise.all([
      metricsCollector.getTimeSeriesMetric('api.latency', 0.1), // Last 6 minutes
      metricsCollector.getTimeSeriesMetric('api.errors', 0.1),
      metricsCollector.getTimeSeriesMetric('system.memory.usage_percent', 0.1),
      metricsCollector.getTimeSeriesMetric('user.active', 0.1)
    ])

    const incidents = alertManager.getIncidents()
    const openIncidents = incidents.filter(i => i.status === 'open')
    const recentIncidents = incidents
      .filter(i => Date.now() - i.triggeredAt < 60000) // Last minute
      .slice(0, 5)

    return {
      timestamp: Date.now(),
      metrics: {
        apiLatency: apiLatency.aggregation.avg,
        errorRate: errorRate.aggregation.avg,
        memoryUsage: memoryUsage.aggregation.avg,
        activeUsers: activeUsers.aggregation.sum
      },
      alerts: {
        open: openIncidents.length,
        recent: recentIncidents
      }
    }
  }

  // Export data
  async exportMetrics(format: 'json' | 'csv', startTime: number, endTime: number): Promise<string> {
    const metrics = ['api.latency', 'email.sent', 'user.active', 'api.errors', 'system.memory.usage_percent']
    const data = await Promise.all(
      metrics.map(async metric => {
        const hours = (endTime - startTime) / (1000 * 60 * 60)
        const points = await metricsCollector.getMetric(metric, hours)
        return {
          metric,
          points: points.filter(p => p.timestamp >= startTime && p.timestamp <= endTime)
        }
      })
    )

    if (format === 'json') {
      return JSON.stringify(data, null, 2)
    } else {
      // CSV format
      const csv = ['timestamp,metric,value,tags']
      data.forEach(({ metric, points }) => {
        points.forEach(point => {
          const tags = point.tags ? JSON.stringify(point.tags) : ''
          csv.push(`${point.timestamp},${metric},${point.value},"${tags}"`)
        })
      })
      return csv.join('\n')
    }
  }
}

export const monitoringDashboard = new MonitoringDashboard()