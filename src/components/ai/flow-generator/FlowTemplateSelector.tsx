import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FlowTemplate } from '@/lib/types/flow-types'

interface FlowTemplateSelectorProps {
  templates: FlowTemplate[]
  onTemplateSelect: (template: FlowTemplate) => void
}

export function FlowTemplateSelector({ templates, onTemplateSelect }: FlowTemplateSelectorProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
        Escolha o tipo de fluxo que deseja criar
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => {
          const Icon = template.icon
          return (
            <Card
              key={template.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200"
              onClick={() => onTemplateSelect(template)}
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
  )
}