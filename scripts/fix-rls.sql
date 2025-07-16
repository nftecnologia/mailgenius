-- Fix RLS (Row Level Security) Policies for MailGenius
-- Run this script in your Supabase SQL Editor

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;
DROP POLICY IF EXISTS "Service role full access to users" ON users;

DROP POLICY IF EXISTS "Users can view their memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert their memberships" ON workspace_members;
DROP POLICY IF EXISTS "Service role can manage memberships" ON workspace_members;
DROP POLICY IF EXISTS "Service role full access to memberships" ON workspace_members;

DROP POLICY IF EXISTS "Members can view their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Service role can manage workspaces" ON workspaces;
DROP POLICY IF EXISTS "Service role full access to workspaces" ON workspaces;

DROP POLICY IF EXISTS "Members can view workspace leads" ON leads;
DROP POLICY IF EXISTS "Members can manage workspace leads" ON leads;

DROP POLICY IF EXISTS "Members can view workspace campaigns" ON campaigns;
DROP POLICY IF EXISTS "Members can manage workspace campaigns" ON campaigns;

DROP POLICY IF EXISTS "Members can view workspace templates" ON email_templates;
DROP POLICY IF EXISTS "Members can manage workspace templates" ON email_templates;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Allow users to insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Workspace members policies
-- Allow users to view their memberships
CREATE POLICY "Users can view their memberships"
ON workspace_members FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their memberships (when creating workspace)
CREATE POLICY "Users can insert their memberships"
ON workspace_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Workspaces policies
-- Allow members to view their workspaces
CREATE POLICY "Members can view their workspaces"
ON workspaces FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspaces.id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
  )
);

-- Allow users to create workspaces
CREATE POLICY "Users can create workspaces"
ON workspaces FOR INSERT
WITH CHECK (true);

-- Leads policies
-- Allow members to view workspace leads
CREATE POLICY "Members can view workspace leads"
ON leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
  )
);

-- Allow members with proper roles to manage leads
CREATE POLICY "Members can manage workspace leads"
ON leads FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
    AND workspace_members.role IN ('owner', 'admin', 'editor')
  )
);

-- Campaigns policies
-- Allow members to view workspace campaigns
CREATE POLICY "Members can view workspace campaigns"
ON campaigns FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = campaigns.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
  )
);

-- Allow members with proper roles to manage campaigns
CREATE POLICY "Members can manage workspace campaigns"
ON campaigns FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = campaigns.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
    AND workspace_members.role IN ('owner', 'admin', 'editor')
  )
);

-- Email templates policies
-- Allow members to view workspace templates
CREATE POLICY "Members can view workspace templates"
ON email_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = email_templates.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
  )
);

-- Allow members with proper roles to manage templates
CREATE POLICY "Members can manage workspace templates"
ON email_templates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = email_templates.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
    AND workspace_members.role IN ('owner', 'admin', 'editor')
  )
);

-- Create function to execute SQL (for admin use)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Success message
SELECT 'RLS policies applied successfully!' as message;
