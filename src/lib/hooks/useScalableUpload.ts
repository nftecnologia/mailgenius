import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type {
  FileUploadJob,
  UploadProgress,
  ProcessingStats,
  CreateUploadJobResponse,
  UploadChunkResponse
} from '@/lib/types/upload-types';

interface UseScalableUploadConfig {
  onUploadComplete?: (result: any) => void;
  onUploadStart?: (uploadJob: FileUploadJob) => void;
  onUploadProgress?: (progress: UploadProgress) => void;
  onProcessingProgress?: (stats: ProcessingStats) => void;
  onError?: (error: Error) => void;
  uploadType?: 'leads_import' | 'template_assets' | 'bulk_email_assets';
  chunkSize?: number;
  maxConcurrentUploads?: number;
  maxRetries?: number;
}

interface ChunkState {
  index: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
  retryCount: number;
}

export function useScalableUpload(config: UseScalableUploadConfig = {}) {
  const {
    onUploadComplete,
    onUploadStart,
    onUploadProgress,
    onProcessingProgress,
    onError,
    uploadType = 'leads_import',
    chunkSize = 1024 * 1024, // 1MB
    maxConcurrentUploads = 3,
    maxRetries = 3
  } = config;

  const [uploadJob, setUploadJob] = useState<FileUploadJob | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [chunks, setChunks] = useState<ChunkState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startUpload = useCallback(async (file: File, validationRules?: any) => {
    if (isUploading) return;

    setIsUploading(true);
    setError(null);
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
          chunk_size: chunkSize,
          validation_rules: validationRules
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
      const initialChunks: ChunkState[] = chunk_urls.map((_, index) => ({
        index,
        status: 'pending',
        progress: 0,
        retryCount: 0
      }));
      setChunks(initialChunks);

      // Start progress polling
      startProgressPolling(upload_job.id);

      // Start chunk uploads
      await uploadChunks(file, upload_job.id);

      toast.success('Upload completed successfully');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Upload cancelled');
      } else {
        handleError(error);
      }
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, uploadType, chunkSize, onUploadStart]);

  const uploadChunks = useCallback(async (file: File, jobId: string) => {
    const totalChunks = Math.ceil(file.size / chunkSize);
    const semaphore = new Semaphore(maxConcurrentUploads);

    const chunkPromises = [];
    for (let i = 0; i < totalChunks; i++) {
      chunkPromises.push(
        semaphore.acquire().then(async () => {
          try {
            await uploadChunk(file, jobId, i);
          } finally {
            semaphore.release();
          }
        })
      );
    }

    await Promise.all(chunkPromises);
  }, [chunkSize, maxConcurrentUploads]);

  const uploadChunk = useCallback(async (file: File, jobId: string, chunkIndex: number) => {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    let retryCount = 0;
    let success = false;

    while (!success && retryCount < maxRetries) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      if (isPaused) {
        await waitForUnpause();
      }

      try {
        // Update chunk status
        setChunks(prev => prev.map(c => 
          c.index === chunkIndex 
            ? { ...c, status: 'uploading', retryCount } 
            : c
        ));

        const response = await fetch(`/api/upload/${jobId}/chunk/${chunkIndex}`, {
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

        const result: { data: UploadChunkResponse } = await response.json();

        // Update chunk status
        setChunks(prev => prev.map(c => 
          c.index === chunkIndex 
            ? { ...c, status: 'completed', progress: 100, retryCount } 
            : c
        ));

        success = true;
      } catch (error) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          setChunks(prev => prev.map(c => 
            c.index === chunkIndex 
              ? { 
                  ...c, 
                  status: 'failed', 
                  error: error instanceof Error ? error.message : 'Unknown error',
                  retryCount 
                } 
              : c
          ));
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }, [chunkSize, maxRetries, isPaused]);

  const startProcessing = useCallback(async (csvConfig?: any, importConfig?: any) => {
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

      // Start processing stats polling
      startProcessingStatsPolling(uploadJob.id);

      toast.success('Processing started successfully');
    } catch (error) {
      handleError(error);
      setIsProcessing(false);
    }
  }, [uploadJob]);

  const pauseUpload = useCallback(() => {
    setIsPaused(true);
    toast.info('Upload paused');
  }, []);

  const resumeUpload = useCallback(() => {
    setIsPaused(false);
    toast.info('Upload resumed');
  }, []);

  const cancelUpload = useCallback(async () => {
    if (uploadJob) {
      try {
        await fetch(`/api/upload/${uploadJob.id}/progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'cancel' })
        });
      } catch (error) {
        console.error('Error cancelling upload:', error);
      }
    }

    abortControllerRef.current?.abort();
    stopProgressPolling();
    stopProcessingStatsPolling();
    setIsUploading(false);
    setIsProcessing(false);
    toast.info('Upload cancelled');
  }, [uploadJob]);

  const retryFailedChunks = useCallback(async () => {
    if (!uploadJob) return;

    try {
      await fetch(`/api/upload/${uploadJob.id}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'retry' })
      });

      // Reset failed chunks
      setChunks(prev => prev.map(c => 
        c.status === 'failed' 
          ? { ...c, status: 'pending', progress: 0, error: undefined, retryCount: 0 }
          : c
      ));

      setError(null);
      toast.info('Retrying failed chunks');
    } catch (error) {
      handleError(error);
    }
  }, [uploadJob]);

  const startProgressPolling = useCallback((jobId: string) => {
    progressIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/upload/${jobId}/progress`);
        if (response.ok) {
          const result = await response.json();
          const progress = result.data;
          
          setUploadProgress(progress);
          onUploadProgress?.(progress);

          if (progress.status === 'completed' || progress.status === 'failed') {
            stopProgressPolling();
            if (progress.status === 'failed') {
              setError(progress.error_message || 'Upload failed');
            }
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    }, 2000);
  }, [onUploadProgress]);

  const startProcessingStatsPolling = useCallback((jobId: string) => {
    processingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/upload/${jobId}/process`);
        if (response.ok) {
          const result = await response.json();
          const stats = result.data;
          
          setProcessingStats(stats);
          onProcessingProgress?.(stats);

          if (stats.completed_batches + stats.failed_batches === stats.total_batches) {
            stopProcessingStatsPolling();
            setIsProcessing(false);
            onUploadComplete?.(stats);
          }
        }
      } catch (error) {
        console.error('Error polling processing stats:', error);
      }
    }, 3000);
  }, [onProcessingProgress, onUploadComplete]);

  const stopProgressPolling = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const stopProcessingStatsPolling = useCallback(() => {
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
  }, []);

  const waitForUnpause = useCallback((): Promise<void> => {
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
  }, [isPaused]);

  const handleError = useCallback((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    setError(errorMessage);
    onError?.(error instanceof Error ? error : new Error(errorMessage));
  }, [onError]);

  const reset = useCallback(() => {
    setUploadJob(null);
    setUploadProgress(null);
    setProcessingStats(null);
    setChunks([]);
    setIsUploading(false);
    setIsProcessing(false);
    setIsPaused(false);
    setError(null);
    
    abortControllerRef.current?.abort();
    stopProgressPolling();
    stopProcessingStatsPolling();
  }, [stopProgressPolling, stopProcessingStatsPolling]);

  return {
    // State
    uploadJob,
    uploadProgress,
    processingStats,
    chunks,
    isUploading,
    isProcessing,
    isPaused,
    error,
    
    // Actions
    startUpload,
    startProcessing,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryFailedChunks,
    reset,
    
    // Computed values
    totalChunks: chunks.length,
    completedChunks: chunks.filter(c => c.status === 'completed').length,
    failedChunks: chunks.filter(c => c.status === 'failed').length,
    uploadPercentage: chunks.length > 0 
      ? (chunks.filter(c => c.status === 'completed').length / chunks.length) * 100 
      : 0
  };
}

// Semaphore for controlling concurrent uploads
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      this.permits--;
      resolve();
    }
  }
}