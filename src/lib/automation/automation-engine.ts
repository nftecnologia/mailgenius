import { createSupabaseClient } from '@/lib/supabase'
import { createResendClient } from '@/lib/resend'
import { z } from 'zod'
import { advancedConditionEngine, AdvancedCondition, BranchingStep } from './advanced-conditions'

// Types for automation execution
export interface AutomationFlow {
  id: string
  name: string
  description: string
  trigger_type: string
  trigger_config: any
  flow_definition: {
    steps: AutomationStep[]
    version: string
  }
  status: 'draft' | 'active' | 'paused' | 'archived'
  workspace_id: string
}

export interface AutomationStep {
  id: string
  type: 'trigger' | 'condition' | 'action' | 'delay' | 'branching'
  name: string
  description: string
  config: any
  icon?: any
  color?: string
  // For branching steps
  next_steps?: string[]
  // For advanced conditions
  advanced_conditions?: AdvancedCondition[]
}

export interface AutomationRun {
  id: string
  automation_id: string
  lead_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  current_step_index: number
  execution_data: any
  started_at: Date
  completed_at?: Date
  error_message?: string
  retry_count: number
  max_retries: number
  next_execution_at?: Date
}

export interface ExecutionContext {
  lead: any
  automation: AutomationFlow
  run: AutomationRun
  variables: Record<string, any>
  workspace_id: string
}

export class AutomationEngine {
  private supabase = createSupabaseClient()
  private resend = createResendClient()

  // Main execution method
  async executeAutomation(automationId: string, leadId: string, triggerData?: any): Promise<AutomationRun> {
    try {
      // Get automation details
      const { data: automation, error: automationError } = await this.supabase
        .from('automation_flows')
        .select('*')
        .eq('id', automationId)
        .eq('status', 'active')
        .single()

      if (automationError || !automation) {
        throw new Error(`Automation not found or inactive: ${automationId}`)
      }

      // Get lead details
      const { data: lead, error: leadError } = await this.supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single()

      if (leadError || !lead) {
        throw new Error(`Lead not found: ${leadId}`)
      }

      // Create automation run
      const { data: run, error: runError } = await this.supabase
        .from('automation_runs')
        .insert({
          automation_id: automationId,
          lead_id: leadId,
          status: 'pending',
          current_step_index: 0,
          execution_data: triggerData || {},
          started_at: new Date().toISOString(),
          retry_count: 0,
          max_retries: 3
        })
        .select()
        .single()

      if (runError || !run) {
        throw new Error(`Failed to create automation run: ${runError?.message}`)
      }

      // Start execution
      await this.processAutomationRun(run.id)

      return run
    } catch (error) {
      console.error('Error executing automation:', error)
      throw error
    }
  }

  // Process automation run through its steps
  async processAutomationRun(runId: string): Promise<void> {
    try {
      // Get run details with automation and lead
      const { data: runData, error: runError } = await this.supabase
        .from('automation_runs')
        .select(`
          *,
          automation_flows (*),
          leads (*)
        `)
        .eq('id', runId)
        .single()

      if (runError || !runData) {
        throw new Error(`Run not found: ${runId}`)
      }

      const automation = runData.automation_flows as AutomationFlow
      const lead = runData.leads
      const steps = automation.flow_definition?.steps || []

      // Update run status to running
      await this.supabase
        .from('automation_runs')
        .update({ status: 'running' })
        .eq('id', runId)

      // Execute steps - now supports branching
      await this.executeStepsFromIndex(runId, runData, steps, lead, automation, runData.current_step_index)

      // Mark as completed
      await this.supabase
        .from('automation_runs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', runId)

    } catch (error) {
      console.error('Error processing automation run:', error)
      
      // Mark as failed
      await this.supabase
        .from('automation_runs')
        .update({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString()
        })
        .eq('id', runId)
      
      throw error
    }
  }

