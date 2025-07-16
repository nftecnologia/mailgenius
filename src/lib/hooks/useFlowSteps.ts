import { useState } from 'react'
import { toast } from 'sonner'
import { FlowTemplate, BusinessInfo } from '@/lib/types/flow-types'

export function useFlowSteps() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null)
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    industry: '',
    productType: '',
    targetAudience: '',
    businessGoal: '',
    tone: 'profissional',
    companyName: ''
  })

  const handleTemplateSelect = (template: FlowTemplate) => {
    setSelectedTemplate(template)
    setCurrentStep(2)
  }

  const handleBusinessInfoSubmit = () => {
    if (!businessInfo.industry || !businessInfo.targetAudience) {
      toast.error('Preencha pelo menos o setor e público-alvo')
      return false
    }
    setCurrentStep(3)
    return true
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

  const resetSteps = () => {
    setCurrentStep(1)
    setSelectedTemplate(null)
    setBusinessInfo({
      industry: '',
      productType: '',
      targetAudience: '',
      businessGoal: '',
      tone: 'profissional',
      companyName: ''
    })
  }

  const updateBusinessInfo = (updates: Partial<BusinessInfo>) => {
    setBusinessInfo(prev => ({ ...prev, ...updates }))
  }

  return {
    currentStep,
    selectedTemplate,
    businessInfo,
    handleTemplateSelect,
    handleBusinessInfoSubmit,
    goToStep,
    resetSteps,
    updateBusinessInfo
  }
}