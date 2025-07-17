import { NextRequest, NextResponse } from 'next/server'
import { automationEngine } from './automation-engine'

export class AutomationMiddleware {
  private static instance: AutomationMiddleware
  private processingIntervals: Map<string, NodeJS.Timeout> = new Map()

  private constructor() {}

  static getInstance(): AutomationMiddleware {
    if (!AutomationMiddleware.instance) {
      AutomationMiddleware.instance = new AutomationMiddleware()
    }
    return AutomationMiddleware.instance
  }

  // Start background processing
  startBackgroundProcessing(): void {
    // Process scheduled runs every 30 seconds
    const scheduledInterval = setInterval(async () => {
      try {
        await automationEngine.processScheduledRuns()
      } catch (error) {
        console.error('Error processing scheduled automation runs:', error)
      }
    }, 30000)

    this.processingIntervals.set('scheduled', scheduledInterval)
    
    console.log('Automation background processing started')
  }

  // Stop background processing
  stopBackgroundProcessing(): void {
    this.processingIntervals.forEach((interval, key) => {
      clearInterval(interval)
      this.processingIntervals.delete(key)
    })
    
    console.log('Automation background processing stopped')
  }

  // Process automation triggers for new leads
  async processNewLeadTrigger(leadId: string, workspaceId: string): Promise<void> {
    try {
      await automationEngine.triggerForNewLead(leadId, workspaceId)
    } catch (error) {
      console.error('Error processing new lead trigger:', error)
    }
  }

  // Process webhook triggers
  async processWebhookTrigger(webhookData: any): Promise<void> {
    try {
      // Implementation depends on webhook structure
      // This is a placeholder for webhook processing
      console.log('Webhook trigger received:', webhookData)
    } catch (error) {
      console.error('Error processing webhook trigger:', error)
    }
  }

  // Health check for automation system
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: {
      background_processing: boolean
      scheduled_runs_count: number
      active_automations_count: number
      failed_runs_count: number
    }
  }> {
    try {
      const backgroundProcessing = this.processingIntervals.size > 0
      
      // These would be implemented with actual database queries
      const scheduledRunsCount = 0 // TODO: Query scheduled runs
      const activeAutomationsCount = 0 // TODO: Query active automations
      const failedRunsCount = 0 // TODO: Query failed runs in last hour

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      
      if (!backgroundProcessing) {
        status = 'unhealthy'
      } else if (failedRunsCount > 10) {
        status = 'degraded'
      }

      return {
        status,
        details: {
          background_processing: backgroundProcessing,
          scheduled_runs_count: scheduledRunsCount,
          active_automations_count: activeAutomationsCount,
          failed_runs_count: failedRunsCount
        }
      }
    } catch (error) {
      console.error('Error in automation health check:', error)
      return {
        status: 'unhealthy',
        details: {
          background_processing: false,
          scheduled_runs_count: 0,
          active_automations_count: 0,
          failed_runs_count: 0
        }
      }
    }
  }
}

// Initialize middleware
export const automationMiddleware = AutomationMiddleware.getInstance()

// Auto-start background processing in production
if (process.env.NODE_ENV === 'production') {
  automationMiddleware.startBackgroundProcessing()
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping automation processing...')
  automationMiddleware.stopBackgroundProcessing()
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping automation processing...')
  automationMiddleware.stopBackgroundProcessing()
})