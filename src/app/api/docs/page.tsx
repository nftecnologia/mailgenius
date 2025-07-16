'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Code,
  ChevronDown,
  ChevronRight,
  Copy,
  Play,
  Shield,
  Zap,
  Database,
  BarChart,
  Mail,
  Users,
  Layout,
  Key,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  summary: string
  description: string
  parameters?: Array<{
    name: string
    in: 'query' | 'path' | 'body'
    required: boolean
    type: string
    description: string
    example?: any
  }>
  responses: Array<{
    status: number
    description: string
    example?: any
  }>
  auth?: boolean
  permissions?: string[]
}

const endpoints: APIEndpoint[] = [
  // Leads endpoints
  {
    method: 'GET',
    path: '/api/public/v1/leads',
    summary: 'List leads',
    description: 'Retrieve a paginated list of leads from your workspace',
    auth: true,
    permissions: ['leads:read'],
    parameters: [
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page number (default: 1)', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Items per page (max: 100)', example: 50 },
      { name: 'status', in: 'query', required: false, type: 'string', description: 'Filter by status', example: 'active' },
      { name: 'source', in: 'query', required: false, type: 'string', description: 'Filter by source', example: 'website' },
      { name: 'tags', in: 'query', required: false, type: 'string', description: 'Filter by tags (comma-separated)', example: 'vip,premium' }
    ],
    responses: [
      {
        status: 200,
        description: 'Successful response',
        example: {
          success: true,
          data: {
            leads: [
              {
                id: 'uuid',
                email: 'john@example.com',
                name: 'John Doe',
                phone: '+1234567890',
                company: 'Acme Corp',
                position: 'CEO',
                source: 'website',
                status: 'active',
                tags: ['vip', 'premium'],
                custom_fields: {},
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z'
              }
            ],
            pagination: {
              page: 1,
              limit: 50,
              total: 150,
              totalPages: 3,
              hasNext: true,
              hasPrev: false
            }
          },
          timestamp: '2024-01-15T10:00:00Z'
        }
      }
    ]
  },
  {
    method: 'POST',
    path: '/api/public/v1/leads',
    summary: 'Create lead',
    description: 'Add a new lead to your workspace',
    auth: true,
    permissions: ['leads:write'],
    parameters: [
      {
        name: 'body',
        in: 'body',
        required: true,
        type: 'object',
        description: 'Lead data',
        example: {
          email: 'jane@example.com',
          name: 'Jane Smith',
          phone: '+1987654321',
          company: 'Tech Corp',
          position: 'CTO',
          source: 'api',
          tags: ['enterprise', 'tech'],
          custom_fields: {
            industry: 'Technology',
            employees: '100-500'
          }
        }
      }
    ],
    responses: [
      {
        status: 201,
        description: 'Lead created successfully',
        example: {
          success: true,
          data: {
            id: 'uuid',
            email: 'jane@example.com',
            name: 'Jane Smith',
            workspace_id: 'workspace-uuid',
            status: 'active',
            created_at: '2024-01-15T10:00:00Z'
          }
        }
      },
      {
        status: 409,
        description: 'Lead with email already exists',
        example: {
          success: false,
          error: {
            message: 'Lead with this email already exists',
            code: 'DUPLICATE_EMAIL'
          }
        }
      }
    ]
  },
  // Campaigns endpoints
  {
    method: 'GET',
    path: '/api/public/v1/campaigns',
    summary: 'List campaigns',
    description: 'Retrieve a paginated list of campaigns',
    auth: true,
    permissions: ['campaigns:read'],
    parameters: [
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page number', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Items per page', example: 50 },
      { name: 'status', in: 'query', required: false, type: 'string', description: 'Filter by status', example: 'sent' },
      { name: 'include_stats', in: 'query', required: false, type: 'boolean', description: 'Include detailed statistics', example: true }
    ],
    responses: [
      {
        status: 200,
        description: 'Successful response',
        example: {
          success: true,
          data: {
            campaigns: [
              {
                id: 'uuid',
                name: 'Newsletter January',
                subject: 'Welcome to 2024!',
                status: 'sent',
                total_recipients: 1000,
                delivered: 985,
                opened: 295,
                clicked: 47,
                created_at: '2024-01-15T10:00:00Z',
                stats: {
                  delivery_rate: '98.50',
                  open_rate: '29.95',
                  click_rate: '15.93',
                  unsubscribe_rate: '0.20'
                }
              }
            ],
            pagination: {
              page: 1,
              limit: 50,
              total: 25,
              totalPages: 1,
              hasNext: false,
              hasPrev: false
            }
          }
        }
      }
    ]
  },
  {
    method: 'POST',
    path: '/api/public/v1/campaigns/send',
    summary: 'Send campaign',
    description: 'Send a campaign immediately or schedule it',
    auth: true,
    permissions: ['campaigns:send'],
    parameters: [
      {
        name: 'body',
        in: 'body',
        required: true,
        type: 'object',
        description: 'Send configuration',
        example: {
          campaign_id: 'campaign-uuid',
          send_immediately: true
        }
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Campaign sent successfully',
        example: {
          success: true,
          data: {
            campaign_id: 'campaign-uuid',
            status: 'sending',
            total_recipients: 1000,
            message: 'Campaign is being sent'
          }
        }
      }
    ]
  },
  // Analytics endpoint
  {
    method: 'GET',
    path: '/api/public/v1/analytics',
    summary: 'Get analytics',
    description: 'Retrieve analytics data for your workspace',
    auth: true,
    permissions: ['analytics:read'],
    parameters: [
      { name: 'type', in: 'query', required: true, type: 'string', description: 'Analytics type: overview, campaigns, leads, performance', example: 'overview' },
      { name: 'start_date', in: 'query', required: false, type: 'string', description: 'Start date (ISO format)', example: '2024-01-01T00:00:00Z' },
      { name: 'end_date', in: 'query', required: false, type: 'string', description: 'End date (ISO format)', example: '2024-01-31T23:59:59Z' },
      { name: 'campaign_id', in: 'query', required: false, type: 'string', description: 'Specific campaign ID (for campaigns type)', example: 'campaign-uuid' }
    ],
    responses: [
      {
        status: 200,
        description: 'Analytics data',
        example: {
          success: true,
          data: {
            type: 'overview',
            period: {
              start_date: '2024-01-01T00:00:00Z',
              end_date: '2024-01-31T23:59:59Z'
            },
            summary: {
              total_campaigns: 5,
              total_leads: 1500,
              emails_sent: 7500,
              delivery_rate: 98.2,
              open_rate: 24.5,
              click_rate: 5.8
            }
          }
        }
      }
    ]
  },
  // A/B Testing endpoints
  {
    method: 'GET',
    path: '/api/public/v1/ab-tests',
    summary: 'List A/B tests',
    description: 'Retrieve a paginated list of A/B tests',
    auth: true,
    permissions: ['ab_tests:read'],
    parameters: [
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page number', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Items per page', example: 50 },
      { name: 'status', in: 'query', required: false, type: 'string', description: 'Filter by status', example: 'completed' },
      { name: 'test_type', in: 'query', required: false, type: 'string', description: 'Filter by test type', example: 'subject_line' },
      { name: 'include_analysis', in: 'query', required: false, type: 'boolean', description: 'Include statistical analysis', example: true }
    ],
    responses: [
      {
        status: 200,
        description: 'Successful response',
        example: {
          success: true,
          data: {
            ab_tests: [
              {
                id: 'test_001',
                name: 'Subject Line Test - Newsletter',
                description: 'Testing direct vs curious subject lines',
                test_type: 'subject_line',
                status: 'completed',
                variants: [
                  {
                    id: 'control',
                    name: 'Control - Direct',
                    content: 'Weekly Newsletter - Company Updates',
                    recipients: 1000,
                    opened: 245,
                    clicked: 47
                  }
                ],
                winner_variant_id: 'variant_1',
                confidence_level: 95,
                created_at: '2024-01-15T10:00:00Z'
              }
            ],
            pagination: {
              page: 1,
              limit: 50,
              total: 5,
              totalPages: 1
            }
          }
        }
      }
    ]
  },
  {
    method: 'POST',
    path: '/api/public/v1/ab-tests',
    summary: 'Create A/B test',
    description: 'Create a new A/B test with variants',
    auth: true,
    permissions: ['ab_tests:write'],
    parameters: [
      {
        name: 'body',
        in: 'body',
        required: true,
        type: 'object',
        description: 'A/B test configuration',
        example: {
          name: 'Subject Line Test',
          description: 'Testing different subject line styles',
          hypothesis: 'Direct subject lines will have higher open rates',
          test_type: 'subject_line',
          variants: [
            {
              name: 'Control - Direct',
              content: 'Weekly Newsletter - Company Updates'
            },
            {
              name: 'Variant - Curious',
              content: 'You won\'t believe what happened this week...'
            }
          ],
          confidence_level: 95,
          test_duration_days: 7,
          total_audience_size: 2000
        }
      }
    ],
    responses: [
      {
        status: 201,
        description: 'A/B test created successfully',
        example: {
          success: true,
          data: {
            id: 'test_001',
            name: 'Subject Line Test',
            test_type: 'subject_line',
            status: 'draft',
            variants: [],
            created_at: '2024-01-15T10:00:00Z'
          }
        }
      }
    ]
  },
  {
    method: 'GET',
    path: '/api/public/v1/ab-tests/{id}/analysis',
    summary: 'Get A/B test analysis',
    description: 'Retrieve detailed statistical analysis for a specific A/B test',
    auth: true,
    permissions: ['ab_tests:read'],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'A/B test ID', example: 'test_001' },
      { name: 'include_recommendations', in: 'query', required: false, type: 'boolean', description: 'Include optimization recommendations', example: true },
      { name: 'include_confidence_intervals', in: 'query', required: false, type: 'boolean', description: 'Include confidence intervals', example: true }
    ],
    responses: [
      {
        status: 200,
        description: 'Statistical analysis results',
        example: {
          success: true,
          data: {
            test_id: 'test_001',
            test_name: 'Subject Line Test',
            analysis: {
              metrics: {
                open_rate: {
                  control: 0.245,
                  variant: 0.287,
                  improvement: 0.042,
                  improvement_percentage: 17.1
                }
              },
              statistical_significance: {
                overall_winner: 'B',
                confidence_level: 95,
                recommendation: 'Variant B is the clear winner. Deploy this version.',
                metrics: {
                  open_rate: {
                    p_value: 0.03,
                    is_significant: true,
                    power: 0.85
                  }
                }
              }
            },
            variants: []
          }
        }
      }
    ]
  }
]

