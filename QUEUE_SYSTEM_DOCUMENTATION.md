# MailGenius Queue System Documentation

## Overview

The MailGenius queue system is a comprehensive, scalable solution for handling asynchronous processing of leads import and email sending operations. Built with Bull (Redis-based queue system), it provides robust job processing, retry mechanisms, rate limiting, and real-time progress tracking.

## Architecture

### Core Components

1. **Queue Manager** (`/src/lib/queue/index.ts`)
   - Centralized queue management
   - Redis connection handling
   - Queue configuration and monitoring

2. **Job Services**
   - **Leads Import Service** (`/src/lib/queue/jobs/leads-import.ts`)
   - **Email Sending Service** (`/src/lib/queue/jobs/email-sending.ts`)

3. **Worker Management** (`/src/lib/queue/workers/index.ts`)
   - Worker lifecycle management
   - Graceful shutdown handling
   - Service coordination

4. **Rate Limiting** (`/src/lib/queue/rate-limiter.ts`)
   - Intelligent rate limiting
   - Adaptive limits based on system load
   - Multiple rate limit configurations

5. **Progress Tracking** (`/src/lib/queue/progress-tracker.ts`)
   - Real-time progress updates
   - Redis-based pub/sub for live updates
   - Persistent storage in PostgreSQL

## Features

### 🚀 Scalable Processing
- **2MM+ contacts support**: Designed to handle millions of contacts efficiently
- **Chunked processing**: Breaks large datasets into manageable chunks
- **Parallel processing**: Multiple workers process jobs simultaneously
- **Memory optimization**: Efficient memory usage for large datasets

### 🔄 Reliable Job Processing
- **Automatic retries**: Exponential backoff for failed jobs
- **Dead letter queue**: Failed jobs are preserved for analysis
- **Job persistence**: Jobs survive system restarts
- **Graceful shutdown**: Workers finish current jobs before stopping

### 📊 Real-time Monitoring
- **Live progress tracking**: Real-time updates via WebSocket/Redis pub/sub
- **Queue statistics**: Comprehensive queue metrics
- **Error tracking**: Detailed error logging and reporting
- **Performance metrics**: Processing speed and throughput monitoring

### 🛡️ Rate Limiting
- **Intelligent limits**: Adaptive rate limiting based on system load
- **Multiple configurations**: Different limits for different operations
- **Burst handling**: Allows temporary burst requests
- **Redis-based**: Distributed rate limiting across multiple instances

### 🔧 Management APIs
- **Queue control**: Pause, resume, clean queues
- **Job management**: Retry, remove, inspect jobs
- **Progress tracking**: Real-time progress updates
- **Admin dashboard**: Web-based monitoring interface

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Queue Configuration
START_WORKERS=true
QUEUE_CONCURRENCY=5

