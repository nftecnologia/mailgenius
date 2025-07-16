/**
 * Testes para o sistema de CORS
 * 
 * Para executar os testes:
 * npm test cors
 */

import { corsManager } from '@/lib/cors'
import { corsConfig } from '@/lib/cors-config'
import { NextRequest } from 'next/server'

// Mock do environment
const mockEnv = {
  NODE_ENV: 'development',
  CORS_DEVELOPMENT_DOMAINS: 'http://localhost:3000,http://localhost:3001',
  CORS_PRODUCTION_DOMAINS: 'https://mailgenius.com,https://www.mailgenius.com',
  CORS_CREDENTIALS: 'true',
  CORS_MAX_AGE: '86400'
}

Object.assign(process.env, mockEnv)

describe('CORS System Tests', () => {
  beforeEach(() => {
    // Reset configuration
    corsConfig.initialize()
  })

  describe('CORSConfigManager', () => {
    test('should initialize with development domains', () => {
      const domains = corsConfig.getAllowedDomains()
      expect(domains).toContain('http://localhost:3000')
      expect(domains).toContain('http://localhost:3001')
    })

    test('should validate domain format', () => {
      const validation = corsConfig.validateConfig()
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should check if domain is allowed', () => {
      expect(corsConfig.isDomainAllowed('http://localhost:3000')).toBe(true)
      expect(corsConfig.isDomainAllowed('http://malicious.com')).toBe(false)
    })

    test('should add allowed domain in development', () => {
      const newDomain = 'http://localhost:3002'
      corsConfig.addAllowedDomain(newDomain)
      expect(corsConfig.isDomainAllowed(newDomain)).toBe(true)
    })

    test('should get CORS configuration', () => {
      const config = corsConfig.getCORSConfig()
      expect(config.origin).toContain('http://localhost:3000')
      expect(config.credentials).toBe(true)
      expect(config.maxAge).toBe(86400)
    })

    test('should get security configuration', () => {
      const securityConfig = corsConfig.getSecurityConfig()
      expect(securityConfig).toHaveProperty('blockSuspiciousUserAgents')
      expect(securityConfig).toHaveProperty('validateContentType')
      expect(securityConfig).toHaveProperty('rateLimitRequests')
    })
  })

  describe('CORSManager', () => {
    test('should handle preflight OPTIONS request', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000'
        }
      })

      const response = corsManager.handleAPICORS(request)
      expect(response).toBeTruthy()
      expect(response?.status).toBe(204)
    })

    test('should block unauthorized origin', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          'Origin': 'http://malicious.com'
        }
      })

      const response = corsManager.handleAPICORS(request)
      expect(response).toBeTruthy()
      expect(response?.status).toBe(403)
    })

    test('should validate security headers', () => {
      const validRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Chrome)'
        }
      })

      const isValid = corsManager.validateSecurityHeaders(validRequest)
      expect(isValid).toBe(true)
    })

    test('should block suspicious user agent', () => {
      const suspiciousRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          'User-Agent': 'curl/7.68.0'
        }
      })

      const isValid = corsManager.validateSecurityHeaders(suspiciousRequest)
      expect(isValid).toBe(false)
    })

    test('should validate content type for POST requests', () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        }
      })

      const isValid = corsManager.validateSecurityHeaders(invalidRequest)
      expect(isValid).toBe(false)
    })

    test('should create CORS response with proper headers', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3000'
        }
      })

      const response = corsManager.createCORSResponse(
        { message: 'test' },
        200,
        request
      )

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })
  })

  describe('Production Environment', () => {
    beforeAll(() => {
      process.env.NODE_ENV = 'production'
      corsConfig.initialize()
    })

    afterAll(() => {
      process.env.NODE_ENV = 'development'
      corsConfig.initialize()
    })

    test('should use production domains', () => {
      const domains = corsConfig.getAllowedDomains()
      expect(domains).toContain('https://mailgenius.com')
      expect(domains).toContain('https://www.mailgenius.com')
      expect(domains).not.toContain('http://localhost:3000')
    })

    test('should block localhost in production', () => {
      expect(corsConfig.isDomainAllowed('http://localhost:3000')).toBe(false)
      expect(corsConfig.isDomainAllowed('https://mailgenius.com')).toBe(true)
    })

    test('should have restricted methods in production', () => {
      const config = corsConfig.getCORSConfig()
      expect(config.methods).not.toContain('PATCH')
      expect(config.methods).not.toContain('HEAD')
      expect(config.methods).toContain('GET')
      expect(config.methods).toContain('POST')
    })
  })

  describe('Error Handling', () => {
    test('should handle missing environment variables', () => {
      const originalEnv = process.env.CORS_DEVELOPMENT_DOMAINS
      delete process.env.CORS_DEVELOPMENT_DOMAINS
      
      corsConfig.initialize()
      const domains = corsConfig.getAllowedDomains()
      
      // Should still work with default domains
      expect(Array.isArray(domains)).toBe(true)
      
      // Restore
      process.env.CORS_DEVELOPMENT_DOMAINS = originalEnv
    })

    test('should handle invalid domain format', () => {
      corsConfig.addAllowedDomain('invalid-domain')
      const validation = corsConfig.validateConfig()
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Invalid domain format: invalid-domain')
    })
  })

  describe('Rate Limiting', () => {
    test('should allow requests within limit', () => {
      const apiKeyId = 'test-key-1'
      
      // First request should be allowed
      expect(corsManager['rateLimiter'].checkLimit(apiKeyId)).toBe(true)
      
      // Subsequent requests should be allowed
      for (let i = 0; i < 10; i++) {
        expect(corsManager['rateLimiter'].checkLimit(apiKeyId)).toBe(true)
      }
    })

    test('should get remaining requests', () => {
      const apiKeyId = 'test-key-2'
      
      corsManager['rateLimiter'].checkLimit(apiKeyId)
      const remaining = corsManager['rateLimiter'].getRemainingRequests(apiKeyId)
      
      expect(remaining).toBeLessThan(1000)
      expect(remaining).toBeGreaterThan(0)
    })

    test('should get reset time', () => {
      const apiKeyId = 'test-key-3'
      
      corsManager['rateLimiter'].checkLimit(apiKeyId)
      const resetTime = corsManager['rateLimiter'].getResetTime(apiKeyId)
      
      expect(resetTime).toBeGreaterThan(Date.now())
    })
  })

  describe('Security Headers', () => {
    test('should apply security headers', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          'Origin': 'http://localhost:3000'
        }
      })

      const response = corsManager.createCORSResponse(
        { message: 'test' },
        200,
        request
      )

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })
  })
})

