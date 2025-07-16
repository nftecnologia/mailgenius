import { logger } from '../logger'
import { redisManager } from '../redis'

export interface MetricPoint {
  timestamp: number
  value: number
  tags?: Record<string, string>
}

export interface MetricAggregation {
  min: number
  max: number
  avg: number
  sum: number
  count: number
}

export interface TimeSeriesMetric {
  name: string
  points: MetricPoint[]
  aggregation: MetricAggregation
}

export interface PerformanceMetrics {
  apiLatency: TimeSeriesMetric
  emailsSent: TimeSeriesMetric
  campaignsSent: TimeSeriesMetric
  activeUsers: TimeSeriesMetric
  errorRate: TimeSeriesMetric
  memoryUsage: TimeSeriesMetric
  cpuUsage: TimeSeriesMetric
  rateLimitHits: TimeSeriesMetric
}

export interface BusinessMetrics {
  totalEmailsSent: number
  totalCampaignsSent: number
  totalActiveUsers: number
  conversionRate: number
  clickThroughRate: number
  bounceRate: number
  unsubscribeRate: number
}

class MetricsCollector {
  private metrics = new Map<string, MetricPoint[]>()
  private readonly maxPointsPerMetric = 1000
  private readonly retentionHours = 24

  // Store metric point
  async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    const point: MetricPoint = {
      timestamp: Date.now(),
      value,
      tags
    }

