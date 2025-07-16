import { QueueManager } from '../index'
import { LeadsImportService } from '../jobs/leads-import'
import { EmailSendingService } from '../jobs/email-sending'
import { IntelligentRateLimiter } from '../rate-limiter'
import { ProgressTracker } from '../progress-tracker'
import { redisManager } from '../../redis'

// Mock Redis
jest.mock('../../redis', () => ({
  redisManager: {
    connect: jest.fn(),
    getClient: jest.fn(),
    isReady: jest.fn(),
    ping: jest.fn(),
  },
}))

// Mock Supabase
jest.mock('../../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null })),
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(() => ({ data: null, error: null })) })) })),
      update: jest.fn(() => ({ eq: jest.fn(() => ({ error: null })) })),
      upsert: jest.fn(() => ({ error: null })),
    })),
  },
}))

// Mock Bull
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    addBulk: jest.fn(),
    process: jest.fn(),
    getJobs: jest.fn(() => []),
    getWaiting: jest.fn(() => []),
    getActive: jest.fn(() => []),
    getCompleted: jest.fn(() => []),
    getFailed: jest.fn(() => []),
    getDelayed: jest.fn(() => []),
    pause: jest.fn(),
    resume: jest.fn(),
    clean: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    getJob: jest.fn(),
  }))
})

