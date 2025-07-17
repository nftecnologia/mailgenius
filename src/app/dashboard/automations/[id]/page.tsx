'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  BarChart3,
  Settings,
  TestTube,
  Clock,
  Users,
  Mail,
  Zap,
  Tag,
  Filter,
  Eye,
  Activity
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import AutomationTester from '@/components/automation/AutomationTester'

interface AutomationFlow {
  id: string
  name: string
  description: string
  trigger_type: string
  trigger_config: any
  flow_definition: {
    steps: any[]
    version: string
  }
  status: 'draft' | 'active' | 'paused' | 'archived'
  created_at: string
  updated_at: string
  workspace_id: string
}

interface AutomationStats {
  total_runs: number
  successful_runs: number
  failed_runs: number
  completion_rate: number
  avg_execution_time: number
  last_run_at?: string
}

interface AutomationDetailPageProps {
  params: {
    id: string
  }
}

export default function AutomationDetailPage({ params }: AutomationDetailPageProps) {
  const [automation, setAutomation] = useState<AutomationFlow | null>(null)
  const [stats, setStats] = useState<AutomationStats | null>(null)
  const [runs, setRuns] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadAutomationDetails()
    loadLeads()
  }, [params.id])

  const loadAutomationDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!member) return

      setWorkspaceId(member.workspace_id)

      // Load automation details
      const { data: automationData, error } = await supabase
        .from('automation_flows')
        .select('*')
        .eq('id', params.id)
        .eq('workspace_id', member.workspace_id)
        .single()

      if (error) {
        toast.error('Erro ao carregar automação')
        return
      }

      setAutomation(automationData)

      // Load automation stats
      await loadAutomationStats(params.id)
      
      // Load recent runs
      await loadRecentRuns(params.id)

    } catch (error) {
      console.error('Error loading automation details:', error)
      toast.error('Erro inesperado ao carregar automação')
    } finally {
      setLoading(false)
    }
  }

  const loadAutomationStats = async (automationId: string) => {
    try {
      const { data: runsData, error } = await supabase
        .from('automation_runs')
        .select('status, started_at, completed_at')
        .eq('automation_id', automationId)

      if (error) {
        console.error('Error loading automation stats:', error)
        return
      }

      const totalRuns = runsData?.length || 0
      const successfulRuns = runsData?.filter(run => run.status === 'completed').length || 0
      const failedRuns = runsData?.filter(run => run.status === 'failed').length || 0
      const completionRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0

      // Calculate average execution time
      const completedRuns = runsData?.filter(run => run.status === 'completed' && run.completed_at) || []
      const avgExecutionTime = completedRuns.length > 0 
        ? completedRuns.reduce((sum, run) => {
            const duration = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
            return sum + duration
          }, 0) / completedRuns.length
        : 0

      const lastRunAt = runsData?.length > 0 
        ? runsData.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0].started_at
        : undefined

      setStats({
        total_runs: totalRuns,
        successful_runs: successfulRuns,
        failed_runs: failedRuns,
        completion_rate: completionRate,
        avg_execution_time: avgExecutionTime,
        last_run_at: lastRunAt
      })
    } catch (error) {
      console.error('Error loading automation stats:', error)
    }
  }

  const loadRecentRuns = async (automationId: string) => {
    try {
      const { data: runsData, error } = await supabase
        .from('automation_runs')
        .select(`
          *,
          leads (name, email)
        `)
        .eq('automation_id', automationId)
        .order('started_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error loading recent runs:', error)
        return
      }

      setRuns(runsData || [])
    } catch (error) {
      console.error('Error loading recent runs:', error)
    }
  }

  const loadLeads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!member) return

      // Load leads for testing
      const { data: leadsData, error } = await supabase
        .from('leads')
        .select('id, name, email, status')
        .eq('workspace_id', member.workspace_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error loading leads:', error)
        return
      }

      setLeads(leadsData || [])
    } catch (error) {
      console.error('Error loading leads:', error)
    }
  }

  const handleToggleStatus = async () => {
    if (!automation) return

    const newStatus = automation.status === 'active' ? 'paused' : 'active'
    setUpdating(true)

    try {
      const { error } = await supabase
        .from('automation_flows')
        .update({ status: newStatus })
        .eq('id', automation.id)

      if (error) {
        toast.error('Erro ao alterar status da automação')
        return
      }

      setAutomation({ ...automation, status: newStatus })
      toast.success(`Automação ${newStatus === 'active' ? 'ativada' : 'pausada'} com sucesso!`)
    } catch (error) {
      console.error('Error toggling automation status:', error)
      toast.error('Erro inesperado ao alterar status')
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!automation) return
    
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return

    try {
      const { error } = await supabase
        .from('automation_flows')
        .delete()
        .eq('id', automation.id)

      if (error) {
        toast.error('Erro ao excluir automação')
        return
      }

      toast.success('Automação excluída com sucesso!')
      router.push('/dashboard/automations')
    } catch (error) {
      console.error('Error deleting automation:', error)
      toast.error('Erro inesperado ao excluir automação')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
      active: 'default',
      paused: 'secondary',
      draft: 'secondary',
      archived: 'destructive',
    }

    const labels: { [key: string]: string } = {
      active: 'Ativa',
      paused: 'Pausada',
      draft: 'Rascunho',
      archived: 'Arquivada',
    }

    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    )
  }

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'trigger':
        return <Zap className="h-4 w-4" />
      case 'condition':
        return <Filter className="h-4 w-4" />
      case 'action':
        return <Play className="h-4 w-4" />
      case 'delay':
        return <Clock className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const getRunStatusBadge = (status: string) => {
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
        {labels[status] || status}
      </Badge>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!automation) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Automação não encontrada</h1>
            <p className="text-gray-600 mb-6">
              A automação que você está procurando não existe ou foi removida.
            </p>
            <Button onClick={() => router.push('/dashboard/automations')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Automações
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{automation.name}</h1>
              <p className="text-gray-600">{automation.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getStatusBadge(automation.status)}
            <Button 
              variant="outline" 
              onClick={handleToggleStatus}
              disabled={updating}
            >
              {automation.status === 'active' ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Ativar
                </>
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push(`/dashboard/automations/builder?edit=${automation.id}`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total de Execuções</p>
                    <p className="text-2xl font-bold">{stats.total_runs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold">{stats.completion_rate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-yellow-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Tempo Médio</p>
                    <p className="text-2xl font-bold">
                      {stats.avg_execution_time > 0 
                        ? `${Math.round(stats.avg_execution_time / 1000)}s` 
                        : '-'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Eye className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Última Execução</p>
                    <p className="text-2xl font-bold">
                      {stats.last_run_at 
                        ? formatDistanceToNow(new Date(stats.last_run_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })
                        : '-'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="runs">Execuções</TabsTrigger>
            <TabsTrigger value="test">Testar</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Flow Steps */}
            <Card>
              <CardHeader>
                <CardTitle>Fluxo da Automação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {automation.flow_definition?.steps?.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        {getStepIcon(step.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{step.name}</h4>
                          <Badge variant="outline">{step.type}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{step.description}</p>
                      </div>
                      <div className="text-sm text-gray-500">
                        Etapa {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trigger Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Configuração do Trigger</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Tipo:</span>
                    <Badge variant="outline" className="ml-2">
                      {automation.trigger_type}
                    </Badge>
                  </div>
                  {automation.trigger_config && Object.keys(automation.trigger_config).length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Configurações:</span>
                      <pre className="mt-2 text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                        {JSON.stringify(automation.trigger_config, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Execuções Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhuma execução encontrada
                  </div>
                ) : (
                  <div className="space-y-4">
                    {runs.map((run) => (
                      <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-medium">
                              {run.leads?.name || run.leads?.email || 'Lead não encontrado'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDistanceToNow(new Date(run.started_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getRunStatusBadge(run.status)}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => router.push(`/dashboard/automations/runs/${run.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            <AutomationTester
              automationId={automation.id}
              automationName={automation.name}
              leads={leads}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações da Automação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Nome:</span>
                    <p className="text-sm text-gray-900 mt-1">{automation.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Descrição:</span>
                    <p className="text-sm text-gray-900 mt-1">{automation.description || 'Sem descrição'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Status:</span>
                    <div className="mt-1">{getStatusBadge(automation.status)}</div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Criada em:</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatDistanceToNow(new Date(automation.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Última atualização:</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatDistanceToNow(new Date(automation.updated_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}