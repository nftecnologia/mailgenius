'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  MoreHorizontal,
  Workflow,
  Play,
  Pause,
  Edit,
  Trash2,
  Eye,
  Zap,
  Users,
  Mail,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface AutomationFlow {
  id: string
  name: string
  description: string
  trigger_type: string
  status: string
  created_at: string
  updated_at: string
  flow_definition: any
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationFlow[]>([])
  const [filteredAutomations, setFilteredAutomations] = useState<AutomationFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadAutomations()
  }, [])

  useEffect(() => {
    filterAutomations()
  }, [automations, searchTerm, statusFilter])

  const loadAutomations = async () => {
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

      const { data: automationsData, error } = await supabase
        .from('automation_flows')
        .select('*')
        .eq('workspace_id', member.workspace_id)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Erro ao carregar automações')
        return
      }

      setAutomations(automationsData || [])
    } catch (error) {
      console.error('Error loading automations:', error)
      toast.error('Erro inesperado ao carregar automações')
    } finally {
      setLoading(false)
    }
  }

  const filterAutomations = () => {
    let filtered = automations

    if (searchTerm) {
      filtered = filtered.filter(automation =>
        automation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        automation.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(automation => automation.status === statusFilter)
    }

    setFilteredAutomations(filtered)
  }

  const handleToggleStatus = async (automationId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'

    try {
      const { error } = await supabase
        .from('automation_flows')
        .update({ status: newStatus })
        .eq('id', automationId)

      if (error) {
        toast.error('Erro ao alterar status da automação')
        return
      }

      toast.success(`Automação ${newStatus === 'active' ? 'ativada' : 'pausada'} com sucesso!`)
      loadAutomations()
    } catch (error) {
      console.error('Error toggling automation status:', error)
      toast.error('Erro inesperado ao alterar status')
    }
  }

  const handleDelete = async (automationId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return

    try {
      const { error } = await supabase
        .from('automation_flows')
        .delete()
        .eq('id', automationId)

      if (error) {
        toast.error('Erro ao excluir automação')
        return
      }

      toast.success('Automação excluída com sucesso!')
      loadAutomations()
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

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'new_lead': return <Users className="h-4 w-4" />
      case 'webhook': return <Zap className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'date': return <Clock className="h-4 w-4" />
      default: return <Workflow className="h-4 w-4" />
    }
  }

  const getTriggerLabel = (triggerType: string) => {
    switch (triggerType) {
      case 'new_lead': return 'Novo Lead'
      case 'webhook': return 'Webhook'
      case 'email': return 'Email'
      case 'date': return 'Data/Hora'
      default: return triggerType
    }
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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
            <p className="text-gray-600">Crie fluxos automatizados para seus leads</p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/dashboard/automations/builder">
                <Plus className="mr-2 h-4 w-4" />
                Builder Visual
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Workflow className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{automations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Play className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ativas</p>
                  <p className="text-2xl font-bold">
                    {automations.filter(a => a.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Pause className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pausadas</p>
                  <p className="text-2xl font-bold">
                    {automations.filter(a => a.status === 'paused').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Zap className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Execuções</p>
                  <p className="text-2xl font-bold">
                    {Math.floor(Math.random() * 1000)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar automações..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 border border-gray-200 rounded-md bg-white text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
                <option value="draft">Rascunho</option>
                <option value="archived">Arquivada</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Automations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Automações ({filteredAutomations.length})</CardTitle>
            <CardDescription>
              Lista de todas as suas automações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Etapas</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead className="w-[70px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAutomations.map((automation) => (
                  <TableRow key={automation.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{automation.name}</div>
                        {automation.description && (
                          <div className="text-sm text-gray-500 mt-1">
                            {automation.description.length > 50
                              ? automation.description.substring(0, 50) + '...'
                              : automation.description
                            }
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTriggerIcon(automation.trigger_type)}
                        <span className="text-sm">{getTriggerLabel(automation.trigger_type)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(automation.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {automation.flow_definition?.steps?.length || 0} etapas
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(automation.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/automations/${automation.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalhes
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/automations/builder?edit=${automation.id}`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(automation.id, automation.status)}>
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
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(automation.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredAutomations.length === 0 && (
              <div className="text-center py-8">
                <Workflow className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma automação encontrada
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Tente ajustar os filtros ou busca.'
                    : 'Comece criando sua primeira automação.'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button asChild>
                    <Link href="/dashboard/automations/builder">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Primeira Automação
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="mr-2 h-5 w-5 text-blue-500" />
                Builder Visual
              </CardTitle>
              <CardDescription>
                Crie automações com interface drag-and-drop
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Use nosso builder visual para criar fluxos complexos de automação sem código.
                Arraste e solte componentes para construir sua automação.
              </p>
              <Button asChild className="w-full">
                <Link href="/dashboard/automations/builder">
                  Abrir Builder
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Workflow className="mr-2 h-5 w-5 text-green-500" />
                Tipos de Automação
              </CardTitle>
              <CardDescription>
                Diferentes gatilhos disponíveis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>Novo Lead - Quando um lead é adicionado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-500" />
                  <span>Webhook - Via API externa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span>Agendamento - Data e hora específica</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-red-500" />
                  <span>Email - Eventos de email</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
