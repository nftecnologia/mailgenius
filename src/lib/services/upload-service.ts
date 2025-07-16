import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  FileUploadJob,
  FileUploadChunk,
  ProcessingBatch,
  UploadConfig,
  UploadProgress,
  ProcessingStats,
  CreateUploadJobRequest,
  CreateUploadJobResponse,
  UploadChunkRequest,
  UploadChunkResponse,
  ProcessUploadRequest,
  ProcessUploadResponse,
  TempValidationData,
  LeadImportConfig,
  LeadImportResult,
  ValidationError,
  UploadMonitoringData,
  UploadSystemHealth
} from '@/lib/types/upload-types';

// Default upload configuration
const DEFAULT_CONFIG: UploadConfig = {
  max_file_size: 104_857_600, // 100MB
  max_chunk_size: 1_048_576, // 1MB
  allowed_file_types: ['text/csv', 'application/csv', 'text/plain'],
  max_concurrent_uploads: 5,
  batch_size: 1000,
  validation_rules: {
    required_fields: ['email'],
    email_validation: true,
    phone_validation: false,
    custom_validators: {},
    max_records: 500_000,
    duplicate_handling: 'skip'
  },
  storage_config: {
    temp_storage_path: '/tmp/uploads',
    permanent_storage_path: '/uploads',
    cleanup_after_hours: 24,
    compression_enabled: true,
    encryption_enabled: true
  }
};

export class UploadService {
  private config: UploadConfig;
  private activeUploads: Map<string, UploadProgress> = new Map();
  private processingQueue: Map<string, ProcessingBatch[]> = new Map();

  constructor(config: Partial<UploadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new upload job
   */
  async createUploadJob(
    request: CreateUploadJobRequest,
    userId: string,
    workspaceId: string
  ): Promise<CreateUploadJobResponse> {
    try {
      // Validate file size
      if (request.file_size > this.config.max_file_size) {
        throw new Error(`File size exceeds maximum limit of ${this.config.max_file_size} bytes`);
      }

      // Validate file type
      if (!this.config.allowed_file_types.includes(request.file_type)) {
        throw new Error(`File type ${request.file_type} is not allowed`);
      }

      // Calculate chunks
      const chunkSize = request.chunk_size || this.config.max_chunk_size;
      const totalChunks = Math.ceil(request.file_size / chunkSize);

      // Create upload job
      const uploadJob: Partial<FileUploadJob> = {
        workspace_id: workspaceId,
        user_id: userId,
        filename: request.filename,
        file_size: request.file_size,
        file_type: request.file_type,
        chunk_size: chunkSize,
        total_chunks: totalChunks,
        upload_type: request.upload_type,
        status: 'pending',
        upload_progress: 0,
        processing_progress: 0,
        total_records: 0,
        processed_records: 0,
        valid_records: 0,
        invalid_records: 0,
        retry_count: 0,
        max_retries: 3,
        metadata: {},
        validation_rules: request.validation_rules || this.config.validation_rules,
        processing_config: request.processing_config || {}
      };

      const { data: job, error } = await supabase
        .from('file_upload_jobs')
        .insert(uploadJob)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create upload job:', error);
        throw new Error('Failed to create upload job');
      }

      // Create chunk records
      const chunks: Partial<FileUploadChunk>[] = [];
      for (let i = 0; i < totalChunks; i++) {
        chunks.push({
          upload_job_id: job.id,
          chunk_index: i,
          chunk_size: i === totalChunks - 1 
            ? request.file_size - (i * chunkSize)
            : chunkSize,
          status: 'pending',
          upload_progress: 0,
          retry_count: 0
        });
      }

      const { error: chunksError } = await supabase
        .from('file_upload_chunks')
        .insert(chunks);

      if (chunksError) {
        logger.error('Failed to create upload chunks:', chunksError);
        throw new Error('Failed to create upload chunks');
      }

      // Generate upload URLs (in a real implementation, these would be signed URLs)
      const uploadUrl = `/api/upload/${job.id}`;
      const chunkUrls = chunks.map((_, index) => `/api/upload/${job.id}/chunk/${index}`);

      // Track upload progress
      this.activeUploads.set(job.id, {
        upload_job_id: job.id,
        filename: request.filename,
        file_size: request.file_size,
        upload_progress: 0,
        processing_progress: 0,
        total_chunks: totalChunks,
        uploaded_chunks: 0,
        status: 'pending',
        current_step: 'Preparing upload'
      });

      return {
        upload_job: job,
        upload_url: uploadUrl,
        chunk_urls: chunkUrls
      };
    } catch (error) {
      logger.error('Error creating upload job:', error);
      throw error;
    }
  }

