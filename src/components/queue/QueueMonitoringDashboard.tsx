'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Mail,
  Users,
  TrendingUp,
  Activity
} from 'lucide-react'

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

interface ProgressItem {
  id: string
  type: 'leads-import' | 'email-sending' | 'campaign-processing'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  totalItems: number
  processedItems: number
  failedItems: number
  message: string
  startTime: number
  endTime?: number
  metadata?: Record<string, any>
}

interface WorkerStatus {
  isRunning: boolean
  workers: Array<{
    name: string
    status: string
  }>
}

export default function QueueMonitoringDashboard() {
  const [queueStats, setQueueStats] = useState<Record<string, QueueStats>>({})
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ isRunning: false, workers: [] })
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      setRefreshing(true)
      
      // Load queue statistics
      const statsResponse = await fetch('/api/queue/admin?action=stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setQueueStats(statsData.queues || {})
      }

      // Load worker status
      const workersResponse = await fetch('/api/queue/admin?action=workers')
      if (workersResponse.ok) {
        const workersData = await workersResponse.json()
        setWorkerStatus(workersData.workers || { isRunning: false, workers: [] })
      }

      // Load progress items
      const progressResponse = await fetch('/api/queue/progress')
      if (progressResponse.ok) {
        const progressData = await progressResponse.json()
        setProgressItems(progressData.progress || [])
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleQueueAction = async (action: string, queueName?: string, data?: any) => {
    try {
      const response = await fetch('/api/queue/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          queueName,
          data,
        }),
      })

      if (response.ok) {
        await loadDashboardData()
      }
    } catch (error) {
      console.error('Failed to execute queue action:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'processing':
        return 'bg-blue-500'
      case 'cancelled':
        return 'bg-gray-500'
      default:
        return 'bg-yellow-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />
      case 'failed':
        return <AlertCircle className="w-4 h-4" />
      case 'processing':
        return <Activity className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading queue dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Queue Monitoring Dashboard</h1>
          <p className="text-gray-600">Monitor and manage queue processing</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQueueAction('restart-workers')}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Restart Workers
          </Button>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${workerStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">
                {workerStatus.isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workerStatus.workers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(queueStats).reduce((sum, stats) => 
                sum + stats.waiting + stats.active + stats.completed + stats.failed, 0
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Object.values(queueStats).reduce((sum, stats) => sum + stats.failed, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queues">Queue Statistics</TabsTrigger>
          <TabsTrigger value="progress">Progress Tracking</TabsTrigger>
          <TabsTrigger value="workers">Worker Management</TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(queueStats).map(([queueName, stats]) => (
              <Card key={queueName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg capitalize">
                      {queueName.replace('-', ' ')} Queue
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQueueAction('pause', queueName)}
                      >
                        <Pause className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQueueAction('resume', queueName)}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQueueAction('clean', queueName)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Waiting</div>
                      <div className="text-2xl font-bold text-yellow-600">{stats.waiting}</div>
                    </div>
                    <div>
                      <div className="font-medium">Active</div>
                      <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
                    </div>
                    <div>
                      <div className="font-medium">Completed</div>
                      <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                    </div>
                    <div>
                      <div className="font-medium">Failed</div>
                      <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <div className="space-y-4">
            {progressItems.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {item.type === 'leads-import' && <Users className="w-5 h-5" />}
                      {item.type === 'email-sending' && <Mail className="w-5 h-5" />}
                      {item.type === 'campaign-processing' && <TrendingUp className="w-5 h-5" />}
                      <CardTitle className="text-lg capitalize">
                        {item.type.replace('-', ' ')}
                      </CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(item.status)}>
                        {getStatusIcon(item.status)}
                        <span className="ml-1 capitalize">{item.status}</span>
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {formatDuration(item.startTime, item.endTime)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.message}</span>
                      <span>{item.progress}%</span>
                    </div>
                    <Progress value={item.progress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Processed: {item.processedItems}</span>
                      <span>Failed: {item.failedItems}</span>
                      <span>Total: {item.totalItems}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workerStatus.workers.map((worker) => (
              <Card key={worker.name}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize">
                    {worker.name.replace('-', ' ')} Worker
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${worker.status === 'ready' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm capitalize">{worker.status}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQueueAction('pause', worker.name)}
                      >
                        <Pause className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQueueAction('resume', worker.name)}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}