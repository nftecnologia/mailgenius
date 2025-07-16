-- Queue System Migration
-- This migration adds tables for queue management, progress tracking, and batch processing

-- Lead imports tracking table
CREATE TABLE IF NOT EXISTS lead_imports (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_leads INTEGER NOT NULL DEFAULT 0,
    total_batches INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    errors TEXT[]
);

-- Lead import batches tracking table
CREATE TABLE IF NOT EXISTS lead_import_batches (
    id VARCHAR(100) PRIMARY KEY,
    import_id VARCHAR(100) NOT NULL REFERENCES lead_imports(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    total_leads INTEGER NOT NULL DEFAULT 0,
    processed_leads INTEGER NOT NULL DEFAULT 0,
    failed_leads INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    errors TEXT[]
);

-- Campaign sends tracking table
CREATE TABLE IF NOT EXISTS campaign_sends (
    id VARCHAR(100) PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    total_batches INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Campaign send batches tracking table
CREATE TABLE IF NOT EXISTS campaign_send_batches (
    id VARCHAR(100) PRIMARY KEY,
    send_id VARCHAR(100) NOT NULL REFERENCES campaign_sends(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    failures JSONB DEFAULT '[]'::jsonb
);

-- Email sends tracking table (individual email tracking)
CREATE TABLE IF NOT EXISTS email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    recipient_id VARCHAR(100),
    recipient_email VARCHAR(255) NOT NULL,
    email_id VARCHAR(100), -- External email service ID
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Progress tracking table for real-time updates
CREATE TABLE IF NOT EXISTS progress_tracking (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('leads-import', 'email-sending', 'campaign-processing')),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT 'Starting...',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    errors TEXT[]
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_imports_user_id ON lead_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_imports_status ON lead_imports(status);
CREATE INDEX IF NOT EXISTS idx_lead_imports_created_at ON lead_imports(created_at);

CREATE INDEX IF NOT EXISTS idx_lead_import_batches_import_id ON lead_import_batches(import_id);
CREATE INDEX IF NOT EXISTS idx_lead_import_batches_status ON lead_import_batches(status);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_id ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_user_id ON campaign_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_status ON campaign_sends(status);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_created_at ON campaign_sends(created_at);

CREATE INDEX IF NOT EXISTS idx_campaign_send_batches_send_id ON campaign_send_batches(send_id);
CREATE INDEX IF NOT EXISTS idx_campaign_send_batches_status ON campaign_send_batches(status);

CREATE INDEX IF NOT EXISTS idx_email_sends_campaign_id ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_email ON email_sends(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at ON email_sends(sent_at);

CREATE INDEX IF NOT EXISTS idx_progress_tracking_user_id ON progress_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_type ON progress_tracking(type);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_status ON progress_tracking(status);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_start_time ON progress_tracking(start_time);

-- RLS (Row Level Security) policies
ALTER TABLE lead_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_send_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_tracking ENABLE ROW LEVEL SECURITY;

-- Lead imports policies
CREATE POLICY "Users can manage their own lead imports"
    ON lead_imports FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own lead import batches"
    ON lead_import_batches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM lead_imports 
            WHERE id = lead_import_batches.import_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage lead import batches"
    ON lead_import_batches FOR INSERT, UPDATE, DELETE
    USING (true);

-- Campaign sends policies
CREATE POLICY "Users can manage their own campaign sends"
    ON campaign_sends FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own campaign send batches"
    ON campaign_send_batches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM campaign_sends 
            WHERE id = campaign_send_batches.send_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage campaign send batches"
    ON campaign_send_batches FOR INSERT, UPDATE, DELETE
    USING (true);

-- Email sends policies
CREATE POLICY "Users can view their own email sends"
    ON email_sends FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = email_sends.campaign_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage email sends"
    ON email_sends FOR INSERT, UPDATE, DELETE
    USING (true);

-- Progress tracking policies
CREATE POLICY "Users can manage their own progress tracking"
    ON progress_tracking FOR ALL
    USING (auth.uid() = user_id);

-- Functions for progress tracking
CREATE OR REPLACE FUNCTION update_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_progress_tracking_updated_at
    BEFORE UPDATE ON progress_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_progress_updated_at();

-- Function to clean up old progress entries
CREATE OR REPLACE FUNCTION cleanup_old_progress(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM progress_tracking 
    WHERE start_time < NOW() - INTERVAL '1 day' * days_old
    AND status IN ('completed', 'failed', 'cancelled');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats(user_id_param UUID)
RETURNS TABLE(
    total_imports INTEGER,
    active_imports INTEGER,
    completed_imports INTEGER,
    failed_imports INTEGER,
    total_sends INTEGER,
    active_sends INTEGER,
    completed_sends INTEGER,
    failed_sends INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE((SELECT COUNT(*)::INTEGER FROM lead_imports WHERE user_id = user_id_param), 0) as total_imports,
        COALESCE((SELECT COUNT(*)::INTEGER FROM lead_imports WHERE user_id = user_id_param AND status = 'processing'), 0) as active_imports,
        COALESCE((SELECT COUNT(*)::INTEGER FROM lead_imports WHERE user_id = user_id_param AND status = 'completed'), 0) as completed_imports,
        COALESCE((SELECT COUNT(*)::INTEGER FROM lead_imports WHERE user_id = user_id_param AND status = 'failed'), 0) as failed_imports,
        COALESCE((SELECT COUNT(*)::INTEGER FROM campaign_sends WHERE user_id = user_id_param), 0) as total_sends,
        COALESCE((SELECT COUNT(*)::INTEGER FROM campaign_sends WHERE user_id = user_id_param AND status = 'processing'), 0) as active_sends,
        COALESCE((SELECT COUNT(*)::INTEGER FROM campaign_sends WHERE user_id = user_id_param AND status = 'completed'), 0) as completed_sends,
        COALESCE((SELECT COUNT(*)::INTEGER FROM campaign_sends WHERE user_id = user_id_param AND status = 'failed'), 0) as failed_sends;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Service role permissions for queue processing
GRANT ALL ON lead_imports TO service_role;
GRANT ALL ON lead_import_batches TO service_role;
GRANT ALL ON campaign_sends TO service_role;
GRANT ALL ON campaign_send_batches TO service_role;
GRANT ALL ON email_sends TO service_role;
GRANT ALL ON progress_tracking TO service_role;

-- Create scheduled job to cleanup old progress entries (if pg_cron is available)
-- This would typically be set up by the DBA or in a separate maintenance script
-- SELECT cron.schedule('cleanup-old-progress', '0 2 * * *', 'SELECT cleanup_old_progress(7);');