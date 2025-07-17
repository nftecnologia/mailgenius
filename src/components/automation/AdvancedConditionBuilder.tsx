'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  Plus, 
  X, 
  Filter, 
  ChevronDown, 
  ChevronRight,
  Parentheses,
  Zap
} from 'lucide-react'
import { AdvancedCondition, AVAILABLE_FIELDS, COMPARISON_OPTIONS } from '@/lib/automation/advanced-conditions'

interface AdvancedConditionBuilderProps {
  conditions: AdvancedCondition[]
  onChange: (conditions: AdvancedCondition[]) => void
  className?: string
}

export default function AdvancedConditionBuilder({ 
  conditions, 
  onChange, 
  className = '' 
}: AdvancedConditionBuilderProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const generateId = () => Math.random().toString(36).substring(2, 15)

  const addCondition = (parentId?: string) => {
    const newCondition: AdvancedCondition = {
      id: generateId(),
      type: 'simple',
      field: 'lead.name',
      comparison: 'equals',
      value: '',
      case_sensitive: false
    }

    if (parentId) {
      // Add to group
      const updatedConditions = updateConditionInGroup(conditions, parentId, (group) => ({
        ...group,
        conditions: [...(group.conditions || []), newCondition]
      }))
      onChange(updatedConditions)
    } else {
      // Add to root
      onChange([...conditions, newCondition])
    }
  }

  const addGroup = (parentId?: string) => {
    const newGroup: AdvancedCondition = {
      id: generateId(),
      type: 'group',
      operator: 'and',
      conditions: []
    }

    if (parentId) {
      // Add to parent group
      const updatedConditions = updateConditionInGroup(conditions, parentId, (group) => ({
        ...group,
        conditions: [...(group.conditions || []), newGroup]
      }))
      onChange(updatedConditions)
    } else {
      // Add to root
      onChange([...conditions, newGroup])
    }
  }

  const updateCondition = (id: string, updates: Partial<AdvancedCondition>) => {
    const updatedConditions = updateConditionInGroup(conditions, id, (condition) => ({
      ...condition,
      ...updates
    }))
    onChange(updatedConditions)
  }

  const removeCondition = (id: string) => {
    const updatedConditions = removeConditionFromGroup(conditions, id)
    onChange(updatedConditions)
  }

  const updateConditionInGroup = (
    items: AdvancedCondition[], 
    targetId: string, 
    updateFn: (item: AdvancedCondition) => AdvancedCondition
  ): AdvancedCondition[] => {
    return items.map(item => {
      if (item.id === targetId) {
        return updateFn(item)
      }
      
      if (item.type === 'group' && item.conditions) {
        return {
          ...item,
          conditions: updateConditionInGroup(item.conditions, targetId, updateFn)
        }
      }
      
      return item
    })
  }

  const removeConditionFromGroup = (items: AdvancedCondition[], targetId: string): AdvancedCondition[] => {
    return items.filter(item => {
      if (item.id === targetId) {
        return false
      }
      
      if (item.type === 'group' && item.conditions) {
        return {
          ...item,
          conditions: removeConditionFromGroup(item.conditions, targetId)
        }
      }
      
      return true
    }).map(item => {
      if (item.type === 'group' && item.conditions) {
        return {
          ...item,
          conditions: removeConditionFromGroup(item.conditions, targetId)
        }
      }
      return item
    })
  }

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  const renderCondition = (condition: AdvancedCondition, depth: number = 0) => {
    const isExpanded = expandedGroups.has(condition.id)
    
    if (condition.type === 'group') {
      return (
        <div key={condition.id} className={`ml-${depth * 4} mb-4`}>
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => toggleGroupExpansion(condition.id)}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  <Parentheses className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Grupo de Condições</span>
                  <Badge variant="outline">
                    {condition.operator?.toUpperCase() || 'AND'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={condition.operator || 'and'}
                    onValueChange={(value) => updateCondition(condition.id, { operator: value as 'and' | 'or' })}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">AND</SelectItem>
                      <SelectItem value="or">OR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeCondition(condition.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent>
                <div className="space-y-3">
                  {condition.conditions?.map(subCondition => renderCondition(subCondition, depth + 1))}
                  
                  <div className="flex gap-2 pt-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addCondition(condition.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Condição
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addGroup(condition.id)}
                    >
                      <Parentheses className="h-4 w-4 mr-1" />
                      Grupo
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )
    }

    // Simple condition
    const selectedField = AVAILABLE_FIELDS.find(f => f.value === condition.field)
    const availableComparisons = COMPARISON_OPTIONS.filter(comp => 
      comp.types.includes(selectedField?.type || 'string')
    )

    return (
      <div key={condition.id} className={`ml-${depth * 4} mb-3`}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-gray-500" />
              
              {/* Field selector */}
              <div className="flex-1">
                <Select
                  value={condition.field || ''}
                  onValueChange={(value) => updateCondition(condition.id, { field: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FIELDS.map(field => (
                      <SelectItem key={field.value} value={field.value}>
                        <div className="flex items-center justify-between w-full">
                          <span>{field.label}</span>
                          <Badge variant="outline" className="ml-2">
                            {field.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Comparison operator */}
              <div className="flex-1">
                <Select
                  value={condition.comparison || ''}
                  onValueChange={(value) => updateCondition(condition.id, { comparison: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Comparação" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableComparisons.map(comp => (
                      <SelectItem key={comp.value} value={comp.value}>
                        {comp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Value input */}
              {condition.comparison !== 'is_empty' && condition.comparison !== 'is_not_empty' && (
                <div className="flex-1">
                  <Input
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                    placeholder="Valor"
                  />
                </div>
              )}

              {/* Case sensitive toggle */}
              {selectedField?.type === 'string' && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={condition.case_sensitive || false}
                    onCheckedChange={(checked) => updateCondition(condition.id, { case_sensitive: checked })}
                  />
                  <Label className="text-xs">Aa</Label>
                </div>
              )}

              {/* Remove button */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => removeCondition(condition.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          <h3 className="font-medium">Condições Avançadas</h3>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => addCondition()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Condição
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => addGroup()}
          >
            <Parentheses className="h-4 w-4 mr-1" />
            Grupo
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {conditions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Nenhuma condição configurada</p>
              <Button onClick={() => addCondition()}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeira Condição
              </Button>
            </CardContent>
          </Card>
        ) : (
          conditions.map(condition => renderCondition(condition))
        )}
      </div>

      {conditions.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Lógica:</strong> {conditions.length > 1 ? 'Todas as condições (AND)' : 'Condição única'}
          </p>
        </div>
      )}
    </div>
  )
}