import { NextRequest, NextResponse } from 'next/server'
import { automationEngine } from '@/lib/automation/automation-engine'
import { createSupabaseClient } from '@/lib/supabase'
import { z } from 'zod'

const ExecuteAutomationSchema = z.object({
  automation_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  trigger_data: z.any().optional()
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const validatedData = ExecuteAutomationSchema.parse(body)

    // Get user's workspace
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Verify automation belongs to user's workspace
    const { data: automation, error: automationError } = await supabase
      .from('automation_flows')
      .select('id, workspace_id, name, status')
      .eq('id', validatedData.automation_id)
      .eq('workspace_id', member.workspace_id)
      .single()

    if (automationError || !automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    if (automation.status !== 'active') {
      return NextResponse.json({ error: 'Automation is not active' }, { status: 400 })
    }

    // Verify lead belongs to user's workspace
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, workspace_id, email, name')
      .eq('id', validatedData.lead_id)
      .eq('workspace_id', member.workspace_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Execute automation
    const run = await automationEngine.executeAutomation(
      validatedData.automation_id,
      validatedData.lead_id,
      validatedData.trigger_data
    )

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        status: run.status,
        started_at: run.started_at
      }
    })
  } catch (error) {
    console.error('Error executing automation:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to execute automation' },
      { status: 500 }
    )
  }
}

// Get automation execution status
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')

    if (!runId) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Get run details
    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .select(`
        *,
        automation_flows!inner (
          id,
          name,
          workspace_id
        ),
        leads!inner (
          id,
          name,
          email
        )
      `)
      .eq('id', runId)
      .eq('automation_flows.workspace_id', member.workspace_id)
      .single()

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    // Get step executions
    const { data: stepExecutions, error: stepError } = await supabase
      .from('automation_step_executions')
      .select('*')
      .eq('automation_run_id', runId)
      .order('executed_at', { ascending: true })

    return NextResponse.json({
      run: {
        id: run.id,
        automation_id: run.automation_id,
        automation_name: run.automation_flows.name,
        lead_id: run.lead_id,
        lead_name: run.leads.name,
        lead_email: run.leads.email,
        status: run.status,
        current_step_index: run.current_step_index,
        started_at: run.started_at,
        completed_at: run.completed_at,
        error_message: run.error_message,
        retry_count: run.retry_count,
        next_execution_at: run.next_execution_at,
        execution_data: run.execution_data
      },
      step_executions: stepExecutions || []
    })
  } catch (error) {
    console.error('Error getting automation run:', error)
    return NextResponse.json(
      { error: 'Failed to get automation run' },
      { status: 500 }
    )
  }
}