'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Type,
  Image,
  MousePointer,
  Minus,
  Columns,
  Save,
  Eye,
  ArrowLeft,
  Settings,
  Trash2,
  Palette,
  Smartphone,
  Monitor,
  Tablet,
  Copy,
  Download,
  Upload,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

interface EmailComponent {
  id: string
  type: 'text' | 'heading' | 'image' | 'button' | 'divider' | 'spacer' | 'columns'
  content: {
    text?: string
    fontSize?: number
    fontWeight?: string
    color?: string
    textAlign?: string
    backgroundColor?: string
    padding?: string
    margin?: string
    borderRadius?: string
    href?: string
    src?: string
    alt?: string
    width?: string
    height?: string
    columnCount?: number
    columns?: EmailComponent[][]
  }
}

interface EmailTemplate {
  id?: string
  name: string
  subject: string
  components: EmailComponent[]
  settings: {
    backgroundColor: string
    maxWidth: string
    fontFamily: string
  }
}

const COMPONENT_TYPES = [
  {
    id: 'heading',
    name: 'Título',
    icon: Type,
    description: 'Texto de cabeçalho',
    color: 'bg-blue-500',
    defaultContent: {
      text: 'Seu título aqui',
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1a1a1a',
      textAlign: 'left',
      padding: '16px',
      margin: '0px'
    }
  },
  {
    id: 'text',
    name: 'Texto',
    icon: Type,
    description: 'Parágrafo de texto',
    color: 'bg-gray-500',
    defaultContent: {
      text: 'Seu texto aqui. Clique para editar.',
      fontSize: 16,
      fontWeight: 'normal',
      color: '#4a4a4a',
      textAlign: 'left',
      padding: '8px 16px',
      margin: '0px'
    }
  },
  {
    id: 'image',
    name: 'Imagem',
    icon: Image,
    description: 'Imagem responsiva',
    color: 'bg-green-500',
    defaultContent: {
      src: 'https://via.placeholder.com/600x300/f0f0f0/999999?text=Sua+Imagem',
      alt: 'Descrição da imagem',
      width: '100%',
      height: 'auto',
      padding: '16px',
      margin: '0px'
    }
  },
  {
    id: 'button',
    name: 'Botão',
    icon: MousePointer,
    description: 'Botão de ação',
    color: 'bg-purple-500',
    defaultContent: {
      text: 'Clique Aqui',
      href: 'https://exemplo.com',
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
      padding: '12px 24px',
      margin: '16px',
      borderRadius: '6px'
    }
  },
  {
    id: 'divider',
    name: 'Divisor',
    icon: Minus,
    description: 'Linha separadora',
    color: 'bg-yellow-500',
    defaultContent: {
      backgroundColor: '#e5e7eb',
      height: '1px',
      margin: '24px 16px'
    }
  },
  {
    id: 'spacer',
    name: 'Espaçador',
    icon: Minus,
    description: 'Espaço em branco',
    color: 'bg-orange-500',
    defaultContent: {
      height: '32px',
      backgroundColor: 'transparent'
    }
  },
  {
    id: 'columns',
    name: 'Colunas',
    icon: Columns,
    description: 'Layout em colunas',
    color: 'bg-indigo-500',
    defaultContent: {
      columnCount: 2,
      padding: '16px',
      columns: [[], []]
    }
  }
]

interface SortableComponentProps {
  component: EmailComponent
  onEdit: (component: EmailComponent) => void
  onDelete: (componentId: string) => void
  onDuplicate: (component: EmailComponent) => void
}

