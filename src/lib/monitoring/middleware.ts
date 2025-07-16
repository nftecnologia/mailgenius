import { NextRequest, NextResponse } from 'next/server'
import { metricsCollector } from './metrics'
import { logger } from '../logger'

export interface MonitoringMiddlewareConfig {
  enabled: boolean
  collectMetrics: boolean
  logRequests: boolean
  slowRequestThreshold: number // ms
  excludePaths: string[]
}

const DEFAULT_CONFIG: MonitoringMiddlewareConfig = {
  enabled: true,
  collectMetrics: true,
  logRequests: true,
  slowRequestThreshold: 1000,
  excludePaths: ['/api/monitoring/health', '/api/monitoring/metrics']
}

export function createMonitoringMiddleware(config: Partial<MonitoringMiddlewareConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  return async function monitoringMiddleware(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    if (!finalConfig.enabled) {
      return handler(request)
    }

    const startTime = Date.now()
    const path = request.nextUrl.pathname
    const method = request.method
    
    // Skip monitoring for excluded paths
    if (finalConfig.excludePaths.some(excludePath => path.startsWith(excludePath))) {
      return handler(request)
    }

    const requestContext = logger.createRequestContext(request)
    
    try {
      // Execute the handler
      const response = await handler(request)
      const duration = Date.now() - startTime
      const statusCode = response.status

      // Log the request
      if (finalConfig.logRequests) {
        logger.http(request, { status: statusCode }, duration)
      }

      // Collect metrics
      if (finalConfig.collectMetrics) {
        await Promise.all([
          metricsCollector.recordApiMetrics(path, method, statusCode, duration),
          metricsCollector.recordMetric('api.requests.total', 1, {
            method,
            path,
            status: statusCode.toString()
          })
        ])

        // Log slow requests
        if (duration > finalConfig.slowRequestThreshold) {
          logger.warn('Slow request detected', {
            ...requestContext,
            duration,
            statusCode,
            metadata: { threshold: finalConfig.slowRequestThreshold }
          })
        }
      }

      return response

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Log the error
      logger.error('Request failed', {
        ...requestContext,
        duration,
        error: error instanceof Error ? error : new Error(errorMessage)
      })

      // Collect error metrics
      if (finalConfig.collectMetrics) {
        await Promise.all([
          metricsCollector.recordApiMetrics(path, method, 500, duration),
          metricsCollector.recordMetric('api.errors.total', 1, {
            method,
            path,
            error: errorMessage
          })
        ])
      }

      throw error
    }
  }
}

// Rate limiting monitoring middleware
export function createRateLimitMonitoringMiddleware() {
  return async function rateLimitMonitoringMiddleware(
    request: NextRequest,
    allowed: boolean,
    remaining: number,
    resetTime: number
  ): Promise<void> {
    const path = request.nextUrl.pathname
    
    try {
      await metricsCollector.recordRateLimitMetrics(path, allowed, remaining)
      
      if (!allowed) {
        logger.warn('Rate limit exceeded', {
          ...logger.createRequestContext(request),
          metadata: { remaining, resetTime }
        })
      }
    } catch (error) {
      logger.error('Failed to record rate limit metrics', {
        ...logger.createRequestContext(request),
        error: error instanceof Error ? error : new Error('Unknown error')
      })
    }
  }
}

