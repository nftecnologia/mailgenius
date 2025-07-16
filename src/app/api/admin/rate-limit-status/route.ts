import { NextRequest, NextResponse } from 'next/server'
import { rateLimitMonitor } from '@/lib/rate-limit-monitor'
import { redisManager } from '@/lib/redis'
import { RateLimitConfigHelper } from '@/lib/rate-limit-config'

export async function GET(request: NextRequest) {
  try {
    // Simple auth check - in production, you'd want proper admin auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const includeAlerts = searchParams.get('include_alerts') === 'true'
    const includeTopIdentifiers = searchParams.get('include_top_identifiers') === 'true'

    // Get comprehensive rate limit status
    const status = await getRateLimitStatus(includeAlerts, includeTopIdentifiers)

    if (format === 'prometheus') {
      return new NextResponse(formatPrometheusMetrics(status), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      })
    }

    return NextResponse.json(status)

  } catch (error) {
    console.error('Rate limit status error:', error)
    return NextResponse.json(
      { error: 'Failed to get rate limit status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Simple auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'reset_metrics':
        rateLimitMonitor.resetMetrics()
        return NextResponse.json({ message: 'Metrics reset successfully' })

      case 'clear_alerts':
        rateLimitMonitor.clearAlerts()
        return NextResponse.json({ message: 'Alerts cleared successfully' })

      case 'test_redis':
        const redisStatus = await testRedisConnection()
        return NextResponse.json({ redis: redisStatus })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Rate limit action error:', error)
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    )
  }
}

async function getRateLimitStatus(includeAlerts: boolean, includeTopIdentifiers: boolean) {
  const metrics = rateLimitMonitor.getMetrics()
  const healthCheck = rateLimitMonitor.getHealthCheck()
  
  const config = {
    environment: RateLimitConfigHelper.getCurrentEnvironment(),
    enabled: RateLimitConfigHelper.isRateLimitEnabled(),
    useRedis: RateLimitConfigHelper.shouldUseRedis(),
    redisConnected: redisManager.isReady()
  }

  const redisInfo = await getRedisInfo()

  const status = {
    timestamp: new Date().toISOString(),
    health: healthCheck,
    config,
    redis: redisInfo,
    metrics: {
      totalRequests: metrics.totalRequests,
      allowedRequests: metrics.allowedRequests,
      blockedRequests: metrics.blockedRequests,
      blockRate: metrics.totalRequests > 0 ? metrics.blockedRequests / metrics.totalRequests : 0,
      profileStats: metrics.profileStats
    }
  }

  // Add alerts if requested
  if (includeAlerts) {
    (status as any).alerts = {
      total: rateLimitMonitor.getAlerts().length,
      critical: rateLimitMonitor.getAlertsBySeverity('critical').length,
      high: rateLimitMonitor.getAlertsBySeverity('high').length,
      medium: rateLimitMonitor.getAlertsBySeverity('medium').length,
      low: rateLimitMonitor.getAlertsBySeverity('low').length,
      recent: rateLimitMonitor.getAlerts(10)
    }
  }

  // Add top identifiers if requested
  if (includeTopIdentifiers) {
    (status as any).topIdentifiers = {
      mostRequests: metrics.topIdentifiers.slice(0, 10),
      mostBlocked: rateLimitMonitor.getTopBlockedIdentifiers(10)
    }
  }

  return status
}

async function getRedisInfo() {
  try {
    const isConnected = redisManager.isReady()
    
    if (!isConnected) {
      return {
        connected: false,
        status: 'disconnected'
      }
    }

    const startTime = Date.now()
    const pingResult = await redisManager.ping()
    const latency = Date.now() - startTime

    return {
      connected: pingResult,
      latency,
      status: pingResult ? 'healthy' : 'error'
    }
  } catch (error) {
    return {
      connected: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function testRedisConnection() {
  try {
    const testKey = 'rate_limit_test_' + Date.now()
    const testValue = 'test_value'

    // Test write
    const setResult = await redisManager.set(testKey, testValue, 10)
    if (!setResult) {
      return { success: false, error: 'Failed to write to Redis' }
    }

    // Test read
    const getValue = await redisManager.get(testKey)
    if (getValue !== testValue) {
      return { success: false, error: 'Failed to read from Redis' }
    }

    // Test delete
    const delResult = await redisManager.del(testKey)
    if (!delResult) {
      return { success: false, error: 'Failed to delete from Redis' }
    }

    return { success: true, message: 'Redis connection test passed' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function formatPrometheusMetrics(status: any): string {
  const metrics = []

  // Rate limiting metrics
  metrics.push(`# HELP rate_limit_total_requests Total number of rate limit checks`)
  metrics.push(`# TYPE rate_limit_total_requests counter`)
  metrics.push(`rate_limit_total_requests ${status.metrics.totalRequests}`)

  metrics.push(`# HELP rate_limit_allowed_requests Number of allowed requests`)
  metrics.push(`# TYPE rate_limit_allowed_requests counter`)
  metrics.push(`rate_limit_allowed_requests ${status.metrics.allowedRequests}`)

  metrics.push(`# HELP rate_limit_blocked_requests Number of blocked requests`)
  metrics.push(`# TYPE rate_limit_blocked_requests counter`)
  metrics.push(`rate_limit_blocked_requests ${status.metrics.blockedRequests}`)

  metrics.push(`# HELP rate_limit_block_rate Current block rate`)
  metrics.push(`# TYPE rate_limit_block_rate gauge`)
  metrics.push(`rate_limit_block_rate ${status.metrics.blockRate}`)

  // Redis metrics
  metrics.push(`# HELP rate_limit_redis_connected Redis connection status`)
  metrics.push(`# TYPE rate_limit_redis_connected gauge`)
  metrics.push(`rate_limit_redis_connected ${status.redis.connected ? 1 : 0}`)

  if (status.redis.latency !== undefined) {
    metrics.push(`# HELP rate_limit_redis_latency_ms Redis latency in milliseconds`)
    metrics.push(`# TYPE rate_limit_redis_latency_ms gauge`)
    metrics.push(`rate_limit_redis_latency_ms ${status.redis.latency}`)
  }

  // Profile-specific metrics
  Object.entries(status.metrics.profileStats).forEach(([profile, stats]: [string, any]) => {
    metrics.push(`# HELP rate_limit_profile_requests_total Total requests per profile`)
    metrics.push(`# TYPE rate_limit_profile_requests_total counter`)
    metrics.push(`rate_limit_profile_requests_total{profile="${profile}"} ${stats.requests}`)

    metrics.push(`# HELP rate_limit_profile_blocked_total Blocked requests per profile`)
    metrics.push(`# TYPE rate_limit_profile_blocked_total counter`)
    metrics.push(`rate_limit_profile_blocked_total{profile="${profile}"} ${stats.blocked}`)

    metrics.push(`# HELP rate_limit_profile_avg_response_time_ms Average response time per profile`)
    metrics.push(`# TYPE rate_limit_profile_avg_response_time_ms gauge`)
    metrics.push(`rate_limit_profile_avg_response_time_ms{profile="${profile}"} ${stats.avgResponseTime}`)
  })

  // Health status
  const healthStatus = status.health.status === 'healthy' ? 1 : 0
  metrics.push(`# HELP rate_limit_health_status Overall health status`)
  metrics.push(`# TYPE rate_limit_health_status gauge`)
  metrics.push(`rate_limit_health_status ${healthStatus}`)

  return metrics.join('\n') + '\n'
}