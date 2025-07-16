'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  FileText, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Play,
  Pause,
  Square,
  RefreshCw,
  Download,
  TrendingUp,
  Database
} from 'lucide-react'

interface ImportJob {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
  totalRecords: number
  processedRecords: number
  validRecords: number
  invalidRecords: number
  duplicateRecords: number
  errorRecords: number
  startTime: number
  endTime?: number
  estimatedCompletion?: number
  throughput: number // records per second
  errors: Array<{
    line: number
    column: string
    message: string
    value: string
  }>
  validation: {
    emailValidation: number
    phoneValidation: number
    nameValidation: number
    customFieldValidation: number
  }
}

interface ImportMetrics {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  totalRecordsProcessed: number
  totalRecordsImported: number
  averageThroughput: number
  errorRate: number
  systemLoad: number
  memoryUsage: number
  queueSize: number
  workerCount: number
  activeWorkers: number
}

export default function ImportProgressDashboard() {
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [metrics, setMetrics] = useState<ImportMetrics | null>(null)
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = async () => {
    try {
      const [jobsResponse, metricsResponse] = await Promise.all([
        fetch('/api/monitoring/imports/jobs'),
        fetch('/api/monitoring/imports/metrics')
      ])

      if (!jobsResponse.ok || !metricsResponse.ok) {
        throw new Error('Failed to fetch import data')
      }

      const [jobsData, metricsData] = await Promise.all([
        jobsResponse.json(),
        metricsResponse.json()
      ])

      setJobs(jobsData)
      setMetrics(metricsData)
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

    const interval = setInterval(fetchData, 5000) // Refresh every 5 seconds for imports
    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleJobAction = async (jobId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      const response = await fetch(`/api/monitoring/imports/jobs/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error('Failed to perform action')
      }

      await fetchData()
    } catch (err) {
      console.error('Job action failed:', err)
    }
  }

  const getStatusColor = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'processing': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      case 'paused': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'paused': return <Pause className="h-4 w-4 text-yellow-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const calculateProgress = (job: ImportJob) => {
    if (job.totalRecords === 0) return 0
    return (job.processedRecords / job.totalRecords) * 100
  }

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const formatThroughput = (throughput: number) => {
    if (throughput >= 1000) {
      return `${(throughput / 1000).toFixed(1)}K/s`
    }
    return `${throughput.toFixed(0)}/s`
  }

  const estimateCompletion = (job: ImportJob) => {
    if (job.status !== 'processing' || job.throughput === 0) return null
    
    const remaining = job.totalRecords - job.processedRecords
    const secondsLeft = remaining / job.throughput
    const completionTime = Date.now() + (secondsLeft * 1000)
    
    return new Date(completionTime).toLocaleTimeString()
  }

  const downloadErrorReport = async (jobId: string) => {
    try {
      const response = await fetch(`/api/monitoring/imports/jobs/${jobId}/errors`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `import-errors-${jobId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download error report:', err)
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
        <h1 className="text-3xl font-bold">Import Progress Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh: {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.queueSize}</div>
              <div className="text-sm text-gray-500">Jobs in queue</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Workers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeWorkers}/{metrics.workerCount}</div>
              <div className="text-sm text-gray-500">Active workers</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatThroughput(metrics.averageThroughput)}</div>
              <div className="text-sm text-gray-500">Average rate</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Load</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.systemLoad.toFixed(1)}%</div>
              <Progress value={metrics.systemLoad} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Jobs Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Import Jobs
          </CardTitle>
          <CardDescription>
            Monitor active and completed import jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedJob?.id === job.id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedJob(job)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(job.status)}
                    <span className="font-medium">{job.filename}</span>
                    <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                      {job.status}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    {job.status === 'processing' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleJobAction(job.id, 'pause')
                          }}
                        >
                          <Pause className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleJobAction(job.id, 'cancel')
                          }}
                        >
                          <Square className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {job.status === 'paused' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleJobAction(job.id, 'resume')
                        }}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    {job.errors.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadErrorReport(job.id)
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-sm text-gray-500">Progress</div>
                    <div className="font-medium">
                      {job.processedRecords.toLocaleString()} / {job.totalRecords.toLocaleString()}
                    </div>
                    <Progress value={calculateProgress(job)} className="mt-1" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Throughput</div>
                    <div className="font-medium">{formatThroughput(job.throughput)}</div>
                    {job.status === 'processing' && (
                      <div className="text-sm text-gray-500">
                        ETA: {estimateCompletion(job)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Duration</div>
                    <div className="font-medium">{formatDuration(job.startTime, job.endTime)}</div>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-green-600">
                    Valid: {job.validRecords.toLocaleString()}
                  </span>
                  <span className="text-yellow-600">
                    Duplicates: {job.duplicateRecords.toLocaleString()}
                  </span>
                  <span className="text-red-600">
                    Invalid: {job.invalidRecords.toLocaleString()}
                  </span>
                  <span className="text-red-600">
                    Errors: {job.errorRecords.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Job Details Modal */}
      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Job Details: {selectedJob.filename}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Validation Results</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Email Validation</span>
                    <span className="font-mono">{selectedJob.validation.emailValidation}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phone Validation</span>
                    <span className="font-mono">{selectedJob.validation.phoneValidation}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Name Validation</span>
                    <span className="font-mono">{selectedJob.validation.nameValidation}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custom Fields</span>
                    <span className="font-mono">{selectedJob.validation.customFieldValidation}%</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Error Summary</h4>
                {selectedJob.errors.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedJob.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="p-2 bg-red-50 rounded text-sm">
                        <div className="font-medium text-red-800">
                          Line {error.line}, Column {error.column}
                        </div>
                        <div className="text-red-600">{error.message}</div>
                        <div className="text-gray-600 truncate">Value: {error.value}</div>
                      </div>
                    ))}
                    {selectedJob.errors.length > 5 && (
                      <div className="text-sm text-gray-500">
                        And {selectedJob.errors.length - 5} more errors...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No errors found</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}