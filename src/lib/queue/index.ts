import Bull from 'bull'
import { redisManager } from '../redis'

export interface QueueConfig {
  name: string
  concurrency: number
  removeOnComplete?: number
  removeOnFail?: number
  defaultJobOptions?: {
    removeOnComplete?: number
    removeOnFail?: number
    delay?: number
    attempts?: number
    backoff?: Bull.BackoffOptions
  }
}

export interface JobProgress {
  percentage: number
  message: string
  data?: any
}

export interface JobResult {
  success: boolean
  data?: any
  error?: string
}

export class QueueManager {
  private static instance: QueueManager
  private queues: Map<string, Bull.Queue> = new Map()
  private isInitialized: boolean = false

  private constructor() {}

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager()
    }
    return QueueManager.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Ensure Redis is connected
      await redisManager.connect()
      
      const redisClient = redisManager.getClient()
      if (!redisClient) {
        throw new Error('Redis client not available')
      }

      console.log('✅ Queue system initialized successfully')
      this.isInitialized = true
    } catch (error) {
      console.error('❌ Failed to initialize queue system:', error)
      throw error
    }
  }

  createQueue(config: QueueConfig): Bull.Queue {
    if (this.queues.has(config.name)) {
      return this.queues.get(config.name)!
    }

    const redisClient = redisManager.getClient()
    if (!redisClient) {
      throw new Error('Redis client not available')
    }

    const queue = new Bull(config.name, {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      },
      defaultJobOptions: {
        removeOnComplete: config.removeOnComplete || 10,
        removeOnFail: config.removeOnFail || 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...config.defaultJobOptions,
      },
    })

    // Configure queue events
    queue.on('error', (error) => {
      console.error(`❌ Queue ${config.name} error:`, error)
    })

    queue.on('waiting', (jobId) => {
      console.log(`⏳ Job ${jobId} waiting in queue ${config.name}`)
    })

    queue.on('active', (job) => {
      console.log(`🔄 Job ${job.id} started processing in queue ${config.name}`)
    })

    queue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed in queue ${config.name}`)
    })

    queue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} failed in queue ${config.name}:`, err.message)
    })

    queue.on('stalled', (job) => {
      console.warn(`⚠️  Job ${job.id} stalled in queue ${config.name}`)
    })

    this.queues.set(config.name, queue)
    return queue
  }

  getQueue(name: string): Bull.Queue | undefined {
    return this.queues.get(name)
  }

  async getQueueStats(name: string): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }> {
    const queue = this.getQueue(name)
    if (!queue) {
      throw new Error(`Queue ${name} not found`)
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    }
  }

  async pauseQueue(name: string): Promise<void> {
    const queue = this.getQueue(name)
    if (!queue) {
      throw new Error(`Queue ${name} not found`)
    }
    await queue.pause()
  }

  async resumeQueue(name: string): Promise<void> {
    const queue = this.getQueue(name)
    if (!queue) {
      throw new Error(`Queue ${name} not found`)
    }
    await queue.resume()
  }

  async cleanQueue(name: string, grace: number = 0): Promise<void> {
    const queue = this.getQueue(name)
    if (!queue) {
      throw new Error(`Queue ${name} not found`)
    }

    await Promise.all([
      queue.clean(grace, 'completed'),
      queue.clean(grace, 'failed'),
      queue.clean(grace, 'active'),
      queue.clean(grace, 'waiting'),
    ])
  }

  async closeAll(): Promise<void> {
    const promises = Array.from(this.queues.values()).map(queue => queue.close())
    await Promise.all(promises)
    this.queues.clear()
    this.isInitialized = false
  }

  async getJobById(queueName: string, jobId: string): Promise<Bull.Job | null> {
    const queue = this.getQueue(queueName)
    if (!queue) {
      return null
    }
    return queue.getJob(jobId)
  }

  async retryJob(queueName: string, jobId: string): Promise<boolean> {
    const job = await this.getJobById(queueName, jobId)
    if (!job) {
      return false
    }

    try {
      await job.retry()
      return true
    } catch (error) {
      console.error(`Failed to retry job ${jobId}:`, error)
      return false
    }
  }

  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const job = await this.getJobById(queueName, jobId)
    if (!job) {
      return false
    }

    try {
      await job.remove()
      return true
    } catch (error) {
      console.error(`Failed to remove job ${jobId}:`, error)
      return false
    }
  }
}

export const queueManager = QueueManager.getInstance()