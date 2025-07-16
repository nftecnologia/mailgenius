-- Scalable Upload System Migration
-- Handles large file uploads with streaming, chunking, and async processing

-- File Upload Jobs table
CREATE TABLE file_upload_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- File Information
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash for deduplication
    
    -- Upload Configuration
    chunk_size INTEGER DEFAULT 1048576, -- 1MB chunks
    total_chunks INTEGER NOT NULL,
    upload_type VARCHAR(50) DEFAULT 'leads_import', -- leads_import, template_assets, etc
    
    -- Processing Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, uploading, processing, completed, failed, cancelled
    upload_progress INTEGER DEFAULT 0, -- 0-100%
    processing_progress INTEGER DEFAULT 0, -- 0-100%
    
    -- Storage Information
    storage_path VARCHAR(500),
    temp_storage_path VARCHAR(500),
    
    -- Processing Results
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    valid_records INTEGER DEFAULT 0,
    invalid_records INTEGER DEFAULT 0,
    
    -- Error Handling
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    validation_rules JSONB DEFAULT '{}',
    processing_config JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- File Upload Chunks table
CREATE TABLE file_upload_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_job_id UUID REFERENCES file_upload_jobs(id) ON DELETE CASCADE,
    
    -- Chunk Information
    chunk_index INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    chunk_hash VARCHAR(64), -- SHA-256 hash of chunk
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, uploading, uploaded, failed
    upload_progress INTEGER DEFAULT 0, -- 0-100%
    
    -- Storage
    storage_path VARCHAR(500),
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(upload_job_id, chunk_index)
);

-- Processing Batches table for chunk processing
CREATE TABLE processing_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_job_id UUID REFERENCES file_upload_jobs(id) ON DELETE CASCADE,
    
    -- Batch Information
    batch_index INTEGER NOT NULL,
    start_record INTEGER NOT NULL,
    end_record INTEGER NOT NULL,
    batch_size INTEGER NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    processing_progress INTEGER DEFAULT 0,
    
    -- Results
    total_records INTEGER DEFAULT 0,
    valid_records INTEGER DEFAULT 0,
    invalid_records INTEGER DEFAULT 0,
    
    -- Processing Data
    processed_data JSONB DEFAULT '{}',
    validation_errors JSONB DEFAULT '{}',
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(upload_job_id, batch_index)
);

-- File Upload Progress tracking
CREATE TABLE upload_progress_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_job_id UUID REFERENCES file_upload_jobs(id) ON DELETE CASCADE,
    
    -- Event Information
    event_type VARCHAR(100) NOT NULL, -- chunk_uploaded, validation_started, batch_processed, etc
    event_data JSONB DEFAULT '{}',
    
    -- Progress
    current_progress INTEGER DEFAULT 0,
    total_progress INTEGER DEFAULT 100,
    
    -- Message
    message TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Temporary data storage for validation
