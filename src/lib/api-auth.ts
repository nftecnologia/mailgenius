import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { rateLimiter, createRateLimitConfig, RateLimitProfile } from './rate-limiter'

export interface APIKeyData {
  id: string
  workspace_id: string
  name: string
  key_hash: string
  permissions: string[]
  last_used_at?: string
  created_at: string
  expires_at?: string
  auto_renew?: boolean
  renewal_period_days?: number
  status?: 'active' | 'expired' | 'revoked'
  revoked_at?: string
  revoked_by?: string
  revoked_reason?: string
}

export interface APIUser {
  workspace_id: string
  permissions: string[]
  api_key_id: string
}

// Available API permissions
export const API_PERMISSIONS = {
  'leads:read': 'Listar e visualizar leads',
  'leads:write': 'Criar e editar leads',
  'leads:delete': 'Excluir leads',
  'campaigns:read': 'Listar e visualizar campanhas',
  'campaigns:write': 'Criar e editar campanhas',
  'campaigns:send': 'Enviar campanhas',
  'templates:read': 'Listar e visualizar templates',
  'templates:write': 'Criar e editar templates',
  'automations:read': 'Listar e visualizar automações',
  'automations:write': 'Criar e editar automações',
  'analytics:read': 'Visualizar relatórios e analytics',
  'ab_tests:read': 'Visualizar testes A/B',
  'ab_tests:write': 'Criar e gerenciar testes A/B',
  'ab_tests:analyze': 'Acessar análises estatísticas'
} as const

export type APIPermission = keyof typeof API_PERMISSIONS

class APIAuthService {
  private generateAPIKey(): string {
    // Generate format: es_live_abc123def456ghi789jkl012mno345pqr678stu901vwx234
    const prefix = 'es_live_'
    const randomBytes = crypto.randomBytes(24).toString('hex')
    return prefix + randomBytes
  }