function SortableComponent({ component, onEdit, onDelete, onDuplicate }: SortableComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const renderComponent = () => {
    switch (component.type) {
      case 'heading':
      case 'text':
        return (
          <div
            style={{
              fontSize: component.content.fontSize,
              fontWeight: component.content.fontWeight,
              color: component.content.color,
              textAlign: component.content.textAlign as any,
              padding: component.content.padding,
              margin: component.content.margin,
              backgroundColor: component.content.backgroundColor
            }}
          >
            {component.content.text}
          </div>
        )

      case 'image':
        return (
          <div style={{ padding: component.content.padding, margin: component.content.margin }}>
            <img
              src={component.content.src}
              alt={component.content.alt}
              style={{
                width: component.content.width,
                height: component.content.height,
                maxWidth: '100%'
              }}
            />
          </div>
        )

      case 'button':
        return (
          <div style={{ textAlign: component.content.textAlign as any, margin: component.content.margin }}>
            <div
              style={{
                display: 'inline-block',
                backgroundColor: component.content.backgroundColor,
                color: component.content.color,
                fontSize: component.content.fontSize,
                fontWeight: component.content.fontWeight,
                padding: component.content.padding,
                borderRadius: component.content.borderRadius,
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              {component.content.text}
            </div>
          </div>
        )

      case 'divider':
        return (
          <div
            style={{
              height: component.content.height,
              backgroundColor: component.content.backgroundColor,
              margin: component.content.margin
            }}
          />
        )

      case 'spacer':
        return (
          <div
            style={{
              height: component.content.height,
              backgroundColor: component.content.backgroundColor
            }}
          />
        )

      case 'columns':
        return (
          <div style={{ padding: component.content.padding }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              {component.content.columns?.map((column, index) => (
                <div key={index} style={{ flex: 1, minHeight: '100px', border: '1px dashed #ccc' }}>
                  <div className="p-2 text-xs text-gray-500 text-center">
                    Coluna {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      default:
        return <div>Componente desconhecido</div>
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group relative bg-white border-2 border-transparent hover:border-blue-300 hover:shadow-md rounded-lg transition-all p-2 min-h-[60px]"
    >
      {/* Drag Handle */}
      <div
        {...listeners}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10"
      >
        <div className="w-2 h-10 bg-blue-500 rounded-full shadow-sm"></div>
      </div>

      {/* Component Content */}
      <div className="min-h-[40px] relative">
        {renderComponent()}
        {/* Visual indicator when hovering */}
        <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-20 rounded transition-opacity pointer-events-none"></div>
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 bg-white shadow-md border border-gray-200 hover:bg-gray-50"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onEdit(component)
          }}
        >
          <Settings className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 bg-white shadow-md border border-gray-200 hover:bg-gray-50"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDuplicate(component)
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 bg-white shadow-md border border-gray-200 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(component.id)
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export default function EmailEditorPage() {
  const [template, setTemplate] = useState<EmailTemplate>({
    name: '',
    subject: '',
    components: [],
    settings: {
      backgroundColor: '#f8fafc',
      maxWidth: '600px',
      fontFamily: 'Arial, sans-serif'
    }
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingComponent, setEditingComponent] = useState<EmailComponent | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isSaving, setIsSaving] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClientComponentClient()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Initialize workspace
  useState(() => {
    const initializeWorkspace = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (member) {
        setWorkspaceId(member.workspace_id)
      }
    }
    initializeWorkspace()
  })

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    // Check if dragging from component palette
    if (active.id.toString().startsWith('component-')) {
      const componentType = active.id.toString().replace('component-', '')
      const componentTemplate = COMPONENT_TYPES.find(c => c.id === componentType)

      if (componentTemplate) {
        const newComponent: EmailComponent = {
          id: `${componentType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: componentType as any,
          content: { ...componentTemplate.defaultContent }
        }

        setTemplate(prev => ({
          ...prev,
          components: [...prev.components, newComponent]
        }))

        toast.success(`${componentTemplate.name} adicionado ao template`)
      }
    } else {
      // Reordering existing components
      if (active.id !== over.id) {
        const oldIndex = template.components.findIndex(c => c.id === active.id)
        const newIndex = template.components.findIndex(c => c.id === over.id)

        setTemplate(prev => ({
          ...prev,
          components: arrayMove(prev.components, oldIndex, newIndex)
        }))
      }
    }

    setActiveId(null)
  }

  const addComponent = (componentType: string) => {
    const componentTemplate = COMPONENT_TYPES.find(c => c.id === componentType)

    if (componentTemplate) {
      const newComponent: EmailComponent = {
        id: `${componentType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: componentType as any,
        content: { ...componentTemplate.defaultContent }
      }

      setTemplate(prev => ({
        ...prev,
        components: [...prev.components, newComponent]
      }))

      toast.success(`${componentTemplate.name} adicionado`)
    }
  }

  const editComponent = (component: EmailComponent) => {
    setEditingComponent(component)
  }

  const updateComponent = (updatedComponent: EmailComponent) => {
    setTemplate(prev => ({
      ...prev,
      components: prev.components.map(c =>
        c.id === updatedComponent.id ? updatedComponent : c
      )
    }))
    setEditingComponent(null)
    toast.success('Componente atualizado!')
  }

  const deleteComponent = (componentId: string) => {
    setTemplate(prev => ({
      ...prev,
      components: prev.components.filter(c => c.id !== componentId)
    }))
    toast.success('Componente removido')
  }

  const duplicateComponent = (component: EmailComponent) => {
    const newComponent: EmailComponent = {
      ...component,
      id: `${component.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    const componentIndex = template.components.findIndex(c => c.id === component.id)
    const newComponents = [...template.components]
    newComponents.splice(componentIndex + 1, 0, newComponent)

    setTemplate(prev => ({
      ...prev,
      components: newComponents
    }))

    toast.success('Componente duplicado')
  }

  const saveTemplate = async () => {
    if (!workspaceId) {
      toast.error('Workspace não encontrado')
      return
    }

    if (!template.name.trim()) {
      toast.error('Nome do template é obrigatório')
      return
    }

    setIsSaving(true)

    try {
      const templateData = {
        workspace_id: workspaceId,
        name: template.name,
        subject: template.subject,
        html_content: generateHTML(),
        template_type: 'wysiwyg',
        variables: extractVariables(),
        wysiwyg_data: {
          components: template.components,
          settings: template.settings
        }
      }

      const { error } = await supabase
        .from('email_templates')
        .insert(templateData)

      if (error) {
        console.error('Error saving template:', error)
        toast.error('Erro ao salvar template')
        return
      }

      toast.success('Template salvo com sucesso!')
      router.push('/dashboard/templates')

    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Erro inesperado ao salvar template')
    } finally {
      setIsSaving(false)
    }
  }

  const generateHTML = (): string => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: ${template.settings.fontFamily}; background-color: ${template.settings.backgroundColor}; }
    .email-container { max-width: ${template.settings.maxWidth}; margin: 0 auto; background-color: #ffffff; }
    .responsive-image { max-width: 100%; height: auto; }
    @media only screen and (max-width: 600px) {
      .email-container { max-width: 100% !important; }
      .mobile-padding { padding: 10px !important; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${template.components.map(component => generateComponentHTML(component)).join('')}
  </div>
</body>
</html>`
    return html
  }

  const generateComponentHTML = (component: EmailComponent): string => {
    switch (component.type) {
      case 'heading':
      case 'text':
        return `<div style="font-size: ${component.content.fontSize}px; font-weight: ${component.content.fontWeight}; color: ${component.content.color}; text-align: ${component.content.textAlign}; padding: ${component.content.padding}; margin: ${component.content.margin}; background-color: ${component.content.backgroundColor || 'transparent'};">${component.content.text}</div>`

      case 'image':
        return `<div style="padding: ${component.content.padding}; margin: ${component.content.margin};"><img src="${component.content.src}" alt="${component.content.alt}" class="responsive-image" style="width: ${component.content.width}; height: ${component.content.height};" /></div>`

      case 'button':
        return `<div style="text-align: ${component.content.textAlign}; margin: ${component.content.margin};"><a href="${component.content.href}" style="display: inline-block; background-color: ${component.content.backgroundColor}; color: ${component.content.color}; font-size: ${component.content.fontSize}px; font-weight: ${component.content.fontWeight}; padding: ${component.content.padding}; border-radius: ${component.content.borderRadius}; text-decoration: none;">${component.content.text}</a></div>`

      case 'divider':
        return `<div style="height: ${component.content.height}; background-color: ${component.content.backgroundColor}; margin: ${component.content.margin};"></div>`

      case 'spacer':
        return `<div style="height: ${component.content.height}; background-color: ${component.content.backgroundColor || 'transparent'};"></div>`

      default:
        return ''
    }
  }

  const extractVariables = () => {
    const variables: string[] = []
    template.components.forEach(component => {
      if (component.content.text) {
        const matches = component.content.text.match(/\{\{([^}]+)\}\}/g)
        if (matches) {
          matches.forEach(match => {
            const variable = match.replace(/\{\{|\}\}/g, '').trim()
            if (!variables.includes(variable)) {
              variables.push(variable)
            }
          })
        }
      }
    })
    return variables
  }

  const getPreviewWidth = () => {
    switch (previewMode) {
      case 'mobile': return '375px'
      case 'tablet': return '768px'
      default: return template.settings.maxWidth
    }
  }

  const activeComponent = COMPONENT_TYPES.find(c => activeId?.startsWith(`component-${c.id}`))

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Editor WYSIWYG</h1>
                <p className="text-sm text-gray-600">Crie templates visuais com drag-and-drop</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex border rounded-lg p-1">
                <Button
                  size="sm"
                  variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                  onClick={() => setPreviewMode('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={previewMode === 'tablet' ? 'default' : 'ghost'}
                  onClick={() => setPreviewMode('tablet')}
                >
                  <Tablet className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                  onClick={() => setPreviewMode('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button onClick={saveTemplate} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Salvando...' : 'Salvar Template'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Component Palette */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <Tabs defaultValue="components" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="components">Componentes</TabsTrigger>
                  <TabsTrigger value="settings">Configurações</TabsTrigger>
                </TabsList>

                <TabsContent value="components" className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Componentes Disponíveis</h3>
                    <div className="space-y-2">
                      {COMPONENT_TYPES.map(component => {
                        const Icon = component.icon
                        return (
                          <div
                            key={component.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', `component-${component.id}`)
                            }}
                            className="bg-white border border-gray-200 rounded-lg p-3 cursor-grab hover:border-gray-300 transition-colors active:cursor-grabbing"
                            onClick={() => addComponent(component.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded ${component.color} flex items-center justify-center text-white`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">{component.name}</div>
                                <div className="text-xs text-gray-500">{component.description}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="template-name">Nome do Template</Label>
                      <Input
                        id="template-name"
                        value={template.name}
                        onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Newsletter Mensal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="template-subject">Assunto Padrão</Label>
                      <Input
                        id="template-subject"
                        value={template.subject}
                        onChange={(e) => setTemplate(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Ex: {{name}}, confira nossas novidades!"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bg-color">Cor de Fundo</Label>
                      <div className="flex gap-2">
                        <Input
                          id="bg-color"
                          type="color"
                          value={template.settings.backgroundColor}
                          onChange={(e) => setTemplate(prev => ({
                            ...prev,
                            settings: { ...prev.settings, backgroundColor: e.target.value }
                          }))}
                          className="w-16"
                        />
                        <Input
                          value={template.settings.backgroundColor}
                          onChange={(e) => setTemplate(prev => ({
                            ...prev,
                            settings: { ...prev.settings, backgroundColor: e.target.value }
                          }))}
                          placeholder="#f8fafc"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="max-width">Largura Máxima</Label>
                      <Select
                        value={template.settings.maxWidth}
                        onValueChange={(value) => setTemplate(prev => ({
                          ...prev,
                          settings: { ...prev.settings, maxWidth: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="500px">500px (Estreito)</SelectItem>
                          <SelectItem value="600px">600px (Padrão)</SelectItem>
                          <SelectItem value="700px">700px (Largo)</SelectItem>
                          <SelectItem value="100%">100% (Responsivo)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="font-family">Fonte</Label>
                      <Select
                        value={template.settings.fontFamily}
                        onValueChange={(value) => setTemplate(prev => ({
                          ...prev,
                          settings: { ...prev.settings, fontFamily: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                          <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
                          <SelectItem value="Georgia, serif">Georgia</SelectItem>
                          <SelectItem value="Times, serif">Times</SelectItem>
                          <SelectItem value="'Courier New', monospace">Courier New</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-gray-100 p-6">
            <div className="flex justify-center">
              <div
                className="bg-white shadow-lg transition-all duration-300"
                style={{
                  width: getPreviewWidth(),
                  minHeight: '600px',
                  backgroundColor: template.settings.backgroundColor,
                  fontFamily: template.settings.fontFamily
                }}
              >
                {template.components.length === 0 ? (
                  <div className="text-center py-16 px-8">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Type className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Comece criando seu template
                    </h3>
                    <p className="text-gray-500 mb-6">
                      Arraste componentes da barra lateral ou clique neles para adicionar
                    </p>
                    <Button
                      onClick={() => addComponent('heading')}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Adicionar Primeiro Componente
                    </Button>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={template.components.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 p-4">
                        {template.components.map((component) => (
                          <SortableComponent
                            key={component.id}
                            component={component}
                            onEdit={editComponent}
                            onDelete={deleteComponent}
                            onDuplicate={duplicateComponent}
                          />
                        ))}
                      </div>
                    </SortableContext>

                    <DragOverlay>
                      {activeComponent ? (
                        <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-lg opacity-90">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${activeComponent.color} flex items-center justify-center text-white`}>
                              <activeComponent.icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-medium">{activeComponent.name}</h4>
                              <p className="text-sm text-gray-500">{activeComponent.description}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Component Edit Dialog */}
        <Dialog open={!!editingComponent} onOpenChange={() => setEditingComponent(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Componente</DialogTitle>
              <DialogDescription>
                Configure as propriedades do componente
              </DialogDescription>
            </DialogHeader>
            {editingComponent && (
              <ComponentEditor
                component={editingComponent}
                onUpdate={updateComponent}
                onCancel={() => setEditingComponent(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

interface ComponentEditorProps {
  component: EmailComponent
  onUpdate: (component: EmailComponent) => void
  onCancel: () => void
}

function ComponentEditor({ component, onUpdate, onCancel }: ComponentEditorProps) {
  const [editedComponent, setEditedComponent] = useState<EmailComponent>({ ...component })

  const updateContent = (key: string, value: any) => {
    setEditedComponent(prev => ({
      ...prev,
      content: { ...prev.content, [key]: value }
    }))
  }

  const handleSave = () => {
    onUpdate(editedComponent)
  }

  return (
    <div className="space-y-6">
      {/* Text/Heading Components */}
      {(component.type === 'text' || component.type === 'heading') && (
        <div className="space-y-4">
          <div>
            <Label>Texto</Label>
            <Textarea
              value={editedComponent.content.text || ''}
              onChange={(e) => updateContent('text', e.target.value)}
              rows={3}
              placeholder="Digite seu texto aqui..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Use {'{{variavel}}'} para personalização dinâmica
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tamanho da Fonte</Label>
              <Input
                type="number"
                value={editedComponent.content.fontSize || 16}
                onChange={(e) => updateContent('fontSize', parseInt(e.target.value))}
                min="8"
                max="72"
              />
            </div>
            <div>
              <Label>Peso da Fonte</Label>
              <Select
                value={editedComponent.content.fontWeight || 'normal'}
                onValueChange={(value) => updateContent('fontWeight', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Negrito</SelectItem>
                  <SelectItem value="lighter">Mais Fino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cor do Texto</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={editedComponent.content.color || '#000000'}
                  onChange={(e) => updateContent('color', e.target.value)}
                  className="w-16"
                />
                <Input
                  value={editedComponent.content.color || '#000000'}
                  onChange={(e) => updateContent('color', e.target.value)}
                  placeholder="#000000"
                />
              </div>
            </div>
            <div>
              <Label>Alinhamento</Label>
              <Select
                value={editedComponent.content.textAlign || 'left'}
                onValueChange={(value) => updateContent('textAlign', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                  <SelectItem value="justify">Justificado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Cor de Fundo</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={editedComponent.content.backgroundColor || '#ffffff'}
                onChange={(e) => updateContent('backgroundColor', e.target.value)}
                className="w-16"
              />
              <Input
                value={editedComponent.content.backgroundColor || '#ffffff'}
                onChange={(e) => updateContent('backgroundColor', e.target.value)}
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Padding</Label>
              <Input
                value={editedComponent.content.padding || '16px'}
                onChange={(e) => updateContent('padding', e.target.value)}
                placeholder="16px"
              />
            </div>
            <div>
              <Label>Margin</Label>
              <Input
                value={editedComponent.content.margin || '0px'}
                onChange={(e) => updateContent('margin', e.target.value)}
                placeholder="0px"
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Component */}
      {component.type === 'image' && (
        <div className="space-y-4">
          <div>
            <Label>URL da Imagem</Label>
            <Input
              value={editedComponent.content.src || ''}
              onChange={(e) => updateContent('src', e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
            />
          </div>
          <div>
            <Label>Texto Alternativo</Label>
            <Input
              value={editedComponent.content.alt || ''}
              onChange={(e) => updateContent('alt', e.target.value)}
              placeholder="Descrição da imagem"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Largura</Label>
              <Input
                value={editedComponent.content.width || '100%'}
                onChange={(e) => updateContent('width', e.target.value)}
                placeholder="100%"
              />
            </div>
            <div>
              <Label>Altura</Label>
              <Input
                value={editedComponent.content.height || 'auto'}
                onChange={(e) => updateContent('height', e.target.value)}
                placeholder="auto"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Padding</Label>
              <Input
                value={editedComponent.content.padding || '16px'}
                onChange={(e) => updateContent('padding', e.target.value)}
                placeholder="16px"
              />
            </div>
            <div>
              <Label>Margin</Label>
              <Input
                value={editedComponent.content.margin || '0px'}
                onChange={(e) => updateContent('margin', e.target.value)}
                placeholder="0px"
              />
            </div>
          </div>
        </div>
      )}

      {/* Button Component */}
      {component.type === 'button' && (
        <div className="space-y-4">
          <div>
            <Label>Texto do Botão</Label>
            <Input
              value={editedComponent.content.text || ''}
              onChange={(e) => updateContent('text', e.target.value)}
              placeholder="Clique Aqui"
            />
          </div>
          <div>
            <Label>Link (URL)</Label>
            <Input
              value={editedComponent.content.href || ''}
              onChange={(e) => updateContent('href', e.target.value)}
              placeholder="https://exemplo.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cor de Fundo</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={editedComponent.content.backgroundColor || '#3b82f6'}
                  onChange={(e) => updateContent('backgroundColor', e.target.value)}
                  className="w-16"
                />
                <Input
                  value={editedComponent.content.backgroundColor || '#3b82f6'}
                  onChange={(e) => updateContent('backgroundColor', e.target.value)}
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            <div>
              <Label>Cor do Texto</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={editedComponent.content.color || '#ffffff'}
                  onChange={(e) => updateContent('color', e.target.value)}
                  className="w-16"
                />
                <Input
                  value={editedComponent.content.color || '#ffffff'}
                  onChange={(e) => updateContent('color', e.target.value)}
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Padding</Label>
              <Input
                value={editedComponent.content.padding || '12px 24px'}
                onChange={(e) => updateContent('padding', e.target.value)}
                placeholder="12px 24px"
              />
            </div>
            <div>
              <Label>Border Radius</Label>
              <Input
                value={editedComponent.content.borderRadius || '6px'}
                onChange={(e) => updateContent('borderRadius', e.target.value)}
                placeholder="6px"
              />
            </div>
          </div>
          <div>
            <Label>Alinhamento</Label>
            <Select
              value={editedComponent.content.textAlign || 'center'}
              onValueChange={(value) => updateContent('textAlign', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Divider Component */}
      {component.type === 'divider' && (
        <div className="space-y-4">
          <div>
            <Label>Altura</Label>
            <Input
              value={editedComponent.content.height || '1px'}
              onChange={(e) => updateContent('height', e.target.value)}
              placeholder="1px"
            />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={editedComponent.content.backgroundColor || '#e5e7eb'}
                onChange={(e) => updateContent('backgroundColor', e.target.value)}
                className="w-16"
              />
              <Input
                value={editedComponent.content.backgroundColor || '#e5e7eb'}
                onChange={(e) => updateContent('backgroundColor', e.target.value)}
                placeholder="#e5e7eb"
              />
            </div>
          </div>
          <div>
            <Label>Margin</Label>
            <Input
              value={editedComponent.content.margin || '24px 16px'}
              onChange={(e) => updateContent('margin', e.target.value)}
              placeholder="24px 16px"
            />
          </div>
        </div>
      )}

      {/* Spacer Component */}
      {component.type === 'spacer' && (
        <div className="space-y-4">
          <div>
            <Label>Altura</Label>
            <Input
              value={editedComponent.content.height || '32px'}
              onChange={(e) => updateContent('height', e.target.value)}
              placeholder="32px"
            />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave}>
          Salvar Alterações
        </Button>
      </DialogFooter>
    </div>
  )
}
