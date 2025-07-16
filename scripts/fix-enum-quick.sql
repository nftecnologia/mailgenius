-- Quick Fix for User Role ENUM Error
-- Run this BEFORE running other scripts if you get enum errors

-- Convert role column from ENUM to VARCHAR
ALTER TABLE workspace_members
ALTER COLUMN role TYPE VARCHAR(50)
USING role::text;

-- Add constraint to ensure valid values
ALTER TABLE workspace_members
DROP CONSTRAINT IF EXISTS check_valid_role;

ALTER TABLE workspace_members
ADD CONSTRAINT check_valid_role
CHECK (role IN ('owner', 'admin', 'member', 'viewer'));

-- Set default role where NULL
UPDATE workspace_members
SET role = 'member'
WHERE role IS NULL;

-- Success
SELECT 'Role column fixed! Now you can run the main fix scripts.' as message;
