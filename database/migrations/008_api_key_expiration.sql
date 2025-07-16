-- Migration: Add expiration system to API keys
-- Adds fields for expiration tracking, renewal, and audit logging

-- Add expiration and renewal fields to api_keys table
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS renewal_period_days INTEGER DEFAULT 90;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES users(id);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

-- Add index for expiration queries
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_status ON api_keys(workspace_id, status);

-- Create API key audit log table
CREATE TABLE IF NOT EXISTS api_key_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- created, used, expired, renewed, revoked, expiring_soon
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_api_key_audit_logs_workspace ON api_key_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_logs_api_key ON api_key_audit_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_logs_action ON api_key_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_logs_created_at ON api_key_audit_logs(created_at);

-- Create notifications table for expiration alerts
CREATE TABLE IF NOT EXISTS api_key_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- expiring_soon, expired, renewed, revoked
    notification_data JSONB DEFAULT '{}',
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_api_key_notifications_workspace ON api_key_notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_key_notifications_api_key ON api_key_notifications(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_notifications_status ON api_key_notifications(status);
CREATE INDEX IF NOT EXISTS idx_api_key_notifications_type ON api_key_notifications(notification_type);

-- Enable RLS on new tables
ALTER TABLE api_key_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_key_audit_logs
CREATE POLICY "Users can view audit logs for their workspace" ON api_key_audit_logs
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
    ));

-- RLS policies for api_key_notifications
CREATE POLICY "Users can view notifications for their workspace" ON api_key_notifications
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
    ));

-- Function to automatically expire API keys
CREATE OR REPLACE FUNCTION expire_api_keys()
RETURNS void AS $$
BEGIN
    -- Update expired keys
    UPDATE api_keys 
    SET 
        status = 'expired',
        updated_at = NOW()
    WHERE 
        expires_at < NOW() 
        AND status = 'active';
        
    -- Log expiration events
    INSERT INTO api_key_audit_logs (workspace_id, api_key_id, action, metadata)
    SELECT 
        workspace_id,
        id,
        'expired',
        jsonb_build_object('expired_at', NOW())
    FROM api_keys
    WHERE status = 'expired' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to renew API keys automatically
CREATE OR REPLACE FUNCTION auto_renew_api_keys()
RETURNS void AS $$
BEGIN
    -- Renew keys that are set for auto-renewal and are about to expire
    UPDATE api_keys 
    SET 
        expires_at = NOW() + INTERVAL '1 day' * renewal_period_days,
        updated_at = NOW()
    WHERE 
        auto_renew = true 
        AND status = 'active'
        AND expires_at < NOW() + INTERVAL '7 days';
        
    -- Log renewal events
    INSERT INTO api_key_audit_logs (workspace_id, api_key_id, action, metadata)
    SELECT 
        workspace_id,
        id,
        'renewed',
        jsonb_build_object('renewed_at', NOW(), 'new_expiry', expires_at)
    FROM api_keys
    WHERE auto_renew = true AND status = 'active' AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to create expiration notifications
CREATE OR REPLACE FUNCTION create_expiration_notifications()
RETURNS void AS $$
BEGIN
    -- Create notifications for keys expiring within 7 days
    INSERT INTO api_key_notifications (workspace_id, api_key_id, notification_type, notification_data)
    SELECT 
        ak.workspace_id,
        ak.id,
        'expiring_soon',
        jsonb_build_object(
            'expires_at', ak.expires_at,
            'days_until_expiry', EXTRACT(DAYS FROM (ak.expires_at - NOW())),
            'key_name', ak.name
        )
    FROM api_keys ak
    WHERE 
        ak.status = 'active'
        AND ak.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        AND NOT EXISTS (
            SELECT 1 FROM api_key_notifications n 
            WHERE n.api_key_id = ak.id 
            AND n.notification_type = 'expiring_soon'
            AND n.created_at > NOW() - INTERVAL '24 hours'
        );
        
    -- Create notifications for expired keys
    INSERT INTO api_key_notifications (workspace_id, api_key_id, notification_type, notification_data)
    SELECT 
        ak.workspace_id,
        ak.id,
        'expired',
        jsonb_build_object(
            'expired_at', ak.expires_at,
            'key_name', ak.name
        )
    FROM api_keys ak
    WHERE 
        ak.status = 'expired'
        AND NOT EXISTS (
            SELECT 1 FROM api_key_notifications n 
            WHERE n.api_key_id = ak.id 
            AND n.notification_type = 'expired'
            AND n.created_at > NOW() - INTERVAL '24 hours'
        );
END;
$$ LANGUAGE plpgsql;

-- Function to log API key usage
CREATE OR REPLACE FUNCTION log_api_key_usage(
    p_api_key_id UUID,
    p_workspace_id UUID,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_endpoint TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO api_key_audit_logs (
        workspace_id,
        api_key_id,
        action,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        p_workspace_id,
        p_api_key_id,
        'used',
        p_ip_address,
        p_user_agent,
        jsonb_build_object('endpoint', p_endpoint, 'timestamp', NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Update existing API keys to have default expiration (90 days from now)
UPDATE api_keys 
SET 
    expires_at = NOW() + INTERVAL '90 days',
    renewal_period_days = 90,
    status = 'active'
WHERE expires_at IS NULL;

-- Create a view for API key management
CREATE OR REPLACE VIEW api_key_management AS
SELECT 
    ak.id,
    ak.workspace_id,
    ak.name,
    ak.permissions,
    ak.status,
    ak.expires_at,
    ak.auto_renew,
    ak.renewal_period_days,
    ak.last_used_at,
    ak.created_at,
    ak.revoked_at,
    ak.revoked_by,
    ak.revoked_reason,
    CASE 
        WHEN ak.expires_at < NOW() THEN 'expired'
        WHEN ak.expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
        WHEN ak.expires_at < NOW() + INTERVAL '30 days' THEN 'expiring_later'
        ELSE 'active'
    END as expiration_status,
    EXTRACT(DAYS FROM (ak.expires_at - NOW())) as days_until_expiry,
    (
        SELECT COUNT(*)
        FROM api_key_audit_logs al
        WHERE al.api_key_id = ak.id
        AND al.action = 'used'
        AND al.created_at > NOW() - INTERVAL '30 days'
    ) as usage_count_30_days,
    (
        SELECT MAX(al.created_at)
        FROM api_key_audit_logs al
        WHERE al.api_key_id = ak.id
        AND al.action = 'used'
    ) as last_audit_usage
FROM api_keys ak
WHERE ak.status IN ('active', 'expired');

-- Comments for documentation
COMMENT ON TABLE api_key_audit_logs IS 'Audit trail for API key operations and usage';
COMMENT ON TABLE api_key_notifications IS 'Notifications for API key expiration and renewal events';
COMMENT ON COLUMN api_keys.expires_at IS 'When the API key expires';
COMMENT ON COLUMN api_keys.auto_renew IS 'Whether the key should be automatically renewed';
COMMENT ON COLUMN api_keys.renewal_period_days IS 'How many days to extend the key when renewing';
COMMENT ON COLUMN api_keys.status IS 'Current status: active, expired, revoked';
COMMENT ON COLUMN api_keys.revoked_at IS 'When the key was revoked';
COMMENT ON COLUMN api_keys.revoked_by IS 'Who revoked the key';
COMMENT ON COLUMN api_keys.revoked_reason IS 'Why the key was revoked';