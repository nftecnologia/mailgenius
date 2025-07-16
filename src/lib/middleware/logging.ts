import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export interface LoggingOptions {
  enableHttpLogging?: boolean
  enableSecurityLogging?: boolean
  logRequestBody?: boolean
  logResponseBody?: boolean
  excludePaths?: string[]
}

export function withLogging(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: LoggingOptions = {}
) {
  const {
    enableHttpLogging = true,
    enableSecurityLogging = true,
    logRequestBody = false,
    logResponseBody = false,
    excludePaths = ['/api/health', '/favicon.ico']
  } = options

  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const context = logger.createRequestContext(request)
    
    // Skip logging for excluded paths
    if (excludePaths.some(path => request.nextUrl.pathname.startsWith(path))) {
      return await handler(request)
    }

    let response: NextResponse
    let error: Error | undefined

    try {
      // Log incoming request
      if (enableHttpLogging) {
        logger.info(`Incoming request: ${request.method} ${request.nextUrl.pathname}`, context)
      }

      // Log security-related events
      if (enableSecurityLogging) {
        const authHeader = request.headers.get('authorization')
        const apiKey = request.headers.get('x-api-key')
        
        if (authHeader && !authHeader.startsWith('Bearer ')) {
          logger.security('Invalid authorization header format', context)
        }
        
        if (apiKey && !apiKey.startsWith('es_live_')) {
          logger.security('Invalid API key format', context)
        }
      }

      // Log request body if enabled (be careful with sensitive data)
      if (logRequestBody && request.body) {
        try {
          const body = await request.text()
          logger.debug('Request body received', { ...context, metadata: { bodySize: body.length } })
        } catch (err) {
          logger.warn('Failed to read request body for logging', context)
        }
      }

      // Execute the handler
      response = await handler(request)

      // Log response
      if (enableHttpLogging) {
        const duration = Date.now() - startTime
        logger.http(request, { status: response.status }, duration)
      }

      return response

    } catch (err) {
      error = err as Error
      const duration = Date.now() - startTime
      
      logger.error(`Request failed: ${request.method} ${request.nextUrl.pathname}`, context, error)
      
      // Create error response
      response = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
      
      if (enableHttpLogging) {
        logger.http(request, { status: 500 }, duration)
      }
      
      return response
    }
  }
}

// Middleware helper for API routes
export function withAPILogging(
  handler: (request: NextRequest) => Promise<NextResponse | Response>,
  options: LoggingOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    const startTime = Date.now()
    const context = logger.createRequestContext(request)
    
    try {
      logger.api(request.nextUrl.pathname, request.method, undefined, context)
      
      const response = await handler(request)
      const duration = Date.now() - startTime
      
      const status = response instanceof NextResponse ? response.status : 200
      logger.performance(`API ${request.method} ${request.nextUrl.pathname}`, duration, context)
      
      return response
      
    } catch (err) {
      const error = err as Error
      const duration = Date.now() - startTime
      
      logger.error(`API error: ${request.method} ${request.nextUrl.pathname}`, context, error)
      logger.performance(`API ${request.method} ${request.nextUrl.pathname} (failed)`, duration, context)
      
      throw error
    }
  }
}

// Helper to log authentication events
export function logAuthEvent(event: string, userId?: string, additionalContext?: Record<string, any>) {
  logger.auth(event, userId, { metadata: additionalContext })
}

// Helper to log webhook events
export function logWebhookEvent(event: string, data: any, additionalContext?: Record<string, any>) {
  logger.webhook(event, data, { metadata: additionalContext })
}

// Helper to log security events
export function logSecurityEvent(event: string, context?: Record<string, any>) {
  logger.security(event, { metadata: context })
}

// Helper to log performance metrics
export function logPerformance(operation: string, duration: number, context?: Record<string, any>) {
  logger.performance(operation, duration, { metadata: context })
}