  // Execute steps from specific index with branching support
  private async executeStepsFromIndex(
    runId: string,
    runData: any,
    steps: AutomationStep[],
    lead: any,
    automation: AutomationFlow,
    startIndex: number
  ): Promise<void> {
    const stepsToExecute = this.getStepsToExecute(steps, startIndex)
    
    for (const stepIndex of stepsToExecute) {
      const step = steps[stepIndex]
      
      try {
        // Update current step
        await this.supabase
          .from('automation_runs')
          .update({ current_step_index: stepIndex })
          .eq('id', runId)

        // Execute step
        const stepResult = await this.executeStep(step, {
          lead,
          automation,
          run: runData,
          variables: runData.execution_data || {},
          workspace_id: automation.workspace_id
        })

        // Log step execution
        await this.logStepExecution(runId, step, stepResult)

        // Handle step result
        if (stepResult.shouldStop) {
          break
        }

        if (stepResult.delay) {
          // Schedule next execution
          const nextExecutionAt = new Date(Date.now() + stepResult.delay)
          await this.supabase
            .from('automation_runs')
            .update({ 
              next_execution_at: nextExecutionAt.toISOString(),
              current_step_index: stepIndex + 1
            })
            .eq('id', runId)
          
          return // Will be resumed later
        }

        // Handle branching
        if (stepResult.nextSteps) {
          // Execute branching steps
          for (const nextStepId of stepResult.nextSteps) {
            const nextStepIndex = steps.findIndex(s => s.id === nextStepId)
            if (nextStepIndex !== -1) {
              await this.executeStepsFromIndex(runId, runData, steps, lead, automation, nextStepIndex)
            }
          }
          break // Don't continue with sequential execution
        }

        // Update execution data with step results
        if (stepResult.data) {
          await this.supabase
            .from('automation_runs')
            .update({ 
              execution_data: {
                ...runData.execution_data,
                ...stepResult.data
              }
            })
            .eq('id', runId)
        }

      } catch (stepError) {
        console.error(`Error executing step ${stepIndex}:`, stepError)
        
        // Check if we should retry
        if (runData.retry_count < runData.max_retries) {
          await this.supabase
            .from('automation_runs')
            .update({ 
              retry_count: runData.retry_count + 1,
              error_message: stepError instanceof Error ? stepError.message : String(stepError)
            })
            .eq('id', runId)
          
          // Schedule retry
          const retryAt = new Date(Date.now() + (runData.retry_count + 1) * 60000) // Exponential backoff
          await this.supabase
            .from('automation_runs')
            .update({ next_execution_at: retryAt.toISOString() })
            .eq('id', runId)
          
          return
        } else {
          // Mark as failed
          await this.supabase
            .from('automation_runs')
            .update({ 
              status: 'failed',
              error_message: stepError instanceof Error ? stepError.message : String(stepError),
              completed_at: new Date().toISOString()
            })
            .eq('id', runId)
          
          throw stepError
        }
      }
    }
  }

  // Get steps to execute based on current index
  private getStepsToExecute(steps: AutomationStep[], startIndex: number): number[] {
    const stepsToExecute: number[] = []
    
    for (let i = startIndex; i < steps.length; i++) {
      stepsToExecute.push(i)
    }
    
    return stepsToExecute
  }

  // Execute individual step
  async executeStep(step: AutomationStep, context: ExecutionContext): Promise<{
    success: boolean
    data?: any
    delay?: number
    shouldStop?: boolean
    nextSteps?: string[]
  }> {
    switch (step.type) {
      case 'trigger':
        return this.executeTriggerStep(step, context)
      
      case 'condition':
        return this.executeConditionStep(step, context)
      
      case 'action':
        return this.executeActionStep(step, context)
      
      case 'delay':
        return this.executeDelayStep(step, context)
      
      case 'branching':
        return this.executeBranchingStep(step, context)
      
      default:
        throw new Error(`Unknown step type: ${step.type}`)
    }
  }

