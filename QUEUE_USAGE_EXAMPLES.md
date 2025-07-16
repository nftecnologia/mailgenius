# Queue System Usage Examples

## Installation and Setup

### 1. Install Dependencies

```bash
npm install bull @types/bull ioredis
```

### 2. Environment Configuration

```env
# .env.local
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
START_WORKERS=true
```

### 3. Database Migration

```bash
npm run db:migrate
```

### 4. Start Workers

```bash
# Development
npm run workers:dev

# Production
npm run workers
```

## Basic Usage Examples

### 1. Import Leads from CSV

```typescript
// pages/api/leads/import-csv.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { leadsImportService } from '@/lib/queue/jobs/leads-import'
import { progressTracker } from '@/lib/queue/progress-tracker'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { leads, userId } = req.body

    // Start the import process
    const importId = await leadsImportService.importLeads(userId, leads)

    // Track progress
    await progressTracker.createProgress(
      importId,
      'leads-import',
      userId,
      leads.length,
      { source: 'csv-upload' }
    )

    res.json({
      success: true,
      importId,
      message: `Started importing ${leads.length} leads`
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

### 2. Send Email Campaign

```typescript
// pages/api/campaigns/send.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { emailSendingService } from '@/lib/queue/jobs/email-sending'
import { intelligentRateLimiter } from '@/lib/queue/rate-limiter'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { campaignId, recipients, template, sender, userId } = req.body

    // Check rate limits
    const rateLimit = await intelligentRateLimiter.checkRateLimit(userId, 'email-sending')
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        resetTime: rateLimit.resetTime 
      })
    }

    // Start email sending
    const sendId = await emailSendingService.sendCampaignEmails(
      campaignId,
      recipients,
      template,
      sender,
      userId
    )

    res.json({
      success: true,
      sendId,
      message: `Started sending to ${recipients.length} recipients`
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

### 3. Real-time Progress Tracking

```typescript
// components/ProgressTracker.tsx
import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'

interface ProgressData {
  id: string
  progress: number
  message: string
  processedItems: number
  totalItems: number
  status: string
}

export default function ProgressTracker({ taskId }: { taskId: string }) {
  const [progress, setProgress] = useState<ProgressData | null>(null)

  useEffect(() => {
    const fetchProgress = async () => {
      const response = await fetch(`/api/queue/progress?id=${taskId}`)
      if (response.ok) {
        const data = await response.json()
        setProgress(data.progress)
      }
    }

    // Initial fetch
    fetchProgress()

    // Poll for updates
    const interval = setInterval(fetchProgress, 2000)
    return () => clearInterval(interval)
  }, [taskId])

  if (!progress) return <div>Loading...</div>

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{progress.message}</span>
        <span>{progress.progress}%</span>
      </div>
      <Progress value={progress.progress} />
      <div className="text-xs text-gray-500">
        {progress.processedItems} of {progress.totalItems} items processed
      </div>
    </div>
  )
}
```

## Advanced Usage Examples

### 1. Custom Rate Limiting

```typescript
// lib/custom-rate-limiter.ts
import { intelligentRateLimiter } from '@/lib/queue/rate-limiter'

export async function checkCustomRateLimit(userId: string, operationType: string) {
  const config = {
    key: `${operationType}-${userId}`,
    limit: 50, // Custom limit
    window: 3600, // 1 hour window
    burst: 10, // Allow 10 burst requests
  }

  return await intelligentRateLimiter.createCustomRateLimit(userId, config)
}
```

### 2. Batch Processing with Webhooks

```typescript
// lib/webhook-processor.ts
import { leadsImportService } from '@/lib/queue/jobs/leads-import'
import { progressTracker } from '@/lib/queue/progress-tracker'

export async function processWebhookBatch(webhookData: any[], userId: string) {
  const leads = webhookData.map(item => ({
    email: item.email,
    name: item.name,
    metadata: {
      source: 'webhook',
      timestamp: item.timestamp,
      webhook_id: item.id
    }
  }))

  const importId = await leadsImportService.importLeads(userId, leads)
  
  // Create progress tracker with webhook metadata
  await progressTracker.createProgress(
    importId,
    'leads-import',
    userId,
    leads.length,
    {
      source: 'webhook',
      batch_size: leads.length,
      webhook_source: webhookData[0]?.source
    }
  )

  return importId
}
```

### 3. Queue Monitoring and Alerts

```typescript
// lib/queue-monitor.ts
import { queueManager } from '@/lib/queue/index'
import { workerManager } from '@/lib/queue/workers'

export async function monitorQueues() {
  const stats = await workerManager.getWorkerStats()
  
  for (const [queueName, queueStats] of Object.entries(stats)) {
    // Alert if too many failed jobs
    if (queueStats.failed > 100) {
      await sendAlert(`High failure rate in ${queueName}: ${queueStats.failed} failed jobs`)
    }
    
    // Alert if queue is backing up
    if (queueStats.waiting > 1000) {
      await sendAlert(`Queue ${queueName} backing up: ${queueStats.waiting} waiting jobs`)
    }
    
    // Alert if no active workers
    if (queueStats.active === 0 && queueStats.waiting > 0) {
      await sendAlert(`No active workers for ${queueName} with ${queueStats.waiting} waiting jobs`)
    }
  }
}

async function sendAlert(message: string) {
  // Send alert via your preferred method (email, Slack, etc.)
  console.error('[QUEUE ALERT]', message)
}
```

### 4. Scheduled Queue Cleanup

```typescript
// lib/queue-maintenance.ts
import { queueManager } from '@/lib/queue/index'
import { progressTracker } from '@/lib/queue/progress-tracker'

export async function performMaintenance() {
  // Clean old completed jobs
  await queueManager.cleanQueue('leads-import', 3600) // 1 hour
  await queueManager.cleanQueue('email-sending', 3600)
  
  // Clean old progress records
  await progressTracker.cleanupOldProgress(86400000 * 7) // 7 days
  
  console.log('Queue maintenance completed')
}

// Schedule maintenance (you might use a cron job or similar)
setInterval(performMaintenance, 86400000) // Daily
```

## Frontend Integration Examples

### 1. React Hook for Queue Operations

```typescript
// hooks/useQueueOperations.ts
import { useState, useCallback } from 'react'

export function useQueueOperations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importLeads = useCallback(async (leads: any[]) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/queue/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start import')
      }
      
      const data = await response.json()
      return data.importId
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const sendCampaign = useCallback(async (campaignData: any) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/queue/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to start campaign')
      }
      
      const data = await response.json()
      return data.sendId
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { importLeads, sendCampaign, loading, error }
}
```

### 2. Queue Status Dashboard Component

```typescript
// components/QueueStatusWidget.tsx
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
}

export default function QueueStatusWidget() {
  const [stats, setStats] = useState<Record<string, QueueStats>>({})

  useEffect(() => {
    const fetchStats = async () => {
      const response = await fetch('/api/queue/admin?action=stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.queues || {})
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(stats).map(([queueName, queueStats]) => (
        <Card key={queueName}>
          <CardHeader>
            <CardTitle className="text-sm capitalize">
              {queueName.replace('-', ' ')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Badge variant="outline">
                Active: {queueStats.active}
              </Badge>
              <Badge variant="outline">
                Waiting: {queueStats.waiting}
              </Badge>
              <Badge variant="outline">
                Failed: {queueStats.failed}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

## Testing Examples

### 1. Unit Tests

```typescript
// __tests__/queue-operations.test.ts
import { leadsImportService } from '@/lib/queue/jobs/leads-import'
import { emailSendingService } from '@/lib/queue/jobs/email-sending'

describe('Queue Operations', () => {
  it('should import leads successfully', async () => {
    const leads = [
      { email: 'test@example.com', name: 'Test User' }
    ]
    const importId = await leadsImportService.importLeads('user-123', leads)
    expect(importId).toBeDefined()
  })

  it('should send campaign emails', async () => {
    const campaignData = {
      campaignId: 'campaign-123',
      recipients: [{ id: '1', email: 'test@example.com' }],
      template: { subject: 'Test', html: '<p>Test</p>' },
      sender: { email: 'sender@example.com' },
      userId: 'user-123'
    }
    
    const sendId = await emailSendingService.sendCampaignEmails(
      campaignData.campaignId,
      campaignData.recipients,
      campaignData.template,
      campaignData.sender,
      campaignData.userId
    )
    
    expect(sendId).toBeDefined()
  })
})
```

### 2. Integration Tests

```typescript
// __tests__/queue-integration.test.ts
import { queueManager } from '@/lib/queue/index'
import { workerManager } from '@/lib/queue/workers'

describe('Queue Integration', () => {
  beforeAll(async () => {
    await queueManager.initialize()
    await workerManager.startWorkers()
  })

  afterAll(async () => {
    await workerManager.stopWorkers()
  })

  it('should process jobs end-to-end', async () => {
    // Test implementation
  })
})
```

## Production Deployment

### 1. Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Start both web server and workers
CMD ["sh", "-c", "npm run workers & npm start"]
```

### 2. Environment Variables

```env
# Production environment
NODE_ENV=production
START_WORKERS=true
REDIS_HOST=redis-cluster.example.com
REDIS_PORT=6379
REDIS_PASSWORD=secure_password
REDIS_DB=0

# Queue configuration
QUEUE_CONCURRENCY=10
WORKER_PORT=3001
```

### 3. Process Management

```javascript
// ecosystem.config.js (PM2)
module.exports = {
  apps: [
    {
      name: 'mailgenius-web',
      script: 'npm',
      args: 'start',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'mailgenius-workers',
      script: 'npm',
      args: 'run workers',
      instances: 2,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        START_WORKERS: 'true'
      }
    }
  ]
}
```

## Monitoring and Alerting

### 1. Health Check Endpoints

```typescript
// pages/api/health/queue.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { workerManager } from '@/lib/queue/workers'
import { redisManager } from '@/lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      redis: await redisManager.ping(),
      workers: workerManager.getWorkerStatus().isRunning
    }
  }

  const isHealthy = Object.values(health.checks).every(check => check === true)
  
  res.status(isHealthy ? 200 : 503).json(health)
}
```

### 2. Metrics Collection

```typescript
// lib/metrics.ts
import { queueManager } from '@/lib/queue/index'

export async function collectMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    queues: await queueManager.getQueueStats('leads-import'),
    workers: await workerManager.getWorkerStats(),
    redis: await redisManager.ping()
  }

  // Send to monitoring service
  await sendToMetricsService(metrics)
}
```

This comprehensive queue system provides robust, scalable background processing capabilities for the MailGenius platform, handling millions of contacts efficiently while maintaining reliability and performance.