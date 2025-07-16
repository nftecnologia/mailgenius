import { createSupabaseServerClient } from '@/lib/supabase'
import { apiAuth, APIPermission } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeRevoked = searchParams.get('include_revoked') === 'true'
    const getStats = searchParams.get('stats') === 'true'
    const getExpiring = searchParams.get('expiring') === 'true'
    const daysBefore = parseInt(searchParams.get('days_before') || '7')

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
    }

    const workspaceId = member.workspace_id

    if (getStats) {
      const stats = await apiAuth.getAPIKeyStats(workspaceId)
      return NextResponse.json({ stats })
    }

    if (getExpiring) {
      const expiringKeys = await apiAuth.getExpiringAPIKeys(workspaceId, daysBefore)
      return NextResponse.json({ expiring_keys: expiringKeys })
    }

    const apiKeys = await apiAuth.listAPIKeys(workspaceId, includeRevoked)
    
    // Mask the key_hash for security
    const maskedKeys = apiKeys.map(key => ({
      ...key,
      key_hash: undefined, // Remove hash from response
      masked_key: `es_live_***************************${key.key_hash?.slice(-6) || 'xxxxxx'}`
    }))

    return NextResponse.json({ api_keys: maskedKeys })

  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, permissions = [], expiration_days = 90, auto_renew = false } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json(
        { error: 'Selecione pelo menos uma permissão' },
        { status: 400 }
      )
    }

    // Validate permissions
    const validPermissions = Object.keys(apiAuth.constructor.prototype.constructor.API_PERMISSIONS || {})
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p))
    
    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        { error: `Permissões inválidas: ${invalidPermissions.join(', ')}` },
        { status: 400 }
      )
    }

    if (expiration_days < 1 || expiration_days > 365) {
      return NextResponse.json(
        { error: 'Período de expiração deve ser entre 1 e 365 dias' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
    }

    const result = await apiAuth.createAPIKey(
      member.workspace_id,
      name.trim(),
      permissions as APIPermission[],
      expiration_days,
      auto_renew
    )

    return NextResponse.json({
      message: 'API key criada com sucesso',
      api_key: result.apiKey,
      key_id: result.id
    })

  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { key_id, name, auto_renew, renewal_period_days, permissions } = body

    if (!key_id) {
      return NextResponse.json(
        { error: 'ID da API key é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
    }

    const settings: any = {}
    if (name !== undefined) settings.name = name
    if (auto_renew !== undefined) settings.auto_renew = auto_renew
    if (renewal_period_days !== undefined) settings.renewal_period_days = renewal_period_days
    if (permissions !== undefined) settings.permissions = permissions

    const success = await apiAuth.updateAPIKeySettings(
      key_id,
      member.workspace_id,
      settings,
      user.id
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao atualizar API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'API key atualizada com sucesso'
    })

  } catch (error) {
    console.error('Error updating API key:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')
    const reason = searchParams.get('reason') || 'Revogada manualmente'

    if (!keyId) {
      return NextResponse.json(
        { error: 'ID da API key é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 404 })
    }

    const success = await apiAuth.revokeAPIKey(keyId, member.workspace_id, user.id, reason)

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao revogar API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'API key revogada com sucesso'
    })

  } catch (error) {
    console.error('Error revoking API key:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}