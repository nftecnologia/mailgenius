import { useState } from 'react'
import { toast } from 'sonner'
import { EmailGenerationParams, AIProvider } from '@/lib/ai'

interface GeneratedEmailContent {
  subject: string
  htmlContent: string
  suggestions: string[]
}

export function useEmailGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<GeneratedEmailContent | null>(null)

  const generateEmail = async (params: EmailGenerationParams, provider: AIProvider) => {
    if (!params.audience || !params.purpose) {
      toast.error('Preencha pelo menos o público-alvo e objetivo')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          params,
          provider
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao gerar conteúdo')
      }

      const result = await response.json()
      setGeneratedContent(result)
      toast.success('Conteúdo gerado com sucesso!')
      return result

    } catch (error) {
      console.error('Error generating email:', error)
      toast.error('Erro ao gerar conteúdo. Verifique se as APIs de IA estão configuradas.')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  const copyContent = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent.htmlContent)
      toast.success('Conteúdo copiado para área de transferência!')
    }
  }

  const resetGeneration = () => {
    setGeneratedContent(null)
  }

  return {
    isGenerating,
    generatedContent,
    generateEmail,
    copyContent,
    resetGeneration
  }
}