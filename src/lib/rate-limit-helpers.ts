import { NextRequest } from 'next/server'
import { rateLimiter, createRateLimitConfig, RateLimitProfile } from './rate-limiter'
import { createAPIError } from './api-auth'

export interface RateLimitInfo {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
  headers: Record<string, string>
}

export class RateLimitHelper {
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

  private static createHeaders(limit: number, remaining: number, resetTime: number, retryAfter?: number): Record<string, string> {
    const headers: Record<string, string> = {
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

  static async checkRateLimit(
    req: NextRequest,
    profile: RateLimitProfile,
    identifierType: 'ip' | 'api_key' | 'custom' = 'ip',
    customIdentifier?: string
  ): Promise<RateLimitInfo> {
    let identifier: string

    switch (identifierType) {
      case 'ip':
        identifier = this.getClientIP(req)
        break
      case 'api_key':
        identifier = this.getAPIKey(req) || this.getClientIP(req)
        break
      case 'custom':
        identifier = customIdentifier || this.getClientIP(req)
        break
      default:
        identifier = this.getClientIP(req)
    }

    const config = createRateLimitConfig(identifier, profile)
    const result = await rateLimiter.checkLimit(config)

    const headers = this.createHeaders(
      result.limit,
      result.remaining,
      result.resetTime,
      result.retryAfter
    )

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetTime: result.resetTime,
      retryAfter: result.retryAfter,
      headers
    }
  }

  // Specific rate limit checks for different endpoint types
  static async checkAuthRateLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'AUTH_STRICT', 'ip')
  }

  static async checkAPIRateLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'API_STANDARD', 'api_key')
  }

  static async checkAPIBurstLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'API_BURST', 'api_key')
  }

  static async checkEmailSendingLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'EMAIL_SENDING', 'api_key')
  }

  static async checkCampaignCreationLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'CAMPAIGN_CREATION', 'api_key')
  }

  static async checkCampaignSendingLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'CAMPAIGN_SENDING', 'api_key')
  }

  static async checkDataImportLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'DATA_IMPORT', 'api_key')
  }

  static async checkWebhookLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'WEBHOOK_PROCESSING', 'ip')
  }

  static async checkPublicAPILimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'PUBLIC_API_IP', 'ip')
  }

  static async checkAnalyticsLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkRateLimit(req, 'ANALYTICS_HEAVY', 'api_key')
  }

  // Multiple rate limit checks (e.g., both burst and sustained limits)
  static async checkMultipleRateLimits(
    req: NextRequest,
    profiles: RateLimitProfile[],
    identifierType: 'ip' | 'api_key' = 'api_key'
  ): Promise<RateLimitInfo> {
    for (const profile of profiles) {
      const result = await this.checkRateLimit(req, profile, identifierType)
      if (!result.allowed) {
        return result
      }
    }

    // If all checks pass, return the most restrictive one (first in array)
    return this.checkRateLimit(req, profiles[0], identifierType)
  }

  // Check both burst and sustained limits for API endpoints
  static async checkAPIWithBurstLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkMultipleRateLimits(req, ['API_BURST', 'API_STANDARD'], 'api_key')
  }

  // Check both burst and sustained limits for email sending
  static async checkEmailWithBurstLimit(req: NextRequest): Promise<RateLimitInfo> {
    return this.checkMultipleRateLimits(req, ['EMAIL_BURST', 'EMAIL_SENDING'], 'api_key')
  }

  // Helper to create rate limit error response
  static createRateLimitError(
    rateLimitInfo: RateLimitInfo,
    message: string = 'Rate limit exceeded'
  ) {
    return createAPIError(message, 429, 'RATE_LIMIT_EXCEEDED', rateLimitInfo.headers)
  }
}

// Convenience wrapper for API route handlers
export function withRateLimit(
  profile: RateLimitProfile,
  identifierType: 'ip' | 'api_key' | 'custom' = 'ip',
  customIdentifier?: string
) {
  return function(handler: (req: NextRequest, ...args: any[]) => Promise<Response>) {
    return async function(req: NextRequest, ...args: any[]): Promise<Response> {
      const rateLimitInfo = await RateLimitHelper.checkRateLimit(
        req,
        profile,
        identifierType,
        customIdentifier
      )

      if (!rateLimitInfo.allowed) {
        return RateLimitHelper.createRateLimitError(rateLimitInfo)
      }

      const response = await handler(req, ...args)

      // Add rate limit headers to successful responses
      Object.entries(rateLimitInfo.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }
  }
}

// Specific decorators for common patterns
export const withAuthRateLimit = withRateLimit('AUTH_STRICT', 'ip')
export const withAPIRateLimit = withRateLimit('API_STANDARD', 'api_key')
export const withBurstRateLimit = withRateLimit('API_BURST', 'api_key')
export const withEmailRateLimit = withRateLimit('EMAIL_SENDING', 'api_key')
export const withCampaignRateLimit = withRateLimit('CAMPAIGN_CREATION', 'api_key')
export const withWebhookRateLimit = withRateLimit('WEBHOOK_PROCESSING', 'ip')
export const withPublicAPIRateLimit = withRateLimit('PUBLIC_API_IP', 'ip')

// Helper for manual rate limit checks in existing code
export async function checkAndHandleRateLimit(
  req: NextRequest,
  profile: RateLimitProfile,
  identifierType: 'ip' | 'api_key' = 'api_key'
): Promise<{ allowed: boolean; response?: Response; headers: Record<string, string> }> {
  const rateLimitInfo = await RateLimitHelper.checkRateLimit(req, profile, identifierType)

  if (!rateLimitInfo.allowed) {
    return {
      allowed: false,
      response: RateLimitHelper.createRateLimitError(rateLimitInfo),
      headers: rateLimitInfo.headers
    }
  }

  return {
    allowed: true,
    headers: rateLimitInfo.headers
  }
}