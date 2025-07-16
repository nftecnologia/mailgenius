'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import QueueMonitoringDashboard from '@/components/queue/QueueMonitoringDashboard'
import { 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Users,
  Mail,
  TrendingUp
} from 'lucide-react'

export default function QueueDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')

  // Mock data for demonstration
  const quickStats = {
    activeImports: 3,
    activeSends: 12,
    completedToday: 45,
    failedToday: 2,
  }

  const recentActivity = [
    {
      id: '1',
      type: 'leads-import',
      message: 'Imported 5,000 leads from CSV',
      status: 'completed',
      timestamp: '2 minutes ago'
    },
    {
      id: '2',
      type: 'email-sending',
      message: 'Campaign "Summer Sale" sent to 10,000 recipients',
      status: 'processing',
      timestamp: '5 minutes ago'
    },
    {
      id: '3',
      type: 'leads-import',
      message: 'API import from integration partner',
      status: 'failed',
      timestamp: '12 minutes ago'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'processing':
        return 'bg-blue-500'
      case 'failed':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />
      case 'processing':
        return <Activity className="w-4 h-4" />
      case 'failed':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'leads-import':
        return <Users className="w-4 h-4" />
      case 'email-sending':
        return <Mail className="w-4 h-4" />
      case 'campaign-processing':
        return <TrendingUp className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Queue Dashboard</h1>
          <p className="text-gray-600">Monitor and manage your background processing</p>
        </div>
        <Button variant="outline">
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Active Imports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-2xl font-bold">{quickStats.activeImports}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Active Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Mail className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold">{quickStats.activeSends}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Completed Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold">{quickStats.completedToday}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Failed Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-2xl font-bold">{quickStats.failedToday}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg border">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(activity.type)}
                      <Badge className={getStatusColor(activity.status)}>
                        {getStatusIcon(activity.status)}
                        <span className="ml-1 capitalize">{activity.status}</span>
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Getting Started */}
          <Card>
            <CardHeader>
              <CardTitle>Getting Started with Queue System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900">📥 Lead Import</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Upload CSV files or use API endpoints to import leads in bulk. The system automatically chunks large datasets for efficient processing.
                  </p>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-900">📧 Email Campaigns</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Send targeted email campaigns to your leads. Built-in rate limiting and retry mechanisms ensure reliable delivery.
                  </p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-900">📊 Real-time Monitoring</h3>
                  <p className="text-sm text-purple-700 mt-1">
                    Track progress in real-time with detailed metrics, error reporting, and performance analytics.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring">
          <QueueMonitoringDashboard />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Processing History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">History Coming Soon</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Detailed processing history and analytics will be available here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}