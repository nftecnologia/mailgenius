'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  BarChart,
  Play,
  Pause,
  StopCircle,
  Eye,
  Trash2,
  TrendingUp,
  TrendingDown,
  Crown,
  Clock,
  Target,
  Users,
  Zap,
  Bot,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ABTest, ABTestingEngine, TEST_TEMPLATES } from '@/lib/ab-testing'

export default function ABTestsPage() {
  const [tests, setTests] = useState<ABTest[]>([])
  const [filteredTests, setFilteredTests] = useState<ABTest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [testTypeFilter, setTestTypeFilter] = useState('all')
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null)
  const [quickResultsOpen, setQuickResultsOpen] = useState(false)

  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    loadTests()
  }, [])

  useEffect(() => {
    filterTests()
  }, [tests, searchTerm, statusFilter, testTypeFilter])

  const loadTests = async () => {
    try {
      // For demo purposes, load from localStorage
      const storedTests = JSON.parse(localStorage.getItem('ab_tests') || '[]')

      // Add some demo data with realistic results
      const demoTests: ABTest[] = [
        {
          id: 'demo_1',
          workspace_id: 'demo',
          name: 'Teste de Assunto - Newsletter Semanal',
          description: 'Comparando assuntos diretos vs. curiosos',
          hypothesis: 'Assuntos mais diretos terão maior taxa de abertura',
          test_type: 'subject_line',
          status: 'completed',
          variants: [
            {
              id: 'control',
              name: 'Controle - Direto',
              type: 'subject_line' as const,
              content: 'Newsletter Semanal - Novidades da Empresa',
              recipients: 1000,
              sent: 1000,
              delivered: 985,
              opened: 245,
              clicked: 47,
              unsubscribed: 2,
              bounced: 15
            },
            {
              id: 'variant_1',
              name: 'Variante - Curioso',
              type: 'subject_line' as const,
              content: 'Você não vai acreditar no que aconteceu esta semana...',
              recipients: 1000,
              sent: 1000,
              delivered: 992,
              opened: 287,
              clicked: 61,
              unsubscribed: 3,
              bounced: 8
            }
          ],
          control_variant_id: 'control',
          winner_variant_id: 'variant_1',
          confidence_level: 95,
          minimum_sample_size: 1000,
          test_duration_days: 7,
          start_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          total_audience_size: 2000,
          statistical_significance: {
            p_value: 0.03,
            confidence_level: 95,
            is_significant: true,
            winner_lift: 17.1
          },
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'demo_2',
          workspace_id: 'demo',
          name: 'Teste de Horário - Campanhas Promocionais',
          description: 'Melhor horário para enviar promoções',
          hypothesis: 'Envios pela manhã (9h) terão melhor performance que à tarde (14h)',
          test_type: 'send_time',
          status: 'running',
          variants: [
            {
              id: 'control',
              name: 'Controle - 9h da manhã',
              type: 'send_time' as const,
              content: '09:00',
              recipients: 800,
              sent: 800,
              delivered: 792,
              opened: 141,
              clicked: 28,
              unsubscribed: 1,
              bounced: 8
            },
            {
              id: 'variant_1',
              name: 'Variante - 14h da tarde',
              type: 'send_time' as const,
              content: '14:00',
              recipients: 800,
              sent: 800,
              delivered: 796,
              opened: 146,
              clicked: 31,
              unsubscribed: 2,
              bounced: 4
            }
          ],
          control_variant_id: 'control',
          confidence_level: 95,
          minimum_sample_size: 800,
          test_duration_days: 14,
          start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          total_audience_size: 1600,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }
      ]

      setTests([...demoTests, ...storedTests])
    } catch (error) {
      console.error('Error loading A/B tests:', error)
      toast.error('Erro ao carregar testes A/B')
    } finally {
      setLoading(false)
    }
  }

  const filterTests = () => {
    let filtered = tests

    if (searchTerm) {
      filtered = filtered.filter(test =>
        test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(test => test.status === statusFilter)
    }

    if (testTypeFilter !== 'all') {
      filtered = filtered.filter(test => test.test_type === testTypeFilter)
    }

    setFilteredTests(filtered)
  }

  const handleStatusChange = async (testId: string, newStatus: string) => {
    try {
      // In real app, this would update via Supabase
      setTests(prev => prev.map(test =>
        test.id === testId
          ? { ...test, status: newStatus as any, updated_at: new Date().toISOString() }
          : test
      ))

      const actionMap: { [key: string]: string } = {
        'running': 'iniciado',
        'paused': 'pausado',
        'completed': 'finalizado'
      }

      toast.success(`Teste ${actionMap[newStatus] || 'atualizado'} com sucesso!`)
    } catch (error) {
      console.error('Error updating test status:', error)
      toast.error('Erro ao atualizar status do teste')
    }
  }

  const handleDeleteTest = async (testId: string) => {
    if (!confirm('Tem certeza que deseja excluir este teste?')) return

    try {
      setTests(prev => prev.filter(test => test.id !== testId))
      toast.success('Teste excluído com sucesso!')
    } catch (error) {
      console.error('Error deleting test:', error)
      toast.error('Erro ao excluir teste')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
      draft: 'secondary',
      running: 'default',
      completed: 'default',
      paused: 'secondary',
    }

    const labels: { [key: string]: string } = {
      draft: 'Rascunho',
      running: 'Executando',
      completed: 'Concluído',
      paused: 'Pausado',
    }

    const colors: { [key: string]: string } = {
      draft: 'bg-gray-100 text-gray-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
    }

    return (
      <Badge className={colors[status]}>
        {labels[status] || status}
      </Badge>
    )
  }

  const getTestTypeLabel = (type: string) => {
    return TEST_TEMPLATES[type as keyof typeof TEST_TEMPLATES]?.name || type
  }

  const calculateProgress = (test: ABTest) => {
    if (test.status === 'completed') return 100
    if (test.status === 'draft') return 0

    const totalRecipients = test.variants.reduce((sum, v) => sum + v.recipients, 0)
    const targetRecipients = test.minimum_sample_size * test.variants.length
    return Math.min(100, (totalRecipients / targetRecipients) * 100)
  }

  const getWinnerInfo = (test: ABTest) => {
    if (test.status !== 'completed' || !test.winner_variant_id) return null

    const winner = test.variants.find(v => v.id === test.winner_variant_id)
    const control = test.variants.find(v => v.id === test.control_variant_id)

    if (!winner || !control) return null

    const winnerRate = winner.delivered > 0 ? (winner.opened / winner.delivered) : 0
    const controlRate = control.delivered > 0 ? (control.opened / control.delivered) : 0
    const lift = controlRate > 0 ? ((winnerRate - controlRate) / controlRate) * 100 : 0

    return {
      name: winner.name,
      lift: lift.toFixed(1),
      significance: test.statistical_significance?.is_significant
    }
  }

  const showQuickResults = (test: ABTest) => {
    setSelectedTest(test)
    setQuickResultsOpen(true)
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
            <h1 className="text-2xl font-bold text-gray-900">Testes A/B</h1>
            <p className="text-gray-600">Otimize suas campanhas com análise estatística</p>
          </div>
          <div className="flex gap-3">
            <Button asChild className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              <Link href="/dashboard/ab-tests/smart">
                <Bot className="mr-2 h-4 w-4" />
                A/B Testing com IA
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/ab-tests/new">
                <Plus className="mr-2 h-4 w-4" />
                Novo Teste A/B
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <BarChart className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total de Testes</p>
                  <p className="text-2xl font-bold">{tests.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Play className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Executando</p>
                  <p className="text-2xl font-bold">
                    {tests.filter(t => t.status === 'running').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Crown className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Com Winner</p>
                  <p className="text-2xl font-bold">
                    {tests.filter(t => t.winner_variant_id).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Melhoria Média</p>
                  <p className="text-2xl font-bold">
                    {tests.length > 0 ?
                      (tests.filter(t => t.statistical_significance?.winner_lift)
                        .reduce((acc, t) => acc + (t.statistical_significance?.winner_lift || 0), 0) /
                        Math.max(1, tests.filter(t => t.statistical_significance?.winner_lift).length)
                      ).toFixed(1) + '%' : '0%'
                    }
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
                  placeholder="Buscar testes..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="running">Executando</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(TEST_TEMPLATES).map(([key, template]) => (
                    <SelectItem key={key} value={key}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Testes A/B ({filteredTests.length})</CardTitle>
            <CardDescription>
              Lista de todos os seus testes de otimização
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="w-[70px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTests.map((test) => {
                  const progress = calculateProgress(test)
                  const winner = getWinnerInfo(test)

                  return (
                    <TableRow key={test.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{test.name}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {test.variants.length} variantes
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTestTypeLabel(test.test_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(test.status)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{progress.toFixed(0)}%</span>
                            {test.status === 'running' && (
                              <span className="text-blue-600">
                                {test.variants.reduce((sum, v) => sum + v.recipients, 0).toLocaleString()} recipients
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                test.status === 'completed' ? 'bg-green-500' :
                                test.status === 'running' ? 'bg-blue-500' : 'bg-gray-400'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {winner ? (
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-yellow-500" />
                            <div>
                              <div className="text-sm font-medium">{winner.name}</div>
                              <div className="text-xs text-green-600">
                                +{winner.lift}% melhoria
                              </div>
                            </div>
                          </div>
                        ) : test.status === 'running' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => showQuickResults(test)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Ver Resultados
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(test.created_at), {
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
                            <DropdownMenuItem onClick={() => showQuickResults(test)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Resultados
                            </DropdownMenuItem>
                            {test.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(test.id, 'running')}>
                                <Play className="mr-2 h-4 w-4" />
                                Iniciar Teste
                              </DropdownMenuItem>
                            )}
                            {test.status === 'running' && (
                              <>
                                <DropdownMenuItem onClick={() => handleStatusChange(test.id, 'paused')}>
                                  <Pause className="mr-2 h-4 w-4" />
                                  Pausar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(test.id, 'completed')}>
                                  <StopCircle className="mr-2 h-4 w-4" />
                                  Finalizar
                                </DropdownMenuItem>
                              </>
                            )}
                            {test.status === 'paused' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(test.id, 'running')}>
                                <Play className="mr-2 h-4 w-4" />
                                Retomar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteTest(test.id)}
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
                })}
              </TableBody>
            </Table>

            {filteredTests.length === 0 && (
              <div className="text-center py-8">
                <BarChart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum teste encontrado
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || statusFilter !== 'all' || testTypeFilter !== 'all'
                    ? 'Tente ajustar os filtros ou busca.'
                    : 'Comece criando seu primeiro teste A/B.'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && testTypeFilter === 'all' && (
                  <Button asChild>
                    <Link href="/dashboard/ab-tests/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Primeiro Teste
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Results Dialog */}
        <Dialog open={quickResultsOpen} onOpenChange={setQuickResultsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Resultados Rápidos: {selectedTest?.name}</DialogTitle>
              <DialogDescription>
                Visão geral do desempenho das variantes
              </DialogDescription>
            </DialogHeader>
            {selectedTest && (
              <div className="space-y-4">
                {selectedTest.variants.map(variant => {
                  const isControl = variant.id === selectedTest.control_variant_id
                  const openRate = variant.delivered > 0 ? (variant.opened / variant.delivered) * 100 : 0

                  return (
                    <div key={variant.id} className={`p-4 border rounded-lg ${
                      isControl ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{variant.name}</h4>
                          {isControl && <Badge variant="outline">Controle</Badge>}
                        </div>
                        <div className="text-lg font-bold">
                          {openRate.toFixed(1)}%
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Recipients:</span>
                          <div className="font-medium">{variant.recipients.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Opened:</span>
                          <div className="font-medium">{variant.opened.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Delivered:</span>
                          <div className="font-medium">{variant.delivered.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="mt-2 text-sm">
                        <span className="text-gray-600">Content:</span>
                        <div className="italic">{variant.content}</div>
                      </div>
                    </div>
                  )
                })}

                {selectedTest.statistical_significance && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Análise Estatística</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">P-value:</span>
                        <div className="font-medium">
                          {selectedTest.statistical_significance.p_value.toFixed(4)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Significância:</span>
                        <div className={`font-medium ${
                          selectedTest.statistical_significance.is_significant
                            ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {selectedTest.statistical_significance.is_significant ? 'Sim' : 'Não'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuickResultsOpen(false)}>
                Fechar
              </Button>
              <Button asChild>
                <Link href={`/dashboard/ab-tests/${selectedTest?.id}`}>
                  Ver Análise Completa
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
