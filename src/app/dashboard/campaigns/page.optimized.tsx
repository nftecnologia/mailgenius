'use client'

import { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
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
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Optimized hooks
import { useSupabaseAuth } from '@/lib/hooks/useSupabaseAuth'
import { 
  useCampaigns, 
  useUpdateCampaign, 
  useDeleteCampaign,
  type Campaign 
} from '@/lib/hooks/useOptimizedQueries'

// Memoized components
const CampaignStatsCard = memo(({ icon: Icon, title, value, color }: {
  icon: any
  title: string
  value: string | number
  color: string
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center">
        <Icon className={`h-8 w-8 ${color}`} />
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
))

CampaignStatsCard.displayName = 'CampaignStatsCard'

const CampaignRow = memo(({ 
  campaign, 
  onPause, 
  onResume, 
  onDelete 
}: {
  campaign: Campaign
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (id: string) => void
}) => {
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

  return (
    <TableRow>
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
              <DropdownMenuItem onClick={() => onPause(campaign.id)}>
                <Pause className="mr-2 h-4 w-4" />
                Pausar
              </DropdownMenuItem>
            )}
            {campaign.status === 'paused' && (
              <DropdownMenuItem onClick={() => onResume(campaign.id)}>
                <Play className="mr-2 h-4 w-4" />
                Retomar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(campaign.id)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
})

CampaignRow.displayName = 'CampaignRow'

const CampaignFilters = memo(({ 
  searchTerm, 
  onSearchChange, 
  statusFilter, 
  onStatusChange 
}: {
  searchTerm: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou assunto..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 border border-gray-200 rounded-md bg-white text-sm"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
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
))

CampaignFilters.displayName = 'CampaignFilters'

const EmptyState = memo(({ 
  searchTerm, 
  statusFilter 
}: {
  searchTerm: string
  statusFilter: string
}) => (
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
))

EmptyState.displayName = 'EmptyState'

export default function CampaignsPage() {
  const { workspaceId } = useSupabaseAuth()
  const { data: campaigns = [], isLoading, error } = useCampaigns(workspaceId)
  const updateCampaign = useUpdateCampaign(workspaceId || '')
  const deleteCampaign = useDeleteCampaign(workspaceId || '')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Memoized filtered campaigns
  const filteredCampaigns = useMemo(() => {
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

    return filtered
  }, [campaigns, searchTerm, statusFilter])

  // Memoized stats calculation
  const stats = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => ({
        totalSent: acc.totalSent + campaign.total_recipients,
        totalDelivered: acc.totalDelivered + campaign.delivered,
        totalOpened: acc.totalOpened + campaign.opened,
        totalClicked: acc.totalClicked + campaign.clicked,
      }),
      { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0 }
    )
  }, [campaigns])

  const handlePauseCampaign = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja pausar esta campanha?')) return
    
    try {
      await updateCampaign.mutateAsync({ id: campaignId, status: 'paused' })
    } catch (error) {
      console.error('Error pausing campaign:', error)
    }
  }

  const handleResumeCampaign = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja retomar esta campanha?')) return
    
    try {
      await updateCampaign.mutateAsync({ id: campaignId, status: 'scheduled' })
    } catch (error) {
      console.error('Error resuming campaign:', error)
    }
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) return
    
    try {
      await deleteCampaign.mutateAsync(campaignId)
    } catch (error) {
      console.error('Error deleting campaign:', error)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-red-600">Erro ao carregar campanhas</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Tentar novamente
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
          <CampaignStatsCard
            icon={Send}
            title="Emails Enviados"
            value={stats.totalSent.toLocaleString()}
            color="text-blue-500"
          />
          <CampaignStatsCard
            icon={Mail}
            title="Taxa de Entrega"
            value={`${stats.totalSent > 0 ? ((stats.totalDelivered / stats.totalSent) * 100).toFixed(1) : 0}%`}
            color="text-green-500"
          />
          <CampaignStatsCard
            icon={Eye}
            title="Taxa de Abertura"
            value={`${stats.totalDelivered > 0 ? ((stats.totalOpened / stats.totalDelivered) * 100).toFixed(1) : 0}%`}
            color="text-purple-500"
          />
          <CampaignStatsCard
            icon={MousePointer}
            title="Taxa de Cliques"
            value={`${stats.totalOpened > 0 ? ((stats.totalClicked / stats.totalOpened) * 100).toFixed(1) : 0}%`}
            color="text-orange-500"
          />
        </div>

        {/* Filters */}
        <CampaignFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />

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
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    onPause={handlePauseCampaign}
                    onResume={handleResumeCampaign}
                    onDelete={handleDeleteCampaign}
                  />
                ))}
              </TableBody>
            </Table>

            {filteredCampaigns.length === 0 && (
              <EmptyState
                searchTerm={searchTerm}
                statusFilter={statusFilter}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}