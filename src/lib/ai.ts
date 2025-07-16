import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export type AIProvider = 'openai' | 'claude'

export interface EmailGenerationParams {
  type: 'welcome' | 'newsletter' | 'promotion' | 'follow-up' | 'custom'
  audience: string
  tone: 'professional' | 'friendly' | 'casual' | 'urgent' | 'enthusiastic'
  purpose: string
  keyPoints?: string[]
  companyName?: string
  productName?: string
  callToAction?: string
  targetLength?: 'short' | 'medium' | 'long'
}

export interface CampaignOptimizationParams {
  subject: string
  content: string
  targetAudience: string
  currentMetrics?: {
    openRate: number
    clickRate: number
    unsubscribeRate: number
  }
  goals: string[]
}

export interface AIResponse {
  content: string
  suggestions?: string[]
  reasoning?: string
  confidence?: number
}

class AIService {
  private async callOpenAI(prompt: string, maxTokens: number = 1000): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em email marketing e copywriting. Sempre responda em português brasileiro de forma profissional e persuasiva.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      })

      return response.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('OpenAI API error:', error)
      throw new Error('Erro ao gerar conteúdo com OpenAI')
    }
  }

  private async callClaude(prompt: string, maxTokens: number = 1000): Promise<string> {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: `Você é um especialista em email marketing e copywriting. Sempre responda em português brasileiro de forma profissional e persuasiva.\n\n${prompt}`
          }
        ],
        temperature: 0.7,
      })

      const content = response.content[0]
      if (content.type === 'text') {
        return content.text
      }
      return ''
    } catch (error) {
      console.error('Claude API error:', error)
      throw new Error('Erro ao gerar conteúdo com Claude')
    }
  }

  private async callAI(prompt: string, provider: AIProvider = 'openai', maxTokens: number = 1000): Promise<string> {
    // Check if API keys are configured
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key não configurada')
    }
    if (provider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key não configurada')
    }

    if (provider === 'openai') {
      return this.callOpenAI(prompt, maxTokens)
    } else {
      return this.callClaude(prompt, maxTokens)
    }
  }

  async generateEmailContent(params: EmailGenerationParams, provider: AIProvider = 'openai'): Promise<AIResponse> {
    const {
      type,
      audience,
      tone,
      purpose,
      keyPoints,
      companyName,
      productName,
      callToAction,
      targetLength
    } = params

    const lengthGuide = {
      short: '150-200 palavras',
      medium: '250-350 palavras',
      long: '400-600 palavras'
    }

    const prompt = `
Crie um email ${type} profissional com as seguintes especificações:

**Contexto:**
- Público-alvo: ${audience}
- Tom de voz: ${tone}
- Objetivo: ${purpose}
- Empresa: ${companyName || 'Nossa empresa'}
- Produto/Serviço: ${productName || 'nosso produto'}
- Comprimento: ${lengthGuide[targetLength || 'medium']}

**Pontos-chave a incluir:**
${keyPoints?.map(point => `- ${point}`).join('\n') || '- Benefícios principais do produto/serviço'}

**Call-to-Action desejado:**
${callToAction || 'Solicitar mais informações'}

**Instruções:**
1. Crie um assunto envolvente e persuasivo
2. Desenvolva o conteúdo do email em HTML responsivo
3. Use uma estrutura clara com cabeçalho, corpo e call-to-action
4. Inclua elementos visuais como cores e formatação
5. Garanta que o email seja mobile-friendly
6. Use variáveis {{nome}}, {{empresa}} onde apropriado

**Formato da resposta:**
ASSUNTO: [assunto do email]

HTML: [código HTML completo do email]

SUGESTÕES: [3 dicas para melhorar a performance]
`

    try {
      const content = await this.callAI(prompt, provider, 1500)

      // Parse the response
      const subjectMatch = content.match(/ASSUNTO:\s*(.+)/i)
      const htmlMatch = content.match(/HTML:\s*([\s\S]+?)(?=SUGESTÕES:|$)/i)
      const suggestionsMatch = content.match(/SUGESTÕES:\s*([\s\S]+)/i)

      const subject = subjectMatch?.[1]?.trim() || 'Email gerado por IA'
      const htmlContent = htmlMatch?.[1]?.trim() || content
      const suggestions = suggestionsMatch?.[1]?.trim().split('\n').filter(s => s.trim()) || []

      return {
        content: `ASSUNTO: ${subject}\n\nHTML:\n${htmlContent}`,
        suggestions,
        confidence: 0.8
      }
    } catch (error) {
      console.error('Error generating email content:', error)
      throw error
    }
  }

  async generateEmailSubjects(
    topic: string,
    audience: string,
    tone: string,
    count: number = 5,
    provider: AIProvider = 'openai'
  ): Promise<string[]> {
    const prompt = `
Gere ${count} assuntos de email criativos e envolventes para:

**Tópico:** ${topic}
**Público-alvo:** ${audience}
**Tom:** ${tone}

**Critérios:**
- Entre 30-60 caracteres
- Gerar curiosidade e urgência
- Evitar spam words
- Focar em benefícios
- Ser específico e relevante

Responda apenas com a lista numerada dos assuntos, um por linha.
`

    try {
      const content = await this.callAI(prompt, provider, 500)

      // Extract numbered list
      const subjects = content
        .split('\n')
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, count)

      return subjects
    } catch (error) {
      console.error('Error generating subjects:', error)
      throw error
    }
  }

  async optimizeCampaign(params: CampaignOptimizationParams, provider: AIProvider = 'openai'): Promise<AIResponse> {
    const { subject, content, targetAudience, currentMetrics, goals } = params

    const metricsText = currentMetrics
      ? `\n**Métricas atuais:**
- Taxa de abertura: ${currentMetrics.openRate}%
- Taxa de clique: ${currentMetrics.clickRate}%
- Taxa de descadastro: ${currentMetrics.unsubscribeRate}%`
      : ''

    const prompt = `
Analise e otimize esta campanha de email marketing:

**Assunto atual:** ${subject}
**Público-alvo:** ${targetAudience}
**Objetivos:** ${goals.join(', ')}${metricsText}

**Conteúdo atual:**
${content}

Forneça:

**ANÁLISE:**
- Pontos fortes da campanha atual
- Áreas que precisam de melhoria
- Problemas identificados

**OTIMIZAÇÕES:**
- Novo assunto otimizado (se necessário)
- Melhorias no conteúdo
- Sugestões de call-to-action
- Recomendações de segmentação

**PREVISÕES:**
- Estimativa de melhoria na taxa de abertura
- Estimativa de melhoria na taxa de clique
- Riscos e considerações

**PRÓXIMOS PASSOS:**
- 3 ações específicas para implementar
`

    try {
      const content = await this.callAI(prompt, provider, 1200)

      return {
        content,
        confidence: 0.85,
        reasoning: 'Análise baseada em melhores práticas de email marketing e dados históricos'
      }
    } catch (error) {
      console.error('Error optimizing campaign:', error)
      throw error
    }
  }

  async generatePersonalizedContent(
    templateContent: string,
    leadData: any,
    provider: AIProvider = 'openai'
  ): Promise<AIResponse> {
    const prompt = `
Personalize este conteúdo de email baseado nos dados do lead:

**Template base:**
${templateContent}

**Dados do lead:**
- Nome: ${leadData.name || 'Cliente'}
- Empresa: ${leadData.company || 'N/A'}
- Cargo: ${leadData.position || 'N/A'}
- Fonte: ${leadData.source || 'N/A'}
- Tags: ${leadData.tags?.join(', ') || 'N/A'}

**Instruções:**
1. Personalize o conteúdo com base nos dados disponíveis
2. Ajuste o tom conforme o cargo/empresa
3. Adicione referências relevantes quando possível
4. Mantenha a estrutura original
5. Use as variáveis {{nome}}, {{empresa}}, {{cargo}} no conteúdo final

Retorne apenas o conteúdo personalizado.
`

    try {
      const content = await this.callAI(prompt, provider, 800)

      return {
        content,
        confidence: 0.75
      }
    } catch (error) {
      console.error('Error personalizing content:', error)
      throw error
    }
  }

  async generateAutomationSuggestions(
    workspaceData: any,
    provider: AIProvider = 'openai'
  ): Promise<AIResponse> {
    const prompt = `
Com base nos dados deste workspace, sugira automações inteligentes de email marketing:

**Dados do workspace:**
- Total de leads: ${workspaceData.totalLeads || 0}
- Fontes principais: ${workspaceData.topSources?.join(', ') || 'N/A'}
- Campanhas ativas: ${workspaceData.activeCampaigns || 0}
- Taxa média de abertura: ${workspaceData.avgOpenRate || 0}%
- Principais tags: ${workspaceData.topTags?.join(', ') || 'N/A'}

**Forneça:**

**AUTOMAÇÕES RECOMENDADAS:**
1. [Nome] - [Descrição] - [Trigger] - [Benefício esperado]
2. [Nome] - [Descrição] - [Trigger] - [Benefício esperado]
3. [Nome] - [Descrição] - [Trigger] - [Benefício esperado]

**SEGMENTAÇÕES SUGERIDAS:**
- [Critério 1] - [Razão]
- [Critério 2] - [Razão]

**PRÓXIMAS AÇÕES:**
- [Ação prioritária 1]
- [Ação prioritária 2]
- [Ação prioritária 3]
`

    try {
      const content = await this.callAI(prompt, provider, 1000)

      return {
        content,
        confidence: 0.8,
        reasoning: 'Sugestões baseadas em análise dos dados do workspace e melhores práticas'
      }
    } catch (error) {
      console.error('Error generating automation suggestions:', error)
      throw error
    }
  }

  // Check if AI services are available
  isAvailable(provider: AIProvider = 'openai'): boolean {
    if (provider === 'openai') {
      return !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')
    } else {
      return !!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes('placeholder')
    }
  }

  // Get available providers
  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = []
    if (this.isAvailable('openai')) providers.push('openai')
    if (this.isAvailable('claude')) providers.push('claude')
    return providers
  }
}

