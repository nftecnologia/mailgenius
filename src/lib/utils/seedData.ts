import { supabaseAdmin } from '@/lib/supabase'
import { subDays } from 'date-fns'

export async function seedSupabaseData() {
  console.log('🌱 Starting Supabase data seeding...')

  try {
    // Create a demo workspace
    console.log('📝 Creating demo workspace...')
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .upsert({
        id: 'demo-workspace-123',
        name: 'Workspace Demo',
        slug: 'demo-workspace',
        plan: 'professional',
        settings: {
          timezone: 'America/Sao_Paulo',
          language: 'pt-BR'
        }
      }, {
        onConflict: 'id'
      })
      .select()
      .single()

    if (workspaceError) {
      console.error('❌ Error creating workspace:', workspaceError)
    } else {
      console.log('✅ Demo workspace created')
    }

    // Create demo leads
    console.log('📝 Creating demo leads...')
    const demoLeads = [
      {
        workspace_id: 'demo-workspace-123',
        email: 'joao.silva@email.com',
        name: 'João Silva',
        company: 'TechCorp',
        position: 'CEO',
        source: 'Website',
        status: 'active',
        tags: ['interessado', 'vip'],
        custom_fields: { budget: '10000', industry: 'tecnologia' }
      },
      {
        workspace_id: 'demo-workspace-123',
        email: 'maria.santos@startup.com',
        name: 'Maria Santos',
        company: 'StartupXYZ',
        position: 'Marketing Manager',
        source: 'CSV Import',
        status: 'active',
        tags: ['marketing', 'startup'],
        custom_fields: { company_size: '50', region: 'sudeste' }
      },
      {
        workspace_id: 'demo-workspace-123',
        email: 'carlos.oliveira@empresa.com',
        name: 'Carlos Oliveira',
        company: 'InnovaCo',
        position: 'Diretor Comercial',
        source: 'API',
        status: 'active',
        tags: ['comercial', 'enterprise'],
        custom_fields: { revenue: '1000000', employees: '100' }
      },
      {
        workspace_id: 'demo-workspace-123',
        email: 'ana.costa@scale.tech',
        name: 'Ana Costa',
        company: 'ScaleTech',
        position: 'CTO',
        source: 'Manual',
        status: 'active',
        tags: ['tech', 'executive'],
        custom_fields: { tech_stack: 'React, Node.js', team_size: '25' }
      },
      {
        workspace_id: 'demo-workspace-123',
        email: 'pedro.ferreira@growth.co',
        name: 'Pedro Ferreira',
        company: 'GrowthCo',
        position: 'Growth Manager',
        source: 'Website',
        status: 'inactive',
        tags: ['growth', 'saas'],
        custom_fields: { mrr: '50000', churn_rate: '5%' }
      }
    ]

    const { error: leadsError } = await supabaseAdmin
      .from('leads')
      .upsert(demoLeads, {
        onConflict: 'workspace_id,email'
      })

    if (leadsError) {
      console.error('❌ Error creating leads:', leadsError)
    } else {
      console.log('✅ Demo leads created:', demoLeads.length)
    }

    // Create demo email templates
    console.log('📝 Creating demo email templates...')
    const demoTemplates = [
      {
        workspace_id: 'demo-workspace-123',
        name: 'Newsletter Mensal',
        subject: 'Novidades do mês - {{company_name}}',
        html_content: '<h1>Olá {{name}}!</h1><p>Confira as novidades deste mês...</p>',
        text_content: 'Olá {{name}}! Confira as novidades deste mês...',
        variables: ['name', 'company_name'],
        template_type: 'newsletter'
      },
      {
        workspace_id: 'demo-workspace-123',
        name: 'Bem-vindo',
        subject: 'Bem-vindo à {{company_name}}!',
        html_content: '<h1>Bem-vindo, {{name}}!</h1><p>Estamos felizes em tê-lo conosco.</p>',
        text_content: 'Bem-vindo, {{name}}! Estamos felizes em tê-lo conosco.',
        variables: ['name', 'company_name'],
        template_type: 'welcome'
      },
      {
        workspace_id: 'demo-workspace-123',
        name: 'Promoção Black Friday',
        subject: '🔥 Black Friday: 50% OFF para {{name}}',
        html_content: '<h1>Oferta Especial!</h1><p>{{name}}, aproveite 50% de desconto!</p>',
        text_content: 'Oferta Especial! {{name}}, aproveite 50% de desconto!',
        variables: ['name'],
        template_type: 'promotional'
      }
    ]

    const { error: templatesError } = await supabaseAdmin
      .from('email_templates')
      .upsert(demoTemplates, {
        onConflict: 'workspace_id,name'
      })

    if (templatesError) {
      console.error('❌ Error creating templates:', templatesError)
    } else {
      console.log('✅ Demo templates created:', demoTemplates.length)
    }

    // Create demo campaigns
    console.log('📝 Creating demo campaigns...')
    const demoCampaigns = [
      {
        workspace_id: 'demo-workspace-123',
        name: 'Newsletter Janeiro 2025',
        subject: 'Novidades do mês - MailGenius',
        status: 'sent',
        sent_at: subDays(new Date(), 5).toISOString(),
        total_recipients: 1250,
        delivered: 1230,
        opened: 315,
        clicked: 65,
        bounced: 20,
        unsubscribed: 5,
        complained: 2
      },
      {
        workspace_id: 'demo-workspace-123',
        name: 'Promoção Black Friday',
        subject: '🔥 Black Friday: 50% OFF',
        status: 'sent',
        sent_at: subDays(new Date(), 15).toISOString(),
        total_recipients: 2850,
        delivered: 2790,
        opened: 879,
        clicked: 246,
        bounced: 60,
        unsubscribed: 12,
        complained: 3
      },
      {
        workspace_id: 'demo-workspace-123',
        name: 'Welcome Series',
        subject: 'Bem-vindo à MailGenius!',
        status: 'sent',
        sent_at: subDays(new Date(), 3).toISOString(),
        total_recipients: 450,
        delivered: 446,
        opened: 188,
        clicked: 55,
        bounced: 4,
        unsubscribed: 2,
        complained: 0
      },
      {
        workspace_id: 'demo-workspace-123',
        name: 'Product Launch',
        subject: '🚀 Novo recurso: IA Generativa',
        status: 'sent',
        sent_at: subDays(new Date(), 8).toISOString(),
        total_recipients: 1890,
        delivered: 1824,
        opened: 527,
        clicked: 124,
        bounced: 66,
        unsubscribed: 8,
        complained: 1
      },
      {
        workspace_id: 'demo-workspace-123',
        name: 'Campanha Futura',
        subject: 'Próxima campanha em preparação',
        status: 'draft',
        send_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        total_recipients: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        complained: 0
      }
    ]

    const { error: campaignsError } = await supabaseAdmin
      .from('campaigns')
      .upsert(demoCampaigns, {
        onConflict: 'workspace_id,name'
      })

    if (campaignsError) {
      console.error('❌ Error creating campaigns:', campaignsError)
    } else {
      console.log('✅ Demo campaigns created:', demoCampaigns.length)
    }

    console.log('🎉 Supabase data seeding completed successfully!')
    return {
      success: true,
      workspace: workspace?.id || 'demo-workspace-123',
      leads: demoLeads.length,
      templates: demoTemplates.length,
      campaigns: demoCampaigns.length
    }

  } catch (error) {
    console.error('❌ Error seeding Supabase data:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Function to check if data exists
export async function checkSupabaseData(workspaceId: string = 'demo-workspace-123') {
  try {
    console.log('🔍 Checking existing Supabase data...')

    const [
      { data: workspace, error: workspaceError },
      { data: leads, error: leadsError },
      { data: campaigns, error: campaignsError },
      { data: templates, error: templatesError }
    ] = await Promise.all([
      supabaseAdmin.from('workspaces').select('*').eq('id', workspaceId).single(),
      supabaseAdmin.from('leads').select('*').eq('workspace_id', workspaceId),
      supabaseAdmin.from('campaigns').select('*').eq('workspace_id', workspaceId),
      supabaseAdmin.from('email_templates').select('*').eq('workspace_id', workspaceId)
    ])

    return {
      workspace: workspace ? true : false,
      workspaceError,
      leadsCount: leads?.length || 0,
      leadsError,
      campaignsCount: campaigns?.length || 0,
      campaignsError,
      templatesCount: templates?.length || 0,
      templatesError,
      hasData: (leads?.length || 0) > 0 && (campaigns?.length || 0) > 0
    }

  } catch (error) {
    console.error('❌ Error checking Supabase data:', error)
    return {
      workspace: false,
      hasData: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
