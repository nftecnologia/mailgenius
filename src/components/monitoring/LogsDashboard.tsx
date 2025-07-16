'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  AlertTriangle,
  Info,
  AlertCircle,
  XCircle,
  Clock,
  User,
  Globe,
  Code,
  Database,
  Mail,
  Upload,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

interface LogEntry {
  id: string
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  service: string
  component: string
  traceId?: string
  spanId?: string
  userId?: string
  sessionId?: string
  requestId?: string
  metadata: Record<string, any>
  tags: string[]
  duration?: number
  error?: {
    name: string
    message: string
    stack: string
  }
}

interface LogStats {
  total: number
  byLevel: Record<string, number>
  byService: Record<string, number>
  byComponent: Record<string, number>
  errorRate: number
  topErrors: Array<{
    error: string
    count: number
    lastSeen: number
  }>
  timeRange: {
    start: number
    end: number
  }
}

interface LogQuery {
  level?: string
  service?: string
  component?: string
  traceId?: string
  userId?: string
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
  search?: string
  tags?: string[]
}

export default function LogsDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  
  // Filters
  const [query, setQuery] = useState<LogQuery>({
    limit: 100,
    offset: 0
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [serviceFilter, setServiceFilter] = useState<string>('')
  const [timeRange, setTimeRange] = useState<string>('1h')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchLogs = async (newQuery?: LogQuery) => {
    try {
      const finalQuery = { ...query, ...newQuery }
      const params = new URLSearchParams()
      
      Object.entries(finalQuery).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/monitoring/logs?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }

      const data = await response.json()
      
      if (finalQuery.offset === 0) {
        setLogs(data)
      } else {
        setLogs(prev => [...prev, ...data])
      }
      
      setHasMore(data.length === finalQuery.limit)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const hours = {
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '7d': 168
      }[timeRange] || 1

      const response = await fetch(`/api/monitoring/logs/stats?hours=${hours}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch log stats')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch log stats:', err)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [timeRange])

  useEffect(() => {
    const newQuery: LogQuery = {
      level: levelFilter || undefined,
      service: serviceFilter || undefined,
      search: searchTerm || undefined,
      limit: 100,
      offset: 0
    }

    // Add time range
    if (timeRange !== 'all') {
      const hours = {
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '7d': 168
      }[timeRange] || 1
      newQuery.startTime = Date.now() - (hours * 60 * 60 * 1000)
    }

    setQuery(newQuery)
    setCurrentPage(1)
    fetchLogs(newQuery)
  }, [searchTerm, levelFilter, serviceFilter, timeRange])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
  }

  const handleLoadMore = () => {
    const newQuery = {
      ...query,
      offset: logs.length
    }
    fetchLogs(newQuery)
  }

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'debug': return 'bg-gray-500'
      case 'info': return 'bg-blue-500'
      case 'warn': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'debug': return <Code className="h-4 w-4" />
      case 'info': return <Info className="h-4 w-4" />
      case 'warn': return <AlertTriangle className="h-4 w-4" />
      case 'error': return <XCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'api': return <Globe className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'import': return <Upload className="h-4 w-4" />
      case 'database': return <Database className="h-4 w-4" />
      default: return <Code className="h-4 w-4" />
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return null
    return `${duration}ms`
  }

  const exportLogs = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams()
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString())
        }
      })
      params.append('format', format)
      params.append('limit', '10000') // Export more logs

      const response = await fetch(`/api/monitoring/logs/export?${params}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs-${new Date().toISOString().split('T')[0]}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/monitoring/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: serviceFilter || undefined,
          component: undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to clear logs')
      }

      fetchLogs({ ...query, offset: 0 })
      fetchStats()
    } catch (err) {
      console.error('Clear logs failed:', err)
    }
  }

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Logs Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => exportLogs('json')}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLogs('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              <div className="text-sm text-gray-500">
                Error Rate: {stats.errorRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.byLevel).map(([level, count]) => (
                  <div key={level} className="flex justify-between text-sm">
                    <span className="capitalize">{level}</span>
                    <span>{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Service</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.byService).slice(0, 5).map(([service, count]) => (
                  <div key={service} className="flex justify-between text-sm">
                    <span>{service}</span>
                    <span>{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {stats.topErrors.slice(0, 3).map((error, index) => (
                  <div key={index} className="text-sm">
                    <div className="font-medium truncate">{error.error}</div>
                    <div className="text-gray-500">{error.count} occurrences</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Levels</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Services</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="queue">Queue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs({ ...query, offset: 0 })}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs ({logs.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`border rounded-lg p-3 ${
                  log.level === 'error' ? 'border-red-200 bg-red-50' :
                  log.level === 'warn' ? 'border-yellow-200 bg-yellow-50' :
                  'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLogExpansion(log.id)}
                      className="h-6 w-6 p-0"
                    >
                      {expandedLogs.has(log.id) ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </Button>
                    <div className={`h-2 w-2 rounded-full ${getLevelColor(log.level)}`} />
                    <div className="flex items-center space-x-2">
                      {getServiceIcon(log.service)}
                      <span className="font-medium">{log.service}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-sm text-gray-500">{log.component}</span>
                    </div>
                    <Badge variant={log.level === 'error' ? 'destructive' : 'default'}>
                      {log.level}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    {log.duration && (
                      <span>{formatDuration(log.duration)}</span>
                    )}
                    {log.userId && (
                      <div className="flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>{log.userId}</span>
                      </div>
                    )}
                    <span>{formatTimestamp(log.timestamp)}</span>
                  </div>
                </div>
                
                <div className="mt-2 font-mono text-sm">{log.message}</div>
                
                {log.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {log.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {expandedLogs.has(log.id) && (
                  <div className="mt-3 space-y-3">
                    {log.traceId && (
                      <div>
                        <span className="font-medium">Trace ID:</span> {log.traceId}
                      </div>
                    )}
                    
                    {Object.keys(log.metadata).length > 0 && (
                      <div>
                        <span className="font-medium">Metadata:</span>
                        <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {log.error && (
                      <div>
                        <span className="font-medium text-red-600">Error:</span>
                        <div className="mt-1 text-sm">
                          <div><strong>Name:</strong> {log.error.name}</div>
                          <div><strong>Message:</strong> {log.error.message}</div>
                          {log.error.stack && (
                            <div>
                              <strong>Stack:</strong>
                              <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                {log.error.stack}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {hasMore && (
            <div className="mt-4 text-center">
              <Button onClick={handleLoadMore} disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}