import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/queue/index'
import { workerManager } from '@/lib/queue/workers'
import { progressTracker } from '@/lib/queue/progress-tracker'
import { intelligentRateLimiter } from '@/lib/queue/rate-limiter'
import { supabase } from '@/lib/supabase'

// Admin endpoint - should be protected by authentication middleware
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const queueName = searchParams.get('queue')

    switch (action) {
      case 'status':
        return await getSystemStatus()
      
      case 'stats':
        return await getQueueStats(queueName)
      
      case 'workers':
        return await getWorkerStatus()
      
      case 'progress':
        return await getProgressStats()
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Queue admin API error:', error)
    return NextResponse.json(
      { error: 'Failed to get queue information' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, queueName, data } = body

    switch (action) {
      case 'pause':
        return await pauseQueue(queueName)
      
      case 'resume':
        return await resumeQueue(queueName)
      
      case 'clean':
        return await cleanQueue(queueName, data?.grace || 0)
      
      case 'restart-workers':
        return await restartWorkers()
      
      case 'retry-job':
        return await retryJob(queueName, data?.jobId)
      
      case 'remove-job':
        return await removeJob(queueName, data?.jobId)
      
      case 'reset-rate-limit':
        return await resetRateLimit(data?.identifier, data?.configKey)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Queue admin action error:', error)
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    )
  }
}

async function getSystemStatus() {
  const workerStatus = workerManager.getWorkerStatus()
  const workerStats = await workerManager.getWorkerStats()
  
  return NextResponse.json({
    success: true,
    system: {
      workers: workerStatus,
      queues: workerStats,
      timestamp: new Date().toISOString(),
    },
  })
}

async function getQueueStats(queueName?: string) {
  if (queueName) {
    const stats = await queueManager.getQueueStats(queueName)
    return NextResponse.json({
      success: true,
      queue: queueName,
      stats,
    })
  } else {
    const allStats = await workerManager.getWorkerStats()
    return NextResponse.json({
      success: true,
      queues: allStats,
    })
  }
}

async function getWorkerStatus() {
  const status = workerManager.getWorkerStatus()
  return NextResponse.json({
    success: true,
    workers: status,
  })
}

async function getProgressStats() {
  // Get global progress statistics
  const { data: progressData, error } = await supabase
    .from('progress_tracking')
    .select('type, status, created_at')
    .gte('created_at', new Date(Date.now() - 86400000).toISOString()) // Last 24 hours

  if (error) {
    throw error
  }

  const stats = {
    total: progressData.length,
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    recentActivity: progressData.slice(0, 50),
  }

  progressData.forEach(item => {
    stats.byType[item.type] = (stats.byType[item.type] || 0) + 1
    stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1
  })

  return NextResponse.json({
    success: true,
    progress: stats,
  })
}

async function pauseQueue(queueName: string) {
  const success = await workerManager.pauseWorker(queueName)
  return NextResponse.json({
    success,
    message: success ? `Queue ${queueName} paused` : `Failed to pause queue ${queueName}`,
  })
}

async function resumeQueue(queueName: string) {
  const success = await workerManager.resumeWorker(queueName)
  return NextResponse.json({
    success,
    message: success ? `Queue ${queueName} resumed` : `Failed to resume queue ${queueName}`,
  })
}

async function cleanQueue(queueName: string, grace: number) {
  const success = await workerManager.cleanWorkerQueue(queueName, grace)
  return NextResponse.json({
    success,
    message: success ? `Queue ${queueName} cleaned` : `Failed to clean queue ${queueName}`,
  })
}

async function restartWorkers() {
  try {
    await workerManager.restartWorkers()
    return NextResponse.json({
      success: true,
      message: 'Workers restarted successfully',
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to restart workers',
      error: error.message,
    })
  }
}

async function retryJob(queueName: string, jobId: string) {
  const success = await queueManager.retryJob(queueName, jobId)
  return NextResponse.json({
    success,
    message: success ? `Job ${jobId} retried` : `Failed to retry job ${jobId}`,
  })
}

async function removeJob(queueName: string, jobId: string) {
  const success = await queueManager.removeJob(queueName, jobId)
  return NextResponse.json({
    success,
    message: success ? `Job ${jobId} removed` : `Failed to remove job ${jobId}`,
  })
}

async function resetRateLimit(identifier: string, configKey: string) {
  const success = await intelligentRateLimiter.resetRateLimit(identifier, configKey)
  return NextResponse.json({
    success,
    message: success ? 'Rate limit reset' : 'Failed to reset rate limit',
  })
}