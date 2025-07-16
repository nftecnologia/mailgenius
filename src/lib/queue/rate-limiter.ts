import { redisManager } from '../redis'

export interface RateLimitConfig {
  key: string
  limit: number
  window: number // seconds
  burst?: number // allow burst requests
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  totalRequests: number
}

export class IntelligentRateLimiter {
  private static instance: IntelligentRateLimiter
  private defaultConfigs: Map<string, RateLimitConfig> = new Map()

  private constructor() {
    this.initializeDefaultConfigs()
  }

  static getInstance(): IntelligentRateLimiter {
    if (!IntelligentRateLimiter.instance) {
      IntelligentRateLimiter.instance = new IntelligentRateLimiter()
    }
    return IntelligentRateLimiter.instance
  }

  private initializeDefaultConfigs(): void {
    // Email sending rate limits
    this.defaultConfigs.set('email-sending', {
      key: 'email-sending',
      limit: 100, // 100 emails per minute
      window: 60,
      burst: 20,
    })

    // Lead import rate limits
    this.defaultConfigs.set('lead-import', {
      key: 'lead-import',
      limit: 1000, // 1000 leads per minute
      window: 60,
      burst: 200,
    })

    // API rate limits
    this.defaultConfigs.set('api', {
      key: 'api',
      limit: 1000, // 1000 requests per minute
      window: 60,
      burst: 100,
    })

    // Campaign creation rate limits
    this.defaultConfigs.set('campaign-creation', {
      key: 'campaign-creation',
      limit: 10, // 10 campaigns per hour
      window: 3600,
      burst: 3,
    })
  }

  async checkRateLimit(
    identifier: string,
    configKey: string,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const config = this.getConfig(configKey, customConfig)
    const key = `rate_limit:${config.key}:${identifier}`
    
    try {
      const redis = redisManager.getClient()
      if (!redis) {
        // Fallback to memory-based rate limiting
        return this.fallbackRateLimit(key, config)
      }

      const now = Date.now()
      const windowStart = now - (config.window * 1000)

      // Use Redis sorted set for sliding window
      const pipe = redis.pipeline()
      
      // Remove old entries
      pipe.zremrangebyscore(key, 0, windowStart)
      
      // Count current requests
      pipe.zcard(key)
      
      // Add current request
      pipe.zadd(key, now, `${now}-${Math.random()}`)
      
      // Set expiration
      pipe.expire(key, config.window)
      
      const results = await pipe.exec()
      
      if (!results) {
        throw new Error('Redis pipeline failed')
      }

      const currentCount = results[1][1] as number
      const isAllowed = currentCount < config.limit
      
      // Handle burst capacity
      if (!isAllowed && config.burst) {
        const burstKey = `${key}:burst`
        const burstCount = await redis.get(burstKey)
        const currentBurst = burstCount ? parseInt(burstCount) : 0
        
        if (currentBurst < config.burst) {
          await redis.incr(burstKey)
          await redis.expire(burstKey, config.window)
          return {
            allowed: true,
            remaining: config.limit + config.burst - currentCount - currentBurst - 1,
            resetTime: now + (config.window * 1000),
            totalRequests: currentCount + 1,
          }
        }
      }

      return {
        allowed: isAllowed,
        remaining: Math.max(0, config.limit - currentCount - 1),
        resetTime: now + (config.window * 1000),
        totalRequests: currentCount + (isAllowed ? 1 : 0),
      }
    } catch (error) {
      console.error('Rate limit check failed:', error)
      return this.fallbackRateLimit(key, config)
    }
  }

  private getConfig(configKey: string, customConfig?: Partial<RateLimitConfig>): RateLimitConfig {
    const defaultConfig = this.defaultConfigs.get(configKey)
    if (!defaultConfig) {
      throw new Error(`Rate limit config not found: ${configKey}`)
    }

    return {
      ...defaultConfig,
      ...customConfig,
    }
  }

  private memoryStore: Map<string, Array<{ timestamp: number; count: number }>> = new Map()

  private fallbackRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const windowStart = now - (config.window * 1000)
    
    // Get or create entry
    let requests = this.memoryStore.get(key) || []
    
