'use client'

import { useEffect, useState, memo, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// Supabase hooks
import { useSupabaseAuth } from '@/lib/hooks/useSupabaseAuth'
import { useSupabaseData } from '@/lib/hooks/useSupabaseData'
import { useHydration } from '@/lib/hooks/useHydration'

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

// Mock data function for fallback
import { loadMockDashboardData } from '@/lib/utils/mockData'

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

export default function DashboardPage() {
  // Hydration state
  const isHydrated = useHydration()

  // Supabase authentication and data
  const { user, loading: authLoading, isAuthenticated, workspaceId } = useSupabaseAuth()
  const {
    stats,
    recentActivity,
    chartData,
    loading: dataLoading,
    error: dataError,
    refetch
  } = useSupabaseData(workspaceId)

  // State for AI insights and data mode
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [dataMode, setDataMode] = useState<'supabase' | 'mock'>('supabase')
  const [mockData, setMockData] = useState<any>(null)

  // Check authentication and redirect if needed
  useEffect(() => {
    if (!isHydrated) return // Wait for hydration

    if (!authLoading && !isAuthenticated) {
      console.log('❌ Not authenticated, redirecting to auth...')
      window.location.href = '/auth'
      return
    }
  }, [authLoading, isAuthenticated])

  // Load mock data for fallback mode when there's an error
  useEffect(() => {
    if (dataError) {
      console.log('📝 Loading mock data due to error...')
      const mock = loadMockDashboardData()
      setMockData(mock)
      setDataMode('mock')
    }
  }, [dataError])

  // Generate AI insights based on current data
  const loadAIInsights = async () => {
    if (!workspaceId && dataMode === 'supabase') return

    setLoadingInsights(true)

    try {
      const currentStats = dataMode === 'supabase' ? stats : mockData?.stats
      if (!currentStats) return

      const insights: AIInsight[] = []

      if (currentStats.openRate < 20) {
        insights.push({
          type: 'warning',
          title: 'Taxa de Abertura Baixa',
          description: `Sua taxa de abertura (${currentStats.openRate.toFixed(1)}%) está abaixo da média do setor (22%). Considere melhorar seus assuntos.`,
          action: {
            label: 'Gerar Assuntos com IA',
            href: '/dashboard/templates'
          },
          icon: TrendingDown
        })
      }

      if (currentStats.totalLeads > 50 && currentStats.activeCampaigns < 2) {
        insights.push({
          type: 'suggestion',
          title: 'Automatize seu Marketing',
          description: `Com ${currentStats.totalLeads} leads, você pode criar automações para nutrir melhor seus contatos.`,
          action: {
            label: 'Criar Automação',
            href: '/dashboard/automations/builder'
          },
          icon: Zap
        })
      }

      if (currentStats.totalLeads > 100) {
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

      if (currentStats.openRate > 25) {
        insights.push({
          type: 'success',
          title: 'Excelente Performance!',
          description: `Sua taxa de abertura de ${currentStats.openRate.toFixed(1)}% está acima da média do mercado. Continue assim!`,
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

      setAiInsights(insights)
    } catch (error) {
      console.error('Error loading AI insights:', error)
    } finally {
      setLoadingInsights(false)
    }
  }

  // Load AI insights when data is ready
  useEffect(() => {
    if (!dataLoading || mockData) {
      loadAIInsights()
    }
  }, [dataLoading, stats, mockData, workspaceId])

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

  // Get current data based on mode
  const currentStats = dataMode === 'supabase' ? stats : mockData?.stats || stats
  const currentRecentActivity = dataMode === 'supabase' ? recentActivity : mockData?.recentActivity || recentActivity
  const currentChartData = dataMode === 'supabase' ? chartData : mockData?.chartData || chartData

  // Show loading while checking auth or loading data
  if (authLoading || (dataLoading && !mockData)) {
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
        {/* Header with data mode indicator */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              {/* Data mode indicator */}
              <div className="flex items-center gap-2">
                {dataMode === 'supabase' && (
                  <Badge variant="outline" className="flex items-center gap-1 text-green-700 border-green-200">
                    <Database className="h-3 w-3" />
                    Dados Reais
                  </Badge>
                )}
                {dataMode === 'mock' && (
                  <Badge variant="outline" className="flex items-center gap-1 text-orange-700 border-orange-200">
                    <WifiOff className="h-3 w-3" />
                    Dados Mock
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-gray-600">
              {dataMode === 'supabase'
                ? `Dados em tempo real do workspace: ${user?.workspaceName || 'Carregando...'}`
                : 'Dados de demonstração (erro na conexão)'
              }
            </p>
          </div>
          <div className="flex gap-3">
            {dataError && (
              <Button
                variant="outline"
                onClick={() => {
                  setDataMode('supabase')
                  refetch()
                }}
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Reconectar
              </Button>
            )}
            <AIEmailGenerator
              onGenerated={(content) => {
                window.open('/dashboard/templates', '_blank')
              }}
            />
            <Button asChild>
              <Link href="/dashboard/campaigns/new">
                <Plus className="mr-2 h-4 w-4" />
                Nova Campanha
              </Link>
            </Button>
          </div>
        </div>

        {/* Data error warning */}
        {dataError && dataMode === 'mock' && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800">Conexão com banco de dados indisponível</p>
                  <p className="text-sm text-orange-700">Exibindo dados de demonstração. Erro: {dataError}</p>
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
                Recomendações personalizadas baseadas no desempenho {
                  dataMode === 'supabase' ? 'do seu workspace' : 'dos dados de demonstração'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiInsights.map((insight, index) => {
                  const Icon = insight.icon
                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
                    >
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
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentStats.totalLeads.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">{currentStats.activeLeads}</span> ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campanhas</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentStats.totalCampaigns}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-blue-600">{currentStats.activeCampaigns}</span> ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentStats.deliveryRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {currentStats.totalEmailsSent.toLocaleString()} emails enviados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Abertura</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentStats.openRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Taxa de cliques: {currentStats.clickRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Campaign Performance Chart */}
          <CampaignChart data={currentChartData.campaign} />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>
                Últimas ações realizadas {dataMode === 'supabase' ? 'no workspace' : 'na demonstração'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentRecentActivity.length > 0 ? (
                  currentRecentActivity.map((activity: any) => (
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
            </CardContent>
          </Card>
        </div>

        {/* Additional Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Leads Source Distribution */}
          <LeadsSourceChart data={currentChartData.leadsSource} />

          {/* Campaign Conversion Rates */}
          <ConversionChart data={currentChartData.conversion} />
        </div>

        {/* Quick Actions */}
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
      </div>
    </DashboardLayout>
  )
}
