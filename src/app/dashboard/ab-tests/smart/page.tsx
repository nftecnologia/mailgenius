'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  TrendingUp,
  Zap,
  Bot,
  Target,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles,
  Brain,
  BarChart3,
  Settings,
  Lightbulb,
  Crown,
  Rocket
} from 'lucide-react'
import { toast } from 'sonner'

interface ABTestVariant {
  id: string
  name: string
  type: 'subject' | 'content' | 'sender' | 'time'
  changes: {
    subject?: string
    content?: string
    sender_name?: string
    send_time?: string
    call_to_action?: string
  }
  performance: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    converted: number
    deliveryRate: number
    openRate: number
    clickRate: number
    conversionRate: number
    revenue: number
  }
  aiGenerated: boolean
  confidence: number
}

interface SmartABTest {
  id?: string
  name: string
  description: string
  campaign_id: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'optimizing'
  test_type: 'subject_line' | 'content' | 'send_time' | 'sender_name' | 'multi_variant'
  variants: ABTestVariant[]
  winner?: string
  traffic_split: number
  duration_hours: number
  min_sample_size: number
  confidence_level: number
  auto_optimize: boolean
  ai_insights: AIInsight[]
  created_at: string
  completed_at?: string
}

interface AIInsight {
  type: 'optimization' | 'warning' | 'recommendation' | 'prediction'
  title: string
  description: string
  confidence: number
  action?: {
    label: string
    type: 'auto' | 'manual'
  }
  data?: any
}

interface Campaign {
  id: string
  name: string
  subject: string
  status: string
}

const AI_TEST_TEMPLATES = [
  {
    id: 'subject_optimization',
    name: 'Otimização de Assunto com IA',
    description: 'IA cria 5 variantes de assunto otimizadas para sua audiência',
    icon: Brain,
    color: 'bg-purple-500',
    testType: 'subject_line',
    aiFeatures: ['Análise de palavras-chave', 'Personalização dinâmica', 'Análise de sentimento', 'Otimização de comprimento'],
    estimatedLift: '15-30%'
  },
  {
    id: 'content_ai',
    name: 'Conteúdo Inteligente',
    description: 'IA adapta conteúdo baseado no comportamento do usuário',
    icon: Sparkles,
    color: 'bg-blue-500',
    testType: 'content',
    aiFeatures: ['Personalização por segmento', 'CTA otimizado', 'Estrutura adaptativa', 'Tom de voz dinâmico'],
    estimatedLift: '20-40%'
  },
  {
    id: 'send_time_ai',
    name: 'Timing Perfeito',
    description: 'IA determina o melhor horário para cada usuário',
    icon: Clock,
    color: 'bg-green-500',
    testType: 'send_time',
    aiFeatures: ['Análise de comportamento', 'Fuso horário inteligente', 'Padrões de engajamento', 'Previsão de abertura'],
    estimatedLift: '10-25%'
  },
  {
    id: 'multi_variant_ai',
    name: 'Teste Completo com IA',
    description: 'IA testa múltiplas variáveis simultaneamente',
    icon: Target,
    color: 'bg-orange-500',
    testType: 'multi_variant',
    aiFeatures: ['Teste multivaríavel', 'Otimização contínua', 'Aprendizado automático', 'Previsão de resultados'],
    estimatedLift: '25-50%'
  }
]

const SAMPLE_AI_INSIGHTS: AIInsight[] = [
  {
    type: 'optimization',
    title: 'Variante B está performando 23% melhor',
    description: 'A IA detectou que a variante B com assunto personalizado está convertendo significativamente melhor. Recomendamos aumentar o tráfego para esta variante.',
    confidence: 95,
    action: { label: 'Aplicar Otimização', type: 'auto' }
  },
  {
    type: 'prediction',
    title: 'Previsão: 18% de aumento na conversão',
    description: 'Baseado nos dados atuais, a IA prevê que manter a variante atual resultará em 18% mais conversões até o final do teste.',
    confidence: 87,
  },
  {
    type: 'recommendation',
    title: 'Adicionar variante com emoji',
    description: 'Análise de mercado sugere que emojis no assunto podem aumentar abertura em 12% para seu segmento.',
    confidence: 78,
    action: { label: 'Criar Variante', type: 'manual' }
  }
]