  private hashAPIKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex')
  }

  async createAPIKey(
    workspaceId: string,
    name: string,
    permissions: APIPermission[] = ['leads:read', 'campaigns:read'],
    expirationDays: number = 90,
    autoRenew: boolean = false
  ): Promise<{ apiKey: string; id: string }> {
    const supabase = createSupabaseServerClient()

    const apiKey = this.generateAPIKey()
    const keyHash = this.hashAPIKey(apiKey)
    const expiresAt = new Date(Date.now() + (expirationDays * 24 * 60 * 60 * 1000))

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        workspace_id: workspaceId,
        name,
        key_hash: keyHash,
        permissions,
        expires_at: expiresAt.toISOString(),
        auto_renew: autoRenew,
        renewal_period_days: expirationDays,
        status: 'active'
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Erro ao criar API key: ${error.message}`)
    }

    // Log the creation
    await this.logAPIKeyAction(workspaceId, data.id, 'created', null, null, {
      name,
      permissions,
      expires_at: expiresAt.toISOString(),
      auto_renew: autoRenew
    })

    return {
      apiKey,
      id: data.id
    }
  }

  async validateAPIKey(apiKey: string, request?: NextRequest): Promise<APIUser | null> {
    if (!apiKey || !apiKey.startsWith('es_live_')) {
      return null
    }

    const keyHash = this.hashAPIKey(apiKey)
    const supabase = createSupabaseServerClient()

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .single()

    if (error || !data) {
      return null
    }

    // Check if key is active
    if (data.status !== 'active') {
      return null
    }

    // Check if key has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Mark as expired if not already
      if (data.status === 'active') {
        await supabase
          .from('api_keys')
          .update({ status: 'expired' })
          .eq('id', data.id)
        
        // Log expiration
        await this.logAPIKeyAction(data.workspace_id, data.id, 'expired', null, null, {
          expired_at: new Date().toISOString()
        })
      }
      return null
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)

    // Log usage
    const ip = request ? this.getClientIP(request) : null
    const userAgent = request ? request.headers.get('user-agent') : null
    await this.logAPIKeyAction(data.workspace_id, data.id, 'used', null, ip, {
      user_agent: userAgent,
      endpoint: request ? request.url : null
    })

    return {
      workspace_id: data.workspace_id,
      permissions: data.permissions,
      api_key_id: data.id
    }
  }

  async revokeAPIKey(keyId: string, workspaceId: string, userId?: string, reason?: string): Promise<boolean> {
    const supabase = createSupabaseServerClient()

    const { error } = await supabase
      .from('api_keys')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: userId,
        revoked_reason: reason
      })
      .eq('id', keyId)
      .eq('workspace_id', workspaceId)

    if (!error) {
      // Log revocation
      await this.logAPIKeyAction(workspaceId, keyId, 'revoked', userId, null, {
        reason,
        revoked_at: new Date().toISOString()
      })
    }

    return !error
  }

  async listAPIKeys(workspaceId: string, includeRevoked: boolean = false): Promise<APIKeyData[]> {
    const supabase = createSupabaseServerClient()

    let query = supabase
      .from('api_keys')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (!includeRevoked) {
      query = query.neq('status', 'revoked')
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Erro ao listar API keys: ${error.message}`)
    }

    return data || []
  }

  hasPermission(user: APIUser, permission: APIPermission): boolean {
    return user.permissions.includes(permission)
  }

  requirePermission(user: APIUser, permission: APIPermission): void {
    if (!this.hasPermission(user, permission)) {
      throw new Error(`Permissão necessária: ${permission}`)
    }
  }

  async renewAPIKey(keyId: string, workspaceId: string, userId?: string, extensionDays?: number): Promise<boolean> {
    const supabase = createSupabaseServerClient()

    // Get current key info
    const { data: keyData, error: fetchError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !keyData) {
      throw new Error('API key não encontrada')
    }

    const days = extensionDays || keyData.renewal_period_days || 90
    const newExpiryDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000))

    const { error } = await supabase
      .from('api_keys')
      .update({
        expires_at: newExpiryDate.toISOString(),
        status: 'active'
      })
      .eq('id', keyId)
      .eq('workspace_id', workspaceId)

    if (!error) {
      // Log renewal
      await this.logAPIKeyAction(workspaceId, keyId, 'renewed', userId, null, {
        new_expiry: newExpiryDate.toISOString(),
        extension_days: days,
        renewed_at: new Date().toISOString()
      })
    }

    return !error
  }

  async updateAPIKeySettings(
    keyId: string,
    workspaceId: string,
    settings: {
      name?: string
      auto_renew?: boolean
      renewal_period_days?: number
      permissions?: APIPermission[]
    },
    userId?: string
  ): Promise<boolean> {
    const supabase = createSupabaseServerClient()

    const { error } = await supabase
      .from('api_keys')
      .update(settings)
      .eq('id', keyId)
      .eq('workspace_id', workspaceId)

    if (!error) {
      // Log settings update
      await this.logAPIKeyAction(workspaceId, keyId, 'updated', userId, null, {
        updated_settings: settings,
        updated_at: new Date().toISOString()
      })
    }

    return !error
  }

  async getAPIKeyAuditLogs(keyId: string, workspaceId: string, limit: number = 50): Promise<any[]> {
    const supabase = createSupabaseServerClient()

    const { data, error } = await supabase
      .from('api_key_audit_logs')
      .select('*')
      .eq('api_key_id', keyId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Erro ao buscar logs de auditoria: ${error.message}`)
    }

    return data || []
  }

  async getExpiringAPIKeys(workspaceId: string, daysBefore: number = 7): Promise<APIKeyData[]> {
    const supabase = createSupabaseServerClient()
    const cutoffDate = new Date(Date.now() + (daysBefore * 24 * 60 * 60 * 1000))

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .lt('expires_at', cutoffDate.toISOString())
      .order('expires_at', { ascending: true })

    if (error) {
      throw new Error(`Erro ao buscar API keys expiradas: ${error.message}`)
    }

    return data || []
  }

  async getAPIKeyStats(workspaceId: string): Promise<{
    total: number
    active: number
    expired: number
    revoked: number
    expiring_soon: number
  }> {
    const supabase = createSupabaseServerClient()

    const { data, error } = await supabase
      .from('api_keys')
      .select('status, expires_at')
      .eq('workspace_id', workspaceId)

    if (error) {
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`)
    }

    const now = new Date()
    const soonDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000))

    const stats = {
      total: data.length,
      active: 0,
      expired: 0,
      revoked: 0,
      expiring_soon: 0
    }

    data.forEach(key => {
      if (key.status === 'active') {
        stats.active++
        if (key.expires_at && new Date(key.expires_at) <= soonDate) {
          stats.expiring_soon++
        }
      } else if (key.status === 'expired') {
        stats.expired++
      } else if (key.status === 'revoked') {
        stats.revoked++
      }
    })

    return stats
  }

  private async logAPIKeyAction(
    workspaceId: string,
    apiKeyId: string,
    action: string,
    userId?: string | null,
    ipAddress?: string | null,
    metadata?: any
  ): Promise<void> {
    const supabase = createSupabaseServerClient()

    try {
      await supabase
        .from('api_key_audit_logs')
        .insert({
          workspace_id: workspaceId,
          api_key_id: apiKeyId,
          action,
          user_id: userId,
          ip_address: ipAddress,
          metadata: metadata || {}
        })
    } catch (error) {
      console.error('Error logging API key action:', error)
    }
  }

  private getClientIP(request: NextRequest): string | null {
    const forwarded = request.headers.get('x-forwarded-for')
    const real = request.headers.get('x-real-ip')
    const remote = request.headers.get('x-remote-addr')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    return real || remote || null
  }
}

