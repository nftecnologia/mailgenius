'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Mail, 
  Users, 
  Zap,
  TrendingUp,
  TrendingDown,
  Server,
  Database,
  Shield,
  Eye,
  RefreshCw
} from 'lucide-react'

interface DashboardData {
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy'
    services: Array<{
      service: string
      status: 'healthy' | 'degraded' | 'unhealthy'
      latency?: number
      error?: string
    }>
    uptime: number
  }
  performance: {
    apiLatency: { aggregation: { avg: number } }
    emailsSent: { aggregation: { sum: number } }
    activeUsers: { aggregation: { sum: number } }
    errorRate: { aggregation: { avg: number } }
    memoryUsage: { aggregation: { avg: number } }
  }
  business: {
    totalEmailsSent: number
    totalCampaignsSent: number
    totalActiveUsers: number
    conversionRate: number
    clickThroughRate: number
    bounceRate: number
  }
  alerts: {
    incidents: Array<{
      id: string
      ruleName: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      status: 'open' | 'acknowledged' | 'resolved'
      message: string
      triggeredAt: number
    }>
    stats: {
      openIncidents: number
      acknowledgedIncidents: number
      resolvedIncidents: number
    }
  }
  rateLimits: {
    totalHits: number
    blocked: number
    activeEndpoints: string[]
  }
}

interface MetricCard {
  title: string
  value: string | number
  change: number
  changeType: 'positive' | 'negative' | 'neutral'
  unit?: string
  description?: string
  sparkline?: number[]
}

export default function MonitoringDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [metricCards, setMetricCards] = useState<MetricCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchDashboardData = async () => {
    try {
      const [dashboardResponse, cardsResponse] = await Promise.all([
        fetch('/api/monitoring/dashboard?type=full'),
        fetch('/api/monitoring/dashboard?type=cards')
      ])

      if (!dashboardResponse.ok || !cardsResponse.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const [dashboard, cards] = await Promise.all([
        dashboardResponse.json(),
        cardsResponse.json()
      ])

      setDashboardData(dashboard)
      setMetricCards(cards)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'unhealthy': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />
      case 'degraded': return <AlertTriangle className="h-4 w-4" />
      case 'unhealthy': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-500'
      case 'medium': return 'bg-yellow-500'
      case 'high': return 'bg-orange-500'
      case 'critical': return 'bg-red-500'
      default: return 'bg-gray-500'
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

  const renderChangeIndicator = (change: number, changeType: 'positive' | 'negative' | 'neutral') => {
    if (changeType === 'neutral') return null
    
    const isPositive = changeType === 'positive'
    const Icon = isPositive ? TrendingUp : TrendingDown
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600'
    
    return (
      <div className={`flex items-center ${colorClass}`}>
        <Icon className="h-3 w-3 mr-1" />
        <span className="text-xs">{Math.abs(change).toFixed(1)}%</span>
      </div>
    )
  }

  const renderSparkline = (data: number[]) => {
    if (!data || data.length === 0) return null
    
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    
    return (
      <div className="flex items-end h-8 space-x-0.5">
        {data.map((value, index) => {
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

  if (!dashboardData) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Monitoring Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh: {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            System Health
          </CardTitle>
          <CardDescription>
            Overall system status and service health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${getStatusColor(dashboardData.health.overall)}`} />
              <span className="font-semibold capitalize">{dashboardData.health.overall}</span>
            </div>
            <div className="text-sm text-gray-500">
              Uptime: {formatUptime(dashboardData.health.uptime)}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboardData.health.services.map((service) => (
              <div key={service.service} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{service.service}</span>
                  {getStatusIcon(service.status)}
                </div>
                <Badge variant={service.status === 'healthy' ? 'default' : 'destructive'}>
                  {service.status}
                </Badge>
                {service.latency && (
                  <div className="text-xs text-gray-500 mt-1">
                    {service.latency}ms
                  </div>
                )}
                {service.error && (
                  <div className="text-xs text-red-500 mt-1">
                    {service.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {card.value}
                    {card.unit && <span className="text-sm font-normal ml-1">{card.unit}</span>}
                  </div>
                  {renderChangeIndicator(card.change, card.changeType)}
                </div>
                {card.sparkline && (
                  <div className="ml-4">
                    {renderSparkline(card.sparkline)}
                  </div>
                )}
              </div>
              {card.description && (
                <p className="text-xs text-gray-500 mt-2">{card.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Average Latency</span>
                    <span className="font-mono">
                      {dashboardData.performance.apiLatency.aggregation.avg.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Error Rate</span>
                    <span className="font-mono">
                      {(dashboardData.performance.errorRate.aggregation.avg * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory Usage</span>
                    <span className="font-mono">
                      {dashboardData.performance.memoryUsage.aggregation.avg.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={dashboardData.performance.memoryUsage.aggregation.avg} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limiting</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Hits</span>
                    <span className="font-mono">{dashboardData.rateLimits.totalHits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blocked Requests</span>
                    <span className="font-mono">{dashboardData.rateLimits.blocked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Endpoints</span>
                    <span className="font-mono">{dashboardData.rateLimits.activeEndpoints.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {dashboardData.alerts.stats.openIncidents}
                  </div>
                  <div className="text-sm text-gray-500">Open</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {dashboardData.alerts.stats.acknowledgedIncidents}
                  </div>
                  <div className="text-sm text-gray-500">Acknowledged</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData.alerts.stats.resolvedIncidents}
                  </div>
                  <div className="text-sm text-gray-500">Resolved</div>
                </div>
              </div>

              <div className="space-y-3">
                {dashboardData.alerts.incidents.slice(0, 5).map((incident) => (
                  <div key={incident.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`h-2 w-2 rounded-full ${getSeverityColor(incident.severity)}`} />
                      <div>
                        <div className="font-medium">{incident.ruleName}</div>
                        <div className="text-sm text-gray-500">{incident.message}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={incident.status === 'open' ? 'destructive' : 'default'}>
                        {incident.status}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(incident.triggeredAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Email Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Sent</span>
                    <span className="font-mono">{dashboardData.business.totalEmailsSent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Click Rate</span>
                    <span className="font-mono">{dashboardData.business.clickThroughRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bounce Rate</span>
                    <span className="font-mono">{dashboardData.business.bounceRate.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  User Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Active Users</span>
                    <span className="font-mono">{dashboardData.business.totalActiveUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Campaigns Sent</span>
                    <span className="font-mono">{dashboardData.business.totalCampaignsSent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Conversion Rate</span>
                    <span className="font-mono">{dashboardData.business.conversionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Rate Limiting</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Requests</span>
                      <span className="font-mono">{dashboardData.rateLimits.totalHits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Blocked</span>
                      <span className="font-mono text-red-600">{dashboardData.rateLimits.blocked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Block Rate</span>
                      <span className="font-mono">
                        {dashboardData.rateLimits.totalHits > 0 
                          ? ((dashboardData.rateLimits.blocked / dashboardData.rateLimits.totalHits) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">System Security</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Authentication Active</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Rate Limiting Active</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>CORS Configured</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}