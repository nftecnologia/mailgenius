'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, 
  X, 
  GitBranch, 
  Check, 
  AlertCircle,
  ArrowRight,
  Settings
} from 'lucide-react'
import { BranchingStep, AdvancedCondition } from '@/lib/automation/advanced-conditions'
import AdvancedConditionBuilder from './AdvancedConditionBuilder'

interface BranchingStepBuilderProps {
  step: BranchingStep
  onChange: (step: BranchingStep) => void
  availableSteps: { id: string; name: string; type: string }[]
  className?: string
}

export default function BranchingStepBuilder({ 
  step, 
  onChange, 
  availableSteps,
  className = '' 
}: BranchingStepBuilderProps) {
  const [activeTab, setActiveTab] = useState<'conditions' | 'branches'>('conditions')

  const updateStep = (updates: Partial<BranchingStep>) => {
    onChange({ ...step, ...updates })
  }

  const updateConfig = (updates: Partial<BranchingStep['config']>) => {
    updateStep({
      config: { ...step.config, ...updates }
    })
  }

  const updateConditions = (conditions: AdvancedCondition[]) => {
    updateConfig({ conditions })
  }

  const addBranch = () => {
    const newBranch = {
      id: Math.random().toString(36).substring(2, 15),
      name: `Branch ${step.config.branches.length + 1}`,
      condition_result: step.config.branches.length === 0, // First branch is "true", second is "false"
      next_steps: []
    }

    updateConfig({
      branches: [...step.config.branches, newBranch]
    })
  }

  const updateBranch = (branchId: string, updates: Partial<typeof step.config.branches[0]>) => {
    const updatedBranches = step.config.branches.map(branch => 
      branch.id === branchId ? { ...branch, ...updates } : branch
    )
    updateConfig({ branches: updatedBranches })
  }

  const removeBranch = (branchId: string) => {
    const updatedBranches = step.config.branches.filter(branch => branch.id !== branchId)
    updateConfig({ branches: updatedBranches })
  }

  const addStepToBranch = (branchId: string, stepId: string) => {
    const updatedBranches = step.config.branches.map(branch => {
      if (branch.id === branchId) {
        return {
          ...branch,
          next_steps: [...branch.next_steps, stepId]
        }
      }
      return branch
    })
    updateConfig({ branches: updatedBranches })
  }

  const removeStepFromBranch = (branchId: string, stepId: string) => {
    const updatedBranches = step.config.branches.map(branch => {
      if (branch.id === branchId) {
        return {
          ...branch,
          next_steps: branch.next_steps.filter(id => id !== stepId)
        }
      }
      return branch
    })
    updateConfig({ branches: updatedBranches })
  }

  const getStepName = (stepId: string) => {
    const availableStep = availableSteps.find(s => s.id === stepId)
    return availableStep ? availableStep.name : stepId
  }

  const getStepType = (stepId: string) => {
    const availableStep = availableSteps.find(s => s.id === stepId)
    return availableStep ? availableStep.type : 'unknown'
  }

  const getStepTypeIcon = (type: string) => {
    switch (type) {
      case 'action':
        return <Settings className="h-4 w-4" />
      case 'condition':
        return <AlertCircle className="h-4 w-4" />
      case 'delay':
        return <Settings className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-purple-500" />
        <div>
          <h3 className="font-medium">Passo de Branching</h3>
          <p className="text-sm text-gray-600">
            Crie diferentes caminhos baseados em condições
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="step-name">Nome do Passo</Label>
            <Input
              id="step-name"
              value={step.name}
              onChange={(e) => updateStep({ name: e.target.value })}
              placeholder="Ex: Verificar tipo de lead"
            />
          </div>
          <div>
            <Label htmlFor="step-description">Descrição</Label>
            <Input
              id="step-description"
              value={step.description}
              onChange={(e) => updateStep({ description: e.target.value })}
              placeholder="Descreva o que este passo faz"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('conditions')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'conditions'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Condições
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'branches'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Ramificações
        </button>
      </div>

      {/* Conditions Tab */}
      {activeTab === 'conditions' && (
        <Card>
          <CardHeader>
            <CardTitle>Condições de Branching</CardTitle>
            <p className="text-sm text-gray-600">
              Configure as condições que determinarão qual caminho seguir
            </p>
          </CardHeader>
          <CardContent>
            <AdvancedConditionBuilder
              conditions={step.config.conditions}
              onChange={updateConditions}
            />
          </CardContent>
        </Card>
      )}

      {/* Branches Tab */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Ramificações</h4>
              <p className="text-sm text-gray-600">
                Configure os caminhos para cada resultado da condição
              </p>
            </div>
            <Button 
              onClick={addBranch}
              disabled={step.config.branches.length >= 2}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Ramificação
            </Button>
          </div>

          {step.config.branches.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Nenhuma ramificação configurada</p>
                <Button onClick={addBranch}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeira Ramificação
                </Button>
              </CardContent>
            </Card>
          )}

          {step.config.branches.map((branch, index) => (
            <Card key={branch.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {branch.condition_result ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <h5 className="font-medium">
                        {branch.condition_result ? 'Condição Verdadeira' : 'Condição Falsa'}
                      </h5>
                      <p className="text-sm text-gray-600">
                        Executado quando a condição é {branch.condition_result ? 'atendida' : 'não atendida'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={branch.condition_result ? 'default' : 'secondary'}>
                      {branch.condition_result ? 'TRUE' : 'FALSE'}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeBranch(branch.id)}
                      disabled={step.config.branches.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`branch-name-${branch.id}`}>Nome da Ramificação</Label>
                    <Input
                      id={`branch-name-${branch.id}`}
                      value={branch.name}
                      onChange={(e) => updateBranch(branch.id, { name: e.target.value })}
                      placeholder="Ex: Lead Premium"
                    />
                  </div>

                  <div>
                    <Label>Próximos Passos</Label>
                    <div className="space-y-2 mt-2">
                      {branch.next_steps.map((stepId, stepIndex) => (
                        <div key={stepId} className="flex items-center gap-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            {getStepTypeIcon(getStepType(stepId))}
                            {getStepName(stepId)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStepFromBranch(branch.id, stepId)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      
                      <Select onValueChange={(stepId) => addStepToBranch(branch.id, stepId)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Adicionar próximo passo" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSteps
                            .filter(s => !branch.next_steps.includes(s.id))
                            .map(availableStep => (
                              <SelectItem key={availableStep.id} value={availableStep.id}>
                                <div className="flex items-center gap-2">
                                  {getStepTypeIcon(availableStep.type)}
                                  <span>{availableStep.name}</span>
                                  <Badge variant="outline">{availableStep.type}</Badge>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {step.config.branches.length > 0 && (
            <Card className="bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ArrowRight className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-blue-900">Como funciona</h5>
                    <p className="text-sm text-blue-700">
                      As condições serão avaliadas e apenas uma ramificação será executada. 
                      Se a condição for verdadeira, executa a ramificação "TRUE", 
                      caso contrário, executa a ramificação "FALSE".
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}