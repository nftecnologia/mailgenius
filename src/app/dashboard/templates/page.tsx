'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Search,
  Mail,
  Edit,
  Copy,
  Trash2,
  Eye,
  Star,
  Layout,
  Palette,
  Code,
  Send,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import AIEmailGenerator from '@/components/ai/AIEmailGenerator'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  html_content: string
  text_content?: string
  variables: string[]
  template_type: string
  created_by?: string
  created_at: string
  updated_at: string
}

const predefinedTemplates = [
  {
    id: 'welcome',
    name: 'Boas-vindas',
    subject: 'Bem-vindo(a) {{name}}!',
    html_content: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Bem-vindo(a), {{name}}!</h1>
  </div>
  <div style="background: white; padding: 40px 20px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; line-height: 1.6; color: #333;">Estamos muito felizes em tê-lo(a) conosco!</p>
    <p style="font-size: 16px; line-height: 1.6; color: #333;">Sua jornada começa agora. Esperamos que você aproveite nossa plataforma ao máximo.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{dashboard_url}}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar Dashboard</a>
    </div>
    <p style="font-size: 14px; color: #666; margin-top: 30px;">Atenciosamente,<br>Equipe {{company}}</p>
  </div>
</div>`,
    variables: ['name', 'dashboard_url', 'company'],
    template_type: 'transactional'
  },
  {
    id: 'newsletter',
    name: 'Newsletter Moderna',
    subject: 'Newsletter {{month}} - {{company}}',
    html_content: `
<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <header style="background: #1a365d; color: white; padding: 30px 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">{{company}} Newsletter</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">{{month}} {{year}}</p>
  </header>

  <main style="background: white; padding: 30px 20px;">
    <h2 style="color: #1a365d; margin-bottom: 20px;">Olá {{name}},</h2>

    <section style="margin-bottom: 30px;">
      <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">🚀 Novidades</h3>
      <ul style="color: #4a5568; line-height: 1.6;">
        <li>Nova funcionalidade de automações</li>
        <li>Dashboard redesenhado</li>
        <li>Integração com novas plataformas</li>
      </ul>
    </section>

    <section style="margin-bottom: 30px;">
      <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📊 Estatísticas</h3>
      <p style="color: #4a5568; line-height: 1.6;">Este mês tivemos um crescimento incrível!</p>
    </section>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{cta_url}}" style="background: #3182ce; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">{{cta_text}}</a>
    </div>
  </main>

  <footer style="background: #f7fafc; padding: 20px; text-align: center; color: #718096; font-size: 14px;">
    <p>{{company}} | {{address}}</p>
    <p><a href="{{unsubscribe_url}}" style="color: #3182ce;">Descadastrar</a></p>
  </footer>
