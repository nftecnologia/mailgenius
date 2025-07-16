'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  Wand2,
  Copy,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { EmailGenerationParams, AIProvider } from '@/lib/ai'

interface AIEmailGeneratorProps {
  onGenerated?: (content: { subject: string; htmlContent: string; suggestions: string[] }) => void
  initialParams?: Partial<EmailGenerationParams>
}

export default function AIEmailGenerator({ onGenerated, initialParams }: AIEmailGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<{
    subject: string
    htmlContent: string
    suggestions: string[]
  } | null>(null)

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

  const [keyPointInput, setKeyPointInput] = useState('')
  const [provider, setProvider] = useState<AIProvider>('openai')

  const handleAddKeyPoint = () => {
    if (keyPointInput.trim()) {
      setParams(prev => ({
        ...prev,
        keyPoints: [...(prev.keyPoints || []), keyPointInput.trim()]
      }))
      setKeyPointInput('')
    }
  }

  const handleRemoveKeyPoint = (index: number) => {
    setParams(prev => ({
      ...prev,
      keyPoints: prev.keyPoints?.filter((_, i) => i !== index) || []
    }))
  }

  const handleGenerate = async () => {
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

    } catch (error) {
      console.error('Error generating email:', error)
      toast.error('Erro ao gerar conteúdo. Verifique se as APIs de IA estão configuradas.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUseGenerated = () => {
    if (generatedContent && onGenerated) {
      onGenerated(generatedContent)
      setIsOpen(false)
      toast.success('Conteúdo aplicado ao template!')
    }
  }

  const handleCopyContent = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent.htmlContent)
      toast.success('Conteúdo copiado para área de transferência!')
    }
  }

  const emailTypes = [
    { value: 'welcome', label: 'Boas-vindas' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'promotion', label: 'Promoção' },
    { value: 'follow-up', label: 'Follow-up' },
    { value: 'custom', label: 'Personalizado' }
  ]

  const tones = [
    { value: 'professional', label: 'Profissional' },
    { value: 'friendly', label: 'Amigável' },
    { value: 'casual', label: 'Casual' },
    { value: 'urgent', label: 'Urgente' },
    { value: 'enthusiastic', label: 'Entusiasmado' }
  ]

  const lengths = [
    { value: 'short', label: 'Curto (150-200 palavras)' },
    { value: 'medium', label: 'Médio (250-350 palavras)' },
    { value: 'long', label: 'Longo (400-600 palavras)' }
  ]

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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configurações do Email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de Email</Label>
                    <Select value={params.type} onValueChange={(value: any) => setParams(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {emailTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tom de Voz</Label>
                    <Select value={params.tone} onValueChange={(value: any) => setParams(prev => ({ ...prev, tone: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tones.map(tone => (
                          <SelectItem key={tone.value} value={tone.value}>
                            {tone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Público-alvo *</Label>
                  <Input
                    value={params.audience}
                    onChange={(e) => setParams(prev => ({ ...prev, audience: e.target.value }))}
                    placeholder="Ex: Empreendedores de startups tecnológicas"
                  />
                </div>

                <div>
                  <Label>Objetivo do Email *</Label>
                  <Textarea
                    value={params.purpose}
                    onChange={(e) => setParams(prev => ({ ...prev, purpose: e.target.value }))}
                    placeholder="Ex: Apresentar nova funcionalidade e incentivar upgrade"
                    className="min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome da Empresa</Label>
                    <Input
                      value={params.companyName}
                      onChange={(e) => setParams(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="EmailSend"
                    />
                  </div>

                  <div>
                    <Label>Produto/Serviço</Label>
                    <Input
                      value={params.productName}
                      onChange={(e) => setParams(prev => ({ ...prev, productName: e.target.value }))}
                      placeholder="Plataforma de Email Marketing"
                    />
                  </div>
                </div>

                <div>
                  <Label>Call-to-Action</Label>
                  <Input
                    value={params.callToAction}
                    onChange={(e) => setParams(prev => ({ ...prev, callToAction: e.target.value }))}
                    placeholder="Ex: Começar teste grátis agora"
                  />
                </div>

                <div>
                  <Label>Tamanho do Conteúdo</Label>
                  <Select value={params.targetLength} onValueChange={(value: any) => setParams(prev => ({ ...prev, targetLength: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lengths.map(length => (
                        <SelectItem key={length.value} value={length.value}>
                          {length.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Pontos-chave</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={keyPointInput}
                      onChange={(e) => setKeyPointInput(e.target.value)}
                      placeholder="Adicionar ponto importante"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddKeyPoint()}
                    />
                    <Button size="sm" onClick={handleAddKeyPoint}>
                      +
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {params.keyPoints?.map((point, index) => (
                      <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveKeyPoint(index)}>
                        {point} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>Provedor de IA</Label>
                  <Select value={provider} onValueChange={(value: AIProvider) => setProvider(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                      <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !params.audience || !params.purpose}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Gerar Email
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            {generatedContent ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    Conteúdo Gerado
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopyContent}>
                      <Copy className="mr-1 h-3 w-3" />
                      Copiar
                    </Button>
                    <Button size="sm" onClick={handleGenerate}>
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Regenerar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">ASSUNTO:</Label>
                    <p className="font-medium bg-blue-50 p-2 rounded text-sm">
                      {generatedContent.subject}
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-gray-600">PREVIEW HTML:</Label>
                    <div
                      className="border rounded p-4 bg-white max-h-64 overflow-y-auto text-sm"
                      dangerouslySetInnerHTML={{ __html: generatedContent.htmlContent }}
                    />
                  </div>

                  {generatedContent.suggestions.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium text-gray-600 flex items-center">
                        <Lightbulb className="mr-1 h-3 w-3" />
                        SUGESTÕES:
                      </Label>
                      <ul className="text-sm space-y-1 mt-1">
                        {generatedContent.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-2">•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Wand2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Configure os parâmetros e clique em "Gerar Email"</p>
                  <p className="text-xs text-gray-400 mt-1">O conteúdo aparecerá aqui</p>
                </div>
              </Card>
            )}
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
