'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Crown,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Mail,
  Clock,
  Play,
  Pause,
  StopCircle,
  ArrowLeft,
  Download,
  Share2,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  Eye,
  MousePointer,
  Percent,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { abTestAnalyzer, ABTestResult, ABTestVariant } from '@/lib/ab-testing'

interface ABTest {
  id: string
  workspace_id: string
  name: string
  description: string
  hypothesis: string
  test_type: 'subject_line' | 'content' | 'send_time' | 'from_name'
  status: 'draft' | 'running' | 'completed' | 'paused'
  variants: ABTestVariant[]
  control_variant_id: string
  winner_variant_id?: string
  confidence_level: number
  minimum_sample_size: number
  test_duration_days: number
  start_date?: string
  end_date?: string
  total_audience_size: number
  statistical_significance?: {
    p_value: number
    confidence_level: number
    is_significant: boolean
    winner_lift: number
  }
  created_at: string
  updated_at: string
}

interface TimeSeriesData {
  date: string
  variant_a_rate: number
  variant_b_rate: number
  variant_a_conversions: number
  variant_b_conversions: number
}

export default function ABTestDetailsPage() {
  const [test, setTest] = useState<ABTest | null>(null)
  const [analysis, setAnalysis] = useState<ABTestResult | null>(null)
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showStopDialog, setShowStopDialog] = useState(false)

  const router = useRouter()
  const params = useParams()
  const testId = params.id as string
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadTestDetails()
  }, [testId])

  const loadTestDetails = async () => {
    try {
      // For demo, load from a combination of localStorage and mock data
      const demoTests: { [key: string]: ABTest } = {
        'demo_1': {
          id: 'demo_1',
          workspace_id: 'demo',
          name: 'Teste de Assunto - Newsletter Semanal',
          description: 'Comparando assuntos diretos vs. curiosos para aumentar taxa de abertura',
          hypothesis: 'Assuntos mais diretos e específicos terão maior taxa de abertura que assuntos curiosos',
          test_type: 'subject_line',
          status: 'completed',
          variants: [
            {
              id: 'control',
              name: 'Controle - Direto',
              type: 'subject_line',
              content: 'Newsletter Semanal - Novidades da Empresa',
              recipients: 1000,
              sent: 1000,
              delivered: 985,
              opened: 245,
              clicked: 47,
              unsubscribed: 2,
              bounced: 15
            },
            {
              id: 'variant_1',
              name: 'Variante - Curioso',
              type: 'subject_line',
              content: 'Você não vai acreditar no que aconteceu esta semana...',
              recipients: 1000,
              sent: 1000,
              delivered: 992,
              opened: 287,
              clicked: 61,
              unsubscribed: 3,
              bounced: 8
            }
          ],
          control_variant_id: 'control',
          winner_variant_id: 'variant_1',
          confidence_level: 95,
          minimum_sample_size: 1000,
          test_duration_days: 7,
          start_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          total_audience_size: 2000,
          statistical_significance: {
            p_value: 0.03,
            confidence_level: 95,
            is_significant: true,
            winner_lift: 17.1
          },
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        },
        'demo_2': {
          id: 'demo_2',
          workspace_id: 'demo',
          name: 'Teste de Horário - Campanhas Promocionais',
          description: 'Comparando horários de envio para maximizar engajamento',
          hypothesis: 'Envios pela manhã (9h) terão melhor performance que à tarde (14h)',
          test_type: 'send_time',
          status: 'running',
          variants: [
            {
              id: 'control',
              name: 'Controle - 9h da manhã',
              type: 'send_time',
              content: '09:00',
              recipients: 800,
              sent: 800,
              delivered: 792,
              opened: 141,
              clicked: 28,
              unsubscribed: 1,
              bounced: 8
            },
            {
              id: 'variant_1',
              name: 'Variante - 14h da tarde',
              type: 'send_time',
              content: '14:00',
              recipients: 800,
              sent: 800,
              delivered: 796,
              opened: 146,
              clicked: 31,
              unsubscribed: 2,
              bounced: 4
            }
          ],
          control_variant_id: 'control',
          confidence_level: 95,
          minimum_sample_size: 800,
          test_duration_days: 14,
          start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          total_audience_size: 1600,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }
      }

      const testData = demoTests[testId]
      if (!testData) {
        toast.error('Teste não encontrado')
        router.push('/dashboard/ab-tests')
        return
      }

      setTest(testData)

      // Generate analysis
      if (testData.variants.length >= 2) {
        const variantA = testData.variants[0]
        const variantB = testData.variants[1]
        const daysSinceStart = testData.start_date
          ? Math.floor((Date.now() - new Date(testData.start_date).getTime()) / (1000 * 60 * 60 * 24))
          : testData.test_duration_days

        const result = abTestAnalyzer.analyzeABTest(variantA, variantB, daysSinceStart)
        setAnalysis(result)
      }

      // Generate time series data for running tests
      if (testData.status === 'running' || testData.status === 'completed') {
        generateTimeSeriesData(testData)
      }

    } catch (error) {
      console.error('Error loading test details:', error)
      toast.error('Erro ao carregar detalhes do teste')
      router.push('/dashboard/ab-tests')
    } finally {
      setLoading(false)
    }
  }

  const generateTimeSeriesData = (testData: ABTest) => {
    if (!testData.start_date) return

    const startDate = new Date(testData.start_date)
    const endDate = testData.end_date ? new Date(testData.end_date) : new Date()
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    const data: TimeSeriesData[] = []

    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)

      // Simulate progressive data collection
      const progress = (i + 1) / (daysDiff + 1)
      const variantA = testData.variants[0]
      const variantB = testData.variants[1]

      const aConversions = Math.floor(variantA.opened * progress)
      const bConversions = Math.floor(variantB.opened * progress)
      const aDelivered = Math.floor(variantA.delivered * progress)
      const bDelivered = Math.floor(variantB.delivered * progress)

      data.push({
        date: format(date, 'dd/MM'),
        variant_a_rate: aDelivered > 0 ? (aConversions / aDelivered) * 100 : 0,
        variant_b_rate: bDelivered > 0 ? (bConversions / bDelivered) * 100 : 0,
        variant_a_conversions: aConversions,
        variant_b_conversions: bConversions
      })
    }

    setTimeSeriesData(data)
  }

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      if (test) {
        const updatedTest = {
          ...test,
          status: newStatus as any,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'completed' && { end_date: new Date().toISOString() })
        }
        setTest(updatedTest)

        const actionMap: { [key: string]: string } = {
          'running': 'iniciado',
          'paused': 'pausado',
          'completed': 'finalizado'
        }

        toast.success(`Teste ${actionMap[newStatus] || 'atualizado'} com sucesso!`)

        // Reload analysis if test completed
        if (newStatus === 'completed' && test.variants.length >= 2) {
          const result = abTestAnalyzer.analyzeABTest(
            test.variants[0],
            test.variants[1],
            test.test_duration_days
          )
          setAnalysis(result)
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Erro ao atualizar status')
    } finally {
      setActionLoading(false)
      setShowStopDialog(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      draft: 'bg-gray-100 text-gray-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getConfidenceColor = (pValue: number) => {
    if (pValue < 0.01) return 'text-green-600'
    if (pValue < 0.05) return 'text-blue-600'
    if (pValue < 0.1) return 'text-yellow-600'
    return 'text-gray-600'
  }

  const formatMetric = (value: number, type: 'percentage' | 'number' | 'currency' = 'percentage') => {
    if (type === 'percentage') return `${value.toFixed(2)}%`
    if (type === 'currency') return `R$ ${value.toFixed(2)}`
    return value.toLocaleString()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded-lg"></div>
              <div className="h-64 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!test) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Teste não encontrado</h1>
          <Button onClick={() => router.push('/dashboard/ab-tests')}>
            Voltar para Testes A/B
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const controlVariant = test.variants.find(v => v.id === test.control_variant_id)
  const testVariant = test.variants.find(v => v.id !== test.control_variant_id)
  const isRunning = test.status === 'running'
  const isCompleted = test.status === 'completed'

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/ab-tests')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{test.name}</h1>
              <p className="text-gray-600 mt-1">{test.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <Badge className={getStatusColor(test.status)}>
                  {test.status === 'draft' && 'Rascunho'}
                  {test.status === 'running' && 'Executando'}
                  {test.status === 'completed' && 'Concluído'}
                  {test.status === 'paused' && 'Pausado'}
                </Badge>
                <span className="text-sm text-gray-500">
                  Criado {formatDistanceToNow(new Date(test.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Compartilhar
            </Button>

            {test.status === 'draft' && (
              <Button onClick={() => handleStatusChange('running')} disabled={actionLoading}>
                <Play className="mr-2 h-4 w-4" />
                Iniciar Teste
              </Button>
            )}

            {test.status === 'running' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange('paused')}
                  disabled={actionLoading}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar
                </Button>
                <Button
                  onClick={() => setShowStopDialog(true)}
                  disabled={actionLoading}
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Finalizar
                </Button>
              </>
            )}

            {test.status === 'paused' && (
              <Button onClick={() => handleStatusChange('running')} disabled={actionLoading}>
                <Play className="mr-2 h-4 w-4" />
                Retomar
              </Button>
            )}
          </div>
        </div>

        {/* Test Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Participantes</p>
                  <p className="text-2xl font-bold">
                    {test.variants.reduce((sum, v) => sum + v.recipients, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {test.variants.length} variantes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Taxa Controle</p>
                  <p className="text-2xl font-bold">
                    {controlVariant ?
                      formatMetric(controlVariant.delivered > 0 ? (controlVariant.opened / controlVariant.delivered) * 100 : 0) :
                      '0%'
                    }
                  </p>
                  <p className="text-xs text-gray-500">Variante de controle</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Zap className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Melhor Taxa</p>
                  <p className="text-2xl font-bold">
                    {testVariant ?
                      formatMetric(testVariant.delivered > 0 ? (testVariant.opened / testVariant.delivered) * 100 : 0) :
                      '0%'
                    }
                  </p>
                  <p className="text-xs text-gray-500">
                    {analysis?.statistical_analysis.winner === 'B' ? 'Variante teste' : 'Controle melhor'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Confiança</p>
                  <p className="text-2xl font-bold">
                    {analysis ?
                      `${((1 - analysis.statistical_analysis.open_rate_significance.p_value) * 100).toFixed(1)}%` :
                      '-%'
                    }
                  </p>
                  <p className="text-xs text-gray-500">
                    {analysis?.statistical_analysis.open_rate_significance.is_significant ? 'Significativo' : 'Não significativo'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Winner Banner */}
        {isCompleted && analysis?.statistical_analysis.winner && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Crown className="h-8 w-8 text-yellow-600" />
                <div>
                  <h3 className="font-bold text-yellow-900">
                    🎉 Temos um vencedor!
                  </h3>
                  <p className="text-yellow-800">
                    A <strong>{analysis.statistical_analysis.winner === 'A' ? controlVariant?.name : testVariant?.name}</strong>
                    {' '}venceu com uma melhoria de <strong>
                      {analysis.statistical_analysis.open_rate_significance.improvement_percentage.toFixed(1)}%
                    </strong> na taxa de abertura.
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {analysis.statistical_analysis.recommendation}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="variants">Variantes</TabsTrigger>
            <TabsTrigger value="statistics">Estatísticas</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Progress Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Progresso do Teste</CardTitle>
                  <CardDescription>
                    Acompanhe o andamento e duração do teste
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Coleta de Dados</span>
                      <span>
                        {test.variants.reduce((sum, v) => sum + v.recipients, 0)} / {test.minimum_sample_size * test.variants.length}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, (test.variants.reduce((sum, v) => sum + v.recipients, 0) / (test.minimum_sample_size * test.variants.length)) * 100)}
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Duração</span>
                      <span>
                        {test.start_date ?
                          Math.floor((Date.now() - new Date(test.start_date).getTime()) / (1000 * 60 * 60 * 24)) : 0
                        } / {test.test_duration_days} dias
                      </span>
                    </div>
                    <Progress
                      value={test.start_date ?
                        Math.min(100, (Math.floor((Date.now() - new Date(test.start_date).getTime()) / (1000 * 60 * 60 * 24)) / test.test_duration_days) * 100) :
                        0
                      }
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {test.variants.reduce((sum, v) => sum + v.delivered, 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">Emails Entregues</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {test.variants.reduce((sum, v) => sum + v.opened, 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">Aberturas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Hypothesis */}
              <Card>
                <CardHeader>
                  <CardTitle>Hipótese do Teste</CardTitle>
                  <CardDescription>
                    O que estamos testando e por quê
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Hipótese</h4>
                    <p className="text-blue-800">{test.hypothesis}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Tipo de Teste</h4>
                      <Badge variant="outline" className="capitalize">
                        {test.test_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Nível de Confiança</h4>
                      <Badge variant="outline">
                        {test.confidence_level}%
                      </Badge>
                    </div>
                  </div>

                  {analysis && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium text-gray-900 mb-2">Resultado</h4>
                      <div className={`p-3 rounded-lg ${
                        analysis.statistical_analysis.open_rate_significance.is_significant
                          ? 'bg-green-50 text-green-800'
                          : 'bg-yellow-50 text-yellow-800'
                      }`}>
                        {analysis.statistical_analysis.recommendation}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            {timeSeriesData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Performance ao Longo do Tempo</CardTitle>
                  <CardDescription>
                    Taxa de conversão das variantes por dia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value: any, name: string) => [
                          `${Number(value).toFixed(2)}%`,
                          name === 'variant_a_rate' ? controlVariant?.name : testVariant?.name
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="variant_a_rate"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="variant_a_rate"
                      />
                      <Line
                        type="monotone"
                        dataKey="variant_b_rate"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="variant_b_rate"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="variants">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {test.variants.map((variant) => {
                const isControl = variant.id === test.control_variant_id
                const openRate = variant.delivered > 0 ? (variant.opened / variant.delivered) * 100 : 0
                const clickRate = variant.opened > 0 ? (variant.clicked / variant.opened) * 100 : 0

                return (
                  <Card key={variant.id} className={isControl ? 'border-blue-200' : 'border-green-200'}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {variant.name}
                          {isControl && <Badge variant="outline">Controle</Badge>}
                          {test.winner_variant_id === variant.id && <Crown className="h-4 w-4 text-yellow-500" />}
                        </CardTitle>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{openRate.toFixed(1)}%</div>
                          <div className="text-sm text-gray-500">Taxa de Abertura</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Content Display */}
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-2">
                          {test.test_type === 'subject_line' && 'Linha de Assunto:'}
                          {test.test_type === 'send_time' && 'Horário de Envio:'}
                          {test.test_type === 'from_name' && 'Nome do Remetente:'}
                          {test.test_type === 'content' && 'Conteúdo:'}
                        </h4>
                        <p className="text-gray-900 font-mono text-sm">
                          {variant.content}
                        </p>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-center mb-1">
                            <Eye className="h-4 w-4 text-blue-600 mr-1" />
                            <span className="text-sm text-blue-600">Aberturas</span>
                          </div>
                          <div className="text-xl font-bold text-blue-900">{variant.opened}</div>
                          <div className="text-xs text-blue-700">{openRate.toFixed(2)}%</div>
                        </div>

                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-center mb-1">
                            <MousePointer className="h-4 w-4 text-green-600 mr-1" />
                            <span className="text-sm text-green-600">Cliques</span>
                          </div>
                          <div className="text-xl font-bold text-green-900">{variant.clicked}</div>
                          <div className="text-xs text-green-700">{clickRate.toFixed(2)}%</div>
                        </div>
                      </div>

                      {/* Detailed Stats */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Enviados:</span>
                          <span className="font-medium">{variant.sent.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Entregues:</span>
                          <span className="font-medium">{variant.delivered.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bounces:</span>
                          <span className="font-medium">{variant.bounced.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Unsubscribes:</span>
                          <span className="font-medium">{variant.unsubscribed.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="statistics">
            {analysis && (
              <div className="space-y-6">
                {/* Statistical Significance */}
                <Card>
                  <CardHeader>
                    <CardTitle>Análise Estatística</CardTitle>
                    <CardDescription>
                      Resultados de significância e confiança do teste
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-3xl font-bold mb-2">
                          {(analysis.statistical_analysis.open_rate_significance.p_value * 100).toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-600">P-Value</div>
                        <div className={`text-xs mt-1 ${getConfidenceColor(analysis.statistical_analysis.open_rate_significance.p_value)}`}>
                          {analysis.statistical_analysis.open_rate_significance.is_significant ? 'Significativo' : 'Não significativo'}
                        </div>
                      </div>

                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-3xl font-bold mb-2">
                          {analysis.statistical_analysis.confidence_level}%
                        </div>
                        <div className="text-sm text-gray-600">Nível de Confiança</div>
                        <div className="text-xs text-gray-500 mt-1">Configurado</div>
                      </div>

                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-3xl font-bold mb-2">
                          {(analysis.statistical_analysis.open_rate_significance.power * 100).toFixed(0)}%
                        </div>
                        <div className="text-sm text-gray-600">Poder Estatístico</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {analysis.statistical_analysis.open_rate_significance.power >= 0.8 ? 'Adequado' : 'Baixo'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-2">Interpretação dos Resultados</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          {analysis.statistical_analysis.open_rate_significance.is_significant ?
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" /> :
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          }
                          <p>
                            <strong>Significância:</strong> {analysis.statistical_analysis.open_rate_significance.is_significant ?
                              'Os resultados são estatisticamente significativos.' :
                              'Os resultados não são estatisticamente significativos.'
                            }
                          </p>
                        </div>

                        <div className="flex items-start gap-2">
                          <Percent className="h-4 w-4 text-blue-600 mt-0.5" />
                          <p>
                            <strong>Melhoria:</strong> A variante {analysis.statistical_analysis.winner || 'teste'}
                            {' '}teve uma melhoria de {Math.abs(analysis.statistical_analysis.open_rate_significance.improvement_percentage).toFixed(1)}%
                            {' '}na taxa de abertura.
                          </p>
                        </div>

                        <div className="flex items-start gap-2">
                          <BarChart3 className="h-4 w-4 text-purple-600 mt-0.5" />
                          <p>
                            <strong>Intervalo de Confiança:</strong> A diferença real está entre {' '}
                            {(analysis.statistical_analysis.open_rate_significance.confidence_interval[0] * 100).toFixed(2)}% e {' '}
                            {(analysis.statistical_analysis.open_rate_significance.confidence_interval[1] * 100).toFixed(2)}%.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comparação de Métricas</CardTitle>
                    <CardDescription>
                      Análise detalhada de cada métrica do teste
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Open Rate */}
                      <div>
                        <h4 className="font-medium mb-3">Taxa de Abertura</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">Controle</span>
                              <span className="font-bold">
                                {(analysis.metrics.open_rate_a * 100).toFixed(2)}%
                              </span>
                            </div>
                            <Progress value={analysis.metrics.open_rate_a * 100} className="h-2" />
                          </div>
                          <div className="p-4 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">Variante</span>
                              <span className="font-bold">
                                {(analysis.metrics.open_rate_b * 100).toFixed(2)}%
                              </span>
                            </div>
                            <Progress value={analysis.metrics.open_rate_b * 100} className="h-2" />
                          </div>
                        </div>
                      </div>

                      {/* Click Rate */}
                      <div>
                        <h4 className="font-medium mb-3">Taxa de Cliques</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">Controle</span>
                              <span className="font-bold">
                                {(analysis.metrics.click_rate_a * 100).toFixed(2)}%
                              </span>
                            </div>
                            <Progress value={analysis.metrics.click_rate_a * 100} className="h-2" />
                          </div>
                          <div className="p-4 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">Variante</span>
                              <span className="font-bold">
                                {(analysis.metrics.click_rate_b * 100).toFixed(2)}%
                              </span>
                            </div>
                            <Progress value={analysis.metrics.click_rate_b * 100} className="h-2" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Timeline do Teste</CardTitle>
                <CardDescription>
                  Cronograma e marcos importantes do teste
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Teste Criado</h4>
                      <p className="text-sm text-gray-600">
                        {format(new Date(test.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Configurações iniciais definidas
                      </p>
                    </div>
                  </div>

                  {test.start_date && (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Play className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Teste Iniciado</h4>
                        <p className="text-sm text-gray-600">
                          {format(new Date(test.start_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Envio das variantes começou
                        </p>
                      </div>
                    </div>
                  )}

                  {test.end_date && (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <StopCircle className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Teste Finalizado</h4>
                        <p className="text-sm text-gray-600">
                          {format(new Date(test.end_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Coleta de dados encerrada
                        </p>
                      </div>
                    </div>
                  )}

                  {analysis?.statistical_analysis.winner && (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Crown className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Vencedor Determinado</h4>
                        <p className="text-sm text-gray-600">
                          Variante {analysis.statistical_analysis.winner} venceu
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Com {Math.abs(analysis.statistical_analysis.open_rate_significance.improvement_percentage).toFixed(1)}% de melhoria
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Stop Test Dialog */}
        <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finalizar Teste A/B</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja finalizar este teste? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600">
                Ao finalizar o teste:
              </p>
              <ul className="mt-2 text-sm text-gray-600 space-y-1">
                <li>• A coleta de dados será interrompida</li>
                <li>• Os resultados finais serão calculados</li>
                <li>• O vencedor será determinado (se aplicável)</li>
                <li>• Você poderá implementar a variante vencedora</li>
              </ul>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStopDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => handleStatusChange('completed')}
                disabled={actionLoading}
              >
                {actionLoading ? 'Finalizando...' : 'Finalizar Teste'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