CREATE TABLE temp_validation_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_job_id UUID REFERENCES file_upload_jobs(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES processing_batches(id) ON DELETE CASCADE,
    
    -- Record Information
    record_index INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    
    -- Validation Results
    is_valid BOOLEAN DEFAULT FALSE,
    validation_errors JSONB DEFAULT '{}',
    processed_data JSONB DEFAULT '{}',
    
    -- Lead Information (for leads import)
    email CITEXT,
    name VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    position VARCHAR(255),
    custom_fields JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, validated, processed, failed
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_file_upload_jobs_workspace ON file_upload_jobs(workspace_id);
CREATE INDEX idx_file_upload_jobs_user ON file_upload_jobs(user_id);
CREATE INDEX idx_file_upload_jobs_status ON file_upload_jobs(status);
CREATE INDEX idx_file_upload_jobs_created_at ON file_upload_jobs(created_at);
CREATE INDEX idx_file_upload_jobs_expires_at ON file_upload_jobs(expires_at);

CREATE INDEX idx_file_upload_chunks_job ON file_upload_chunks(upload_job_id);
CREATE INDEX idx_file_upload_chunks_status ON file_upload_chunks(status);
CREATE INDEX idx_file_upload_chunks_chunk_index ON file_upload_chunks(upload_job_id, chunk_index);

CREATE INDEX idx_processing_batches_job ON processing_batches(upload_job_id);
CREATE INDEX idx_processing_batches_status ON processing_batches(status);
CREATE INDEX idx_processing_batches_batch_index ON processing_batches(upload_job_id, batch_index);

CREATE INDEX idx_upload_progress_events_job ON upload_progress_events(upload_job_id);
CREATE INDEX idx_upload_progress_events_created_at ON upload_progress_events(created_at);

CREATE INDEX idx_temp_validation_data_job ON temp_validation_data(upload_job_id);
CREATE INDEX idx_temp_validation_data_batch ON temp_validation_data(batch_id);
CREATE INDEX idx_temp_validation_data_email ON temp_validation_data(email);
CREATE INDEX idx_temp_validation_data_status ON temp_validation_data(status);

-- Enable RLS
ALTER TABLE file_upload_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_upload_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_progress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_validation_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can access upload jobs from their workspaces" ON file_upload_jobs
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can access upload chunks from their workspaces" ON file_upload_chunks
    FOR ALL USING (upload_job_id IN (
        SELECT id FROM file_upload_jobs
        WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can access processing batches from their workspaces" ON processing_batches
    FOR ALL USING (upload_job_id IN (
        SELECT id FROM file_upload_jobs
        WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can access progress events from their workspaces" ON upload_progress_events
    FOR ALL USING (upload_job_id IN (
        SELECT id FROM file_upload_jobs
        WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can access temp validation data from their workspaces" ON temp_validation_data
    FOR ALL USING (upload_job_id IN (
        SELECT id FROM file_upload_jobs
        WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    ));

-- Apply updated_at trigger
CREATE TRIGGER update_file_upload_jobs_updated_at 
    BEFORE UPDATE ON file_upload_jobs 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_file_upload_chunks_updated_at 
    BEFORE UPDATE ON file_upload_chunks 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_processing_batches_updated_at 
    BEFORE UPDATE ON processing_batches 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Functions for upload management
CREATE OR REPLACE FUNCTION get_upload_job_progress(job_id UUID)
RETURNS JSONB AS $$
DECLARE
    job_data JSONB;
    upload_progress INTEGER;
    processing_progress INTEGER;
    total_chunks INTEGER;
    uploaded_chunks INTEGER;
BEGIN
    -- Get job basic info
    SELECT to_jsonb(j) INTO job_data
    FROM file_upload_jobs j
    WHERE id = job_id;
    
    IF job_data IS NULL THEN
        RETURN '{"error": "Job not found"}'::JSONB;
    END IF;
    
    -- Calculate upload progress
    SELECT 
        COUNT(*) FILTER (WHERE status = 'uploaded'),
        COUNT(*)
    INTO uploaded_chunks, total_chunks
    FROM file_upload_chunks
    WHERE upload_job_id = job_id;
    
    upload_progress := CASE 
        WHEN total_chunks = 0 THEN 0
        ELSE (uploaded_chunks * 100) / total_chunks
    END;
    
    -- Get processing progress
    SELECT COALESCE(processing_progress, 0) INTO processing_progress
    FROM file_upload_jobs
    WHERE id = job_id;
    
    -- Combine data
    RETURN job_data || jsonb_build_object(
        'upload_progress', upload_progress,
        'processing_progress', processing_progress,
        'total_chunks', total_chunks,
        'uploaded_chunks', uploaded_chunks
    );
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired uploads
CREATE OR REPLACE FUNCTION cleanup_expired_uploads()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired upload jobs and related data
    WITH deleted_jobs AS (
        DELETE FROM file_upload_jobs
        WHERE expires_at < NOW() 
        AND status NOT IN ('completed', 'processing')
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted_jobs;
    
    -- Clean up orphaned temp validation data
    DELETE FROM temp_validation_data
    WHERE upload_job_id NOT IN (SELECT id FROM file_upload_jobs);
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get processing statistics
CREATE OR REPLACE FUNCTION get_processing_stats(job_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_batches', COUNT(*),
        'completed_batches', COUNT(*) FILTER (WHERE status = 'completed'),
        'failed_batches', COUNT(*) FILTER (WHERE status = 'failed'),
        'pending_batches', COUNT(*) FILTER (WHERE status = 'pending'),
        'processing_batches', COUNT(*) FILTER (WHERE status = 'processing'),
        'total_records', COALESCE(SUM(total_records), 0),
        'valid_records', COALESCE(SUM(valid_records), 0),
        'invalid_records', COALESCE(SUM(invalid_records), 0)
    ) INTO stats
    FROM processing_batches
    WHERE upload_job_id = job_id;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;