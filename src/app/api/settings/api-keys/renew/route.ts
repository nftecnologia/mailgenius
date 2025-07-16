import { createSupabaseServerClient } from '@/lib/supabase'
import { apiAuth } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key_id, extension_days } = body

    if (!key_id) {
      return NextResponse.json(
        { error: 'ID da API key é obrigatório' },
        { status: 400 }
      )
    }

    if (extension_days && (extension_days < 1 || extension_days > 365)) {
      return NextResponse.json(
        { error: 'Período de extensão deve ser entre 1 e 365 dias' },
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

    const success = await apiAuth.renewAPIKey(
      key_id,
      member.workspace_id,
      user.id,
      extension_days
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao renovar API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'API key renovada com sucesso'
    })

  } catch (error) {
    console.error('Error renewing API key:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}