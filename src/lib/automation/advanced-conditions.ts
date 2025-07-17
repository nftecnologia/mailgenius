import { createSupabaseClient } from '@/lib/supabase'

// Types for advanced conditions
export interface AdvancedCondition {
  id: string
  type: 'simple' | 'group'
  operator?: 'and' | 'or'
  conditions?: AdvancedCondition[]
  field?: string
  comparison?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in'
  value?: any
  case_sensitive?: boolean
}

export interface BranchingStep {
  id: string
  type: 'branching'
  name: string
  description: string
  config: {
    conditions: AdvancedCondition[]
    branches: {
      id: string
      name: string
      condition_result: boolean // true for when condition passes, false for when it fails
      next_steps: string[] // IDs of next steps to execute
    }[]
  }
}

export interface ExecutionContext {
  lead: any
  automation: any
  run: any
  variables: Record<string, any>
  workspace_id: string
}

export class AdvancedConditionEngine {
  private supabase = createSupabaseClient()

  // Main method to evaluate advanced conditions
  async evaluateConditions(conditions: AdvancedCondition[], context: ExecutionContext): Promise<boolean> {
    if (!conditions || conditions.length === 0) {
      return true
    }

    if (conditions.length === 1) {
      return await this.evaluateCondition(conditions[0], context)
    }

    // For multiple conditions, default to AND logic
    const results = await Promise.all(
      conditions.map(condition => this.evaluateCondition(condition, context))
    )

    return results.every(result => result)
  }

  // Evaluate a single condition (simple or group)
  private async evaluateCondition(condition: AdvancedCondition, context: ExecutionContext): Promise<boolean> {
    if (condition.type === 'simple') {
      return await this.evaluateSimpleCondition(condition, context)
    } else if (condition.type === 'group') {
      return await this.evaluateGroupCondition(condition, context)
    }

    return false
  }

  // Evaluate a simple condition
  private async evaluateSimpleCondition(condition: AdvancedCondition, context: ExecutionContext): Promise<boolean> {
    const { field, comparison, value, case_sensitive = false } = condition
    if (!field || !comparison) return false

    const actualValue = this.getFieldValue(field, context)
    
    switch (comparison) {
      case 'equals':
        return this.compareValues(actualValue, value, case_sensitive, 'equals')
      
      case 'not_equals':
        return !this.compareValues(actualValue, value, case_sensitive, 'equals')
      
      case 'contains':
        return this.compareValues(actualValue, value, case_sensitive, 'contains')
      
      case 'not_contains':
        return !this.compareValues(actualValue, value, case_sensitive, 'contains')
      
      case 'greater_than':
        return Number(actualValue) > Number(value)
      
      case 'less_than':
        return Number(actualValue) < Number(value)
      
      case 'is_empty':
        return this.isEmpty(actualValue)
      
      case 'is_not_empty':
        return !this.isEmpty(actualValue)
      
      case 'in':
        const inValues = Array.isArray(value) ? value : [value]
        return inValues.some(v => this.compareValues(actualValue, v, case_sensitive, 'equals'))
      
      case 'not_in':
        const notInValues = Array.isArray(value) ? value : [value]
        return !notInValues.some(v => this.compareValues(actualValue, v, case_sensitive, 'equals'))
      
      default:
        return false
    }
  }

  // Evaluate a group condition with AND/OR logic
  private async evaluateGroupCondition(condition: AdvancedCondition, context: ExecutionContext): Promise<boolean> {
    const { operator = 'and', conditions = [] } = condition
    
    if (conditions.length === 0) return true

    const results = await Promise.all(
      conditions.map(subCondition => this.evaluateCondition(subCondition, context))
    )

    if (operator === 'and') {
      return results.every(result => result)
    } else if (operator === 'or') {
      return results.some(result => result)
    }

    return false
  }

