import { subDays, format } from 'date-fns'

export function loadMockDashboardData() {
  // Mock stats
  const stats = {
    totalLeads: 1250,
    activeLeads: 1100,
    totalCampaigns: 45,
    activeCampaigns: 8,
    totalEmailsSent: 125000,
    deliveryRate: 98.5,
    openRate: 24.3,
    clickRate: 5.2,
  }

  // Mock recent activity
  const now = new Date()
  const recentActivity = [
    {
      id: '1',
      type: 'campaign',
      description: 'Campanha "Newsletter Jan" foi enviada',
      created_at: subDays(now, 1).toISOString(),
    },
    {
      id: '2',
      type: 'lead',
      description: 'Novo lead adicionado: joao@email.com',
      created_at: subDays(now, 2).toISOString(),
    },
    {
      id: '3',
      type: 'campaign',
      description: 'Campanha "Promo Black Friday" foi criada',
      created_at: subDays(now, 3).toISOString(),
    },
    {
      id: '4',
      type: 'lead',
      description: 'Novo lead adicionado: maria@email.com',
      created_at: subDays(now, 4).toISOString(),
    },
    {
      id: '5',
      type: 'campaign',
      description: 'Campanha "Welcome Series" foi enviada',
      created_at: subDays(now, 5).toISOString(),
    },
  ]

  // Mock campaign chart data
  const campaignChartData = []
  for (let i = 29; i >= 0; i--) {
    const date = subDays(new Date(), i)
    campaignChartData.push({
      date: format(date, 'yyyy-MM-dd'),
      sent: Math.floor(Math.random() * 1000) + 100,
      delivered: Math.floor(Math.random() * 900) + 90,
      opened: Math.floor(Math.random() * 500) + 50,
      clicked: Math.floor(Math.random() * 100) + 10,
    })
  }

  // Mock leads source data
  const leadsSourceData = [
    { source: 'Website', count: 45, percentage: 45 },
    { source: 'CSV Import', count: 30, percentage: 30 },
    { source: 'Manual', count: 15, percentage: 15 },
    { source: 'API', count: 10, percentage: 10 },
  ]

  // Mock conversion data
  const conversionData = [
    { campaign: 'Newsletter Jan', deliveryRate: 98.5, openRate: 24.3, clickRate: 5.2, totalSent: 1250 },
    { campaign: 'Promo Black Friday', deliveryRate: 97.8, openRate: 31.5, clickRate: 8.7, totalSent: 2850 },
    { campaign: 'Welcome Series', deliveryRate: 99.2, openRate: 42.1, clickRate: 12.3, totalSent: 450 },
    { campaign: 'Product Launch', deliveryRate: 96.5, openRate: 28.9, clickRate: 6.8, totalSent: 1890 },
  ]

  return {
    stats,
    recentActivity,
    chartData: {
      campaign: campaignChartData,
      leadsSource: leadsSourceData,
      conversion: conversionData
    }
  }
}
