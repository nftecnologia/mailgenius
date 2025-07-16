'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Sparkles,
  Bot,
  ShoppingCart,
  Mail,
  Users,
  TrendingUp,
  Clock,
  Target,
  Zap,
  ArrowRight,
  Check,
  Edit,
  Download
} from 'lucide-react'

interface FlowTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: any
  color: string
  estimatedEmails: number
  duration: string
  useCase: string
  steps: FlowStepTemplate[]
}

interface FlowStepTemplate {
  type: 'trigger' | 'delay' | 'email' | 'condition'
  name: string
  delay?: {
    amount: number
    unit: string
  }
  emailTemplate?: {
    subject: string
    tone: string
    keyPoints: string[]
  }
}

const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'cart-abandonment',
    name: 'Recuperação de Carrinho Abandonado',
    description: 'Reconquiste clientes que abandonaram compras',
    category: 'E-commerce',
    icon: ShoppingCart,
    color: 'bg-orange-500',
    estimatedEmails: 3,
    duration: '7 dias',
    useCase: 'Aumentar conversões de carrinho abandonado em até 30%',
    steps: [
      { type: 'trigger', name: 'Carrinho abandonado' },
      { type: 'delay', name: 'Aguardar 1 hora', delay: { amount: 1, unit: 'hours' } },
      {
        type: 'email',
        name: 'Lembrete gentil',
        emailTemplate: {
          subject: 'Você esqueceu algo no seu carrinho 🛒',
          tone: 'amigável e útil',
          keyPoints: ['Lembrar produtos', 'Mostrar benefícios', 'Criar senso de urgência suave']
        }
      },
      { type: 'delay', name: 'Aguardar 24 horas', delay: { amount: 24, unit: 'hours' } },
      {
        type: 'email',
        name: 'Oferta especial',
        emailTemplate: {
          subject: 'Oferta especial: 10% OFF no seu carrinho',
          tone: 'persuasivo mas respeitoso',
          keyPoints: ['Oferecer desconto', 'Destacar escassez', 'Facilitar compra']
        }
      },
      { type: 'delay', name: 'Aguardar 3 dias', delay: { amount: 3, unit: 'days' } },
      {
        type: 'email',
        name: 'Última chance',
        emailTemplate: {
          subject: 'Última chance: seus itens podem esgotar',
          tone: 'urgente mas não agressivo',
          keyPoints: ['Criar urgência', 'Mostrar escassez', 'Oferecer ajuda']
        }
      }
    ]
  },
  {
    id: 'welcome-sequence',
    name: 'Sequência de Boas-vindas',
    description: 'Eduque e engaje novos leads automaticamente',
    category: 'Onboarding',
    icon: Users,
    color: 'bg-blue-500',
    estimatedEmails: 5,
    duration: '14 dias',
    useCase: 'Aumentar engajamento de novos leads em 60%',
    steps: [
      { type: 'trigger', name: 'Novo lead cadastrado' },
      {
        type: 'email',
        name: 'Boas-vindas',
        emailTemplate: {
          subject: 'Bem-vindo(a)! Aqui está seu primeiro passo',
          tone: 'caloroso e acolhedor',
          keyPoints: ['Dar boas-vindas', 'Explicar o que esperar', 'Primeiro valor']
        }
      },
      { type: 'delay', name: 'Aguardar 2 dias', delay: { amount: 2, unit: 'days' } },
      {
        type: 'email',
        name: 'Conteúdo educativo #1',
        emailTemplate: {
          subject: 'Dica valiosa: Como começar da forma certa',
          tone: 'educativo e útil',
          keyPoints: ['Compartilhar conhecimento', 'Estabelecer autoridade', 'Dar valor']
        }
      },
      { type: 'delay', name: 'Aguardar 3 dias', delay: { amount: 3, unit: 'days' } },
      {
        type: 'email',
        name: 'Caso de sucesso',
        emailTemplate: {
          subject: 'História inspiradora: Como [Cliente] conseguiu [resultado]',
          tone: 'inspirador e motivacional',
          keyPoints: ['Contar história de sucesso', 'Mostrar resultados possíveis', 'Inspirar ação']
        }
      },
      { type: 'delay', name: 'Aguardar 4 dias', delay: { amount: 4, unit: 'days' } },
      {
        type: 'email',
        name: 'Conteúdo educativo #2',
        emailTemplate: {
          subject: 'Erro comum que você deve evitar',
          tone: 'consultivo e preventivo',
          keyPoints: ['Alertar sobre erros', 'Posicionar como especialista', 'Prevenir problemas']
        }
      },
      { type: 'delay', name: 'Aguardar 5 dias', delay: { amount: 5, unit: 'days' } },
      {
        type: 'email',
        name: 'Chamada para ação',
        emailTemplate: {
          subject: 'Pronto para dar o próximo passo?',
          tone: 'convidativo e motivador',
          keyPoints: ['Fazer convite claro', 'Mostrar próximos passos', 'Facilitar conversão']
        }
      }
    ]
  },
  {
    id: 'newsletter-engagement',
    name: 'Newsletter de Engajamento',
    description: 'Mantenha sua audiência engajada com conteúdo regular',
    category: 'Newsletter',
    icon: Mail,
    color: 'bg-purple-500',
    estimatedEmails: 4,
    duration: '1 mês',
    useCase: 'Aumentar abertura de emails em 40% e cliques em 25%',
    steps: [
      { type: 'trigger', name: 'Inscrição em newsletter' },
      {
        type: 'email',
        name: 'Newsletter semanal #1',
        emailTemplate: {
          subject: '📰 Resumo da semana + novidade exclusiva',
          tone: 'informativo e amigável',
          keyPoints: ['Resumir novidades', 'Compartilhar insights', 'Dar exclusividade']
        }
      },
      { type: 'delay', name: 'Aguardar 1 semana', delay: { amount: 1, unit: 'weeks' } },
      {
        type: 'email',
        name: 'Conteúdo de valor',
        emailTemplate: {
          subject: '💡 Dica que pode mudar seus resultados',
          tone: 'educativo e impactante',
          keyPoints: ['Compartilhar dica valiosa', 'Demonstrar expertise', 'Gerar valor real']
        }
      },
      { type: 'delay', name: 'Aguardar 1 semana', delay: { amount: 1, unit: 'weeks' } },
      {
        type: 'email',
        name: 'Pergunta engajante',
        emailTemplate: {
          subject: 'Pergunta rápida: qual seu maior desafio?',
          tone: 'conversacional e curioso',
          keyPoints: ['Fazer pergunta interessante', 'Incentivar resposta', 'Criar interação']
        }
      },
      { type: 'delay', name: 'Aguardar 1 semana', delay: { amount: 1, unit: 'weeks' } },
      {
        type: 'email',
        name: 'Conteúdo premium',
        emailTemplate: {
          subject: '🎁 Conteúdo exclusivo só para você',
          tone: 'exclusivo e especial',
          keyPoints: ['Oferecer conteúdo premium', 'Fazer sentir especial', 'Recompensar fidelidade']
        }
      }
    ]
  },
  {
    id: 'sales-followup',
    name: 'Follow-up de Vendas',
    description: 'Nutra leads qualificados até a conversão',
    category: 'Vendas',
    icon: TrendingUp,
    color: 'bg-green-500',
    estimatedEmails: 6,
    duration: '21 dias',
    useCase: 'Converter 15-25% dos leads em clientes',
    steps: [
      { type: 'trigger', name: 'Lead qualificado' },
      {
        type: 'email',
        name: 'Apresentação da solução',
        emailTemplate: {
          subject: 'Como resolver [problema específico] em [tempo]',
          tone: 'profissional e solucionador',
          keyPoints: ['Apresentar solução', 'Focar no problema', 'Demonstrar competência']
        }
      },
      { type: 'delay', name: 'Aguardar 3 dias', delay: { amount: 3, unit: 'days' } },
      {
        type: 'email',
        name: 'Prova social',
        emailTemplate: {
          subject: 'Veja como [Empresa Similar] aumentou [resultado] em [%]',
          tone: 'convincente e baseado em dados',
          keyPoints: ['Mostrar caso de sucesso', 'Usar dados concretos', 'Criar confiança']
        }
      },
      { type: 'delay', name: 'Aguardar 4 dias', delay: { amount: 4, unit: 'days' } },
      {
        type: 'email',
        name: 'Objeções comuns',
        emailTemplate: {
          subject: '"Mas isso funciona para meu tipo de negócio?"',
          tone: 'empático e esclarecedor',
          keyPoints: ['Antecipar objeções', 'Fornecer esclarecimentos', 'Remover barreiras']
        }
      },
      { type: 'delay', name: 'Aguardar 5 dias', delay: { amount: 5, unit: 'days' } },
      {
        type: 'email',
        name: 'Demonstração/Trial',
        emailTemplate: {
          subject: 'Que tal ver funcionando? Demonstração gratuita',
          tone: 'convidativo e sem pressão',
          keyPoints: ['Oferecer demonstração', 'Reduzir risco', 'Facilitar experimentação']
        }
      },
      { type: 'delay', name: 'Aguardar 4 dias', delay: { amount: 4, unit: 'days' } },
      {
        type: 'email',
        name: 'Oferta limitada',
        emailTemplate: {
          subject: 'Oferta especial válida por 48h (só para você)',
          tone: 'urgente mas respeitoso',
          keyPoints: ['Criar senso de urgência', 'Oferecer incentivo', 'Facilitar decisão']
        }
      },
      { type: 'delay', name: 'Aguardar 5 dias', delay: { amount: 5, unit: 'days' } },
      {
        type: 'email',
        name: 'Última oportunidade',
        emailTemplate: {
          subject: 'Última chance - posso ajudar de outra forma?',
          tone: 'útil e sem pressão',
          keyPoints: ['Fazer última tentativa', 'Oferecer ajuda alternativa', 'Manter relacionamento']
        }
      }
    ]
  }
]