    // Remove old entries
    requests = requests.filter(req => req.timestamp > windowStart)
    
    // Count current requests
    const currentCount = requests.reduce((sum, req) => sum + req.count, 0)
    const isAllowed = currentCount < config.limit
    
    if (isAllowed) {
      requests.push({ timestamp: now, count: 1 })
      this.memoryStore.set(key, requests)
    }

    return {
      allowed: isAllowed,
      remaining: Math.max(0, config.limit - currentCount - (isAllowed ? 1 : 0)),
      resetTime: now + (config.window * 1000),
      totalRequests: currentCount + (isAllowed ? 1 : 0),
    }
  }

  async resetRateLimit(identifier: string, configKey: string): Promise<boolean> {
    const config = this.getConfig(configKey)
    const key = `rate_limit:${config.key}:${identifier}`
    
    try {
      const redis = redisManager.getClient()
      if (redis) {
        await redis.del(key)
        await redis.del(`${key}:burst`)
      } else {
        this.memoryStore.delete(key)
      }
      return true
    } catch (error) {
      console.error('Failed to reset rate limit:', error)
      return false
    }
  }

  async getRateLimitStatus(identifier: string, configKey: string): Promise<{
    currentCount: number
    limit: number
    remaining: number
    resetTime: number
    window: number
  }> {
    const config = this.getConfig(configKey)
    const key = `rate_limit:${config.key}:${identifier}`
    
    try {
      const redis = redisManager.getClient()
      if (!redis) {
        const requests = this.memoryStore.get(key) || []
        const now = Date.now()
        const windowStart = now - (config.window * 1000)
        const validRequests = requests.filter(req => req.timestamp > windowStart)
        const currentCount = validRequests.reduce((sum, req) => sum + req.count, 0)
        
        return {
          currentCount,
          limit: config.limit,
          remaining: Math.max(0, config.limit - currentCount),
          resetTime: now + (config.window * 1000),
          window: config.window,
        }
      }

      const now = Date.now()
      const windowStart = now - (config.window * 1000)
      
      await redis.zremrangebyscore(key, 0, windowStart)
      const currentCount = await redis.zcard(key)
      
      return {
        currentCount,
        limit: config.limit,
        remaining: Math.max(0, config.limit - currentCount),
        resetTime: now + (config.window * 1000),
        window: config.window,
      }
    } catch (error) {
      console.error('Failed to get rate limit status:', error)
      return {
        currentCount: 0,
        limit: config.limit,
        remaining: config.limit,
        resetTime: Date.now() + (config.window * 1000),
        window: config.window,
      }
    }
  }

  async createCustomRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(identifier, 'custom', config)
  }

  // Adaptive rate limiting based on system load
  async getAdaptiveRateLimit(
    identifier: string,
    baseConfigKey: string,
    systemLoad: number // 0-1, where 1 is maximum load
  ): Promise<RateLimitResult> {
    const baseConfig = this.getConfig(baseConfigKey)
    
    // Reduce limits based on system load
    const adaptiveLimit = Math.max(
      Math.floor(baseConfig.limit * (1 - systemLoad * 0.5)),
      Math.floor(baseConfig.limit * 0.1) // Minimum 10% of original limit
    )
    
    const adaptiveConfig = {
      ...baseConfig,
      limit: adaptiveLimit,
    }
    
    return this.checkRateLimit(identifier, 'custom', adaptiveConfig)
  }

  // Cleanup old entries from memory store
  private cleanupMemoryStore(): void {
    const now = Date.now()
    const maxAge = 3600000 // 1 hour
    
    for (const [key, requests] of this.memoryStore.entries()) {
      const validRequests = requests.filter(req => (now - req.timestamp) < maxAge)
      if (validRequests.length === 0) {
        this.memoryStore.delete(key)
      } else {
        this.memoryStore.set(key, validRequests)
      }
    }
  }
}

export const intelligentRateLimiter = IntelligentRateLimiter.getInstance()

// Cleanup memory store periodically
setInterval(() => {
  intelligentRateLimiter['cleanupMemoryStore']()
}, 300000) // Every 5 minutes