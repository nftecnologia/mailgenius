import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { redisManager } from '@/lib/redis'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const redis = redisManager.getClient()
    if (!redis) {
      throw new Error('Redis client not available')
    }

    // Get system metrics
    const systemMetrics = await redis.hgetall('import:system:metrics')
    
    // Get queue metrics
    const queueMetrics = await redis.hgetall('import:queue:metrics')
    
    // Get worker metrics
    const workerMetrics = await redis.hgetall('import:worker:metrics')

    // Calculate aggregated metrics
    const totalJobs = parseInt(systemMetrics.totalJobs || '0')
    const activeJobs = parseInt(systemMetrics.activeJobs || '0')
    const completedJobs = parseInt(systemMetrics.completedJobs || '0')
    const failedJobs = parseInt(systemMetrics.failedJobs || '0')
    const totalRecordsProcessed = parseInt(systemMetrics.totalRecordsProcessed || '0')
    const totalRecordsImported = parseInt(systemMetrics.totalRecordsImported || '0')
    const averageThroughput = parseFloat(systemMetrics.averageThroughput || '0')
    const errorRate = parseFloat(systemMetrics.errorRate || '0')
    const systemLoad = parseFloat(systemMetrics.systemLoad || '0')
    const memoryUsage = parseFloat(systemMetrics.memoryUsage || '0')
    const queueSize = parseInt(queueMetrics.size || '0')
    const workerCount = parseInt(workerMetrics.total || '0')
    const activeWorkers = parseInt(workerMetrics.active || '0')

    const metrics = {
      totalJobs,
      activeJobs,
      completedJobs,
      failedJobs,
      totalRecordsProcessed,
      totalRecordsImported,
      averageThroughput,
      errorRate,
      systemLoad,
      memoryUsage,
      queueSize,
      workerCount,
      activeWorkers
    }

    logger.info('Import metrics retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        totalJobs,
        activeJobs,
        queueSize,
        activeWorkers
      }
    })

    return NextResponse.json(metrics)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve import metrics', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}