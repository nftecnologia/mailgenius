-- Migration 004: Webhooks, API Keys, and Integrations
-- API management, webhook system, third-party integrations, and custom fields
-- Tables: api_keys, webhooks, webhook_deliveries, integrations, custom_fields, form_submissions, api_requests

-- Create custom types for API and webhook system
CREATE TYPE api_key_status AS ENUM ('active', 'revoked', 'expired');
CREATE TYPE webhook_event AS ENUM ('lead.created', 'lead.updated', 'lead.deleted', 'campaign.sent', 'campaign.delivered', 'campaign.opened', 'campaign.clicked', 'campaign.bounced', 'campaign.unsubscribed', 'automation.started', 'automation.completed', 'sequence.subscribed', 'sequence.unsubscribed', 'form.submitted');
CREATE TYPE webhook_status AS ENUM ('active', 'inactive', 'failed');
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'failed', 'retrying');
CREATE TYPE integration_type AS ENUM ('zapier', 'webhooks', 'api', 'crm', 'analytics', 'email_service');
CREATE TYPE integration_status AS ENUM ('active', 'inactive', 'error', 'pending');
CREATE TYPE field_type AS ENUM ('text', 'number', 'email', 'phone', 'url', 'date', 'boolean', 'select', 'multiselect', 'textarea', 'json');

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(20) NOT NULL,
    permissions TEXT[] DEFAULT '{}',

    -- Usage tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    rate_limit INTEGER DEFAULT 1000, -- requests per hour
    rate_limit_window INTEGER DEFAULT 3600, -- seconds

    -- Status and expiration
    status api_key_status DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create api_requests table for rate limiting and analytics
CREATE TABLE IF NOT EXISTS api_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Request details
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    ip_address INET,
    user_agent TEXT,

    -- Response details
    status_code INTEGER,
    response_time_ms INTEGER,

    -- Request metadata
    request_headers JSONB DEFAULT '{}',
    request_body_size INTEGER DEFAULT 0,
    response_body_size INTEGER DEFAULT 0,

    -- Error tracking
    error_message TEXT,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events webhook_event[] NOT NULL,

    -- Authentication
    secret VARCHAR(255),
    headers JSONB DEFAULT '{}',

    -- Configuration
    status webhook_status DEFAULT 'active',
    timeout_seconds INTEGER DEFAULT 30,
    retry_attempts INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,

    -- Filtering
    conditions JSONB DEFAULT '{}',

    -- Statistics
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    last_delivery_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webhook_deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type webhook_event NOT NULL,

    -- Delivery details
    status delivery_status DEFAULT 'pending',
    url TEXT NOT NULL,
    http_method VARCHAR(10) DEFAULT 'POST',

    -- Request data
    headers JSONB DEFAULT '{}',
    payload JSONB NOT NULL,

    -- Response data
    response_status INTEGER,
    response_headers JSONB DEFAULT '{}',
    response_body TEXT,
    response_time_ms INTEGER,

    -- Retry tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,

    -- Error details
    error_message TEXT,

    -- Related entities
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,

    -- Timestamps
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type integration_type NOT NULL,
    provider VARCHAR(100) NOT NULL,

    -- Configuration
    config JSONB DEFAULT '{}',
    credentials JSONB DEFAULT '{}', -- encrypted
    settings JSONB DEFAULT '{}',

    -- Status
    status integration_status DEFAULT 'pending',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,

    -- Mapping
    field_mappings JSONB DEFAULT '{}',
    sync_direction VARCHAR(20) DEFAULT 'bidirectional', -- incoming, outgoing, bidirectional

    -- Statistics
    records_synced INTEGER DEFAULT 0,
    last_sync_count INTEGER DEFAULT 0,
    sync_failures INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create custom_fields table
CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    field_type field_type NOT NULL,

    -- Configuration
    is_required BOOLEAN DEFAULT FALSE,
    is_unique BOOLEAN DEFAULT FALSE,
    default_value TEXT,
    validation_rules JSONB DEFAULT '{}',

    -- Options for select fields
    options TEXT[] DEFAULT '{}',

    -- Display
    placeholder TEXT,
    help_text TEXT,
    display_order INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(workspace_id, name)
);

-- Create form_submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Submission data
    form_data JSONB NOT NULL,
    raw_data JSONB DEFAULT '{}',

    -- Source tracking
    source_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,

    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    duplicate_of UUID REFERENCES form_submissions(id),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create webhook_events table for event tracking
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    event_type webhook_event NOT NULL,

    -- Event data
    entity_type VARCHAR(50), -- lead, campaign, automation, etc.
    entity_id UUID,
    event_data JSONB DEFAULT '{}',

    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    webhook_count INTEGER DEFAULT 0,

    -- Related entities
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used_at);