interface AIFlowGeneratorProps {
  onFlowGenerated?: (flow: any) => void
  onClose?: () => void
}

export default function AIFlowGenerator({ onFlowGenerated, onClose }: AIFlowGeneratorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null)
  const [businessInfo, setBusinessInfo] = useState({
    industry: '',
    productType: '',
    targetAudience: '',
    businessGoal: '',
    tone: 'profissional',
    companyName: ''
  })
  const [generatingFlow, setGeneratingFlow] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(1)

  const handleTemplateSelect = (template: FlowTemplate) => {
    setSelectedTemplate(template)
    setCurrentStep(2)
  }

  const handleBusinessInfoSubmit = () => {
    if (!businessInfo.industry || !businessInfo.targetAudience) {
      toast.error('Preencha pelo menos o setor e público-alvo')
      return
    }
    setCurrentStep(3)
  }

  const generateFlowWithAI = async () => {
    if (!selectedTemplate) return

    setGeneratingFlow(true)
    try {
      // Simulate AI generation - in production, call your AI API
      await new Promise(resolve => setTimeout(resolve, 3000))

      const generatedFlow = {
        name: `${selectedTemplate.name} - ${businessInfo.companyName || 'Minha Empresa'}`,
        description: `Fluxo automatizado para ${businessInfo.industry} focado em ${businessInfo.businessGoal}`,
        steps: selectedTemplate.steps.map((step, index) => ({
          id: `step_${Date.now()}_${index}`,
          type: step.type,
          name: step.name,
          config: step.type === 'email' ? {
            subject: personalizeSubject(step.emailTemplate?.subject || '', businessInfo),
            template_id: 'ai_generated',
            from_name: businessInfo.companyName || 'Sua Empresa',
            content: generateEmailContent(step.emailTemplate!, businessInfo),
            tone: businessInfo.tone
          } : step.type === 'delay' ? {
            wait_amount: step.delay?.amount,
            wait_unit: step.delay?.unit,
            description: step.name
          } : {}
        }))
      }

      setGeneratedContent(generatedFlow)
      toast.success('Fluxo gerado com sucesso! IA criou conteúdo personalizado.')
    } catch (error) {
      console.error('Error generating flow:', error)
      toast.error('Erro ao gerar fluxo com IA')
    } finally {
      setGeneratingFlow(false)
    }
  }

  const personalizeSubject = (subject: string, info: any) => {
    return subject
      .replace('[Cliente]', info.companyName || 'Cliente')
      .replace('[produto]', info.productType || 'produto')
      .replace('[resultado]', info.businessGoal || 'resultado')
  }

  const generateEmailContent = (template: any, info: any) => {
    const intros = {
      amigável: 'Olá! Espero que esteja tudo bem com você.',
      profissional: 'Cumprimentos,',
      caloroso: 'Que alegria ter você conosco!',
      educativo: 'Tenho algo importante para compartilhar com você.',
      conversacional: 'Ei! Como vai?'
    }

    const outros = {
      amigável: 'Qualquer dúvida, é só responder este email!',
      profissional: 'Fico à disposição para esclarecer qualquer questão.',
      caloroso: 'Estamos aqui para ajudar no que precisar!',
      educativo: 'Continue acompanhando para mais dicas valiosas.',
      conversacional: 'Fale comigo se tiver alguma dúvida!'
    }

    const intro = intros[info.tone as keyof typeof intros] || intros.profissional
    const outro = outros[info.tone as keyof typeof outros] || outros.profissional

    let content = `${intro}\n\n`

    template.keyPoints.forEach((point: string, index: number) => {
      content += `${index + 1}. ${point}\n`
    })

    content += `\n${outro}\n\nAbraços,\n${info.companyName || 'Equipe'}`

    return content
  }

  const handleUseFlow = () => {
    if (generatedContent && onFlowGenerated) {
      onFlowGenerated(generatedContent)
      toast.success('Fluxo carregado no builder!')
      onClose?.()
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Assistente IA para Fluxos de Email
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Crie fluxos completos de email marketing com conteúdo personalizado gerado por inteligência artificial
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            1
          </div>
          <div className="w-16 h-1 bg-gray-200">
            <div className={`h-full bg-blue-500 transition-all duration-300 ${
              currentStep >= 2 ? 'w-full' : 'w-0'
            }`} />
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            2
          </div>
          <div className="w-16 h-1 bg-gray-200">
            <div className={`h-full bg-blue-500 transition-all duration-300 ${
              currentStep >= 3 ? 'w-full' : 'w-0'
            }`} />
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            3
          </div>
        </div>
      </div>

      {/* Step 1: Template Selection */}
      {currentStep === 1 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Escolha o tipo de fluxo que deseja criar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FLOW_TEMPLATES.map((template) => {
              const Icon = template.icon
              return (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg ${template.color} flex items-center justify-center text-white`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4">{template.description}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Emails:</span>
                        <span className="font-medium">{template.estimatedEmails}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duração:</span>
                        <span className="font-medium">{template.duration}</span>
                      </div>
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-green-700 text-xs font-medium">
                          🎯 {template.useCase}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 2: Business Information */}
      {currentStep === 2 && selectedTemplate && (
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Conte-nos sobre seu negócio
          </h2>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Nome da Empresa</Label>
                  <Input
                    id="companyName"
                    value={businessInfo.companyName}
                    onChange={(e) => setBusinessInfo(prev => ({...prev, companyName: e.target.value}))}
                    placeholder="Ex: Minha Empresa Ltda"
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Setor/Indústria *</Label>
                  <Select onValueChange={(value) => setBusinessInfo(prev => ({...prev, industry: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione seu setor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ecommerce">E-commerce</SelectItem>
                      <SelectItem value="saas">SaaS/Software</SelectItem>
                      <SelectItem value="consultoria">Consultoria</SelectItem>
                      <SelectItem value="educacao">Educação</SelectItem>
                      <SelectItem value="saude">Saúde</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                      <SelectItem value="imobiliario">Imobiliário</SelectItem>
                      <SelectItem value="varejo">Varejo</SelectItem>
                      <SelectItem value="servicos">Serviços</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="productType">Tipo de Produto/Serviço</Label>
                <Input
                  id="productType"
                  value={businessInfo.productType}
                  onChange={(e) => setBusinessInfo(prev => ({...prev, productType: e.target.value}))}
                  placeholder="Ex: Plataforma de marketing digital"
                />
              </div>

              <div>
                <Label htmlFor="targetAudience">Público-alvo *</Label>
                <Textarea
                  id="targetAudience"
                  value={businessInfo.targetAudience}
                  onChange={(e) => setBusinessInfo(prev => ({...prev, targetAudience: e.target.value}))}
                  placeholder="Ex: Pequenos empreendedores que querem aumentar suas vendas online"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="businessGoal">Objetivo Principal</Label>
                <Input
                  id="businessGoal"
                  value={businessInfo.businessGoal}
                  onChange={(e) => setBusinessInfo(prev => ({...prev, businessGoal: e.target.value}))}
                  placeholder="Ex: aumentar conversões, educar leads, recuperar vendas"
                />
              </div>

              <div>
                <Label htmlFor="tone">Tom de Comunicação</Label>
                <Select onValueChange={(value) => setBusinessInfo(prev => ({...prev, tone: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="amigável">Amigável</SelectItem>
                    <SelectItem value="caloroso">Caloroso</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                    <SelectItem value="conversacional">Conversacional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleBusinessInfoSubmit} className="flex-1">
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Generate and Preview */}
      {currentStep === 3 && (
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Gerar fluxo com IA
          </h2>

          {!generatedContent ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Pronto para gerar seu fluxo!</h3>
                <p className="text-gray-600 mb-6">
                  A IA criará emails personalizados baseados nas informações do seu negócio
                </p>

                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-blue-900 mb-2">Resumo do que será criado:</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• <strong>Fluxo:</strong> {selectedTemplate?.name}</p>
                    <p>• <strong>Setor:</strong> {businessInfo.industry}</p>
                    <p>• <strong>Tom:</strong> {businessInfo.tone}</p>
                    <p>• <strong>Emails:</strong> {selectedTemplate?.estimatedEmails}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                    Editar Informações
                  </Button>
                  <Button
                    onClick={generateFlowWithAI}
                    disabled={generatingFlow}
                    className="flex-1"
                  >
                    {generatingFlow ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Gerando com IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Gerar Fluxo
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">Fluxo gerado com sucesso!</h3>
                  </div>
                  <p className="text-green-700">
                    A IA criou {generatedContent.steps.filter((s: any) => s.type === 'email').length} emails personalizados
                    para seu negócio de {businessInfo.industry}.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{generatedContent.name}</CardTitle>
                  <CardDescription>{generatedContent.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedContent.steps.map((step: any, index: number) => (
                      <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{step.name}</h4>
                          {step.type === 'email' && step.config.subject && (
                            <p className="text-sm text-gray-600">📧 {step.config.subject}</p>
                          )}
                          {step.type === 'delay' && (
                            <p className="text-sm text-gray-600">⏰ {step.config.description}</p>
                          )}
                        </div>
                        <Badge variant="outline">{step.type}</Badge>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" onClick={() => setGeneratedContent(null)} className="flex-1">
                      <Edit className="mr-2 h-4 w-4" />
                      Gerar Novamente
                    </Button>
                    <Button onClick={handleUseFlow} className="flex-1">
                      <Download className="mr-2 h-4 w-4" />
                      Usar este Fluxo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
