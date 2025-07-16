import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { redisManager } from '@/lib/redis'
import { metricsCollector } from '@/lib/monitoring/metrics'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const redis = redisManager.getClient()
    if (!redis) {
      throw new Error('Redis client not available')
    }

    // Get system overview
    const systemData = await redis.hgetall('queue:system:overview')
    const overview = {
      totalJobs: parseInt(systemData.totalJobs || '0'),
      processingJobs: parseInt(systemData.processingJobs || '0'),
      completedJobs: parseInt(systemData.completedJobs || '0'),
      failedJobs: parseInt(systemData.failedJobs || '0'),
      totalWorkers: parseInt(systemData.totalWorkers || '0'),
      activeWorkers: parseInt(systemData.activeWorkers || '0'),
      systemLoad: parseFloat(systemData.systemLoad || '0'),
      memoryUsage: parseFloat(systemData.memoryUsage || '0')
    }

    // Get queue statuses
    const queueKeys = await redis.keys('queue:status:*')
    const queues = await Promise.all(
      queueKeys.map(async (key) => {
        const queueName = key.replace('queue:status:', '')
        const queueData = await redis.hgetall(key)
        const workerData = await redis.hgetall(`queue:workers:${queueName}`)
        const metricsData = await redis.hgetall(`queue:metrics:${queueName}`)
        
        return {
          name: queueName,
          type: queueData.type || 'unknown',
          status: queueData.status || 'unknown',
          size: parseInt(queueData.size || '0'),
          processing: parseInt(queueData.processing || '0'),
          completed: parseInt(queueData.completed || '0'),
          failed: parseInt(queueData.failed || '0'),
          retries: parseInt(queueData.retries || '0'),
          throughput: parseFloat(queueData.throughput || '0'),
          avgProcessingTime: parseFloat(queueData.avgProcessingTime || '0'),
          oldestJob: parseInt(queueData.oldestJob || Date.now().toString()),
          workers: {
            total: parseInt(workerData.total || '0'),
            active: parseInt(workerData.active || '0'),
            idle: parseInt(workerData.idle || '0'),
            failed: parseInt(workerData.failed || '0')
          },
          metrics: {
            successRate: parseFloat(metricsData.successRate || '0'),
            errorRate: parseFloat(metricsData.errorRate || '0'),
            avgLatency: parseFloat(metricsData.avgLatency || '0'),
            memoryUsage: parseFloat(metricsData.memoryUsage || '0'),
            cpuUsage: parseFloat(metricsData.cpuUsage || '0')
          }
        }
      })
    )

    // Get trend data
    const trends = {
      throughput: await metricsCollector.getMetricsByWindow('queue.throughput', 5, 24),
      errorRate: await metricsCollector.getMetricsByWindow('queue.errorRate', 5, 24),
      latency: await metricsCollector.getMetricsByWindow('queue.latency', 5, 24),
      workers: await metricsCollector.getMetricsByWindow('queue.workers', 5, 24)
    }

    // Get alerts
    const alertKeys = await redis.keys('queue:alert:*')
    const alerts = await Promise.all(
      alertKeys.map(async (key) => {
        const alertData = await redis.hgetall(key)
        return {
          id: key.replace('queue:alert:', ''),
          queue: alertData.queue,
          type: alertData.type,
          severity: alertData.severity,
          message: alertData.message,
          timestamp: parseInt(alertData.timestamp || '0'),
          acknowledged: alertData.acknowledged === 'true'
        }
      })
    )

    const metrics = {
      overview,
      queues: queues.sort((a, b) => a.name.localeCompare(b.name)),
      trends,
      alerts: alerts.filter(alert => !alert.acknowledged).sort((a, b) => b.timestamp - a.timestamp)
    }

    logger.info('Queue health metrics retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        totalJobs: overview.totalJobs,
        activeWorkers: overview.activeWorkers,
        queues: queues.length,
        alerts: alerts.length
      }
    })

    return NextResponse.json(metrics)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve queue health metrics', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}