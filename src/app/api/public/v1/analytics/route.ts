import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { authenticateAPIRequest, APIPermission, createAPIResponse, createAPIError, rateLimiter } from '@/lib/api-auth'
import { subDays, format } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    // Authenticate API request
    const user = await authenticateAPIRequest(request)

    // Check rate limiting
    if (!rateLimiter.checkLimit(user.api_key_id)) {
      return createAPIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Check permissions
    if (!user.permissions.includes('analytics:read' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overview'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const campaignId = searchParams.get('campaign_id')

    // Default to last 30 days if no date range provided
    const defaultStartDate = subDays(new Date(), 30)
    const defaultEndDate = new Date()

    const start = startDate ? new Date(startDate) : defaultStartDate
    const end = endDate ? new Date(endDate) : defaultEndDate

    // Validate date range
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return createAPIError('Invalid date format', 400, 'VALIDATION_ERROR')
    }

    if (start > end) {
      return createAPIError('Start date must be before end date', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseServerClient()

    let response: any = {}

    switch (type) {
      case 'overview':
        response = await getOverviewAnalytics(supabase, user.workspace_id, start, end)
        break
      case 'campaigns':
        response = await getCampaignAnalytics(supabase, user.workspace_id, start, end, campaignId || undefined)
        break
      case 'leads':
        response = await getLeadAnalytics(supabase, user.workspace_id, start, end)
        break
      case 'performance':
        response = await getPerformanceAnalytics(supabase, user.workspace_id, start, end)
        break
      default:
        return createAPIError('Invalid analytics type. Valid types: overview, campaigns, leads, performance', 400, 'VALIDATION_ERROR')
    }

    return createAPIResponse({
      type,
      period: {
        start_date: start.toISOString(),
        end_date: end.toISOString()
      },
      ...response
    })

  } catch (error: any) {
    console.error('Public API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('Token de autorização') || error.message.includes('API key')) {
        return createAPIError(error.message, 401, 'UNAUTHORIZED')
      }
      return createAPIError(error.message, 400, 'BAD_REQUEST')
    }

    return createAPIError('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

async function getOverviewAnalytics(supabase: any, workspaceId: string, startDate: Date, endDate: Date) {
  try {
    // Get campaign summary
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Get leads summary
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Calculate totals
    const totalCampaigns = campaigns?.length || 0
    const totalLeads = leads?.length || 0

    const emailStats = campaigns?.reduce((acc: any, campaign: any) => ({
      sent: acc.sent + (campaign.total_recipients || 0),
      delivered: acc.delivered + (campaign.delivered || 0),
      opened: acc.opened + (campaign.opened || 0),
      clicked: acc.clicked + (campaign.clicked || 0),
      bounced: acc.bounced + (campaign.bounced || 0),
      unsubscribed: acc.unsubscribed + (campaign.unsubscribed || 0)
    }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }) ||
    { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }

    // Calculate rates
    const deliveryRate = emailStats.sent > 0 ? (emailStats.delivered / emailStats.sent) * 100 : 0
    const openRate = emailStats.delivered > 0 ? (emailStats.opened / emailStats.delivered) * 100 : 0
    const clickRate = emailStats.opened > 0 ? (emailStats.clicked / emailStats.opened) * 100 : 0
    const unsubscribeRate = emailStats.sent > 0 ? (emailStats.unsubscribed / emailStats.sent) * 100 : 0

    // Lead sources
    const leadSources = leads?.reduce((acc: any, lead: any) => {
      const source = lead.source || 'unknown'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {}) || {}

    return {
      summary: {
        total_campaigns: totalCampaigns,
        total_leads: totalLeads,
        emails_sent: emailStats.sent,
        delivery_rate: Number(deliveryRate.toFixed(2)),
        open_rate: Number(openRate.toFixed(2)),
        click_rate: Number(clickRate.toFixed(2)),
        unsubscribe_rate: Number(unsubscribeRate.toFixed(2))
      },
      email_stats: emailStats,
      lead_sources: leadSources
    }
  } catch (error) {
    console.error('Error getting overview analytics:', error)
    throw error
  }
}

async function getCampaignAnalytics(supabase: any, workspaceId: string, startDate: Date, endDate: Date, campaignId?: string) {
  try {
    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (campaignId) {
      query = query.eq('id', campaignId)
    }

    const { data: campaigns } = await query

    if (!campaigns) {
      return { campaigns: [], total_campaigns: 0 }
    }

    const campaignAnalytics = campaigns.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      status: campaign.status,
      created_at: campaign.created_at,
      sent_at: campaign.sent_at,
      stats: {
        total_recipients: campaign.total_recipients || 0,
        delivered: campaign.delivered || 0,
        opened: campaign.opened || 0,
        clicked: campaign.clicked || 0,
        bounced: campaign.bounced || 0,
        unsubscribed: campaign.unsubscribed || 0,
        complained: campaign.complained || 0,
        delivery_rate: campaign.total_recipients && campaign.total_recipients > 0
          ? Number(((campaign.delivered || 0) / campaign.total_recipients * 100).toFixed(2))
          : 0,
        open_rate: campaign.delivered && campaign.delivered > 0
          ? Number(((campaign.opened || 0) / campaign.delivered * 100).toFixed(2))
          : 0,
        click_rate: campaign.opened && campaign.opened > 0
          ? Number(((campaign.clicked || 0) / campaign.opened * 100).toFixed(2))
          : 0,
        unsubscribe_rate: campaign.total_recipients && campaign.total_recipients > 0
          ? Number(((campaign.unsubscribed || 0) / campaign.total_recipients * 100).toFixed(2))
          : 0
      }
    }))

    return {
      campaigns: campaignAnalytics,
      total_campaigns: campaigns.length
    }
  } catch (error) {
    console.error('Error getting campaign analytics:', error)
    throw error
  }
}

async function getLeadAnalytics(supabase: any, workspaceId: string, startDate: Date, endDate: Date) {
  try {
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (!leads) {
      return {
        leads_summary: {
          total_leads: 0,
          status_distribution: {},
          source_distribution: {}
        },
        lead_growth: []
      }
    }

    // Status distribution
    const statusDistribution = leads.reduce((acc: any, lead: any) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1
      return acc
    }, {})

    // Source distribution
    const sourceDistribution = leads.reduce((acc: any, lead: any) => {
      const source = lead.source || 'unknown'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {})

    // Lead growth by day
    const leadGrowth: any[] = []
    const currentDate = new Date(startDate)
    const endDateObj = new Date(endDate)

    while (currentDate <= endDateObj) {
      const dayString = format(currentDate, 'yyyy-MM-dd')
      const dayLeads = leads.filter((lead: any) =>
        format(new Date(lead.created_at), 'yyyy-MM-dd') === dayString
      )

      leadGrowth.push({
        date: dayString,
        new_leads: dayLeads.length,
        cumulative_leads: leads.filter((lead: any) =>
          new Date(lead.created_at) <= currentDate
        ).length
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return {
      leads_summary: {
        total_leads: leads.length,
        status_distribution: statusDistribution,
        source_distribution: sourceDistribution
      },
      lead_growth: leadGrowth
    }
  } catch (error) {
    console.error('Error getting lead analytics:', error)
    throw error
  }
}

async function getPerformanceAnalytics(supabase: any, workspaceId: string, startDate: Date, endDate: Date) {
  try {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'sent')

    if (!campaigns || campaigns.length === 0) {
      return {
        performance_trends: [],
        top_performing_campaigns: [],
        benchmarks: {
          average_open_rate: 0,
          average_click_rate: 0,
          average_delivery_rate: 0,
          industry_benchmarks: {
            open_rate: 21.33,
            click_rate: 2.62,
            delivery_rate: 95.0
          }
        }
      }
    }

    // Performance trends by day
    const performanceTrends: any[] = []
    const currentDate = new Date(startDate)
    const endDateObj = new Date(endDate)

    while (currentDate <= endDateObj) {
      const dayString = format(currentDate, 'yyyy-MM-dd')
      const dayCampaigns = campaigns.filter((campaign: any) =>
        campaign.sent_at && format(new Date(campaign.sent_at), 'yyyy-MM-dd') === dayString
      )

      const dayStats = dayCampaigns.reduce((acc: any, campaign: any) => ({
        sent: acc.sent + (campaign.total_recipients || 0),
        delivered: acc.delivered + (campaign.delivered || 0),
        opened: acc.opened + (campaign.opened || 0),
        clicked: acc.clicked + (campaign.clicked || 0)
      }), { sent: 0, delivered: 0, opened: 0, clicked: 0 })

      performanceTrends.push({
        date: dayString,
        ...dayStats,
        delivery_rate: dayStats.sent > 0 ? Number(((dayStats.delivered / dayStats.sent) * 100).toFixed(2)) : 0,
        open_rate: dayStats.delivered > 0 ? Number(((dayStats.opened / dayStats.delivered) * 100).toFixed(2)) : 0,
        click_rate: dayStats.opened > 0 ? Number(((dayStats.clicked / dayStats.opened) * 100).toFixed(2)) : 0
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Top performing campaigns
    const topPerformingCampaigns = campaigns
      .map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        sent_at: campaign.sent_at,
        open_rate: campaign.delivered && campaign.delivered > 0
          ? Number(((campaign.opened || 0) / campaign.delivered * 100).toFixed(2))
          : 0,
        click_rate: campaign.opened && campaign.opened > 0
          ? Number(((campaign.clicked || 0) / campaign.opened * 100).toFixed(2))
          : 0,
        total_recipients: campaign.total_recipients || 0
      }))
      .sort((a: any, b: any) => b.open_rate - a.open_rate)
      .slice(0, 10)

    // Calculate benchmarks
    const avgOpenRate = campaigns.reduce((acc: any, campaign: any) => {
      return acc + (campaign.delivered && campaign.delivered > 0 ? ((campaign.opened || 0) / campaign.delivered) * 100 : 0)
    }, 0) / campaigns.length

    const avgClickRate = campaigns.reduce((acc: any, campaign: any) => {
      return acc + (campaign.opened && campaign.opened > 0 ? ((campaign.clicked || 0) / campaign.opened) * 100 : 0)
    }, 0) / campaigns.length

    const avgDeliveryRate = campaigns.reduce((acc: any, campaign: any) => {
      return acc + (campaign.total_recipients && campaign.total_recipients > 0 ? ((campaign.delivered || 0) / campaign.total_recipients) * 100 : 0)
    }, 0) / campaigns.length

    return {
      performance_trends: performanceTrends,
      top_performing_campaigns: topPerformingCampaigns,
      benchmarks: {
        average_open_rate: Number(avgOpenRate.toFixed(2)),
        average_click_rate: Number(avgClickRate.toFixed(2)),
        average_delivery_rate: Number(avgDeliveryRate.toFixed(2)),
        industry_benchmarks: {
          open_rate: 21.33, // Industry average
          click_rate: 2.62,  // Industry average
          delivery_rate: 95.0 // Industry average
        }
      }
    }
  } catch (error) {
    console.error('Error getting performance analytics:', error)
    throw error
  }
}