  // Get field value from context
  private getFieldValue(field: string, context: ExecutionContext): any {
    const { lead, variables } = context
    
    // Support dot notation for nested fields
    const fieldParts = field.split('.')
    
    // Try to get from lead first
    if (fieldParts[0] === 'lead' && fieldParts.length > 1) {
      return this.getNestedValue(lead, fieldParts.slice(1))
    }
    
    // Try to get from variables
    if (fieldParts[0] === 'variables' && fieldParts.length > 1) {
      return this.getNestedValue(variables, fieldParts.slice(1))
    }
    
    // Default to lead field
    return this.getNestedValue(lead, fieldParts)
  }

  // Get nested value from object
  private getNestedValue(obj: any, path: string[]): any {
    return path.reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  // Compare two values with various options
  private compareValues(actual: any, expected: any, caseSensitive: boolean, type: 'equals' | 'contains'): boolean {
    if (actual === undefined || actual === null) {
      return expected === undefined || expected === null
    }

    const actualStr = String(actual)
    const expectedStr = String(expected)

    const actualValue = caseSensitive ? actualStr : actualStr.toLowerCase()
    const expectedValue = caseSensitive ? expectedStr : expectedStr.toLowerCase()

    if (type === 'equals') {
      return actualValue === expectedValue
    } else if (type === 'contains') {
      return actualValue.includes(expectedValue)
    }

    return false
  }

  // Check if value is empty
  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  }

  // Execute branching step
  async executeBranchingStep(step: BranchingStep, context: ExecutionContext): Promise<{
    success: boolean
    nextSteps: string[]
    data?: any
  }> {
    try {
      const { conditions, branches } = step.config
      
      // Evaluate conditions
      const conditionResult = await this.evaluateConditions(conditions, context)
      
      // Find matching branch
      const matchingBranch = branches.find(branch => branch.condition_result === conditionResult)
      
      if (!matchingBranch) {
        // No matching branch found - this is an error in configuration
        return {
          success: false,
          nextSteps: [],
          data: { error: 'No matching branch found for condition result' }
        }
      }

      return {
        success: true,
        nextSteps: matchingBranch.next_steps,
        data: {
          condition_result: conditionResult,
          branch_taken: matchingBranch.id,
          branch_name: matchingBranch.name
        }
      }
    } catch (error) {
      console.error('Error executing branching step:', error)
      return {
        success: false,
        nextSteps: [],
        data: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }
}

// Predefined field options for UI
export const AVAILABLE_FIELDS = [
  { value: 'lead.name', label: 'Nome do Lead', type: 'string' },
  { value: 'lead.email', label: 'Email do Lead', type: 'string' },
  { value: 'lead.company', label: 'Empresa do Lead', type: 'string' },
  { value: 'lead.phone', label: 'Telefone do Lead', type: 'string' },
  { value: 'lead.source', label: 'Fonte do Lead', type: 'string' },
  { value: 'lead.status', label: 'Status do Lead', type: 'string' },
  { value: 'lead.tags', label: 'Tags do Lead', type: 'array' },
  { value: 'lead.created_at', label: 'Data de Criação', type: 'date' },
  { value: 'lead.updated_at', label: 'Data de Atualização', type: 'date' },
  { value: 'variables.trigger', label: 'Trigger Type', type: 'string' },
  { value: 'variables.timestamp', label: 'Timestamp', type: 'date' },
]

// Predefined comparison options for UI
export const COMPARISON_OPTIONS = [
  { value: 'equals', label: 'É igual a', types: ['string', 'number', 'date'] },
  { value: 'not_equals', label: 'Não é igual a', types: ['string', 'number', 'date'] },
  { value: 'contains', label: 'Contém', types: ['string', 'array'] },
  { value: 'not_contains', label: 'Não contém', types: ['string', 'array'] },
  { value: 'greater_than', label: 'Maior que', types: ['number', 'date'] },
  { value: 'less_than', label: 'Menor que', types: ['number', 'date'] },
  { value: 'is_empty', label: 'Está vazio', types: ['string', 'array'] },
  { value: 'is_not_empty', label: 'Não está vazio', types: ['string', 'array'] },
  { value: 'in', label: 'Está em', types: ['string', 'number'] },
  { value: 'not_in', label: 'Não está em', types: ['string', 'number'] },
]

export const advancedConditionEngine = new AdvancedConditionEngine()