CREATE INDEX IF NOT EXISTS idx_api_requests_api_key_id ON api_requests(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_workspace_id ON api_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON api_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_api_requests_endpoint ON api_requests(endpoint);

CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN(events);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);

CREATE INDEX IF NOT EXISTS idx_integrations_workspace_id ON integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

CREATE INDEX IF NOT EXISTS idx_custom_fields_workspace_id ON custom_fields(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_name ON custom_fields(workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_custom_fields_type ON custom_fields(field_type);

CREATE INDEX IF NOT EXISTS idx_form_submissions_workspace_id ON form_submissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_processed ON form_submissions(processed);
CREATE INDEX IF NOT EXISTS idx_form_submissions_lead_id ON form_submissions(lead_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_workspace_id ON webhook_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_entity ON webhook_events(entity_type, entity_id);

-- Create triggers for updated_at
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_fields_updated_at BEFORE UPDATE ON custom_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update webhook statistics
CREATE OR REPLACE FUNCTION update_webhook_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE webhooks
        SET
            total_deliveries = (
                SELECT COUNT(*) FROM webhook_deliveries
                WHERE webhook_id = NEW.webhook_id
            ),
            successful_deliveries = (
                SELECT COUNT(*) FROM webhook_deliveries
                WHERE webhook_id = NEW.webhook_id AND status = 'delivered'
            ),
            failed_deliveries = (
                SELECT COUNT(*) FROM webhook_deliveries
                WHERE webhook_id = NEW.webhook_id AND status = 'failed'
            ),
            last_delivery_at = (
                SELECT MAX(delivered_at) FROM webhook_deliveries
                WHERE webhook_id = NEW.webhook_id AND delivered_at IS NOT NULL
            ),
            last_success_at = (
                SELECT MAX(delivered_at) FROM webhook_deliveries
                WHERE webhook_id = NEW.webhook_id AND status = 'delivered'
            ),
            last_failure_at = (
                SELECT MAX(delivered_at) FROM webhook_deliveries
                WHERE webhook_id = NEW.webhook_id AND status = 'failed'
            ),
            updated_at = NOW()
        WHERE id = NEW.webhook_id;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update webhook stats
CREATE TRIGGER update_webhook_stats_trigger
    AFTER INSERT OR UPDATE ON webhook_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_stats();

-- Function to clean old API requests (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_api_requests()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_requests
    WHERE created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to encrypt sensitive data (placeholder - implement proper encryption)
CREATE OR REPLACE FUNCTION encrypt_credentials(data JSONB)
RETURNS JSONB AS $$
BEGIN
    -- This is a placeholder. In production, implement proper encryption
    -- using pgcrypto or application-level encryption
    RETURN data;
END;
$$ LANGUAGE plpgsql;

-- Function to generate webhook signature
CREATE OR REPLACE FUNCTION generate_webhook_signature(
    payload TEXT,
    secret TEXT,
    algorithm TEXT DEFAULT 'sha256'
)
RETURNS TEXT AS $$
BEGIN
    -- Generate HMAC signature for webhook authentication
    RETURN encode(
        hmac(payload::bytea, secret::bytea, algorithm),
        'hex'
    );
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys
CREATE POLICY "Users can view api_keys in their workspace" ON api_keys
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Admins can manage api_keys in their workspace" ON api_keys
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
    );

-- RLS Policies for api_requests
CREATE POLICY "Users can view api_requests in their workspace" ON api_requests
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "System can insert api_requests" ON api_requests
    FOR INSERT WITH CHECK (true);

-- RLS Policies for webhooks
CREATE POLICY "Users can view webhooks in their workspace" ON webhooks
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can manage webhooks in their workspace" ON webhooks
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- RLS Policies for webhook_deliveries
CREATE POLICY "Users can view webhook deliveries in their workspace" ON webhook_deliveries
    FOR SELECT USING (
        webhook_id IN (
            SELECT id FROM webhooks WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY "System can manage webhook deliveries" ON webhook_deliveries
    FOR ALL WITH CHECK (true);

-- RLS Policies for integrations
CREATE POLICY "Users can view integrations in their workspace" ON integrations
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Admins can manage integrations in their workspace" ON integrations
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
    );

-- RLS Policies for custom_fields
CREATE POLICY "Users can view custom fields in their workspace" ON custom_fields
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Admins can manage custom fields in their workspace" ON custom_fields
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
        )
    );

-- RLS Policies for form_submissions
CREATE POLICY "Users can view form submissions in their workspace" ON form_submissions
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Public can submit forms" ON form_submissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update form submissions in their workspace" ON form_submissions
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- RLS Policies for webhook_events
CREATE POLICY "Users can view webhook events in their workspace" ON webhook_events
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "System can manage webhook events" ON webhook_events
    FOR ALL WITH CHECK (true);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant specific permissions for public form submissions
GRANT INSERT ON form_submissions TO anon;
