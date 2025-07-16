import { rateLimiter, createRateLimitConfig, RATE_LIMIT_PROFILES } from '../rate-limiter'

// Mock Redis manager
jest.mock('../redis', () => ({
  redisManager: {
    isReady: jest.fn().mockReturnValue(false),
    getClient: jest.fn().mockReturnValue(null),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    incr: jest.fn().mockResolvedValue(null),
    expire: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(false),
    ttl: jest.fn().mockResolvedValue(null),
  }
}))

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear memory store before each test
    jest.clearAllMocks()
  })

  describe('Basic Rate Limiting', () => {
    test('should allow first request', async () => {
      const config = createRateLimitConfig('test-user', 'API_STANDARD')
      const result = await rateLimiter.checkLimit(config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(999)
      expect(result.limit).toBe(1000)
    })

    test('should track requests correctly', async () => {
      const config = createRateLimitConfig('test-user-2', 'API_BURST')
      
      // First request
      const result1 = await rateLimiter.checkLimit(config)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(99)

      // Second request
      const result2 = await rateLimiter.checkLimit(config)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(98)
    })

    test('should block requests when limit exceeded', async () => {
      const config = createRateLimitConfig('test-user-3', {
        windowMs: 60 * 1000,
        max: 2,
        message: 'Test limit exceeded'
      })

      // First two requests should be allowed
      const result1 = await rateLimiter.checkLimit(config)
      expect(result1.allowed).toBe(true)

      const result2 = await rateLimiter.checkLimit(config)
      expect(result2.allowed).toBe(true)

      // Third request should be blocked
      const result3 = await rateLimiter.checkLimit(config)
      expect(result3.allowed).toBe(false)
      expect(result3.remaining).toBe(0)
      expect(result3.retryAfter).toBeDefined()
    })

    test('should reset after window expires', async () => {
      const config = createRateLimitConfig('test-user-4', {
        windowMs: 100, // 100ms window
        max: 1,
        message: 'Test limit'
      })

      // First request
      const result1 = await rateLimiter.checkLimit(config)
      expect(result1.allowed).toBe(true)

      // Second request should be blocked
      const result2 = await rateLimiter.checkLimit(config)
      expect(result2.allowed).toBe(false)

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 110))

      // Should be allowed again
      const result3 = await rateLimiter.checkLimit(config)
      expect(result3.allowed).toBe(true)
    })
  })

  describe('Rate Limit Profiles', () => {
    test('should use AUTH_STRICT profile correctly', async () => {
      const config = createRateLimitConfig('auth-user', 'AUTH_STRICT')
      const result = await rateLimiter.checkLimit(config)

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(5)
      expect(result.remaining).toBe(4)
    })

    test('should use API_STANDARD profile correctly', async () => {
      const config = createRateLimitConfig('api-user', 'API_STANDARD')
      const result = await rateLimiter.checkLimit(config)

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(1000)
      expect(result.remaining).toBe(999)
    })

    test('should use EMAIL_SENDING profile correctly', async () => {
      const config = createRateLimitConfig('email-user', 'EMAIL_SENDING')
      const result = await rateLimiter.checkLimit(config)

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(1000)
      expect(result.remaining).toBe(999)
    })

    test('should use CAMPAIGN_CREATION profile correctly', async () => {
      const config = createRateLimitConfig('campaign-user', 'CAMPAIGN_CREATION')
      const result = await rateLimiter.checkLimit(config)

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(100)
      expect(result.remaining).toBe(99)
    })
  })

  describe('Different Identifiers', () => {
    test('should handle different identifiers separately', async () => {
      const config1 = createRateLimitConfig('user-1', 'API_BURST')
      const config2 = createRateLimitConfig('user-2', 'API_BURST')

      const result1 = await rateLimiter.checkLimit(config1)
      const result2 = await rateLimiter.checkLimit(config2)

      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)
      expect(result1.remaining).toBe(99)
      expect(result2.remaining).toBe(99)
    })

    test('should track same identifier correctly', async () => {
      const config = createRateLimitConfig('same-user', 'API_BURST')

      const result1 = await rateLimiter.checkLimit(config)
      const result2 = await rateLimiter.checkLimit(config)

      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)
      expect(result1.remaining).toBe(99)
      expect(result2.remaining).toBe(98)
    })
  })

  describe('Utility Functions', () => {
    test('should reset limit correctly', async () => {
      const config = createRateLimitConfig('reset-user', 'API_BURST')
      
      // Make a request
      await rateLimiter.checkLimit(config)
      
      // Reset the limit
      const resetResult = await rateLimiter.resetLimit('reset-user')
      expect(resetResult).toBe(true)
      
      // Should be back to full limit
      const result = await rateLimiter.checkLimit(config)
      expect(result.remaining).toBe(99)
    })

    test('should get remaining requests correctly', async () => {
      const identifier = 'remaining-user'
      const profile = 'API_BURST'
      const config = createRateLimitConfig(identifier, profile)
      
      // Make a request
      await rateLimiter.checkLimit(config)
      
      // Check remaining
      const remaining = await rateLimiter.getRemainingRequests(identifier, RATE_LIMIT_PROFILES[profile])
      expect(remaining).toBe(99)
    })

    test('should get reset time correctly', async () => {
      const identifier = 'reset-time-user'
      const profile = 'API_BURST'
      const config = createRateLimitConfig(identifier, profile)
      
      // Make a request
      const result = await rateLimiter.checkLimit(config)
      
      // Check reset time
      const resetTime = await rateLimiter.getResetTime(identifier, RATE_LIMIT_PROFILES[profile])
      expect(resetTime).toBe(result.resetTime)
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid profiles gracefully', async () => {
      const config = createRateLimitConfig('error-user', 'INVALID_PROFILE' as any)
      
      // Should not throw error
      await expect(rateLimiter.checkLimit(config)).resolves.toBeDefined()
    })

    test('should handle empty identifier', async () => {
      const config = createRateLimitConfig('', 'API_STANDARD')
      const result = await rateLimiter.checkLimit(config)
      
      expect(result.allowed).toBe(true)
    })
  })

  describe('Memory Store Cleanup', () => {
    test('should cleanup expired entries', async () => {
      const config = createRateLimitConfig('cleanup-user', {
        windowMs: 50, // 50ms window
        max: 1,
        message: 'Test cleanup'
      })

      // Make a request
      await rateLimiter.checkLimit(config)
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60))
      
      // Cleanup should remove expired entries
      rateLimiter.cleanupMemoryStore()
      
      // Should be allowed again (new window)
      const result = await rateLimiter.checkLimit(config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(0) // Since it's max: 1
    })
  })

  describe('Performance', () => {
    test('should handle many requests efficiently', async () => {
      const config = createRateLimitConfig('perf-user', 'API_STANDARD')
      
      const start = Date.now()
      
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkLimit(config)
      }
      
      const end = Date.now()
      const duration = end - start
      
      // Should complete in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000)
    })

    test('should handle concurrent requests correctly', async () => {
      const config = createRateLimitConfig('concurrent-user', 'API_BURST')
      
      // Make 10 concurrent requests
      const promises = Array.from({ length: 10 }, () => rateLimiter.checkLimit(config))
      const results = await Promise.all(promises)
      
      // All should be allowed
      results.forEach(result => {
        expect(result.allowed).toBe(true)
      })
      
      // Final remaining should be 90 (100 - 10)
      const finalResult = await rateLimiter.checkLimit(config)
      expect(finalResult.remaining).toBe(89) // 90 - 1 for the final request
    })
  })
})