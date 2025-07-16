'use client'

import { memo, Suspense, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// Optimized hooks
import { useSupabaseAuth } from '@/lib/hooks/useSupabaseAuth'
import { useHydration } from '@/lib/hooks/useHydration'
import { 
  useDashboardStats, 
  useRecentActivity, 
  useChartData,
  type DashboardStats,
  type RecentActivity,
  type ChartData
} from '@/lib/hooks/useOptimizedQueries'

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// Icons (tree-shaken)
import {
  Users,
  Mail,
  TrendingUp,
  TrendingDown,
  MousePointer,
  AlertCircle,
  Plus,
  Send,
  Eye,
  UserCheck,
  Sparkles,
  Zap,
  Database,
  WifiOff,
} from 'lucide-react'

// Date utilities
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Loading components
import { PageLoading, CardLoading } from '@/components/ui/loading'

// Lazy load heavy components with optimized loading states
const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), {
  loading: () => <PageLoading />
})

const CampaignChart = dynamic(() => import('@/components/charts/CampaignChart'), {
  loading: () => <CardLoading className="h-80" />,
  ssr: false
})

const LeadsSourceChart = dynamic(() => import('@/components/charts/LeadsSourceChart'), {
  loading: () => <CardLoading className="h-80" />,
  ssr: false
})

const ConversionChart = dynamic(() => import('@/components/charts/ConversionChart'), {
  loading: () => <CardLoading className="h-80" />,
  ssr: false
})

const AIEmailGenerator = dynamic(() => import('@/components/ai/AIEmailGenerator'), {
  loading: () => <CardLoading className="h-40" />,
  ssr: false
})

interface AIInsight {
  type: 'success' | 'warning' | 'info' | 'suggestion'
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
  icon: any
}

