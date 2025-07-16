import { logger } from '../logger'
import { redisManager } from '../redis'
import { createClient } from '@supabase/supabase-js'

export interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  latency?: number
  error?: string
  details?: Record<string, any>
  timestamp: number
}

export interface SystemHealthReport {
  overall: 'healthy' | 'unhealthy' | 'degraded'
  services: HealthCheckResult[]
  timestamp: number
  uptime: number
}

// Health check thresholds
const HEALTH_THRESHOLDS = {
  database: {
    latency: 1000, // 1 second
    degraded: 500   // 500ms
  },
  redis: {
    latency: 200,   // 200ms
    degraded: 100   // 100ms
  },
  api: {
    latency: 2000,  // 2 seconds
    degraded: 1000  // 1 second
  },
  external: {
    latency: 5000,  // 5 seconds
    degraded: 3000  // 3 seconds
  }
} as const

class HealthChecker {
  private startTime: number
  private lastCheck: SystemHealthReport | null = null

  constructor() {
    this.startTime = Date.now()
  }

  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now()
    const result: HealthCheckResult = {
      service: 'database',
      status: 'healthy',
      timestamp: start
    }

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Simple query to check database connectivity
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1)

      const latency = Date.now() - start
      result.latency = latency

      if (error) {
        result.status = 'unhealthy'
        result.error = error.message
      } else if (latency > HEALTH_THRESHOLDS.database.latency) {
        result.status = 'unhealthy'
        result.error = `High latency: ${latency}ms`
      } else if (latency > HEALTH_THRESHOLDS.database.degraded) {
        result.status = 'degraded'
        result.details = { warning: 'High latency detected' }
      }

      result.details = {
        ...result.details,
        latency: `${latency}ms`,
        connectionPool: 'active'
      }

      logger.debug('Database health check completed', {
        metadata: { latency, status: result.status }
      })

    } catch (error) {
      result.status = 'unhealthy'
      result.error = error instanceof Error ? error.message : 'Unknown error'
      result.latency = Date.now() - start

      logger.error('Database health check failed', {
        metadata: { error: result.error, latency: result.latency }
      })
    }

    return result
  }

  async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now()
    const result: HealthCheckResult = {
      service: 'redis',
      status: 'healthy',
      timestamp: start
    }

    try {
      const redis = redisManager.getClient()
      
      if (!redis) {
        result.status = 'unhealthy'
        result.error = 'Redis client not available'
        return result
      }

      // Test Redis connectivity with ping
      await redis.ping()
      
      const latency = Date.now() - start
      result.latency = latency

      if (latency > HEALTH_THRESHOLDS.redis.latency) {
        result.status = 'unhealthy'
        result.error = `High latency: ${latency}ms`
      } else if (latency > HEALTH_THRESHOLDS.redis.degraded) {
        result.status = 'degraded'
        result.details = { warning: 'High latency detected' }
      }

      // Get Redis info
      const info = await redis.info()
      const memoryUsage = info.match(/used_memory_human:([^\r\n]+)/)
      
      result.details = {
        ...result.details,
        latency: `${latency}ms`,
        memoryUsage: memoryUsage ? memoryUsage[1] : 'unknown',
        connected: true
      }

      logger.debug('Redis health check completed', {
        metadata: { latency, status: result.status }
      })

    } catch (error) {
      result.status = 'unhealthy'
      result.error = error instanceof Error ? error.message : 'Unknown error'
      result.latency = Date.now() - start

      logger.error('Redis health check failed', {
        metadata: { error: result.error, latency: result.latency }
      })
    }

    return result
  }

  async checkExternalAPIs(): Promise<HealthCheckResult> {
    const start = Date.now()
    const result: HealthCheckResult = {
      service: 'external_apis',
      status: 'healthy',
      timestamp: start
    }

    try {
      const checks = []
      
      // Check Resend API
      if (process.env.RESEND_API_KEY) {
        checks.push(this.checkResendAPI())
      }

      // Check Anthropic API
      if (process.env.ANTHROPIC_API_KEY) {
        checks.push(this.checkAnthropicAPI())
      }

      const results = await Promise.allSettled(checks)
      const latency = Date.now() - start
      result.latency = latency

      const failures = results.filter(r => r.status === 'rejected')
      const successes = results.filter(r => r.status === 'fulfilled')

      if (failures.length === results.length) {
        result.status = 'unhealthy'
        result.error = 'All external APIs failed'
      } else if (failures.length > 0) {
        result.status = 'degraded'
        result.details = { warning: `${failures.length} of ${results.length} APIs failed` }
      }

      result.details = {
        ...result.details,
        latency: `${latency}ms`,
        totalAPIs: results.length,
        healthy: successes.length,
        failed: failures.length
      }

      logger.debug('External APIs health check completed', {
        metadata: { latency, status: result.status, totalAPIs: results.length }
      })

    } catch (error) {
      result.status = 'unhealthy'
      result.error = error instanceof Error ? error.message : 'Unknown error'
      result.latency = Date.now() - start

      logger.error('External APIs health check failed', {
        metadata: { error: result.error, latency: result.latency }
      })
    }

    return result
  }

  private async checkResendAPI(): Promise<void> {
    const response = await fetch('https://api.resend.com/domains', {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`)
    }
  }

  private async checkAnthropicAPI(): Promise<void> {
    // Simple check - just verify API key format
    if (!process.env.ANTHROPIC_API_KEY?.startsWith('sk-')) {
      throw new Error('Invalid Anthropic API key format')
    }
  }

  async checkMemoryUsage(): Promise<HealthCheckResult> {
    const start = Date.now()
    const result: HealthCheckResult = {
      service: 'memory',
      status: 'healthy',
      timestamp: start
    }

    try {
      const memUsage = process.memoryUsage()
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
      const rssUsedMB = Math.round(memUsage.rss / 1024 / 1024)
      
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100

      // Consider memory usage unhealthy if > 90%
      if (heapUsagePercent > 90) {
        result.status = 'unhealthy'
        result.error = `High memory usage: ${heapUsagePercent.toFixed(1)}%`
      } else if (heapUsagePercent > 80) {
        result.status = 'degraded'
        result.details = { warning: 'High memory usage detected' }
      }

      result.details = {
        ...result.details,
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        rss: `${rssUsedMB}MB`,
        heapUsagePercent: `${heapUsagePercent.toFixed(1)}%`
      }

      result.latency = Date.now() - start

      logger.debug('Memory health check completed', {
        metadata: { heapUsagePercent, status: result.status }
      })

    } catch (error) {
      result.status = 'unhealthy'
      result.error = error instanceof Error ? error.message : 'Unknown error'
      result.latency = Date.now() - start

      logger.error('Memory health check failed', {
        metadata: { error: result.error }
      })
    }

    return result
  }

  async performFullHealthCheck(): Promise<SystemHealthReport> {
    const start = Date.now()
    
    logger.info('Starting full health check')

    try {
      // Run all health checks in parallel
      const [database, redis, externalAPIs, memory] = await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkExternalAPIs(),
        this.checkMemoryUsage()
      ])

      const services = [database, redis, externalAPIs, memory]
      
      // Determine overall health
      const unhealthyServices = services.filter(s => s.status === 'unhealthy')
      const degradedServices = services.filter(s => s.status === 'degraded')
      
      let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
      
      if (unhealthyServices.length > 0) {
        overall = 'unhealthy'
      } else if (degradedServices.length > 0) {
        overall = 'degraded'
      }

      const report: SystemHealthReport = {
        overall,
        services,
        timestamp: start,
        uptime: Date.now() - this.startTime
      }

      this.lastCheck = report

      logger.info('Full health check completed', {
        metadata: {
          overall,
          services: services.length,
          unhealthy: unhealthyServices.length,
          degraded: degradedServices.length,
          duration: Date.now() - start
        }
      })

      return report

    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error : new Error('Unknown error')
      })

      throw error
    }
  }

  getLastCheck(): SystemHealthReport | null {
    return this.lastCheck
  }

  getUptime(): number {
    return Date.now() - this.startTime
  }

  // Quick health check for endpoints
  async quickHealthCheck(): Promise<{ status: 'ok' | 'error'; uptime: number }> {
    try {
      // Just check if we can access basic services
      const redis = redisManager.getClient()
      const redisOk = redis ? await redis.ping().then(() => true).catch(() => false) : false
      
      return {
        status: redisOk ? 'ok' : 'error',
        uptime: this.getUptime()
      }
    } catch {
      return {
        status: 'error',
        uptime: this.getUptime()
      }
    }
  }
}

export const healthChecker = new HealthChecker()