'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Sparkles, Wand2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { EmailGenerationParams, AIProvider } from '@/lib/ai'
import { useEmailGeneration } from '@/lib/hooks/useEmailGeneration'
import { EmailConfigurationPanel } from './email-generator/EmailConfigurationPanel'
import { EmailPreviewPanel } from './email-generator/EmailPreviewPanel'

interface AIEmailGeneratorProps {
  onGenerated?: (content: { subject: string; htmlContent: string; suggestions: string[] }) => void
  initialParams?: Partial<EmailGenerationParams>
}

export default function AIEmailGenerator({ onGenerated, initialParams }: AIEmailGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [provider, setProvider] = useState<AIProvider>('openai')
  const [params, setParams] = useState<EmailGenerationParams>({
    type: 'custom',
    audience: '',
    tone: 'professional',
    purpose: '',
    keyPoints: [],
    companyName: '',
    productName: '',
    callToAction: '',
    targetLength: 'medium',
    ...initialParams
  })

  const {
    isGenerating,
    generatedContent,
    generateEmail,
    copyContent,
    resetGeneration
  } = useEmailGeneration()

  const handleGenerate = () => {
    generateEmail(params, provider)
  }

  const handleRegenerate = () => {
    resetGeneration()
    generateEmail(params, provider)
  }

  const handleUseGenerated = () => {
    if (generatedContent && onGenerated) {
      onGenerated(generatedContent)
      setIsOpen(false)
      toast.success('Conteúdo aplicado ao template!')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
          <Sparkles className="mr-2 h-4 w-4" />
          Gerar com IA
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Wand2 className="mr-2 h-5 w-5 text-purple-600" />
            Gerador de Email com IA
          </DialogTitle>
          <DialogDescription>
            Use inteligência artificial para criar emails personalizados e envolventes
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-4">
            <EmailConfigurationPanel
              params={params}
              provider={provider}
              onParamsChange={setParams}
              onProviderChange={setProvider}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            <EmailPreviewPanel
              generatedContent={generatedContent}
              onCopyContent={copyContent}
              onRegenerate={handleRegenerate}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          {generatedContent && (
            <Button onClick={handleUseGenerated}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Usar Este Conteúdo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}