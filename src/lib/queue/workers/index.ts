import { queueManager } from '../index'
import { leadsImportService } from '../jobs/leads-import'
import { emailSendingService } from '../jobs/email-sending'

export class WorkerManager {
  private static instance: WorkerManager
  private workers: Map<string, any> = new Map()
  private isRunning: boolean = false

  private constructor() {}

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager()
    }
    return WorkerManager.instance
  }

  async startWorkers(): Promise<void> {
    if (this.isRunning) {
      console.log('Workers already running')
      return
    }

    try {
      // Initialize queue manager
      await queueManager.initialize()

      // Start all worker services
      console.log('🚀 Starting queue workers...')
      
      // Initialize leads import service
      const leadsImportQueue = leadsImportService.getQueue()
      this.workers.set('leads-import', leadsImportQueue)
      
      // Initialize email sending service
      const emailSendingQueue = emailSendingService.getQueue()
      this.workers.set('email-sending', emailSendingQueue)

      this.isRunning = true
      console.log('✅ All queue workers started successfully')
    } catch (error) {
      console.error('❌ Failed to start workers:', error)
      throw error
    }
  }

  async stopWorkers(): Promise<void> {
    if (!this.isRunning) {
      console.log('Workers already stopped')
      return
    }

    console.log('🛑 Stopping queue workers...')
    
    try {
      // Close all queues
      await queueManager.closeAll()
      this.workers.clear()
      this.isRunning = false
      
      console.log('✅ All queue workers stopped successfully')
    } catch (error) {
      console.error('❌ Failed to stop workers:', error)
      throw error
    }
  }

  async restartWorkers(): Promise<void> {
    await this.stopWorkers()
    await this.startWorkers()
  }

  getWorkerStatus(): {
    isRunning: boolean
    workers: Array<{
      name: string
      status: string
    }>
  } {
    return {
      isRunning: this.isRunning,
      workers: Array.from(this.workers.entries()).map(([name, queue]) => ({
        name,
        status: queue.client.status,
      })),
    }
  }

  async getWorkerStats(): Promise<{
    [key: string]: {
      waiting: number
      active: number
      completed: number
      failed: number
      delayed: number
    }
  }> {
    const stats: any = {}
    
    for (const [name] of this.workers) {
      try {
        stats[name] = await queueManager.getQueueStats(name)
      } catch (error) {
        console.error(`Failed to get stats for ${name}:`, error)
        stats[name] = {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        }
      }
    }
    
    return stats
  }

  async pauseWorker(workerName: string): Promise<boolean> {
    try {
      await queueManager.pauseQueue(workerName)
      return true
    } catch (error) {
      console.error(`Failed to pause worker ${workerName}:`, error)
      return false
    }
  }

  async resumeWorker(workerName: string): Promise<boolean> {
    try {
      await queueManager.resumeQueue(workerName)
      return true
    } catch (error) {
      console.error(`Failed to resume worker ${workerName}:`, error)
      return false
    }
  }

  async cleanWorkerQueue(workerName: string, grace: number = 0): Promise<boolean> {
    try {
      await queueManager.cleanQueue(workerName, grace)
      return true
    } catch (error) {
      console.error(`Failed to clean worker queue ${workerName}:`, error)
      return false
    }
  }
}

export const workerManager = WorkerManager.getInstance()

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...')
  await workerManager.stopWorkers()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  await workerManager.stopWorkers()
  process.exit(0)
})

// Start workers if running in production or worker mode
if (process.env.NODE_ENV === 'production' || process.env.START_WORKERS === 'true') {
  workerManager.startWorkers().catch(console.error)
}