export const apiAuth = new APIAuthService()

// Middleware helper for API authentication
export async function authenticateAPIRequest(request: NextRequest): Promise<APIUser> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token de autorização necessário')
  }

  const apiKey = authHeader.substring(7) // Remove "Bearer " prefix

  const user = await apiAuth.validateAPIKey(apiKey, request)

  if (!user) {
    throw new Error('API key inválida ou expirada')
  }

  return user
}

// Enhanced rate limiting with multiple profiles
export class APIRateLimiter {
  async checkLimit(identifier: string, profile: RateLimitProfile = 'API_STANDARD'): Promise<boolean> {
    const config = createRateLimitConfig(identifier, profile)
    const result = await rateLimiter.checkLimit(config)
    return result.allowed
  }

  async getRemainingRequests(identifier: string, profile: RateLimitProfile = 'API_STANDARD'): Promise<number> {
    const config = createRateLimitConfig(identifier, profile)
    const result = await rateLimiter.checkLimit(config)
    return result.remaining
  }

  async getResetTime(identifier: string, profile: RateLimitProfile = 'API_STANDARD'): Promise<number> {
    const config = createRateLimitConfig(identifier, profile)
    const result = await rateLimiter.checkLimit(config)
    return result.resetTime
  }

  async resetLimit(identifier: string): Promise<boolean> {
    return rateLimiter.resetLimit(identifier)
  }
}

export const apiRateLimiter = new APIRateLimiter()

// Enhanced API response helper with rate limit headers
export function createAPIResponse(data: any, status = 200, rateLimitHeaders?: Record<string, string>) {
  const response = Response.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }, { status })

  // Add rate limit headers if provided
  if (rateLimitHeaders) {
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  return response
}

export function createAPIError(message: string, status = 400, code?: string, rateLimitHeaders?: Record<string, string>) {
  const response = Response.json({
    success: false,
    error: {
      message,
      code: code || 'API_ERROR',
      timestamp: new Date().toISOString()
    }
  }, { status })

  // Add rate limit headers if provided
  if (rateLimitHeaders) {
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  return response
}
