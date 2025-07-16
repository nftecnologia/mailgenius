import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys, handleQueryError, invalidateQueries } from '@/lib/react-query'
import { toast } from 'sonner'
import { subDays, format } from 'date-fns'

// Types
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

export interface Campaign {
  id: string
  name: string
  subject: string
  status: string
  send_at: string | null
  sent_at: string | null
  total_recipients: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  unsubscribed: number
  complained: number
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  email: string
  name: string | null
  phone: string | null
  company: string | null
  position: string | null
  source: string | null
  status: string
  tags: string[]
  custom_fields: any
  created_at: string
  updated_at: string
}

// Dashboard Stats Hook
export function useDashboardStats(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(workspaceId || ''),
    queryFn: async (): Promise<DashboardStats> => {
      if (!workspaceId) throw new Error('Workspace ID is required')

      try {
        // Parallel queries for better performance
        const [leadsResult, campaignsResult] = await Promise.all([
          supabase
            .from('leads')
            .select('id, status')
            .eq('workspace_id', workspaceId),
          supabase
            .from('campaigns')
            .select('id, status, total_recipients, delivered, opened, clicked')
            .eq('workspace_id', workspaceId)
        ])

        if (leadsResult.error) throw leadsResult.error
        if (campaignsResult.error) throw campaignsResult.error

        const leadsData = leadsResult.data || []
        const campaignsData = campaignsResult.data || []

        const totalLeads = leadsData.length
        const activeLeads = leadsData.filter(lead => lead.status === 'active').length
        const totalCampaigns = campaignsData.length
        const activeCampaigns = campaignsData.filter(
          campaign => campaign.status === 'active' || campaign.status === 'sending'
        ).length

        const totalEmailsSent = campaignsData.reduce((sum, campaign) => sum + (campaign.total_recipients || 0), 0)
        const totalDelivered = campaignsData.reduce((sum, campaign) => sum + (campaign.delivered || 0), 0)
        const totalOpened = campaignsData.reduce((sum, campaign) => sum + (campaign.opened || 0), 0)
        const totalClicked = campaignsData.reduce((sum, campaign) => sum + (campaign.clicked || 0), 0)

        const deliveryRate = totalEmailsSent > 0 ? (totalDelivered / totalEmailsSent) * 100 : 0
        const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0
        const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0

        return {
          totalLeads,
          activeLeads,
          totalCampaigns,
          activeCampaigns,
          totalEmailsSent,
          deliveryRate,
          openRate,
          clickRate,
        }
      } catch (error) {
        handleQueryError(error, 'useDashboardStats')
        throw error
      }
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes - stats don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  })
}

// Recent Activity Hook
export function useRecentActivity(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.dashboard.recentActivity(workspaceId || ''),
    queryFn: async (): Promise<RecentActivity[]> => {
      if (!workspaceId) throw new Error('Workspace ID is required')

      try {
        const [campaignsResult, leadsResult] = await Promise.all([
          supabase
            .from('campaigns')
            .select('id, name, created_at, status')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(3),
          supabase
            .from('leads')
            .select('id, email, created_at')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(3)
        ])

        if (campaignsResult.error) throw campaignsResult.error
        if (leadsResult.error) throw leadsResult.error

        const activities: RecentActivity[] = []

        campaignsResult.data?.forEach(campaign => {
          activities.push({
            id: `campaign-${campaign.id}`,
            type: 'campaign',
            description: `Campanha "${campaign.name}" foi ${campaign.status === 'sent' ? 'enviada' : 'criada'}`,
            created_at: campaign.created_at
          })
        })

        leadsResult.data?.forEach(lead => {
          activities.push({
            id: `lead-${lead.id}`,
            type: 'lead',
            description: `Novo lead adicionado: ${lead.email}`,
            created_at: lead.created_at
          })
        })

        return activities
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      } catch (error) {
        handleQueryError(error, 'useRecentActivity')
        throw error
      }
    },
    enabled: !!workspaceId,
    staleTime: 1 * 60 * 1000, // 1 minute - recent activity changes frequently
    gcTime: 3 * 60 * 1000, // 3 minutes cache
  })
}

