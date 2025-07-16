'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Queue, 
  Activity, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Server,
  Database,
  Play,
  Pause,
  Square,
  Settings,
  BarChart3,
  Timer
} from 'lucide-react'

interface QueueStatus {
  name: string
  type: 'email' | 'import' | 'export' | 'webhook' | 'notification'
  status: 'healthy' | 'warning' | 'critical' | 'paused'
  size: number
  processing: number
  completed: number
  failed: number
  retries: number
  throughput: number
  avgProcessingTime: number
  oldestJob: number
  workers: {
    total: number
    active: number
    idle: number
    failed: number
  }
  metrics: {
    successRate: number
    errorRate: number
    avgLatency: number
    memoryUsage: number
    cpuUsage: number
  }
}

interface QueueMetrics {
  overview: {
    totalJobs: number
    processingJobs: number
    completedJobs: number
    failedJobs: number
    totalWorkers: number
    activeWorkers: number
    systemLoad: number
    memoryUsage: number
  }
  queues: QueueStatus[]
  trends: {
    throughput: Array<{ timestamp: number; value: number }>
    errorRate: Array<{ timestamp: number; value: number }>
    latency: Array<{ timestamp: number; value: number }>
    workers: Array<{ timestamp: number; value: number }>
  }
  alerts: Array<{
    id: string
    queue: string
    type: 'high_latency' | 'high_error_rate' | 'queue_full' | 'worker_down' | 'memory_high'
    severity: 'warning' | 'critical'
    message: string
    timestamp: number
    acknowledged: boolean
  }>
}

export default function QueueHealthDashboard() {
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null)

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/queues/health')
      
      if (!response.ok) {
        throw new Error('Failed to fetch queue metrics')
      }

      const data = await response.json()
      setMetrics(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchMetrics, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleQueueAction = async (queueName: string, action: 'pause' | 'resume' | 'clear' | 'restart') => {
    try {
      const response = await fetch(`/api/monitoring/queues/${queueName}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error('Failed to perform queue action')
      }

      await fetchMetrics()
    } catch (err) {
      console.error('Queue action failed:', err)
    }
  }

  const handleAlertAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error('Failed to perform alert action')
      }

      await fetchMetrics()
    } catch (err) {
      console.error('Alert action failed:', err)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const getStatusColor = (status: QueueStatus['status']) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      case 'paused': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: QueueStatus['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />
      case 'paused': return <Pause className="h-4 w-4 text-gray-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getQueueTypeIcon = (type: QueueStatus['type']) => {
    switch (type) {
      case 'email': return <Queue className="h-4 w-4" />
      case 'import': return <Database className="h-4 w-4" />
      case 'export': return <Database className="h-4 w-4" />
      case 'webhook': return <Zap className="h-4 w-4" />
      case 'notification': return <Activity className="h-4 w-4" />
      default: return <Queue className="h-4 w-4" />
    }
  }

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const renderSparkline = (data: Array<{ timestamp: number; value: number }>) => {
    if (!data || data.length === 0) return null
    
    const values = data.map(d => d.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1
    
    return (
      <div className="flex items-end h-8 space-x-0.5">
        {values.map((value, index) => {
          const height = ((value - min) / range) * 100
          return (
            <div
              key={index}
              className="bg-blue-500 w-1 rounded-sm"
              style={{ height: `${height}%` }}
            />
          )
        })}
      </div>
    )
  }

  const getSeverityColor = (severity: 'warning' | 'critical') => {
    return severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
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

  if (!metrics) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Queue Health Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Alerts */}
      {metrics.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.acknowledged ? 'bg-gray-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${getSeverityColor(alert.severity)}`} />
                      <span className="font-medium">{alert.queue}</span>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">{alert.message}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.overview.totalJobs)}</div>
            <div className="text-sm text-gray-500">
              Processing: {formatNumber(metrics.overview.processingJobs)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.overview.activeWorkers}/{metrics.overview.totalWorkers}
            </div>
            <div className="text-sm text-gray-500">Active/Total</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System Load</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.systemLoad.toFixed(1)}%</div>
            <Progress value={metrics.overview.systemLoad} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.memoryUsage.toFixed(1)}%</div>
            <Progress value={metrics.overview.memoryUsage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Queue Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h4 className="font-medium mb-2">Throughput</h4>
              {renderSparkline(metrics.trends.throughput)}
            </div>
            <div>
              <h4 className="font-medium mb-2">Error Rate</h4>
              {renderSparkline(metrics.trends.errorRate)}
            </div>
            <div>
              <h4 className="font-medium mb-2">Latency</h4>
              {renderSparkline(metrics.trends.latency)}
            </div>
            <div>
              <h4 className="font-medium mb-2">Workers</h4>
              {renderSparkline(metrics.trends.workers)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            Queue Status
          </CardTitle>
          <CardDescription>
            Detailed status of all queues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.queues.map((queue) => (
              <div
                key={queue.name}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedQueue === queue.name ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedQueue(selectedQueue === queue.name ? null : queue.name)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getQueueTypeIcon(queue.type)}
                    <span className="font-medium">{queue.name}</span>
                    <Badge variant={queue.status === 'healthy' ? 'default' : 'destructive'}>
                      {queue.status}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {formatNumber(queue.throughput)}/min
                    </span>
                    {queue.status === 'paused' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQueueAction(queue.name, 'resume')
                        }}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQueueAction(queue.name, 'pause')
                        }}
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <div className="text-sm text-gray-500">Queue Size</div>
                    <div className="font-medium">{formatNumber(queue.size)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Processing</div>
                    <div className="font-medium">{formatNumber(queue.processing)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Completed</div>
                    <div className="font-medium">{formatNumber(queue.completed)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Failed</div>
                    <div className="font-medium">{formatNumber(queue.failed)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Workers</div>
                    <div className="font-medium">{queue.workers.active}/{queue.workers.total}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Avg Time</div>
                    <div className="font-medium">{formatDuration(queue.avgProcessingTime)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Success Rate</div>
                    <div className="font-medium">{queue.metrics.successRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Oldest Job</div>
                    <div className="font-medium">{formatDuration(Date.now() - queue.oldestJob)}</div>
                  </div>
                </div>

                {selectedQueue === queue.name && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Performance Metrics</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Error Rate</span>
                            <span className="font-mono">{queue.metrics.errorRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Latency</span>
                            <span className="font-mono">{queue.metrics.avgLatency.toFixed(0)}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Memory Usage</span>
                            <span className="font-mono">{queue.metrics.memoryUsage.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>CPU Usage</span>
                            <span className="font-mono">{queue.metrics.cpuUsage.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">Worker Status</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Active Workers</span>
                            <span className="font-mono">{queue.workers.active}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Idle Workers</span>
                            <span className="font-mono">{queue.workers.idle}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Failed Workers</span>
                            <span className="font-mono">{queue.workers.failed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Retries</span>
                            <span className="font-mono">{queue.retries}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQueueAction(queue.name, 'restart')}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Restart
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQueueAction(queue.name, 'clear')}
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}