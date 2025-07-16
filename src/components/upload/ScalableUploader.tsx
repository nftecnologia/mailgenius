'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, AlertCircle, CheckCircle, X, Pause, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { 
  FileUploadJob, 
  UploadProgress, 
  ProcessingStats,
  CreateUploadJobResponse 
} from '@/lib/types/upload-types';

interface ScalableUploaderProps {
  onUploadComplete?: (result: any) => void;
  onUploadStart?: (uploadJob: FileUploadJob) => void;
  uploadType?: 'leads_import' | 'template_assets' | 'bulk_email_assets';
  maxFileSize?: number;
  acceptedFileTypes?: string[];
  className?: string;
}

interface ChunkUploadState {
  index: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export function ScalableUploader({
  onUploadComplete,
  onUploadStart,
  uploadType = 'leads_import',
  maxFileSize = 104857600, // 100MB
  acceptedFileTypes = ['text/csv', 'application/csv'],
  className = ''
}: ScalableUploaderProps) {
  const [uploadJob, setUploadJob] = useState<FileUploadJob | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [chunks, setChunks] = useState<ChunkUploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvConfig, setCsvConfig] = useState({
    skip_header: true,
    delimiter: ',',
    encoding: 'utf8',
    field_mapping: {} as Record<string, string>,
    columns: [] as any[]
  });
  const [importConfig, setImportConfig] = useState({
    duplicate_handling: 'skip' as 'skip' | 'overwrite' | 'error',
    tag_new_leads: false,
    default_tags: [] as string[],
    source: 'csv_import'
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
      'text/plain': ['.csv']
    },
    maxSize: maxFileSize,
    multiple: false,
    onDrop: handleFileDrop,
    disabled: isUploading || isProcessing
  });

  async function handleFileDrop(acceptedFiles: File[]) {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setError(null);

    try {
      await startUpload(file);
    } catch (error) {
      handleError(error);
    }
  }

  async function startUpload(file: File) {
    setIsUploading(true);
    abortControllerRef.current = new AbortController();

    try {
      // Create upload job
      const response = await fetch('/api/upload/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          file_size: file.size,
          file_type: file.type,
          upload_type: uploadType,
          chunk_size: 1024 * 1024, // 1MB chunks
          validation_rules: {
            required_fields: ['email'],
            email_validation: true,
            max_records: 500000,
            duplicate_handling: importConfig.duplicate_handling
          }
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to create upload job');
      }

      const result: { data: CreateUploadJobResponse } = await response.json();
      const { upload_job, chunk_urls } = result.data;

      setUploadJob(upload_job);
      onUploadStart?.(upload_job);

      // Initialize chunk states
      const initialChunks: ChunkUploadState[] = chunk_urls.map((_, index) => ({
        index,
        status: 'pending',
        progress: 0
      }));
      setChunks(initialChunks);

      // Start progress polling
      startProgressPolling(upload_job.id);

      // Start chunk uploads
      await uploadChunks(file, chunk_urls);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Upload cancelled');
      } else {
        handleError(error);
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadChunks(file: File, chunkUrls: string[]) {
    const chunkSize = 1024 * 1024; // 1MB
    const totalChunks = Math.ceil(file.size / chunkSize);
    const concurrentUploads = 3; // Upload 3 chunks concurrently

    for (let i = 0; i < totalChunks; i += concurrentUploads) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      if (isPaused) {
        await waitForUnpause();
      }

      const chunkPromises = [];
      for (let j = 0; j < concurrentUploads && i + j < totalChunks; j++) {
        const chunkIndex = i + j;
        chunkPromises.push(uploadChunk(file, chunkIndex, chunkSize));
      }

      await Promise.all(chunkPromises);
    }
  }

  async function uploadChunk(file: File, chunkIndex: number, chunkSize: number) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    // Update chunk status
    setChunks(prev => prev.map(c => 
      c.index === chunkIndex ? { ...c, status: 'uploading' } : c
    ));

    try {
      const response = await fetch(`/api/upload/${uploadJob?.id}/chunk/${chunkIndex}`, {
        method: 'POST',
        body: chunk,
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        signal: abortControllerRef.current?.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to upload chunk ${chunkIndex}`);
      }

      // Update chunk status
      setChunks(prev => prev.map(c => 
        c.index === chunkIndex ? { ...c, status: 'completed', progress: 100 } : c
      ));

    } catch (error) {
      setChunks(prev => prev.map(c => 
        c.index === chunkIndex 
          ? { ...c, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' } 
          : c
      ));
      throw error;
    }
  }

  async function startProcessing() {
    if (!uploadJob) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/upload/${uploadJob.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csv_config: csvConfig,
          import_config: importConfig
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start processing');
      }

      const result = await response.json();
      toast.success('Processing started successfully');

      // Start polling for processing stats
      startProcessingStatsPolling(uploadJob.id);

    } catch (error) {
      handleError(error);
      setIsProcessing(false);
    }
  }

  function startProgressPolling(jobId: string) {
    progressIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/upload/${jobId}/progress`);
        if (response.ok) {
          const result = await response.json();
          setUploadProgress(result.data);

          if (result.data.status === 'completed' || result.data.status === 'failed') {
            stopProgressPolling();
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    }, 2000);
  }

  function startProcessingStatsPolling(jobId: string) {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/upload/${jobId}/process`);
        if (response.ok) {
          const result = await response.json();
          setProcessingStats(result.data);

          if (result.data.completed_batches + result.data.failed_batches === result.data.total_batches) {
            clearInterval(interval);
            setIsProcessing(false);
            onUploadComplete?.(result.data);
          }
        }
      } catch (error) {
        console.error('Error polling processing stats:', error);
      }
    }, 3000);
  }

  function stopProgressPolling() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }

  async function cancelUpload() {
    if (uploadJob) {
      await fetch(`/api/upload/${uploadJob.id}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cancel' })
      });
    }

    abortControllerRef.current?.abort();
    stopProgressPolling();
    setIsUploading(false);
    setIsProcessing(false);
    toast.info('Upload cancelled');
  }

  function pauseUpload() {
    setIsPaused(true);
    toast.info('Upload paused');
  }

  function resumeUpload() {
    setIsPaused(false);
    toast.info('Upload resumed');
  }

  async function retryUpload() {
    if (!uploadJob) return;

    await fetch(`/api/upload/${uploadJob.id}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'retry' })
    });

    // Reset chunk states
    setChunks(prev => prev.map(c => ({ ...c, status: 'pending', progress: 0, error: undefined })));
    setError(null);
    toast.info('Retrying failed chunks');
  }

  function waitForUnpause(): Promise<void> {
    return new Promise((resolve) => {
      const checkPause = () => {
        if (!isPaused) {
          resolve();
        } else {
          setTimeout(checkPause, 100);
        }
      };
      checkPause();
    });
  }

  function handleError(error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    setError(message);
    toast.error(message);
  }

  function renderUploadArea() {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Scalable File Upload
          </CardTitle>
          <CardDescription>
            Upload large CSV files (up to 100MB) for lead import with real-time progress tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Drop the file here...</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Drag & drop a CSV file here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Maximum file size: {Math.round(maxFileSize / 1024 / 1024)}MB
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderUploadProgress() {
    if (!uploadJob || !uploadProgress) return null;

    const completedChunks = chunks.filter(c => c.status === 'completed').length;
    const failedChunks = chunks.filter(c => c.status === 'failed').length;
    const totalChunks = chunks.length;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Upload Progress</span>
            <div className="flex gap-2">
              {isUploading && (
                <>
                  {isPaused ? (
                    <Button size="sm" onClick={resumeUpload}>
                      <Play className="h-4 w-4 mr-1" />
                      Resume
                    </Button>
                  ) : (
                    <Button size="sm" onClick={pauseUpload}>
                      <Pause className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={cancelUpload}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </>
              )}
              {failedChunks > 0 && (
                <Button size="sm" onClick={retryUpload}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>File: {uploadJob.filename}</span>
                <span>{completedChunks}/{totalChunks} chunks</span>
              </div>
              <Progress value={uploadProgress.upload_progress} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <Badge variant="outline" className="w-full justify-center">
                  Completed: {completedChunks}
                </Badge>
              </div>
              <div>
                <Badge variant="secondary" className="w-full justify-center">
                  Failed: {failedChunks}
                </Badge>
              </div>
              <div>
                <Badge variant="default" className="w-full justify-center">
                  Total: {totalChunks}
                </Badge>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p>Status: {uploadProgress.status}</p>
              <p>Current step: {uploadProgress.current_step}</p>
              {uploadProgress.estimated_time_remaining && (
                <p>Estimated time remaining: {Math.round(uploadProgress.estimated_time_remaining / 1000)}s</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderProcessingStats() {
    if (!processingStats) return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Processing Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Batches</div>
              <div className="font-semibold">{processingStats.total_batches}</div>
            </div>
            <div>
              <div className="text-gray-600">Completed</div>
              <div className="font-semibold text-green-600">{processingStats.completed_batches}</div>
            </div>
            <div>
              <div className="text-gray-600">Failed</div>
              <div className="font-semibold text-red-600">{processingStats.failed_batches}</div>
            </div>
            <div>
              <div className="text-gray-600">Processing Rate</div>
              <div className="font-semibold">{Math.round(processingStats.processing_rate)}/s</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Processing Progress</span>
              <span>{processingStats.completed_batches}/{processingStats.total_batches}</span>
            </div>
            <Progress 
              value={(processingStats.completed_batches / processingStats.total_batches) * 100} 
              className="h-2" 
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderConfiguration() {
    if (!uploadJob || uploadJob.upload_type !== 'leads_import') return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Import Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delimiter">CSV Delimiter</Label>
              <Select value={csvConfig.delimiter} onValueChange={(value) => 
                setCsvConfig(prev => ({ ...prev, delimiter: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (,)</SelectItem>
                  <SelectItem value=";">Semicolon (;)</SelectItem>
                  <SelectItem value="\t">Tab</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="duplicate-handling">Duplicate Handling</Label>
              <Select value={importConfig.duplicate_handling} onValueChange={(value: any) => 
                setImportConfig(prev => ({ ...prev, duplicate_handling: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip duplicates</SelectItem>
                  <SelectItem value="overwrite">Overwrite duplicates</SelectItem>
                  <SelectItem value="error">Error on duplicates</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="skip-header"
              checked={csvConfig.skip_header}
              onCheckedChange={(checked) => 
                setCsvConfig(prev => ({ ...prev, skip_header: checked as boolean }))
              }
            />
            <Label htmlFor="skip-header">Skip header row</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="tag-new-leads"
              checked={importConfig.tag_new_leads}
              onCheckedChange={(checked) => 
                setImportConfig(prev => ({ ...prev, tag_new_leads: checked as boolean }))
              }
            />
            <Label htmlFor="tag-new-leads">Tag new leads</Label>
          </div>

          <div>
            <Label htmlFor="source">Import Source</Label>
            <Input 
              id="source"
              value={importConfig.source}
              onChange={(e) => setImportConfig(prev => ({ ...prev, source: e.target.value }))}
              placeholder="e.g., csv_import, lead_magnet, etc."
            />
          </div>

          {uploadProgress?.upload_progress === 100 && (
            <Button onClick={startProcessing} disabled={isProcessing} className="w-full">
              {isProcessing ? 'Processing...' : 'Start Processing'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!uploadJob && renderUploadArea()}
      {renderUploadProgress()}
      {renderConfiguration()}
      {renderProcessingStats()}
    </div>
  );
}