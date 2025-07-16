import { createSupabaseServerClient } from '@/lib/supabase'
import { apiKeyNotificationService } from '@/lib/api-key-notifications'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pending = searchParams.get('pending') === 'true'
    const stats = searchParams.get('stats') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

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

    if (stats) {
      const notificationStats = await apiKeyNotificationService.getNotificationStats(workspaceId)
      return NextResponse.json({ stats: notificationStats })
    }

    if (pending) {
      const notifications = await apiKeyNotificationService.getPendingNotifications(workspaceId)
      return NextResponse.json({ notifications })
    }

    const notifications = await apiKeyNotificationService.getNotificationHistory(workspaceId, limit)
    return NextResponse.json({ notifications })

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

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

    switch (action) {
      case 'check_expiring':
        await apiKeyNotificationService.checkExpiringKeys(workspaceId)
        return NextResponse.json({ message: 'Verificação de expiração executada' })

      case 'process_queue':
        await apiKeyNotificationService.processNotificationQueue(workspaceId)
        return NextResponse.json({ message: 'Fila de notificações processada' })

      case 'auto_renew':
        await apiKeyNotificationService.processAutoRenewal(workspaceId)
        return NextResponse.json({ message: 'Renovação automática processada' })

      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error processing notification action:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { notification_id, status } = body

    if (!notification_id || !status) {
      return NextResponse.json(
        { error: 'ID da notificação e status são obrigatórios' },
        { status: 400 }
      )
    }

    if (!['sent', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: 'Status deve ser "sent" ou "failed"' },
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

    // Verify notification belongs to workspace
    const { data: notification } = await supabase
      .from('api_key_notifications')
      .select('id')
      .eq('id', notification_id)
      .eq('workspace_id', member.workspace_id)
      .single()

    if (!notification) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
    }

    let success = false
    if (status === 'sent') {
      success = await apiKeyNotificationService.markNotificationAsSent(notification_id)
    } else if (status === 'failed') {
      success = await apiKeyNotificationService.markNotificationAsFailed(notification_id)
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao atualizar status da notificação' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Status da notificação atualizado com sucesso'
    })

  } catch (error) {
    console.error('Error updating notification status:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}