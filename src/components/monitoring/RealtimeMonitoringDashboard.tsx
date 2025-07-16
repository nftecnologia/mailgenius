'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Database,
  Mail,
  Users,
  Server,
  Zap,
  Shield,
  Eye,
  Bell,
  Settings,
  Download,
  Play,
  Pause,
  BarChart3,
  PieChart,
  LineChart,
  Globe,
  Clock,
  CPU,
  HardDrive,
  Wifi,
  Target
} from 'lucide-react'

// Import individual dashboard components
import ImportProgressDashboard from './ImportProgressDashboard'
import EmailMetricsDashboard from './EmailMetricsDashboard'
import QueueHealthDashboard from './QueueHealthDashboard'
import AlertsAndIncidentsDashboard from './AlertsAndIncidentsDashboard'
import MonitoringDashboard from './MonitoringDashboard'
import LogsDashboard from './LogsDashboard'

interface SystemOverview {
  status: 'healthy' | 'degraded' | 'critical'
  uptime: number
  totalUsers: number
  totalEmails: number
  totalCampaigns: number
  systemLoad: number
  memoryUsage: number
  diskUsage: number
  networkStatus: string
  lastUpdated: number
}

interface RealtimeAlert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  timestamp: number
  resolved: boolean
  service: string
}

interface PerformanceMetrics {
  throughput: {
    emails: number
    imports: number
    exports: number
  }
  latency: {
    api: number
    database: number
    email: number
  }
  queues: {
    email: number
    import: number
    export: number
    webhook: number
  }
  workers: {
    active: number
    idle: number
    failed: number
  }
}

export default function RealtimeMonitoringDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [systemOverview, setSystemOverview] = useState<SystemOverview | null>(null)
  const [realtimeAlerts, setRealtimeAlerts] = useState<RealtimeAlert[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000)

  const fetchSystemOverview = async () => {
    try {
      const response = await fetch('/api/monitoring/system/overview')
      
      if (!response.ok) {
        throw new Error('Failed to fetch system overview')
      }

      const data = await response.json()
      setSystemOverview(data)
    } catch (err) {
      console.error('System overview fetch failed:', err)
    }
  }

  const fetchRealtimeAlerts = async () => {
    try {
      const response = await fetch('/api/monitoring/alerts/realtime')
      
      if (!response.ok) {
        throw new Error('Failed to fetch realtime alerts')
      }

      const data = await response.json()
      setRealtimeAlerts(data)
    } catch (err) {
      console.error('Realtime alerts fetch failed:', err)
    }
  }

  const fetchPerformanceMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/performance/realtime')
      
      if (!response.ok) {
        throw new Error('Failed to fetch performance metrics')
      }

      const data = await response.json()
      setPerformanceMetrics(data)
    } catch (err) {
      console.error('Performance metrics fetch failed:', err)
    }
  }

  const fetchAllData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchSystemOverview(),
        fetchRealtimeAlerts(),
        fetchPerformanceMetrics()
      ])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchAllData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />
      default: return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-500" />
      default: return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  const formatUptime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const exportData = async (type: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/monitoring/export?format=${type}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `monitoring-data-${new Date().toISOString().split('T')[0]}.${type}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  if (loading) {
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
        <div>
          <h1 className="text-3xl font-bold">MailGenius Monitoring</h1>
          <p className="text-gray-600">Real-time system monitoring and analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <label htmlFor="refresh-interval" className="text-sm">Refresh:</label>
            <select
              id="refresh-interval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1"
            >
              <option value={1000}>1s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData('json')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* System Status Banner */}
      {systemOverview && (
        <Card className={`border-l-4 ${
          systemOverview.status === 'healthy' ? 'border-l-green-500' : 
          systemOverview.status === 'degraded' ? 'border-l-yellow-500' : 
          'border-l-red-500'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getStatusIcon(systemOverview.status)}
                <div>
                  <div className="font-semibold text-lg">
                    System Status: {systemOverview.status.charAt(0).toUpperCase() + systemOverview.status.slice(1)}
                  </div>
                  <div className="text-sm text-gray-600">
                    Uptime: {formatUptime(systemOverview.uptime)} | 
                    Last Updated: {new Date(systemOverview.lastUpdated).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{formatNumber(systemOverview.totalUsers)}</div>
                  <div className="text-sm text-gray-500">Users</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatNumber(systemOverview.totalEmails)}</div>
                  <div className="text-sm text-gray-500">Emails</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatNumber(systemOverview.totalCampaigns)}</div>
                  <div className="text-sm text-gray-500">Campaigns</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{systemOverview.systemLoad.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Load</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts Banner */}
      {realtimeAlerts.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-red-500" />
                <span className="font-semibold">Active Alerts ({realtimeAlerts.length})</span>
              </div>
              <Button size="sm" variant="outline">
                View All
              </Button>
            </div>
            <div className="space-y-2">
              {realtimeAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <div className="flex items-center space-x-2">
                    {getAlertIcon(alert.type)}
                    <span className="font-medium">{alert.title}</span>
                    <span className="text-sm text-gray-600">{alert.message}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge variant="outline">{alert.service}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      {performanceMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                Email Throughput
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(performanceMetrics.throughput.emails)}/min</div>
              <div className="text-sm text-gray-500">Emails per minute</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Database className="h-4 w-4 mr-2" />
                Import Throughput
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(performanceMetrics.throughput.imports)}/min</div>
              <div className="text-sm text-gray-500">Records per minute</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                API Latency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{performanceMetrics.latency.api}ms</div>
              <div className="text-sm text-gray-500">Average response time</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Active Workers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{performanceMetrics.workers.active}</div>
              <div className="text-sm text-gray-500">
                {performanceMetrics.workers.idle} idle, {performanceMetrics.workers.failed} failed
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <MonitoringDashboard />
        </TabsContent>

        <TabsContent value="imports" className="space-y-4">
          <ImportProgressDashboard />
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <EmailMetricsDashboard />
        </TabsContent>

        <TabsContent value="queues" className="space-y-4">
          <QueueHealthDashboard />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertsAndIncidentsDashboard />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <LogsDashboard />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {systemOverview && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CPU className="h-5 w-5 mr-2" />
                    System Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>System Load</span>
                        <span>{systemOverview.systemLoad.toFixed(1)}%</span>
                      </div>
                      <Progress value={systemOverview.systemLoad} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Memory Usage</span>
                        <span>{systemOverview.memoryUsage.toFixed(1)}%</span>
                      </div>
                      <Progress value={systemOverview.memoryUsage} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Disk Usage</span>
                        <span>{systemOverview.diskUsage.toFixed(1)}%</span>
                      </div>
                      <Progress value={systemOverview.diskUsage} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wifi className="h-5 w-5 mr-2" />
                    Network Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <Badge variant="default">{systemOverview.networkStatus}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Uptime</span>
                      <span>{formatUptime(systemOverview.uptime)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Performance Targets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>API Latency</span>
                      <span className="text-green-600">✓ {'<'} 200ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uptime</span>
                      <span className="text-green-600">✓ {'>'} 99.9%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Error Rate</span>
                      <span className="text-green-600">✓ {'<'} 0.1%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}