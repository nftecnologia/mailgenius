// Types for the scalable upload system

export interface FileUploadJob {
  id: string;
  workspace_id: string;
  user_id: string;
  
  // File Information
  filename: string;
  file_size: number;
  file_type: string;
  file_hash?: string;
  
  // Upload Configuration
  chunk_size: number;
  total_chunks: number;
  upload_type: 'leads_import' | 'template_assets' | 'bulk_email_assets';
  
  // Processing Status
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  upload_progress: number;
  processing_progress: number;
  
  // Storage Information
  storage_path?: string;
  temp_storage_path?: string;
  
  // Processing Results
  total_records: number;
  processed_records: number;
  valid_records: number;
  invalid_records: number;
  
  // Error Handling
  error_message?: string;
  error_details?: Record<string, any>;
  retry_count: number;
  max_retries: number;
  
  // Metadata
  metadata: Record<string, any>;
  validation_rules: Record<string, any>;
  processing_config: Record<string, any>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  expires_at: string;
}

export interface FileUploadChunk {
  id: string;
  upload_job_id: string;
  
  // Chunk Information
  chunk_index: number;
  chunk_size: number;
  chunk_hash?: string;
  
  // Status
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  upload_progress: number;
  
  // Storage
  storage_path?: string;
  
  // Error Handling
  error_message?: string;
  retry_count: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  uploaded_at?: string;
}

export interface ProcessingBatch {
  id: string;
  upload_job_id: string;
  
  // Batch Information
  batch_index: number;
  start_record: number;
  end_record: number;
  batch_size: number;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_progress: number;
  
  // Results
  total_records: number;
  valid_records: number;
  invalid_records: number;
  
  // Processing Data
  processed_data: Record<string, any>;
  validation_errors: Record<string, any>;
  
  // Error Handling
  error_message?: string;
  retry_count: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface UploadProgressEvent {
  id: string;
  upload_job_id: string;
  
  // Event Information
  event_type: string;
  event_data: Record<string, any>;
  
  // Progress
  current_progress: number;
  total_progress: number;
  
  // Message
  message?: string;
  
  // Timestamp
  created_at: string;
}

export interface TempValidationData {
  id: string;
  upload_job_id: string;
  batch_id: string;
  
  // Record Information
  record_index: number;
  raw_data: Record<string, any>;
  
  // Validation Results
  is_valid: boolean;
  validation_errors: Record<string, any>;
  processed_data: Record<string, any>;
  
  // Lead Information (for leads import)
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  position?: string;
  custom_fields: Record<string, any>;
  
  // Status
  status: 'pending' | 'validated' | 'processed' | 'failed';
  
  // Timestamps
  created_at: string;
  processed_at?: string;
}

// Upload Configuration Types
export interface UploadConfig {
  max_file_size: number; // in bytes
  max_chunk_size: number; // in bytes
  allowed_file_types: string[];
  max_concurrent_uploads: number;
  batch_size: number;
  validation_rules: ValidationRules;
  storage_config: StorageConfig;
}

export interface ValidationRules {
  required_fields: string[];
  email_validation: boolean;
  phone_validation: boolean;
  custom_validators: Record<string, any>;
  max_records: number;
  duplicate_handling: 'skip' | 'overwrite' | 'error';
}

export interface StorageConfig {
  temp_storage_path: string;
  permanent_storage_path: string;
  cleanup_after_hours: number;
  compression_enabled: boolean;
  encryption_enabled: boolean;
}

// Upload Progress Types
export interface UploadProgress {
  upload_job_id: string;
  filename: string;
  file_size: number;
  upload_progress: number;
  processing_progress: number;
  total_chunks: number;
  uploaded_chunks: number;
  status: FileUploadJob['status'];
  error_message?: string;
  estimated_time_remaining?: number;
  current_step: string;
}

// Processing Statistics
export interface ProcessingStats {
  total_batches: number;
  completed_batches: number;
  failed_batches: number;
  pending_batches: number;
  processing_batches: number;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  processing_rate: number; // records per second
  estimated_completion: string;
}

// API Request/Response Types
export interface CreateUploadJobRequest {
  filename: string;
  file_size: number;
  file_type: string;
  upload_type: FileUploadJob['upload_type'];
  chunk_size?: number;
  validation_rules?: Partial<ValidationRules>;
  processing_config?: Record<string, any>;
}

export interface CreateUploadJobResponse {
  upload_job: FileUploadJob;
  upload_url: string;
  chunk_urls: string[];
}

export interface UploadChunkRequest {
  upload_job_id: string;
  chunk_index: number;
  chunk_data: ArrayBuffer;
  chunk_hash?: string;
}

export interface UploadChunkResponse {
  chunk_id: string;
  upload_progress: number;
  total_progress: number;
  next_chunk_url?: string;
}

export interface ProcessUploadRequest {
  upload_job_id: string;
  force_reprocess?: boolean;
  batch_size?: number;
}

export interface ProcessUploadResponse {
  processing_job_id: string;
  estimated_completion: string;
  total_batches: number;
}

// CSV Processing Types
export interface CSVColumn {
  name: string;
  type: 'string' | 'email' | 'phone' | 'number' | 'date' | 'boolean';
  required: boolean;
  validation_rules?: Record<string, any>;
}

export interface CSVMappingConfig {
  columns: CSVColumn[];
  field_mapping: Record<string, string>; // CSV column -> database field
  skip_header: boolean;
  delimiter: string;
  encoding: string;
}

// Lead Import Specific Types
export interface LeadImportConfig {
  duplicate_handling: 'skip' | 'overwrite' | 'error';
  tag_new_leads: boolean;
  default_tags: string[];
  segment_id?: string;
  source: string;
  custom_field_mapping: Record<string, string>;
}

export interface LeadImportResult {
  total_processed: number;
  leads_created: number;
  leads_updated: number;
  leads_skipped: number;
  leads_failed: number;
  validation_errors: ValidationError[];
  duplicate_emails: string[];
  invalid_emails: string[];
}

export interface ValidationError {
  row: number;
  column: string;
  value: any;
  error_type: string;
  error_message: string;
}

// Monitoring Types
export interface UploadMonitoringData {
  active_uploads: number;
  queued_uploads: number;
  completed_uploads_today: number;
  failed_uploads_today: number;
  average_upload_time: number;
  average_processing_time: number;
  storage_usage: number;
  error_rate: number;
}

export interface UploadSystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  upload_service: 'up' | 'down' | 'degraded';
  processing_service: 'up' | 'down' | 'degraded';
  storage_service: 'up' | 'down' | 'degraded';
  queue_depth: number;
  error_count: number;
  last_health_check: string;
}