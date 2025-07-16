import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, Sparkles, Check, Edit, Download } from 'lucide-react'
import { FlowTemplate, BusinessInfo, GeneratedFlow } from '@/lib/types/flow-types'

interface FlowPreviewProps {
  selectedTemplate: FlowTemplate
  businessInfo: BusinessInfo
  generatedContent: GeneratedFlow | null
  isGenerating: boolean
  onGenerate: () => void
  onRegenerate: () => void
  onUseFlow: () => void
  onEditInfo: () => void
}

export function FlowPreview({
  selectedTemplate,
  businessInfo,
  generatedContent,
  isGenerating,
  onGenerate,
  onRegenerate,
  onUseFlow,
  onEditInfo
}: FlowPreviewProps) {
  if (!generatedContent) {
    return (
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
          Gerar fluxo com IA
        </h2>
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
                <p>• <strong>Fluxo:</strong> {selectedTemplate.name}</p>
                <p>• <strong>Setor:</strong> {businessInfo.industry}</p>
                <p>• <strong>Tom:</strong> {businessInfo.tone}</p>
                <p>• <strong>Emails:</strong> {selectedTemplate.estimatedEmails}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onEditInfo} className="flex-1">
                Editar Informações
              </Button>
              <Button
                onClick={onGenerate}
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
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
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
        Fluxo gerado com sucesso!
      </h2>
      
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
            <Button variant="outline" onClick={onRegenerate} className="flex-1">
              <Edit className="mr-2 h-4 w-4" />
              Gerar Novamente
            </Button>
            <Button onClick={onUseFlow} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Usar este Fluxo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}