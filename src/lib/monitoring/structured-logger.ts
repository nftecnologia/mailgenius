import { logger } from '../logger'
import { redisManager } from '../redis'

export interface LogEntry {
  id: string
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  service: string
  component: string
  traceId?: string
  spanId?: string
  userId?: string
  sessionId?: string
  requestId?: string
  metadata: Record<string, any>
  tags: string[]
  duration?: number
  error?: {
    name: string
    message: string
    stack: string
  }
}

export interface LogQuery {
  level?: 'debug' | 'info' | 'warn' | 'error'
  service?: string
  component?: string
  traceId?: string
  userId?: string
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
  search?: string
  tags?: string[]
}

export interface LogStats {
  total: number
  byLevel: Record<string, number>
  byService: Record<string, number>
  byComponent: Record<string, number>
  errorRate: number
  topErrors: Array<{
    error: string
    count: number
    lastSeen: number
  }>
  timeRange: {
    start: number
    end: number
  }
}

class StructuredLogger {
  private readonly maxLogEntries = 10000
  private readonly logRetentionHours = 24
  private sequenceCounter = 0

  private generateId(): string {
    return `${Date.now()}-${this.sequenceCounter++}`
  }

  async log(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...entry
    }

    try {
      const redis = redisManager.getClient()
      if (redis) {
        // Store in Redis list for fast retrieval
        const key = `logs:${entry.service}:${entry.component}`
        await redis.lpush(key, JSON.stringify(logEntry))
        await redis.ltrim(key, 0, this.maxLogEntries - 1)
        await redis.expire(key, this.logRetentionHours * 3600)

        // Store in main log stream
        await redis.lpush('logs:stream', JSON.stringify(logEntry))
        await redis.ltrim('logs:stream', 0, this.maxLogEntries - 1)
        await redis.expire('logs:stream', this.logRetentionHours * 3600)

        // Index by level
        await redis.lpush(`logs:level:${entry.level}`, JSON.stringify(logEntry))
        await redis.ltrim(`logs:level:${entry.level}`, 0, this.maxLogEntries - 1)
        await redis.expire(`logs:level:${entry.level}`, this.logRetentionHours * 3600)

        // Index by trace ID if present
        if (entry.traceId) {
          await redis.lpush(`logs:trace:${entry.traceId}`, JSON.stringify(logEntry))
          await redis.expire(`logs:trace:${entry.traceId}`, this.logRetentionHours * 3600)
        }

        // Index by user ID if present
        if (entry.userId) {
          await redis.lpush(`logs:user:${entry.userId}`, JSON.stringify(logEntry))
          await redis.ltrim(`logs:user:${entry.userId}`, 0, 1000) // Limit user logs
          await redis.expire(`logs:user:${entry.userId}`, this.logRetentionHours * 3600)
        }

        // Update statistics
        await this.updateLogStats(logEntry)
      }

      // Also log to standard logger
      const logData = {
        service: entry.service,
        component: entry.component,
        traceId: entry.traceId,
        spanId: entry.spanId,
        userId: entry.userId,
        sessionId: entry.sessionId,
        requestId: entry.requestId,
        metadata: entry.metadata,
        tags: entry.tags,
        duration: entry.duration,
        error: entry.error
      }

      switch (entry.level) {
        case 'debug':
          logger.debug(entry.message, logData)
          break
        case 'info':
          logger.info(entry.message, logData)
          break
        case 'warn':
          logger.warn(entry.message, logData)
          break
        case 'error':
          logger.error(entry.message, logData)
          break
      }

    } catch (error) {
      console.error('Failed to store structured log:', error)
    }
  }

  private async updateLogStats(entry: LogEntry): Promise<void> {
    try {
      const redis = redisManager.getClient()
      if (!redis) return

      const statsKey = 'logs:stats'
      const now = Date.now()
      const hour = Math.floor(now / (60 * 60 * 1000))

      // Update counters
      await redis.hincrby(statsKey, 'total', 1)
      await redis.hincrby(statsKey, `level:${entry.level}`, 1)
      await redis.hincrby(statsKey, `service:${entry.service}`, 1)
      await redis.hincrby(statsKey, `component:${entry.component}`, 1)
      await redis.hincrby(statsKey, `hour:${hour}`, 1)

      // Track errors
      if (entry.level === 'error' && entry.error) {
        const errorKey = `logs:errors:${entry.error.name}`
        await redis.hincrby(errorKey, 'count', 1)
        await redis.hset(errorKey, 'lastSeen', now)
        await redis.hset(errorKey, 'message', entry.error.message)
        await redis.expire(errorKey, this.logRetentionHours * 3600)
      }

      // Set expiration
      await redis.expire(statsKey, this.logRetentionHours * 3600)

    } catch (error) {
      console.error('Failed to update log stats:', error)
    }
  }

  async query(query: LogQuery): Promise<LogEntry[]> {
    try {
      const redis = redisManager.getClient()
      if (!redis) return []

      let key = 'logs:stream'
      
      // Use more specific index if available
      if (query.traceId) {
        key = `logs:trace:${query.traceId}`
      } else if (query.level) {
        key = `logs:level:${query.level}`
      } else if (query.service && query.component) {
        key = `logs:${query.service}:${query.component}`
      } else if (query.userId) {
        key = `logs:user:${query.userId}`
      }

      const start = query.offset || 0
      const end = start + (query.limit || 100) - 1
      
      const logData = await redis.lrange(key, start, end)
      let logs = logData.map(data => {
        try {
          return JSON.parse(data) as LogEntry
        } catch {
          return null
        }
      }).filter((log): log is LogEntry => log !== null)

      // Apply additional filters
      if (query.startTime) {
        logs = logs.filter(log => log.timestamp >= query.startTime!)
      }
      if (query.endTime) {
        logs = logs.filter(log => log.timestamp <= query.endTime!)
      }
      if (query.search) {
        const searchLower = query.search.toLowerCase()
        logs = logs.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
        )
      }
      if (query.tags && query.tags.length > 0) {
        logs = logs.filter(log => 
          query.tags!.some(tag => log.tags.includes(tag))
        )
      }

      return logs

    } catch (error) {
      console.error('Failed to query logs:', error)
      return []
    }
  }

  async getStats(hours: number = 24): Promise<LogStats> {
    try {
      const redis = redisManager.getClient()
      if (!redis) {
        return {
          total: 0,
          byLevel: {},
          byService: {},
          byComponent: {},
          errorRate: 0,
          topErrors: [],
          timeRange: { start: 0, end: 0 }
        }
      }

      const statsKey = 'logs:stats'
      const stats = await redis.hgetall(statsKey)
      
      const total = parseInt(stats.total || '0')
      const byLevel: Record<string, number> = {}
      const byService: Record<string, number> = {}
      const byComponent: Record<string, number> = {}

      // Parse stats
      for (const [key, value] of Object.entries(stats)) {
        const count = parseInt(value)
        if (key.startsWith('level:')) {
          byLevel[key.replace('level:', '')] = count
        } else if (key.startsWith('service:')) {
          byService[key.replace('service:', '')] = count
        } else if (key.startsWith('component:')) {
          byComponent[key.replace('component:', '')] = count
        }
      }

      // Calculate error rate
      const errorCount = byLevel.error || 0
      const errorRate = total > 0 ? (errorCount / total) * 100 : 0

      // Get top errors
      const errorKeys = await redis.keys('logs:errors:*')
      const topErrors = await Promise.all(
        errorKeys.map(async (key) => {
          const errorData = await redis.hgetall(key)
          return {
            error: key.replace('logs:errors:', ''),
            count: parseInt(errorData.count || '0'),
            lastSeen: parseInt(errorData.lastSeen || '0')
          }
        })
      )

      topErrors.sort((a, b) => b.count - a.count)

      const now = Date.now()
      const timeRange = {
        start: now - (hours * 60 * 60 * 1000),
        end: now
      }

      return {
        total,
        byLevel,
        byService,
        byComponent,
        errorRate,
        topErrors: topErrors.slice(0, 10),
        timeRange
      }

    } catch (error) {
      console.error('Failed to get log stats:', error)
      return {
        total: 0,
        byLevel: {},
        byService: {},
        byComponent: {},
        errorRate: 0,
        topErrors: [],
        timeRange: { start: 0, end: 0 }
      }
    }
  }

  async getTrace(traceId: string): Promise<LogEntry[]> {
    return this.query({ traceId, limit: 1000 })
  }

  async getUserLogs(userId: string, limit: number = 100): Promise<LogEntry[]> {
    return this.query({ userId, limit })
  }

  async getErrorLogs(hours: number = 1, limit: number = 100): Promise<LogEntry[]> {
    const startTime = Date.now() - (hours * 60 * 60 * 1000)
    return this.query({ level: 'error', startTime, limit })
  }

  async searchLogs(searchTerm: string, limit: number = 100): Promise<LogEntry[]> {
    return this.query({ search: searchTerm, limit })
  }

  async clearLogs(service?: string, component?: string): Promise<void> {
    try {
      const redis = redisManager.getClient()
      if (!redis) return

      if (service && component) {
        await redis.del(`logs:${service}:${component}`)
      } else if (service) {
        const keys = await redis.keys(`logs:${service}:*`)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      } else {
        // Clear all logs
        const keys = await redis.keys('logs:*')
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      }

      logger.info('Logs cleared', { service, component })

    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  // Helper methods for common logging patterns
  async logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      level: statusCode >= 400 ? 'error' : 'info',
      message: `${method} ${path} ${statusCode}`,
      service: 'api',
      component: 'request',
      userId,
      requestId,
      duration,
      metadata: {
        method,
        path,
        statusCode,
        ...metadata
      },
      tags: ['api', 'request', `status:${statusCode}`]
    })
  }

  async logEmailEvent(
    event: string,
    emailId: string,
    campaignId?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      level: 'info',
      message: `Email ${event}: ${emailId}`,
      service: 'email',
      component: 'delivery',
      userId,
      metadata: {
        event,
        emailId,
        campaignId,
        ...metadata
      },
      tags: ['email', event, campaignId ? `campaign:${campaignId}` : ''].filter(Boolean)
    })
  }

  async logImportProgress(
    importId: string,
    processed: number,
    total: number,
    errors: number,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      level: errors > 0 ? 'warn' : 'info',
      message: `Import progress: ${processed}/${total} (${errors} errors)`,
      service: 'import',
      component: 'processor',
      userId,
      metadata: {
        importId,
        processed,
        total,
        errors,
        progress: (processed / total) * 100,
        ...metadata
      },
      tags: ['import', 'progress', `import:${importId}`]
    })
  }

  async logError(
    error: Error,
    service: string,
    component: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      level: 'error',
      message: error.message,
      service,
      component,
      userId,
      metadata,
      tags: ['error', service, component],
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack || ''
      }
    })
  }
}

export const structuredLogger = new StructuredLogger()

// Export utility functions for common use cases
export const logApiRequest = structuredLogger.logApiRequest.bind(structuredLogger)
export const logEmailEvent = structuredLogger.logEmailEvent.bind(structuredLogger)
export const logImportProgress = structuredLogger.logImportProgress.bind(structuredLogger)
export const logError = structuredLogger.logError.bind(structuredLogger)