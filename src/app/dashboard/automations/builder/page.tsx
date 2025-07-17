'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Play,
  Mail,
  Clock,
  Filter,
  Zap,
  Save,
  ArrowRight,
  Plus,
  Settings,
  Trash2,
  Eye,
  Users,
  Tag,
  Calendar,
  MessageSquare,
  Webhook,
  ArrowLeft,
  Sparkles,
  GitBranch,
} from 'lucide-react'
import { toast } from 'sonner'
import AIFlowGenerator from '@/components/ai/AIFlowGenerator'

interface StepConfig {
  // Email configuration
  template_id?: string
  subject?: string
  from_name?: string

  // Tag configuration
  tag_name?: string
  tag_description?: string
  condition?: string

  // Delay configuration
  wait_amount?: number
  wait_unit?: string
  description?: string

  // Webhook configuration
  webhook_url?: string
  webhook_method?: string
  webhook_headers?: string

  // Notification configuration
  notification_title?: string
  notification_message?: string
  notification_channel?: string

  // Generic config
  [key: string]: any
}

interface AutomationStep {
  id: string
  type: 'trigger' | 'condition' | 'action' | 'delay' | 'branching'
  name: string
  description: string
  config: StepConfig
  icon: any
  color: string
  // Para condições avançadas
  advanced_conditions?: any[]
  // Para branching
  next_steps?: string[]
}

interface FlowData {
  name: string
  description: string
  steps: AutomationStep[]
  isActive: boolean
}

const availableSteps: AutomationStep[] = [
  // Triggers
  {
    id: 'trigger-new-lead',
    type: 'trigger',
    name: 'Novo Lead',
    description: 'Quando um novo lead é adicionado',
    config: { source: 'any' },
    icon: Users,
    color: 'bg-green-500'
  },
  {
    id: 'trigger-webhook',
    type: 'trigger',
    name: 'Webhook',
    description: 'Quando receber dados via webhook',
    config: { url: '', method: 'POST' },
    icon: Webhook,
    color: 'bg-blue-500'
  },
  {
    id: 'trigger-date',
    type: 'trigger',
    name: 'Data Específica',
    description: 'Em uma data e hora específica',
    config: { date: '', time: '' },
    icon: Calendar,
    color: 'bg-purple-500'
  },

  // Conditions
  {
    id: 'condition-tag',
    type: 'condition',
    name: 'Verificar Tag',
    description: 'Se o lead possui uma tag específica',
    config: { tag: '', operator: 'has' },
    icon: Tag,
    color: 'bg-yellow-500'
  },
  {
    id: 'condition-source',
    type: 'condition',
    name: 'Verificar Origem',
    description: 'Se o lead veio de uma fonte específica',
    config: { source: '', operator: 'equals' },
    icon: Filter,
    color: 'bg-orange-500'
  },
  {
    id: 'branching-advanced',
    type: 'branching',
    name: 'Ramificação Avançada',
    description: 'Criar caminhos diferentes baseados em condições complexas',
    config: { 
      conditions: [],
      branches: [
        {
          id: 'branch-true',
          name: 'Condição Verdadeira',
          condition_result: true,
          next_steps: []
        },
        {
          id: 'branch-false',
          name: 'Condição Falsa',
          condition_result: false,
          next_steps: []
        }
      ]
    },
    icon: GitBranch,
    color: 'bg-purple-600'
  },

  // Actions
  {
    id: 'action-send-email',
    type: 'action',
    name: 'Enviar Email',
    description: 'Enviar email personalizado',
    config: { template: '', variables: {} },
    icon: Mail,
    color: 'bg-red-500'
  },
  {
    id: 'action-add-tag',
    type: 'action',
    name: 'Adicionar Tag',
    description: 'Adicionar tag ao lead',
    config: { tag: '' },
    icon: Tag,
    color: 'bg-indigo-500'
  },
  {
    id: 'action-webhook',
    type: 'action',
    name: 'Chamar Webhook',
    description: 'Enviar dados para URL externa',
    config: { url: '', method: 'POST', payload: {} },
    icon: Zap,
    color: 'bg-cyan-500'
  },

  // Delays
  {
    id: 'delay-time',
    type: 'delay',
    name: 'Aguardar',
    description: 'Aguardar um período de tempo',
    config: { amount: 1, unit: 'hours' },
    icon: Clock,
    color: 'bg-gray-500'
  }
]