  /**
   * Upload a file chunk
   */
  async uploadChunk(request: UploadChunkRequest): Promise<UploadChunkResponse> {
    try {
      // Validate chunk
      if (request.chunk_data.byteLength === 0) {
        throw new Error('Chunk data is empty');
      }

      // Calculate hash if not provided
      let chunkHash = request.chunk_hash;
      if (!chunkHash) {
        const hashSum = createHash('sha256');
        hashSum.update(new Uint8Array(request.chunk_data));
        chunkHash = hashSum.digest('hex');
      }

      // Update chunk status
      const { error: updateError } = await supabase
        .from('file_upload_chunks')
        .update({
          status: 'uploaded',
          upload_progress: 100,
          chunk_hash: chunkHash,
          storage_path: `/chunks/${request.upload_job_id}/${request.chunk_index}`,
          uploaded_at: new Date().toISOString()
        })
        .eq('upload_job_id', request.upload_job_id)
        .eq('chunk_index', request.chunk_index);

      if (updateError) {
        logger.error('Failed to update chunk status:', updateError);
        throw new Error('Failed to update chunk status');
      }

      // Update overall progress
      await this.updateUploadProgress(request.upload_job_id);

      // Log progress event
      await this.logProgressEvent(request.upload_job_id, 'chunk_uploaded', {
        chunk_index: request.chunk_index,
        chunk_size: request.chunk_data.byteLength,
        chunk_hash: chunkHash
      });

      const progress = await this.getUploadProgress(request.upload_job_id);
      
      return {
        chunk_id: `${request.upload_job_id}-${request.chunk_index}`,
        upload_progress: progress.upload_progress,
        total_progress: progress.upload_progress * 0.3 + progress.processing_progress * 0.7, // Upload is 30%, processing is 70%
        next_chunk_url: request.chunk_index < progress.total_chunks - 1 
          ? `/api/upload/${request.upload_job_id}/chunk/${request.chunk_index + 1}`
          : undefined
      };
    } catch (error) {
      logger.error('Error uploading chunk:', error);
      
      // Update chunk with error
      await supabase
        .from('file_upload_chunks')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          retry_count: (await this.getChunkRetryCount(request.upload_job_id, request.chunk_index)) + 1
        })
        .eq('upload_job_id', request.upload_job_id)
        .eq('chunk_index', request.chunk_index);

