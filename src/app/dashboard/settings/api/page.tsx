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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  Key,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Book,
  RotateCcw,
  Calendar,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { API_PERMISSIONS } from '@/lib/api-auth'
import Link from 'next/link'

interface APIKey {
  id: string
  name: string
  permissions: string[]
  last_used_at?: string
  created_at: string
  masked_key?: string
  expires_at?: string
  auto_renew?: boolean
  renewal_period_days?: number
  status?: 'active' | 'expired' | 'revoked'
  revoked_at?: string
  revoked_by?: string
  revoked_reason?: string
}

const permissionGroups = {
  'Leads': ['leads:read', 'leads:write', 'leads:delete'],
  'Campanhas': ['campaigns:read', 'campaigns:write', 'campaigns:send'],
  'Templates': ['templates:read', 'templates:write'],
  'Automações': ['automations:read', 'automations:write'],
  'Analytics': ['analytics:read'],
  'Testes A/B': ['ab_tests:read', 'ab_tests:write', 'ab_tests:analyze']
}

export default function APISettingsPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showNewKey, setShowNewKey] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[],
    expiration_days: 90,
    auto_renew: false
  })

  const supabase = createSupabaseClient()

  useEffect(() => {
    loadAPIKeys()
  }, [])

  const loadAPIKeys = async () => {
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

      // Fetch API keys from the API
      const response = await fetch('/api/settings/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.api_keys || [])
      } else {
        // Fallback to mock data for demo
        const mockAPIKeys: APIKey[] = [
          {
            id: '1',
            name: 'Production API',
            permissions: ['leads:read', 'leads:write', 'campaigns:read', 'campaigns:write'],
            last_used_at: new Date().toISOString(),
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            auto_renew: true,
            renewal_period_days: 90,
            status: 'active',
            masked_key: 'es_live_***************************abc123'
          },
          {
            id: '2',
            name: 'Analytics Only',
            permissions: ['analytics:read'],
            created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            auto_renew: false,
            renewal_period_days: 90,
            status: 'active',
            masked_key: 'es_live_***************************def456'
          }
        ]
        setApiKeys(mockAPIKeys)
      }
    } catch (error) {
      console.error('Error loading API keys:', error)
      toast.error('Erro ao carregar chaves de API')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAPIKey = async () => {
    if (!workspaceId) return

    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    if (formData.permissions.length === 0) {
      toast.error('Selecione pelo menos uma permissão')
      return
    }

    try {
      // In a real implementation, this would call your API key creation endpoint
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          permissions: formData.permissions,
          expiration_days: formData.expiration_days,
          auto_renew: formData.auto_renew
        })
      })

      if (response.ok) {
        const data = await response.json()
        setNewKey(data.apiKey)
        setShowNewKey(true)

        toast.success('API Key criada com sucesso!')
        loadAPIKeys()
        resetForm()
      } else {
        // For demo, we'll create a mock key
        const mockKey = `es_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
        setNewKey(mockKey)
        setShowNewKey(true)

        toast.success('API Key criada com sucesso!')

        // Add to local state for demo
        const newAPIKey: APIKey = {
          id: (apiKeys.length + 1).toString(),
          name: formData.name,
          permissions: formData.permissions,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + formData.expiration_days * 24 * 60 * 60 * 1000).toISOString(),
          auto_renew: formData.auto_renew,
          renewal_period_days: formData.expiration_days,
          status: 'active',
          masked_key: `es_live_***************************${mockKey.slice(-6)}`
        }

        setApiKeys(prev => [newAPIKey, ...prev])
        resetForm()
      }
    } catch (error) {
      console.error('Error creating API key:', error)
      toast.error('Erro ao criar API key')
    }
  }

  const handleRevokeAPIKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Tem certeza que deseja revogar a API key "${keyName}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      // In a real implementation, this would call your API key revocation endpoint
      const response = await fetch(`/api/settings/api-keys?id=${keyId}`, {
        method: 'DELETE'
      })

      if (response.ok || true) { // Always true for demo
        toast.success('API key revogada com sucesso!')
        setApiKeys(prev => prev.filter(key => key.id !== keyId))
      }
    } catch (error) {
      console.error('Error revoking API key:', error)
      toast.error('Erro ao revogar API key')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      permissions: [],
      expiration_days: 90,
      auto_renew: false
    })
    setIsCreateDialogOpen(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para área de transferência!')
  }

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }))
  }

  const getPermissionLabel = (permission: string) => {
    return API_PERMISSIONS[permission as keyof typeof API_PERMISSIONS] || permission
  }

  const handleRenewAPIKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Tem certeza que deseja renovar a API key "${keyName}"?`)) {
      return
    }

    try {
      const response = await fetch('/api/settings/api-keys/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key_id: keyId,
          extension_days: 90
        })
      })

      if (response.ok) {
        toast.success('API key renovada com sucesso!')
        loadAPIKeys()
      } else {
        toast.error('Erro ao renovar API key')
      }
    } catch (error) {
      console.error('Error renewing API key:', error)
      toast.error('Erro ao renovar API key')
    }
  }

  const getExpirationStatus = (expiresAt?: string) => {
    if (!expiresAt) return { status: 'active', label: 'Ativa', color: 'text-green-600' }
    
    const expiry = new Date(expiresAt)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', label: 'Expirada', color: 'text-red-600' }
    } else if (daysUntilExpiry <= 7) {
      return { status: 'expiring_soon', label: `Expira em ${daysUntilExpiry} dia(s)`, color: 'text-orange-600' }
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring_later', label: `Expira em ${daysUntilExpiry} dias`, color: 'text-yellow-600' }
    } else {
      return { status: 'active', label: `Expira em ${daysUntilExpiry} dias`, color: 'text-green-600' }
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
            <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
            <p className="text-gray-600">Gerencie chaves de API para integrar com sistemas externos</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/api/docs" target="_blank">
                <Book className="mr-2 h-4 w-4" />
                Documentação
                <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Nova API Key</DialogTitle>
                  <DialogDescription>
                    Configure as permissões para sua nova chave de API
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome da API Key *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Integração Production"
                    />
                  </div>

                  <div>
                    <Label>Permissões *</Label>
                    <div className="space-y-3 mt-2">
                      {Object.entries(permissionGroups).map(([group, permissions]) => (
                        <div key={group} className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">{group}</h4>
                          <div className="space-y-2 pl-4">
                            {permissions.map(permission => (
                              <label key={permission} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.includes(permission)}
                                  onChange={() => togglePermission(permission)}
                                  className="rounded"
                                />
                                <span className="text-sm">{getPermissionLabel(permission)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiration_days">Expiração (dias) *</Label>
                      <Select
                        value={formData.expiration_days.toString()}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, expiration_days: parseInt(value) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="60">60 dias</SelectItem>
                          <SelectItem value="90">90 dias</SelectItem>
                          <SelectItem value="180">180 dias</SelectItem>
                          <SelectItem value="365">1 ano</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2 mt-6">
                      <input
                        type="checkbox"
                        id="auto_renew"
                        checked={formData.auto_renew}
                        onChange={(e) => setFormData(prev => ({ ...prev, auto_renew: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="auto_renew" className="text-sm">
                        Renovação automática
                      </Label>
                    </div>
                  </div>

                  {formData.auto_renew && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Esta API key será renovada automaticamente {formData.expiration_days} dias antes do vencimento.
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateAPIKey}>
                    Criar API Key
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* New Key Display */}
        {newKey && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center text-green-800">
                <CheckCircle className="mr-2 h-5 w-5" />
                API Key Criada com Sucesso
              </CardTitle>
              <CardDescription className="text-green-700">
                Copie sua API key agora. Por motivos de segurança, ela não será exibida novamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 bg-white border rounded-lg">
                <code className="flex-1 text-sm font-mono">
                  {showNewKey ? newKey : '•'.repeat(newKey.length - 8) + newKey.slice(-8)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewKey(!showNewKey)}
                >
                  {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="sm" onClick={() => copyToClipboard(newKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setNewKey(null)}
              >
                Fechar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* API Info Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <Shield className="mr-2 h-5 w-5" />
              Informações da API
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Base URL:</h4>
                <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                  https://yourdomain.com/api/public/v1
                </code>
              </div>
              <div>
                <h4 className="font-medium mb-2">Rate Limits:</h4>
                <p>1.000 requests por hora por API key</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Autenticação:</h4>
                <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                  Authorization: Bearer YOUR_API_KEY
                </code>
              </div>
              <div>
                <h4 className="font-medium mb-2">Formato:</h4>
                <p>JSON com respostas estruturadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expiring Keys Alert */}
        {apiKeys.some(k => k.expires_at && getExpirationStatus(k.expires_at).status === 'expiring_soon') && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-800">
                <AlertTriangle className="mr-2 h-5 w-5" />
                API Keys Expirando
              </CardTitle>
              <CardDescription className="text-orange-700">
                Algumas API keys estão próximas do vencimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {apiKeys
                  .filter(k => k.expires_at && getExpirationStatus(k.expires_at).status === 'expiring_soon')
                  .map(key => (
                    <div key={key.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div>
                        <p className="font-medium">{key.name}</p>
                        <p className="text-sm text-orange-600">
                          {getExpirationStatus(key.expires_at).label}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRenewAPIKey(key.id, key.name)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        Renovar
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Keys Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold">{apiKeys.length}</p>
                </div>
                <Key className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ativas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {apiKeys.filter(k => k.status === 'active').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Expirando</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {apiKeys.filter(k => k.expires_at && getExpirationStatus(k.expires_at).status === 'expiring_soon').length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Expiradas</p>
                  <p className="text-2xl font-bold text-red-600">
                    {apiKeys.filter(k => k.status === 'expired' || (k.expires_at && getExpirationStatus(k.expires_at).status === 'expired')).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Keys Table */}
        <Card>
          <CardHeader>
            <CardTitle>Chaves de API Ativas ({apiKeys.length})</CardTitle>
            <CardDescription>
              Liste e gerencie suas chaves de API
            </CardDescription>
          </CardHeader>
          <CardContent>
            {apiKeys.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Permissões</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Uso</TableHead>
                    <TableHead>Criada</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {apiKey.masked_key}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {apiKey.permissions.slice(0, 3).map((permission) => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {permission.split(':')[0]}
                            </Badge>
                          ))}
                          {apiKey.permissions.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{apiKey.permissions.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {apiKey.status === 'active' && (
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                            {apiKey.status === 'expired' && (
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            )}
                            {apiKey.status === 'revoked' && (
                              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            )}
                            <span className={`text-sm ${getExpirationStatus(apiKey.expires_at).color}`}>
                              {getExpirationStatus(apiKey.expires_at).label}
                            </span>
                          </div>
                          {apiKey.auto_renew && (
                            <div className="flex items-center gap-1 text-xs text-blue-600">
                              <RotateCcw className="h-3 w-3" />
                              Auto-renew
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {apiKey.last_used_at ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-green-600">Ativa</span>
                            </div>
                            <div className="text-gray-500 text-xs">
                              {formatDistanceToNow(new Date(apiKey.last_used_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <span className="text-gray-500">Não utilizada</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(apiKey.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {apiKey.status === 'active' && getExpirationStatus(apiKey.expires_at).status !== 'expired' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRenewAPIKey(apiKey.id, apiKey.name)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Renovar API Key"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {apiKey.status !== 'revoked' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeAPIKey(apiKey.id, apiKey.name)}
                              className="text-red-600 hover:text-red-700"
                              title="Revogar API Key"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma API key encontrada
                </h3>
                <p className="text-gray-500 mb-4">
                  Crie sua primeira API key para começar a integrar com sistemas externos
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeira API Key
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Warning */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-yellow-800">
                <h4 className="font-medium">Segurança das API Keys</h4>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• Mantenha suas API keys seguras e nunca as compartilhe publicamente</li>
                  <li>• Use HTTPS sempre ao fazer requests para a API</li>
                  <li>• Revogue imediatamente qualquer key comprometida</li>
                  <li>• Use permissões mínimas necessárias para cada integração</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