interface SortableStepProps {
  step: AutomationStep
  onEdit: (step: AutomationStep) => void
  onDelete: (stepId: string) => void
}

function SortableStep({ step, onEdit, onDelete }: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const Icon = step.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative bg-white border-2 border-gray-200 rounded-lg p-4 cursor-move hover:border-gray-300 transition-colors ${
        isDragging ? 'shadow-lg' : 'shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${step.color} flex items-center justify-center text-white flex-shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">{step.name}</h4>
          <p className="text-sm text-gray-500 mt-1">{step.description}</p>

          {/* Show configuration details */}
          {step.config && Object.keys(step.config).length > 0 && (
            <div className="mt-2 space-y-1">
              {step.config.template_id && (
                <div className="text-xs text-blue-600">📧 Template: {step.config.template_id}</div>
              )}
              {step.config.subject && (
                <div className="text-xs text-blue-600">📝 Assunto: {step.config.subject}</div>
              )}
              {step.config.tag_name && (
                <div className="text-xs text-purple-600">🏷️ Tag: {step.config.tag_name}</div>
              )}
              {step.config.wait_amount && step.config.wait_unit && (
                <div className="text-xs text-orange-600">⏱️ Aguardar: {step.config.wait_amount} {step.config.wait_unit}</div>
              )}
              {step.config.webhook_url && (
                <div className="text-xs text-green-600">🔗 Webhook: {step.config.webhook_url}</div>
              )}
              {step.config.notification_title && (
                <div className="text-xs text-indigo-600">🔔 Notificação: {step.config.notification_title}</div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {step.type}
            </Badge>
            {step.config && Object.keys(step.config).length > 0 && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                ⚙️ Configurado
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(step)
            }}
          >
            <Settings className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(step.id)
            }}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Connection Arrow */}
      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-8 h-4 flex items-center justify-center">
        <ArrowRight className="h-4 w-4 text-gray-400 rotate-90" />
      </div>
    </div>
  )
}

