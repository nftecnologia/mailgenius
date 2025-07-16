import { RateLimitProfile } from './rate-limiter'

// Configuration for different environments
export const ENVIRONMENT_CONFIGS = {
  development: {
    // More permissive limits for development
    multiplier: 10, // 10x more requests allowed
    enabled: process.env.NODE_ENV !== 'development' || process.env.RATE_LIMIT_ENABLED === 'true',
    redis: {
      enabled: false, // Use memory in development
      fallback: true
    }
  },
  
  staging: {
    multiplier: 5, // 5x more requests for staging
    enabled: true,
    redis: {
      enabled: true,
      fallback: true
    }
  },
  
  production: {
    multiplier: 1, // Standard limits
    enabled: true,
    redis: {
      enabled: true,
      fallback: true
    }
  }
}

// Route-specific rate limit configurations
export const ROUTE_RATE_LIMITS: Record<string, {
  profile: RateLimitProfile
  identifierType: 'ip' | 'api_key' | 'user'
  bypassRoles?: string[]
}> = {
  // Authentication routes
  '/api/auth/login': {
    profile: 'AUTH_STRICT',
    identifierType: 'ip'
  },
  '/api/auth/register': {
    profile: 'AUTH_STRICT',
    identifierType: 'ip'
  },
  '/api/auth/forgot-password': {
    profile: 'AUTH_STRICT',
    identifierType: 'ip'
  },
  '/api/auth/reset-password': {
    profile: 'AUTH_STRICT',
    identifierType: 'ip'
  },

  // Public API routes
  '/api/public/v1/campaigns': {
    profile: 'API_STANDARD',
    identifierType: 'api_key'
  },
  '/api/public/v1/campaigns/send': {
    profile: 'CAMPAIGN_SENDING',
    identifierType: 'api_key'
  },
  '/api/public/v1/leads': {
    profile: 'API_STANDARD',
    identifierType: 'api_key'
  },
  '/api/public/v1/templates': {
    profile: 'API_STANDARD',
    identifierType: 'api_key'
  },
  '/api/public/v1/analytics': {
    profile: 'ANALYTICS_HEAVY',
    identifierType: 'api_key'
  },

  // Data operations
  '/api/data/import': {
    profile: 'DATA_IMPORT',
    identifierType: 'user',
    bypassRoles: ['admin', 'super_admin']
  },
  '/api/data/export': {
    profile: 'DATA_EXPORT',
    identifierType: 'user'
  },

  // Email sending
  '/api/email/send': {
    profile: 'EMAIL_SENDING',
    identifierType: 'user'
  },

  // Webhook endpoints
  '/api/webhooks/*': {
    profile: 'WEBHOOK_PROCESSING',
    identifierType: 'ip'
  },

  // Admin routes (more permissive)
  '/api/admin/*': {
    profile: 'API_STANDARD',
    identifierType: 'user',
    bypassRoles: ['super_admin']
  }
}

// IP whitelist for bypassing rate limits
export const IP_WHITELIST = [
  // Add trusted IPs here
  '127.0.0.1',
  '::1',
  // Add your server IPs
  // '192.168.1.100',
  // '10.0.0.0/8'
]

// API key whitelist for bypassing rate limits
export const API_KEY_WHITELIST = [
  // Add trusted API keys here (partial match)
  // 'es_live_trusted_key_'
]

// User role hierarchy for bypassing rate limits
export const ROLE_HIERARCHY = {
  super_admin: ['admin', 'user'],
  admin: ['user'],
  user: []
}

// Dynamic rate limit adjustments based on user tier
export const USER_TIER_MULTIPLIERS = {
  free: 1,
  pro: 5,
  enterprise: 20,
  unlimited: 1000
}

// Time-based rate limit adjustments
export const TIME_BASED_ADJUSTMENTS = {
  // Lower limits during peak hours
  peakHours: {
    start: 9, // 9 AM
    end: 17,  // 5 PM
    multiplier: 0.7
  },
  
  // Higher limits during off-hours
  offHours: {
    multiplier: 1.5
  },
  
  // Weekend adjustments
  weekend: {
    multiplier: 2
  }
}

// Burst protection configuration
export const BURST_PROTECTION = {
  enabled: true,
  windowMs: 1000, // 1 second
  maxBurstRequests: 10,
  penaltyMultiplier: 0.5 // Reduce limits by 50% after burst
}

