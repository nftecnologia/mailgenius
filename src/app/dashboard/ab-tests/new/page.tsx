'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  AlertCircle,
  Beaker,
  Users,
  Mail,
  Calendar,
  TrendingUp,
  ArrowRight,
  Clock,
  Target,
  Lightbulb,
  ChevronRight,
  Save,
  Play,
} from 'lucide-react'
import { toast } from 'sonner'
import { ABTestUtils, abTestAnalyzer } from '@/lib/ab-testing'

interface ABTestConfig {
  name: string
  description: string
  hypothesis: string
  test_type: 'subject_line' | 'content' | 'send_time' | 'from_name'
  variant_a: {
    name: string
    content: string
  }
  variant_b: {
    name: string
    content: string
  }
  audience_size: number
  split_ratio: number
  confidence_level: number
  test_duration_days: number
  send_immediately: boolean
  send_time?: string
  segment_id?: string
  template_id?: string
}

export default function NewABTestPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [availableLeads, setAvailableLeads] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [segments, setSegments] = useState<any[]>([])

  const [testConfig, setTestConfig] = useState<ABTestConfig>({
    name: '',
    description: '',
    hypothesis: '',
    test_type: 'subject_line',
    variant_a: {
      name: 'Versão A (Controle)',
      content: ''
    },
    variant_b: {
      name: 'Versão B (Variante)',
      content: ''
    },
    audience_size: 0,
    split_ratio: 50,
    confidence_level: 95,
    test_duration_days: 7,
    send_immediately: false
  })

  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    initializeData()
  }, [])

  const initializeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!member) return

      setWorkspaceId(member.workspace_id)

      // Load data in parallel
      await Promise.all([
        loadLeads(member.workspace_id),
        loadTemplates(member.workspace_id),
        loadSegments(member.workspace_id)
      ])

    } catch (error) {
      console.error('Error initializing data:', error)
      toast.error('Erro ao carregar dados iniciais')
    }
  }

  const loadLeads = async (workspaceId: string) => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')

    if (data) {
      setAvailableLeads(data)
      setTestConfig(prev => ({ ...prev, audience_size: data.length }))
    }
  }

  const loadTemplates = async (workspaceId: string) => {
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    setTemplates(data || [])
  }

  const loadSegments = async (workspaceId: string) => {
    // Mock segments for now
    setSegments([
      { id: 'all', name: 'Todos os leads', count: availableLeads.length },
      { id: 'new', name: 'Leads novos (últimos 30 dias)', count: Math.floor(availableLeads.length * 0.3) },
      { id: 'engaged', name: 'Leads engajados', count: Math.floor(availableLeads.length * 0.6) }
    ])
  }

  const calculateSampleSize = () => {
    const baselineRate = 0.22 // 22% open rate baseline
    const minimumEffect = 0.02 // 2% improvement
    return abTestAnalyzer.calculateMinimumSampleSize(baselineRate, minimumEffect)
  }

  const getTestSuggestions = () => {
    return ABTestUtils.getTestSuggestions('campaign')
  }

  const handleTestTypeChange = (type: 'subject_line' | 'content' | 'send_time' | 'from_name') => {
    setTestConfig(prev => ({
      ...prev,
      test_type: type,
      hypothesis: getDefaultHypothesis(type),
      variant_a: { ...prev.variant_a, content: getDefaultContent(type, 'A') },
      variant_b: { ...prev.variant_b, content: getDefaultContent(type, 'B') }
    }))
  }

  const getDefaultHypothesis = (type: string) => {
    switch (type) {
      case 'subject_line':
        return 'Um assunto mais direto aumentará a taxa de abertura em pelo menos 10%'
      case 'content':
        return 'Um conteúdo mais focado no CTA aumentará a taxa de cliques'
      case 'send_time':
        return 'Enviar em um horário diferente melhorará o engajamento'
      case 'from_name':
        return 'Um nome de remetente mais pessoal aumentará a confiança'
      default:
        return ''
    }
  }

  const getDefaultContent = (type: string, variant: 'A' | 'B') => {
    switch (type) {
      case 'subject_line':
        return variant === 'A' ? 'Newsletter Mensal - Novidades' : 'Você não pode perder estas novidades!'
      case 'content':
        return variant === 'A' ? 'Conteúdo padrão...' : 'Conteúdo alternativo...'
      case 'send_time':
        return variant === 'A' ? '09:00' : '14:00'
      case 'from_name':
        return variant === 'A' ? 'Equipe EmailSend' : 'João Silva'
      default:
        return ''
    }
  }

  const handleCreateTest = async () => {
    if (!workspaceId) return

    if (!testConfig.name || !testConfig.variant_a.content || !testConfig.variant_b.content) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)

    try {
      // Create A/B test record
      const testData = {
        workspace_id: workspaceId,
        name: testConfig.name,
        description: testConfig.description,
        hypothesis: testConfig.hypothesis,
        test_type: testConfig.test_type,
        status: 'draft',
        variants: [
          {
            name: testConfig.variant_a.name,
            content: testConfig.variant_a.content,
            traffic_allocation: testConfig.split_ratio
          },
          {
            name: testConfig.variant_b.name,
            content: testConfig.variant_b.content,
            traffic_allocation: 100 - testConfig.split_ratio
          }
        ],
        confidence_level: testConfig.confidence_level,
        test_duration_days: testConfig.test_duration_days,
        audience_size: testConfig.audience_size,
        send_immediately: testConfig.send_immediately,
        send_time: testConfig.send_time,
        segment_id: testConfig.segment_id,
        template_id: testConfig.template_id
      }

      // For demo, we'll create a mock test
      const testId = `ab_test_${Date.now()}`

      toast.success('Teste A/B criado com sucesso!')

      if (testConfig.send_immediately) {
        toast.info('Iniciando teste A/B automaticamente...')
        router.push(`/dashboard/ab-tests/${testId}`)
      } else {
        router.push('/dashboard/ab-tests')
      }

    } catch (error) {
      console.error('Error creating A/B test:', error)
      toast.error('Erro ao criar teste A/B')
    } finally {
      setLoading(false)
    }
  }

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1: return <Target className="h-4 w-4" />
      case 2: return <Beaker className="h-4 w-4" />
      case 3: return <Users className="h-4 w-4" />
      case 4: return <Clock className="h-4 w-4" />
      default: return <div className="h-4 w-4" />
    }
  }

  const minSampleSize = calculateSampleSize()
  const estimatedDuration = Math.ceil(minSampleSize / (availableLeads.length * 0.1)) // Assuming 10% daily reach

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Criar Teste A/B</h1>
            <p className="text-gray-600">Configure seu experimento para otimizar campanhas</p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStep >= step
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {getStepIcon(step)}
                  </div>
                  {step < 4 && (
                    <div className={`w-16 h-1 mx-2 ${
                      currentStep > step ? 'bg-blue-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Configuração</span>
              <span>Variantes</span>
              <span>Audiência</span>
              <span>Revisão</span>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="mr-2 h-5 w-5 text-blue-500" />
                Configuração do Teste
              </CardTitle>
              <CardDescription>
                Defina o objetivo e tipo do seu teste A/B
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="test-name">Nome do Teste *</Label>
                    <Input
                      id="test-name"
                      value={testConfig.name}
                      onChange={(e) => setTestConfig(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Teste de Assunto - Newsletter"
                    />
                  </div>

                  <div>
                    <Label htmlFor="test-description">Descrição</Label>
                    <Textarea
                      id="test-description"
                      value={testConfig.description}
                      onChange={(e) => setTestConfig(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descreva o objetivo deste teste..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div>
                    <Label htmlFor="hypothesis">Hipótese *</Label>
                    <Textarea
                      id="hypothesis"
                      value={testConfig.hypothesis}
                      onChange={(e) => setTestConfig(prev => ({ ...prev, hypothesis: e.target.value }))}
                      placeholder="Ex: Um assunto mais direto aumentará a taxa de abertura"
                      className="min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Tipo de Teste</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {getTestSuggestions().map((suggestion) => (
                        <Button
                          key={suggestion.type}
                          variant={testConfig.test_type === suggestion.type ? 'default' : 'outline'}
                          className="h-auto p-4 flex flex-col items-start"
                          onClick={() => handleTestTypeChange(suggestion.type)}
                        >
                          <div className="font-medium text-left">{suggestion.title}</div>
                          <div className="text-xs text-gray-500 mt-1 text-left">
                            {suggestion.description}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Sugestões para {testConfig.test_type}</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      {getTestSuggestions()
                        .find(s => s.type === testConfig.test_type)
                        ?.examples.map((example, index) => (
                          <li key={index}>• {example}</li>
                        ))
                      }
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Beaker className="mr-2 h-5 w-5 text-green-500" />
                Configurar Variantes
              </CardTitle>
              <CardDescription>
                Defina as duas versões que serão testadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Variant A */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Versão A (Controle)</Badge>
                    <span className="text-sm text-gray-500">{testConfig.split_ratio}% do tráfego</span>
                  </div>

                  <div>
                    <Label>Nome da Variante</Label>
                    <Input
                      value={testConfig.variant_a.name}
                      onChange={(e) => setTestConfig(prev => ({
                        ...prev,
                        variant_a: { ...prev.variant_a, name: e.target.value }
                      }))}
                    />
                  </div>

                  <div>
                    <Label>
                      {testConfig.test_type === 'subject_line' && 'Linha de Assunto'}
                      {testConfig.test_type === 'content' && 'Conteúdo do Email'}
                      {testConfig.test_type === 'send_time' && 'Horário de Envio'}
                      {testConfig.test_type === 'from_name' && 'Nome do Remetente'}
                    </Label>
                    {testConfig.test_type === 'content' ? (
                      <Textarea
                        value={testConfig.variant_a.content}
                        onChange={(e) => setTestConfig(prev => ({
                          ...prev,
                          variant_a: { ...prev.variant_a, content: e.target.value }
                        }))}
                        className="min-h-[120px]"
                        placeholder="Conteúdo da versão A..."
                      />
                    ) : (
                      <Input
                        value={testConfig.variant_a.content}
                        onChange={(e) => setTestConfig(prev => ({
                          ...prev,
                          variant_a: { ...prev.variant_a, content: e.target.value }
                        }))}
                        placeholder={
                          testConfig.test_type === 'subject_line' ? 'Assunto da versão A' :
                          testConfig.test_type === 'send_time' ? '09:00' :
                          'Nome do remetente A'
                        }
                      />
                    )}
                  </div>
                </div>

                {/* Variant B */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Versão B (Variante)</Badge>
                    <span className="text-sm text-gray-500">{100 - testConfig.split_ratio}% do tráfego</span>
                  </div>

                  <div>
                    <Label>Nome da Variante</Label>
                    <Input
                      value={testConfig.variant_b.name}
                      onChange={(e) => setTestConfig(prev => ({
                        ...prev,
                        variant_b: { ...prev.variant_b, name: e.target.value }
                      }))}
                    />
                  </div>

                  <div>
                    <Label>
                      {testConfig.test_type === 'subject_line' && 'Linha de Assunto'}
                      {testConfig.test_type === 'content' && 'Conteúdo do Email'}
                      {testConfig.test_type === 'send_time' && 'Horário de Envio'}
                      {testConfig.test_type === 'from_name' && 'Nome do Remetente'}
                    </Label>
                    {testConfig.test_type === 'content' ? (
                      <Textarea
                        value={testConfig.variant_b.content}
                        onChange={(e) => setTestConfig(prev => ({
                          ...prev,
                          variant_b: { ...prev.variant_b, content: e.target.value }
                        }))}
                        className="min-h-[120px]"
                        placeholder="Conteúdo da versão B..."
                      />
                    ) : (
                      <Input
                        value={testConfig.variant_b.content}
                        onChange={(e) => setTestConfig(prev => ({
                          ...prev,
                          variant_b: { ...prev.variant_b, content: e.target.value }
                        }))}
                        placeholder={
                          testConfig.test_type === 'subject_line' ? 'Assunto da versão B' :
                          testConfig.test_type === 'send_time' ? '14:00' :
                          'Nome do remetente B'
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Divisão de Tráfego: {testConfig.split_ratio}% / {100 - testConfig.split_ratio}%</Label>
                <div className="space-y-2">
                  <Progress value={testConfig.split_ratio} className="h-2" />
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={testConfig.split_ratio}
                    onChange={(e) => setTestConfig(prev => ({ ...prev, split_ratio: Number(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>10% / 90%</span>
                    <span>50% / 50%</span>
                    <span>90% / 10%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-purple-500" />
                Configurar Audiência
              </CardTitle>
              <CardDescription>
                Selecione o público e configure os parâmetros estatísticos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Segmento de Audiência</Label>
                    <Select
                      value={testConfig.segment_id || 'all'}
                      onValueChange={(value) => setTestConfig(prev => ({ ...prev, segment_id: value === 'all' ? undefined : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {segments.map(segment => (
                          <SelectItem key={segment.id} value={segment.id}>
                            {segment.name} ({segment.count} leads)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📊 Tamanho da Audiência</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Leads disponíveis:</span>
                        <span className="font-medium">{availableLeads.length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tamanho mínimo recomendado:</span>
                        <span className="font-medium text-blue-600">{minSampleSize.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={availableLeads.length >= minSampleSize ? 'default' : 'destructive'}>
                          {availableLeads.length >= minSampleSize ? 'Adequado' : 'Insuficiente'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Nível de Confiança</Label>
                    <Select
                      value={testConfig.confidence_level.toString()}
                      onValueChange={(value) => setTestConfig(prev => ({ ...prev, confidence_level: Number(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90">90% (Menos rigoroso)</SelectItem>
                        <SelectItem value="95">95% (Recomendado)</SelectItem>
                        <SelectItem value="99">99% (Mais rigoroso)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Duração do Teste (dias)</Label>
                    <Select
                      value={testConfig.test_duration_days.toString()}
                      onValueChange={(value) => setTestConfig(prev => ({ ...prev, test_duration_days: Number(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 dias (Mínimo)</SelectItem>
                        <SelectItem value="7">7 dias (Recomendado)</SelectItem>
                        <SelectItem value="14">14 dias (Conservador)</SelectItem>
                        <SelectItem value="30">30 dias (Máximo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">⚠️ Estimativas</h4>
                    <div className="space-y-1 text-sm text-yellow-700">
                      <div>Duração estimada: ~{estimatedDuration} dias</div>
                      <div>Poder estatístico: 80%</div>
                      <div>Efeito mínimo detectável: 2%</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5 text-orange-500" />
                Revisão e Execução
              </CardTitle>
              <CardDescription>
                Revise as configurações e inicie o teste
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3">📋 Resumo do Teste</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Nome:</strong> {testConfig.name}</div>
                      <div><strong>Tipo:</strong> {testConfig.test_type}</div>
                      <div><strong>Audiência:</strong> {availableLeads.length} leads</div>
                      <div><strong>Divisão:</strong> {testConfig.split_ratio}% / {100 - testConfig.split_ratio}%</div>
                      <div><strong>Duração:</strong> {testConfig.test_duration_days} dias</div>
                      <div><strong>Confiança:</strong> {testConfig.confidence_level}%</div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-3">🎯 Hipótese</h4>
                    <p className="text-sm text-blue-800">{testConfig.hypothesis}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-3">📊 Variantes</h4>
                    <div className="space-y-3 text-sm">
                      <div className="p-2 bg-white rounded border">
                        <div className="font-medium">{testConfig.variant_a.name}</div>
                        <div className="text-gray-600 mt-1">{testConfig.variant_a.content}</div>
                      </div>
                      <div className="p-2 bg-white rounded border">
                        <div className="font-medium">{testConfig.variant_b.name}</div>
                        <div className="text-gray-600 mt-1">{testConfig.variant_b.content}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="send-immediately"
                        checked={testConfig.send_immediately}
                        onChange={(e) => setTestConfig(prev => ({ ...prev, send_immediately: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="send-immediately">Iniciar teste imediatamente</Label>
                    </div>

                    {!testConfig.send_immediately && (
                      <div>
                        <Label>Horário de início</Label>
                        <Input
                          type="datetime-local"
                          value={testConfig.send_time}
                          onChange={(e) => setTestConfig(prev => ({ ...prev, send_time: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            Anterior
          </Button>

          <div className="flex gap-3">
            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={
                  (currentStep === 1 && (!testConfig.name || !testConfig.hypothesis)) ||
                  (currentStep === 2 && (!testConfig.variant_a.content || !testConfig.variant_b.content))
                }
              >
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCreateTest}
                  disabled={loading}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar como Rascunho
                </Button>
                <Button
                  onClick={handleCreateTest}
                  disabled={loading}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {loading ? 'Criando...' : 'Criar e Iniciar Teste'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