describe('Queue System', () => {
  let queueManager: QueueManager
  let leadsImportService: LeadsImportService
  let emailSendingService: EmailSendingService
  let rateLimiter: IntelligentRateLimiter
  let progressTracker: ProgressTracker

  beforeEach(() => {
    // Mock Redis client
    const mockRedisClient = {
      ping: jest.fn(() => Promise.resolve('PONG')),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      zremrangebyscore: jest.fn(),
      zcard: jest.fn(),
      zadd: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      duplicate: jest.fn(() => ({
        subscribe: jest.fn(),
        on: jest.fn(),
        unsubscribe: jest.fn(),
        quit: jest.fn(),
      })),
      pipeline: jest.fn(() => ({
        zremrangebyscore: jest.fn(),
        zcard: jest.fn(),
        zadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn(() => Promise.resolve([[null, 0], [null, 5]])),
      })),
    }

    ;(redisManager.getClient as jest.Mock).mockReturnValue(mockRedisClient)
    ;(redisManager.isReady as jest.Mock).mockReturnValue(true)
    ;(redisManager.connect as jest.Mock).mockResolvedValue(undefined)

    queueManager = QueueManager.getInstance()
    leadsImportService = LeadsImportService.getInstance()
    emailSendingService = EmailSendingService.getInstance()
    rateLimiter = IntelligentRateLimiter.getInstance()
    progressTracker = ProgressTracker.getInstance()
  })

  describe('QueueManager', () => {
    it('should initialize successfully', async () => {
      await expect(queueManager.initialize()).resolves.toBeUndefined()
    })

    it('should create queues with proper configuration', () => {
      const queue = queueManager.createQueue({
        name: 'test-queue',
        concurrency: 5,
        removeOnComplete: 10,
        removeOnFail: 50,
      })

      expect(queue).toBeDefined()
      expect(queueManager.getQueue('test-queue')).toBe(queue)
    })

    it('should get queue statistics', async () => {
      queueManager.createQueue({
        name: 'test-queue',
        concurrency: 5,
      })

      const stats = await queueManager.getQueueStats('test-queue')
      expect(stats).toHaveProperty('waiting')
      expect(stats).toHaveProperty('active')
      expect(stats).toHaveProperty('completed')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('delayed')
    })

    it('should handle queue operations', async () => {
      const queueName = 'test-queue'
      queueManager.createQueue({ name: queueName, concurrency: 5 })

      await expect(queueManager.pauseQueue(queueName)).resolves.toBeUndefined()
      await expect(queueManager.resumeQueue(queueName)).resolves.toBeUndefined()
      await expect(queueManager.cleanQueue(queueName)).resolves.toBeUndefined()
    })
  })

  describe('LeadsImportService', () => {
    it('should import leads successfully', async () => {
      const userId = 'user-123'
      const leads = [
        { email: 'test1@example.com', name: 'Test User 1' },
        { email: 'test2@example.com', name: 'Test User 2' },
      ]

      const importId = await leadsImportService.importLeads(userId, leads)
      expect(importId).toBeDefined()
      expect(typeof importId).toBe('string')
      expect(importId).toMatch(/^import_/)
    })

    it('should handle large lead imports with chunking', async () => {
      const userId = 'user-123'
      const leads = Array.from({ length: 5000 }, (_, i) => ({
        email: `test${i}@example.com`,
        name: `Test User ${i}`,
      }))

      const importId = await leadsImportService.importLeads(userId, leads)
      expect(importId).toBeDefined()
    })

    it('should get import progress', async () => {
      const importId = 'import_123'
      const progress = await leadsImportService.getImportProgress(importId)
      
      expect(progress).toHaveProperty('status')
      expect(progress).toHaveProperty('progress')
      expect(progress).toHaveProperty('totalLeads')
      expect(progress).toHaveProperty('processedLeads')
      expect(progress).toHaveProperty('failedLeads')
      expect(progress).toHaveProperty('batches')
    })

    it('should cancel import', async () => {
      const importId = 'import_123'
      const cancelled = await leadsImportService.cancelImport(importId)
      expect(typeof cancelled).toBe('boolean')
    })

    it('should validate email format', () => {
      const service = leadsImportService as any
      expect(service.isValidEmail('test@example.com')).toBe(true)
      expect(service.isValidEmail('invalid-email')).toBe(false)
      expect(service.isValidEmail('test@')).toBe(false)
      expect(service.isValidEmail('@example.com')).toBe(false)
    })
  })

  describe('EmailSendingService', () => {
    it('should send campaign emails', async () => {
      const campaignId = 'campaign-123'
      const recipients = [
        { id: '1', email: 'test1@example.com', name: 'Test User 1' },
        { id: '2', email: 'test2@example.com', name: 'Test User 2' },
      ]
      const template = {
        subject: 'Test Subject',
        html: '<p>Hello {{name}}!</p>',
        text: 'Hello {{name}}!',
      }
      const sender = {
        email: 'sender@example.com',
        name: 'Sender Name',
      }
      const userId = 'user-123'

      const sendId = await emailSendingService.sendCampaignEmails(
        campaignId,
        recipients,
        template,
        sender,
        userId
      )

      expect(sendId).toBeDefined()
      expect(typeof sendId).toBe('string')
      expect(sendId).toMatch(/^send_/)
    })

    it('should personalize email templates', () => {
      const service = emailSendingService as any
      const template = {
        subject: 'Hello {{name}}!',
        html: '<p>Hello {{name}}, your email is {{email}}</p>',
        text: 'Hello {{name}}, your email is {{email}}',
      }
      const recipient = {
        name: 'John Doe',
        email: 'john@example.com',
      }

      const personalized = service.personalizeTemplate(template, recipient)

      expect(personalized.subject).toBe('Hello John Doe!')
      expect(personalized.html).toBe('<p>Hello John Doe, your email is john@example.com</p>')
      expect(personalized.text).toBe('Hello John Doe, your email is john@example.com')
    })

    it('should get campaign send progress', async () => {
      const campaignId = 'campaign-123'
      const progress = await emailSendingService.getCampaignSendProgress(campaignId)
      
      expect(progress).toHaveProperty('status')
      expect(progress).toHaveProperty('progress')
      expect(progress).toHaveProperty('totalRecipients')
      expect(progress).toHaveProperty('sentCount')
      expect(progress).toHaveProperty('failedCount')
      expect(progress).toHaveProperty('batches')
    })

    it('should cancel campaign send', async () => {
      const campaignId = 'campaign-123'
      const cancelled = await emailSendingService.cancelCampaignSend(campaignId)
      expect(typeof cancelled).toBe('boolean')
    })
  })

  describe('IntelligentRateLimiter', () => {
    it('should check rate limits', async () => {
      const identifier = 'user-123'
      const configKey = 'email-sending'

      const result = await rateLimiter.checkRateLimit(identifier, configKey)

      expect(result).toHaveProperty('allowed')
      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('resetTime')
      expect(result).toHaveProperty('totalRequests')
      expect(typeof result.allowed).toBe('boolean')
    })

    it('should handle rate limit exceeded', async () => {
      const identifier = 'user-123'
      const configKey = 'email-sending'

      // Mock high usage
      const mockRedisClient = redisManager.getClient() as any
      mockRedisClient.pipeline().exec.mockResolvedValue([[null, 0], [null, 200]]) // Over limit

      const result = await rateLimiter.checkRateLimit(identifier, configKey)
      expect(result.allowed).toBe(false)
    })

    it('should reset rate limits', async () => {
      const identifier = 'user-123'
      const configKey = 'email-sending'

      const reset = await rateLimiter.resetRateLimit(identifier, configKey)
      expect(typeof reset).toBe('boolean')
    })

    it('should get rate limit status', async () => {
      const identifier = 'user-123'
      const configKey = 'email-sending'

      const status = await rateLimiter.getRateLimitStatus(identifier, configKey)

      expect(status).toHaveProperty('currentCount')
      expect(status).toHaveProperty('limit')
      expect(status).toHaveProperty('remaining')
      expect(status).toHaveProperty('resetTime')
      expect(status).toHaveProperty('window')
    })

    it('should handle adaptive rate limiting', async () => {
      const identifier = 'user-123'
      const configKey = 'email-sending'
      const systemLoad = 0.7 // 70% load

      const result = await rateLimiter.getAdaptiveRateLimit(identifier, configKey, systemLoad)
      expect(result).toHaveProperty('allowed')
      expect(result).toHaveProperty('remaining')
    })
  })

  describe('ProgressTracker', () => {
    it('should create progress tracking', async () => {
      const id = 'progress-123'
      const type = 'leads-import'
      const userId = 'user-123'
      const totalItems = 1000

      const progress = await progressTracker.createProgress(id, type, userId, totalItems)

      expect(progress).toHaveProperty('id', id)
      expect(progress).toHaveProperty('type', type)
      expect(progress).toHaveProperty('userId', userId)
      expect(progress).toHaveProperty('totalItems', totalItems)
      expect(progress).toHaveProperty('status', 'pending')
      expect(progress).toHaveProperty('progress', 0)
    })

    it('should update progress', async () => {
      const id = 'progress-123'
      
      // Mock existing progress
      const mockProgress = {
        id,
        type: 'leads-import' as const,
        userId: 'user-123',
        status: 'processing' as const,
        progress: 0,
        totalItems: 1000,
        processedItems: 0,
        failedItems: 0,
        message: 'Starting...',
        startTime: Date.now(),
      }

      progressTracker.getProgress = jest.fn().mockResolvedValue(mockProgress)

      const updatedProgress = await progressTracker.updateProgress(id, {
        processedItems: 500,
        message: 'Processing...',
      })

      expect(updatedProgress).toHaveProperty('processedItems', 500)
      expect(updatedProgress).toHaveProperty('message', 'Processing...')
    })

    it('should get user progress', async () => {
      const userId = 'user-123'
      const progress = await progressTracker.getUserProgress(userId)
      expect(Array.isArray(progress)).toBe(true)
    })

    it('should get progress stats', async () => {
      const userId = 'user-123'
      const stats = await progressTracker.getProgressStats(userId)

      expect(stats).toHaveProperty('total')
      expect(stats).toHaveProperty('pending')
      expect(stats).toHaveProperty('processing')
      expect(stats).toHaveProperty('completed')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('cancelled')
    })

    it('should delete progress', async () => {
      const id = 'progress-123'
      const deleted = await progressTracker.deleteProgress(id)
      expect(typeof deleted).toBe('boolean')
    })

    it('should cleanup old progress', async () => {
      const maxAge = 86400000 // 24 hours
      const cleaned = await progressTracker.cleanupOldProgress(maxAge)
      expect(typeof cleaned).toBe('number')
    })
  })

  describe('Integration Tests', () => {
    it('should handle full lead import workflow', async () => {
      const userId = 'user-123'
      const leads = [
        { email: 'test1@example.com', name: 'Test User 1' },
        { email: 'test2@example.com', name: 'Test User 2' },
      ]

      // Start import
      const importId = await leadsImportService.importLeads(userId, leads)
      expect(importId).toBeDefined()

      // Check progress
      const progress = await leadsImportService.getImportProgress(importId)
      expect(progress).toHaveProperty('status')
      expect(progress).toHaveProperty('totalLeads', leads.length)

      // Cancel import
      const cancelled = await leadsImportService.cancelImport(importId)
      expect(cancelled).toBe(true)
    })

    it('should handle full email sending workflow', async () => {
      const campaignId = 'campaign-123'
      const userId = 'user-123'
      const recipients = [
        { id: '1', email: 'test1@example.com', name: 'Test User 1' },
        { id: '2', email: 'test2@example.com', name: 'Test User 2' },
      ]
      const template = {
        subject: 'Test Subject',
        html: '<p>Hello {{name}}!</p>',
      }
      const sender = {
        email: 'sender@example.com',
        name: 'Sender Name',
      }

      // Start send
      const sendId = await emailSendingService.sendCampaignEmails(
        campaignId,
        recipients,
        template,
        sender,
        userId
      )
      expect(sendId).toBeDefined()

      // Check progress
      const progress = await emailSendingService.getCampaignSendProgress(campaignId)
      expect(progress).toHaveProperty('status')
      expect(progress).toHaveProperty('totalRecipients', recipients.length)

      // Cancel send
      const cancelled = await emailSendingService.cancelCampaignSend(campaignId)
      expect(cancelled).toBe(true)
    })

    it('should handle rate limiting with queue operations', async () => {
      const userId = 'user-123'
      const configKey = 'email-sending'

      // Check rate limit
      const rateLimit = await rateLimiter.checkRateLimit(userId, configKey)
      expect(rateLimit).toHaveProperty('allowed')

      if (rateLimit.allowed) {
        // Proceed with operation
        const leads = [{ email: 'test@example.com', name: 'Test User' }]
        const importId = await leadsImportService.importLeads(userId, leads)
        expect(importId).toBeDefined()
      }
    })
  })
})