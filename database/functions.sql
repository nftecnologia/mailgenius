-- Database functions for EmailSend SaaS

-- Function to increment campaign delivered count
CREATE OR REPLACE FUNCTION increment_campaign_delivered(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET delivered = delivered + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment campaign opened count
CREATE OR REPLACE FUNCTION increment_campaign_opened(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET opened = opened + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment campaign clicked count
CREATE OR REPLACE FUNCTION increment_campaign_clicked(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET clicked = clicked + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment campaign bounced count
CREATE OR REPLACE FUNCTION increment_campaign_bounced(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET bounced = bounced + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment campaign unsubscribed count
CREATE OR REPLACE FUNCTION increment_campaign_unsubscribed(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET unsubscribed = unsubscribed + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment campaign complained count
CREATE OR REPLACE FUNCTION increment_campaign_complained(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET complained = complained + 1
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get campaign statistics
CREATE OR REPLACE FUNCTION get_campaign_stats(workspace_id UUID)
RETURNS TABLE(
    total_campaigns BIGINT,
    active_campaigns BIGINT,
    total_emails_sent BIGINT,
    total_delivered BIGINT,
    total_opened BIGINT,
    total_clicked BIGINT,
    delivery_rate NUMERIC,
    open_rate NUMERIC,
    click_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_campaigns,
        COUNT(*) FILTER (WHERE status IN ('scheduled', 'sending')) as active_campaigns,
        COALESCE(SUM(total_recipients), 0) as total_emails_sent,
        COALESCE(SUM(delivered), 0) as total_delivered,
        COALESCE(SUM(opened), 0) as total_opened,
        COALESCE(SUM(clicked), 0) as total_clicked,
        CASE
            WHEN COALESCE(SUM(total_recipients), 0) = 0 THEN 0
            ELSE ROUND((COALESCE(SUM(delivered), 0) * 100.0) / COALESCE(SUM(total_recipients), 1), 2)
        END as delivery_rate,
        CASE
            WHEN COALESCE(SUM(delivered), 0) = 0 THEN 0
            ELSE ROUND((COALESCE(SUM(opened), 0) * 100.0) / COALESCE(SUM(delivered), 1), 2)
        END as open_rate,
        CASE
            WHEN COALESCE(SUM(opened), 0) = 0 THEN 0
            ELSE ROUND((COALESCE(SUM(clicked), 0) * 100.0) / COALESCE(SUM(opened), 1), 2)
        END as click_rate
    FROM campaigns
    WHERE campaigns.workspace_id = get_campaign_stats.workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get lead statistics
CREATE OR REPLACE FUNCTION get_leads_stats(workspace_id UUID)
RETURNS TABLE(
    total_leads BIGINT,
    active_leads BIGINT,
    unsubscribed_leads BIGINT,
    bounced_leads BIGINT,
    complained_leads BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'active') as active_leads,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed_leads,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced_leads,
        COUNT(*) FILTER (WHERE status = 'complained') as complained_leads
    FROM leads
    WHERE leads.workspace_id = get_leads_stats.workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create workspace with default settings
CREATE OR REPLACE FUNCTION create_workspace_with_user(
    user_id UUID,
    workspace_name TEXT,
    user_email TEXT,
    user_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    workspace_id UUID;
    workspace_slug TEXT;
BEGIN
    -- Generate unique slug
    workspace_slug := LOWER(REGEXP_REPLACE(workspace_name, '[^a-zA-Z0-9]', '-', 'g'));
    workspace_slug := workspace_slug || '-' || SUBSTR(gen_random_uuid()::text, 1, 6);

    -- Create workspace
    INSERT INTO workspaces (name, slug, plan, settings)
    VALUES (workspace_name, workspace_slug, 'free', '{"email_limit": 1000, "leads_limit": 5000}')
    RETURNING id INTO workspace_id;

    -- Create or update user
    INSERT INTO users (id, email, name)
    VALUES (user_id, user_email, user_name)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, users.name),
        updated_at = NOW();

    -- Add user as admin of workspace
    INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
    VALUES (workspace_id, user_id, 'admin', 'active', NOW());

    RETURN workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Function to apply lead segment conditions
CREATE OR REPLACE FUNCTION apply_lead_segment(
    workspace_id UUID,
    segment_conditions JSONB
)
RETURNS TABLE(lead_id UUID) AS $$
DECLARE
    condition JSONB;
    sql_query TEXT := 'SELECT id FROM leads WHERE workspace_id = $1 AND status = ''active''';
    params TEXT[] := ARRAY[workspace_id::TEXT];
    param_count INTEGER := 1;
BEGIN
    -- Basic implementation for common segment conditions
    -- In a full implementation, you'd parse the JSON conditions more thoroughly

    FOR condition IN SELECT * FROM jsonb_array_elements(segment_conditions->'conditions')
    LOOP
        IF condition->>'field' = 'tags' AND condition->>'operator' = 'contains' THEN
            param_count := param_count + 1;
            sql_query := sql_query || ' AND $' || param_count || ' = ANY(tags)';
            params := array_append(params, condition->>'value');
        ELSIF condition->>'field' = 'company' AND condition->>'operator' = 'equals' THEN
            param_count := param_count + 1;
            sql_query := sql_query || ' AND company = $' || param_count;
            params := array_append(params, condition->>'value');
        ELSIF condition->>'field' = 'source' AND condition->>'operator' = 'equals' THEN
            param_count := param_count + 1;
            sql_query := sql_query || ' AND source = $' || param_count;
            params := array_append(params, condition->>'value');
        END IF;
    END LOOP;

    -- Execute dynamic query (simplified for this example)
    -- In production, you'd use a more robust query builder
    RETURN QUERY EXECUTE sql_query USING workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Function to handle email unsubscribe
CREATE OR REPLACE FUNCTION handle_email_unsubscribe(
    email_address TEXT,
    workspace_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Update lead status
    UPDATE leads
    SET status = 'unsubscribed', updated_at = NOW()
    WHERE email = email_address
    AND (workspace_id IS NULL OR leads.workspace_id = handle_email_unsubscribe.workspace_id);

    -- Log the unsubscribe activity
    INSERT INTO lead_activities (lead_id, activity_type, activity_data)
    SELECT id, 'unsubscribed', json_build_object('unsubscribed_at', NOW())
    FROM leads
    WHERE email = email_address
    AND (workspace_id IS NULL OR leads.workspace_id = handle_email_unsubscribe.workspace_id);
END;
$$ LANGUAGE plpgsql;
