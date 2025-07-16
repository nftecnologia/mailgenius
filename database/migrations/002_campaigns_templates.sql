-- Migration 002: Campaigns and Email Templates
-- Email marketing system with templates, campaigns, and event tracking
-- Tables: email_templates, campaigns, campaign_recipients, email_events, email_links, link_clicks

-- Create custom types for email system
CREATE TYPE template_type AS ENUM ('campaign', 'automation', 'transactional', 'system');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled');
CREATE TYPE recipient_status AS ENUM ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed');
CREATE TYPE email_event_type AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed');

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT,
    text_content TEXT,
    template_type template_type DEFAULT 'campaign',
    variables TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    template_id UUID REFERENCES email_templates(id),
    from_name VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    reply_to VARCHAR(255),
    content TEXT,
    status campaign_status DEFAULT 'draft',
    send_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,

    -- Recipients and metrics
    total_recipients INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    opened INTEGER DEFAULT 0,
    clicked INTEGER DEFAULT 0,
    bounced INTEGER DEFAULT 0,
    unsubscribed INTEGER DEFAULT 0,
    complained INTEGER DEFAULT 0,

    -- Settings
    track_opens BOOLEAN DEFAULT TRUE,
    track_clicks BOOLEAN DEFAULT TRUE,
    segment_id UUID REFERENCES lead_segments(id),
    list_id UUID REFERENCES lists(id),

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaign_recipients table
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    status recipient_status DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    complained_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    message_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, lead_id)
);

-- Create email_events table for detailed tracking
CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES campaign_recipients(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event_type email_event_type NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET,
    location JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_links table for link tracking
CREATE TABLE IF NOT EXISTS email_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    tracking_url TEXT NOT NULL,
    link_hash VARCHAR(100) UNIQUE NOT NULL,
    position INTEGER,
    click_count INTEGER DEFAULT 0,
    unique_click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create link_clicks table
CREATE TABLE IF NOT EXISTS link_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    link_id UUID NOT NULL REFERENCES email_links(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES campaign_recipients(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET,
    referer TEXT,
    location JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_id ON email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_send_at ON campaigns(send_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_sent_at ON campaigns(sent_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_segment_id ON campaigns(segment_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_list_id ON campaigns(list_id);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_lead_id ON campaign_recipients(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_email ON campaign_recipients(email);

CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient_id ON email_events(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_timestamp ON email_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_email_links_campaign_id ON email_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_links_hash ON email_links(link_hash);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_recipient_id ON link_clicks(recipient_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_lead_id ON link_clicks(lead_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at);

-- Create triggers for updated_at
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update campaign statistics
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update delivered count
    UPDATE campaigns
    SET delivered = (
        SELECT COUNT(*) FROM campaign_recipients
        WHERE campaign_id = NEW.campaign_id AND status IN ('delivered', 'opened', 'clicked')
    )
    WHERE id = NEW.campaign_id;

    -- Update opened count
    UPDATE campaigns
    SET opened = (
        SELECT COUNT(*) FROM campaign_recipients
        WHERE campaign_id = NEW.campaign_id AND status IN ('opened', 'clicked')
    )
    WHERE id = NEW.campaign_id;

    -- Update clicked count
    UPDATE campaigns
    SET clicked = (
        SELECT COUNT(*) FROM campaign_recipients
        WHERE campaign_id = NEW.campaign_id AND status = 'clicked'
    )
    WHERE id = NEW.campaign_id;

    -- Update bounced count
    UPDATE campaigns
    SET bounced = (
        SELECT COUNT(*) FROM campaign_recipients
        WHERE campaign_id = NEW.campaign_id AND status = 'bounced'
    )
    WHERE id = NEW.campaign_id;

    -- Update unsubscribed count
    UPDATE campaigns
    SET unsubscribed = (
        SELECT COUNT(*) FROM campaign_recipients
        WHERE campaign_id = NEW.campaign_id AND status = 'unsubscribed'
    )
    WHERE id = NEW.campaign_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update campaign stats
CREATE TRIGGER update_campaign_stats_trigger
    AFTER INSERT OR UPDATE ON campaign_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_stats();

-- Enable Row Level Security
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Users can view templates in their workspace" ON email_templates
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can manage templates in their workspace" ON email_templates
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- RLS Policies for campaigns
CREATE POLICY "Users can view campaigns in their workspace" ON campaigns
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can manage campaigns in their workspace" ON campaigns
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- RLS Policies for campaign_recipients
CREATE POLICY "Users can view campaign recipients in their workspace" ON campaign_recipients
    FOR SELECT USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY "Users can manage campaign recipients in their workspace" ON campaign_recipients
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for email_events
CREATE POLICY "Users can view email events in their workspace" ON email_events
    FOR SELECT USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY "Users can insert email events in their workspace" ON email_events
    FOR INSERT WITH CHECK (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for email_links
CREATE POLICY "Users can view email links in their workspace" ON email_links
    FOR SELECT USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY "Users can manage email links in their workspace" ON email_links
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for link_clicks
CREATE POLICY "Users can view link clicks in their workspace" ON link_clicks
    FOR SELECT USING (
        link_id IN (
            SELECT id FROM email_links WHERE campaign_id IN (
                SELECT id FROM campaigns WHERE workspace_id IN (
                    SELECT workspace_id FROM workspace_members
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            )
        )
    );

CREATE POLICY "Users can insert link clicks in their workspace" ON link_clicks
    FOR INSERT WITH CHECK (
        link_id IN (
            SELECT id FROM email_links WHERE campaign_id IN (
                SELECT id FROM campaigns WHERE workspace_id IN (
                    SELECT workspace_id FROM workspace_members
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            )
        )
    );

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
