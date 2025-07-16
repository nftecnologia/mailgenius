'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Bell,
  BellOff,
  Settings,
  User,
  MessageSquare,
  Calendar,
  TrendingUp,
  Activity,
  Shield,
  Zap,
  Database,
  Server,
  Globe,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react'

interface AlertRule {
  id: string
  name: string
  type: 'metric' | 'log' | 'heartbeat' | 'synthetic'
  metric: string
  condition: string
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  description: string
  tags: string[]
  notifications: Array<{
    type: 'email' | 'slack' | 'webhook' | 'sms'
    target: string
    enabled: boolean
  }>
  lastTriggered?: number
  triggerCount: number
}

interface Incident {
  id: string
  ruleName: string
  ruleId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved'
  message: string
  details: string
  triggeredAt: number
  acknowledgedAt?: number
  acknowledgedBy?: string
  resolvedAt?: number
  resolvedBy?: string
  updates: Array<{
    id: string
    message: string
    author: string
    timestamp: number
    type: 'comment' | 'status_change' | 'escalation'
  }>
  metrics: {
    currentValue: number
    threshold: number
    duration: number
  }
  affectedServices: string[]
  escalationLevel: number
  notificationsSent: number
}

interface AlertsMetrics {
  overview: {
    totalRules: number
    activeRules: number
    openIncidents: number
    acknowledgedIncidents: number
    resolvedIncidents: number
    mttr: number // Mean Time To Resolution
    mtbf: number // Mean Time Between Failures
  }
  trends: {
    incidents: Array<{ timestamp: number; count: number; severity: string }>
    resolution: Array<{ timestamp: number; time: number }>
    notifications: Array<{ timestamp: number; count: number }>
  }
  topAlerts: Array<{
    rule: string
    count: number
    avgDuration: number
    severity: string
  }>
}

