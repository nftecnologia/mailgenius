import { NextRequest, NextResponse } from 'next/server'
import { generateEmailWithAI, EmailGenerationParams, AIProvider } from '@/lib/ai'
import { sanitizeFormData, sanitizeHtml } from '@/lib/sanitize'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Sanitize input data
    const sanitizedBody = sanitizeFormData(body)
    
    const { params, provider = 'openai' }: {
      params: EmailGenerationParams
      provider: AIProvider
    } = sanitizedBody

    // Validate required parameters
    if (!params.audience || !params.purpose) {
      return NextResponse.json(
        { error: 'Público-alvo e objetivo são obrigatórios' },
        { status: 400 }
      )
    }

    // Check if AI is available (in demo mode, we'll return mock content)
    const isAIAvailable = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')

    if (!isAIAvailable) {
      // Return demo content when AI is not configured
      const mockContent = generateMockEmailContent(params)
      // Sanitize mock content as well
      const sanitizedMockContent = {
        ...mockContent,
        htmlContent: sanitizeHtml(mockContent.htmlContent),
        subject: typeof mockContent.subject === 'string' ? mockContent.subject.replace(/<[^>]*>/g, '') : mockContent.subject
      }
      return NextResponse.json(sanitizedMockContent)
    }

    // Generate content with AI
    const result = await generateEmailWithAI(params)

    // Sanitize the generated HTML content
    const sanitizedResult = {
      ...result,
      htmlContent: sanitizeHtml(result.htmlContent),
      subject: typeof result.subject === 'string' ? result.subject.replace(/<[^>]*>/g, '') : result.subject
    }

    return NextResponse.json(sanitizedResult)

  } catch (error) {
    console.error('Error in AI email generation:', error)

    // Return more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Serviço de IA não configurado. Configure as chaves de API.' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Mock content generator for demo purposes
function generateMockEmailContent(params: EmailGenerationParams) {
  const { type, audience, tone, purpose, companyName, productName, callToAction } = params

  const subjects = {
    welcome: `Bem-vindo(a) à ${companyName || 'nossa empresa'}! 🎉`,
    newsletter: `Novidades imperdíveis para ${audience}`,
    promotion: `Oferta especial: ${productName || 'nosso produto'} com desconto!`,
    'follow-up': `Não perca esta oportunidade, {{name}}!`,
    custom: `Sobre ${purpose.split(' ').slice(0, 4).join(' ')}...`
  }

  const htmlTemplates = {
    welcome: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Bem-vindo(a), {{name}}!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Estamos felizes em tê-lo(a) conosco</p>
  </div>
  <div style="background: white; padding: 40px 20px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <h2 style="color: #333; margin-bottom: 20px;">Bem-vindo(a) ao ${companyName || 'EmailSend'}!</h2>
    <p style="font-size: 16px; line-height: 1.6; color: #555;">
      Olá! Estamos muito animados em tê-lo(a) como parte da nossa comunidade.
      Sua jornada com ${purpose.toLowerCase()} começa agora.
    </p>
    <p style="font-size: 16px; line-height: 1.6; color: #555;">
      Aqui estão os próximos passos para você começar:
    </p>
    <ul style="color: #555; line-height: 1.8;">
      <li>Complete seu perfil para uma experiência personalizada</li>
      <li>Explore nossas principais funcionalidades</li>
      <li>Entre em contato se precisar de ajuda</li>
    </ul>
    <div style="text-align: center; margin: 30px 0;">
      <a href="#" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        ${callToAction || 'Começar Agora'}
      </a>
    </div>
    <p style="font-size: 14px; color: #888; margin-top: 30px;">
      Atenciosamente,<br>
      Equipe ${companyName || 'EmailSend'}
    </p>
  </div>
</div>`,

    newsletter: `
<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <header style="background: #1a365d; color: white; padding: 30px 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">${companyName || 'EmailSend'} Newsletter</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">Conteúdo exclusivo para ${audience}</p>
  </header>

  <main style="background: white; padding: 30px 20px;">
    <h2 style="color: #1a365d; margin-bottom: 20px;">Olá {{name}},</h2>

    <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
      ${purpose}
    </p>

    <section style="margin-bottom: 30px;">
      <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
        🚀 Principais Destaques
      </h3>
      <ul style="color: #4a5568; line-height: 1.6;">
        <li>Nova funcionalidade de automações inteligentes</li>
        <li>Dashboard redesenhado com melhor usabilidade</li>
        <li>Integração com novas plataformas populares</li>
      </ul>
    </section>

    <div style="text-align: center; margin: 30px 0;">
      <a href="#" style="background: #3182ce; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        ${callToAction || 'Saiba Mais'}
      </a>
    </div>
  </main>

  <footer style="background: #f7fafc; padding: 20px; text-align: center; color: #718096; font-size: 14px;">
    <p>${companyName || 'EmailSend'}</p>
    <p><a href="#" style="color: #3182ce;">Descadastrar</a></p>
  </footer>
</div>`,

    promotion: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(45deg, #ff6b6b, #ee5a52); padding: 40px 20px; text-align: center; color: white;">
    <h1 style="margin: 0; font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
      🔥 OFERTA ESPECIAL!
    </h1>
    <p style="margin: 10px 0 0; font-size: 18px; opacity: 0.95;">Para ${audience}</p>
  </div>

  <div style="background: white; padding: 40px 20px; text-align: center;">
    <h2 style="color: #333; margin-bottom: 20px;">${productName || 'Nosso Produto'} com Desconto!</h2>

    <div style="background: #fff5f5; border: 2px dashed #ff6b6b; padding: 30px; margin-bottom: 30px; border-radius: 12px;">
      <h3 style="color: #c53030; margin: 0 0 10px; font-size: 36px;">30% OFF</h3>
      <p style="color: #2d3748; font-size: 18px; margin: 0;">Por tempo limitado!</p>
    </div>

    <p style="font-size: 16px; line-height: 1.6; color: #4a5568; margin-bottom: 20px;">
      ${purpose}
    </p>

    <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #718096;">Use o código:</p>
      <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #c53030; font-family: monospace;">
        DESCONTO30
      </p>
    </div>

    <a href="#" style="background: #ff6b6b; color: white; padding: 18px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; display: inline-block; margin: 20px 0; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);">
      ${callToAction || 'Aproveitar Oferta'}
    </a>

    <p style="font-size: 12px; color: #a0aec0; margin-top: 30px;">
      *Válido até o final do mês. Não cumulativo com outras promoções.
    </p>
  </div>
</div>`
  }

  const defaultTemplate = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; border-left: 4px solid #007bff;">
    <h2 style="color: #333; margin-bottom: 20px;">Olá {{name}},</h2>
    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
      ${purpose}
    </p>
    <p style="color: #555; line-height: 1.6; margin-bottom: 30px;">
      Esperamos que este conteúdo seja útil para ${audience}.
    </p>
    <div style="text-align: center;">
      <a href="#" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
        ${callToAction || 'Saiba Mais'}
      </a>
    </div>
    <p style="font-size: 14px; color: #888; margin-top: 30px;">
      Atenciosamente,<br>
      Equipe ${companyName || 'EmailSend'}
    </p>
  </div>
</div>`

  const selectedTemplate = htmlTemplates[type as keyof typeof htmlTemplates] || defaultTemplate

  const suggestions = [
    `Personalize ainda mais o conteúdo com dados específicos do ${audience}`,
    `Teste diferentes versões do assunto para melhorar a taxa de abertura`,
    `Adicione elementos visuais como imagens ou ícones para aumentar o engajamento`,
    `Considere segmentar ainda mais sua lista baseado no comportamento dos usuários`
  ]

  return {
    subject: subjects[type as keyof typeof subjects] || subjects.custom,
    htmlContent: selectedTemplate,
    suggestions: suggestions.slice(0, 3)
  }
}