    try {
      // Store in Redis for persistence
      const redis = redisManager.getClient()
      if (redis) {
        const key = `metrics:${name}`
        const pointData = JSON.stringify(point)
        
        await redis.lpush(key, pointData)
        await redis.ltrim(key, 0, this.maxPointsPerMetric - 1)
        await redis.expire(key, this.retentionHours * 3600)
      }

      // Store in memory for quick access
      if (!this.metrics.has(name)) {
        this.metrics.set(name, [])
      }

      const points = this.metrics.get(name)!
      points.unshift(point)

      // Keep only recent points in memory
      if (points.length > this.maxPointsPerMetric) {
        points.splice(this.maxPointsPerMetric)
      }

      logger.debug('Metric recorded', {
        metadata: { name, value, tags }
      })

    } catch (error) {
      logger.error('Failed to record metric', {
        metadata: { name, value, tags },
        error: error instanceof Error ? error : new Error('Unknown error')
      })
    }
  }

  // Get metric points
  async getMetric(name: string, hours: number = 1): Promise<MetricPoint[]> {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    
    try {
      // Try to get from Redis first
      const redis = redisManager.getClient()
      if (redis) {
        const key = `metrics:${name}`
        const pointsData = await redis.lrange(key, 0, -1)
        
        if (pointsData.length > 0) {
          const points = pointsData
            .map(data => {
              try {
                return JSON.parse(data) as MetricPoint
              } catch {
                return null
              }
            })
            .filter((point): point is MetricPoint => point !== null)
            .filter(point => point.timestamp > cutoff)
            .sort((a, b) => b.timestamp - a.timestamp)
          
          return points
        }
      }

      // Fallback to memory
      const points = this.metrics.get(name) || []
      return points.filter(point => point.timestamp > cutoff)

    } catch (error) {
      logger.error('Failed to get metric', {
        metadata: { name, hours },
        error: error instanceof Error ? error : new Error('Unknown error')
      })
      return []
    }
  }

  // Calculate aggregation for metric points
  calculateAggregation(points: MetricPoint[]): MetricAggregation {
    if (points.length === 0) {
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0 }
    }

    const values = points.map(p => p.value)
    const sum = values.reduce((a, b) => a + b, 0)
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      sum,
      count: values.length
    }
  }

  // Get time series metric with aggregation
  async getTimeSeriesMetric(name: string, hours: number = 1): Promise<TimeSeriesMetric> {
    const points = await this.getMetric(name, hours)
    const aggregation = this.calculateAggregation(points)
    
    return {
      name,
      points,
      aggregation
    }
  }

  // Record API request metrics
  async recordApiMetrics(endpoint: string, method: string, statusCode: number, duration: number): Promise<void> {
    const tags = { endpoint, method, status: statusCode.toString() }
    
    await Promise.all([
      this.recordMetric('api.latency', duration, tags),
      this.recordMetric('api.requests', 1, tags),
      this.recordMetric('api.errors', statusCode >= 400 ? 1 : 0, tags)
    ])
  }

  // Record email metrics
  async recordEmailMetrics(type: 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked', count: number = 1): Promise<void> {
    await this.recordMetric(`email.${type}`, count, { type })
  }

  // Record campaign metrics
  async recordCampaignMetrics(action: 'created' | 'sent' | 'paused' | 'completed', count: number = 1): Promise<void> {
    await this.recordMetric(`campaign.${action}`, count, { action })
  }

  // Record user activity metrics
  async recordUserMetrics(action: 'login' | 'logout' | 'signup' | 'active', userId?: string): Promise<void> {
    const tags = userId ? { userId } : {}
    await this.recordMetric(`user.${action}`, 1, tags)
  }

  // Record rate limiting metrics
  async recordRateLimitMetrics(endpoint: string, allowed: boolean, remaining: number): Promise<void> {
    const tags = { endpoint, allowed: allowed.toString() }
    
    await Promise.all([
      this.recordMetric('ratelimit.hits', 1, tags),
      this.recordMetric('ratelimit.remaining', remaining, tags),
      this.recordMetric('ratelimit.blocked', allowed ? 0 : 1, tags)
    ])
  }

  // Record system metrics
  async recordSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage()
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
      const rssUsedMB = Math.round(memUsage.rss / 1024 / 1024)
      
      await Promise.all([
        this.recordMetric('system.memory.heap_used', heapUsedMB),
        this.recordMetric('system.memory.heap_total', heapTotalMB),
        this.recordMetric('system.memory.rss', rssUsedMB),
        this.recordMetric('system.memory.usage_percent', (heapUsedMB / heapTotalMB) * 100)
      ])

      // Record uptime
      const uptimeSeconds = Math.floor(process.uptime())
      await this.recordMetric('system.uptime', uptimeSeconds)

    } catch (error) {
      logger.error('Failed to record system metrics', {
        error: error instanceof Error ? error : new Error('Unknown error')
      })
    }
  }

  // Get comprehensive performance metrics
  async getPerformanceMetrics(hours: number = 1): Promise<PerformanceMetrics> {
    const [
      apiLatency,
      emailsSent,
      campaignsSent,
      activeUsers,
      errorRate,
      memoryUsage,
      cpuUsage,
      rateLimitHits
    ] = await Promise.all([
      this.getTimeSeriesMetric('api.latency', hours),
      this.getTimeSeriesMetric('email.sent', hours),
      this.getTimeSeriesMetric('campaign.sent', hours),
      this.getTimeSeriesMetric('user.active', hours),
      this.getTimeSeriesMetric('api.errors', hours),
      this.getTimeSeriesMetric('system.memory.usage_percent', hours),
      this.getTimeSeriesMetric('system.cpu.usage', hours),
      this.getTimeSeriesMetric('ratelimit.hits', hours)
    ])

    return {
      apiLatency,
      emailsSent,
      campaignsSent,
      activeUsers,
      errorRate,
      memoryUsage,
      cpuUsage,
      rateLimitHits
    }
  }

  // Get business metrics
  async getBusinessMetrics(hours: number = 24): Promise<BusinessMetrics> {
    const [
      emailsSent,
      campaignsSent,
      activeUsers,
      emailsOpened,
      emailsClicked,
      emailsBounced,
      emailsUnsubscribed
    ] = await Promise.all([
      this.getTimeSeriesMetric('email.sent', hours),
      this.getTimeSeriesMetric('campaign.sent', hours),
      this.getTimeSeriesMetric('user.active', hours),
      this.getTimeSeriesMetric('email.opened', hours),
      this.getTimeSeriesMetric('email.clicked', hours),
      this.getTimeSeriesMetric('email.bounced', hours),
      this.getTimeSeriesMetric('email.unsubscribed', hours)
    ])

    const totalEmailsSent = emailsSent.aggregation.sum
    const totalCampaignsSent = campaignsSent.aggregation.sum
    const totalActiveUsers = activeUsers.aggregation.sum
    const totalOpened = emailsOpened.aggregation.sum
    const totalClicked = emailsClicked.aggregation.sum
    const totalBounced = emailsBounced.aggregation.sum
    const totalUnsubscribed = emailsUnsubscribed.aggregation.sum

    return {
      totalEmailsSent,
      totalCampaignsSent,
      totalActiveUsers,
      conversionRate: totalEmailsSent > 0 ? (totalClicked / totalEmailsSent) * 100 : 0,
      clickThroughRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
      bounceRate: totalEmailsSent > 0 ? (totalBounced / totalEmailsSent) * 100 : 0,
      unsubscribeRate: totalEmailsSent > 0 ? (totalUnsubscribed / totalEmailsSent) * 100 : 0
    }
  }

  // Get metrics for specific time windows
  async getMetricsByWindow(name: string, windowMinutes: number = 5, windowsCount: number = 12): Promise<MetricPoint[]> {
    const now = Date.now()
    const windowMs = windowMinutes * 60 * 1000
    const windows: MetricPoint[] = []

    for (let i = 0; i < windowsCount; i++) {
      const windowStart = now - ((i + 1) * windowMs)
      const windowEnd = now - (i * windowMs)
      
      const points = await this.getMetric(name, (windowsCount * windowMinutes) / 60)
      const windowPoints = points.filter(p => p.timestamp >= windowStart && p.timestamp < windowEnd)
      
      if (windowPoints.length > 0) {
        const aggregation = this.calculateAggregation(windowPoints)
        windows.unshift({
          timestamp: windowEnd,
          value: aggregation.avg,
          tags: { window: `${windowMinutes}m`, count: windowPoints.length.toString() }
        })
      } else {
        windows.unshift({
          timestamp: windowEnd,
          value: 0,
          tags: { window: `${windowMinutes}m`, count: '0' }
        })
      }
    }

    return windows
  }

  // Clean up old metrics
  async cleanupOldMetrics(): Promise<void> {
    const cutoff = Date.now() - (this.retentionHours * 60 * 60 * 1000)
    
    try {
      // Clean up memory
      for (const [name, points] of this.metrics.entries()) {
        const filtered = points.filter(p => p.timestamp > cutoff)
        this.metrics.set(name, filtered)
      }

      logger.info('Old metrics cleaned up', {
        metadata: { cutoff: new Date(cutoff).toISOString() }
      })

    } catch (error) {
      logger.error('Failed to cleanup old metrics', {
        error: error instanceof Error ? error : new Error('Unknown error')
      })
    }
  }
}

export const metricsCollector = new MetricsCollector()

// Auto-collect system metrics every minute
setInterval(async () => {
  await metricsCollector.recordSystemMetrics()
}, 60 * 1000)

// Cleanup old metrics every hour
setInterval(async () => {
  await metricsCollector.cleanupOldMetrics()
}, 60 * 60 * 1000)