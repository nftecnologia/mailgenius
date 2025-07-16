'use client'

import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { FLOW_TEMPLATES } from '@/lib/data/flow-templates'
import { AIFlowGeneratorProps } from '@/lib/types/flow-types'
import { useFlowSteps } from '@/lib/hooks/useFlowSteps'
import { useFlowGeneration } from '@/lib/hooks/useFlowGeneration'

import { StepIndicator } from './flow-generator/StepIndicator'
import { FlowTemplateSelector } from './flow-generator/FlowTemplateSelector'
import { BusinessInfoForm } from './flow-generator/BusinessInfoForm'
import { FlowPreview } from './flow-generator/FlowPreview'

export default function AIFlowGenerator({ onFlowGenerated, onClose }: AIFlowGeneratorProps) {
  const {
    currentStep,
    selectedTemplate,
    businessInfo,
    handleTemplateSelect,
    handleBusinessInfoSubmit,
    goToStep,
    updateBusinessInfo
  } = useFlowSteps()

  const {
    generatingFlow,
    generatedContent,
    generateFlowWithAI,
    resetGeneration
  } = useFlowGeneration()

  const handleUseFlow = () => {
    if (generatedContent && onFlowGenerated) {
      onFlowGenerated(generatedContent)
      toast.success('Fluxo carregado no builder!')
      onClose?.()
    }
  }

  const handleGenerate = () => {
    if (selectedTemplate) {
      generateFlowWithAI(selectedTemplate, businessInfo)
    }
  }

  const handleRegenerate = () => {
    resetGeneration()
    if (selectedTemplate) {
      generateFlowWithAI(selectedTemplate, businessInfo)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Assistente IA para Fluxos de Email
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Crie fluxos completos de email marketing com conteúdo personalizado gerado por inteligência artificial
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Step 1: Template Selection */}
      {currentStep === 1 && (
        <FlowTemplateSelector
          templates={FLOW_TEMPLATES}
          onTemplateSelect={handleTemplateSelect}
        />
      )}

      {/* Step 2: Business Information */}
      {currentStep === 2 && selectedTemplate && (
        <BusinessInfoForm
          businessInfo={businessInfo}
          onBusinessInfoChange={updateBusinessInfo}
          onSubmit={handleBusinessInfoSubmit}
          onBack={() => goToStep(1)}
        />
      )}

      {/* Step 3: Generate and Preview */}
      {currentStep === 3 && selectedTemplate && (
        <FlowPreview
          selectedTemplate={selectedTemplate}
          businessInfo={businessInfo}
          generatedContent={generatedContent}
          isGenerating={generatingFlow}
          onGenerate={handleGenerate}
          onRegenerate={handleRegenerate}
          onUseFlow={handleUseFlow}
          onEditInfo={() => goToStep(2)}
        />
      )}
    </div>
  )
}