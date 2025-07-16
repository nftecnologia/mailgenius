import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow, subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface DashboardStats {
  totalLeads: number
  activeLeads: number
  totalCampaigns: number
  activeCampaigns: number
  totalEmailsSent: number
  deliveryRate: number
  openRate: number
  clickRate: number
}

export interface RecentActivity {
  id: string
  type: string
  description: string
  created_at: string
}

export interface ChartData {
  campaign: Array<{
    date: string
    sent: number
    delivered: number
    opened: number
    clicked: number
  }>
  leadsSource: Array<{
    source: string
    count: number
    percentage: number
  }>
  conversion: Array<{
    campaign: string
    deliveryRate: number
    openRate: number
    clickRate: number
    totalSent: number
  }>
}

export function useSupabaseData(workspaceId: string | null) {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    activeLeads: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalEmailsSent: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [chartData, setChartData] = useState<ChartData>({
    campaign: [],
    leadsSource: [],
    conversion: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load dashboard stats from Supabase
  const loadStats = async (workspaceId: string) => {
    try {
      console.log('🔄 Loading real stats from Supabase...')

      // Get leads stats
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, status')
        .eq('workspace_id', workspaceId)

      if (leadsError) throw leadsError

      const totalLeads = leadsData?.length || 0
      const activeLeads = leadsData?.filter(lead => lead.status === 'active')?.length || 0

      // Get campaigns stats
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, status, total_recipients, delivered, opened, clicked')
        .eq('workspace_id', workspaceId)

      if (campaignsError) throw campaignsError

      const totalCampaigns = campaignsData?.length || 0
      const activeCampaigns = campaignsData?.filter(campaign => campaign.status === 'active' || campaign.status === 'sending')?.length || 0

      // Calculate email stats
      const totalEmailsSent = campaignsData?.reduce((sum, campaign) => sum + (campaign.total_recipients || 0), 0) || 0
      const totalDelivered = campaignsData?.reduce((sum, campaign) => sum + (campaign.delivered || 0), 0) || 0
      const totalOpened = campaignsData?.reduce((sum, campaign) => sum + (campaign.opened || 0), 0) || 0
      const totalClicked = campaignsData?.reduce((sum, campaign) => sum + (campaign.clicked || 0), 0) || 0

      const deliveryRate = totalEmailsSent > 0 ? (totalDelivered / totalEmailsSent) * 100 : 0
      const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0
      const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0

      setStats({
        totalLeads,
        activeLeads,
        totalCampaigns,
        activeCampaigns,
        totalEmailsSent,
        deliveryRate,
        openRate,
        clickRate,
      })

      console.log('✅ Stats loaded:', { totalLeads, totalCampaigns, totalEmailsSent })

    } catch (error) {
      console.error('❌ Error loading stats:', error)
      setError('Erro ao carregar estatísticas')
    }
  }

  // Load recent activity from Supabase
  const loadRecentActivity = async (workspaceId: string) => {
    try {
      console.log('🔄 Loading recent activity from Supabase...')

      // Get recent campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, name, created_at, status')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (campaignsError) throw campaignsError

      // Get recent leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, email, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (leadsError) throw leadsError

      // Combine and format activities
      const activities: RecentActivity[] = []

      campaignsData?.forEach(campaign => {
        activities.push({
          id: `campaign-${campaign.id}`,
          type: 'campaign',
          description: `Campanha "${campaign.name}" foi ${campaign.status === 'sent' ? 'enviada' : 'criada'}`,
          created_at: campaign.created_at
        })
      })

      leadsData?.forEach(lead => {
        activities.push({
          id: `lead-${lead.id}`,
          type: 'lead',
          description: `Novo lead adicionado: ${lead.email}`,
          created_at: lead.created_at
        })
      })

      // Sort by date and take latest 5
      const sortedActivities = activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)

      setRecentActivity(sortedActivities)

      console.log('✅ Recent activity loaded:', sortedActivities.length, 'items')

    } catch (error) {
      console.error('❌ Error loading recent activity:', error)
      setError('Erro ao carregar atividade recente')
    }
  }

  // Load chart data from Supabase
  const loadChartData = async (workspaceId: string) => {
    try {
      console.log('🔄 Loading chart data from Supabase...')

      // Load campaign performance data (last 30 days)
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

      const { data: campaignEvents, error: eventsError } = await supabase
        .from('campaigns')
        .select('sent_at, total_recipients, delivered, opened, clicked')
        .eq('workspace_id', workspaceId)
        .gte('sent_at', thirtyDaysAgo)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: true })

      if (eventsError) throw eventsError

      // Group by date
      const dailyStats: { [key: string]: { sent: number, delivered: number, opened: number, clicked: number } } = {}

      campaignEvents?.forEach(campaign => {
        if (campaign.sent_at) {
          const date = format(new Date(campaign.sent_at), 'yyyy-MM-dd')
          if (!dailyStats[date]) {
            dailyStats[date] = { sent: 0, delivered: 0, opened: 0, clicked: 0 }
          }
          dailyStats[date].sent += campaign.total_recipients || 0
          dailyStats[date].delivered += campaign.delivered || 0
          dailyStats[date].opened += campaign.opened || 0
          dailyStats[date].clicked += campaign.clicked || 0
        }
      })

      // Fill missing dates with zeros
      const campaignChartData = []
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
        campaignChartData.push({
          date,
          sent: dailyStats[date]?.sent || 0,
          delivered: dailyStats[date]?.delivered || 0,
          opened: dailyStats[date]?.opened || 0,
          clicked: dailyStats[date]?.clicked || 0,
        })
      }

      // Load leads source data
      const { data: leadsSourceData, error: leadsError } = await supabase
        .from('leads')
        .select('source')
        .eq('workspace_id', workspaceId)

      if (leadsError) throw leadsError

      const sourceCounts: { [key: string]: number } = {}
      leadsSourceData?.forEach(lead => {
        const source = lead.source || 'Website'
        sourceCounts[source] = (sourceCounts[source] || 0) + 1
      })

      const totalLeadsForSource = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0)
      const leadsSourceChartData = Object.entries(sourceCounts).map(([source, count]) => ({
        source,
        count,
        percentage: totalLeadsForSource > 0 ? (count / totalLeadsForSource) * 100 : 0
      }))

      // Load conversion data
      const { data: conversionData, error: conversionError } = await supabase
        .from('campaigns')
        .select('name, total_recipients, delivered, opened, clicked')
        .eq('workspace_id', workspaceId)
        .gt('total_recipients', 0)
        .order('created_at', { ascending: false })
        .limit(5)

      if (conversionError) throw conversionError

      const conversionChartData = conversionData?.map(campaign => ({
        campaign: campaign.name,
        deliveryRate: campaign.total_recipients > 0 ? (campaign.delivered / campaign.total_recipients) * 100 : 0,
        openRate: campaign.delivered > 0 ? (campaign.opened / campaign.delivered) * 100 : 0,
        clickRate: campaign.opened > 0 ? (campaign.clicked / campaign.opened) * 100 : 0,
        totalSent: campaign.total_recipients
      })) || []

      setChartData({
        campaign: campaignChartData,
        leadsSource: leadsSourceChartData,
        conversion: conversionChartData
      })

      console.log('✅ Chart data loaded successfully')

    } catch (error) {
      console.error('❌ Error loading chart data:', error)
      setError('Erro ao carregar dados dos gráficos')
    }
  }

  // Main data loading function
  const loadData = async () => {
    if (!workspaceId) {
      console.log('⚠️ No workspace ID provided')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      await Promise.all([
        loadStats(workspaceId),
        loadRecentActivity(workspaceId),
        loadChartData(workspaceId)
      ])
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error)
      setError('Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
    }
  }

  // Load data when workspaceId changes
  useEffect(() => {
    loadData()
  }, [workspaceId])

  return {
    stats,
    recentActivity,
    chartData,
    loading,
    error,
    refetch: loadData
  }
}
