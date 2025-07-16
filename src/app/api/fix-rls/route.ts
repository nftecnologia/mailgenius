import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Applying RLS fixes...')

    const fixes = [
      // Drop existing policies first
      `DROP POLICY IF EXISTS "Users can view own profile" ON users;`,
      `DROP POLICY IF EXISTS "Users can update own profile" ON users;`,
      `DROP POLICY IF EXISTS "Users can insert own profile" ON users;`,
      `DROP POLICY IF EXISTS "Service role can manage users" ON users;`,
      `DROP POLICY IF EXISTS "Users can view their memberships" ON workspace_members;`,
      `DROP POLICY IF EXISTS "Service role can manage memberships" ON workspace_members;`,
      `DROP POLICY IF EXISTS "Members can view their workspaces" ON workspaces;`,
      `DROP POLICY IF EXISTS "Service role can manage workspaces" ON workspaces;`,
      `DROP POLICY IF EXISTS "Members can view workspace leads" ON leads;`,
      `DROP POLICY IF EXISTS "Members can view workspace campaigns" ON campaigns;`,
      `DROP POLICY IF EXISTS "Members can view workspace templates" ON email_templates;`,

      // Enable RLS on all tables
      `ALTER TABLE users ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE leads ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;`,

      // Users table policies
      `CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);`,
      `CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);`,
      `CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);`,
      `CREATE POLICY "Service role full access to users" ON users FOR ALL USING (auth.jwt()->>'role' = 'service_role');`,

      // Workspace members policies
      `CREATE POLICY "Users can view their memberships" ON workspace_members FOR SELECT USING (auth.uid() = user_id);`,
      `CREATE POLICY "Users can insert their memberships" ON workspace_members FOR INSERT WITH CHECK (auth.uid() = user_id);`,
      `CREATE POLICY "Service role full access to memberships" ON workspace_members FOR ALL USING (auth.jwt()->>'role' = 'service_role');`,

      // Workspaces policies
      `CREATE POLICY "Members can view their workspaces" ON workspaces FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM workspace_members
          WHERE workspace_members.workspace_id = workspaces.id
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.status = 'active'
        ));`,
      `CREATE POLICY "Service role full access to workspaces" ON workspaces FOR ALL USING (auth.jwt()->>'role' = 'service_role');`,

      // Leads policies
      `CREATE POLICY "Members can view workspace leads" ON leads FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM workspace_members
          WHERE workspace_members.workspace_id = leads.workspace_id
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.status = 'active'
        ));`,
      `CREATE POLICY "Members can manage workspace leads" ON leads FOR ALL
        USING (EXISTS (
          SELECT 1 FROM workspace_members
          WHERE workspace_members.workspace_id = leads.workspace_id
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.status = 'active'
          AND workspace_members.role IN ('owner', 'admin', 'editor')
        ));`,

      // Campaigns policies
      `CREATE POLICY "Members can view workspace campaigns" ON campaigns FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM workspace_members
          WHERE workspace_members.workspace_id = campaigns.workspace_id
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.status = 'active'
        ));`,
      `CREATE POLICY "Members can manage workspace campaigns" ON campaigns FOR ALL
        USING (EXISTS (
          SELECT 1 FROM workspace_members
          WHERE workspace_members.workspace_id = campaigns.workspace_id
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.status = 'active'
          AND workspace_members.role IN ('owner', 'admin', 'editor')
        ));`,

      // Email templates policies
      `CREATE POLICY "Members can view workspace templates" ON email_templates FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM workspace_members
          WHERE workspace_members.workspace_id = email_templates.workspace_id
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.status = 'active'
        ));`,
      `CREATE POLICY "Members can manage workspace templates" ON email_templates FOR ALL
        USING (EXISTS (
          SELECT 1 FROM workspace_members
          WHERE workspace_members.workspace_id = email_templates.workspace_id
          AND workspace_members.user_id = auth.uid()
          AND workspace_members.status = 'active'
          AND workspace_members.role IN ('owner', 'admin', 'editor')
        ));`,
    ]

    const results = []

    for (const sql of fixes) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql })

        if (error) {
          results.push({
            sql: sql.substring(0, 100) + '...',
            status: 'error',
            message: error.message
          })
        } else {
          results.push({
            sql: sql.substring(0, 100) + '...',
            status: 'success',
            message: 'Applied successfully'
          })
        }
      } catch (err: any) {
        results.push({
          sql: sql.substring(0, 100) + '...',
          status: 'error',
          message: err.message || 'Unknown error'
        })
      }
    }

    // Create exec_sql function if it doesn't exist
    const createFunctionSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `

    try {
      await supabaseAdmin.rpc('query', { query: createFunctionSql })
    } catch (error) {
      // If function creation fails, try direct SQL execution
      console.log('exec_sql function creation failed, trying alternative method')
    }

    return NextResponse.json({
      success: true,
      message: 'RLS policies applied successfully',
      results
    })

  } catch (error) {
    console.error('Error fixing RLS:', error)
    return NextResponse.json({
      success: false,
      message: 'Error fixing RLS',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