      throw error;
    }
  }

  /**
   * Start processing uploaded file
   */
  async startProcessing(request: ProcessUploadRequest): Promise<ProcessUploadResponse> {
    try {
      // Check if all chunks are uploaded
      const { data: chunks } = await supabase
        .from('file_upload_chunks')
        .select('status')
        .eq('upload_job_id', request.upload_job_id);

      if (!chunks || chunks.some(chunk => chunk.status !== 'uploaded')) {
        throw new Error('Not all chunks have been uploaded');
      }

      // Update job status to processing
      await supabase
        .from('file_upload_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', request.upload_job_id);

      // Create processing batches
      const batchSize = request.batch_size || this.config.batch_size;
      const batches = await this.createProcessingBatches(request.upload_job_id, batchSize);

      // Start async processing
      this.processFileAsync(request.upload_job_id, batches);

      return {
        processing_job_id: request.upload_job_id,
        estimated_completion: new Date(Date.now() + batches.length * 5000).toISOString(), // 5 seconds per batch estimate
        total_batches: batches.length
      };
    } catch (error) {
      logger.error('Error starting processing:', error);
      
      // Update job status to failed
      await supabase
        .from('file_upload_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', request.upload_job_id);

      throw error;
    }
  }

  /**
   * Get upload progress
   */
  async getUploadProgress(uploadJobId: string): Promise<UploadProgress> {
    try {
      const { data: progress } = await supabase
        .rpc('get_upload_job_progress', { job_id: uploadJobId });

      if (!progress || progress.error) {
        throw new Error('Upload job not found');
      }

      const cachedProgress = this.activeUploads.get(uploadJobId);
      const updatedProgress: UploadProgress = {
        upload_job_id: uploadJobId,
        filename: progress.filename,
        file_size: progress.file_size,
        upload_progress: progress.upload_progress,
        processing_progress: progress.processing_progress,
        total_chunks: progress.total_chunks,
        uploaded_chunks: progress.uploaded_chunks,
        status: progress.status,
        error_message: progress.error_message,
        current_step: cachedProgress?.current_step || 'Processing'
      };

      this.activeUploads.set(uploadJobId, updatedProgress);
      return updatedProgress;
    } catch (error) {
      logger.error('Error getting upload progress:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(uploadJobId: string): Promise<ProcessingStats> {
    try {
      const { data: stats } = await supabase
        .rpc('get_processing_stats', { job_id: uploadJobId });

      if (!stats) {
        throw new Error('No processing statistics found');
      }

      return {
        ...stats,
        processing_rate: stats.completed_batches > 0 
          ? stats.valid_records / (stats.completed_batches * 5) // Assuming 5 seconds per batch
          : 0,
        estimated_completion: new Date(
          Date.now() + (stats.pending_batches + stats.processing_batches) * 5000
        ).toISOString()
      };
    } catch (error) {
      logger.error('Error getting processing stats:', error);
      throw error;
    }
  }

  /**
   * Cancel upload job
   */
  async cancelUpload(uploadJobId: string): Promise<void> {
    try {
      await supabase
        .from('file_upload_jobs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', uploadJobId);

      // Cancel processing batches
      await supabase
        .from('processing_batches')
        .update({ status: 'cancelled' })
        .eq('upload_job_id', uploadJobId)
        .in('status', ['pending', 'processing']);

      // Remove from active uploads
      this.activeUploads.delete(uploadJobId);
      this.processingQueue.delete(uploadJobId);

      await this.logProgressEvent(uploadJobId, 'upload_cancelled', {});
    } catch (error) {
      logger.error('Error cancelling upload:', error);
      throw error;
    }
  }

  /**
   * Get monitoring data
   */
  async getMonitoringData(): Promise<UploadMonitoringData> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: jobs } = await supabase
        .from('file_upload_jobs')
        .select('status, created_at, completed_at, started_at')
        .gte('created_at', today.toISOString());

      if (!jobs) {
        throw new Error('Failed to fetch monitoring data');
      }

      const activeUploads = jobs.filter(job => 
        ['pending', 'uploading', 'processing'].includes(job.status)
      ).length;

      const queuedUploads = jobs.filter(job => job.status === 'pending').length;
      const completedToday = jobs.filter(job => job.status === 'completed').length;
      const failedToday = jobs.filter(job => job.status === 'failed').length;

      // Calculate average times
      const completedJobs = jobs.filter(job => 
        job.status === 'completed' && job.started_at && job.completed_at
      );

      const averageUploadTime = completedJobs.length > 0
        ? completedJobs.reduce((sum, job) => {
            const uploadTime = new Date(job.started_at!).getTime() - new Date(job.created_at).getTime();
            return sum + uploadTime;
          }, 0) / completedJobs.length
        : 0;

      const averageProcessingTime = completedJobs.length > 0
        ? completedJobs.reduce((sum, job) => {
            const processingTime = new Date(job.completed_at!).getTime() - new Date(job.started_at!).getTime();
            return sum + processingTime;
          }, 0) / completedJobs.length
        : 0;

      return {
        active_uploads: activeUploads,
        queued_uploads: queuedUploads,
        completed_uploads_today: completedToday,
        failed_uploads_today: failedToday,
        average_upload_time: averageUploadTime,
        average_processing_time: averageProcessingTime,
        storage_usage: 0, // Would need to implement storage calculation
        error_rate: jobs.length > 0 ? (failedToday / jobs.length) * 100 : 0
      };
    } catch (error) {
      logger.error('Error getting monitoring data:', error);
      throw error;
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<UploadSystemHealth> {
    try {
      const monitoringData = await this.getMonitoringData();
      
      let status: UploadSystemHealth['status'] = 'healthy';
      if (monitoringData.error_rate > 10) {
        status = 'unhealthy';
      } else if (monitoringData.error_rate > 5) {
        status = 'degraded';
      }

      return {
        status,
        upload_service: 'up',
        processing_service: 'up',
        storage_service: 'up',
        queue_depth: monitoringData.queued_uploads,
        error_count: monitoringData.failed_uploads_today,
        last_health_check: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting system health:', error);
      return {
        status: 'unhealthy',
        upload_service: 'down',
        processing_service: 'down',
        storage_service: 'down',
        queue_depth: 0,
        error_count: 0,
        last_health_check: new Date().toISOString()
      };
    }
  }

  // Private methods

  private async updateUploadProgress(uploadJobId: string): Promise<void> {
    const { data: chunks } = await supabase
      .from('file_upload_chunks')
      .select('status')
      .eq('upload_job_id', uploadJobId);

    if (chunks) {
      const uploadedChunks = chunks.filter(chunk => chunk.status === 'uploaded').length;
      const uploadProgress = Math.round((uploadedChunks / chunks.length) * 100);

      await supabase
        .from('file_upload_jobs')
        .update({
          upload_progress: uploadProgress,
          status: uploadProgress === 100 ? 'uploading' : 'pending'
        })
        .eq('id', uploadJobId);
    }
  }

  private async getChunkRetryCount(uploadJobId: string, chunkIndex: number): Promise<number> {
    const { data: chunk } = await supabase
      .from('file_upload_chunks')
      .select('retry_count')
      .eq('upload_job_id', uploadJobId)
      .eq('chunk_index', chunkIndex)
      .single();

    return chunk?.retry_count || 0;
  }

  private async createProcessingBatches(uploadJobId: string, batchSize: number): Promise<ProcessingBatch[]> {
    // This is a simplified implementation
    // In a real scenario, you would determine the total records from the file
    const totalRecords = 100000; // Placeholder
    const batches: Partial<ProcessingBatch>[] = [];

    for (let i = 0; i < totalRecords; i += batchSize) {
      const endRecord = Math.min(i + batchSize, totalRecords);
      batches.push({
        upload_job_id: uploadJobId,
        batch_index: Math.floor(i / batchSize),
        start_record: i,
        end_record: endRecord,
        batch_size: endRecord - i,
        status: 'pending',
        processing_progress: 0,
        total_records: endRecord - i,
        valid_records: 0,
        invalid_records: 0,
        processed_data: {},
        validation_errors: {},
        retry_count: 0
      });
    }

    const { data: createdBatches, error } = await supabase
      .from('processing_batches')
      .insert(batches)
      .select();

    if (error) {
      throw new Error('Failed to create processing batches');
    }

    return createdBatches;
  }

  private async processFileAsync(uploadJobId: string, batches: ProcessingBatch[]): Promise<void> {
    // This would be implemented as a background job
    // For now, we'll just log that processing started
    logger.info(`Started processing ${batches.length} batches for upload job ${uploadJobId}`);
    
    // In a real implementation, this would:
    // 1. Reconstruct the file from chunks
    // 2. Parse the CSV
    // 3. Process each batch
    // 4. Validate and transform data
    // 5. Insert into database
    // 6. Update progress
  }

  private async logProgressEvent(
    uploadJobId: string,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('upload_progress_events')
      .insert({
        upload_job_id: uploadJobId,
        event_type: eventType,
        event_data: eventData,
        message: `${eventType} completed`,
        created_at: new Date().toISOString()
      });
  }

  /**
   * Cleanup expired uploads
   */
  async cleanupExpiredUploads(): Promise<number> {
    try {
      const { data: result } = await supabase
        .rpc('cleanup_expired_uploads');

      return result || 0;
    } catch (error) {
      logger.error('Error cleaning up expired uploads:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const uploadService = new UploadService();