# Rate Limiting
RATE_LIMIT_ENABLED=true
```

### Queue Settings

```typescript
// Default queue configurations
const queueConfigs = {
  'leads-import': {
    concurrency: 5,
    chunkSize: 1000,
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  'email-sending': {
    concurrency: 3,
    batchSize: 100,
    rateLimitDelay: 1000,
    removeOnComplete: 50,
    removeOnFail: 100,
  }
}
```

## Usage Examples

### 1. Import Leads

```typescript
import { leadsImportService } from '@/lib/queue/jobs/leads-import'

const leads = [
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
  // ... more leads
]

const importId = await leadsImportService.importLeads(userId, leads)
```

### 2. Send Campaign Emails

```typescript
import { emailSendingService } from '@/lib/queue/jobs/email-sending'

const recipients = [
  { id: '1', email: 'user1@example.com', name: 'User 1' },
  { id: '2', email: 'user2@example.com', name: 'User 2' },
]

const template = {
  subject: 'Welcome to MailGenius',
  html: '<h1>Welcome {{name}}!</h1>',
  text: 'Welcome {{name}}!'
}

const sender = {
  email: 'noreply@mailgenius.com',
  name: 'MailGenius'
}

const sendId = await emailSendingService.sendCampaignEmails(
  campaignId,
  recipients,
  template,
  sender,
  userId
)
```

### 3. Track Progress

```typescript
import { progressTracker } from '@/lib/queue/progress-tracker'

// Get progress for a specific operation
const progress = await progressTracker.getProgress(importId)

// Subscribe to real-time updates
const unsubscribe = await progressTracker.subscribeToProgress(
  userId,
  (progress) => {
    console.log('Progress update:', progress)
  }
)
```

### 4. Check Rate Limits

```typescript
import { intelligentRateLimiter } from '@/lib/queue/rate-limiter'

const rateLimit = await intelligentRateLimiter.checkRateLimit(
  userId,
  'email-sending'
)

if (!rateLimit.allowed) {
  throw new Error('Rate limit exceeded')
}
```

## API Endpoints

### Leads Import
- `POST /api/queue/leads/import` - Start lead import
- `GET /api/queue/leads/import?importId=xxx` - Get import progress
- `DELETE /api/queue/leads/import?importId=xxx` - Cancel import

### Email Sending
- `POST /api/queue/campaigns/send` - Start campaign send
- `GET /api/queue/campaigns/send?campaignId=xxx` - Get send progress
- `DELETE /api/queue/campaigns/send?campaignId=xxx` - Cancel send

### Progress Tracking
- `GET /api/queue/progress` - Get user progress
- `GET /api/queue/progress?id=xxx` - Get specific progress
- `DELETE /api/queue/progress?id=xxx` - Delete progress

### Rate Limiting
- `GET /api/queue/rate-limit` - Get rate limit status
- `POST /api/queue/rate-limit` - Check rate limit
- `DELETE /api/queue/rate-limit` - Reset rate limit

### Admin (Protected)
- `GET /api/queue/admin?action=status` - System status
- `GET /api/queue/admin?action=stats` - Queue statistics
- `POST /api/queue/admin` - Admin actions (pause, resume, clean, etc.)

## Database Schema

### Tables Created

1. **lead_imports** - Track lead import operations
2. **lead_import_batches** - Track individual import batches
3. **campaign_sends** - Track campaign send operations
4. **campaign_send_batches** - Track individual send batches
5. **email_sends** - Track individual email sends
6. **progress_tracking** - Real-time progress tracking

### Key Indexes

- User-based indexes for efficient user queries
- Status indexes for filtering operations
- Time-based indexes for performance optimization

## Performance Optimizations

### 1. Chunked Processing
- Large datasets are split into manageable chunks
- Prevents memory overflow
- Enables parallel processing

### 2. Intelligent Rate Limiting
- Adaptive limits based on system load
- Burst capacity for temporary spikes
- Distributed rate limiting with Redis

### 3. Efficient Database Operations
- Batch inserts/updates
- Optimized queries with proper indexes
- Connection pooling

### 4. Memory Management
- Streaming processing for large files
- Garbage collection optimization
- Resource cleanup

## Monitoring and Alerting

### Queue Metrics
- Job processing rates
- Queue depths
- Error rates
- Processing times

### System Health
- Redis connection status
- Database connection health
- Worker status
- Memory usage

### Alerting
- High error rates
- Queue backlogs
- System failures
- Performance degradation

## Error Handling

### Retry Strategies
- Exponential backoff
- Maximum retry attempts
- Different strategies per job type

### Error Logging
- Detailed error messages
- Stack traces
- Context information
- Error categorization

### Recovery
- Job replay capabilities
- Manual intervention options
- Data consistency checks

## Security Considerations

### Authentication
- User-based job isolation
- API key authentication
- Rate limiting per user

### Data Protection
- Encrypted data at rest
- Secure Redis connections
- Input validation
- SQL injection prevention

## Deployment

### Prerequisites
- Redis server
- PostgreSQL database
- Node.js environment

### Steps
1. Install dependencies: `npm install bull @types/bull bullmq ioredis`
2. Run database migrations: `psql -f database/migrations/009_queue_system.sql`
3. Configure environment variables
4. Start workers: `START_WORKERS=true npm start`

### Docker Deployment
```dockerfile
# Add to your Dockerfile
ENV START_WORKERS=true
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server status
   - Verify connection credentials
   - Check network connectivity

2. **Jobs Not Processing**
   - Verify workers are running
   - Check queue status
   - Review error logs

3. **Memory Issues**
   - Monitor chunk sizes
   - Check for memory leaks
   - Optimize processing logic

4. **Rate Limit Exceeded**
   - Review rate limit configuration
   - Check system load
   - Adjust limits if needed

### Debug Commands
```bash
# Check queue status
curl -X GET /api/queue/admin?action=status

# View queue statistics
curl -X GET /api/queue/admin?action=stats

# Check worker status
curl -X GET /api/queue/admin?action=workers
```

## Future Enhancements

### Planned Features
- [ ] Job scheduling and cron jobs
- [ ] Advanced queue prioritization
- [ ] Multi-tenant isolation
- [ ] Enhanced monitoring dashboard
- [ ] Machine learning-based optimization

### Performance Improvements
- [ ] Horizontal scaling support
- [ ] Advanced caching strategies
- [ ] Stream processing capabilities
- [ ] Real-time analytics

## Support

For issues and questions:
- Check the troubleshooting section
- Review error logs
- Contact the development team
- Submit GitHub issues

## License

This queue system is part of the MailGenius project and follows the same licensing terms.