const HTTPMethodBadge = ({ method }: { method: string }) => {
  const colors = {
    GET: 'bg-blue-100 text-blue-800',
    POST: 'bg-green-100 text-green-800',
    PUT: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800'
  }

  return (
    <Badge className={`${colors[method as keyof typeof colors]} font-mono text-xs`}>
      {method}
    </Badge>
  )
}

export default function APIDocsPage() {
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({})
  const [apiKey, setApiKey] = useState('')
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null)

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para área de transferência!')
  }

  const generateCurlCommand = (endpoint: APIEndpoint) => {
    let curl = `curl -X ${endpoint.method} \\\n`
    curl += `  "https://yourdomain.com${endpoint.path}" \\\n`
    curl += `  -H "Authorization: Bearer YOUR_API_KEY" \\\n`
    curl += `  -H "Content-Type: application/json"`

    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      const bodyParam = endpoint.parameters?.find(p => p.in === 'body')
      if (bodyParam && bodyParam.example) {
        curl += ` \\\n  -d '${JSON.stringify(bodyParam.example, null, 2)}'`
      }
    }

    return curl
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Code className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">EmailSend API</h1>
              <p className="text-gray-600">Documentação completa da API RESTful</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">v1.0</div>
                <div className="text-sm text-gray-600">Versão Atual</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">REST</div>
                <div className="text-sm text-gray-600">Arquitetura</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">JSON</div>
                <div className="text-sm text-gray-600">Formato</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">1000/h</div>
                <div className="text-sm text-gray-600">Rate Limit</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Authentication */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-sm">
                    <Key className="mr-2 h-4 w-4" />
                    Autenticação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-gray-600 mb-2">Use sua API key no header:</p>
                    <code className="text-xs bg-gray-100 p-2 rounded block">
                      Authorization: Bearer YOUR_API_KEY
                    </code>
                  </div>
                  <Input
                    placeholder="Sua API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    type="password"
                  />
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Links Rápidos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <a href="#leads" className="flex items-center text-sm text-blue-600 hover:underline">
                    <Users className="mr-2 h-3 w-3" />
                    Leads
                  </a>
                  <a href="#campaigns" className="flex items-center text-sm text-blue-600 hover:underline">
                    <Mail className="mr-2 h-3 w-3" />
                    Campanhas
                  </a>
                  <a href="#templates" className="flex items-center text-sm text-blue-600 hover:underline">
                    <Layout className="mr-2 h-3 w-3" />
                    Templates
                  </a>
                  <a href="#analytics" className="flex items-center text-sm text-blue-600 hover:underline">
                    <BarChart className="mr-2 h-3 w-3" />
                    Analytics
                  </a>
                  <a href="#ab-tests" className="flex items-center text-sm text-blue-600 hover:underline">
                    <TrendingUp className="mr-2 h-3 w-3" />
                    Testes A/B
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Getting Started */}
            <Card>
              <CardHeader>
                <CardTitle>Primeiros Passos</CardTitle>
                <CardDescription>
                  Como começar a usar a API do EmailSend
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. Obtenha sua API Key</h4>
                  <p className="text-sm text-gray-600">
                    Acesse as configurações do seu dashboard e crie uma nova API key com as permissões necessárias.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">2. Base URL</h4>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    https://yourdomain.com/api/public/v1
                  </code>
                </div>
                <div>
                  <h4 className="font-medium mb-2">3. Exemplo de Request</h4>
                  <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     https://yourdomain.com/api/public/v1/leads`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints */}
            <div className="space-y-6">
              {endpoints.map((endpoint, index) => {
                const endpointId = `${endpoint.method}-${endpoint.path}`.replace(/[^a-zA-Z0-9]/g, '-')
                const isExpanded = expandedSections[endpointId]

                return (
                  <Card key={index}>
                    <Collapsible>
                      <CollapsibleTrigger
                        className="w-full"
                        onClick={() => toggleSection(endpointId)}
                      >
                        <CardHeader className="hover:bg-gray-50">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3 text-left">
                              <HTTPMethodBadge method={endpoint.method} />
                              <div>
                                <CardTitle className="text-base">{endpoint.summary}</CardTitle>
                                <code className="text-sm text-gray-600">{endpoint.path}</code>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {endpoint.auth && <Shield className="h-4 w-4 text-gray-400" />}
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="border-t">
                          <Tabs defaultValue="overview" className="mt-4">
                            <TabsList>
                              <TabsTrigger value="overview">Overview</TabsTrigger>
                              <TabsTrigger value="parameters">Parâmetros</TabsTrigger>
                              <TabsTrigger value="responses">Respostas</TabsTrigger>
                              <TabsTrigger value="examples">Exemplos</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="space-y-4">
                              <p className="text-sm text-gray-600">{endpoint.description}</p>

                              {endpoint.permissions && (
                                <div>
                                  <h4 className="font-medium text-sm mb-2">Permissões Necessárias:</h4>
                                  <div className="flex gap-2">
                                    {endpoint.permissions.map(permission => (
                                      <Badge key={permission} variant="outline">
                                        {permission}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </TabsContent>

                            <TabsContent value="parameters">
                              {endpoint.parameters ? (
                                <div className="space-y-3">
                                  {endpoint.parameters.map((param, paramIndex) => (
                                    <div key={paramIndex} className="border rounded p-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                          {param.name}
                                        </code>
                                        <Badge variant={param.required ? 'destructive' : 'secondary'}>
                                          {param.required ? 'obrigatório' : 'opcional'}
                                        </Badge>
                                        <Badge variant="outline">{param.type}</Badge>
                                        <Badge variant="outline">{param.in}</Badge>
                                      </div>
                                      <p className="text-sm text-gray-600 mb-2">{param.description}</p>
                                      {param.example && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-500 mb-1">Exemplo:</p>
                                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                            {typeof param.example === 'object'
                                              ? JSON.stringify(param.example, null, 2)
                                              : param.example
                                            }
                                          </code>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">Nenhum parâmetro necessário</p>
                              )}
                            </TabsContent>

                            <TabsContent value="responses">
                              <div className="space-y-3">
                                {endpoint.responses.map((response, respIndex) => (
                                  <div key={respIndex} className="border rounded p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge
                                        variant={response.status < 300 ? 'default' : 'destructive'}
                                      >
                                        {response.status}
                                      </Badge>
                                      <span className="text-sm font-medium">{response.description}</span>
                                    </div>
                                    {response.example && (
                                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                        {JSON.stringify(response.example, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TabsContent>

                            <TabsContent value="examples">
                              <div className="space-y-4">
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-sm">cURL</h4>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => copyToClipboard(generateCurlCommand(endpoint))}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copiar
                                    </Button>
                                  </div>
                                  <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                                    {generateCurlCommand(endpoint)}
                                  </pre>
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                )
              })}
            </div>

            {/* Error Codes */}
            <Card>
              <CardHeader>
                <CardTitle>Códigos de Erro</CardTitle>
                <CardDescription>
                  Códigos de erro comuns da API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { code: 400, message: 'Bad Request', description: 'Parâmetros inválidos ou em falta' },
                    { code: 401, message: 'Unauthorized', description: 'API key inválida ou em falta' },
                    { code: 403, message: 'Forbidden', description: 'Permissões insuficientes' },
                    { code: 404, message: 'Not Found', description: 'Recurso não encontrado' },
                    { code: 409, message: 'Conflict', description: 'Conflito com recurso existente' },
                    { code: 429, message: 'Too Many Requests', description: 'Rate limit excedido' },
                    { code: 500, message: 'Internal Server Error', description: 'Erro interno do servidor' }
                  ].map(error => (
                    <div key={error.code} className="flex items-center gap-3 p-3 border rounded">
                      <Badge variant="destructive">{error.code}</Badge>
                      <div>
                        <div className="font-medium text-sm">{error.message}</div>
                        <div className="text-xs text-gray-600">{error.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
