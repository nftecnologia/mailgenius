import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter, RateLimitProfile, createRateLimitConfig } from '../rate-limiter'

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
  'X-RateLimit-Reset-Time': string
  'Retry-After'?: string
}

export interface RateLimitMiddlewareOptions {
  profile?: RateLimitProfile
  identifierKey?: 'ip' | 'user' | 'apiKey' | 'custom'
  customIdentifier?: (req: NextRequest) => string
  onLimitReached?: (req: NextRequest) => NextResponse
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  standardHeaders?: boolean
  legacyHeaders?: boolean
}

export class RateLimitMiddleware {
  private static getIdentifier(req: NextRequest, options: RateLimitMiddlewareOptions): string {
    switch (options.identifierKey) {
      case 'ip':
        return this.getClientIP(req)
      case 'user':
        return this.getUserId(req) || this.getClientIP(req)
      case 'apiKey':
        return this.getAPIKey(req) || this.getClientIP(req)
      case 'custom':
        return options.customIdentifier?.(req) || this.getClientIP(req)
      default:
        return this.getClientIP(req)
    }
  }

  private static getClientIP(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for')
    const real = req.headers.get('x-real-ip')
    const clientIP = req.headers.get('cf-connecting-ip')
    
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    if (real) {
      return real.trim()
    }
    if (clientIP) {
      return clientIP.trim()
    }
    
    return req.ip || 'unknown'
  }

  private static getUserId(req: NextRequest): string | null {
    // Extract user ID from JWT token or session
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      // This would need to be implemented based on your auth system
      // For now, return null to fall back to IP
      return null
    }
    return null
  }

  private static getAPIKey(req: NextRequest): string | null {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      if (token.startsWith('es_live_')) {
        return token
      }
    }
    return null
  }

  private static createRateLimitHeaders(
    limit: number,
    remaining: number,
    resetTime: number,
    retryAfter?: number
  ): RateLimitHeaders {
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
      'X-RateLimit-Reset-Time': new Date(resetTime).toISOString()
    }

    if (retryAfter) {
      headers['Retry-After'] = retryAfter.toString()
    }

    return headers
  }

  private static createRateLimitResponse(
    message: string,
    headers: RateLimitHeaders
  ): NextResponse {
    const response = NextResponse.json({
      error: {
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
      }
    }, { status: 429 })

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }

  static async check(
    req: NextRequest,
    options: RateLimitMiddlewareOptions = {}
  ): Promise<{ success: boolean; response?: NextResponse; headers?: RateLimitHeaders }> {
    const {
      profile = 'API_STANDARD',
      identifierKey = 'ip',
      standardHeaders = true,
      onLimitReached
    } = options

    try {
      const identifier = this.getIdentifier(req, options)
      const config = createRateLimitConfig(identifier, profile)
      
      const result = await rateLimiter.checkLimit(config)

      const headers = standardHeaders ? 
        this.createRateLimitHeaders(
          result.limit,
          result.remaining,
          result.resetTime,
          result.retryAfter
        ) : undefined

      if (!result.allowed) {
        const response = onLimitReached?.(req) || 
          this.createRateLimitResponse(
            config.options.message || 'Rate limit exceeded',
            headers!
          )

        return {
          success: false,
          response,
          headers
        }
      }

      return {
        success: true,
        headers
      }
    } catch (error) {
      console.error('Rate limit check error:', error)
      // On error, allow the request to proceed
      return { success: true }
    }
  }
}

// Convenience function for API routes
export async function withRateLimit(
  req: NextRequest,
  options: RateLimitMiddlewareOptions = {}
): Promise<{ success: boolean; response?: NextResponse; headers?: RateLimitHeaders }> {
  return RateLimitMiddleware.check(req, options)
}

// Higher-order function for wrapping API route handlers
export function rateLimitWrapper(
  options: RateLimitMiddlewareOptions = {}
) {
  return function<T extends any[]>(
    handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
  ) {
    return async function(req: NextRequest, ...args: T): Promise<NextResponse> {
      const limitCheck = await withRateLimit(req, options)
      
      if (!limitCheck.success) {
        return limitCheck.response!
      }

      const response = await handler(req, ...args)

      // Add rate limit headers to successful responses
      if (limitCheck.headers && options.standardHeaders !== false) {
        Object.entries(limitCheck.headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
      }

      return response
    }
  }
}

// Multiple rate limit checks (for burst + sustained limits)
export async function withMultipleRateLimits(
  req: NextRequest,
  limits: Array<{ profile: RateLimitProfile; identifierKey?: 'ip' | 'user' | 'apiKey' }>
): Promise<{ success: boolean; response?: NextResponse; headers?: RateLimitHeaders }> {
  for (const limit of limits) {
    const result = await withRateLimit(req, limit)
    if (!result.success) {
      return result
    }
  }
  
  return { success: true }
}

// Specific rate limit functions for common patterns
export const rateLimitAuth = (req: NextRequest) => 
  withRateLimit(req, { profile: 'AUTH_STRICT', identifierKey: 'ip' })

export const rateLimitAPI = (req: NextRequest) => 
  withRateLimit(req, { profile: 'API_STANDARD', identifierKey: 'apiKey' })

export const rateLimitBurst = (req: NextRequest) => 
  withRateLimit(req, { profile: 'API_BURST', identifierKey: 'apiKey' })

export const rateLimitEmailSending = (req: NextRequest) =>
  withRateLimit(req, { profile: 'EMAIL_SENDING', identifierKey: 'user' })

export const rateLimitCampaignCreation = (req: NextRequest) =>
  withRateLimit(req, { profile: 'CAMPAIGN_CREATION', identifierKey: 'user' })

export const rateLimitDataImport = (req: NextRequest) =>
  withRateLimit(req, { profile: 'DATA_IMPORT', identifierKey: 'user' })

export const rateLimitWebhook = (req: NextRequest) =>
  withRateLimit(req, { profile: 'WEBHOOK_PROCESSING', identifierKey: 'ip' })

export const rateLimitPublicAPI = (req: NextRequest) =>
  withRateLimit(req, { profile: 'PUBLIC_API_IP', identifierKey: 'ip' })