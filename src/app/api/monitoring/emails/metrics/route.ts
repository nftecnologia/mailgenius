import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { metricsCollector } from '@/lib/monitoring/metrics'
import { redisManager } from '@/lib/redis'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '1h'
    
    // Convert period to hours
    const periodHours = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 168
    }[period] || 1

    const redis = redisManager.getClient()
    if (!redis) {
      throw new Error('Redis client not available')
    }

    // Get real-time metrics
    const [
      sentMetric,
      deliveredMetric,
      bouncedMetric,
      openedMetric,
      clickedMetric,
      unsubscribedMetric,
      complainedMetric,
      queueMetric,
      sendingMetric,
      failedMetric
    ] = await Promise.all([
      metricsCollector.getTimeSeriesMetric('email.sent', periodHours),
      metricsCollector.getTimeSeriesMetric('email.delivered', periodHours),
      metricsCollector.getTimeSeriesMetric('email.bounced', periodHours),
      metricsCollector.getTimeSeriesMetric('email.opened', periodHours),
      metricsCollector.getTimeSeriesMetric('email.clicked', periodHours),
      metricsCollector.getTimeSeriesMetric('email.unsubscribed', periodHours),
      metricsCollector.getTimeSeriesMetric('email.complained', periodHours),
      metricsCollector.getTimeSeriesMetric('email.queued', periodHours),
      metricsCollector.getTimeSeriesMetric('email.sending', periodHours),
      metricsCollector.getTimeSeriesMetric('email.failed', periodHours)
    ])

    const realtime = {
      sent: sentMetric.aggregation.sum,
      delivered: deliveredMetric.aggregation.sum,
      bounced: bouncedMetric.aggregation.sum,
      opened: openedMetric.aggregation.sum,
      clicked: clickedMetric.aggregation.sum,
      unsubscribed: unsubscribedMetric.aggregation.sum,
      complained: complainedMetric.aggregation.sum,
      queue: queueMetric.aggregation.sum,
      sending: sendingMetric.aggregation.sum,
      failed: failedMetric.aggregation.sum
    }

    // Calculate rates
    const rates = {
      deliveryRate: realtime.sent > 0 ? (realtime.delivered / realtime.sent) * 100 : 0,
      openRate: realtime.delivered > 0 ? (realtime.opened / realtime.delivered) * 100 : 0,
      clickRate: realtime.opened > 0 ? (realtime.clicked / realtime.opened) * 100 : 0,
      bounceRate: realtime.sent > 0 ? (realtime.bounced / realtime.sent) * 100 : 0,
      unsubscribeRate: realtime.sent > 0 ? (realtime.unsubscribed / realtime.sent) * 100 : 0,
      complaintRate: realtime.sent > 0 ? (realtime.complained / realtime.sent) * 100 : 0
    }

    // Get trend data (last 24 points)
    const trendWindow = Math.max(1, periodHours / 24)
    const trends = {
      sent: await metricsCollector.getMetricsByWindow('email.sent', trendWindow * 60, 24),
      delivered: await metricsCollector.getMetricsByWindow('email.delivered', trendWindow * 60, 24),
      opened: await metricsCollector.getMetricsByWindow('email.opened', trendWindow * 60, 24),
      clicked: await metricsCollector.getMetricsByWindow('email.clicked', trendWindow * 60, 24)
    }

    // Get active campaigns
    const campaignKeys = await redis.keys('campaign:active:*')
    const campaigns = await Promise.all(
      campaignKeys.map(async (key) => {
        const campaignData = await redis.hgetall(key)
        return {
          id: key.replace('campaign:active:', ''),
          name: campaignData.name,
          status: campaignData.status,
          sent: parseInt(campaignData.sent || '0'),
          delivered: parseInt(campaignData.delivered || '0'),
          opened: parseInt(campaignData.opened || '0'),
          clicked: parseInt(campaignData.clicked || '0'),
          bounced: parseInt(campaignData.bounced || '0'),
          unsubscribed: parseInt(campaignData.unsubscribed || '0'),
          sendingRate: parseFloat(campaignData.sendingRate || '0'),
          estimatedCompletion: campaignData.estimatedCompletion ? parseInt(campaignData.estimatedCompletion) : undefined,
          errors: parseInt(campaignData.errors || '0')
        }
      })
    )

    // Get email providers status
    const providerKeys = await redis.keys('email:provider:*')
    const providers = await Promise.all(
      providerKeys.map(async (key) => {
        const providerData = await redis.hgetall(key)
        return {
          name: key.replace('email:provider:', ''),
          sent: parseInt(providerData.sent || '0'),
          delivered: parseInt(providerData.delivered || '0'),
          bounced: parseInt(providerData.bounced || '0'),
          avgLatency: parseFloat(providerData.avgLatency || '0'),
          status: providerData.status || 'unknown'
        }
      })
    )

    // Get throughput metrics
    const throughputData = await redis.hgetall('email:throughput')
    const throughput = {
      current: parseFloat(throughputData.current || '0'),
      peak: parseFloat(throughputData.peak || '0'),
      average: parseFloat(throughputData.average || '0'),
      capacity: parseFloat(throughputData.capacity || '10000') // Default capacity
    }

    const metrics = {
      realtime,
      rates,
      trends,
      campaigns,
      providers,
      throughput
    }

    logger.info('Email metrics retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { 
        period,
        sent: realtime.sent,
        delivered: realtime.delivered,
        campaigns: campaigns.length,
        providers: providers.length
      }
    })

    return NextResponse.json(metrics)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve email metrics', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}