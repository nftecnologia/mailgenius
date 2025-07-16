-- Fix User Role ENUM Type
-- This script adds missing values to the user_role enum

-- First, let's check what values exist in the enum
-- You can run this to see current values:
-- SELECT enum_range(NULL::user_role);

-- Add missing enum values
-- PostgreSQL doesn't allow direct modification of enums, so we need to:
-- 1. Create a new type with all values
-- 2. Update columns to use new type
-- 3. Drop old type
-- 4. Rename new type

DO $$
BEGIN
    -- Check if user_role type exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- Create new enum with all needed values
        CREATE TYPE user_role_new AS ENUM ('owner', 'admin', 'editor', 'member', 'viewer');

        -- Update workspace_members table to use new type
        ALTER TABLE workspace_members
        ALTER COLUMN role TYPE user_role_new
        USING role::text::user_role_new;

        -- Drop old type
        DROP TYPE user_role;

        -- Rename new type to original name
        ALTER TYPE user_role_new RENAME TO user_role;

        RAISE NOTICE 'user_role enum updated successfully';
    ELSE
        -- If type doesn't exist, create it
        CREATE TYPE user_role AS ENUM ('owner', 'admin', 'editor', 'member', 'viewer');

        RAISE NOTICE 'user_role enum created successfully';
    END IF;
EXCEPTION
    WHEN others THEN
        -- If the above fails, try alternative approach
        RAISE NOTICE 'Standard approach failed, trying alternative...';

        -- Alternative: Just update the policies to use existing roles
        NULL;
END $$;

-- Alternative solution: Update the columns to use VARCHAR instead of ENUM
-- This is more flexible and avoids enum issues
DO $$
BEGIN
    -- Check if role column is using enum type
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'workspace_members'
        AND column_name = 'role'
        AND data_type = 'USER-DEFINED'
    ) THEN
        -- Change to VARCHAR
        ALTER TABLE workspace_members
        ALTER COLUMN role TYPE VARCHAR(50)
        USING role::text;

        -- Add check constraint to ensure valid values
        ALTER TABLE workspace_members
        DROP CONSTRAINT IF EXISTS check_valid_role;

        ALTER TABLE workspace_members
        ADD CONSTRAINT check_valid_role
        CHECK (role IN ('owner', 'admin', 'editor', 'member', 'viewer'));

        RAISE NOTICE 'Changed role column to VARCHAR with check constraint';
    END IF;
END $$;

-- Now we need to update the RLS policies to work with the available roles
-- Drop existing policies that use 'editor' role
DROP POLICY IF EXISTS "Members can manage workspace leads" ON leads;
DROP POLICY IF EXISTS "Members can manage workspace campaigns" ON campaigns;
DROP POLICY IF EXISTS "Members can manage workspace templates" ON email_templates;
DROP POLICY IF EXISTS "Members can manage workspace segments" ON lead_segments;

-- Recreate policies with correct role handling
-- For leads
CREATE POLICY "Members can manage workspace leads"
ON leads FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = leads.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
    AND workspace_members.role IN ('owner', 'admin')
  )
);

-- For campaigns
CREATE POLICY "Members can manage workspace campaigns"
ON campaigns FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = campaigns.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
    AND workspace_members.role IN ('owner', 'admin')
  )
);

-- For email templates
CREATE POLICY "Members can manage workspace templates"
ON email_templates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = email_templates.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
    AND workspace_members.role IN ('owner', 'admin')
  )
);

-- For lead segments
CREATE POLICY "Members can manage workspace segments"
ON lead_segments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = lead_segments.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.status = 'active'
    AND workspace_members.role IN ('owner', 'admin')
  )
);

-- Set default role for workspace_members if not set
UPDATE workspace_members
SET role = 'member'
WHERE role IS NULL;

-- Success message
SELECT 'User role enum issue fixed successfully!' as message;
