-- Migration 003: Automations and Email Sequences
-- Marketing automation system with workflows, triggers, and email sequences
-- Tables: automations, automation_steps, automation_runs, email_sequences, sequence_emails, sequence_subscribers

-- Create custom types for automation system
CREATE TYPE automation_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE automation_trigger_type AS ENUM ('lead_added', 'email_opened', 'email_clicked', 'link_clicked', 'form_submitted', 'tag_added', 'date_based', 'manual');
CREATE TYPE step_type AS ENUM ('email', 'wait', 'condition', 'tag_action', 'webhook', 'internal_notification');
CREATE TYPE step_action AS ENUM ('send_email', 'wait_time', 'wait_date', 'if_condition', 'add_tag', 'remove_tag', 'send_webhook', 'notify_team');
CREATE TYPE run_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE sequence_status AS ENUM ('draft', 'active', 'paused');
CREATE TYPE subscriber_status AS ENUM ('active', 'completed', 'unsubscribed', 'bounced', 'failed');

-- Create automations table
CREATE TABLE IF NOT EXISTS automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type automation_trigger_type NOT NULL,
    trigger_conditions JSONB DEFAULT '{}',
    status automation_status DEFAULT 'draft',

    -- Execution settings
    max_executions INTEGER,
    execution_count INTEGER DEFAULT 0,
    delay_minutes INTEGER DEFAULT 0,

    -- Segmentation (references will be added after other migrations)
    segment_id UUID,
    list_id UUID,

    -- Statistics
    total_runs INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create automation_steps table
CREATE TABLE IF NOT EXISTS automation_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type step_type NOT NULL,
    step_action step_action NOT NULL,
    name VARCHAR(255) NOT NULL,

    -- Step configuration
    settings JSONB DEFAULT '{}',
    conditions JSONB DEFAULT '{}',

    -- Email specific
    template_id UUID REFERENCES email_templates(id),
    subject VARCHAR(500),
    content TEXT,

    -- Wait specific
    wait_amount INTEGER,
    wait_unit VARCHAR(20), -- minutes, hours, days, weeks
    wait_until_date TIMESTAMP WITH TIME ZONE,

    -- Webhook specific
    webhook_url TEXT,
    webhook_method VARCHAR(10),
    webhook_headers JSONB DEFAULT '{}',
    webhook_payload JSONB DEFAULT '{}',

    -- Statistics
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create automation_runs table
CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status run_status DEFAULT 'pending',

    -- Execution tracking
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    current_step_id UUID REFERENCES automation_steps(id),
    next_execution_at TIMESTAMP WITH TIME ZONE,

    -- Progress tracking
    steps_completed INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Metadata
    trigger_event JSONB DEFAULT '{}',
    execution_data JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_sequences table
CREATE TABLE IF NOT EXISTS email_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status sequence_status DEFAULT 'draft',

    -- Settings
    from_name VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    reply_to VARCHAR(255),

    -- Timing
    start_delay_hours INTEGER DEFAULT 0,
    send_time TIME DEFAULT '09:00:00',
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Days of week (1=Monday, 7=Sunday)
    send_days INTEGER[] DEFAULT '{1,2,3,4,5}',

    -- Statistics
    total_subscribers INTEGER DEFAULT 0,
    active_subscribers INTEGER DEFAULT 0,
    completed_subscribers INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sequence_emails table
CREATE TABLE IF NOT EXISTS sequence_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,

    -- Content
    template_id UUID REFERENCES email_templates(id),
    html_content TEXT,
    text_content TEXT,

    -- Timing
    delay_days INTEGER NOT NULL DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,

    -- Statistics
    total_sent INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    opened INTEGER DEFAULT 0,
    clicked INTEGER DEFAULT 0,
    unsubscribed INTEGER DEFAULT 0,

    -- Settings
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(sequence_id, step_number)
);

