-- Migration 011: Advanced Conditions and Branching Support
-- This migration adds support for advanced conditions and branching in automation flows

-- Add new columns to automation_flows table to support advanced conditions
ALTER TABLE automation_flows 
ADD COLUMN IF NOT EXISTS flow_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS supports_branching BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS supports_advanced_conditions BOOLEAN DEFAULT FALSE;

-- Create automation_flow_branches table for branching support
CREATE TABLE IF NOT EXISTS automation_flow_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    branch_id VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    condition_result BOOLEAN NOT NULL, -- true for "when condition passes", false for "when condition fails"
    next_steps JSONB DEFAULT '[]', -- Array of step IDs to execute next
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create automation_advanced_conditions table for complex conditions
CREATE TABLE IF NOT EXISTS automation_advanced_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    condition_id VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) NOT NULL, -- 'simple' or 'group'
    parent_condition_id VARCHAR(255), -- For nested conditions
    operator VARCHAR(10), -- 'and' or 'or' for group conditions
    field_name VARCHAR(255), -- For simple conditions
    comparison_operator VARCHAR(50), -- 'equals', 'not_equals', 'contains', etc.
    condition_value JSONB, -- The value to compare against
    case_sensitive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create automation_step_relationships table for complex step relationships
CREATE TABLE IF NOT EXISTS automation_step_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
    source_step_id VARCHAR(255) NOT NULL,
    target_step_id VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL, -- 'next', 'branch_true', 'branch_false', 'condition_pass', 'condition_fail'
    condition_result BOOLEAN, -- For branching relationships
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_flow_branches_automation_id ON automation_flow_branches(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_flow_branches_step_id ON automation_flow_branches(step_id);
CREATE INDEX IF NOT EXISTS idx_automation_flow_branches_branch_id ON automation_flow_branches(branch_id);

CREATE INDEX IF NOT EXISTS idx_automation_advanced_conditions_automation_id ON automation_advanced_conditions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_advanced_conditions_step_id ON automation_advanced_conditions(step_id);
CREATE INDEX IF NOT EXISTS idx_automation_advanced_conditions_condition_id ON automation_advanced_conditions(condition_id);
CREATE INDEX IF NOT EXISTS idx_automation_advanced_conditions_parent_id ON automation_advanced_conditions(parent_condition_id);

CREATE INDEX IF NOT EXISTS idx_automation_step_relationships_automation_id ON automation_step_relationships(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_step_relationships_source_step ON automation_step_relationships(source_step_id);
CREATE INDEX IF NOT EXISTS idx_automation_step_relationships_target_step ON automation_step_relationships(target_step_id);
CREATE INDEX IF NOT EXISTS idx_automation_step_relationships_type ON automation_step_relationships(relationship_type);

-- Add triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_automation_flow_branches_updated_at 
    BEFORE UPDATE ON automation_flow_branches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_automation_advanced_conditions_updated_at 
    BEFORE UPDATE ON automation_advanced_conditions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE automation_flow_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_advanced_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_step_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_flow_branches
CREATE POLICY IF NOT EXISTS "Users can view automation branches in their workspace" ON automation_flow_branches
    FOR SELECT USING (
        automation_id IN (
            SELECT id FROM automation_flows WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY IF NOT EXISTS "Users can manage automation branches in their workspace" ON automation_flow_branches
    FOR ALL USING (
        automation_id IN (
            SELECT id FROM automation_flows WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for automation_advanced_conditions
CREATE POLICY IF NOT EXISTS "Users can view automation conditions in their workspace" ON automation_advanced_conditions
    FOR SELECT USING (
        automation_id IN (
            SELECT id FROM automation_flows WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY IF NOT EXISTS "Users can manage automation conditions in their workspace" ON automation_advanced_conditions
    FOR ALL USING (
        automation_id IN (
            SELECT id FROM automation_flows WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- RLS Policies for automation_step_relationships
CREATE POLICY IF NOT EXISTS "Users can view automation step relationships in their workspace" ON automation_step_relationships
    FOR SELECT USING (
        automation_id IN (
            SELECT id FROM automation_flows WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

CREATE POLICY IF NOT EXISTS "Users can manage automation step relationships in their workspace" ON automation_step_relationships
    FOR ALL USING (
        automation_id IN (
            SELECT id FROM automation_flows WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- Grant permissions
GRANT ALL ON automation_flow_branches TO authenticated;
GRANT ALL ON automation_advanced_conditions TO authenticated;
GRANT ALL ON automation_step_relationships TO authenticated;

-- Function to get automation flow stats including branching
CREATE OR REPLACE FUNCTION get_automation_flow_stats(automation_id UUID)
RETURNS TABLE(
    total_runs INTEGER,
    successful_runs INTEGER,
    failed_runs INTEGER,
    completion_rate NUMERIC,
    avg_execution_time NUMERIC,
    last_run_at TIMESTAMP WITH TIME ZONE,
    has_branching BOOLEAN,
    has_advanced_conditions BOOLEAN,
    total_steps INTEGER,
    total_branches INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(ar.*)::INTEGER as total_runs,
        COUNT(*) FILTER (WHERE ar.status = 'completed')::INTEGER as successful_runs,
        COUNT(*) FILTER (WHERE ar.status = 'failed')::INTEGER as failed_runs,
        CASE 
            WHEN COUNT(ar.*) > 0 THEN 
                (COUNT(*) FILTER (WHERE ar.status = 'completed')::NUMERIC / COUNT(ar.*)::NUMERIC) * 100
            ELSE 0
        END as completion_rate,
        CASE 
            WHEN COUNT(*) FILTER (WHERE ar.status = 'completed' AND ar.completed_at IS NOT NULL) > 0 THEN
                AVG(EXTRACT(EPOCH FROM (ar.completed_at - ar.started_at))) * 1000
            ELSE 0
        END as avg_execution_time,
        MAX(ar.started_at) as last_run_at,
        af.supports_branching as has_branching,
        af.supports_advanced_conditions as has_advanced_conditions,
        COALESCE(jsonb_array_length(af.flow_definition->'steps'), 0) as total_steps,
        COALESCE((SELECT COUNT(*) FROM automation_flow_branches WHERE automation_flow_branches.automation_id = $1), 0)::INTEGER as total_branches
    FROM automation_flows af
    LEFT JOIN automation_runs ar ON ar.automation_id = af.id
    WHERE af.id = $1
    GROUP BY af.id, af.supports_branching, af.supports_advanced_conditions, af.flow_definition;
END;
$$ LANGUAGE plpgsql;

-- Function to validate automation flow structure
CREATE OR REPLACE FUNCTION validate_automation_flow_structure(automation_id UUID)
RETURNS TABLE(
    is_valid BOOLEAN,
    errors TEXT[]
) AS $$
DECLARE
    flow_data JSONB;
    step_ids TEXT[];
    branch_step_ids TEXT[];
    missing_steps TEXT[];
    orphaned_branches TEXT[];
    validation_errors TEXT[] := '{}';
BEGIN
    -- Get flow definition
    SELECT flow_definition INTO flow_data
    FROM automation_flows
    WHERE id = automation_id;
    
    IF flow_data IS NULL THEN
        RETURN QUERY SELECT FALSE, ARRAY['Automation flow not found'];
        RETURN;
    END IF;
    
    -- Extract step IDs from flow definition
    SELECT array_agg(step_data->>'id')
    INTO step_ids
    FROM jsonb_array_elements(flow_data->'steps') AS step_data;
    
    -- Get branch step IDs
    SELECT array_agg(DISTINCT step_id)
    INTO branch_step_ids
    FROM automation_flow_branches
    WHERE automation_id = validate_automation_flow_structure.automation_id;
    
    -- Check for branches without corresponding steps
    SELECT array_agg(branch_step_id)
    INTO orphaned_branches
    FROM unnest(branch_step_ids) AS branch_step_id
    WHERE branch_step_id IS NOT NULL AND NOT (branch_step_id = ANY(step_ids));
    
    -- Add validation errors
    IF array_length(orphaned_branches, 1) > 0 THEN
        validation_errors := validation_errors || ('Orphaned branches found for steps: ' || array_to_string(orphaned_branches, ', '));
    END IF;
    
    -- Check for missing required branches for branching steps
    -- (This would require parsing the flow_definition to identify branching steps)
    
    RETURN QUERY SELECT 
        array_length(validation_errors, 1) = 0 OR validation_errors = '{}',
        CASE 
            WHEN validation_errors = '{}' THEN ARRAY[]::TEXT[]
            ELSE validation_errors
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to get automation execution path
CREATE OR REPLACE FUNCTION get_automation_execution_path(run_id UUID)
RETURNS TABLE(
    step_index INTEGER,
    step_id VARCHAR(255),
    step_name VARCHAR(255),
    step_type VARCHAR(50),
    execution_status VARCHAR(20),
    branch_taken VARCHAR(255),
    condition_result BOOLEAN,
    executed_at TIMESTAMP WITH TIME ZONE,
    execution_time_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROW_NUMBER() OVER (ORDER BY ase.executed_at)::INTEGER as step_index,
        ase.step_id,
        ase.step_id as step_name, -- This could be enhanced to get actual step names
        ase.step_type,
        ase.status as execution_status,
        (ase.result_data->>'branch_taken')::VARCHAR(255) as branch_taken,
        (ase.result_data->>'condition_result')::BOOLEAN as condition_result,
        ase.executed_at,
        CASE 
            WHEN ase.completed_at IS NOT NULL THEN
                EXTRACT(EPOCH FROM (ase.completed_at - ase.executed_at)) * 1000
            ELSE NULL
        END as execution_time_ms
    FROM automation_step_executions ase
    WHERE ase.automation_run_id = run_id
    ORDER BY ase.executed_at;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing (optional)
-- This would be removed in production
/*
INSERT INTO automation_flows (id, workspace_id, name, description, trigger_type, flow_definition, status, supports_branching, supports_advanced_conditions)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    (SELECT id FROM workspaces LIMIT 1),
    'Test Advanced Automation',
    'Test automation with advanced conditions and branching',
    'new_lead',
    '{
        "version": "2.0",
        "steps": [
            {
                "id": "trigger-1",
                "type": "trigger",
                "name": "New Lead Trigger"
            },
            {
                "id": "branch-1",
                "type": "branching",
                "name": "Check Lead Source",
                "config": {
                    "conditions": [
                        {
                            "id": "cond-1",
                            "type": "simple",
                            "field": "lead.source",
                            "comparison": "equals",
                            "value": "website"
                        }
                    ],
                    "branches": [
                        {
                            "id": "branch-true",
                            "name": "Website Lead",
                            "condition_result": true,
                            "next_steps": ["action-1"]
                        },
                        {
                            "id": "branch-false",
                            "name": "Other Lead",
                            "condition_result": false,
                            "next_steps": ["action-2"]
                        }
                    ]
                }
            },
            {
                "id": "action-1",
                "type": "action",
                "name": "Send Welcome Email"
            },
            {
                "id": "action-2",
                "type": "action",
                "name": "Send General Email"
            }
        ]
    }',
    'draft',
    TRUE,
    TRUE
) ON CONFLICT (id) DO NOTHING;
*/