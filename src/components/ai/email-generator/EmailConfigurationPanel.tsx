import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Zap, RefreshCw } from 'lucide-react'
import { EmailGenerationParams, AIProvider } from '@/lib/ai'
import { EMAIL_TYPES, TONE_OPTIONS, LENGTH_OPTIONS, AI_PROVIDERS } from '@/lib/data/email-config'

interface EmailConfigurationPanelProps {
  params: EmailGenerationParams
  provider: AIProvider
  onParamsChange: (params: EmailGenerationParams) => void
  onProviderChange: (provider: AIProvider) => void
  onGenerate: () => void
  isGenerating: boolean
}

export function EmailConfigurationPanel({
  params,
  provider,
  onParamsChange,
  onProviderChange,
  onGenerate,
  isGenerating
}: EmailConfigurationPanelProps) {
  const [keyPointInput, setKeyPointInput] = useState('')

  const handleAddKeyPoint = () => {
    if (keyPointInput.trim()) {
      onParamsChange({
        ...params,
        keyPoints: [...(params.keyPoints || []), keyPointInput.trim()]
      })
      setKeyPointInput('')
    }
  }

  const handleRemoveKeyPoint = (index: number) => {
    onParamsChange({
      ...params,
      keyPoints: params.keyPoints?.filter((_, i) => i !== index) || []
    })
  }

  const updateParams = (updates: Partial<EmailGenerationParams>) => {
    onParamsChange({ ...params, ...updates })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Configurações do Email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo de Email</Label>
            <Select 
              value={params.type} 
              onValueChange={(value: any) => updateParams({ type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tom de Voz</Label>
            <Select 
              value={params.tone} 
              onValueChange={(value: any) => updateParams({ tone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map(tone => (
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
            onChange={(e) => updateParams({ audience: e.target.value })}
            placeholder="Ex: Empreendedores de startups tecnológicas"
          />
        </div>

        <div>
          <Label>Objetivo do Email *</Label>
          <Textarea
            value={params.purpose}
            onChange={(e) => updateParams({ purpose: e.target.value })}
            placeholder="Ex: Apresentar nova funcionalidade e incentivar upgrade"
            className="min-h-[60px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome da Empresa</Label>
            <Input
              value={params.companyName}
              onChange={(e) => updateParams({ companyName: e.target.value })}
              placeholder="EmailSend"
            />
          </div>

          <div>
            <Label>Produto/Serviço</Label>
            <Input
              value={params.productName}
              onChange={(e) => updateParams({ productName: e.target.value })}
              placeholder="Plataforma de Email Marketing"
            />
          </div>
        </div>

        <div>
          <Label>Call-to-Action</Label>
          <Input
            value={params.callToAction}
            onChange={(e) => updateParams({ callToAction: e.target.value })}
            placeholder="Ex: Começar teste grátis agora"
          />
        </div>

        <div>
          <Label>Tamanho do Conteúdo</Label>
          <Select 
            value={params.targetLength} 
            onValueChange={(value: any) => updateParams({ targetLength: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LENGTH_OPTIONS.map(length => (
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
              <Badge 
                key={index} 
                variant="secondary" 
                className="cursor-pointer" 
                onClick={() => handleRemoveKeyPoint(index)}
              >
                {point} ×
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <Label>Provedor de IA</Label>
          <Select value={provider} onValueChange={onProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map(provider => (
                <SelectItem key={provider.value} value={provider.value}>
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={onGenerate}
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
  )
}