// Memoized components for better performance
const StatCard = memo(({ icon: Icon, title, value, subtitle, color }: {
  icon: any
  title: string
  value: string | number
  subtitle: string
  color: string
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </CardContent>
  </Card>
))

StatCard.displayName = 'StatCard'

const AIInsightCard = memo(({ insight }: { insight: AIInsight }) => {
  const Icon = insight.icon
  
  const getInsightColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-green-200 bg-green-50'
      case 'warning': return 'border-yellow-200 bg-yellow-50'
      case 'info': return 'border-blue-200 bg-blue-50'
      case 'suggestion': return 'border-purple-200 bg-purple-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  const getInsightTextColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-800'
      case 'warning': return 'text-yellow-800'
      case 'info': return 'text-blue-800'
      case 'suggestion': return 'text-purple-800'
      default: return 'text-gray-800'
    }
  }

  return (
    <div className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${getInsightTextColor(insight.type)} bg-white`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className={`font-medium ${getInsightTextColor(insight.type)}`}>
            {insight.title}
          </h4>
          <p className={`text-sm mt-1 ${getInsightTextColor(insight.type)} opacity-80`}>
            {insight.description}
          </p>
          {insight.action && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              asChild
            >
              <Link href={insight.action.href}>
                {insight.action.label}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})

AIInsightCard.displayName = 'AIInsightCard'

const RecentActivityList = memo(({ activities }: { activities: RecentActivity[] }) => (
  <div className="space-y-4">
    {activities.length > 0 ? (
      activities.map((activity) => (
        <div key={activity.id} className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {activity.type === 'campaign' ? (
              <Mail className="h-4 w-4 text-blue-500 mt-1" />
            ) : (
              <UserCheck className="h-4 w-4 text-green-500 mt-1" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">{activity.description}</p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(activity.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </div>
        </div>
      ))
    ) : (
      <div className="text-center py-8">
        <AlertCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500">Nenhuma atividade recente</p>
      </div>
    )}
  </div>
))

RecentActivityList.displayName = 'RecentActivityList'

const QuickActions = memo(() => (
  <Card>
    <CardHeader>
      <CardTitle>Ações Rápidas</CardTitle>
      <CardDescription>
        Comece rapidamente com as ações mais comuns
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button variant="outline" asChild className="h-auto p-4">
          <Link href="/dashboard/leads/import" className="flex flex-col items-center space-y-2">
            <Users className="h-6 w-6" />
            <span>Importar Leads</span>
            <span className="text-xs text-gray-500">Adicionar contatos via CSV</span>
          </Link>
        </Button>

        <Button variant="outline" asChild className="h-auto p-4">
          <Link href="/dashboard/campaigns/new" className="flex flex-col items-center space-y-2">
            <Mail className="h-6 w-6" />
            <span>Nova Campanha</span>
            <span className="text-xs text-gray-500">Criar campanha de email</span>
          </Link>
        </Button>

        <Button variant="outline" asChild className="h-auto p-4">
          <Link href="/dashboard/automations/builder" className="flex flex-col items-center space-y-2">
            <MousePointer className="h-6 w-6" />
            <span>Criar Automação</span>
            <span className="text-xs text-gray-500">Builder visual de fluxos</span>
          </Link>
        </Button>

        <Button variant="outline" asChild className="h-auto p-4">
          <Link href="/dashboard/templates" className="flex flex-col items-center space-y-2">
            <Sparkles className="h-6 w-6" />
            <span>Gerar com IA</span>
            <span className="text-xs text-gray-500">Conteúdo inteligente</span>
          </Link>
        </Button>
      </div>
    </CardContent>
  </Card>
))

QuickActions.displayName = 'QuickActions'

export default function DashboardPage() {
  // Hydration state
  const isHydrated = useHydration()

  // Supabase authentication
  const { user, loading: authLoading, isAuthenticated, workspaceId } = useSupabaseAuth()

  // React Query hooks for data fetching
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats(workspaceId)
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity(workspaceId)
  const { data: chartData, isLoading: chartLoading } = useChartData(workspaceId)

  // Memoized AI insights generation
  const aiInsights = useMemo(() => {
    if (!stats) return []

    const insights: AIInsight[] = []

    if (stats.openRate < 20) {
      insights.push({
        type: 'warning',
        title: 'Taxa de Abertura Baixa',
        description: `Sua taxa de abertura (${stats.openRate.toFixed(1)}%) está abaixo da média do setor (22%). Considere melhorar seus assuntos.`,
        action: {
          label: 'Gerar Assuntos com IA',
          href: '/dashboard/templates'
        },
        icon: TrendingDown
      })
    }

    if (stats.totalLeads > 50 && stats.activeCampaigns < 2) {
      insights.push({
        type: 'suggestion',
        title: 'Automatize seu Marketing',
        description: `Com ${stats.totalLeads} leads, você pode criar automações para nutrir melhor seus contatos.`,
        action: {
          label: 'Criar Automação',
          href: '/dashboard/automations/builder'
        },
        icon: Zap
      })
    }

    if (stats.totalLeads > 100) {
      insights.push({
        type: 'info',
        title: 'Oportunidade de Segmentação',
        description: 'Com sua base de leads, você pode criar segmentos mais específicos para melhorar as conversões.',
        action: {
          label: 'Ver Leads',
          href: '/dashboard/leads'
        },
        icon: Users
      })
    }

    if (stats.openRate > 25) {
      insights.push({
        type: 'success',
        title: 'Excelente Performance!',
        description: `Sua taxa de abertura de ${stats.openRate.toFixed(1)}% está acima da média do mercado. Continue assim!`,
        icon: TrendingUp
      })
    }

    insights.push({
      type: 'suggestion',
      title: 'Conteúdo Inteligente',
      description: 'Use IA para gerar emails mais envolventes e aumentar suas conversões.',
      action: {
        label: 'Gerar Email com IA',
        href: '/dashboard/templates'
      },
      icon: Sparkles
    })

    return insights
  }, [stats])

  // Loading states
  const isLoading = authLoading || statsLoading || activityLoading || chartLoading
  const hasError = statsError

  // Redirect if not authenticated
  if (!isHydrated) {
    return <PageLoading />
  }

  if (!authLoading && !isAuthenticated) {
    window.location.href = '/auth'
    return null
  }

  // Show loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded-lg"></div>
              <div className="h-64 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <Badge variant="outline" className="flex items-center gap-1 text-green-700 border-green-200">
                <Database className="h-3 w-3" />
                Dados Reais
              </Badge>
            </div>
            <p className="text-gray-600">
              Dados em tempo real do workspace: {user?.workspaceName || 'Carregando...'}
            </p>
          </div>
          <div className="flex gap-3">
            <Suspense fallback={<CardLoading className="h-10 w-32" />}>
              <AIEmailGenerator
                onGenerated={() => {
                  window.open('/dashboard/templates', '_blank')
                }}
              />
            </Suspense>
            <Button asChild>
              <Link href="/dashboard/campaigns/new">
                <Plus className="mr-2 h-4 w-4" />
                Nova Campanha
              </Link>
            </Button>
          </div>
        </div>

        {/* Error state */}
        {hasError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">Erro ao carregar dados</p>
                  <p className="text-sm text-red-700">
                    Houve um problema ao carregar os dados do dashboard. Tente recarregar a página.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Insights */}
        {aiInsights.length > 0 && (
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-purple-600" />
                Insights Inteligentes
                <Badge variant="secondary" className="ml-2">Powered by AI</Badge>
              </CardTitle>
              <CardDescription>
                Recomendações personalizadas baseadas no desempenho do seu workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiInsights.map((insight, index) => (
                  <AIInsightCard key={index} insight={insight} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={Users}
              title="Total de Leads"
              value={stats.totalLeads.toLocaleString()}
              subtitle={`${stats.activeLeads} ativos`}
              color="text-muted-foreground"
            />
            <StatCard
              icon={Mail}
              title="Campanhas"
              value={stats.totalCampaigns}
              subtitle={`${stats.activeCampaigns} ativas`}
              color="text-muted-foreground"
            />
            <StatCard
              icon={Send}
              title="Taxa de Entrega"
              value={`${stats.deliveryRate.toFixed(1)}%`}
              subtitle={`${stats.totalEmailsSent.toLocaleString()} emails enviados`}
              color="text-muted-foreground"
            />
            <StatCard
              icon={Eye}
              title="Taxa de Abertura"
              value={`${stats.openRate.toFixed(1)}%`}
              subtitle={`Taxa de cliques: ${stats.clickRate.toFixed(1)}%`}
              color="text-muted-foreground"
            />
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Campaign Performance Chart */}
          <Suspense fallback={<CardLoading className="h-80" />}>
            {chartData && <CampaignChart data={chartData.campaign} />}
          </Suspense>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>
                Últimas ações realizadas no workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity ? (
                <RecentActivityList activities={recentActivity} />
              ) : (
                <CardLoading className="h-32" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Leads Source Distribution */}
          <Suspense fallback={<CardLoading className="h-80" />}>
            {chartData && <LeadsSourceChart data={chartData.leadsSource} />}
          </Suspense>

          {/* Campaign Conversion Rates */}
          <Suspense fallback={<CardLoading className="h-80" />}>
            {chartData && <ConversionChart data={chartData.conversion} />}
          </Suspense>
        </div>

        {/* Quick Actions */}
        <QuickActions />
      </div>
    </DashboardLayout>
  )
}