// Rate limit bypass conditions
export interface BypassCondition {
  type: 'ip' | 'api_key' | 'user_role' | 'user_tier' | 'custom'
  value: string | string[]
  multiplier?: number // Instead of full bypass, apply multiplier
}

// Helper functions for rate limit configuration
export class RateLimitConfigHelper {
  static getCurrentEnvironment(): keyof typeof ENVIRONMENT_CONFIGS {
    return (process.env.NODE_ENV as keyof typeof ENVIRONMENT_CONFIGS) || 'development'
  }

  static getEnvironmentConfig() {
    return ENVIRONMENT_CONFIGS[this.getCurrentEnvironment()]
  }

  static shouldBypassRateLimit(
    ip: string,
    apiKey?: string,
    userRole?: string,
    userTier?: string
  ): { bypass: boolean; multiplier?: number } {
    // Check IP whitelist
    if (IP_WHITELIST.includes(ip)) {
      return { bypass: true }
    }

    // Check API key whitelist
    if (apiKey && API_KEY_WHITELIST.some(key => apiKey.startsWith(key))) {
      return { bypass: true }
    }

    // Check user role bypass
    if (userRole === 'super_admin') {
      return { bypass: true }
    }

    // Check user tier multiplier
    if (userTier && USER_TIER_MULTIPLIERS[userTier as keyof typeof USER_TIER_MULTIPLIERS]) {
      return {
        bypass: false,
        multiplier: USER_TIER_MULTIPLIERS[userTier as keyof typeof USER_TIER_MULTIPLIERS]
      }
    }

    return { bypass: false }
  }

  static getTimeBasedMultiplier(): number {
    const now = new Date()
    const hour = now.getHours()
    const isWeekend = now.getDay() === 0 || now.getDay() === 6

    if (isWeekend) {
      return TIME_BASED_ADJUSTMENTS.weekend.multiplier
    }

    if (hour >= TIME_BASED_ADJUSTMENTS.peakHours.start && 
        hour <= TIME_BASED_ADJUSTMENTS.peakHours.end) {
      return TIME_BASED_ADJUSTMENTS.peakHours.multiplier
    }

    return TIME_BASED_ADJUSTMENTS.offHours.multiplier
  }

  static getRouteConfig(path: string) {
    // Exact match first
    if (ROUTE_RATE_LIMITS[path]) {
      return ROUTE_RATE_LIMITS[path]
    }

    // Pattern matching
    for (const [pattern, config] of Object.entries(ROUTE_RATE_LIMITS)) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'))
        if (regex.test(path)) {
          return config
        }
      }
    }

    // Default configuration
    return {
      profile: 'API_STANDARD' as RateLimitProfile,
      identifierType: 'ip' as const
    }
  }

  static isRateLimitEnabled(): boolean {
    const config = this.getEnvironmentConfig()
    return config.enabled
  }

  static shouldUseRedis(): boolean {
    const config = this.getEnvironmentConfig()
    return config.redis.enabled
  }

  static getEffectiveLimit(
    baseLimit: number,
    userTier?: string,
    userRole?: string
  ): number {
    let multiplier = 1

    // Environment multiplier
    const envConfig = this.getEnvironmentConfig()
    multiplier *= envConfig.multiplier

    // User tier multiplier
    if (userTier && USER_TIER_MULTIPLIERS[userTier as keyof typeof USER_TIER_MULTIPLIERS]) {
      multiplier *= USER_TIER_MULTIPLIERS[userTier as keyof typeof USER_TIER_MULTIPLIERS]
    }

    // Time-based multiplier
    multiplier *= this.getTimeBasedMultiplier()

    // Role-based bypass
    if (userRole === 'super_admin') {
      multiplier *= 1000 // Essentially no limit
    } else if (userRole === 'admin') {
      multiplier *= 10
    }

    return Math.floor(baseLimit * multiplier)
  }
}

// Export default configuration
export const DEFAULT_RATE_LIMIT_CONFIG = {
  environment: RateLimitConfigHelper.getCurrentEnvironment(),
  enabled: RateLimitConfigHelper.isRateLimitEnabled(),
  useRedis: RateLimitConfigHelper.shouldUseRedis(),
  routes: ROUTE_RATE_LIMITS,
  whitelist: {
    ips: IP_WHITELIST,
    apiKeys: API_KEY_WHITELIST
  },
  burstProtection: BURST_PROTECTION,
  timeBasedAdjustments: TIME_BASED_ADJUSTMENTS
}