describe('withCORS HOC', () => {
  test('should wrap handler with CORS', async () => {
    const mockHandler = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }))
    )

    const wrappedHandler = corsManager['withCORS'](mockHandler)
    
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000',
        'Content-Type': 'application/json'
      }
    })

    const response = await wrappedHandler(request)
    
    expect(mockHandler).toHaveBeenCalledWith(request)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
  })

  test('should handle handler errors', async () => {
    const mockHandler = jest.fn().mockRejectedValue(new Error('Test error'))
    const wrappedHandler = corsManager['withCORS'](mockHandler)
    
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000'
      }
    })

    const response = await wrappedHandler(request)
    
    expect(response.status).toBe(500)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
  })
})

describe('Integration Tests', () => {
  test('should handle complete CORS workflow', async () => {
    // Simulate a complete API request with CORS
    const request = new NextRequest('http://localhost:3000/api/campaigns', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000',
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    })

    // Check if origin is allowed
    const isAllowed = corsConfig.isDomainAllowed('http://localhost:3000')
    expect(isAllowed).toBe(true)

    // Validate security headers
    const isSecure = corsManager.validateSecurityHeaders(request)
    expect(isSecure).toBe(true)

    // Handle CORS
    const corsResponse = corsManager.handleAPICORS(request)
    expect(corsResponse).toBe(null) // Should pass through for GET requests
  })

  test('should handle preflight request workflow', () => {
    const preflightRequest = new NextRequest('http://localhost:3000/api/campaigns', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    })

    const response = corsManager.handleAPICORS(preflightRequest)
    
    expect(response).toBeTruthy()
    expect(response?.status).toBe(204)
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(response?.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})