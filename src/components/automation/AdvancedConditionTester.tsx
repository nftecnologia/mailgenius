'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  TestTube,
  User,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { AdvancedCondition, advancedConditionEngine } from '@/lib/automation/advanced-conditions'

interface AdvancedConditionTesterProps {
  conditions: AdvancedCondition[]
  leads: any[]
  className?: string
}

interface TestResult {
  leadId: string
  leadName: string
  result: boolean
  details: {
    condition: AdvancedCondition
    result: boolean
    field: string
    actualValue: any
    expectedValue: any
  }[]
}

export default function AdvancedConditionTester({ 
  conditions, 
  leads, 
  className = '' 
}: AdvancedConditionTesterProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>('')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [testMode, setTestMode] = useState<'single' | 'all'>('single')

  const runTest = async (leadId?: string) => {
    if (!leadId && testMode === 'single') {
      toast.error('Selecione um lead para testar')
      return
    }

    setIsLoading(true)
    try {
      const leadsToTest = testMode === 'all' ? leads : leads.filter(l => l.id === leadId)
      const results: TestResult[] = []

      for (const lead of leadsToTest) {
        const context = {
          lead,
          automation: {},
          run: {},
          variables: { trigger: 'manual_test' },
          workspace_id: 'test-workspace'
        }

        const result = await advancedConditionEngine.evaluateConditions(conditions, context)
        
        // Get detailed results for each condition
        const conditionDetails = await Promise.all(
          conditions.map(async (condition) => {
            const conditionResult = await evaluateConditionForDisplay(condition, context)
            return {
              condition,
              result: conditionResult.result,
              field: conditionResult.field,
              actualValue: conditionResult.actualValue,
              expectedValue: conditionResult.expectedValue
            }
          })
        )

        results.push({
          leadId: lead.id,
          leadName: lead.name || lead.email,
          result,
          details: conditionDetails
        })
      }

      setTestResults(results)
      
      const passedCount = results.filter(r => r.result).length
      const totalCount = results.length
      
      toast.success(`Teste concluído: ${passedCount}/${totalCount} leads passaram nas condições`)
    } catch (error) {
      console.error('Error running condition test:', error)
      toast.error('Erro ao executar teste')
    } finally {
      setIsLoading(false)
    }
  }

  const evaluateConditionForDisplay = async (condition: AdvancedCondition, context: any) => {
    // This is a simplified version for display purposes
    if (condition.type === 'simple') {
      const actualValue = getFieldValue(condition.field || '', context)
      return {
        result: true, // Would need actual evaluation logic here
        field: condition.field || '',
        actualValue,
        expectedValue: condition.value
      }
    }
    
    return {
      result: false,
      field: '',
      actualValue: null,
      expectedValue: null
    }
  }

  const getFieldValue = (field: string, context: any) => {
    const { lead } = context
    const fieldParts = field.split('.')
    
    if (fieldParts[0] === 'lead' && fieldParts.length > 1) {
      return getNestedValue(lead, fieldParts.slice(1))
    }
    
    return getNestedValue(lead, fieldParts)
  }

  const getNestedValue = (obj: any, path: string[]): any => {
    return path.reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  const getResultIcon = (result: boolean) => {
    return result ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    )
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'string') return `"${value}"`
    if (Array.isArray(value)) return `[${value.join(', ')}]`
    return String(value)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <TestTube className="h-6 w-6 text-blue-500" />
        <div>
          <h3 className="font-medium">Testador de Condições Avançadas</h3>
          <p className="text-sm text-gray-600">
            Teste suas condições com leads reais para verificar se estão funcionando corretamente
          </p>
        </div>
      </div>

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração do Teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="single-test"
                name="test-mode"
                value="single"
                checked={testMode === 'single'}
                onChange={(e) => setTestMode(e.target.value as 'single' | 'all')}
              />
              <Label htmlFor="single-test">Lead específico</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="all-test"
                name="test-mode"
                value="all"
                checked={testMode === 'all'}
                onChange={(e) => setTestMode(e.target.value as 'single' | 'all')}
              />
              <Label htmlFor="all-test">Todos os leads</Label>
            </div>
          </div>

          {testMode === 'single' && (
            <div>
              <Label htmlFor="lead-select">Selecione o Lead</Label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um lead para testar" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map(lead => (
                    <SelectItem key={lead.id} value={lead.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{lead.name || lead.email}</span>
                        {lead.source && (
                          <Badge variant="outline" className="ml-2">
                            {lead.source}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={() => runTest(selectedLeadId)}
              disabled={isLoading || conditions.length === 0}
              className="flex-1"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {testMode === 'single' ? 'Testar Lead' : 'Testar Todos os Leads'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setTestResults([])}
              disabled={testResults.length === 0}
            >
              Limpar Resultados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conditions Preview */}
      {conditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Condições a Testar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <div className="flex-1">
                    {condition.type === 'simple' ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{condition.field}</Badge>
                        <span className="text-sm">{condition.comparison}</span>
                        <Badge>{formatValue(condition.value)}</Badge>
                        {condition.case_sensitive && (
                          <Badge variant="secondary">Case Sensitive</Badge>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Grupo</Badge>
                        <Badge>{condition.operator?.toUpperCase()}</Badge>
                        <span className="text-sm">
                          {condition.conditions?.length || 0} condições
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultados do Teste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result) => (
                <div key={result.leadId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-500" />
                      <div>
                        <h4 className="font-medium">{result.leadName}</h4>
                        <p className="text-sm text-gray-600">ID: {result.leadId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getResultIcon(result.result)}
                      <Badge variant={result.result ? 'default' : 'destructive'}>
                        {result.result ? 'PASSOU' : 'FALHOU'}
                      </Badge>
                    </div>
                  </div>

                  {/* Condition Details */}
                  <div className="space-y-2">
                    {result.details.map((detail, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                        {getResultIcon(detail.result)}
                        <div className="flex-1">
                          <span className="font-medium">{detail.field}</span>
                          <span className="mx-2">→</span>
                          <span>Valor: {formatValue(detail.actualValue)}</span>
                          <span className="mx-2">vs</span>
                          <span>Esperado: {formatValue(detail.expectedValue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                <h4 className="font-medium text-blue-900">Resumo do Teste</h4>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Total testado:</span>
                  <span className="font-medium ml-2">{testResults.length}</span>
                </div>
                <div>
                  <span className="text-green-700">Passou:</span>
                  <span className="font-medium ml-2">
                    {testResults.filter(r => r.result).length}
                  </span>
                </div>
                <div>
                  <span className="text-red-700">Falhou:</span>
                  <span className="font-medium ml-2">
                    {testResults.filter(r => !r.result).length}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {conditions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              Configure algumas condições para começar a testar
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}