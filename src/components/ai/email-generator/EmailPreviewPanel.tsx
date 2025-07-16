import React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Copy, RefreshCw, Lightbulb, Wand2 } from 'lucide-react'
import { SanitizedPreviewHtml } from '@/components/ui/sanitized-html'

interface GeneratedEmailContent {
  subject: string
  htmlContent: string
  suggestions: string[]
}

interface EmailPreviewPanelProps {
  generatedContent: GeneratedEmailContent | null
  onCopyContent: () => void
  onRegenerate: () => void
}

export function EmailPreviewPanel({ 
  generatedContent, 
  onCopyContent, 
  onRegenerate 
}: EmailPreviewPanelProps) {
  if (!generatedContent) {
    return (
      <Card className="h-96 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Wand2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Configure os parâmetros e clique em "Gerar Email"</p>
          <p className="text-xs text-gray-400 mt-1">O conteúdo aparecerá aqui</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center">
          <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
          Conteúdo Gerado
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCopyContent}>
            <Copy className="mr-1 h-3 w-3" />
            Copiar
          </Button>
          <Button size="sm" onClick={onRegenerate}>
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
          <SanitizedPreviewHtml
            html={generatedContent.htmlContent}
            className="border rounded p-4 bg-white max-h-64 overflow-y-auto text-sm"
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
  )
}