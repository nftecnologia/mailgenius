'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Users,
  Mail,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'
import AutomationRunStatus from './AutomationRunStatus'

interface AutomationTesterProps {
  automationId: string
  automationName: string
  leads?: Array<{
    id: string
    name: string
    email: string
    status: string
  }>
}

export default function AutomationTester({ automationId, automationName, leads = [] }: AutomationTesterProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>('')
  const [customTriggerData, setCustomTriggerData] = useState<string>('{}')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    run?: any
    error?: string
  } | null>(null)
  const [showRunStatus, setShowRunStatus] = useState(false)

  const executeTest = async () => {
    if (!selectedLeadId) {
      toast.error('Selecione um lead para testar')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      // Parse trigger data
      let triggerData = {}
      if (customTriggerData.trim()) {
        try {
          triggerData = JSON.parse(customTriggerData)
        } catch (error) {
          throw new Error('Dados de trigger inválidos (JSON)')
        }
      }

      const response = await fetch('/api/automation/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          automation_id: automationId,
          lead_id: selectedLeadId,
          trigger_data: triggerData
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao executar automação')
      }

      const result = await response.json()
      
      setTestResult({
        success: true,
        run: result.run
      })

      toast.success('Automação executada com sucesso!')
      
      // Auto-show run status
      setShowRunStatus(true)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      setTestResult({
        success: false,
        error: errorMessage
      })

      toast.error(errorMessage)
    } finally {
      setTesting(false)
    }
  }

  const selectedLead = leads.find(lead => lead.id === selectedLeadId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-500" />
            Testar Automação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Automation Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Automação Selecionada</h4>
            <p className="text-blue-700">{automationName}</p>
            <Badge variant="outline" className="mt-2">
              ID: {automationId}
            </Badge>
          </div>

          {/* Lead Selection */}
          <div className="space-y-3">
            <Label>Lead para Teste</Label>
            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map(lead => (
                  <SelectItem key={lead.id} value={lead.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{lead.name || lead.email}</span>
                      <Badge variant="outline" className="text-xs">
                        {lead.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedLead && (
              <div className="text-sm text-gray-600">
                <strong>Email:</strong> {selectedLead.email}
              </div>
            )}
          </div>

          {/* Custom Trigger Data */}
          <div className="space-y-3">
            <Label>Dados de Trigger (JSON)</Label>
            <Textarea
              value={customTriggerData}
              onChange={(e) => setCustomTriggerData(e.target.value)}
              placeholder='{"custom_field": "value", "source": "test"}'
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              Opcional: Dados customizados para simular diferentes cenários de trigger
            </p>
          </div>

          {/* Test Button */}
          <Button 
            onClick={executeTest}
            disabled={testing || !selectedLeadId}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executando Teste...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Teste
              </>
            )}
          </Button>

          {/* Test Result */}
          {testResult && (
            <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                  {testResult.success ? (
                    <div>
                      <strong>Teste executado com sucesso!</strong>
                      <div className="mt-2 text-sm">
                        <strong>ID da Execução:</strong> {testResult.run?.id}
                      </div>
                      <div className="mt-1 text-sm">
                        <strong>Status:</strong> {testResult.run?.status}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <strong>Erro no teste:</strong> {testResult.error}
                    </div>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* View Run Status Button */}
          {testResult?.success && testResult.run && (
            <Button 
              onClick={() => setShowRunStatus(!showRunStatus)}
              variant="outline"
              className="w-full"
            >
              <Eye className="h-4 w-4 mr-2" />
              {showRunStatus ? 'Ocultar Status' : 'Ver Status da Execução'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Run Status */}
      {showRunStatus && testResult?.success && testResult.run && (
        <AutomationRunStatus 
          runId={testResult.run.id}
          onRefresh={() => {
            // Callback opcional para refresh
          }}
        />
      )}

      {/* Testing Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Dicas de Teste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Leads de Teste:</strong> Use leads com dados reais para testar templates e condições
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Dados Customizados:</strong> Use o campo JSON para simular diferentes cenários
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Monitoramento:</strong> Acompanhe o status da execução em tempo real
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Emails:</strong> Emails de teste são enviados normalmente - use leads internos
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}