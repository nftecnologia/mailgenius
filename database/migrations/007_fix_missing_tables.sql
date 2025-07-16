-- Migration 007: Fix Missing Tables and Add Foreign Keys
-- This migration checks for missing tables and creates them if needed, then adds foreign keys

-- Create lead_segments table if it doesn't exist
CREATE TABLE IF NOT EXISTS lead_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL DEFAULT '{}',
    lead_count INTEGER DEFAULT 0,
    auto_update BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_lead_segments_workspace_id ON lead_segments(workspace_id);

-- Enable RLS if not already enabled
ALTER TABLE lead_segments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lead_segments (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'lead_segments'
        AND policyname = 'Users can view lead_segments in their workspace'
    ) THEN
        CREATE POLICY "Users can view lead_segments in their workspace" ON lead_segments
            FOR SELECT USING (
                workspace_id IN (
                    SELECT workspace_id FROM workspace_members
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'lead_segments'
        AND policyname = 'Users can manage lead_segments in their workspace'
    ) THEN
        CREATE POLICY "Users can manage lead_segments in their workspace" ON lead_segments
            FOR ALL USING (
                workspace_id IN (
                    SELECT workspace_id FROM workspace_members
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON lead_segments TO authenticated;

-- Now add foreign keys only if both tables exist
DO $$
BEGIN
    -- Add automations foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_segments')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automations') THEN

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_automations_segment_id'
        ) THEN
            ALTER TABLE automations
            ADD CONSTRAINT fk_automations_segment_id
            FOREIGN KEY (segment_id) REFERENCES lead_segments(id) ON DELETE SET NULL;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lists')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automations') THEN

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_automations_list_id'
        ) THEN
            ALTER TABLE automations
            ADD CONSTRAINT fk_automations_list_id
            FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- Add campaigns foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_segments')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_campaigns_segment_id'
        ) THEN
            ALTER TABLE campaigns
            ADD CONSTRAINT fk_campaigns_segment_id
            FOREIGN KEY (segment_id) REFERENCES lead_segments(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- Add template foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_steps') THEN

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_automation_steps_template_id'
        ) THEN
            ALTER TABLE automation_steps
            ADD CONSTRAINT fk_automation_steps_template_id
            FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sequence_emails') THEN

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_sequence_emails_template_id'
        ) THEN
            ALTER TABLE sequence_emails
            ADD CONSTRAINT fk_sequence_emails_template_id
            FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- Add ab_tests foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_segments')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ab_tests') THEN

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_ab_tests_segment_id'
        ) THEN
            ALTER TABLE ab_tests
            ADD CONSTRAINT fk_ab_tests_segment_id
            FOREIGN KEY (segment_id) REFERENCES lead_segments(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;
