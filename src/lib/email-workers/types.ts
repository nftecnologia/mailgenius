// Email Worker System Types

export interface EmailJob {
  id: string;
  workspace_id: string;
  campaign_id: string;
  priority: number;
  status: JobStatus;
  job_type: JobType;
  payload: JobPayload;
  batch_size: number;
  total_emails: number;
  processed_emails: number;
  failed_emails: number;
  retry_count: number;
  max_retries: number;
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  error_message?: string;
  worker_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EmailWorker {
  id: string;
  name: string;
  status: WorkerStatus;
  current_job_id?: string;
  max_concurrent_jobs: number;
  current_job_count: number;
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  last_heartbeat: Date;
  last_job_started?: Date;
  last_job_completed?: Date;
  total_jobs_processed: number;
  total_emails_sent: number;
  total_errors: number;
  performance_metrics: WorkerMetrics;
  config: WorkerConfig;
  created_at: Date;
  updated_at: Date;
}

export interface EmailJobBatch {
  id: string;
  job_id: string;
  batch_number: number;
  leads_data: Lead[];
  status: BatchStatus;
  started_at?: Date;
  completed_at?: Date;
  emails_sent: number;
  emails_failed: number;
  error_message?: string;
  created_at: Date;
}

export interface WorkerRateLimit {
  id: string;
  worker_id: string;
  time_window: Date;
  window_type: 'minute' | 'hour';
  emails_sent: number;
  created_at: Date;
}

export interface WorkerMetric {
  id: string;
  worker_id: string;
  metric_type: MetricType;
  metric_value: number;
  time_window: Date;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface EmailRetryJob {
  id: string;
  original_job_id: string;
  email_send_id: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: Date;
  status: RetryStatus;
  error_message?: string;
  created_at: Date;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
export type JobType = 'campaign' | 'automation' | 'transactional';
export type WorkerStatus = 'idle' | 'busy' | 'offline' | 'error';
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type MetricType = 'throughput' | 'success_rate' | 'error_rate' | 'response_time';
export type RetryStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'abandoned';

export interface JobPayload {
  campaign_id: string;
  template_id?: string;
  leads: Lead[];
  template_data: {
    subject: string;
    html_content: string;
    text_content?: string;
    variables?: Record<string, any>;
  };
  sender_info: {
    from: string;
    reply_to?: string;
  };
  tracking_config?: {
    campaign_id: string;
    workspace_id: string;
  };
}

export interface Lead {
  id: string;
  email: string;
  name?: string;
  company?: string;
  position?: string;
  phone?: string;
  custom_fields?: Record<string, any>;
}

export interface WorkerMetrics {
  avg_processing_time: number;
  success_rate: number;
  error_rate: number;
  throughput_per_hour: number;
  uptime_percentage: number;
  last_error?: string;
  last_error_time?: Date;
}

export interface WorkerConfig {
  max_batch_size: number;
  retry_delay_seconds: number;
  max_retry_attempts: number;
  health_check_interval: number;
  email_provider: 'resend' | 'sendgrid' | 'ses';
  rate_limit_buffer: number; // Percentage buffer for rate limits
  enable_metrics: boolean;
  enable_detailed_logging: boolean;
}

export interface JobCreationParams {
  workspace_id: string;
  campaign_id: string;
  priority?: number;
  job_type: JobType;
  payload: JobPayload;
  batch_size?: number;
  max_retries?: number;
  scheduled_at?: Date;
}

export interface WorkerRegistrationParams {
  name: string;
  max_concurrent_jobs?: number;
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  config?: Partial<WorkerConfig>;
}

export interface BatchProcessingResult {
  batch_id: string;
  total_emails: number;
  successful_emails: number;
  failed_emails: number;
  processing_time: number;
  errors: EmailError[];
}

export interface EmailError {
  lead_id: string;
  email: string;
  error_message: string;
  error_code?: string;
  timestamp: Date;
}

export interface WorkerStats {
  total_jobs_processed: number;
  total_emails_sent: number;
  success_rate: number;
  avg_processing_time: number;
  current_throughput: number;
  rate_limit_usage: {
    per_minute: number;
    per_hour: number;
  };
}

export interface SystemStats {
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

export interface WorkerHealth {
  worker_id: string;
  is_healthy: boolean;
  last_heartbeat: Date;
  last_job_completed?: Date;
  consecutive_failures: number;
  response_time: number;
  memory_usage?: number;
  cpu_usage?: number;
}