  // Execute trigger step
  private async executeTriggerStep(step: AutomationStep, context: ExecutionContext): Promise<any> {
    // Trigger steps are already processed when starting the automation
    return { success: true }
  }

  // Execute condition step
  private async executeConditionStep(step: AutomationStep, context: ExecutionContext): Promise<any> {
    const { config, advanced_conditions } = step
    const { lead } = context

    // Use advanced conditions if available
    if (advanced_conditions && advanced_conditions.length > 0) {
      const conditionResult = await advancedConditionEngine.evaluateConditions(advanced_conditions, context)
      
      if (!conditionResult) {
        return { success: false, shouldStop: true }
      }
      
      return { success: true, data: { condition_result: conditionResult } }
    }

    // Fallback to legacy condition logic
    switch (step.id) {
      case 'condition-tag':
        const hasTag = lead.tags?.includes(config.tag_name)
        const condition = config.condition || 'has_tag'
        
        if (condition === 'has_tag' && !hasTag) {
          return { success: false, shouldStop: true }
        }
        if (condition === 'not_has_tag' && hasTag) {
          return { success: false, shouldStop: true }
        }
        
        return { success: true }

      case 'condition-source':
        const sourceMatches = lead.source === config.source
        const operator = config.operator || 'equals'
        
        if (operator === 'equals' && !sourceMatches) {
          return { success: false, shouldStop: true }
        }
        if (operator === 'not_equals' && sourceMatches) {
          return { success: false, shouldStop: true }
        }
        
        return { success: true }

      default:
        console.warn(`Unknown condition step: ${step.id}`)
        return { success: true }
    }
  }

  // Execute action step
  private async executeActionStep(step: AutomationStep, context: ExecutionContext): Promise<any> {
    const { config } = step
    const { lead, workspace_id } = context

    switch (step.id) {
      case 'action-send-email':
        return this.sendEmail(config, lead, workspace_id)

      case 'action-add-tag':
        return this.addTagToLead(config, lead)

      case 'action-webhook':
        return this.callWebhook(config, lead, context)

      default:
        console.warn(`Unknown action step: ${step.id}`)
        return { success: true }
    }
  }

