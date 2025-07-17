-- Migration 010: Automation Flows Compatibility
-- This migration ensures compatibility between the new automation engine and existing automation_flows table

-- Create automation_flows table if it doesn't exist (for compatibility)
CREATE TABLE IF NOT EXISTS automation_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    flow_definition JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create automation_runs table if it doesn't exist
CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    current_step_index INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_data JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_execution_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create automation_step_executions table if it doesn't exist
CREATE TABLE IF NOT EXISTS automation_step_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_run_id UUID NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    result_data JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_flows_workspace_id ON automation_flows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_status ON automation_flows(status);
CREATE INDEX IF NOT EXISTS idx_automation_flows_trigger_type ON automation_flows(trigger_type);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_lead_id ON automation_runs(lead_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_next_execution ON automation_runs(next_execution_at);

CREATE INDEX IF NOT EXISTS idx_automation_step_executions_run_id ON automation_step_executions(automation_run_id);
CREATE INDEX IF NOT EXISTS idx_automation_step_executions_step_id ON automation_step_executions(step_id);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_automation_flows_updated_at 
    BEFORE UPDATE ON automation_flows 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_automation_runs_updated_at 
    BEFORE UPDATE ON automation_runs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_step_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_flows
CREATE POLICY IF NOT EXISTS "Users can view automation flows in their workspace" ON automation_flows
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY IF NOT EXISTS "Users can manage automation flows in their workspace" ON automation_flows
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- RLS Policies for automation_runs
CREATE POLICY IF NOT EXISTS "Users can view automation runs in their workspace" ON automation_runs
    FOR SELECT USING (
        automation_id IN (
            SELECT id FROM automation_flows WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY IF NOT EXISTS "Users can manage automation runs in their workspace" ON automation_runs
    FOR ALL USING (
        automation_id IN (
            SELECT id FROM automation_flows WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for automation_step_executions
CREATE POLICY IF NOT EXISTS "Users can view automation step executions in their workspace" ON automation_step_executions
    FOR SELECT USING (
        automation_run_id IN (
            SELECT id FROM automation_runs WHERE automation_id IN (
                SELECT id FROM automation_flows WHERE workspace_id IN (
                    SELECT workspace_id FROM workspace_members
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            )
        )
    );

CREATE POLICY IF NOT EXISTS "Users can manage automation step executions in their workspace" ON automation_step_executions
    FOR ALL USING (
        automation_run_id IN (
            SELECT id FROM automation_runs WHERE automation_id IN (
                SELECT id FROM automation_flows WHERE workspace_id IN (
                    SELECT workspace_id FROM workspace_members
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            )
        )
    );

-- Grant permissions
GRANT ALL ON automation_flows TO authenticated;
GRANT ALL ON automation_runs TO authenticated;
GRANT ALL ON automation_step_executions TO authenticated;

-- Function to get automation statistics
CREATE OR REPLACE FUNCTION get_automation_stats(automation_id UUID)
RETURNS TABLE(
    total_runs INTEGER,
    successful_runs INTEGER,
    failed_runs INTEGER,
    completion_rate NUMERIC,
    avg_execution_time NUMERIC,
    last_run_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_runs,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as successful_runs,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_runs,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100
            ELSE 0
        END as completion_rate,
        CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL) > 0 THEN
                AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) * 1000
            ELSE 0
        END as avg_execution_time,
        MAX(started_at) as last_run_at
    FROM automation_runs
    WHERE automation_runs.automation_id = $1;
END;
$$ LANGUAGE plpgsql;

-- Function to trigger automation for new leads
CREATE OR REPLACE FUNCTION trigger_automation_for_new_lead()
RETURNS TRIGGER AS $$
BEGIN
    -- This would be handled by the application layer
    -- Just logging for now
    RAISE NOTICE 'New lead created: %', NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new leads (optional, can be handled in application)
-- CREATE TRIGGER trigger_new_lead_automation
--     AFTER INSERT ON leads
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_automation_for_new_lead();