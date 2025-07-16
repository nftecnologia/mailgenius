-- Email Workers and Job Queue System
-- Migration for parallel email processing

-- Job Queue for Email Sending
CREATE TABLE email_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, retrying
    job_type VARCHAR(50) NOT NULL, -- campaign, automation, transactional
    payload JSONB NOT NULL, -- Job data (leads, templates, etc.)
    batch_size INTEGER DEFAULT 100,
    total_emails INTEGER DEFAULT 0,
    processed_emails INTEGER DEFAULT 0,
    failed_emails INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    worker_id VARCHAR(100), -- ID of the worker processing this job
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Workers Management
CREATE TABLE email_workers (
    id VARCHAR(100) PRIMARY KEY, -- Unique worker identifier
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'idle', -- idle, busy, offline, error
    current_job_id UUID REFERENCES email_jobs(id),
    max_concurrent_jobs INTEGER DEFAULT 1,
    current_job_count INTEGER DEFAULT 0,
    rate_limit_per_minute INTEGER DEFAULT 100, -- Emails per minute
    rate_limit_per_hour INTEGER DEFAULT 1000, -- Emails per hour
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_job_started TIMESTAMP WITH TIME ZONE,
    last_job_completed TIMESTAMP WITH TIME ZONE,
    total_jobs_processed INTEGER DEFAULT 0,
    total_emails_sent INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    performance_metrics JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Batches for tracking email sending progress
CREATE TABLE email_job_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES email_jobs(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    leads_data JSONB NOT NULL, -- Array of leads for this batch
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    emails_sent INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate Limiting Tracking
CREATE TABLE worker_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id VARCHAR(100) REFERENCES email_workers(id),
    time_window TIMESTAMP WITH TIME ZONE NOT NULL, -- Start of the time window (minute/hour)
    window_type VARCHAR(10) NOT NULL, -- 'minute' or 'hour'
    emails_sent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Worker Performance Metrics
CREATE TABLE worker_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id VARCHAR(100) REFERENCES email_workers(id),
    metric_type VARCHAR(50) NOT NULL, -- throughput, success_rate, error_rate, response_time
    metric_value NUMERIC NOT NULL,
    time_window TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Retry Jobs for Failed Emails
CREATE TABLE email_retry_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_job_id UUID REFERENCES email_jobs(id),
    email_send_id UUID REFERENCES email_sends(id),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, abandoned
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_email_jobs_status ON email_jobs(status);
CREATE INDEX idx_email_jobs_priority ON email_jobs(priority DESC);
CREATE INDEX idx_email_jobs_scheduled_at ON email_jobs(scheduled_at);
CREATE INDEX idx_email_jobs_workspace ON email_jobs(workspace_id);
CREATE INDEX idx_email_jobs_campaign ON email_jobs(campaign_id);
CREATE INDEX idx_email_jobs_worker ON email_jobs(worker_id);

CREATE INDEX idx_email_workers_status ON email_workers(status);
CREATE INDEX idx_email_workers_heartbeat ON email_workers(last_heartbeat);

CREATE INDEX idx_email_job_batches_job ON email_job_batches(job_id);
CREATE INDEX idx_email_job_batches_status ON email_job_batches(status);

CREATE INDEX idx_worker_rate_limits_worker_window ON worker_rate_limits(worker_id, time_window, window_type);

CREATE INDEX idx_worker_metrics_worker_type ON worker_metrics(worker_id, metric_type);
CREATE INDEX idx_worker_metrics_time_window ON worker_metrics(time_window);

CREATE INDEX idx_email_retry_jobs_original_job ON email_retry_jobs(original_job_id);
CREATE INDEX idx_email_retry_jobs_next_retry ON email_retry_jobs(next_retry_at);
CREATE INDEX idx_email_retry_jobs_status ON email_retry_jobs(status);

-- Triggers for updated_at
CREATE TRIGGER update_email_jobs_updated_at BEFORE UPDATE ON email_jobs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_email_workers_updated_at BEFORE UPDATE ON email_workers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS Policies
ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_job_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_retry_jobs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for workspace isolation
CREATE POLICY "Workspace members can access email jobs" ON email_jobs
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "System can access all workers" ON email_workers
    FOR ALL USING (true);

CREATE POLICY "Workspace members can access job batches" ON email_job_batches
    FOR ALL USING (job_id IN (
        SELECT id FROM email_jobs
        WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    ));

-- Function to get next job for worker
CREATE OR REPLACE FUNCTION get_next_job_for_worker(worker_id_param VARCHAR(100))
RETURNS UUID AS $$
DECLARE
    job_id UUID;
BEGIN
    -- Get the highest priority pending job
    SELECT id INTO job_id
    FROM email_jobs
    WHERE status = 'pending'
    AND (scheduled_at IS NULL OR scheduled_at <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    -- Mark job as processing if found
    IF job_id IS NOT NULL THEN
        UPDATE email_jobs
        SET status = 'processing',
            worker_id = worker_id_param,
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = job_id;
        
        -- Update worker status
        UPDATE email_workers
        SET status = 'busy',
            current_job_id = job_id,
            current_job_count = current_job_count + 1,
            last_job_started = NOW(),
            updated_at = NOW()
        WHERE id = worker_id_param;
    END IF;
    
    RETURN job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete job
CREATE OR REPLACE FUNCTION complete_job(job_id_param UUID, worker_id_param VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
    -- Mark job as completed
    UPDATE email_jobs
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = job_id_param;
    
    -- Update worker status
    UPDATE email_workers
    SET status = 'idle',
        current_job_id = NULL,
        current_job_count = GREATEST(0, current_job_count - 1),
        last_job_completed = NOW(),
        total_jobs_processed = total_jobs_processed + 1,
        updated_at = NOW()
    WHERE id = worker_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to fail job
CREATE OR REPLACE FUNCTION fail_job(job_id_param UUID, worker_id_param VARCHAR(100), error_msg TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    job_retry_count INTEGER;
    job_max_retries INTEGER;
BEGIN
    -- Get current retry count
    SELECT retry_count, max_retries INTO job_retry_count, job_max_retries
    FROM email_jobs
    WHERE id = job_id_param;
    
    -- Check if we should retry
    IF job_retry_count < job_max_retries THEN
        -- Mark for retry
        UPDATE email_jobs
        SET status = 'retrying',
            retry_count = retry_count + 1,
            error_message = error_msg,
            worker_id = NULL,
            updated_at = NOW()
        WHERE id = job_id_param;
    ELSE
        -- Mark as failed
        UPDATE email_jobs
        SET status = 'failed',
            failed_at = NOW(),
            error_message = error_msg,
            worker_id = NULL,
            updated_at = NOW()
        WHERE id = job_id_param;
    END IF;
    
    -- Update worker status
    UPDATE email_workers
    SET status = 'idle',
        current_job_id = NULL,
        current_job_count = GREATEST(0, current_job_count - 1),
        total_errors = total_errors + 1,
        updated_at = NOW()
    WHERE id = worker_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(worker_id_param VARCHAR(100), window_type_param VARCHAR(10))
RETURNS BOOLEAN AS $$
DECLARE
    current_window TIMESTAMP WITH TIME ZONE;
    emails_sent_count INTEGER;
    rate_limit INTEGER;
BEGIN
    -- Calculate current time window
    IF window_type_param = 'minute' THEN
        current_window := date_trunc('minute', NOW());
    ELSE
        current_window := date_trunc('hour', NOW());
    END IF;
    
    -- Get current count for this window
    SELECT COALESCE(emails_sent, 0) INTO emails_sent_count
    FROM worker_rate_limits
    WHERE worker_id = worker_id_param
    AND time_window = current_window
    AND window_type = window_type_param;
    
    -- Get rate limit for worker
    IF window_type_param = 'minute' THEN
        SELECT rate_limit_per_minute INTO rate_limit
        FROM email_workers
        WHERE id = worker_id_param;
    ELSE
        SELECT rate_limit_per_hour INTO rate_limit
        FROM email_workers
        WHERE id = worker_id_param;
    END IF;
    
    -- Check if under limit
    RETURN emails_sent_count < rate_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(worker_id_param VARCHAR(100), window_type_param VARCHAR(10), count_param INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    current_window TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate current time window
    IF window_type_param = 'minute' THEN
        current_window := date_trunc('minute', NOW());
    ELSE
        current_window := date_trunc('hour', NOW());
    END IF;
    
    -- Insert or update rate limit counter
    INSERT INTO worker_rate_limits (worker_id, time_window, window_type, emails_sent)
    VALUES (worker_id_param, current_window, window_type_param, count_param)
    ON CONFLICT (worker_id, time_window, window_type)
    DO UPDATE SET emails_sent = worker_rate_limits.emails_sent + count_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint for rate limits
ALTER TABLE worker_rate_limits ADD CONSTRAINT unique_worker_rate_limit UNIQUE (worker_id, time_window, window_type);