export default function AutomationBuilderPage() {
  const [flowData, setFlowData] = useState<FlowData>({
    name: '',
    description: '',
    steps: [],
    isActive: false
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingStep, setEditingStep] = useState<AutomationStep | null>(null)
  const [stepConfig, setStepConfig] = useState<StepConfig>({})
  const [isSaving, setIsSaving] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [showAIGenerator, setShowAIGenerator] = useState(false)

  const router = useRouter()
  const supabase = createClientComponentClient()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Helper function to update step config
  const updateStepConfig = (key: keyof StepConfig, value: any) => {
    setStepConfig((prev: StepConfig) => ({...prev, [key]: value}))
  }

  // Handle AI-generated flow
  const handleAIFlowGenerated = (aiFlow: any) => {
    setFlowData({
      name: aiFlow.name,
      description: aiFlow.description,
      steps: aiFlow.steps.map((step: any) => ({
        ...step,
        icon: getStepIcon(step.type),
        color: getStepColor(step.type),
        description: getStepDescription(step.type, step.config)
      })),
      isActive: false
    })
    setShowAIGenerator(false)
    toast.success('Fluxo gerado pela IA carregado com sucesso!')
  }

  // Helper functions for step display
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'trigger': return Users
      case 'email': return Mail
      case 'delay': return Clock
      case 'condition': return Filter
      default: return Zap
    }
  }

  const getStepColor = (type: string) => {
    switch (type) {
      case 'trigger': return 'bg-green-500'
      case 'email': return 'bg-blue-500'
      case 'delay': return 'bg-orange-500'
      case 'condition': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  const getStepDescription = (type: string, config: any) => {
    switch (type) {
      case 'trigger': return 'Inicia o fluxo automaticamente'
      case 'email': return `Enviar: ${config.subject || 'Email personalizado'}`
      case 'delay': return `Aguardar ${config.wait_amount} ${config.wait_unit}`
      case 'condition': return 'Verifica condição específica'
      default: return 'Ação personalizada'
    }
  }

  // Initialize workspace
  useState(() => {
    const initializeWorkspace = async () => {
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
      }
    }
    initializeWorkspace()
  })

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = flowData.steps.findIndex(step => step.id === active.id)
      const newIndex = flowData.steps.findIndex(step => step.id === over?.id)

      setFlowData(prev => ({
        ...prev,
        steps: arrayMove(prev.steps, oldIndex, newIndex)
      }))
    }

    setActiveId(null)
  }

  const addStep = (stepTemplate: AutomationStep) => {
    const newStep: AutomationStep = {
      ...stepTemplate,
      id: `${stepTemplate.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }

    setFlowData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }))

    toast.success(`${stepTemplate.name} adicionado ao fluxo`)
  }

  const editStep = (step: AutomationStep) => {
    setEditingStep(step)
    setStepConfig(step.config || {})
  }

  const updateStep = (step: AutomationStep) => {
    const updatedStep = {
      ...step,
      config: stepConfig
    }

    setFlowData(prev => ({
      ...prev,
      steps: prev.steps.map(s =>
        s.id === step.id ? updatedStep : s
      )
    }))
    setEditingStep(null)
    setStepConfig({})
    toast.success('Configuração salva com sucesso!')
  }

  const deleteStep = (stepId: string) => {
    setFlowData(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== stepId)
    }))
    toast.success('Etapa removida do fluxo')
  }

  const saveAutomation = async () => {
    if (!workspaceId) {
      toast.error('Workspace não encontrado')
      return
    }

    if (!flowData.name.trim()) {
      toast.error('Nome da automação é obrigatório')
      return
    }

    if (flowData.steps.length === 0) {
      toast.error('Adicione pelo menos uma etapa ao fluxo')
      return
    }

    // Validate that first step is a trigger
    if (flowData.steps[0]?.type !== 'trigger') {
      toast.error('O primeiro passo deve ser um trigger (gatilho)')
      return
    }

    setIsSaving(true)

    try {
      const automationData = {
        workspace_id: workspaceId,
        name: flowData.name,
        description: flowData.description,
        trigger_type: flowData.steps[0]?.type || 'manual',
        trigger_config: flowData.steps[0]?.config || {},
        flow_definition: {
          steps: flowData.steps,
          version: '1.0'
        },
        status: flowData.isActive ? 'active' : 'draft'
      }

      const { error } = await supabase
        .from('automation_flows')
        .insert(automationData)

      if (error) {
        console.error('Error saving automation:', error)
        toast.error('Erro ao salvar automação')
        return
      }

      toast.success('Automação salva com sucesso!')
      router.push('/dashboard/automations')

    } catch (error) {
      console.error('Error saving automation:', error)
      toast.error('Erro inesperado ao salvar automação')
    } finally {
      setIsSaving(false)
    }
  }

  const previewFlow = () => {
    if (flowData.steps.length === 0) {
      toast.error('Adicione etapas ao fluxo primeiro')
      return
    }

    // Show preview dialog or navigate to preview page
    toast.info('Preview em desenvolvimento')
  }

  const activeStep = availableSteps.find(step => step.id === activeId)

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Builder de Automações</h1>
                <p className="text-sm text-gray-600">Crie fluxos automatizados com drag-and-drop</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowAIGenerator(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar com IA
              </Button>
              <Button variant="outline" onClick={previewFlow}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button onClick={saveAutomation} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Salvando...' : 'Salvar Automação'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Available Steps */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Componentes Disponíveis</h3>

              <div className="space-y-6">
                {/* Triggers */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">🚀 Gatilhos (Triggers)</h4>
                  <div className="space-y-2">
                    {availableSteps.filter(step => step.type === 'trigger').map(step => {
                      const Icon = step.icon
                      return (
                        <div
                          key={step.id}
                          className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 transition-colors"
                          onClick={() => addStep(step)}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded ${step.color} flex items-center justify-center text-white`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{step.name}</div>
                              <div className="text-xs text-gray-500">{step.description}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">🔍 Condições</h4>
                  <div className="space-y-2">
                    {availableSteps.filter(step => step.type === 'condition').map(step => {
                      const Icon = step.icon
                      return (
                        <div
                          key={step.id}
                          className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 transition-colors"
                          onClick={() => addStep(step)}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded ${step.color} flex items-center justify-center text-white`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{step.name}</div>
                              <div className="text-xs text-gray-500">{step.description}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">⚡ Ações</h4>
                  <div className="space-y-2">
                    {availableSteps.filter(step => step.type === 'action').map(step => {
                      const Icon = step.icon
                      return (
                        <div
                          key={step.id}
                          className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 transition-colors"
                          onClick={() => addStep(step)}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded ${step.color} flex items-center justify-center text-white`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{step.name}</div>
                              <div className="text-xs text-gray-500">{step.description}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Delays */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">⏰ Delays</h4>
                  <div className="space-y-2">
                    {availableSteps.filter(step => step.type === 'delay').map(step => {
                      const Icon = step.icon
                      return (
                        <div
                          key={step.id}
                          className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 transition-colors"
                          onClick={() => addStep(step)}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded ${step.color} flex items-center justify-center text-white`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{step.name}</div>
                              <div className="text-xs text-gray-500">{step.description}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Canvas */}
          <div className="flex-1 flex flex-col">
            {/* Flow Settings */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="flow-name">Nome da Automação *</Label>
                  <Input
                    id="flow-name"
                    value={flowData.name}
                    onChange={(e) => setFlowData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Boas-vindas para novos leads"
                  />
                </div>
                <div>
                  <Label htmlFor="flow-description">Descrição</Label>
                  <Input
                    id="flow-description"
                    value={flowData.description}
                    onChange={(e) => setFlowData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva o que esta automação faz"
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="flow-active"
                      checked={flowData.isActive}
                      onChange={(e) => setFlowData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="flow-active">Ativar automação</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Flow Canvas */}
            <div className="flex-1 overflow-auto bg-gray-50 p-6">
              <div className="max-w-2xl mx-auto">
                {flowData.steps.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Plus className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Comece criando seu fluxo
                    </h3>
                    <p className="text-gray-500 mb-6">
                      Arraste componentes da barra lateral ou use nossa IA para criar fluxos completos
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
                      <Button
                        onClick={() => setShowAIGenerator(true)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Gerar Fluxo com IA
                      </Button>
                      <span className="text-gray-400 text-sm">ou</span>
                      <span className="text-sm text-gray-500">arraste componentes da sidebar</span>
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 max-w-md mx-auto">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">🤖 Novo: IA Automações</h4>
                      <p className="text-xs text-gray-600">
                        Crie fluxos completos de recuperação de carrinho, boas-vindas, newsletter e follow-up de vendas em segundos!
                      </p>
                    </div>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={flowData.steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-6">
                        {flowData.steps.map((step, index) => (
                          <div key={step.id}>
                            <SortableStep
                              step={step}
                              onEdit={editStep}
                              onDelete={deleteStep}
                            />
                          </div>
                        ))}
                      </div>
                    </SortableContext>

                    <DragOverlay>
                      {activeStep ? (
                        <div className="bg-white border-2 border-gray-300 rounded-lg p-4 shadow-lg opacity-90">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${activeStep.color} flex items-center justify-center text-white`}>
                              <activeStep.icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-medium">{activeStep.name}</h4>
                              <p className="text-sm text-gray-500">{activeStep.description}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step Configuration Dialog */}
        <Dialog open={!!editingStep} onOpenChange={() => {
          setEditingStep(null)
          setStepConfig({})
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar: {editingStep?.name}</DialogTitle>
              <DialogDescription>
                Defina as configurações para esta etapa
              </DialogDescription>
            </DialogHeader>
            {editingStep && (
              <div className="space-y-4">
                {/* Configuração para Enviar Email */}
                {editingStep.type === 'action' && editingStep.id.includes('send-email') && (
                  <div className="space-y-4">
                    <div>
                      <Label>Template de Email</Label>
                      <Select
                        value={stepConfig.template_id || ''}
                        onValueChange={(value) => updateStepConfig('template_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="welcome">Boas-vindas</SelectItem>
                          <SelectItem value="follow-up">Follow-up</SelectItem>
                          <SelectItem value="newsletter">Newsletter</SelectItem>
                          <SelectItem value="promotional">Promocional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Assunto do Email</Label>
                      <Input
                        value={stepConfig.subject || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, subject: e.target.value}))}
                        placeholder="Ex: Bem-vindo à nossa plataforma!"
                      />
                    </div>
                    <div>
                      <Label>Remetente</Label>
                      <Input
                        value={stepConfig.from_name || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, from_name: e.target.value}))}
                        placeholder="Ex: Equipe EmailSend"
                      />
                    </div>
                  </div>
                )}

                {/* Configuração para Condição de Tag */}
                {editingStep.type === 'condition' && editingStep.id.includes('tag') && (
                  <div className="space-y-4">
                    <div>
                      <Label>Tag para verificar</Label>
                      <Input
                        value={stepConfig.tag_name || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, tag_name: e.target.value}))}
                        placeholder="Ex: lead-qualificado"
                      />
                    </div>
                    <div>
                      <Label>Condição</Label>
                      <Select
                        value={stepConfig.condition || 'has_tag'}
                        onValueChange={(value) => setStepConfig(prev => ({...prev, condition: value}))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="has_tag">Possui a tag</SelectItem>
                          <SelectItem value="not_has_tag">Não possui a tag</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Configuração para Delay */}
                {editingStep.type === 'delay' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          value={stepConfig.wait_amount || 1}
                          onChange={(e) => setStepConfig(prev => ({...prev, wait_amount: parseInt(e.target.value)}))}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label>Unidade</Label>
                        <Select
                          value={stepConfig.wait_unit || 'hours'}
                          onValueChange={(value) => setStepConfig(prev => ({...prev, wait_unit: value}))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutos</SelectItem>
                            <SelectItem value="hours">Horas</SelectItem>
                            <SelectItem value="days">Dias</SelectItem>
                            <SelectItem value="weeks">Semanas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Input
                        value={stepConfig.description || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, description: e.target.value}))}
                        placeholder="Ex: Aguardar resposta do lead"
                      />
                    </div>
                  </div>
                )}

                {/* Configuração para Adicionar Tag */}
                {editingStep.type === 'action' && editingStep.id.includes('add-tag') && (
                  <div className="space-y-4">
                    <div>
                      <Label>Tag para adicionar</Label>
                      <Input
                        value={stepConfig.tag_name || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, tag_name: e.target.value}))}
                        placeholder="Ex: campanha-2024"
                      />
                    </div>
                    <div>
                      <Label>Descrição da Tag</Label>
                      <Input
                        value={stepConfig.tag_description || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, tag_description: e.target.value}))}
                        placeholder="Ex: Lead participou da campanha de 2024"
                      />
                    </div>
                  </div>
                )}

                {/* Configuração para Webhook */}
                {editingStep.type === 'action' && editingStep.id.includes('webhook') && (
                  <div className="space-y-4">
                    <div>
                      <Label>URL do Webhook</Label>
                      <Input
                        value={stepConfig.webhook_url || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, webhook_url: e.target.value}))}
                        placeholder="https://api.exemplo.com/webhook"
                      />
                    </div>
                    <div>
                      <Label>Método HTTP</Label>
                      <Select
                        value={stepConfig.webhook_method || 'POST'}
                        onValueChange={(value) => setStepConfig(prev => ({...prev, webhook_method: value}))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Headers (JSON)</Label>
                      <Textarea
                        value={stepConfig.webhook_headers || '{"Content-Type": "application/json"}'}
                        onChange={(e) => setStepConfig(prev => ({...prev, webhook_headers: e.target.value}))}
                        placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {/* Configuração para Notificação */}
                {editingStep.type === 'action' && editingStep.id.includes('notification') && (
                  <div className="space-y-4">
                    <div>
                      <Label>Título da Notificação</Label>
                      <Input
                        value={stepConfig.notification_title || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, notification_title: e.target.value}))}
                        placeholder="Ex: Novo lead qualificado"
                      />
                    </div>
                    <div>
                      <Label>Mensagem</Label>
                      <Textarea
                        value={stepConfig.notification_message || ''}
                        onChange={(e) => setStepConfig(prev => ({...prev, notification_message: e.target.value}))}
                        placeholder="Ex: Um novo lead foi qualificado e está pronto para contato"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label>Canal de Notificação</Label>
                      <Select
                        value={stepConfig.notification_channel || 'email'}
                        onValueChange={(value) => setStepConfig(prev => ({...prev, notification_channel: value}))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="slack">Slack</SelectItem>
                          <SelectItem value="teams">Microsoft Teams</SelectItem>
                          <SelectItem value="webhook">Webhook personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEditingStep(null)
                setStepConfig({})
              }}>
                Cancelar
              </Button>
              <Button onClick={() => editingStep && updateStep(editingStep)}>
                Salvar Configuração
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Flow Generator Dialog */}
        <Dialog open={showAIGenerator} onOpenChange={setShowAIGenerator}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <AIFlowGenerator
              onFlowGenerated={handleAIFlowGenerated}
              onClose={() => setShowAIGenerator(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
