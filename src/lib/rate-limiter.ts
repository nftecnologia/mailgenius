import { redisManager } from './redis'

export interface RateLimitOptions {
  windowMs: number
  max: number
  skipFailedRequests?: boolean
  skipSuccessfulRequests?: boolean
  keyPrefix?: string
  message?: string
  standardHeaders?: boolean
  legacyHeaders?: boolean
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

export interface RateLimitConfig {
  identifier: string
  options: RateLimitOptions
}

// Pre-configured rate limit profiles
export const RATE_LIMIT_PROFILES = {
  // Authentication endpoints
  AUTH_STRICT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts'
  },
  AUTH_NORMAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: 'Too many authentication attempts'
  },

  // API endpoints
  API_STANDARD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // 1000 requests per hour
    message: 'Rate limit exceeded'
  },
  API_HEAVY: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200, // 200 requests per hour for heavy operations
    message: 'Rate limit exceeded for heavy operations'
  },
  API_BURST: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Burst rate limit exceeded'
  },

  // Email sending
  EMAIL_SENDING: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // 1000 emails per hour
    message: 'Email sending rate limit exceeded'
  },
  EMAIL_BURST: {
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 emails per minute
    message: 'Email burst rate limit exceeded'
  },

  // Campaign operations
  CAMPAIGN_CREATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 campaigns per hour
    message: 'Campaign creation rate limit exceeded'
  },
  CAMPAIGN_SENDING: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 campaign sends per hour
    message: 'Campaign sending rate limit exceeded'
  },

  // Data operations
  DATA_IMPORT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 imports per hour
    message: 'Data import rate limit exceeded'
  },
  DATA_EXPORT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 exports per hour
    message: 'Data export rate limit exceeded'
  },

  // Analytics
  ANALYTICS_HEAVY: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 heavy analytics requests per hour
    message: 'Analytics rate limit exceeded'
  },

  // Public API by IP
  PUBLIC_API_IP: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10000, // 10k requests per hour per IP
    message: 'IP rate limit exceeded'
  },

  // Webhook endpoints
  WEBHOOK_PROCESSING: {
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 webhook calls per minute
    message: 'Webhook rate limit exceeded'
  }
} as const

export type RateLimitProfile = keyof typeof RATE_LIMIT_PROFILES

class DistributedRateLimiter {
  private memoryStore = new Map<string, { count: number; resetTime: number }>()
  private readonly defaultOptions: Partial<RateLimitOptions> = {
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    keyPrefix: 'rl:',
    standardHeaders: true,
    legacyHeaders: false
  }

  private getKey(identifier: string, prefix: string = 'rl:'): string {
    return `${prefix}${identifier}`
  }

  private async getFromRedis(key: string): Promise<{ count: number; resetTime: number } | null> {
    try {
      const redis = redisManager.getClient()
      if (!redis) return null

      const pipeline = redis.pipeline()
      pipeline.get(key)
      pipeline.ttl(key)
      
      const results = await pipeline.exec()
      
      if (!results || results.length !== 2) return null
      
      const [countResult, ttlResult] = results
      const count = countResult && countResult[1] ? parseInt(countResult[1] as string) : 0
      const ttl = ttlResult && ttlResult[1] ? parseInt(ttlResult[1] as string) : -1
      
      if (ttl <= 0) return null
      
      return {
        count,
        resetTime: Date.now() + (ttl * 1000)
      }
    } catch (error) {
      console.error('Redis rate limiter get error:', error)
      return null
    }
  }

  private async setInRedis(key: string, count: number, windowMs: number): Promise<boolean> {
    try {
      const redis = redisManager.getClient()
      if (!redis) return false

      const pipeline = redis.pipeline()
      pipeline.set(key, count.toString())
      pipeline.expire(key, Math.ceil(windowMs / 1000))
      
      await pipeline.exec()
      return true
    } catch (error) {
      console.error('Redis rate limiter set error:', error)
      return false
    }
  }

  private async incrementInRedis(key: string, windowMs: number): Promise<number | null> {
    try {
      const redis = redisManager.getClient()
      if (!redis) return null

      const pipeline = redis.pipeline()
      pipeline.incr(key)
      pipeline.expire(key, Math.ceil(windowMs / 1000))
      
      const results = await pipeline.exec()
      
      if (!results || results.length !== 2) return null
      
      const [incrResult] = results
      return incrResult && incrResult[1] ? parseInt(incrResult[1] as string) : null
    } catch (error) {
      console.error('Redis rate limiter increment error:', error)
      return null
    }
  }

