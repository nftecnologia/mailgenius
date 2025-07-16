import { redisManager } from '../redis'
import { supabase } from '../supabase'

export interface ProgressData {
  id: string
  type: 'leads-import' | 'email-sending' | 'campaign-processing'
  userId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number // 0-100
  totalItems: number
  processedItems: number
  failedItems: number
  message: string
  startTime: number
  endTime?: number
  metadata?: Record<string, any>
  errors?: string[]
}

export interface ProgressUpdate {
  progress?: number
  processedItems?: number
  failedItems?: number
  message?: string
  status?: ProgressData['status']
  metadata?: Record<string, any>
  errors?: string[]
}

export class ProgressTracker {
  private static instance: ProgressTracker
  private readonly PROGRESS_TTL = 3600 // 1 hour
  private readonly PROGRESS_KEY_PREFIX = 'progress:'

  private constructor() {}

  static getInstance(): ProgressTracker {
    if (!ProgressTracker.instance) {
      ProgressTracker.instance = new ProgressTracker()
    }
    return ProgressTracker.instance
  }

  async createProgress(
    id: string,
    type: ProgressData['type'],
    userId: string,
    totalItems: number,
    metadata?: Record<string, any>
  ): Promise<ProgressData> {
    const progressData: ProgressData = {
      id,
      type,
      userId,
      status: 'pending',
      progress: 0,
      totalItems,
      processedItems: 0,
      failedItems: 0,
      message: 'Starting...',
      startTime: Date.now(),
      metadata,
    }

    await this.saveProgress(progressData)
    return progressData
  }

  async updateProgress(id: string, update: ProgressUpdate): Promise<ProgressData | null> {
    const currentProgress = await this.getProgress(id)
    if (!currentProgress) {
      return null
    }

    const updatedProgress: ProgressData = {
      ...currentProgress,
      ...update,
    }

    // Auto-calculate progress if not provided
    if (update.progress === undefined && updatedProgress.totalItems > 0) {
      updatedProgress.progress = Math.round(
        ((updatedProgress.processedItems + updatedProgress.failedItems) / updatedProgress.totalItems) * 100
      )
    }

    // Set end time if completed or failed
    if (update.status === 'completed' || update.status === 'failed') {
      updatedProgress.endTime = Date.now()
    }

    await this.saveProgress(updatedProgress)
    
    // Broadcast progress update
    await this.broadcastProgress(updatedProgress)
    
    return updatedProgress
  }

  async getProgress(id: string): Promise<ProgressData | null> {
    try {
      const redis = redisManager.getClient()
      if (!redis) {
        return this.getProgressFromDatabase(id)
      }

      const key = `${this.PROGRESS_KEY_PREFIX}${id}`
      const data = await redis.get(key)
      
      if (!data) {
        return this.getProgressFromDatabase(id)
      }

      return JSON.parse(data)
    } catch (error) {
      console.error('Failed to get progress:', error)
      return null
    }
  }

