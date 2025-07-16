-- Database functions for EmailSend SaaS - Optimized for 2MM+ Contacts
-- Enhanced with batch operations, connection pooling, and performance optimizations

-- ============================================
-- OPTIMIZED CAMPAIGN METRIC FUNCTIONS
-- ============================================

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

-- ============================================
-- BULK OPERATIONS FOR HIGH-VOLUME PROCESSING
-- ============================================

-- Batch update campaign metrics for better performance
CREATE OR REPLACE FUNCTION batch_update_campaign_metrics(
    p_campaign_id UUID,
    p_delivered_count INTEGER DEFAULT 0,
    p_opened_count INTEGER DEFAULT 0,
    p_clicked_count INTEGER DEFAULT 0,
    p_bounced_count INTEGER DEFAULT 0,
    p_unsubscribed_count INTEGER DEFAULT 0,
    p_complained_count INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
    UPDATE campaigns
    SET 
        delivered = delivered + p_delivered_count,
        opened = opened + p_opened_count,
        clicked = clicked + p_clicked_count,
        bounced = bounced + p_bounced_count,
        unsubscribed = unsubscribed + p_unsubscribed_count,
        complained = complained + p_complained_count,
        updated_at = NOW()
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Fast bulk lead import with validation
CREATE OR REPLACE FUNCTION fast_bulk_lead_import(
    p_workspace_id UUID,
    p_leads_json JSONB
)
RETURNS TABLE(
    imported_count INTEGER,
    updated_count INTEGER,
    error_count INTEGER,
    errors JSONB
) AS $$
DECLARE
    v_imported_count INTEGER := 0;
    v_updated_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_errors JSONB := '[]'::JSONB;
    v_lead JSONB;
    v_error_msg TEXT;
BEGIN
    -- Create temporary table for batch processing
    CREATE TEMP TABLE temp_lead_import (
        email CITEXT NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        company VARCHAR(255),
        position VARCHAR(255),
        source VARCHAR(100) DEFAULT 'bulk_import',
        tags TEXT[] DEFAULT '{}',
        custom_fields JSONB DEFAULT '{}'
    ) ON COMMIT DROP;

    -- Insert all leads into temp table first
    FOR v_lead IN SELECT * FROM jsonb_array_elements(p_leads_json)
    LOOP
        BEGIN
            INSERT INTO temp_lead_import (
                email, name, phone, company, position, source, tags, custom_fields
            ) VALUES (
                v_lead->>'email',
                v_lead->>'name',
                v_lead->>'phone',
                v_lead->>'company',
                v_lead->>'position',
                COALESCE(v_lead->>'source', 'bulk_import'),
                CASE 
                    WHEN v_lead->'tags' IS NOT NULL THEN
                        ARRAY(SELECT jsonb_array_elements_text(v_lead->'tags'))
                    ELSE '{}'::TEXT[]
                END,
                COALESCE(v_lead->'custom_fields', '{}'::JSONB)
            );
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                v_errors := v_errors || jsonb_build_object(
                    'email', v_lead->>'email',
                    'error', SQLERRM
                );
        END;
    END LOOP;

    -- Bulk insert/update using single query
    WITH upsert_results AS (
        INSERT INTO leads (
            workspace_id, email, name, phone, company, position, source, tags, custom_fields
        )
        SELECT 
            p_workspace_id, email, name, phone, company, position, source, tags, custom_fields
        FROM temp_lead_import
        ON CONFLICT (workspace_id, email) 
        DO UPDATE SET
            name = COALESCE(EXCLUDED.name, leads.name),
            phone = COALESCE(EXCLUDED.phone, leads.phone),
            company = COALESCE(EXCLUDED.company, leads.company),
            position = COALESCE(EXCLUDED.position, leads.position),
            tags = CASE 
                WHEN EXCLUDED.tags IS NOT NULL AND array_length(EXCLUDED.tags, 1) > 0 
                THEN EXCLUDED.tags 
                ELSE leads.tags 
            END,
            custom_fields = leads.custom_fields || EXCLUDED.custom_fields,
            updated_at = NOW()
        RETURNING 
            CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END as operation
    )
    SELECT 
        COUNT(*) FILTER (WHERE operation = 'inserted'),
        COUNT(*) FILTER (WHERE operation = 'updated')
    INTO v_imported_count, v_updated_count
    FROM upsert_results;

    RETURN QUERY SELECT v_imported_count, v_updated_count, v_error_count, v_errors;
END;
$$ LANGUAGE plpgsql;

-- High-performance lead search with pagination
CREATE OR REPLACE FUNCTION search_leads_optimized(
    p_workspace_id UUID,
    p_search_term TEXT DEFAULT '',
    p_status_filter TEXT DEFAULT 'active',
    p_source_filter TEXT DEFAULT '',
    p_tags_filter TEXT[] DEFAULT '{}',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    lead_id UUID,
    email CITEXT,
    name VARCHAR(255),
    company VARCHAR(255),
    status VARCHAR(50),
    source VARCHAR(100),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE,
    total_count BIGINT
) AS $$
DECLARE
    v_where_conditions TEXT[] := ARRAY['workspace_id = $1'];
    v_params TEXT[] := ARRAY[p_workspace_id::TEXT];
    v_param_count INTEGER := 1;
    v_query TEXT;
    v_count_query TEXT;
    v_total_count BIGINT;
BEGIN
    -- Build dynamic WHERE conditions
    IF p_search_term IS NOT NULL AND p_search_term != '' THEN
        v_param_count := v_param_count + 1;
        v_where_conditions := array_append(v_where_conditions, 
            '(email ILIKE $' || v_param_count || ' OR name ILIKE $' || v_param_count || ' OR company ILIKE $' || v_param_count || ')');
        v_params := array_append(v_params, '%' || p_search_term || '%');
    END IF;

    IF p_status_filter IS NOT NULL AND p_status_filter != '' THEN
        v_param_count := v_param_count + 1;
        v_where_conditions := array_append(v_where_conditions, 'status = $' || v_param_count);
        v_params := array_append(v_params, p_status_filter);
    END IF;

    IF p_source_filter IS NOT NULL AND p_source_filter != '' THEN
        v_param_count := v_param_count + 1;
        v_where_conditions := array_append(v_where_conditions, 'source = $' || v_param_count);
        v_params := array_append(v_params, p_source_filter);
    END IF;

    IF p_tags_filter IS NOT NULL AND array_length(p_tags_filter, 1) > 0 THEN
        v_param_count := v_param_count + 1;
        v_where_conditions := array_append(v_where_conditions, 'tags && $' || v_param_count);
        v_params := array_append(v_params, p_tags_filter);
    END IF;

    -- Build and execute count query
    v_count_query := 'SELECT COUNT(*) FROM leads WHERE ' || array_to_string(v_where_conditions, ' AND ');
    EXECUTE v_count_query INTO v_total_count USING p_workspace_id;

    -- Build and execute main query with pagination
    v_query := 'SELECT id, email, name, company, status, source, tags, created_at, $' || (v_param_count + 1) || '::BIGINT as total_count
                FROM leads 
                WHERE ' || array_to_string(v_where_conditions, ' AND ') || '
                ORDER BY created_at DESC 
                LIMIT $' || (v_param_count + 2) || ' OFFSET $' || (v_param_count + 3);
    
    v_params := array_append(v_params, v_total_count::TEXT);
    v_params := array_append(v_params, p_limit::TEXT);
    v_params := array_append(v_params, p_offset::TEXT);

    RETURN QUERY EXECUTE v_query USING p_workspace_id, v_total_count, p_limit, p_offset;
END;
$$ LANGUAGE plpgsql;

-- Batch email status updates for webhook processing
CREATE OR REPLACE FUNCTION batch_update_email_status(
    p_updates JSONB
)
RETURNS INTEGER AS $$
DECLARE
    v_update JSONB;
    v_updated_count INTEGER := 0;
    v_status VARCHAR(50);
    v_resend_id VARCHAR(255);
    v_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Process each update in the batch
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        v_status := v_update->>'status';
        v_resend_id := v_update->>'resend_id';
        v_timestamp := COALESCE((v_update->>'timestamp')::TIMESTAMP WITH TIME ZONE, NOW());

        -- Update email_sends record
        UPDATE email_sends
        SET 
            status = v_status,
            delivered_at = CASE WHEN v_status = 'delivered' THEN v_timestamp ELSE delivered_at END,
            opened_at = CASE WHEN v_status = 'opened' THEN v_timestamp ELSE opened_at END,
            clicked_at = CASE WHEN v_status = 'clicked' THEN v_timestamp ELSE clicked_at END,
            bounced_at = CASE WHEN v_status = 'bounced' THEN v_timestamp ELSE bounced_at END,
            unsubscribed_at = CASE WHEN v_status = 'unsubscribed' THEN v_timestamp ELSE unsubscribed_at END,
            complained_at = CASE WHEN v_status = 'complained' THEN v_timestamp ELSE complained_at END,
            error_message = CASE WHEN v_status = 'failed' THEN v_update->>'error_message' ELSE error_message END
        WHERE resend_id = v_resend_id;

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ANALYTICS AND REPORTING FUNCTIONS
-- ============================================

-- Advanced campaign analytics with time-based grouping
CREATE OR REPLACE FUNCTION get_campaign_analytics(
    p_workspace_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_group_by TEXT DEFAULT 'day' -- day, week, month
)
RETURNS TABLE(
    period_start DATE,
    campaigns_sent INTEGER,
    total_recipients BIGINT,
    total_delivered BIGINT,
    total_opened BIGINT,
    total_clicked BIGINT,
    total_bounced BIGINT,
    total_unsubscribed BIGINT,
    delivery_rate NUMERIC,
    open_rate NUMERIC,
    click_rate NUMERIC,
    bounce_rate NUMERIC
) AS $$
DECLARE
    v_start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
    v_date_trunc_format TEXT;
BEGIN
    -- Set date truncation format
    v_date_trunc_format := CASE p_group_by
        WHEN 'week' THEN 'week'
        WHEN 'month' THEN 'month'
        ELSE 'day'
    END;

    RETURN QUERY
    SELECT 
        DATE_TRUNC(v_date_trunc_format, c.sent_at)::DATE as period_start,
        COUNT(*)::INTEGER as campaigns_sent,
        COALESCE(SUM(c.total_recipients), 0) as total_recipients,
        COALESCE(SUM(c.delivered), 0) as total_delivered,
        COALESCE(SUM(c.opened), 0) as total_opened,
        COALESCE(SUM(c.clicked), 0) as total_clicked,
        COALESCE(SUM(c.bounced), 0) as total_bounced,
        COALESCE(SUM(c.unsubscribed), 0) as total_unsubscribed,
        CASE 
            WHEN SUM(c.total_recipients) > 0 THEN
                ROUND((SUM(c.delivered)::NUMERIC / SUM(c.total_recipients)) * 100, 2)
            ELSE 0
        END as delivery_rate,
        CASE 
            WHEN SUM(c.delivered) > 0 THEN
                ROUND((SUM(c.opened)::NUMERIC / SUM(c.delivered)) * 100, 2)
            ELSE 0
        END as open_rate,
        CASE 
            WHEN SUM(c.opened) > 0 THEN
                ROUND((SUM(c.clicked)::NUMERIC / SUM(c.opened)) * 100, 2)
            ELSE 0
        END as click_rate,
        CASE 
            WHEN SUM(c.delivered) > 0 THEN
                ROUND((SUM(c.bounced)::NUMERIC / SUM(c.delivered)) * 100, 2)
            ELSE 0
        END as bounce_rate
    FROM campaigns c
    WHERE c.workspace_id = p_workspace_id
    AND c.sent_at IS NOT NULL
    AND c.sent_at::DATE BETWEEN v_start_date AND v_end_date
    GROUP BY DATE_TRUNC(v_date_trunc_format, c.sent_at)
    ORDER BY period_start;
END;
$$ LANGUAGE plpgsql;

-- Lead growth analytics
CREATE OR REPLACE FUNCTION get_lead_growth_analytics(
    p_workspace_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_group_by TEXT DEFAULT 'day'
)
RETURNS TABLE(
    period_start DATE,
    new_leads INTEGER,
    active_leads INTEGER,
    unsubscribed_leads INTEGER,
    bounced_leads INTEGER,
    net_growth INTEGER,
    cumulative_total INTEGER
) AS $$
DECLARE
    v_start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
    v_date_trunc_format TEXT;
BEGIN
    v_date_trunc_format := CASE p_group_by
        WHEN 'week' THEN 'week'
        WHEN 'month' THEN 'month'
        ELSE 'day'
    END;

    RETURN QUERY
    WITH lead_stats AS (
        SELECT 
            DATE_TRUNC(v_date_trunc_format, l.created_at)::DATE as period_start,
            COUNT(*)::INTEGER as new_leads,
            COUNT(*) FILTER (WHERE l.status = 'active')::INTEGER as active_leads,
            COUNT(*) FILTER (WHERE l.status = 'unsubscribed')::INTEGER as unsubscribed_leads,
            COUNT(*) FILTER (WHERE l.status = 'bounced')::INTEGER as bounced_leads
        FROM leads l
        WHERE l.workspace_id = p_workspace_id
        AND l.created_at::DATE BETWEEN v_start_date AND v_end_date
        GROUP BY DATE_TRUNC(v_date_trunc_format, l.created_at)
    ),
    cumulative_stats AS (
        SELECT 
            ls.*,
            (ls.active_leads - ls.unsubscribed_leads - ls.bounced_leads) as net_growth,
            SUM(ls.new_leads) OVER (ORDER BY ls.period_start) as cumulative_total
        FROM lead_stats ls
    )
    SELECT 
        cs.period_start,
        cs.new_leads,
        cs.active_leads,
        cs.unsubscribed_leads,
        cs.bounced_leads,
        cs.net_growth,
        cs.cumulative_total
    FROM cumulative_stats cs
    ORDER BY cs.period_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================

-- Monitor database performance for optimization
CREATE OR REPLACE FUNCTION get_database_performance_metrics()
RETURNS TABLE(
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT,
    measured_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH performance_metrics AS (
        SELECT 'active_connections' as metric_name, 
               COUNT(*)::NUMERIC as metric_value, 
               'connections' as metric_unit
        FROM pg_stat_activity
        WHERE state = 'active'
        
        UNION ALL
        
        SELECT 'database_size_mb' as metric_name,
               pg_database_size(current_database())::NUMERIC / 1024 / 1024 as metric_value,
               'MB' as metric_unit
        
        UNION ALL
        
        SELECT 'cache_hit_ratio' as metric_name,
               ROUND(
                   (sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0)) * 100, 2
               ) as metric_value,
               'percent' as metric_unit
        FROM pg_stat_database
        WHERE datname = current_database()
        
        UNION ALL
        
        SELECT 'avg_query_time_ms' as metric_name,
               COALESCE(AVG(mean_exec_time), 0) as metric_value,
               'milliseconds' as metric_unit
        FROM pg_stat_statements
        WHERE calls > 10
    )
    SELECT pm.metric_name, pm.metric_value, pm.metric_unit, NOW() as measured_at
    FROM performance_metrics pm;
END;
$$ LANGUAGE plpgsql;

-- Clean up old email sends for performance
CREATE OR REPLACE FUNCTION cleanup_old_email_sends(
    p_retention_days INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
    v_cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    v_cutoff_date := NOW() - INTERVAL '1 day' * p_retention_days;
    
    -- Delete old email sends
    DELETE FROM email_sends 
    WHERE created_at < v_cutoff_date
    AND status NOT IN ('pending', 'sending');
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Log cleanup activity
    INSERT INTO audit_logs (workspace_id, action, resource_type, metadata)
    VALUES (
        NULL,
        'cleanup_completed',
        'email_sends',
        jsonb_build_object(
            'deleted_count', v_deleted_count,
            'retention_days', p_retention_days,
            'cutoff_date', v_cutoff_date
        )
    );
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CONNECTION POOLING HELPERS
-- ============================================

-- Function to get connection pool status
CREATE OR REPLACE FUNCTION get_connection_pool_status()
RETURNS TABLE(
    total_connections INTEGER,
    active_connections INTEGER,
    idle_connections INTEGER,
    max_connections INTEGER,
    connection_usage_percent NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_connections,
        COUNT(*) FILTER (WHERE state = 'active')::INTEGER as active_connections,
        COUNT(*) FILTER (WHERE state = 'idle')::INTEGER as idle_connections,
        (SELECT setting::INTEGER FROM pg_settings WHERE name = 'max_connections') as max_connections,
        ROUND(
            (COUNT(*)::NUMERIC / (SELECT setting::INTEGER FROM pg_settings WHERE name = 'max_connections')) * 100, 2
        ) as connection_usage_percent
    FROM pg_stat_activity;
END;
$$ LANGUAGE plpgsql;
