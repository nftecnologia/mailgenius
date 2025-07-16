'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Mail, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  MousePointer,
  Eye,
  UserX,
  Target,
  Globe,
  Zap,
  Activity
} from 'lucide-react'

interface EmailMetrics {
  realtime: {
    sent: number
    delivered: number
    bounced: number
    opened: number
    clicked: number
    unsubscribed: number
    complained: number
    queue: number
    sending: number
    failed: number
  }
  rates: {
    deliveryRate: number
    openRate: number
    clickRate: number
    bounceRate: number
    unsubscribeRate: number
    complaintRate: number
  }
  trends: {
    sent: Array<{ timestamp: number; value: number }>
    delivered: Array<{ timestamp: number; value: number }>
    opened: Array<{ timestamp: number; value: number }>
    clicked: Array<{ timestamp: number; value: number }>
  }
  campaigns: Array<{
    id: string
    name: string
    status: 'draft' | 'sending' | 'sent' | 'paused' | 'failed'
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    unsubscribed: number
    sendingRate: number
    estimatedCompletion?: number
    errors: number
  }>
  providers: Array<{
    name: string
    sent: number
    delivered: number
    bounced: number
    avgLatency: number
    status: 'healthy' | 'degraded' | 'unhealthy'
  }>
  throughput: {
    current: number
    peak: number
    average: number
    capacity: number
  }
}

export default function EmailMetricsDashboard() {
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'1h' | '6h' | '24h' | '7d'>('1h')

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/monitoring/emails/metrics?period=${selectedPeriod}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch email metrics')
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
  }, [selectedPeriod])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchMetrics, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [autoRefresh, selectedPeriod])

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'unhealthy': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'sending': return 'bg-blue-500'
      case 'sent': return 'bg-green-500'
      case 'paused': return 'bg-yellow-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
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

  const getRateColor = (rate: number, type: 'positive' | 'negative') => {
    const isGood = type === 'positive' ? rate > 20 : rate < 5
    return isGood ? 'text-green-600' : rate > 10 && type === 'negative' ? 'text-red-600' : 'text-yellow-600'
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
        <h1 className="text-3xl font-bold">Email Metrics Dashboard</h1>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            {(['1h', '6h', '24h', '7d'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
              >
                {period}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'On' : 'Off'}
          </Button>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Send className="h-4 w-4 mr-2" />
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.realtime.sent)}</div>
            <div className="text-sm text-gray-500">
              Queue: {formatNumber(metrics.realtime.queue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              Delivered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.realtime.delivered)}</div>
            <div className={`text-sm ${getRateColor(metrics.rates.deliveryRate, 'positive')}`}>
              {metrics.rates.deliveryRate.toFixed(1)}% rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Eye className="h-4 w-4 mr-2" />
              Opened
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.realtime.opened)}</div>
            <div className={`text-sm ${getRateColor(metrics.rates.openRate, 'positive')}`}>
              {metrics.rates.openRate.toFixed(1)}% rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <MousePointer className="h-4 w-4 mr-2" />
              Clicked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.realtime.clicked)}</div>
            <div className={`text-sm ${getRateColor(metrics.rates.clickRate, 'positive')}`}>
              {metrics.rates.clickRate.toFixed(1)}% rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <XCircle className="h-4 w-4 mr-2" />
              Bounced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.realtime.bounced)}</div>
            <div className={`text-sm ${getRateColor(metrics.rates.bounceRate, 'negative')}`}>
              {metrics.rates.bounceRate.toFixed(1)}% rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <UserX className="h-4 w-4 mr-2" />
              Unsubscribed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.realtime.unsubscribed)}</div>
            <div className={`text-sm ${getRateColor(metrics.rates.unsubscribeRate, 'negative')}`}>
              {metrics.rates.unsubscribeRate.toFixed(1)}% rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Complaints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.realtime.complained)}</div>
            <div className={`text-sm ${getRateColor(metrics.rates.complaintRate, 'negative')}`}>
              {metrics.rates.complaintRate.toFixed(1)}% rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Zap className="h-4 w-4 mr-2" />
              Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.throughput.current)}/min</div>
            <div className="text-sm text-gray-500">
              Capacity: {formatNumber(metrics.throughput.capacity)}/min
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trends Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Email Trends
          </CardTitle>
          <CardDescription>
            Email metrics over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h4 className="font-medium mb-2">Sent</h4>
              {renderSparkline(metrics.trends.sent)}
            </div>
            <div>
              <h4 className="font-medium mb-2">Delivered</h4>
              {renderSparkline(metrics.trends.delivered)}
            </div>
            <div>
              <h4 className="font-medium mb-2">Opened</h4>
              {renderSparkline(metrics.trends.opened)}
            </div>
            <div>
              <h4 className="font-medium mb-2">Clicked</h4>
              {renderSparkline(metrics.trends.clicked)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Active Campaigns
          </CardTitle>
          <CardDescription>
            Current campaign status and performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.campaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${getCampaignStatusColor(campaign.status)}`} />
                    <span className="font-medium">{campaign.name}</span>
                    <Badge variant={campaign.status === 'sending' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                  {campaign.status === 'sending' && (
                    <div className="text-sm text-gray-500">
                      Rate: {formatNumber(campaign.sendingRate)}/min
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Sent</div>
                    <div className="font-medium">{formatNumber(campaign.sent)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Delivered</div>
                    <div className="font-medium">{formatNumber(campaign.delivered)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Opened</div>
                    <div className="font-medium">{formatNumber(campaign.opened)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Clicked</div>
                    <div className="font-medium">{formatNumber(campaign.clicked)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Bounced</div>
                    <div className="font-medium">{formatNumber(campaign.bounced)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Unsubscribed</div>
                    <div className="font-medium">{formatNumber(campaign.unsubscribed)}</div>
                  </div>
                </div>

                {campaign.errors > 0 && (
                  <div className="mt-2 text-sm text-red-600">
                    {campaign.errors} errors detected
                  </div>
                )}

                {campaign.estimatedCompletion && (
                  <div className="mt-2 text-sm text-gray-500">
                    ETA: {new Date(campaign.estimatedCompletion).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Email Providers
          </CardTitle>
          <CardDescription>
            Provider performance and health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.providers.map((provider) => (
              <div key={provider.name} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(provider.status)}`} />
                    <span className="font-medium">{provider.name}</span>
                    <Badge variant={provider.status === 'healthy' ? 'default' : 'destructive'}>
                      {provider.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    Latency: {provider.avgLatency}ms
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Sent</div>
                    <div className="font-medium">{formatNumber(provider.sent)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Delivered</div>
                    <div className="font-medium">{formatNumber(provider.delivered)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Bounced</div>
                    <div className="font-medium">{formatNumber(provider.bounced)}</div>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-sm text-gray-500 mb-1">Delivery Rate</div>
                  <Progress 
                    value={provider.sent > 0 ? (provider.delivered / provider.sent) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}