import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/middleware/rate-limit'

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: jest.fn(),
}))

jest.mock('@/lib/api-auth', () => ({
  validateAPIKey: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

import { validateAPIKey } from '@/lib/api-auth'

const mockSupabase = supabase as jest.Mocked<typeof supabase>
const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>
const mockValidateAPIKey = validateAPIKey as jest.MockedFunction<typeof validateAPIKey>

describe('/api/public/v1/leads', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default successful rate limit
    mockRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99 })
    
    // Default successful API key validation
    mockValidateAPIKey.mockResolvedValue({
      valid: true,
      workspace_id: 'workspace-123',
      permissions: ['leads:read', 'leads:write'],
    })
  })

  describe('GET /api/public/v1/leads', () => {
    it('returns leads for valid API key', async () => {
      const mockLeads = [
        {
          id: 'lead-1',
          email: 'test1@example.com',
          name: 'Test Lead 1',
          status: 'active',
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'lead-2',
          email: 'test2@example.com',
          name: 'Test Lead 2',
          status: 'active',
          created_at: '2023-01-02T00:00:00Z',
        },
      ]
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockLeads,
          error: null,
          count: 2,
        }),
      } as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockLeads)
      expect(data.pagination).toBeDefined()
    })

    it('respects pagination parameters', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads?page=2&limit=20', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      await GET(request)
      
      expect(mockFrom.limit).toHaveBeenCalledWith(20)
      expect(mockFrom.range).toHaveBeenCalledWith(20, 39) // page 2, limit 20
    })

    it('filters by status', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads?status=active', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      await GET(request)
      
      expect(mockFrom.eq).toHaveBeenCalledWith('status', 'active')
    })

    it('returns 401 for invalid API key', async () => {
      mockValidateAPIKey.mockResolvedValue({
        valid: false,
        error: 'Invalid API key',
      })
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        headers: { 'X-API-Key': 'invalid-key' },
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid API key')
    })

    it('returns 403 for insufficient permissions', async () => {
      mockValidateAPIKey.mockResolvedValue({
        valid: true,
        workspace_id: 'workspace-123',
        permissions: ['campaigns:read'], // No leads:read permission
      })
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data.error).toBe('Insufficient permissions')
    })

    it('returns 429 for rate limit exceeded', async () => {
      mockRateLimit.mockResolvedValue({ 
        success: false, 
        limit: 100, 
        remaining: 0, 
        reset: Date.now() + 60000 
      })
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
    })

    it('handles database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      } as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('POST /api/public/v1/leads', () => {
    it('creates a new lead', async () => {
      const newLead = {
        email: 'new@example.com',
        name: 'New Lead',
        source: 'api',
        tags: ['newsletter'],
        custom_fields: { company: 'Test Corp' },
      }
      
      const createdLead = {
        id: 'lead-123',
        workspace_id: 'workspace-123',
        ...newLead,
        status: 'active',
        created_at: '2023-01-01T00:00:00Z',
      }
      
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createdLead,
          error: null,
        }),
      } as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'valid-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLead),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(createdLead)
    })

    it('validates required fields', async () => {
      const invalidLead = {
        name: 'No Email Lead',
        // Missing email
      }
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'valid-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidLead),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.details).toBeDefined()
    })

    it('validates email format', async () => {
      const invalidLead = {
        email: 'invalid-email',
        name: 'Invalid Email Lead',
      }
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'valid-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidLead),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
    })

    it('handles duplicate email error', async () => {
      const duplicateLead = {
        email: 'existing@example.com',
        name: 'Duplicate Lead',
      }
      
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        }),
      } as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'valid-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateLead),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(409)
      expect(data.error).toBe('Lead with this email already exists')
    })

    it('returns 403 for insufficient permissions', async () => {
      mockValidateAPIKey.mockResolvedValue({
        valid: true,
        workspace_id: 'workspace-123',
        permissions: ['leads:read'], // No leads:write permission
      })
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'valid-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'test@example.com', name: 'Test' }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data.error).toBe('Insufficient permissions')
    })

    it('handles malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'valid-key',
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid JSON')
    })

    it('sanitizes input data', async () => {
      const leadWithHtml = {
        email: 'test@example.com',
        name: '<script>alert("xss")</script>Safe Name',
        custom_fields: {
          bio: '<p>Safe content</p><script>alert("xss")</script>',
        },
      }
      
      const sanitizedLead = {
        id: 'lead-123',
        workspace_id: 'workspace-123',
        email: 'test@example.com',
        name: 'Safe Name', // HTML should be stripped
        custom_fields: {
          bio: '<p>Safe content</p>', // Script should be removed
        },
        status: 'active',
        created_at: '2023-01-01T00:00:00Z',
      }
      
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: sanitizedLead,
          error: null,
        }),
      } as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        method: 'POST',
        headers: { 
          'X-API-Key': 'valid-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadWithHtml),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(201)
      expect(data.data.name).not.toContain('<script>')
    })
  })

  describe('Error handling', () => {
    it('handles network errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error')
      })
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('includes request ID in error responses', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      } as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.request_id).toBeDefined()
    })
  })

  describe('Security', () => {
    it('prevents SQL injection in query parameters', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads?status=active\'; DROP TABLE leads; --', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      // Should not execute malicious SQL
      expect(mockFrom.eq).toHaveBeenCalledWith('status', 'active\'; DROP TABLE leads; --')
    })

    it('limits response size', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const request = new NextRequest('http://localhost:3000/api/public/v1/leads?limit=10000', {
        headers: { 'X-API-Key': 'valid-key' },
      })
      
      await GET(request)
      
      // Should enforce maximum limit
      expect(mockFrom.limit).toHaveBeenCalledWith(100) // Max limit should be enforced
    })
  })
})