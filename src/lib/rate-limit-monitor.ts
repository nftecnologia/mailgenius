import { redisManager } from './redis'
import { RateLimitProfile } from './rate-limiter'

interface RateLimitMetrics {
  totalRequests: number
  blockedRequests: number
  allowedRequests: number
  topIdentifiers: Array<{
    identifier: string
    requests: number
    blocked: number
  }>
  profileStats: Record<RateLimitProfile, {
    requests: number
    blocked: number
    avgResponseTime: number
  }>
}

interface RateLimitAlert {
  type: 'threshold_exceeded' | 'redis_error' | 'high_block_rate' | 'suspicious_activity'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metadata: Record<string, any>
  timestamp: Date
}

class RateLimitMonitor {
  private metrics: RateLimitMetrics = {
    totalRequests: 0,
    blockedRequests: 0,
    allowedRequests: 0,
    topIdentifiers: [],
    profileStats: {} as any
  }

  private alerts: RateLimitAlert[] = []
  private readonly maxAlertsStored = 1000
  private readonly metricsWindow = 60 * 60 * 1000 // 1 hour
  private readonly highBlockRateThreshold = 0.5 // 50% blocked requests
  private readonly suspiciousActivityThreshold = 100 // requests per minute

  // Initialize profile stats
  constructor() {
    this.initializeProfileStats()
  }

  private initializeProfileStats() {
    const profiles: RateLimitProfile[] = [
      'AUTH_STRICT', 'AUTH_NORMAL', 'API_STANDARD', 'API_HEAVY', 'API_BURST',
      'EMAIL_SENDING', 'EMAIL_BURST', 'CAMPAIGN_CREATION', 'CAMPAIGN_SENDING',
      'DATA_IMPORT', 'DATA_EXPORT', 'ANALYTICS_HEAVY', 'PUBLIC_API_IP',
      'WEBHOOK_PROCESSING'
    ]

    profiles.forEach(profile => {
      this.metrics.profileStats[profile] = {
        requests: 0,
        blocked: 0,
        avgResponseTime: 0
      }
    })
  }

  // Record a rate limit check
  recordRateLimitCheck(
    identifier: string,
    profile: RateLimitProfile,
    allowed: boolean,
    responseTime: number
  ) {
    this.metrics.totalRequests++
    
    if (allowed) {
      this.metrics.allowedRequests++
    } else {
      this.metrics.blockedRequests++
    }

    // Update profile stats
    if (this.metrics.profileStats[profile]) {
      this.metrics.profileStats[profile].requests++
      if (!allowed) {
        this.metrics.profileStats[profile].blocked++
      }
      
      // Update average response time
      const stats = this.metrics.profileStats[profile]
      stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2
    }

    // Update top identifiers
    this.updateTopIdentifiers(identifier, allowed)

    // Check for alerts
    this.checkForAlerts(identifier, profile, allowed)
  }

  private updateTopIdentifiers(identifier: string, allowed: boolean) {
    let identifierStat = this.metrics.topIdentifiers.find(i => i.identifier === identifier)
    
    if (!identifierStat) {
      identifierStat = { identifier, requests: 0, blocked: 0 }
      this.metrics.topIdentifiers.push(identifierStat)
    }

    identifierStat.requests++
    if (!allowed) {
      identifierStat.blocked++
    }

    // Sort by requests and keep top 100
    this.metrics.topIdentifiers.sort((a, b) => b.requests - a.requests)
    this.metrics.topIdentifiers = this.metrics.topIdentifiers.slice(0, 100)
  }

  private checkForAlerts(identifier: string, profile: RateLimitProfile, allowed: boolean) {
    // Check for high block rate
    if (this.metrics.totalRequests > 100) {
      const blockRate = this.metrics.blockedRequests / this.metrics.totalRequests
      if (blockRate > this.highBlockRateThreshold) {
        this.addAlert({
          type: 'high_block_rate',
          message: `High block rate detected: ${(blockRate * 100).toFixed(2)}%`,
          severity: 'high',
          metadata: {
            blockRate,
            totalRequests: this.metrics.totalRequests,
            blockedRequests: this.metrics.blockedRequests
          }
        })
      }
    }

    // Check for suspicious activity
    const identifierStat = this.metrics.topIdentifiers.find(i => i.identifier === identifier)
    if (identifierStat && identifierStat.requests > this.suspiciousActivityThreshold) {
      this.addAlert({
        type: 'suspicious_activity',
        message: `Suspicious activity detected for identifier: ${identifier}`,
        severity: 'medium',
        metadata: {
          identifier,
          requests: identifierStat.requests,
          blocked: identifierStat.blocked,
          profile
        }
      })
    }
  }

