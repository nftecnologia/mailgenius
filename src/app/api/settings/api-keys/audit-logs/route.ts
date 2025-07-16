import { createSupabaseServerClient } from '@/lib/supabase'
import { apiAuth } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('key_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const action = searchParams.get('action')

    if (!keyId) {
      return NextResponse.json(
        { error: 'ID da API key é obrigatório' },
        { status: 400 }
      )
    }

    if (limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Limit deve ser entre 1 e 1000' },
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

    // Verify the API key belongs to the workspace
    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('workspace_id', member.workspace_id)
      .single()

    if (!apiKey) {
      return NextResponse.json({ error: 'API key não encontrada' }, { status: 404 })
    }

    let query = supabase
      .from('api_key_audit_logs')
      .select(`
        *,
        user:users(name, email)
      `)
      .eq('api_key_id', keyId)
      .eq('workspace_id', member.workspace_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (action) {
      query = query.eq('action', action)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar logs de auditoria' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      audit_logs: logs || [],
      total: logs?.length || 0
    })

  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET_SUMMARY(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('key_id')
    const days = parseInt(searchParams.get('days') || '30')

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

    // Get usage statistics for the last N days
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))

    const { data: usageStats, error } = await supabase
      .from('api_key_audit_logs')
      .select('action, created_at, metadata')
      .eq('api_key_id', keyId)
      .eq('workspace_id', member.workspace_id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching usage stats:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar estatísticas de uso' },
        { status: 500 }
      )
    }

    // Process statistics
    const stats = {
      total_requests: 0,
      daily_usage: {} as Record<string, number>,
      actions_summary: {} as Record<string, number>,
      endpoints_accessed: {} as Record<string, number>,
      last_activity: null as string | null
    }

    usageStats?.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0]
      
      if (log.action === 'used') {
        stats.total_requests++
        stats.daily_usage[date] = (stats.daily_usage[date] || 0) + 1
        
        if (log.metadata?.endpoint) {
          const endpoint = log.metadata.endpoint
          stats.endpoints_accessed[endpoint] = (stats.endpoints_accessed[endpoint] || 0) + 1
        }
      }
      
      stats.actions_summary[log.action] = (stats.actions_summary[log.action] || 0) + 1
      
      if (!stats.last_activity) {
        stats.last_activity = log.created_at
      }
    })

    return NextResponse.json({
      usage_stats: stats,
      period_days: days
    })

  } catch (error) {
    console.error('Error fetching usage summary:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}