  private getFromMemory(key: string): { count: number; resetTime: number } | null {
    const data = this.memoryStore.get(key)
    if (!data || Date.now() > data.resetTime) {
      this.memoryStore.delete(key)
      return null
    }
    return data
  }

  private setInMemory(key: string, count: number, resetTime: number): void {
    this.memoryStore.set(key, { count, resetTime })
  }

  private incrementInMemory(key: string, windowMs: number): number {
    const now = Date.now()
    const resetTime = now + windowMs
    const existing = this.getFromMemory(key)
    
    if (!existing) {
      this.setInMemory(key, 1, resetTime)
      return 1
    }
    
    existing.count++
    return existing.count
  }

  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const options = { ...this.defaultOptions, ...config.options }
    const key = this.getKey(config.identifier, options.keyPrefix)
    const now = Date.now()

    // Try Redis first, fall back to memory
    const useRedis = redisManager.isReady()
    let currentData: { count: number; resetTime: number } | null = null

    if (useRedis) {
      currentData = await this.getFromRedis(key)
    } else {
      currentData = this.getFromMemory(key)
    }

    // If no current data, this is a new window
    if (!currentData) {
      const resetTime = now + options.windowMs
      
      if (useRedis) {
        await this.setInRedis(key, 1, options.windowMs)
      } else {
        this.setInMemory(key, 1, resetTime)
      }

      return {
        allowed: true,
        limit: options.max,
        remaining: options.max - 1,
        resetTime
      }
    }

    // Check if we're over the limit
    if (currentData.count >= options.max) {
      const retryAfter = Math.ceil((currentData.resetTime - now) / 1000)
      
      return {
        allowed: false,
        limit: options.max,
        remaining: 0,
        resetTime: currentData.resetTime,
        retryAfter
      }
    }

    // Increment the counter
    let newCount: number
    if (useRedis) {
      const incremented = await this.incrementInRedis(key, options.windowMs)
      newCount = incremented || currentData.count + 1
    } else {
      newCount = this.incrementInMemory(key, options.windowMs)
    }

    return {
      allowed: true,
      limit: options.max,
      remaining: Math.max(0, options.max - newCount),
      resetTime: currentData.resetTime
    }
  }

  async checkLimitByProfile(identifier: string, profile: RateLimitProfile): Promise<RateLimitResult> {
    const options = RATE_LIMIT_PROFILES[profile]
    return this.checkLimit({ identifier, options })
  }

  async resetLimit(identifier: string, keyPrefix: string = 'rl:'): Promise<boolean> {
    const key = this.getKey(identifier, keyPrefix)
    
    if (redisManager.isReady()) {
      return await redisManager.del(key)
    } else {
      this.memoryStore.delete(key)
      return true
    }
  }

  async getRemainingRequests(identifier: string, options: RateLimitOptions): Promise<number> {
    const key = this.getKey(identifier, options.keyPrefix)
    
    if (redisManager.isReady()) {
      const data = await this.getFromRedis(key)
      return data ? Math.max(0, options.max - data.count) : options.max
    } else {
      const data = this.getFromMemory(key)
      return data ? Math.max(0, options.max - data.count) : options.max
    }
  }

  async getResetTime(identifier: string, options: RateLimitOptions): Promise<number> {
    const key = this.getKey(identifier, options.keyPrefix)
    const now = Date.now()
    
    if (redisManager.isReady()) {
      const data = await this.getFromRedis(key)
      return data ? data.resetTime : now + options.windowMs
    } else {
      const data = this.getFromMemory(key)
      return data ? data.resetTime : now + options.windowMs
    }
  }

  // Clean up expired entries from memory store
  cleanupMemoryStore(): void {
    const now = Date.now()
    for (const [key, data] of this.memoryStore.entries()) {
      if (now > data.resetTime) {
        this.memoryStore.delete(key)
      }
    }
  }
}

export const rateLimiter = new DistributedRateLimiter()

// Cleanup memory store every 5 minutes
setInterval(() => {
  rateLimiter.cleanupMemoryStore()
}, 5 * 60 * 1000)

// Utility functions for common rate limiting patterns
export function createRateLimitConfig(
  identifier: string, 
  profile: RateLimitProfile
): RateLimitConfig {
  return {
    identifier,
    options: RATE_LIMIT_PROFILES[profile]
  }
}

export function createCustomRateLimitConfig(
  identifier: string,
  options: RateLimitOptions
): RateLimitConfig {
  return {
    identifier,
    options
  }
}