// Email monitoring middleware
export function createEmailMonitoringMiddleware() {
  return {
    async onEmailSent(
      recipientEmail: string,
      campaignId?: string,
      templateId?: string
    ): Promise<void> {
      try {
        await metricsCollector.recordEmailMetrics('sent', 1)
        
        logger.info('Email sent', {
          metadata: { recipientEmail, campaignId, templateId }
        })
      } catch (error) {
        logger.error('Failed to record email sent metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onEmailDelivered(
      recipientEmail: string,
      campaignId?: string
    ): Promise<void> {
      try {
        await metricsCollector.recordEmailMetrics('delivered', 1)
        
        logger.info('Email delivered', {
          metadata: { recipientEmail, campaignId }
        })
      } catch (error) {
        logger.error('Failed to record email delivered metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onEmailBounced(
      recipientEmail: string,
      bounceReason: string,
      campaignId?: string
    ): Promise<void> {
      try {
        await metricsCollector.recordEmailMetrics('bounced', 1)
        
        logger.warn('Email bounced', {
          metadata: { recipientEmail, bounceReason, campaignId }
        })
      } catch (error) {
        logger.error('Failed to record email bounced metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onEmailOpened(
      recipientEmail: string,
      campaignId?: string
    ): Promise<void> {
      try {
        await metricsCollector.recordEmailMetrics('opened', 1)
        
        logger.info('Email opened', {
          metadata: { recipientEmail, campaignId }
        })
      } catch (error) {
        logger.error('Failed to record email opened metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onEmailClicked(
      recipientEmail: string,
      linkUrl: string,
      campaignId?: string
    ): Promise<void> {
      try {
        await metricsCollector.recordEmailMetrics('clicked', 1)
        
        logger.info('Email clicked', {
          metadata: { recipientEmail, linkUrl, campaignId }
        })
      } catch (error) {
        logger.error('Failed to record email clicked metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    }
  }
}

// Campaign monitoring middleware
export function createCampaignMonitoringMiddleware() {
  return {
    async onCampaignCreated(
      campaignId: string,
      userId: string,
      type: string
    ): Promise<void> {
      try {
        await metricsCollector.recordCampaignMetrics('created', 1)
        
        logger.info('Campaign created', {
          metadata: { campaignId, userId, type }
        })
      } catch (error) {
        logger.error('Failed to record campaign created metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onCampaignSent(
      campaignId: string,
      userId: string,
      recipientCount: number
    ): Promise<void> {
      try {
        await metricsCollector.recordCampaignMetrics('sent', 1)
        
        logger.info('Campaign sent', {
          metadata: { campaignId, userId, recipientCount }
        })
      } catch (error) {
        logger.error('Failed to record campaign sent metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onCampaignCompleted(
      campaignId: string,
      userId: string,
      stats: {
        sent: number
        delivered: number
        bounced: number
        opened: number
        clicked: number
      }
    ): Promise<void> {
      try {
        await metricsCollector.recordCampaignMetrics('completed', 1)
        
        logger.info('Campaign completed', {
          metadata: { campaignId, userId, stats }
        })
      } catch (error) {
        logger.error('Failed to record campaign completed metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    }
  }
}

// User activity monitoring middleware
export function createUserMonitoringMiddleware() {
  return {
    async onUserLogin(userId: string, ip: string): Promise<void> {
      try {
        await metricsCollector.recordUserMetrics('login', userId)
        
        logger.info('User logged in', {
          metadata: { userId, ip }
        })
      } catch (error) {
        logger.error('Failed to record user login metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onUserLogout(userId: string): Promise<void> {
      try {
        await metricsCollector.recordUserMetrics('logout', userId)
        
        logger.info('User logged out', {
          metadata: { userId }
        })
      } catch (error) {
        logger.error('Failed to record user logout metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onUserSignup(userId: string, email: string): Promise<void> {
      try {
        await metricsCollector.recordUserMetrics('signup', userId)
        
        logger.info('User signed up', {
          metadata: { userId, email }
        })
      } catch (error) {
        logger.error('Failed to record user signup metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    },

    async onUserActivity(userId: string, activity: string): Promise<void> {
      try {
        await metricsCollector.recordUserMetrics('active', userId)
        
        logger.debug('User activity recorded', {
          metadata: { userId, activity }
        })
      } catch (error) {
        logger.error('Failed to record user activity metrics', {
          error: error instanceof Error ? error : new Error('Unknown error')
        })
      }
    }
  }
}

// Export middleware instances
export const monitoringMiddleware = createMonitoringMiddleware()
export const rateLimitMonitoringMiddleware = createRateLimitMonitoringMiddleware()
export const emailMonitoringMiddleware = createEmailMonitoringMiddleware()
export const campaignMonitoringMiddleware = createCampaignMonitoringMiddleware()
export const userMonitoringMiddleware = createUserMonitoringMiddleware()