export default function AlertsAndIncidentsDashboard() {
  const [metrics, setMetrics] = useState<AlertsMetrics | null>(null)
  const [rules, setRules] = useState<AlertRule[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all')

  const fetchData = async () => {
    try {
      const [metricsResponse, rulesResponse, incidentsResponse] = await Promise.all([
        fetch('/api/monitoring/alerts/metrics'),
        fetch('/api/monitoring/alerts/rules'),
        fetch('/api/monitoring/alerts/incidents')
      ])

      if (!metricsResponse.ok || !rulesResponse.ok || !incidentsResponse.ok) {
        throw new Error('Failed to fetch alerts data')
      }

      const [metricsData, rulesData, incidentsData] = await Promise.all([
        metricsResponse.json(),
        rulesResponse.json(),
        incidentsResponse.json()
      ])

      setMetrics(metricsData)
      setRules(rulesData)
      setIncidents(incidentsData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchData, 15000) // Refresh every 15 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleIncidentAction = async (incidentId: string, action: 'acknowledge' | 'resolve', message?: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/incidents/${incidentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message })
      })

      if (!response.ok) {
        throw new Error('Failed to perform incident action')
      }

      await fetchData()
    } catch (err) {
      console.error('Incident action failed:', err)
    }
  }

  const handleRuleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle rule')
      }

      await fetchData()
    } catch (err) {
      console.error('Rule toggle failed:', err)
    }
  }

  const addIncidentComment = async (incidentId: string, comment: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/incidents/${incidentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: comment })
      })

      if (!response.ok) {
        throw new Error('Failed to add comment')
      }

      await fetchData()
    } catch (err) {
      console.error('Add comment failed:', err)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500'
      case 'acknowledged': return 'bg-yellow-500'
      case 'resolved': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <XCircle className="h-4 w-4 text-red-500" />
      case 'acknowledged': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const filteredIncidents = incidents.filter(incident => {
    const statusMatch = filter === 'all' || incident.status === filter
    const severityMatch = severityFilter === 'all' || incident.severity === severityFilter
    return statusMatch && severityMatch
  })

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
        <h1 className="text-3xl font-bold">Alerts & Incidents Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{metrics.overview.openIncidents}</div>
              <div className="text-sm text-gray-500">
                Acknowledged: {metrics.overview.acknowledgedIncidents}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Alert Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.overview.activeRules}/{metrics.overview.totalRules}</div>
              <div className="text-sm text-gray-500">Active/Total</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">MTTR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(metrics.overview.mttr)}</div>
              <div className="text-sm text-gray-500">Mean Time To Resolution</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">MTBF</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(metrics.overview.mtbf)}</div>
              <div className="text-sm text-gray-500">Mean Time Between Failures</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="incidents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <div className="flex space-x-2">
                  <span className="text-sm font-medium">Status:</span>
                  {(['all', 'open', 'acknowledged', 'resolved'] as const).map((status) => (
                    <Button
                      key={status}
                      variant={filter === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter(status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <span className="text-sm font-medium">Severity:</span>
                  {(['all', 'low', 'medium', 'high', 'critical'] as const).map((severity) => (
                    <Button
                      key={severity}
                      variant={severityFilter === severity ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSeverityFilter(severity)}
                    >
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Incidents List */}
          <Card>
            <CardHeader>
              <CardTitle>Incidents ({filteredIncidents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedIncident?.id === incident.id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(incident.status)}
                        <span className="font-medium">{incident.ruleName}</span>
                        <Badge variant={incident.severity === 'critical' ? 'destructive' : 'default'}>
                          {incident.severity}
                        </Badge>
                        <Badge variant="outline">
                          {incident.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          {formatDuration(Date.now() - incident.triggeredAt)} ago
                        </span>
                        {incident.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleIncidentAction(incident.id, 'acknowledge')
                            }}
                          >
                            Acknowledge
                          </Button>
                        )}
                        {incident.status === 'acknowledged' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleIncidentAction(incident.id, 'resolve')
                            }}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{incident.message}</div>
                    <div className="flex justify-between text-sm">
                      <span>
                        Current: {incident.metrics.currentValue} (Threshold: {incident.metrics.threshold})
                      </span>
                      <span>
                        Services: {incident.affectedServices.join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Incident Details */}
          {selectedIncident && (
            <Card>
              <CardHeader>
                <CardTitle>Incident Details: {selectedIncident.ruleName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Status</span>
                        <Badge variant={selectedIncident.status === 'open' ? 'destructive' : 'default'}>
                          {selectedIncident.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Severity</span>
                        <Badge variant={selectedIncident.severity === 'critical' ? 'destructive' : 'default'}>
                          {selectedIncident.severity}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Duration</span>
                        <span>{formatDuration(Date.now() - selectedIncident.triggeredAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Escalation Level</span>
                        <span>{selectedIncident.escalationLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Notifications Sent</span>
                        <span>{selectedIncident.notificationsSent}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Metrics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Current Value</span>
                        <span className="font-mono">{selectedIncident.metrics.currentValue}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Threshold</span>
                        <span className="font-mono">{selectedIncident.metrics.threshold}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Breach Duration</span>
                        <span>{formatDuration(selectedIncident.metrics.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-medium mb-3">Timeline</h4>
                  <div className="space-y-3">
                    {selectedIncident.updates.map((update) => (
                      <div key={update.id} className="flex items-start space-x-3">
                        <div className={`h-2 w-2 rounded-full mt-2 ${
                          update.type === 'status_change' ? 'bg-blue-500' : 'bg-gray-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{update.author}</span>
                            <span className="text-sm text-gray-500">
                              {new Date(update.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">{update.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules</CardTitle>
              <CardDescription>
                Configure and manage alert rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant={rule.severity === 'critical' ? 'destructive' : 'default'}>
                          {rule.severity}
                        </Badge>
                        <Badge variant="outline">
                          {rule.type}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRuleToggle(rule.id, !rule.enabled)}
                        >
                          {rule.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{rule.description}</div>
                    <div className="flex justify-between text-sm">
                      <span>
                        Condition: {rule.metric} {rule.condition} {rule.threshold}
                      </span>
                      <span>
                        Triggers: {rule.triggerCount}
                      </span>
                    </div>
                    <div className="flex space-x-2 mt-2">
                      {rule.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {metrics && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Top Alerting Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.topAlerts.map((alert, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{alert.rule}</span>
                          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <span>Count: {alert.count}</span>
                          <span>Avg Duration: {formatDuration(alert.avgDuration)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}