// Chart Data Hook
export function useChartData(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.dashboard.chartData(workspaceId || ''),
    queryFn: async (): Promise<ChartData> => {
      if (!workspaceId) throw new Error('Workspace ID is required')

      try {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

        const [campaignEventsResult, leadsSourceResult, conversionResult] = await Promise.all([
          supabase
            .from('campaigns')
            .select('sent_at, total_recipients, delivered, opened, clicked')
            .eq('workspace_id', workspaceId)
            .gte('sent_at', thirtyDaysAgo)
            .not('sent_at', 'is', null)
            .order('sent_at', { ascending: true }),
          supabase
            .from('leads')
            .select('source')
            .eq('workspace_id', workspaceId),
          supabase
            .from('campaigns')
            .select('name, total_recipients, delivered, opened, clicked')
            .eq('workspace_id', workspaceId)
            .gt('total_recipients', 0)
            .order('created_at', { ascending: false })
            .limit(5)
        ])

        if (campaignEventsResult.error) throw campaignEventsResult.error
        if (leadsSourceResult.error) throw leadsSourceResult.error
        if (conversionResult.error) throw conversionResult.error

        // Process campaign chart data
        const dailyStats: { [key: string]: { sent: number, delivered: number, opened: number, clicked: number } } = {}

        campaignEventsResult.data?.forEach(campaign => {
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

        // Process leads source data
        const sourceCounts: { [key: string]: number } = {}
        leadsSourceResult.data?.forEach(lead => {
          const source = lead.source || 'Website'
          sourceCounts[source] = (sourceCounts[source] || 0) + 1
        })

        const totalLeadsForSource = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0)
        const leadsSourceChartData = Object.entries(sourceCounts).map(([source, count]) => ({
          source,
          count,
          percentage: totalLeadsForSource > 0 ? (count / totalLeadsForSource) * 100 : 0
        }))

        // Process conversion data
        const conversionChartData = conversionResult.data?.map(campaign => ({
          campaign: campaign.name,
          deliveryRate: campaign.total_recipients > 0 ? (campaign.delivered / campaign.total_recipients) * 100 : 0,
          openRate: campaign.delivered > 0 ? (campaign.opened / campaign.delivered) * 100 : 0,
          clickRate: campaign.opened > 0 ? (campaign.clicked / campaign.opened) * 100 : 0,
          totalSent: campaign.total_recipients
        })) || []

        return {
          campaign: campaignChartData,
          leadsSource: leadsSourceChartData,
          conversion: conversionChartData
        }
      } catch (error) {
        handleQueryError(error, 'useChartData')
        throw error
      }
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes - chart data doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  })
}

// Campaigns List Hook
export function useCampaigns(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.campaigns.list(workspaceId || ''),
    queryFn: async (): Promise<Campaign[]> => {
      if (!workspaceId) throw new Error('Workspace ID is required')

      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
      } catch (error) {
        handleQueryError(error, 'useCampaigns')
        throw error
      }
    },
    enabled: !!workspaceId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  })
}

// Leads List Hook
export function useLeads(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.leads.list(workspaceId || ''),
    queryFn: async (): Promise<Lead[]> => {
      if (!workspaceId) throw new Error('Workspace ID is required')

      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
      } catch (error) {
        handleQueryError(error, 'useLeads')
        throw error
      }
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  })
}

// Mutation Hooks
export function useCreateLead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('leads')
        .insert({ ...leadData, workspace_id: workspaceId })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateQueries.leads(workspaceId)
      toast.success('Lead criado com sucesso!')
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um lead com este email')
      } else {
        toast.error('Erro ao criar lead')
      }
    },
  })
}

export function useUpdateLead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...leadData }: Partial<Lead> & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateQueries.leads(workspaceId)
      toast.success('Lead atualizado com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao atualizar lead')
    },
  })
}

export function useDeleteLead(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateQueries.leads(workspaceId)
      toast.success('Lead excluído com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao excluir lead')
    },
  })
}

// Campaign Mutations
export function useUpdateCampaign(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...campaignData }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update(campaignData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateQueries.campaigns(workspaceId)
      toast.success('Campanha atualizada com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao atualizar campanha')
    },
  })
}

export function useDeleteCampaign(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateQueries.campaigns(workspaceId)
      toast.success('Campanha excluída com sucesso!')
    },
    onError: () => {
      toast.error('Erro ao excluir campanha')
    },
  })
}