import { useState } from 'react'
import { toast } from 'sonner'
import { BusinessInfo, FlowTemplate, GeneratedFlow } from '@/lib/types/flow-types'

export function useFlowGeneration() {
  const [generatingFlow, setGeneratingFlow] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<GeneratedFlow | null>(null)

  const personalizeSubject = (subject: string, info: BusinessInfo) => {
    return subject
      .replace('[Cliente]', info.companyName || 'Cliente')
      .replace('[produto]', info.productType || 'produto')
      .replace('[resultado]', info.businessGoal || 'resultado')
  }

  const generateEmailContent = (template: any, info: BusinessInfo) => {
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

  const generateFlowWithAI = async (selectedTemplate: FlowTemplate, businessInfo: BusinessInfo) => {
    if (!selectedTemplate) return

    setGeneratingFlow(true)
    try {
      // Simulate AI generation - in production, call your AI API
      await new Promise(resolve => setTimeout(resolve, 3000))

      const generatedFlow: GeneratedFlow = {
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

  const resetGeneration = () => {
    setGeneratedContent(null)
  }

  return {
    generatingFlow,
    generatedContent,
    generateFlowWithAI,
    resetGeneration
  }
}