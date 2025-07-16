export interface FlowTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: any
  color: string
  estimatedEmails: number
  duration: string
  useCase: string
  steps: FlowStepTemplate[]
}

export interface FlowStepTemplate {
  type: 'trigger' | 'delay' | 'email' | 'condition'
  name: string
  delay?: {
    amount: number
    unit: string
  }
  emailTemplate?: {
    subject: string
    tone: string
    keyPoints: string[]
  }
}

export interface BusinessInfo {
  industry: string
  productType: string
  targetAudience: string
  businessGoal: string
  tone: string
  companyName: string
}

export interface GeneratedFlow {
  name: string
  description: string
  steps: GeneratedFlowStep[]
}

export interface GeneratedFlowStep {
  id: string
  type: 'trigger' | 'delay' | 'email' | 'condition'
  name: string
  config: {
    subject?: string
    template_id?: string
    from_name?: string
    content?: string
    tone?: string
    wait_amount?: number
    wait_unit?: string
    description?: string
  }
}

export interface AIFlowGeneratorProps {
  onFlowGenerated?: (flow: GeneratedFlow) => void
  onClose?: () => void
}