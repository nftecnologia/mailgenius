-- Fix Database Structure for MailGenius
-- Run this script BEFORE the RLS script if you get column/table errors

-- Create lead_segments table if it doesn't exist
CREATE TABLE IF NOT EXISTS lead_segments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add segment_id column to campaigns if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'campaigns'
                   AND column_name = 'segment_id') THEN
        ALTER TABLE campaigns ADD COLUMN segment_id UUID;
    END IF;
END $$;

-- Add template_id column to campaigns if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'campaigns'
                   AND column_name = 'template_id') THEN
        ALTER TABLE campaigns ADD COLUMN template_id UUID;
    END IF;
END $$;

-- Add send_at column to campaigns if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'campaigns'
                   AND column_name = 'send_at') THEN
        ALTER TABLE campaigns ADD COLUMN send_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add sent_at column to campaigns if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'campaigns'
                   AND column_name = 'sent_at') THEN
        ALTER TABLE campaigns ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add created_by column to campaigns if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'campaigns'
                   AND column_name = 'created_by') THEN
        ALTER TABLE campaigns ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add missing columns to leads table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads'
                   AND column_name = 'phone') THEN
        ALTER TABLE leads ADD COLUMN phone VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads'
                   AND column_name = 'company') THEN
        ALTER TABLE leads ADD COLUMN company VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads'
                   AND column_name = 'position') THEN
        ALTER TABLE leads ADD COLUMN position VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads'
                   AND column_name = 'source') THEN
        ALTER TABLE leads ADD COLUMN source VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads'
                   AND column_name = 'tags') THEN
        ALTER TABLE leads ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads'
                   AND column_name = 'custom_fields') THEN
        ALTER TABLE leads ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add missing columns to email_templates table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_templates'
                   AND column_name = 'text_content') THEN
        ALTER TABLE email_templates ADD COLUMN text_content TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_templates'
                   AND column_name = 'variables') THEN
        ALTER TABLE email_templates ADD COLUMN variables JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_templates'
                   AND column_name = 'template_type') THEN
        ALTER TABLE email_templates ADD COLUMN template_type VARCHAR(50) DEFAULT 'custom';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'email_templates'
                   AND column_name = 'created_by') THEN
        ALTER TABLE email_templates ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add missing columns to workspaces table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces'
                   AND column_name = 'domain') THEN
        ALTER TABLE workspaces ADD COLUMN domain VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces'
                   AND column_name = 'plan') THEN
        ALTER TABLE workspaces ADD COLUMN plan VARCHAR(50) DEFAULT 'starter';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces'
                   AND column_name = 'settings') THEN
        ALTER TABLE workspaces ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add missing columns to workspace_members table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspace_members'
                   AND column_name = 'invited_by') THEN
        ALTER TABLE workspace_members ADD COLUMN invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspace_members'
                   AND column_name = 'invited_at') THEN
        ALTER TABLE workspace_members ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspace_members'
                   AND column_name = 'joined_at') THEN
        ALTER TABLE workspace_members ADD COLUMN joined_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add missing columns to users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users'
                   AND column_name = 'name') THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users'
                   AND column_name = 'avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_segment_id ON campaigns(segment_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_id ON email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_segments_workspace_id ON lead_segments(workspace_id);

-- Add foreign key constraints (only if columns exist)
DO $$
BEGIN
    -- Add foreign key for segment_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_campaigns_segment_id'
    ) THEN
        ALTER TABLE campaigns
        ADD CONSTRAINT fk_campaigns_segment_id
        FOREIGN KEY (segment_id) REFERENCES lead_segments(id) ON DELETE SET NULL;
    END IF;

    -- Add foreign key for template_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_campaigns_template_id'
    ) THEN
        ALTER TABLE campaigns
        ADD CONSTRAINT fk_campaigns_template_id
        FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Success message
SELECT 'Database structure fixed successfully!' as message;
