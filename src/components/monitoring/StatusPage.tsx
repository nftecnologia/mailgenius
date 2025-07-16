'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Activity,
  Server,
  Database,
  Mail,
  Shield
} from 'lucide-react'

interface StatusData {
  status: 'operational' | 'degraded' | 'outage'
  services: Array<{
    name: string
    status: 'operational' | 'degraded' | 'outage'
    uptime: number
    description: string
  }>
  incidents: Array<{
    id: string
    title: string
    description: string
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
    severity: 'low' | 'medium' | 'high' | 'critical'
    createdAt: number
    updatedAt: number
    updates: Array<{
      message: string
      timestamp: number
      status: string
    }>
  }>
  uptime: {
    overall: number
    last30Days: number[]
    last7Days: number[]
    last24Hours: number[]
  }
  metrics: {
    responseTime: number
    uptime: number
    incidents: number
  }
}

export default function StatusPage() {
  const [statusData, setStatusData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchStatusData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/monitoring/status')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setStatusData(data)
      setError(null)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatusData()
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStatusData, 60000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'outage': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'outage': return <XCircle className="h-5 w-5 text-red-500" />
      default: return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational': return <Badge className="bg-green-100 text-green-800">Operational</Badge>
      case 'degraded': return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>
      case 'outage': return <Badge className="bg-red-100 text-red-800">Outage</Badge>
      default: return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getIncidentStatusColor = (status: string) => {
    switch (status) {
      case 'investigating': return 'text-orange-600'
      case 'identified': return 'text-yellow-600'
      case 'monitoring': return 'text-blue-600'
      case 'resolved': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName.toLowerCase()) {
      case 'database': return <Database className="h-4 w-4" />
      case 'redis': return <Server className="h-4 w-4" />
      case 'external_apis': return <Activity className="h-4 w-4" />
      case 'memory': return <Activity className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'security': return <Shield className="h-4 w-4" />
      default: return <Server className="h-4 w-4" />
    }
  }

  const renderUptimeChart = (data: number[], title: string) => {
    const maxValue = Math.max(...data)
    const minValue = Math.min(...data)
    const range = maxValue - minValue || 1
    
    return (
      <div>
        <h4 className="text-sm font-medium mb-2">{title}</h4>
        <div className="flex items-end space-x-1 h-12">
          {data.map((value, index) => {
            const height = ((value - minValue) / range) * 100
            const color = value >= 99 ? 'bg-green-500' : value >= 95 ? 'bg-yellow-500' : 'bg-red-500'
            
            return (
              <div
                key={index}
                className={`${color} w-2 rounded-sm transition-all hover:opacity-80`}
                style={{ height: `${Math.max(height, 5)}%` }}
                title={`${value.toFixed(2)}% uptime`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Past</span>
          <span>Now</span>
        </div>
      </div>
    )
  }

  if (loading && !statusData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading system status...</p>
        </div>
      </div>
    )
  }

  if (error && !statusData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchStatusData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!statusData) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">MailGenius Status</h1>
          <div className="flex items-center justify-center space-x-2 mb-4">
            {getStatusIcon(statusData.status)}
            <span className={`text-lg font-medium ${getStatusColor(statusData.status)}`}>
              All Systems {statusData.status === 'operational' ? 'Operational' : 
                         statusData.status === 'degraded' ? 'Degraded' : 'Down'}
            </span>
          </div>
          <p className="text-gray-600">
            Last updated: {lastUpdate?.toLocaleString() || 'Never'}
          </p>
        </div>

        {/* Current Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
            <CardDescription>
              Real-time status of all MailGenius services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusData.services.map((service) => (
                <div key={service.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getServiceIcon(service.name)}
                    <div>
                      <div className="font-medium capitalize">{service.name}</div>
                      <div className="text-sm text-gray-500">{service.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">{service.uptime.toFixed(2)}% uptime</div>
                      <Progress value={service.uptime} className="w-20 h-2" />
                    </div>
                    {getStatusBadge(service.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Uptime History */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Uptime History</CardTitle>
            <CardDescription>
              Historical uptime data for the past 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {renderUptimeChart(statusData.uptime.last24Hours, 'Last 24 Hours')}
              {renderUptimeChart(statusData.uptime.last7Days, 'Last 7 Days')}
              {renderUptimeChart(statusData.uptime.last30Days, 'Last 30 Days')}
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{statusData.metrics.uptime.toFixed(2)}%</div>
                  <div className="text-sm text-gray-600">Overall Uptime</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{statusData.metrics.responseTime.toFixed(0)}ms</div>
                  <div className="text-sm text-gray-600">Avg Response Time</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{statusData.metrics.incidents}</div>
                  <div className="text-sm text-gray-600">Active Incidents</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incidents */}
        {statusData.incidents.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
              <CardDescription>
                Latest incidents and their resolution status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusData.incidents.map((incident) => (
                  <div key={incident.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium">{incident.title}</h3>
                          <Badge className={getSeverityColor(incident.severity)}>
                            {incident.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{incident.description}</p>
                        <div className="flex items-center space-x-2 text-sm">
                          <span className={`font-medium ${getIncidentStatusColor(incident.status)}`}>
                            {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-500">
                            {new Date(incident.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {incident.updates.length > 0 && (
                      <div className="mt-4 pl-4 border-l-2 border-gray-200">
                        <h4 className="font-medium mb-2">Updates</h4>
                        <div className="space-y-2">
                          {incident.updates.map((update, index) => (
                            <div key={index} className="text-sm">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`font-medium ${getIncidentStatusColor(update.status)}`}>
                                  {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                                </span>
                                <span className="text-gray-500">
                                  {new Date(update.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-gray-600">{update.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>
            Having issues? Contact support at{' '}
            <a href="mailto:support@mailgenius.com" className="text-blue-600 hover:underline">
              support@mailgenius.com
            </a>
          </p>
          <p className="mt-2">
            Subscribe to updates:{' '}
            <Button variant="link" className="p-0 h-auto text-blue-600">
              Get notified
            </Button>
          </p>
        </div>
      </div>
    </div>
  )
}