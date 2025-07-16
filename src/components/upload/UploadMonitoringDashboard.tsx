'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity, 
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  UploadMonitoringData, 
  UploadSystemHealth, 
  FileUploadJob 
} from '@/lib/types/upload-types';

interface UploadMonitoringDashboardProps {
  className?: string;
}

export function UploadMonitoringDashboard({ className = '' }: UploadMonitoringDashboardProps) {
  const [monitoringData, setMonitoringData] = useState<UploadMonitoringData | null>(null);
  const [systemHealth, setSystemHealth] = useState<UploadSystemHealth | null>(null);
  const [recentUploads, setRecentUploads] = useState<FileUploadJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonitoringData();
    fetchSystemHealth();
    fetchRecentUploads();

    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchMonitoringData();
      fetchSystemHealth();
      fetchRecentUploads();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  async function fetchMonitoringData() {
    try {
      const response = await fetch('/api/upload/monitoring?action=stats');
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring data');
      }
      
      const result = await response.json();
      setMonitoringData(result.data);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      setError('Failed to fetch monitoring data');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSystemHealth() {
    try {
      const response = await fetch('/api/upload/monitoring?action=health');
      if (!response.ok) {
        throw new Error('Failed to fetch system health');
      }
      
      const result = await response.json();
      setSystemHealth(result.data);
    } catch (error) {
      console.error('Error fetching system health:', error);
    }
  }

  async function fetchRecentUploads() {
    try {
      const response = await fetch('/api/upload/create');
      if (!response.ok) {
        throw new Error('Failed to fetch recent uploads');
      }
      
      const result = await response.json();
      setRecentUploads(result.data.slice(0, 10)); // Show last 10 uploads
    } catch (error) {
      console.error('Error fetching recent uploads:', error);
    }
  }

  async function handleCleanup() {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/upload/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cleanup' })
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup expired uploads');
      }

      const result = await response.json();
      toast.success(`Cleaned up ${result.data} expired uploads`);
      
      // Refresh data
      await fetchMonitoringData();
      await fetchRecentUploads();
    } catch (error) {
      toast.error('Failed to cleanup expired uploads');
    } finally {
      setIsRefreshing(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'uploading':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getHealthStatusColor(status: string) {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'unhealthy':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDuration(ms: number) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Health */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health
              </span>
              <Badge 
                variant="outline" 
                className={getHealthStatusColor(systemHealth.status)}
              >
                {systemHealth.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {systemHealth.upload_service === 'up' ? '✓' : '✗'}
                </div>
                <div className="text-sm text-gray-600">Upload Service</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {systemHealth.processing_service === 'up' ? '✓' : '✗'}
                </div>
                <div className="text-sm text-gray-600">Processing Service</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {systemHealth.storage_service === 'up' ? '✓' : '✗'}
                </div>
                <div className="text-sm text-gray-600">Storage Service</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Queue Depth:</span>
                <span className="ml-2 font-semibold">{systemHealth.queue_depth}</span>
              </div>
              <div>
                <span className="text-gray-600">Error Count:</span>
                <span className="ml-2 font-semibold">{systemHealth.error_count}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monitoring Statistics */}
      {monitoringData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Uploads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {monitoringData.active_uploads}
              </div>
              <div className="text-sm text-gray-500">
                Currently uploading
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Queued Uploads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {monitoringData.queued_uploads}
              </div>
              <div className="text-sm text-gray-500">
                Waiting to process
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Completed Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {monitoringData.completed_uploads_today}
              </div>
              <div className="text-sm text-gray-500">
                Successfully processed
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Failed Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {monitoringData.failed_uploads_today}
              </div>
              <div className="text-sm text-gray-500">
                Processing failures
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Metrics */}
      {monitoringData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Average Upload Time</div>
                <div className="text-lg font-semibold">
                  {formatDuration(monitoringData.average_upload_time)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Average Processing Time</div>
                <div className="text-lg font-semibold">
                  {formatDuration(monitoringData.average_processing_time)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Error Rate</div>
                <div className="text-lg font-semibold">
                  {monitoringData.error_rate.toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Uploads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Uploads
            </span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  fetchMonitoringData();
                  fetchSystemHealth();
                  fetchRecentUploads();
                }}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleCleanup}
                disabled={isRefreshing}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Cleanup
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentUploads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No recent uploads found
              </div>
            ) : (
              recentUploads.map((upload) => (
                <div 
                  key={upload.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Upload className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">{upload.filename}</div>
                      <div className="text-sm text-gray-500">
                        {formatFileSize(upload.file_size)} • {upload.upload_type}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {new Date(upload.created_at).toLocaleString()}
                      </div>
                      <div className="text-sm font-medium">
                        {upload.total_records > 0 && (
                          <span>{upload.valid_records}/{upload.total_records} records</span>
                        )}
                      </div>
                    </div>
                    <Badge className={getStatusColor(upload.status)}>
                      {upload.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}