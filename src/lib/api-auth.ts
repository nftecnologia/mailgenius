import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

export interface APIKeyData {
  id: string
  workspace_id: string
  name: string
  key_hash: string
  permissions: string[]
  last_used_at?: string
  created_at: string
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
    permissions: APIPermission[] = ['leads:read', 'campaigns:read']
  ): Promise<{ apiKey: string; id: string }> {
    const supabase = createSupabaseServerClient()

    const apiKey = this.generateAPIKey()
    const keyHash = this.hashAPIKey(apiKey)

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        workspace_id: workspaceId,
        name,
        key_hash: keyHash,
        permissions
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Erro ao criar API key: ${error.message}`)
    }

    return {
      apiKey,
      id: data.id
    }
  }

  async validateAPIKey(apiKey: string): Promise<APIUser | null> {
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

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)

    return {
      workspace_id: data.workspace_id,
      permissions: data.permissions,
      api_key_id: data.id
    }
  }

  async revokeAPIKey(keyId: string, workspaceId: string): Promise<boolean> {
    const supabase = createSupabaseServerClient()

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('workspace_id', workspaceId)

    return !error
  }

  async listAPIKeys(workspaceId: string): Promise<APIKeyData[]> {
    const supabase = createSupabaseServerClient()

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

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
}

export const apiAuth = new APIAuthService()

// Middleware helper for API authentication
export async function authenticateAPIRequest(request: NextRequest): Promise<APIUser> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token de autorização necessário')
  }

  const apiKey = authHeader.substring(7) // Remove "Bearer " prefix

  const user = await apiAuth.validateAPIKey(apiKey)

  if (!user) {
    throw new Error('API key inválida')
  }

  return user
}

// Rate limiting helper (simple in-memory implementation)
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>()
  private readonly limit = 1000 // requests per hour
  private readonly windowMs = 60 * 60 * 1000 // 1 hour

  checkLimit(identifier: string): boolean {
    const now = Date.now()
    const userRequests = this.requests.get(identifier)

    if (!userRequests || now > userRequests.resetTime) {
      // Reset the counter
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return true
    }

    if (userRequests.count >= this.limit) {
      return false
    }

    userRequests.count++
    return true
  }

  getRemainingRequests(identifier: string): number {
    const userRequests = this.requests.get(identifier)
    if (!userRequests || Date.now() > userRequests.resetTime) {
      return this.limit
    }
    return Math.max(0, this.limit - userRequests.count)
  }

  getResetTime(identifier: string): number {
    const userRequests = this.requests.get(identifier)
    if (!userRequests || Date.now() > userRequests.resetTime) {
      return Date.now() + this.windowMs
    }
    return userRequests.resetTime
  }
}

export const rateLimiter = new RateLimiter()

// Standard API response helper
export function createAPIResponse(data: any, status = 200) {
  return Response.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }, { status })
}

export function createAPIError(message: string, status = 400, code?: string) {
  return Response.json({
    success: false,
    error: {
      message,
      code: code || 'API_ERROR',
      timestamp: new Date().toISOString()
    }
  }, { status })
}