  private async getProgressFromDatabase(id: string): Promise<ProgressData | null> {
    try {
      const { data, error } = await supabase
        .from('progress_tracking')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        return null
      }

      return {
        id: data.id,
        type: data.type,
        userId: data.user_id,
        status: data.status,
        progress: data.progress,
        totalItems: data.total_items,
        processedItems: data.processed_items,
        failedItems: data.failed_items,
        message: data.message,
        startTime: new Date(data.start_time).getTime(),
        endTime: data.end_time ? new Date(data.end_time).getTime() : undefined,
        metadata: data.metadata,
        errors: data.errors,
      }
    } catch (error) {
      console.error('Failed to get progress from database:', error)
      return null
    }
  }

  private async saveProgress(progressData: ProgressData): Promise<void> {
    try {
      const redis = redisManager.getClient()
      
      // Save to Redis for fast access
      if (redis) {
        const key = `${this.PROGRESS_KEY_PREFIX}${progressData.id}`
        await redis.setex(key, this.PROGRESS_TTL, JSON.stringify(progressData))
      }

      // Save to database for persistence
      await supabase
        .from('progress_tracking')
        .upsert({
          id: progressData.id,
          type: progressData.type,
          user_id: progressData.userId,
          status: progressData.status,
          progress: progressData.progress,
          total_items: progressData.totalItems,
          processed_items: progressData.processedItems,
          failed_items: progressData.failedItems,
          message: progressData.message,
          start_time: new Date(progressData.startTime).toISOString(),
          end_time: progressData.endTime ? new Date(progressData.endTime).toISOString() : null,
          metadata: progressData.metadata,
          errors: progressData.errors,
          updated_at: new Date().toISOString(),
        })
    } catch (error) {
      console.error('Failed to save progress:', error)
    }
  }

  async getUserProgress(userId: string): Promise<ProgressData[]> {
    try {
      const { data, error } = await supabase
        .from('progress_tracking')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Failed to get user progress:', error)
        return []
      }

      return data.map(item => ({
        id: item.id,
        type: item.type,
        userId: item.user_id,
        status: item.status,
        progress: item.progress,
        totalItems: item.total_items,
        processedItems: item.processed_items,
        failedItems: item.failed_items,
        message: item.message,
        startTime: new Date(item.start_time).getTime(),
        endTime: item.end_time ? new Date(item.end_time).getTime() : undefined,
        metadata: item.metadata,
        errors: item.errors,
      }))
    } catch (error) {
      console.error('Failed to get user progress:', error)
      return []
    }
  }

  async deleteProgress(id: string): Promise<boolean> {
    try {
      const redis = redisManager.getClient()
      
      // Delete from Redis
      if (redis) {
        const key = `${this.PROGRESS_KEY_PREFIX}${id}`
        await redis.del(key)
      }

      // Delete from database
      const { error } = await supabase
        .from('progress_tracking')
        .delete()
        .eq('id', id)

      return !error
    } catch (error) {
      console.error('Failed to delete progress:', error)
      return false
    }
  }

  async cleanupOldProgress(maxAge: number = 86400000): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - maxAge).toISOString()
      
      const { data, error } = await supabase
        .from('progress_tracking')
        .delete()
        .lt('start_time', cutoffTime)
        .select('id')

      if (error) {
        console.error('Failed to cleanup old progress:', error)
        return 0
      }

      return data.length
    } catch (error) {
      console.error('Failed to cleanup old progress:', error)
      return 0
    }
  }

  private async broadcastProgress(progressData: ProgressData): Promise<void> {
    try {
      const redis = redisManager.getClient()
      if (!redis) {
        return
      }

      // Publish to Redis channel for real-time updates
      const channel = `progress:${progressData.userId}`
      await redis.publish(channel, JSON.stringify(progressData))
    } catch (error) {
      console.error('Failed to broadcast progress:', error)
    }
  }

  async subscribeToProgress(userId: string, callback: (progress: ProgressData) => void): Promise<() => void> {
    const redis = redisManager.getClient()
    if (!redis) {
      throw new Error('Redis not available for subscriptions')
    }

    const subscriber = redis.duplicate()
    const channel = `progress:${userId}`
    
    await subscriber.subscribe(channel)
    
    subscriber.on('message', (channel, message) => {
      try {
        const progressData = JSON.parse(message)
        callback(progressData)
      } catch (error) {
        console.error('Failed to parse progress message:', error)
      }
    })

    // Return unsubscribe function
    return async () => {
      await subscriber.unsubscribe(channel)
      await subscriber.quit()
    }
  }

  async getProgressStats(userId: string): Promise<{
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
    cancelled: number
  }> {
    try {
      const { data, error } = await supabase
        .from('progress_tracking')
        .select('status')
        .eq('user_id', userId)

      if (error) {
        console.error('Failed to get progress stats:', error)
        return {
          total: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        }
      }

      const stats = {
        total: data.length,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      }

      data.forEach(item => {
        stats[item.status as keyof typeof stats]++
      })

      return stats
    } catch (error) {
      console.error('Failed to get progress stats:', error)
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      }
    }
  }
}

export const progressTracker = ProgressTracker.getInstance()

// Cleanup old progress entries daily
setInterval(() => {
  progressTracker.cleanupOldProgress(86400000 * 7) // 7 days
}, 86400000) // Every 24 hours