</div>`,
    variables: ['name', 'company', 'month', 'year', 'cta_url', 'cta_text', 'address', 'unsubscribe_url'],
    template_type: 'campaign'
  },
  {
    id: 'promotion',
    name: 'Promoção Especial',
    subject: 'Oferta especial para {{name}} - {{discount}}% OFF',
    html_content: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(45deg, #ff6b6b, #ee5a52); padding: 40px 20px; text-align: center; color: white;">
    <h1 style="margin: 0; font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">🔥 OFERTA ESPECIAL!</h1>
    <p style="margin: 10px 0 0; font-size: 18px; opacity: 0.95;">Exclusivo para você, {{name}}</p>
  </div>

  <div style="background: white; padding: 40px 20px; text-align: center;">
    <div style="background: #fff5f5; border: 2px dashed #ff6b6b; padding: 30px; margin-bottom: 30px; border-radius: 12px;">
      <h2 style="color: #c53030; margin: 0 0 10px; font-size: 36px;">{{discount}}% OFF</h2>
      <p style="color: #2d3748; font-size: 18px; margin: 0;">Em todos os produtos</p>
    </div>

    <p style="font-size: 16px; line-height: 1.6; color: #4a5568; margin-bottom: 20px;">
      Por tempo limitado! Aproveite esta oportunidade única.
    </p>

    <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #718096;">Use o código:</p>
      <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #c53030; font-family: monospace;">{{code}}</p>
    </div>

    <a href="{{link}}" style="background: #ff6b6b; color: white; padding: 18px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; display: inline-block; margin: 20px 0; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);">
      APROVEITAR OFERTA
    </a>

    <p style="font-size: 12px; color: #a0aec0; margin-top: 30px;">
      *Válido até {{expiry_date}}. Não cumulativo com outras promoções.
    </p>
  </div>
</div>`,
    variables: ['name', 'discount', 'code', 'link', 'expiry_date'],
    template_type: 'campaign'
  }
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    html_content: '',
    text_content: '',
    template_type: 'campaign',
    variables: [] as string[]
  })

  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    filterTemplates()
  }, [templates, searchTerm, typeFilter])

  const loadTemplates = async () => {
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

      const { data: templatesData, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('workspace_id', member.workspace_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading templates:', error)
        toast.error('Erro ao carregar templates')
        return
      }

      // Add predefined templates with proper structure
      const predefinedWithIds = predefinedTemplates.map(template => ({
        ...template,
        id: `predefined_${template.id}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        text_content: ''
      }))

      setTemplates([...predefinedWithIds, ...(templatesData || [])])
    } catch (error) {
      console.error('Error loading templates:', error)
      toast.error('Erro inesperado ao carregar templates')
    } finally {
      setLoading(false)
    }
  }

  const filterTemplates = () => {
    let filtered = templates

    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.subject.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(template => template.template_type === typeFilter)
    }

    setFilteredTemplates(filtered)
  }

  const extractVariables = (content: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = regex.exec(content)) !== null) {
      const variable = match[1].trim()
      if (!variables.includes(variable)) {
        variables.push(variable)
      }
    }

    return variables
  }

  const handleCreateTemplate = async () => {
    try {
      if (!workspaceId) return

      const variables = extractVariables(formData.html_content + ' ' + formData.subject)

      const templateData = {
        workspace_id: workspaceId,
        name: formData.name,
        subject: formData.subject,
        html_content: formData.html_content,
        text_content: formData.text_content || null,
        variables: variables,
        template_type: formData.template_type
      }

      const { error } = await supabase
        .from('email_templates')
        .insert(templateData)

      if (error) {
        toast.error('Erro ao criar template')
        return
      }

      toast.success('Template criado com sucesso!')
      setIsCreateDialogOpen(false)
      resetForm()
      loadTemplates()
    } catch (error) {
      console.error('Error creating template:', error)
      toast.error('Erro inesperado ao criar template')
    }
  }

  const handleUseTemplate = async (template: EmailTemplate) => {
    if (template.id.startsWith('predefined_')) {
      // Copy predefined template to workspace
      try {
        if (!workspaceId) return

        const templateData = {
          workspace_id: workspaceId,
          name: template.name,
          subject: template.subject,
          html_content: template.html_content,
          text_content: template.text_content || null,
          variables: template.variables,
          template_type: template.template_type
        }

        const { error } = await supabase
          .from('email_templates')
          .insert(templateData)

        if (error) {
          toast.error('Erro ao copiar template')
          return
        }

        toast.success('Template copiado para seu workspace!')
        loadTemplates()
      } catch (error) {
        console.error('Error copying template:', error)
        toast.error('Erro ao copiar template')
      }
    } else {
      // Navigate to campaign creation with template
      router.push(`/dashboard/campaigns/new?template=${template.id}`)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (templateId.startsWith('predefined_')) {
      toast.error('Não é possível excluir templates predefinidos')
      return
    }

    if (!confirm('Tem certeza que deseja excluir este template?')) return

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId)

      if (error) {
        toast.error('Erro ao excluir template')
        return
      }

      toast.success('Template excluído com sucesso!')
      loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Erro inesperado ao excluir template')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      subject: '',
      html_content: '',
      text_content: '',
      template_type: 'campaign',
      variables: []
    })
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'campaign': return 'bg-blue-100 text-blue-800'
      case 'transactional': return 'bg-green-100 text-green-800'
      case 'automation': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'campaign': return 'Campanha'
      case 'transactional': return 'Transacional'
      case 'automation': return 'Automação'
      default: return type
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
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
            <h1 className="text-2xl font-bold text-gray-900">Templates de Email</h1>
            <p className="text-gray-600">Crie e gerencie seus templates profissionais</p>
          </div>
          <div className="flex gap-3">
            <AIEmailGenerator
              onGenerated={(content) => {
                setFormData(prev => ({
                  ...prev,
                  name: content.subject,
                  subject: content.subject,
                  html_content: content.htmlContent
                }))
                setIsCreateDialogOpen(true)
              }}
            />
            <Button asChild className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              <Link href="/dashboard/templates/editor">
                <Layout className="mr-2 h-4 w-4" />
                Editor WYSIWYG
              </Link>
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Template</DialogTitle>
                  <DialogDescription>
                    Crie um template de email personalizado para suas campanhas
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome do Template *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Newsletter Mensal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Tipo</Label>
                      <Select
                        value={formData.template_type}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, template_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="campaign">Campanha</SelectItem>
                          <SelectItem value="transactional">Transacional</SelectItem>
                          <SelectItem value="automation">Automação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subject">Assunto *</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Use {{variavel}} para personalização"
                    />
                  </div>

                  <div>
                    <Label htmlFor="html_content">Conteúdo HTML *</Label>
                    <Textarea
                      id="html_content"
                      value={formData.html_content}
                      onChange={(e) => setFormData(prev => ({ ...prev, html_content: e.target.value }))}
                      placeholder="Cole seu HTML aqui ou use nossos templates base..."
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="text_content">Versão Texto (opcional)</Label>
                    <Textarea
                      id="text_content"
                      value={formData.text_content}
                      onChange={(e) => setFormData(prev => ({ ...prev, text_content: e.target.value }))}
                      placeholder="Versão em texto puro do email"
                      className="min-h-[100px]"
                    />
                  </div>

                  {formData.html_content && (
                    <div>
                      <Label>Variáveis Detectadas</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {extractVariables(formData.html_content + ' ' + formData.subject).map(variable => (
                          <Badge key={variable} variant="outline">
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateTemplate} disabled={!formData.name || !formData.subject || !formData.html_content}>
                    Criar Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar templates..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="campaign">Campanha</SelectItem>
                  <SelectItem value="transactional">Transacional</SelectItem>
                  <SelectItem value="automation">Automação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.subject.length > 50
                        ? template.subject.substring(0, 50) + '...'
                        : template.subject
                      }
                    </CardDescription>
                  </div>
                  {template.id.startsWith('predefined_') && (
                    <Star className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getTypeColor(template.template_type)}>
                    {getTypeLabel(template.template_type)}
                  </Badge>
                  <Badge variant="outline">
                    {template.variables.length} variáveis
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-600 mb-1">Preview:</p>
                    <div
                      className="text-sm text-gray-800 line-clamp-3"
                      dangerouslySetInnerHTML={{
                        __html: template.html_content
                          .replace(/<[^>]*>/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim()
                          .substring(0, 100) + '...'
                      }}
                    />
                  </div>

                  <div className="text-xs text-gray-500">
                    {template.id.startsWith('predefined_') ? (
                      'Template predefinido'
                    ) : (
                      `Criado ${formatDistanceToNow(new Date(template.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}`
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleUseTemplate(template)}
                    >
                      <Send className="mr-2 h-3 w-3" />
                      {template.id.startsWith('predefined_') ? 'Copiar' : 'Usar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    {!template.id.startsWith('predefined_') && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/templates/${template.id}/edit`)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Layout className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum template encontrado
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || typeFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Comece criando seu primeiro template de email.'
                }
              </p>
              {!searchTerm && typeFilter === 'all' && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Template
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
              <DialogDescription>
                Visualização do template de email
              </DialogDescription>
            </DialogHeader>
            {previewTemplate && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Assunto:</Label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                    {previewTemplate.subject}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Variáveis:</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {previewTemplate.variables.map(variable => (
                      <Badge key={variable} variant="outline">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Preview HTML:</Label>
                  <div
                    className="border rounded-lg p-4 bg-white min-h-[400px] overflow-auto"
                    dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                Fechar
              </Button>
              {previewTemplate && (
                <Button onClick={() => {
                  setPreviewTemplate(null)
                  handleUseTemplate(previewTemplate)
                }}>
                  <Send className="mr-2 h-4 w-4" />
                  {previewTemplate.id.startsWith('predefined_') ? 'Copiar Template' : 'Usar Template'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
