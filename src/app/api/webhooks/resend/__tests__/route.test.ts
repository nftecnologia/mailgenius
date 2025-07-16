import { NextRequest } from 'next/server'
import { POST } from '../route'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

const mockSupabase = supabase as jest.Mocked<typeof supabase>

describe('/api/webhooks/resend', () => {
  const webhookSecret = 'test-webhook-secret'
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock environment variable
    process.env.RESEND_WEBHOOK_SECRET = webhookSecret
  })

  const createSignedRequest = (body: any, secret: string = webhookSecret) => {
    const timestamp = Date.now().toString()
    const payload = JSON.stringify(body)
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')
    
    return {
      timestamp,
      payload,
      signature: `v1=${signature}`,
    }
  }

  describe('Webhook signature verification', () => {
    it('accepts valid webhook signature', async () => {
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
          subject: 'Test Email',
          delivered_at: '2023-01-01T00:00:00Z',
        },
      }
      
      const { timestamp, payload, signature } = createSignedRequest(eventData)
      
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'event-123' },
          error: null,
        }),
      } as any)
      
      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_123',
          'svix-timestamp': timestamp,
          'svix-signature': signature,
        },
        body: payload,
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(200)
    })

    it('rejects invalid webhook signature', async () => {
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
        },
      }
      
      const { timestamp, payload } = createSignedRequest(eventData)
      
      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_123',
          'svix-timestamp': timestamp,
          'svix-signature': 'v1=invalid-signature',
        },
        body: payload,
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Invalid signature')
    })

    it('rejects old timestamps', async () => {
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
        },
      }
      
      const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString() // 10 minutes ago
      const payload = JSON.stringify(eventData)
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${oldTimestamp}.${payload}`)
        .digest('hex')
      
      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_123',
          'svix-timestamp': oldTimestamp,
          'svix-signature': `v1=${signature}`,
        },
        body: payload,
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Timestamp too old')
    })

    it('rejects missing headers', async () => {
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
        },
      }
      
      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Missing svix headers
        },
        body: JSON.stringify(eventData),
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Missing webhook headers')
    })
  })

  describe('Event processing', () => {
    const createValidRequest = (eventData: any) => {
      const { timestamp, payload, signature } = createSignedRequest(eventData)
      
      return new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_123',
          'svix-timestamp': timestamp,
          'svix-signature': signature,
        },
        body: payload,
      })
    }

    it('processes email.delivered event', async () => {
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
          subject: 'Test Email',
          delivered_at: '2023-01-01T00:00:00Z',
        },
      }
      
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'event-123' },
        error: null,
      })
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      } as any)
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockInsert).toHaveBeenCalledWith({
        email_id: 'email-123',
        event_type: 'delivered',
        recipient: 'test@example.com',
        subject: 'Test Email',
        event_data: eventData.data,
        occurred_at: '2023-01-01T00:00:00Z',
        processed_at: expect.any(String),
      })
    })

    it('processes email.bounced event', async () => {
      const eventData = {
        type: 'email.bounced',
        data: {
          email_id: 'email-123',
          to: 'bounced@example.com',
          subject: 'Test Email',
          bounced_at: '2023-01-01T00:00:00Z',
          bounce_reason: 'mailbox_full',
        },
      }
      
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'event-123' },
        error: null,
      })
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      } as any)
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockInsert).toHaveBeenCalledWith({
        email_id: 'email-123',
        event_type: 'bounced',
        recipient: 'bounced@example.com',
        subject: 'Test Email',
        event_data: eventData.data,
        occurred_at: '2023-01-01T00:00:00Z',
        processed_at: expect.any(String),
      })
    })

    it('processes email.complained event', async () => {
      const eventData = {
        type: 'email.complained',
        data: {
          email_id: 'email-123',
          to: 'complained@example.com',
          subject: 'Test Email',
          complained_at: '2023-01-01T00:00:00Z',
        },
      }
      
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'event-123' },
        error: null,
      })
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      } as any)
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockInsert).toHaveBeenCalledWith({
        email_id: 'email-123',
        event_type: 'complained',
        recipient: 'complained@example.com',
        subject: 'Test Email',
        event_data: eventData.data,
        occurred_at: '2023-01-01T00:00:00Z',
        processed_at: expect.any(String),
      })
    })

    it('processes email.clicked event', async () => {
      const eventData = {
        type: 'email.clicked',
        data: {
          email_id: 'email-123',
          to: 'clicked@example.com',
          subject: 'Test Email',
          clicked_at: '2023-01-01T00:00:00Z',
          link: 'https://example.com/link',
        },
      }
      
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'event-123' },
        error: null,
      })
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      } as any)
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockInsert).toHaveBeenCalledWith({
        email_id: 'email-123',
        event_type: 'clicked',
        recipient: 'clicked@example.com',
        subject: 'Test Email',
        event_data: eventData.data,
        occurred_at: '2023-01-01T00:00:00Z',
        processed_at: expect.any(String),
      })
    })

    it('ignores unknown event types', async () => {
      const eventData = {
        type: 'unknown.event',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
        },
      }
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('Lead status updates', () => {
    it('updates lead status on bounce', async () => {
      const eventData = {
        type: 'email.bounced',
        data: {
          email_id: 'email-123',
          to: 'bounced@example.com',
          bounced_at: '2023-01-01T00:00:00Z',
          bounce_reason: 'mailbox_full',
        },
      }
      
      const mockFrom = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'event-123' },
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      
      // Should update lead status
      expect(mockFrom.update).toHaveBeenCalledWith({
        status: 'bounced',
        updated_at: expect.any(String),
      })
      expect(mockFrom.eq).toHaveBeenCalledWith('email', 'bounced@example.com')
    })

    it('updates lead status on complaint', async () => {
      const eventData = {
        type: 'email.complained',
        data: {
          email_id: 'email-123',
          to: 'complained@example.com',
          complained_at: '2023-01-01T00:00:00Z',
        },
      }
      
      const mockFrom = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'event-123' },
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(200)
      
      // Should update lead status
      expect(mockFrom.update).toHaveBeenCalledWith({
        status: 'unsubscribed',
        updated_at: expect.any(String),
      })
      expect(mockFrom.eq).toHaveBeenCalledWith('email', 'complained@example.com')
    })
  })

  describe('Error handling', () => {
    it('handles database errors gracefully', async () => {
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
          delivered_at: '2023-01-01T00:00:00Z',
        },
      }
      
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      } as any)
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(500)
      expect(await response.text()).toBe('Database error')
    })

    it('handles malformed JSON', async () => {
      const timestamp = Date.now().toString()
      const payload = 'invalid json'
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest('hex')
      
      const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_123',
          'svix-timestamp': timestamp,
          'svix-signature': `v1=${signature}`,
        },
        body: payload,
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Invalid JSON')
    })

    it('handles missing webhook secret', async () => {
      delete process.env.RESEND_WEBHOOK_SECRET
      
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
        },
      }
      
      const request = createValidRequest(eventData)
      const response = await POST(request)
      
      expect(response.status).toBe(500)
      expect(await response.text()).toBe('Webhook secret not configured')
    })
  })

  describe('Idempotency', () => {
    it('prevents duplicate event processing', async () => {
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
          delivered_at: '2023-01-01T00:00:00Z',
        },
      }
      
      // First request - should process
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockReturnThis()
      const mockSingle = jest.fn()
        .mockResolvedValueOnce({
          data: { id: 'event-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'event-123' }, // Event already exists
          error: null,
        })
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      } as any)
      
      const request1 = createValidRequest(eventData)
      const response1 = await POST(request1)
      
      expect(response1.status).toBe(200)
      expect(mockInsert).toHaveBeenCalledTimes(1)
      
      // Second request with same event - should be idempotent
      const request2 = createValidRequest(eventData)
      const response2 = await POST(request2)
      
      expect(response2.status).toBe(200)
      expect(mockInsert).toHaveBeenCalledTimes(1) // Should not insert again
    })
  })

  describe('Rate limiting', () => {
    it('accepts reasonable webhook frequency', async () => {
      const eventData = {
        type: 'email.delivered',
        data: {
          email_id: 'email-123',
          to: 'test@example.com',
          delivered_at: '2023-01-01T00:00:00Z',
        },
      }
      
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'event-123' },
          error: null,
        }),
      } as any)
      
      // Send multiple requests in quick succession
      const requests = Array.from({ length: 10 }, () => createValidRequest(eventData))
      const responses = await Promise.all(requests.map(req => POST(req)))
      
      // All should be processed (no rate limiting for webhooks)
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })
})