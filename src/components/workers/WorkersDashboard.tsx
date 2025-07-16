// Workers Dashboard Component

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Users, 
  Mail, 
  Clock, 
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  BarChart3,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

interface WorkerStats {
  total_workers: number;
  active_workers: number;
  idle_workers: number;
  busy_workers: number;
  offline_workers: number;
  pending_jobs: number;
  processing_jobs: number;
  completed_jobs_last_hour: number;
  failed_jobs_last_hour: number;
  total_emails_sent_last_hour: number;
  avg_system_throughput: number;
}

interface WorkerHealth {
  worker_id: string;
  is_healthy: boolean;
  last_heartbeat: string;
  last_job_completed?: string;
  consecutive_failures: number;
  response_time: number;
}

interface Alert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  worker_id?: string;
  metric_value?: number;
  threshold?: number;
}

export default function WorkersDashboard() {
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [health, setHealth] = useState<WorkerHealth[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch system stats
      const statsResponse = await fetch('/api/workers?action=stats');
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.data);
      }

      // Fetch worker health
      const healthResponse = await fetch('/api/workers?action=health');
      const healthData = await healthResponse.json();
      if (healthData.success) {
        setHealth(healthData.data);
      }

      // Fetch alerts
      const alertsResponse = await fetch('/api/workers?action=alerts');
      const alertsData = await alertsResponse.json();
      if (alertsData.success) {
        setAlerts(alertsData.data.alerts);
      }

      // Fetch system status
      const statusResponse = await fetch('/api/workers/startup');
      const statusData = await statusResponse.json();
      if (statusData.success) {
        setSystemStatus(statusData.data);
      }
    } catch (error) {
      console.error('Error fetching worker data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleSystemAction = async (action: string) => {
    try {
      const response = await fetch('/api/workers/startup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        fetchData(); // Refresh data after action
      }
    } catch (error) {
      console.error('Error performing system action:', error);
    }
  };

  const getWorkerStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 text-red-700';
      case 'high': return 'border-orange-500 text-orange-700';
      case 'medium': return 'border-yellow-500 text-yellow-700';
      case 'low': return 'border-blue-500 text-blue-700';
      default: return 'border-gray-500 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Workers Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Auto Refresh
          </Button>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant={systemStatus?.running ? 'default' : 'secondary'}>
                {systemStatus?.running ? 'Running' : 'Stopped'}
              </Badge>
              <span className="text-sm text-gray-600">
                {systemStatus?.active_workers || 0} active workers
              </span>
            </div>
            <div className="flex space-x-2">
              {!systemStatus?.running && (
                <Button
                  onClick={() => handleSystemAction('start')}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start System
                </Button>
              )}
              {systemStatus?.running && (
                <Button
                  onClick={() => handleSystemAction('stop')}
                  size="sm"
                  variant="destructive"
                >
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Stop System
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Active Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <Alert key={index} className={getAlertColor(alert.severity)}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{alert.severity.toUpperCase()}:</strong> {alert.message}
                    {alert.worker_id && (
                      <span className="ml-2 text-sm">
                        (Worker: {alert.worker_id.substring(0, 8)}...)
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_workers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.idle_workers || 0} idle, {stats?.busy_workers || 0} busy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending_jobs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.processing_jobs || 0} processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails/Hour</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_emails_sent_last_hour || 0}</div>
            <p className="text-xs text-muted-foreground">
              Throughput: {stats?.avg_system_throughput || 0}/h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.completed_jobs_last_hour && stats?.failed_jobs_last_hour
                ? Math.round((stats.completed_jobs_last_hour / (stats.completed_jobs_last_hour + stats.failed_jobs_last_hour)) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.completed_jobs_last_hour || 0} success, {stats?.failed_jobs_last_hour || 0} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Throughput Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Throughput Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Current: {stats?.avg_system_throughput || 0} emails/hour</span>
              <span>Target: 10,000 emails/hour</span>
            </div>
            <Progress 
              value={Math.min(((stats?.avg_system_throughput || 0) / 10000) * 100, 100)} 
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Worker Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Worker Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No workers found</p>
          ) : (
            <div className="space-y-2">
              {health.map((worker, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${worker.is_healthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <div className="font-medium text-sm">
                        {worker.worker_id.substring(0, 12)}...
                      </div>
                      <div className="text-xs text-gray-500">
                        Last heartbeat: {new Date(worker.last_heartbeat).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {worker.response_time}ms
                    </div>
                    <div className="text-xs text-gray-500">
                      {worker.consecutive_failures} failures
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}