  // Execute branching step
  private async executeBranchingStep(step: AutomationStep, context: ExecutionContext): Promise<any> {
    try {
      const branchingStep = step as BranchingStep
      const result = await advancedConditionEngine.executeBranchingStep(branchingStep, context)
      
      if (!result.success) {
        return { success: false, shouldStop: true, data: result.data }
      }
      
      return { 
        success: true, 
        nextSteps: result.nextSteps,
        data: result.data
      }
    } catch (error) {
      console.error('Error executing branching step:', error)
      return { 
        success: false, 
        shouldStop: true, 
        data: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }

  // Execute delay step
  private async executeDelayStep(step: AutomationStep, context: ExecutionContext): Promise<any> {
    const { config } = step
    const amount = config.wait_amount || 1
    const unit = config.wait_unit || 'hours'

    let delayMs = 0
    switch (unit) {
      case 'minutes':
        delayMs = amount * 60 * 1000
        break
      case 'hours':
        delayMs = amount * 60 * 60 * 1000
        break
      case 'days':
        delayMs = amount * 24 * 60 * 60 * 1000
        break
      case 'weeks':
        delayMs = amount * 7 * 24 * 60 * 60 * 1000
        break
      default:
        delayMs = amount * 60 * 60 * 1000 // Default to hours
    }

    return { success: true, delay: delayMs }
  }

  // Send email action
  private async sendEmail(config: any, lead: any, workspaceId: string): Promise<any> {
    try {
      // Get template if specified
      let htmlContent = ''
      let textContent = ''
      let subject = config.subject || 'Email from automation'

      if (config.template_id) {
        const { data: template } = await this.supabase
          .from('email_templates')
          .select('*')
          .eq('id', config.template_id)
          .eq('workspace_id', workspaceId)
          .single()

        if (template) {
          htmlContent = template.html_content
          textContent = template.text_content
          subject = template.subject
        }
      }

      // Replace variables
      const variables = {
        name: lead.name || '',
        email: lead.email || '',
        company: lead.company || '',
        ...config.variables
      }

      subject = this.replaceVariables(subject, variables)
      htmlContent = this.replaceVariables(htmlContent, variables)
      textContent = this.replaceVariables(textContent, variables)

      // Send email via Resend
      const result = await this.resend.emails.send({
        from: `${config.from_name || 'MailGenius'} <noreply@mailgenius.com>`,
        to: lead.email,
        subject,
        html: htmlContent,
        text: textContent
      })

      return { 
        success: true, 
        data: { 
          email_id: result.data?.id,
          sent_at: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Error sending email:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Add tag to lead
  private async addTagToLead(config: any, lead: any): Promise<any> {
    try {
      const currentTags = lead.tags || []
      const newTag = config.tag_name

      if (!currentTags.includes(newTag)) {
        const updatedTags = [...currentTags, newTag]
        
        const { error } = await this.supabase
          .from('leads')
          .update({ tags: updatedTags })
          .eq('id', lead.id)

        if (error) {
          throw error
        }
      }

      return { success: true, data: { tag_added: newTag } }
    } catch (error) {
      console.error('Error adding tag to lead:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Call webhook
  private async callWebhook(config: any, lead: any, context: ExecutionContext): Promise<any> {
    try {
      const url = config.webhook_url
      const method = config.webhook_method || 'POST'
      const headers = config.webhook_headers ? JSON.parse(config.webhook_headers) : {}

      const payload = {
        lead,
        automation: {
          id: context.automation.id,
          name: context.automation.name
        },
        execution_data: context.run.execution_data,
        timestamp: new Date().toISOString()
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }

      const responseData = await response.json()

      return { 
        success: true, 
        data: { 
          webhook_response: responseData,
          webhook_status: response.status
        }
      }
    } catch (error) {
      console.error('Error calling webhook:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Log step execution
  private async logStepExecution(runId: string, step: AutomationStep, result: any): Promise<void> {
    try {
      await this.supabase
        .from('automation_step_executions')
        .insert({
          automation_run_id: runId,
          step_id: step.id,
          step_type: step.type,
          executed_at: new Date().toISOString(),
          result_data: result,
          status: result.success ? 'completed' : 'failed',
          error_message: result.error || null
        })
    } catch (error) {
      console.error('Error logging step execution:', error)
    }
  }

  // Replace variables in text
  private replaceVariables(text: string, variables: Record<string, any>): string {
    if (!text) return ''
    
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match
    })
  }

  // Trigger automation for new leads
  async triggerForNewLead(leadId: string, workspaceId: string): Promise<void> {
    try {
      // Find all active automations with new_lead trigger
      const { data: automations, error } = await this.supabase
        .from('automation_flows')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .eq('trigger_type', 'new_lead')

      if (error) {
        throw error
      }

      // Execute each automation
      for (const automation of automations || []) {
        try {
          await this.executeAutomation(automation.id, leadId, {
            trigger: 'new_lead',
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          console.error(`Error executing automation ${automation.id}:`, error)
        }
      }
    } catch (error) {
      console.error('Error triggering automations for new lead:', error)
    }
  }

  // Process scheduled runs
  async processScheduledRuns(): Promise<void> {
    try {
      // Get all runs that should be executed now
      const { data: runs, error } = await this.supabase
        .from('automation_runs')
        .select('id')
        .eq('status', 'pending')
        .not('next_execution_at', 'is', null)
        .lte('next_execution_at', new Date().toISOString())

      if (error) {
        throw error
      }

      // Process each run
      for (const run of runs || []) {
        try {
          await this.processAutomationRun(run.id)
        } catch (error) {
          console.error(`Error processing scheduled run ${run.id}:`, error)
        }
      }
    } catch (error) {
      console.error('Error processing scheduled runs:', error)
    }
  }
}

export const automationEngine = new AutomationEngine()