-- Create sequence_subscribers table
CREATE TABLE IF NOT EXISTS sequence_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status subscriber_status DEFAULT 'active',

    -- Progress tracking
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,

    -- Timing
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_email_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,

    -- Statistics
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,

    -- Metadata
    subscription_source VARCHAR(100),
    subscription_data JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(sequence_id, lead_id)
);

-- Create automation_step_executions table for detailed tracking
CREATE TABLE IF NOT EXISTS automation_step_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_run_id UUID NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES automation_steps(id) ON DELETE CASCADE,
    status run_status DEFAULT 'pending',

    -- Execution details
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Results
    result_data JSONB DEFAULT '{}',
    error_message TEXT,

    -- Email specific tracking
    campaign_id UUID REFERENCES campaigns(id),
    email_sent BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_automations_workspace_id ON automations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_segment_id ON automations(segment_id);
CREATE INDEX IF NOT EXISTS idx_automations_list_id ON automations(list_id);

CREATE INDEX IF NOT EXISTS idx_automation_steps_automation_id ON automation_steps(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_steps_order ON automation_steps(automation_id, step_order);
CREATE INDEX IF NOT EXISTS idx_automation_steps_type ON automation_steps(step_type);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_lead_id ON automation_runs(lead_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_next_execution ON automation_runs(next_execution_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_current_step ON automation_runs(current_step_id);

CREATE INDEX IF NOT EXISTS idx_email_sequences_workspace_id ON email_sequences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_status ON email_sequences(status);

CREATE INDEX IF NOT EXISTS idx_sequence_emails_sequence_id ON sequence_emails(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_emails_step_number ON sequence_emails(sequence_id, step_number);

CREATE INDEX IF NOT EXISTS idx_sequence_subscribers_sequence_id ON sequence_subscribers(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_subscribers_lead_id ON sequence_subscribers(lead_id);
CREATE INDEX IF NOT EXISTS idx_sequence_subscribers_status ON sequence_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_sequence_subscribers_next_email ON sequence_subscribers(next_email_at);

CREATE INDEX IF NOT EXISTS idx_automation_step_executions_run_id ON automation_step_executions(automation_run_id);
CREATE INDEX IF NOT EXISTS idx_automation_step_executions_step_id ON automation_step_executions(step_id);

-- Create triggers for updated_at
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_steps_updated_at BEFORE UPDATE ON automation_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_runs_updated_at BEFORE UPDATE ON automation_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_sequences_updated_at BEFORE UPDATE ON email_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sequence_emails_updated_at BEFORE UPDATE ON sequence_emails FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sequence_subscribers_updated_at BEFORE UPDATE ON sequence_subscribers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update automation statistics
CREATE OR REPLACE FUNCTION update_automation_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
        UPDATE automations
        SET
            total_runs = (
                SELECT COUNT(*) FROM automation_runs
                WHERE automation_id = NEW.automation_id
            ),
            successful_runs = (
                SELECT COUNT(*) FROM automation_runs
                WHERE automation_id = NEW.automation_id AND status = 'completed'
            ),
            failed_runs = (
                SELECT COUNT(*) FROM automation_runs
                WHERE automation_id = NEW.automation_id AND status = 'failed'
            ),
            updated_at = NOW()
        WHERE id = NEW.automation_id;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update automation stats
CREATE TRIGGER update_automation_stats_trigger
    AFTER INSERT OR UPDATE ON automation_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_automation_stats();

-- Function to update sequence statistics
CREATE OR REPLACE FUNCTION update_sequence_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
        UPDATE email_sequences
        SET
            total_subscribers = (
                SELECT COUNT(*) FROM sequence_subscribers
                WHERE sequence_id = NEW.sequence_id
            ),
            active_subscribers = (
                SELECT COUNT(*) FROM sequence_subscribers
                WHERE sequence_id = NEW.sequence_id AND status = 'active'
            ),
            completed_subscribers = (
                SELECT COUNT(*) FROM sequence_subscribers
                WHERE sequence_id = NEW.sequence_id AND status = 'completed'
            ),
            updated_at = NOW()
        WHERE id = NEW.sequence_id;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update sequence stats
CREATE TRIGGER update_sequence_stats_trigger
    AFTER INSERT OR UPDATE ON sequence_subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_sequence_stats();

-- Function to calculate next email time for sequences
CREATE OR REPLACE FUNCTION calculate_next_email_time(
    sequence_id UUID,
    current_step INTEGER,
    subscribed_at TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR DEFAULT 'UTC'
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    next_step_info RECORD;
    next_time TIMESTAMP WITH TIME ZONE;
    sequence_info RECORD;
BEGIN
    -- Get sequence settings
    SELECT send_time, send_days, start_delay_hours
    INTO sequence_info
    FROM email_sequences
    WHERE id = sequence_id;

    -- Get next step delay
    SELECT delay_days, delay_hours
    INTO next_step_info
    FROM sequence_emails
    WHERE sequence_id = sequence_id AND step_number = current_step + 1;

    IF next_step_info IS NULL THEN
        RETURN NULL; -- No more steps
    END IF;

    -- Calculate base time
    next_time := subscribed_at +
                INTERVAL '1 hour' * sequence_info.start_delay_hours +
                INTERVAL '1 day' * next_step_info.delay_days +
                INTERVAL '1 hour' * COALESCE(next_step_info.delay_hours, 0);

    -- Adjust to send time and allowed days
    -- This is a simplified version - in production you'd want more sophisticated scheduling
    next_time := date_trunc('day', next_time) + sequence_info.send_time;

    RETURN next_time;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_step_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automations
CREATE POLICY "Users can view automations in their workspace" ON automations
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can manage automations in their workspace" ON automations
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- RLS Policies for automation_steps
CREATE POLICY "Users can view automation steps in their workspace" ON automation_steps
    FOR SELECT USING (
        automation_id IN (
            SELECT id FROM automations WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY "Users can manage automation steps in their workspace" ON automation_steps
    FOR ALL USING (
        automation_id IN (
            SELECT id FROM automations WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for automation_runs
CREATE POLICY "Users can view automation runs in their workspace" ON automation_runs
    FOR SELECT USING (
        automation_id IN (
            SELECT id FROM automations WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY "Users can manage automation runs in their workspace" ON automation_runs
    FOR ALL USING (
        automation_id IN (
            SELECT id FROM automations WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for email_sequences
CREATE POLICY "Users can view email sequences in their workspace" ON email_sequences
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can manage email sequences in their workspace" ON email_sequences
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- RLS Policies for sequence_emails
CREATE POLICY "Users can view sequence emails in their workspace" ON sequence_emails
    FOR SELECT USING (
        sequence_id IN (
            SELECT id FROM email_sequences WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY "Users can manage sequence emails in their workspace" ON sequence_emails
    FOR ALL USING (
        sequence_id IN (
            SELECT id FROM email_sequences WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for sequence_subscribers
CREATE POLICY "Users can view sequence subscribers in their workspace" ON sequence_subscribers
    FOR SELECT USING (
        sequence_id IN (
            SELECT id FROM email_sequences WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY "Users can manage sequence subscribers in their workspace" ON sequence_subscribers
    FOR ALL USING (
        sequence_id IN (
            SELECT id FROM email_sequences WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for automation_step_executions
CREATE POLICY "Users can view automation step executions in their workspace" ON automation_step_executions
    FOR SELECT USING (
        automation_run_id IN (
            SELECT id FROM automation_runs WHERE automation_id IN (
                SELECT id FROM automations WHERE workspace_id IN (
                    SELECT workspace_id FROM workspace_members
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            )
        )
    );

CREATE POLICY "Users can manage automation step executions in their workspace" ON automation_step_executions
    FOR ALL USING (
        automation_run_id IN (
            SELECT id FROM automation_runs WHERE automation_id IN (
                SELECT id FROM automations WHERE workspace_id IN (
                    SELECT workspace_id FROM workspace_members
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            )
        )
    );

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
