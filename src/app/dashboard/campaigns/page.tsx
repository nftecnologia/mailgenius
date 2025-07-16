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
  Mail,
  Send,
  Eye,
  MousePointer,
  Pause,
  Play,
  Edit,
  Trash2,
  Calendar,
  Users,
  TrendingUp,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Campaign {
  id: string
  name: string
  subject: string
  status: string
  send_at: string | null
  sent_at: string | null
  total_recipients: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  unsubscribed: number
  complained: number
  created_at: string
  updated_at: string
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    filterCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns, searchTerm, statusFilter])

  const loadCampaigns = async () => {
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

      const { data: campaignsData, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', member.workspace_id)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Erro ao carregar campanhas')
        return
      }

      setCampaigns(campaignsData || [])
    } catch (error) {
      console.error('Error loading campaigns:', error)
      toast.error('Erro inesperado ao carregar campanhas')
    } finally {
      setLoading(false)
    }
  }

  const filterCampaigns = () => {
    let filtered = campaigns

    if (searchTerm) {
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        campaign.subject.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(campaign => campaign.status === statusFilter)
    }

    setFilteredCampaigns(filtered)
  }

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) return

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)

      if (error) {
        toast.error('Erro ao excluir campanha')
        return
      }

      toast.success('Campanha excluída com sucesso!')
      loadCampaigns()
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error('Erro inesperado ao excluir campanha')
    }
  }

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId)

      if (error) {
        toast.error('Erro ao pausar campanha')
        return
      }

      toast.success('Campanha pausada com sucesso!')
      loadCampaigns()
    } catch (error) {
      console.error('Error pausing campaign:', error)
      toast.error('Erro inesperado ao pausar campanha')
    }
  }

  const handleResumeCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'scheduled' })
        .eq('id', campaignId)

      if (error) {
        toast.error('Erro ao retomar campanha')
        return
      }

      toast.success('Campanha retomada com sucesso!')
      loadCampaigns()
    } catch (error) {
      console.error('Error resuming campaign:', error)
      toast.error('Erro inesperado ao retomar campanha')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
      draft: 'secondary',
      scheduled: 'default',
      sending: 'default',
      sent: 'default',
      paused: 'secondary',
      cancelled: 'destructive',
    }

    const labels: { [key: string]: string } = {
      draft: 'Rascunho',
      scheduled: 'Agendada',
      sending: 'Enviando',
      sent: 'Enviada',
      paused: 'Pausada',
      cancelled: 'Cancelada',
    }

    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    )
  }

  const calculateOpenRate = (opened: number, delivered: number) => {
    if (delivered === 0) return 0
    return ((opened / delivered) * 100).toFixed(1)
  }

  const calculateClickRate = (clicked: number, opened: number) => {
    if (opened === 0) return 0
    return ((clicked / opened) * 100).toFixed(1)
  }

  const getTotalStats = () => {
    return campaigns.reduce(
      (acc, campaign) => ({
        totalSent: acc.totalSent + campaign.total_recipients,
        totalDelivered: acc.totalDelivered + campaign.delivered,
        totalOpened: acc.totalOpened + campaign.opened,
        totalClicked: acc.totalClicked + campaign.clicked,
      }),
      { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0 }
    )
  }

  const stats = getTotalStats()

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
            <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
            <p className="text-gray-600">Gerencie suas campanhas de email marketing</p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/dashboard/campaigns/new">
                <Plus className="mr-2 h-4 w-4" />
                Nova Campanha
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Send className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Emails Enviados</p>
                  <p className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Mail className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Taxa de Entrega</p>
                  <p className="text-2xl font-bold">
                    {stats.totalSent > 0 ? ((stats.totalDelivered / stats.totalSent) * 100).toFixed(1) : 0}%
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
                  <p className="text-sm font-medium text-gray-600">Taxa de Abertura</p>
                  <p className="text-2xl font-bold">
                    {stats.totalDelivered > 0 ? ((stats.totalOpened / stats.totalDelivered) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <MousePointer className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Taxa de Cliques</p>
                  <p className="text-2xl font-bold">
                    {stats.totalOpened > 0 ? ((stats.totalClicked / stats.totalOpened) * 100).toFixed(1) : 0}%
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
                  placeholder="Buscar por nome ou assunto..."
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
                <option value="draft">Rascunho</option>
                <option value="scheduled">Agendada</option>
                <option value="sending">Enviando</option>
                <option value="sent">Enviada</option>
                <option value="paused">Pausada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Table */}
        <Card>
          <CardHeader>
            <CardTitle>Campanhas ({filteredCampaigns.length})</CardTitle>
            <CardDescription>
              Lista de todas as suas campanhas de email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviados</TableHead>
                  <TableHead>Taxa Abertura</TableHead>
                  <TableHead>Taxa Cliques</TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead className="w-[70px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{campaign.subject}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{campaign.total_recipients.toLocaleString()}</div>
                        <div className="text-gray-500">
                          {campaign.delivered.toLocaleString()} entregues
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {calculateOpenRate(campaign.opened, campaign.delivered)}%
                        </div>
                        <div className="text-gray-500">
                          {campaign.opened.toLocaleString()} aberturas
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {calculateClickRate(campaign.clicked, campaign.opened)}%
                        </div>
                        <div className="text-gray-500">
                          {campaign.clicked.toLocaleString()} cliques
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {campaign.send_at ? (
                        <div>
                          <div className="font-medium">
                            {format(new Date(campaign.send_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                          <div className="text-gray-500">
                            {format(new Date(campaign.send_at), 'HH:mm', { locale: ptBR })}
                          </div>
                        </div>
                      ) : campaign.sent_at ? (
                        <div>
                          <div className="font-medium text-green-600">Enviada</div>
                          <div className="text-gray-500">
                            {formatDistanceToNow(new Date(campaign.sent_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
                            <Link href={`/dashboard/campaigns/${campaign.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalhes
                            </Link>
                          </DropdownMenuItem>
                          {campaign.status === 'draft' && (
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/campaigns/${campaign.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'scheduled' && (
                            <DropdownMenuItem onClick={() => handlePauseCampaign(campaign.id)}>
                              <Pause className="mr-2 h-4 w-4" />
                              Pausar
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'paused' && (
                            <DropdownMenuItem onClick={() => handleResumeCampaign(campaign.id)}>
                              <Play className="mr-2 h-4 w-4" />
                              Retomar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(campaign.id)}
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

            {filteredCampaigns.length === 0 && (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma campanha encontrada
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Tente ajustar os filtros ou busca.'
                    : 'Comece criando sua primeira campanha de email.'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button asChild>
                    <Link href="/dashboard/campaigns/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Campanha
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
