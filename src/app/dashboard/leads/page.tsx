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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Search,
  MoreHorizontal,
  Upload,
  Download,
  Users,
  Mail,
  Phone,
  Building,
  Tag,
  Edit,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Optimized hooks
import { useSupabaseAuth } from '@/lib/hooks/useSupabaseAuth'
import { 
  useLeads, 
  useCreateLead, 
  useUpdateLead, 
  useDeleteLead,
  type Lead 
} from '@/lib/hooks/useOptimizedQueries'

// Memoized components
const LeadStatsCard = memo(({ icon: Icon, title, value, color }: {
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

LeadStatsCard.displayName = 'LeadStatsCard'

const LeadRow = memo(({ 
  lead, 
  onEdit, 
  onDelete 
}: {
  lead: Lead
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
}) => {
  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
      active: 'default',
      unsubscribed: 'secondary',
      bounced: 'destructive',
      complained: 'destructive',
    }

    const labels: { [key: string]: string } = {
      active: 'Ativo',
      unsubscribed: 'Descadastrado',
      bounced: 'Bounced',
      complained: 'Reclamação',
    }

    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    )
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{lead.email}</TableCell>
      <TableCell>{lead.name || '-'}</TableCell>
      <TableCell>{lead.company || '-'}</TableCell>
      <TableCell>{getStatusBadge(lead.status)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {lead.tags.slice(0, 2).map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {lead.tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{lead.tags.length - 2}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-gray-500">
        {formatDistanceToNow(new Date(lead.created_at), {
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
            <DropdownMenuItem onClick={() => onEdit(lead)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(lead.id)}
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

LeadRow.displayName = 'LeadRow'

const LeadFilters = memo(({ 
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
            placeholder="Buscar por email, nome ou empresa..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="unsubscribed">Descadastrado</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="complained">Reclamação</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CardContent>
  </Card>
))

LeadFilters.displayName = 'LeadFilters'

const LeadForm = memo(({ 
  formData, 
  onFormDataChange, 
  onSubmit, 
  isEditing, 
  isOpen, 
  onClose 
}: {
  formData: any
  onFormDataChange: (data: any) => void
  onSubmit: () => void
  isEditing: boolean
  isOpen: boolean
  onClose: () => void
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>
          {isEditing ? 'Editar Lead' : 'Novo Lead'}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Edite as informações do lead.'
            : 'Adicione um novo lead ao seu CRM.'
          }
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })}
            placeholder="email@exemplo.com"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
            placeholder="Nome completo"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => onFormDataChange({ ...formData, phone: e.target.value })}
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="company">Empresa</Label>
          <Input
            id="company"
            value={formData.company}
            onChange={(e) => onFormDataChange({ ...formData, company: e.target.value })}
            placeholder="Nome da empresa"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="position">Cargo</Label>
          <Input
            id="position"
            value={formData.position}
            onChange={(e) => onFormDataChange({ ...formData, position: e.target.value })}
            placeholder="Cargo/função"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) => onFormDataChange({ ...formData, tags: e.target.value })}
            placeholder="tag1, tag2, tag3"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={!formData.email}>
          {isEditing ? 'Atualizar' : 'Criar'} Lead
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
))

LeadForm.displayName = 'LeadForm'

const EmptyState = memo(({ 
  searchTerm, 
  statusFilter, 
  onAddClick 
}: {
  searchTerm: string
  statusFilter: string
  onAddClick: () => void
}) => (
  <div className="text-center py-8">
    <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">
      Nenhum lead encontrado
    </h3>
    <p className="text-gray-500 mb-4">
      {searchTerm || statusFilter !== 'all'
        ? 'Tente ajustar os filtros ou busca.'
        : 'Comece adicionando seus primeiros leads.'
      }
    </p>
    {!searchTerm && statusFilter === 'all' && (
      <Button onClick={onAddClick}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar Lead
      </Button>
    )}
  </div>
))

EmptyState.displayName = 'EmptyState'

export default function LeadsPage() {
  const { workspaceId } = useSupabaseAuth()
  const { data: leads = [], isLoading, error } = useLeads(workspaceId)
  const createLead = useCreateLead(workspaceId || '')
  const updateLead = useUpdateLead(workspaceId || '')
  const deleteLead = useDeleteLead(workspaceId || '')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    company: '',
    position: '',
    source: '',
    tags: '',
  })

  // Memoized filtered leads
  const filteredLeads = useMemo(() => {
    let filtered = leads

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.name && lead.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter)
    }

    return filtered
  }, [leads, searchTerm, statusFilter])

  // Memoized stats calculation
  const stats = useMemo(() => {
    return {
      total: leads.length,
      active: leads.filter(lead => lead.status === 'active').length,
      withTags: leads.filter(lead => lead.tags.length > 0).length,
      withCompany: leads.filter(lead => lead.company).length,
    }
  }, [leads])

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      phone: '',
      company: '',
      position: '',
      source: '',
      tags: '',
    })
    setEditingLead(null)
  }

  const handleSubmit = async () => {
    try {
      const leadData = {
        email: formData.email,
        name: formData.name || null,
        phone: formData.phone || null,
        company: formData.company || null,
        position: formData.position || null,
        source: formData.source || 'manual',
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
      }

      if (editingLead) {
        await updateLead.mutateAsync({ id: editingLead.id, ...leadData })
      } else {
        await createLead.mutateAsync(leadData)
      }

      resetForm()
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error('Error saving lead:', error)
    }
  }

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead)
    setFormData({
      email: lead.email,
      name: lead.name || '',
      phone: lead.phone || '',
      company: lead.company || '',
      position: lead.position || '',
      source: lead.source || '',
      tags: lead.tags.join(', '),
    })
    setIsAddDialogOpen(true)
  }

  const handleDelete = async (leadId: string) => {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return
    
    try {
      await deleteLead.mutateAsync(leadId)
    } catch (error) {
      console.error('Error deleting lead:', error)
    }
  }

  const handleOpenAddDialog = () => {
    resetForm()
    setIsAddDialogOpen(true)
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
            <p className="text-red-600">Erro ao carregar leads</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-gray-600">Gerencie seus contatos e prospects</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/dashboard/leads/import">
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </Link>
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button onClick={handleOpenAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LeadStatsCard
            icon={Users}
            title="Total"
            value={stats.total}
            color="text-blue-500"
          />
          <LeadStatsCard
            icon={Mail}
            title="Ativos"
            value={stats.active}
            color="text-green-500"
          />
          <LeadStatsCard
            icon={Tag}
            title="Com Tags"
            value={stats.withTags}
            color="text-purple-500"
          />
          <LeadStatsCard
            icon={Building}
            title="Com Empresa"
            value={stats.withCompany}
            color="text-orange-500"
          />
        </div>

        {/* Filters */}
        <LeadFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leads ({filteredLeads.length})</CardTitle>
            <CardDescription>
              Lista de todos os seus contatos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="w-[70px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>

            {filteredLeads.length === 0 && (
              <EmptyState
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                onAddClick={handleOpenAddDialog}
              />
            )}
          </CardContent>
        </Card>

        {/* Lead Form Dialog */}
        <LeadForm
          formData={formData}
          onFormDataChange={setFormData}
          onSubmit={handleSubmit}
          isEditing={!!editingLead}
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
        />
      </div>
    </DashboardLayout>
  )
}
