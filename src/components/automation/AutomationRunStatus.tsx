'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Play, 
  Pause, 
  RotateCcw,
  AlertCircle,
  Mail,
  Tag,
  Zap,
  RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface AutomationRun {
  id: string
  automation_id: string
  automation_name: string
  lead_id: string
  lead_name: string
  lead_email: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  current_step_index: number
  started_at: string
  completed_at?: string
  error_message?: string
  retry_count: number
  next_execution_at?: string
  execution_data: any
}

interface StepExecution {
  id: string
  step_id: string
  step_type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  executed_at: string
  completed_at?: string
  result_data: any
  error_message?: string
}

interface AutomationRunStatusProps {
  runId: string
  onRefresh?: () => void
}

export default function AutomationRunStatus({ runId, onRefresh }: AutomationRunStatusProps) {
  const [run, setRun] = useState<AutomationRun | null>(null)
  const [stepExecutions, setStepExecutions] = useState<StepExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRunStatus = async () => {
    try {
      const response = await fetch(`/api/automation/execute?run_id=${runId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch run status')
      }

      const data = await response.json()
      setRun(data.run)
      setStepExecutions(data.step_executions || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching run status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch run status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRunStatus()
    
    // Auto-refresh for running automations
    const interval = setInterval(() => {
      if (run?.status === 'running' || run?.status === 'pending') {
        fetchRunStatus()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [runId, run?.status])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <Pause className="h-4 w-4 text-gray-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
      pending: 'secondary',
      running: 'default',
      completed: 'default',
      failed: 'destructive',
      cancelled: 'secondary'
    }

    const labels: { [key: string]: string } = {
      pending: 'Aguardando',
      running: 'Executando',
      completed: 'Concluída',
      failed: 'Falhou',
      cancelled: 'Cancelada'
    }

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {getStatusIcon(status)}
        <span className="ml-2">{labels[status] || status}</span>
      </Badge>
    )
  }

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'tag':
        return <Tag className="h-4 w-4" />
      case 'webhook':
        return <Zap className="h-4 w-4" />
      case 'delay':
        return <Clock className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const calculateProgress = () => {
    if (!run || !stepExecutions.length) return 0
    
    const completedSteps = stepExecutions.filter(step => step.status === 'completed').length
    const totalSteps = stepExecutions.length
    
    return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
  }

  const handleRefresh = () => {
    setLoading(true)
    fetchRunStatus()
    onRefresh?.()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2">Carregando status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-red-500">
            <XCircle className="h-6 w-6" />
            <span className="ml-2">{error}</span>
          </div>
          <div className="mt-4 text-center">
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!run) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Execução não encontrada
          </div>
        </CardContent>
      </Card>
    )
  }

  const progress = calculateProgress()

  return (
    <div className="space-y-6">
      {/* Run Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(run.status)}
              Execução da Automação
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(run.status)}
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Detalhes da Execução</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Automação:</span>
                  <span className="text-sm font-medium">{run.automation_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Lead:</span>
                  <span className="text-sm font-medium">{run.lead_name || run.lead_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Iniciada:</span>
                  <span className="text-sm font-medium">
                    {formatDistanceToNow(new Date(run.started_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>
                {run.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Concluída:</span>
                    <span className="text-sm font-medium">
                      {formatDistanceToNow(new Date(run.completed_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Progresso</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Etapas concluídas</span>
                    <span>{stepExecutions.filter(s => s.status === 'completed').length} / {stepExecutions.length}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                
                {run.retry_count > 0 && (
                  <div className="flex items-center text-sm text-yellow-600">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Tentativas: {run.retry_count}
                  </div>
                )}

                {run.next_execution_at && (
                  <div className="flex items-center text-sm text-blue-600">
                    <Clock className="h-4 w-4 mr-1" />
                    Próxima execução: {formatDistanceToNow(new Date(run.next_execution_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {run.error_message && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center text-red-700">
                <XCircle className="h-4 w-4 mr-2" />
                <span className="font-medium">Erro:</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{run.error_message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step Executions */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Execução</CardTitle>
        </CardHeader>
        <CardContent>
          {stepExecutions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma etapa executada ainda
            </div>
          ) : (
            <div className="space-y-4">
              {stepExecutions.map((step, index) => (
                <div key={step.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getStepIcon(step.step_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">
                        Etapa {index + 1}: {step.step_type}
                      </h4>
                      {getStatusBadge(step.status)}
                    </div>
                    
                    <div className="mt-2 text-sm text-gray-600">
                      Executada: {formatDistanceToNow(new Date(step.executed_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </div>

                    {step.result_data && (
                      <div className="mt-2 text-xs bg-gray-50 p-2 rounded">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(step.result_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {step.error_message && (
                      <div className="mt-2 text-sm text-red-600">
                        Erro: {step.error_message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}