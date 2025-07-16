import { apiAuth } from '../api-auth'
import { apiKeyNotificationService } from '../api-key-notifications'

// Mock do Supabase
jest.mock('../supabase', () => ({
  createSupabaseServerClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-key-id',
              workspace_id: 'test-workspace',
              name: 'Test Key',
              key_hash: 'test-hash',
              permissions: ['leads:read'],
              status: 'active',
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
              auto_renew: false,
              renewal_period_days: 90
            },
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'new-key-id' },
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          error: null
        }))
      }))
    }))
  }))
}))

describe('API Key Expiration System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('API Key Creation', () => {
    it('should create API key with expiration date', async () => {
      const result = await apiAuth.createAPIKey(
        'test-workspace',
        'Test Key',
        ['leads:read'],
        30, // 30 days
        false // no auto-renew
      )

      expect(result).toHaveProperty('apiKey')
      expect(result).toHaveProperty('id')
      expect(result.apiKey).toMatch(/^es_live_[a-f0-9]{48}$/)
    })

    it('should create API key with auto-renewal enabled', async () => {
      const result = await apiAuth.createAPIKey(
        'test-workspace',
        'Auto Renew Key',
        ['leads:read'],
        90, // 90 days
        true // auto-renew enabled
      )

      expect(result).toHaveProperty('apiKey')
      expect(result).toHaveProperty('id')
    })
  })

  describe('API Key Validation', () => {
    it('should validate active API key', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn((header) => {
            if (header === 'user-agent') return 'test-user-agent'
            return null
          })
        },
        url: 'http://test.com/api/test'
      } as any

      const result = await apiAuth.validateAPIKey('es_live_test123', mockRequest)
      expect(result).toBeTruthy()
      expect(result?.workspace_id).toBe('test-workspace')
    })

    it('should reject expired API key', async () => {
      // Mock expired key
      const mockSupabase = require('../supabase').createSupabaseServerClient()
      mockSupabase.from().select().eq().single.mockReturnValueOnce({
        data: {
          id: 'expired-key-id',
          workspace_id: 'test-workspace',
          status: 'active',
          expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          permissions: ['leads:read']
        },
        error: null
      })

      const result = await apiAuth.validateAPIKey('es_live_expired123')
      expect(result).toBeNull()
    })
  })

  describe('API Key Renewal', () => {
    it('should renew API key successfully', async () => {
      const result = await apiAuth.renewAPIKey(
        'test-key-id',
        'test-workspace',
        'test-user-id',
        90
      )

      expect(result).toBe(true)
    })

    it('should handle renewal of non-existent key', async () => {
      const mockSupabase = require('../supabase').createSupabaseServerClient()
      mockSupabase.from().select().eq().single.mockReturnValueOnce({
        data: null,
        error: { message: 'Key not found' }
      })

      await expect(apiAuth.renewAPIKey('non-existent', 'test-workspace'))
        .rejects.toThrow('API key não encontrada')
    })
  })

  describe('API Key Revocation', () => {
    it('should revoke API key successfully', async () => {
      const result = await apiAuth.revokeAPIKey(
        'test-key-id',
        'test-workspace',
        'test-user-id',
        'Security breach'
      )

      expect(result).toBe(true)
    })
  })

  describe('API Key Statistics', () => {
    it('should return correct statistics', async () => {
      const mockSupabase = require('../supabase').createSupabaseServerClient()
      mockSupabase.from().select().eq.mockReturnValueOnce({
        data: [
          { status: 'active', expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
          { status: 'active', expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() }, // expiring soon
          { status: 'expired', expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
          { status: 'revoked', expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        error: null
      })

      const stats = await apiAuth.getAPIKeyStats('test-workspace')

      expect(stats).toEqual({
        total: 4,
        active: 2,
        expired: 1,
        revoked: 1,
        expiring_soon: 1
      })
    })
  })

  describe('Expiring Keys Detection', () => {
    it('should find keys expiring soon', async () => {
      const mockSupabase = require('../supabase').createSupabaseServerClient()
      mockSupabase.from().select().eq().lt().order.mockReturnValueOnce({
        data: [
          {
            id: 'expiring-key-1',
            name: 'Expiring Key 1',
            expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            workspace_id: 'test-workspace'
          }
        ],
        error: null
      })

      const expiringKeys = await apiAuth.getExpiringAPIKeys('test-workspace', 7)
      expect(expiringKeys).toHaveLength(1)
      expect(expiringKeys[0].name).toBe('Expiring Key 1')
    })
  })

  describe('Notification Service', () => {
    it('should process expiring keys and create notifications', async () => {
      const mockSupabase = require('../supabase').createSupabaseServerClient()
      
      // Mock getExpiringAPIKeys
      jest.spyOn(apiAuth, 'getExpiringAPIKeys').mockResolvedValue([
        {
          id: 'expiring-key-1',
          name: 'Expiring Key',
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          workspace_id: 'test-workspace',
          status: 'active',
          auto_renew: false
        } as any
      ])

      // Mock notification insertion
      mockSupabase.from().select().eq().single.mockReturnValueOnce({
        data: null,
        error: { message: 'No existing notification' }
      })

      await apiKeyNotificationService.checkExpiringKeys('test-workspace')

      // Should have attempted to create notification
      expect(mockSupabase.from().insert).toHaveBeenCalled()
    })
  })

  describe('Auto-renewal Process', () => {
    it('should auto-renew eligible keys', async () => {
      const mockSupabase = require('../supabase').createSupabaseServerClient()
      
      // Mock keys eligible for auto-renewal
      mockSupabase.from().select().eq().lt.mockReturnValueOnce({
        data: [
          {
            id: 'auto-renew-key',
            name: 'Auto Renew Key',
            workspace_id: 'test-workspace',
            auto_renew: true,
            renewal_period_days: 90,
            expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        error: null
      })

      jest.spyOn(apiAuth, 'renewAPIKey').mockResolvedValue(true)

      await apiKeyNotificationService.processAutoRenewal('test-workspace')

      expect(apiAuth.renewAPIKey).toHaveBeenCalledWith(
        'auto-renew-key',
        'test-workspace',
        null,
        90
      )
    })
  })

  describe('Audit Logging', () => {
    it('should log API key creation', async () => {
      const mockSupabase = require('../supabase').createSupabaseServerClient()
      
      await apiAuth.createAPIKey(
        'test-workspace',
        'Test Key',
        ['leads:read'],
        30,
        false
      )

      // Should have logged the creation
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          workspace_id: 'test-workspace'
        })
      )
    })

    it('should retrieve audit logs', async () => {
      const mockSupabase = require('../supabase').createSupabaseServerClient()
      mockSupabase.from().select().eq().order().limit.mockReturnValueOnce({
        data: [
          {
            id: 'log-1',
            action: 'created',
            created_at: new Date().toISOString(),
            metadata: {}
          }
        ],
        error: null
      })

      const logs = await apiAuth.getAPIKeyAuditLogs('test-key-id', 'test-workspace')
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('created')
    })
  })
})

// Integration test helpers
export const testHelpers = {
  createTestAPIKey: async (workspaceId: string, options: any = {}) => {
    return await apiAuth.createAPIKey(
      workspaceId,
      options.name || 'Test Key',
      options.permissions || ['leads:read'],
      options.expirationDays || 90,
      options.autoRenew || false
    )
  },

  createExpiredAPIKey: async (workspaceId: string) => {
    // This would need to be implemented with direct database access
    // or by mocking the expiration date
    throw new Error('Not implemented - use direct database access for testing')
  },

  triggerExpirationCheck: async (workspaceId?: string) => {
    await apiKeyNotificationService.checkExpiringKeys(workspaceId)
  },

  triggerAutoRenewal: async (workspaceId?: string) => {
    await apiKeyNotificationService.processAutoRenewal(workspaceId)
  }
}