  private addAlert(alert: Omit<RateLimitAlert, 'timestamp'>) {
    const newAlert: RateLimitAlert = {
      ...alert,
      timestamp: new Date()
    }

    this.alerts.unshift(newAlert)
    
    // Keep only recent alerts
    if (this.alerts.length > this.maxAlertsStored) {
      this.alerts = this.alerts.slice(0, this.maxAlertsStored)
    }

    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error('🚨 CRITICAL RATE LIMIT ALERT:', alert)
    } else if (alert.severity === 'high') {
      console.warn('⚠️  HIGH RATE LIMIT ALERT:', alert)
    }
  }

  // Get current metrics
  getMetrics(): RateLimitMetrics {
    return { ...this.metrics }
  }

  // Get recent alerts
  getAlerts(limit: number = 50): RateLimitAlert[] {
    return this.alerts.slice(0, limit)
  }

  // Get alerts by severity
  getAlertsBySeverity(severity: RateLimitAlert['severity']): RateLimitAlert[] {
    return this.alerts.filter(alert => alert.severity === severity)
  }

  // Get metrics for a specific profile
  getProfileMetrics(profile: RateLimitProfile) {
    return this.metrics.profileStats[profile] || null
  }

  // Get top blocked identifiers
  getTopBlockedIdentifiers(limit: number = 10) {
    return this.metrics.topIdentifiers
      .filter(i => i.blocked > 0)
      .sort((a, b) => b.blocked - a.blocked)
      .slice(0, limit)
  }

  // Get current block rate
  getBlockRate(): number {
    if (this.metrics.totalRequests === 0) return 0
    return this.metrics.blockedRequests / this.metrics.totalRequests
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      topIdentifiers: [],
      profileStats: {} as any
    }
    this.initializeProfileStats()
  }

  // Clear alerts
  clearAlerts() {
    this.alerts = []
  }

  // Export metrics for external monitoring
  async exportMetrics(): Promise<{
    metrics: RateLimitMetrics
    alerts: RateLimitAlert[]
    redisStatus: {
      connected: boolean
      latency?: number
    }
  }> {
    const redisStatus = await this.getRedisStatus()
    
    return {
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
      redisStatus
    }
  }

  private async getRedisStatus(): Promise<{ connected: boolean; latency?: number }> {
    try {
      const startTime = Date.now()
      const connected = await redisManager.ping()
      const latency = Date.now() - startTime
      
      return { connected, latency }
    } catch (error) {
      this.addAlert({
        type: 'redis_error',
        message: `Redis connection error: ${error}`,
        severity: 'high',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      
      return { connected: false }
    }
  }

  // Health check endpoint data
  getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    metrics: {
      totalRequests: number
      blockRate: number
      redisConnected: boolean
    }
    alerts: number
  } {
    const blockRate = this.getBlockRate()
    const criticalAlerts = this.getAlertsBySeverity('critical').length
    const highAlerts = this.getAlertsBySeverity('high').length
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (criticalAlerts > 0) {
      status = 'unhealthy'
    } else if (highAlerts > 0 || blockRate > 0.3) {
      status = 'degraded'
    }

    return {
      status,
      metrics: {
        totalRequests: this.metrics.totalRequests,
        blockRate,
        redisConnected: redisManager.isReady()
      },
      alerts: this.alerts.length
    }
  }

  // Start monitoring (call periodically)
  startMonitoring(intervalMs: number = 60000) {
    setInterval(() => {
      this.performHealthChecks()
    }, intervalMs)
  }

  private async performHealthChecks() {
    // Check Redis connection
    const redisStatus = await this.getRedisStatus()
    if (!redisStatus.connected) {
      this.addAlert({
        type: 'redis_error',
        message: 'Redis connection lost',
        severity: 'critical',
        metadata: { redisStatus }
      })
    }

    // Check for memory usage issues
    if (this.metrics.topIdentifiers.length > 1000) {
      this.addAlert({
        type: 'threshold_exceeded',
        message: 'Too many tracked identifiers, potential memory issue',
        severity: 'medium',
        metadata: { identifierCount: this.metrics.topIdentifiers.length }
      })
    }

    // Auto-cleanup old metrics (keep last hour)
    this.cleanupOldMetrics()
  }

  private cleanupOldMetrics() {
    // Reset metrics if they're too old
    // This is a simple implementation - in production, you'd want
    // to implement a sliding window approach
    const now = Date.now()
    const hourAgo = now - this.metricsWindow
    
    // Remove old alerts
    this.alerts = this.alerts.filter(alert => 
      alert.timestamp.getTime() > hourAgo
    )
  }
}

// Global monitor instance
export const rateLimitMonitor = new RateLimitMonitor()

// Middleware to automatically record rate limit checks
export function withRateLimitMonitoring<T extends any[]>(
  fn: (...args: T) => Promise<{
    allowed: boolean
    limit: number
    remaining: number
    resetTime: number
    retryAfter?: number
  }>,
  identifier: string,
  profile: RateLimitProfile
) {
  return async (...args: T) => {
    const startTime = Date.now()
    
    try {
      const result = await fn(...args)
      const responseTime = Date.now() - startTime
      
      rateLimitMonitor.recordRateLimitCheck(
        identifier,
        profile,
        result.allowed,
        responseTime
      )
      
      return result
    } catch (error) {
      const responseTime = Date.now() - startTime
      
      rateLimitMonitor.recordRateLimitCheck(
        identifier,
        profile,
        false,
        responseTime
      )
      
      throw error
    }
  }
}

// Start monitoring when module is imported
if (process.env.NODE_ENV === 'production') {
  rateLimitMonitor.startMonitoring()
}