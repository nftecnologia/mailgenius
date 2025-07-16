'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, AlertCircle, CheckCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { ScalableUploader } from '@/components/upload/ScalableUploader';
import { UploadMonitoringDashboard } from '@/components/upload/UploadMonitoringDashboard';
import { useScalableUpload } from '@/lib/hooks/useScalableUpload';

export default function LeadsImportPage() {
  const [activeTab, setActiveTab] = useState('upload');
  const [importResults, setImportResults] = useState<any>(null);

  const {
    uploadJob,
    uploadProgress,
    processingStats,
    chunks,
    isUploading,
    isProcessing,
    error,
    startUpload,
    startProcessing,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryFailedChunks,
    reset,
    totalChunks,
    completedChunks,
    failedChunks,
    uploadPercentage
  } = useScalableUpload({
    uploadType: 'leads_import',
    onUploadComplete: (result) => {
      setImportResults(result);
      toast.success(`Import completed! ${result.leads_created} leads imported`);
      setActiveTab('results');
    },
    onUploadStart: (job) => {
      toast.info(`Starting upload: ${job.filename}`);
    },
    onError: (error) => {
      toast.error(`Upload error: ${error.message}`);
    }
  });

  const handleUploadComplete = (result: any) => {
    setImportResults(result);
    toast.success(`Import completed successfully!`);
    setActiveTab('results');
  };

  const handleUploadStart = (uploadJob: any) => {
    toast.info(`Starting upload: ${uploadJob.filename}`);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const renderResults = () => {
    if (!importResults) return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Import Results
            </CardTitle>
            <CardDescription>
              Summary of your lead import process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(importResults.leads_created || 0)}
                </div>
                <div className="text-sm text-green-700">Leads Created</div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(importResults.leads_updated || 0)}
                </div>
                <div className="text-sm text-blue-700">Leads Updated</div>
              </div>
              
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {formatNumber(importResults.leads_skipped || 0)}
                </div>
                <div className="text-sm text-yellow-700">Leads Skipped</div>
              </div>
              
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {formatNumber(importResults.leads_failed || 0)}
                </div>
                <div className="text-sm text-red-700">Leads Failed</div>
              </div>
            </div>

            {importResults.validation_errors && importResults.validation_errors.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-2">Validation Errors</h4>
                <div className="max-h-64 overflow-y-auto">
                  {importResults.validation_errors.slice(0, 10).map((error: any, index: number) => (
                    <Alert key={index} variant="destructive" className="mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Row {error.row}: {error.error_message}
                      </AlertDescription>
                    </Alert>
                  ))}
                  {importResults.validation_errors.length > 10 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ... and {importResults.validation_errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <Button onClick={() => setActiveTab('upload')}>
                Import Another File
              </Button>
              <Button variant="outline" onClick={reset}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scalable Lead Import</h1>
        <p className="text-gray-600">
          Upload large CSV files (up to 100MB) with real-time progress tracking and processing
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            <Activity className="h-4 w-4 mr-2" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!importResults}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <ScalableUploader
              onUploadComplete={handleUploadComplete}
              onUploadStart={handleUploadStart}
              uploadType="leads_import"
              maxFileSize={104857600} // 100MB
              acceptedFileTypes={['text/csv', 'application/csv', 'text/plain']}
            />

            {uploadJob && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">File Size</div>
                      <div className="font-semibold">
                        {Math.round(uploadJob.file_size / 1024 / 1024)} MB
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Chunks</div>
                      <div className="font-semibold">
                        {completedChunks}/{totalChunks}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Progress</div>
                      <div className="font-semibold">
                        {uploadPercentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {processingStats && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm font-medium mb-2">Processing Statistics</div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Valid Records</div>
                          <div className="font-semibold text-green-600">
                            {formatNumber(processingStats.valid_records)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Invalid Records</div>
                          <div className="font-semibold text-red-600">
                            {formatNumber(processingStats.invalid_records)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Processing Rate</div>
                          <div className="font-semibold">
                            {Math.round(processingStats.processing_rate)}/sec
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Batches</div>
                          <div className="font-semibold">
                            {processingStats.completed_batches}/{processingStats.total_batches}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="monitoring">
          <UploadMonitoringDashboard />
        </TabsContent>

        <TabsContent value="results">
          {renderResults()}
        </TabsContent>
      </Tabs>
    </div>
  );
}