export default function SmartABTestPage() {
  const [tests, setTests] = useState<SmartABTest[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTest, setNewTest] = useState<Partial<SmartABTest>>({
    name: '',
    description: '',
    campaign_id: '',
    test_type: 'subject_line',
    traffic_split: 50,
    duration_hours: 24,
    min_sample_size: 1000,
    confidence_level: 95,
    auto_optimize: true,
    variants: []
  })
  const [isCreating, setIsCreating] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [activeTest, setActiveTest] = useState<SmartABTest | null>(null)

  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    initializeData()
  }, [])

  const initializeData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (member) {
      setWorkspaceId(member.workspace_id)
      await Promise.all([
        loadTests(member.workspace_id),
        loadCampaigns(member.workspace_id)
      ])
    }
  }

  const loadTests = async (workspaceId: string) => {
    // Simulate loading AB tests - in production, load from Supabase
    const mockTests: SmartABTest[] = [
      {
        id: '1',
        name: 'Newsletter Subject AI Test',
        description: 'IA testando 4 variantes de assunto para newsletter mensal',
        campaign_id: 'camp_1',
        status: 'running',
        test_type: 'subject_line',
        variants: [
          {
            id: 'v1',
            name: 'Original',
            type: 'subject',
            changes: { subject: 'Newsletter Mensal - Novidades Importantes' },
            performance: {
              sent: 2500, delivered: 2450, opened: 612, clicked: 73, converted: 12,
              deliveryRate: 98, openRate: 25, clickRate: 12, conversionRate: 2, revenue: 1200
            },
            aiGenerated: false,
            confidence: 85
          },
          {
            id: 'v2',
            name: 'IA Personalizada',
            type: 'subject',
            changes: { subject: '{{name}}, suas novidades exclusivas chegaram! 🎯' },
            performance: {
              sent: 2500, delivered: 2463, opened: 787, clicked: 118, converted: 23,
              deliveryRate: 98.5, openRate: 32, clickRate: 15, conversionRate: 3, revenue: 2300
            },
            aiGenerated: true,
            confidence: 92
          }
        ],
        winner: 'v2',
        traffic_split: 50,
        duration_hours: 24,
        min_sample_size: 1000,
        confidence_level: 95,
        auto_optimize: true,
        ai_insights: SAMPLE_AI_INSIGHTS,
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ]
    setTests(mockTests)
  }

  const loadCampaigns = async (workspaceId: string) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, name, subject, status')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setCampaigns(data)
    }
  }

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template)
    setNewTest(prev => ({
      ...prev,
      test_type: template.testType,
      name: template.name,
      description: template.description
    }))
    setShowCreateDialog(true)
  }

  const generateAIVariants = async () => {
    if (!selectedTemplate) return []

    // Simulate AI variant generation
    const variants: ABTestVariant[] = []

    switch (selectedTemplate.testType) {
      case 'subject_line':
        const subjectVariants = [
          'Original: Newsletter Mensal',
          'Personalizado: {{name}}, novidades para você!',
          'Urgência: Últimas horas para ver isto',
          'Benefício: 5 dicas que vão mudar seu resultado',
          'Curiosidade: O que 90% das pessoas não sabem'
        ]

        subjectVariants.forEach((subject, index) => {
          variants.push({
            id: `ai_variant_${index}`,
            name: `IA Variante ${index + 1}`,
            type: 'subject',
            changes: { subject },
            performance: {
              sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0,
              deliveryRate: 0, openRate: 0, clickRate: 0, conversionRate: 0, revenue: 0
            },
            aiGenerated: true,
            confidence: 85 + Math.random() * 10
          })
        })
        break

      case 'content':
        variants.push(
          {
            id: 'content_original',
            name: 'Original',
            type: 'content',
            changes: { content: 'Conteúdo original' },
            performance: {
              sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0,
              deliveryRate: 0, openRate: 0, clickRate: 0, conversionRate: 0, revenue: 0
            },
            aiGenerated: false,
            confidence: 80
          },
          {
            id: 'content_ai_personalized',
            name: 'IA Personalizado',
            type: 'content',
            changes: {
              content: 'Conteúdo adaptado com base no comportamento do usuário',
              call_to_action: 'Descubra agora - Personalizado para você'
            },
            performance: {
              sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0,
              deliveryRate: 0, openRate: 0, clickRate: 0, conversionRate: 0, revenue: 0
            },
            aiGenerated: true,
            confidence: 88
          }
        )
        break

      case 'send_time':
        const timeVariants = ['09:00', '12:00', '15:00', '18:00', '20:00']
        timeVariants.forEach((time, index) => {
          variants.push({
            id: `time_variant_${index}`,
            name: `Envio às ${time}`,
            type: 'time',
            changes: { send_time: time },
            performance: {
              sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0,
              deliveryRate: 0, openRate: 0, clickRate: 0, conversionRate: 0, revenue: 0
            },
            aiGenerated: true,
            confidence: 82 + Math.random() * 8
          })
        })
        break
    }

    return variants
  }

  const createSmartTest = async () => {
    if (!workspaceId || !newTest.campaign_id) {
      toast.error('Selecione uma campanha')
      return
    }

    setIsCreating(true)

    try {
      // Generate AI variants
      const aiVariants = await generateAIVariants()

      const testData = {
        ...newTest,
        variants: aiVariants,
        status: 'draft',
        ai_insights: [],
        created_at: new Date().toISOString()
      }

      // In production, save to Supabase
      // For now, add to local state
      setTests(prev => [...prev, { ...testData, id: Date.now().toString() } as SmartABTest])

      toast.success('Teste A/B inteligente criado com sucesso!')
      setShowCreateDialog(false)
      setNewTest({
        name: '',
        description: '',
        campaign_id: '',
        test_type: 'subject_line',
        traffic_split: 50,
        duration_hours: 24,
        min_sample_size: 1000,
        confidence_level: 95,
        auto_optimize: true,
        variants: []
      })
      setSelectedTemplate(null)

    } catch (error) {
      console.error('Error creating test:', error)
      toast.error('Erro ao criar teste')
    } finally {
      setIsCreating(false)
    }
  }

  const startTest = async (testId: string) => {
    setTests(prev => prev.map(test =>
      test.id === testId
        ? { ...test, status: 'running' }
        : test
    ))
    toast.success('Teste iniciado! IA está monitorando performance.')
  }

  const pauseTest = async (testId: string) => {
    setTests(prev => prev.map(test =>
      test.id === testId
        ? { ...test, status: 'paused' }
        : test
    ))
    toast.success('Teste pausado')
  }

  const applyOptimization = async (testId: string, insightIndex: number) => {
    const test = tests.find(t => t.id === testId)
    if (!test) return

    // Simulate applying AI optimization
    toast.success('Otimização aplicada! Tráfego redirecionado para variante vencedora.')

    // Update test status
    setTests(prev => prev.map(t =>
      t.id === testId
        ? {
            ...t,
            status: 'optimizing',
            ai_insights: t.ai_insights.map((insight, i) =>
              i === insightIndex
                ? { ...insight, action: undefined }
                : insight
            )
          }
        : t
    ))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'optimizing': return 'bg-blue-500'
      case 'completed': return 'bg-purple-500'
      case 'paused': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return Play
      case 'optimizing': return Bot
      case 'completed': return CheckCircle
      case 'paused': return Pause
      default: return Clock
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'optimization': return TrendingUp
      case 'prediction': return Brain
      case 'recommendation': return Lightbulb
      case 'warning': return AlertTriangle
      default: return Sparkles
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'optimization': return 'text-green-700 bg-green-50 border-green-200'
      case 'prediction': return 'text-blue-700 bg-blue-50 border-blue-200'
      case 'recommendation': return 'text-purple-700 bg-purple-50 border-purple-200'
      case 'warning': return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      default: return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">A/B Testing Inteligente</h1>
              <p className="text-gray-600">IA otimiza seus testes automaticamente para máxima performance</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-gradient-to-r from-purple-500 to-pink-500">
            <Sparkles className="mr-2 h-4 w-4" />
            Criar Teste com IA
          </Button>
        </div>

        {/* AI Templates */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Templates de IA</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {AI_TEST_TEMPLATES.map(template => {
              const Icon = template.icon
              return (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-200"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${template.color} flex items-center justify-center text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs mt-1">
                          IA Automática
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Lift Estimado:</span>
                        <span className="font-medium text-green-600">{template.estimatedLift}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {template.aiFeatures.slice(0, 2).map((feature, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {template.aiFeatures.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.aiFeatures.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Active Tests */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Testes Ativos</h2>
          {tests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Bot className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum teste ativo
                </h3>
                <p className="text-gray-500 mb-6">
                  Crie seu primeiro teste A/B inteligente para começar a otimizar suas campanhas
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  Criar Primeiro Teste
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {tests.map(test => {
                const StatusIcon = getStatusIcon(test.status)
                const winningVariant = test.variants.find(v => v.id === test.winner)

                return (
                  <Card key={test.id} className="overflow-hidden">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(test.status)}`} />
                          <div>
                            <CardTitle className="text-lg">{test.name}</CardTitle>
                            <CardDescription>{test.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {test.status === 'running' ? 'Rodando' :
                             test.status === 'optimizing' ? 'Otimizando' :
                             test.status === 'completed' ? 'Completo' :
                             test.status === 'paused' ? 'Pausado' : 'Rascunho'}
                          </Badge>
                          {test.auto_optimize && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Bot className="h-3 w-3" />
                              Auto-IA
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="performance" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="performance">Performance</TabsTrigger>
                          <TabsTrigger value="insights">Insights IA</TabsTrigger>
                          <TabsTrigger value="actions">Ações</TabsTrigger>
                        </TabsList>

                        <TabsContent value="performance" className="space-y-4">
                          {/* Variants Performance */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {test.variants.map(variant => (
                              <Card key={variant.id} className={`${variant.id === test.winner ? 'border-green-200 bg-green-50' : ''}`}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">{variant.name}</CardTitle>
                                    <div className="flex items-center gap-2">
                                      {variant.aiGenerated && (
                                        <Badge variant="secondary" className="text-xs">
                                          <Bot className="h-3 w-3 mr-1" />
                                          IA
                                        </Badge>
                                      )}
                                      {variant.id === test.winner && (
                                        <Badge className="text-xs bg-green-500">
                                          <Crown className="h-3 w-3 mr-1" />
                                          Vencedor
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span>Taxa de Abertura:</span>
                                      <span className="font-medium">{variant.performance.openRate}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Taxa de Clique:</span>
                                      <span className="font-medium">{variant.performance.clickRate}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Conversão:</span>
                                      <span className="font-medium">{variant.performance.conversionRate}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Confiança IA:</span>
                                      <span className="font-medium">{variant.confidence}%</span>
                                    </div>
                                  </div>
                                  <Progress value={variant.confidence} className="mt-3" />
                                </CardContent>
                              </Card>
                            ))}
                          </div>

                          {/* Performance Chart */}
                          {test.variants.length > 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-sm">Comparação de Performance</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                  <BarChart data={test.variants}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="performance.openRate" fill="#3b82f6" name="Taxa Abertura %" />
                                    <Bar dataKey="performance.clickRate" fill="#10b981" name="Taxa Clique %" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          )}
                        </TabsContent>

                        <TabsContent value="insights" className="space-y-4">
                          {test.ai_insights.length > 0 ? (
                            test.ai_insights.map((insight, index) => {
                              const InsightIcon = getInsightIcon(insight.type)
                              return (
                                <Card key={index} className={`border ${getInsightColor(insight.type)}`}>
                                  <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                      <div className="mt-1">
                                        <InsightIcon className="h-5 w-5" />
                                      </div>
                                      <div className="flex-1">
                                        <h4 className="font-medium mb-1">{insight.title}</h4>
                                        <p className="text-sm mb-2">{insight.description}</p>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                              {insight.confidence}% confiança
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                              {insight.type === 'optimization' ? 'Otimização' :
                                               insight.type === 'prediction' ? 'Previsão' :
                                               insight.type === 'recommendation' ? 'Recomendação' : 'Aviso'}
                                            </Badge>
                                          </div>
                                          {insight.action && (
                                            <Button
                                              size="sm"
                                              onClick={() => applyOptimization(test.id!, index)}
                                            >
                                              {insight.action.label}
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )
                            })
                          ) : (
                            <Card>
                              <CardContent className="text-center py-8">
                                <Brain className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-500">IA ainda coletando dados para gerar insights...</p>
                              </CardContent>
                            </Card>
                          )}
                        </TabsContent>

                        <TabsContent value="actions" className="space-y-4">
                          <div className="flex gap-3">
                            {test.status === 'draft' && (
                              <Button onClick={() => startTest(test.id!)}>
                                <Play className="mr-2 h-4 w-4" />
                                Iniciar Teste
                              </Button>
                            )}
                            {test.status === 'running' && (
                              <Button variant="outline" onClick={() => pauseTest(test.id!)}>
                                <Pause className="mr-2 h-4 w-4" />
                                Pausar Teste
                              </Button>
                            )}
                            {test.status === 'paused' && (
                              <Button onClick={() => startTest(test.id!)}>
                                <Play className="mr-2 h-4 w-4" />
                                Retomar Teste
                              </Button>
                            )}
                            <Button variant="outline">
                              <Settings className="mr-2 h-4 w-4" />
                              Configurações
                            </Button>
                            <Button variant="outline">
                              <BarChart3 className="mr-2 h-4 w-4" />
                              Relatório Completo
                            </Button>
                          </div>

                          {test.auto_optimize && (
                            <Card className="border-blue-200 bg-blue-50">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <Bot className="h-5 w-5 text-blue-600" />
                                  <div>
                                    <h4 className="font-medium text-blue-900">Otimização Automática Ativa</h4>
                                    <p className="text-sm text-blue-700">
                                      IA está monitorando este teste e aplicará otimizações automaticamente
                                      quando detectar oportunidades de melhoria.
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Create Test Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Teste A/B Inteligente</DialogTitle>
              <DialogDescription>
                Configure seu teste e deixe a IA criar variantes otimizadas automaticamente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {selectedTemplate && (
                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${selectedTemplate.color} flex items-center justify-center text-white`}>
                        <selectedTemplate.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-purple-900">{selectedTemplate.name}</h4>
                        <p className="text-sm text-purple-700">{selectedTemplate.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="test-name">Nome do Teste</Label>
                  <Input
                    id="test-name"
                    value={newTest.name || ''}
                    onChange={(e) => setNewTest(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Teste de Assunto Newsletter"
                  />
                </div>
                <div>
                  <Label htmlFor="campaign">Campanha</Label>
                  <Select
                    value={newTest.campaign_id}
                    onValueChange={(value) => setNewTest(prev => ({ ...prev, campaign_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map(campaign => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={newTest.description || ''}
                  onChange={(e) => setNewTest(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o objetivo deste teste..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="traffic-split">Divisão de Tráfego (%)</Label>
                  <Input
                    id="traffic-split"
                    type="number"
                    value={newTest.traffic_split}
                    onChange={(e) => setNewTest(prev => ({ ...prev, traffic_split: parseInt(e.target.value) }))}
                    min="10"
                    max="90"
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duração (horas)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={newTest.duration_hours}
                    onChange={(e) => setNewTest(prev => ({ ...prev, duration_hours: parseInt(e.target.value) }))}
                    min="1"
                    max="168"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-optimize"
                  checked={newTest.auto_optimize}
                  onChange={(e) => setNewTest(prev => ({ ...prev, auto_optimize: e.target.checked }))}
                />
                <Label htmlFor="auto-optimize" className="text-sm">
                  Otimização automática com IA (Recomendado)
                </Label>
              </div>

              {selectedTemplate && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-green-900 mb-2">IA irá criar automaticamente:</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      {selectedTemplate.aiFeatures.map((feature: string, index: number) => (
                        <li key={index} className="flex items-center gap-2">
                          <Rocket className="h-3 w-3" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        Lift estimado: {selectedTemplate.estimatedLift}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={createSmartTest} disabled={isCreating}>
                {isCreating ? 'Criando...' : 'Criar Teste Inteligente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