export const aiService = new AIService()

// Helper function to create AI-powered email content
export async function generateEmailWithAI(params: EmailGenerationParams): Promise<{
  subject: string
  htmlContent: string
  suggestions: string[]
}> {
  try {
    const response = await aiService.generateEmailContent(params)

    // Parse the content to extract subject and HTML
    const subjectMatch = response.content.match(/ASSUNTO:\s*(.+)/i)
    const htmlMatch = response.content.match(/HTML:\s*([\s\S]+)/i)

    return {
      subject: subjectMatch?.[1]?.trim() || 'Email gerado por IA',
      htmlContent: htmlMatch?.[1]?.trim() || response.content,
      suggestions: response.suggestions || []
    }
  } catch (error) {
    console.error('Error in generateEmailWithAI:', error)
    throw error
  }
}

// Default email prompts for different types
export const emailPrompts = {
  welcome: {
    purpose: 'Dar boas-vindas a novos usuários e apresentar a empresa',
    keyPoints: [
      'Agradecer pelo cadastro',
      'Explicar próximos passos',
      'Apresentar recursos principais',
      'Fornecer suporte inicial'
    ]
  },
  newsletter: {
    purpose: 'Informar sobre novidades e manter engajamento',
    keyPoints: [
      'Principais novidades do período',
      'Conteúdo relevante para o público',
      'Chamadas para ação específicas',
      'Links para recursos úteis'
    ]
  },
  promotion: {
    purpose: 'Promover produtos ou serviços com ofertas especiais',
    keyPoints: [
      'Destacar benefícios da oferta',
      'Criar senso de urgência',
      'Mostrar valor e economia',
      'Call-to-action claro e direto'
    ]
  },
  followUp: {
    purpose: 'Reativar leads ou continuar relacionamento',
    keyPoints: [
      'Referência à interação anterior',
      'Oferecer valor adicional',
      'Solicitar feedback ou ação',
      'Manter relacionamento ativo'
    ]
  }
}
