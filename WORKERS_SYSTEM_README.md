# Email Workers System - MailGenius

## Overview

The Email Workers System is a comprehensive solution for parallel email processing in MailGenius, designed to handle high-volume email campaigns with throughput of 10,000+ emails per hour. The system includes worker management, job queuing, rate limiting, retry mechanisms, and comprehensive monitoring.

## Architecture

### Core Components

1. **Worker Manager** (`worker-manager.ts`)
   - Orchestrates multiple email workers
   - Handles load balancing and auto-scaling
   - Manages worker lifecycle

2. **Email Workers** (`email-worker.ts`)
   - Individual worker instances for processing emails
   - Batch processing with configurable batch sizes
   - Rate limiting per worker
   - Heartbeat and health monitoring

3. **Job Queue** (`job-queue.ts`)
   - Manages email jobs and batches
   - Priority-based job processing
   - Job status tracking

4. **Retry System** (`retry-system.ts`)
   - Handles failed email retries
   - Exponential backoff strategy
   - Configurable retry limits

5. **Monitoring** (`monitoring.ts`)
   - Performance metrics collection
   - Throughput analytics
   - Alert system for performance issues

## Database Schema

The system uses several PostgreSQL tables:

- `email_jobs` - Email job queue
- `email_workers` - Worker registry and status
- `email_job_batches` - Batch processing tracking
- `worker_rate_limits` - Rate limiting counters
- `worker_metrics` - Performance metrics
- `email_retry_jobs` - Failed email retries

## Configuration

### Worker Configuration

```typescript
const workerConfig = {
  max_batch_size: 100,           // Emails per batch
  retry_delay_seconds: 30,       // Delay between retries
  max_retry_attempts: 3,         // Maximum retry attempts
  health_check_interval: 30000,  // Health check interval (ms)
  email_provider: 'resend',      // Email provider
  rate_limit_buffer: 10,         // Rate limit buffer percentage
  enable_metrics: true,          // Enable metrics collection
  enable_detailed_logging: true  // Enable detailed logging
};
```

### System Configuration

```typescript
const systemConfig = {
  maxWorkers: 10,           // Maximum number of workers
  minWorkers: 2,            // Minimum number of workers
  targetThroughput: 10000   // Target emails per hour
};
```

## API Endpoints

### Worker Management

- `GET /api/workers` - List workers and get system stats
- `POST /api/workers` - Control worker actions (start, stop, scale)
- `DELETE /api/workers` - Remove specific worker

### Job Management

- `GET /api/workers/jobs` - List jobs and get job stats
- `POST /api/workers/jobs` - Job actions (retry, cancel, reschedule)
- `DELETE /api/workers/jobs` - Delete specific job

### System Control

- `GET /api/workers/startup` - Get system status
- `POST /api/workers/startup` - System actions (initialize, start, stop)

## Usage

### Initializing the System

```typescript
import { emailWorkersService } from '@/lib/email-workers';

// Initialize and start the system
await emailWorkersService.initialize({
  autoStart: true,
  maxWorkers: 10,
  minWorkers: 2,
  targetThroughput: 10000
});
```

### Creating Email Jobs

```typescript
import { emailWorkerManager } from '@/lib/email-workers';

const jobId = await emailWorkerManager.createCampaignJob({
  workspace_id: 'workspace-uuid',
  campaign_id: 'campaign-uuid',
  priority: 0,
  job_type: 'campaign',
  payload: {
    campaign_id: 'campaign-uuid',
    leads: [...],
    template_data: {...},
    sender_info: {...},
    tracking_config: {...}
  },
  batch_size: 100,
  max_retries: 3
});
```

### Monitoring System

```typescript
// Get system statistics
const stats = await emailWorkerManager.getSystemStats();

// Get worker health
const health = await emailWorkerMonitoring.getWorkerHealth();

// Get throughput analytics
const throughput = await emailWorkerMonitoring.getThroughputAnalytics(24);

// Check for alerts
const alerts = await emailWorkerMonitoring.checkPerformanceAlerts();
```

## Features

### High Throughput Processing

- **Parallel Processing**: Multiple workers process emails simultaneously
- **Batch Processing**: Emails are processed in configurable batches
- **Rate Limiting**: Per-worker rate limits to avoid provider limits
- **Auto-scaling**: Dynamic worker scaling based on queue size

### Reliability

- **Retry System**: Automatic retry with exponential backoff
- **Health Monitoring**: Worker health checks and recovery
- **Error Handling**: Comprehensive error handling and logging
- **Graceful Shutdown**: Proper cleanup on system shutdown

### Monitoring & Analytics

- **Real-time Metrics**: Live performance metrics
- **Throughput Analytics**: Detailed throughput analysis
- **Alert System**: Performance and health alerts
- **Dashboard**: Web-based monitoring dashboard

### Performance Optimization

- **Connection Pooling**: Efficient database connections
- **Batch Processing**: Optimized batch sizes
- **Memory Management**: Efficient memory usage
- **CPU Optimization**: Optimized processing algorithms

## Performance Targets

- **Throughput**: 10,000+ emails per hour
- **Response Time**: < 30 seconds per batch
- **Success Rate**: > 95%
- **Uptime**: > 99%

## Rate Limiting

The system implements rate limiting at multiple levels:

1. **Per-worker rate limits**:
   - 100 emails per minute
   - 1,000 emails per hour

2. **System-wide rate limits**:
   - Configurable based on email provider limits
   - Automatic throttling when limits are approached

3. **Adaptive rate limiting**:
   - Adjusts based on provider responses
   - Backs off on rate limit errors

## Error Handling

### Retry Strategy

1. **Immediate retry**: For transient errors
2. **Exponential backoff**: 5min, 15min, 45min, 135min
3. **Maximum retries**: 3 attempts by default
4. **Abandoned emails**: After max retries exceeded

### Error Types

- **Provider errors**: Rate limits, API errors
- **Network errors**: Connection timeouts, DNS issues
- **Data errors**: Invalid email addresses, malformed data
- **System errors**: Database issues, memory errors

## Deployment

### Environment Variables

```bash
# Auto-start workers on production
AUTO_START_WORKERS=true

# Email provider configuration
RESEND_API_KEY=your-resend-api-key

# Database configuration
DATABASE_URL=your-database-url

# Redis for caching (optional)
REDIS_URL=your-redis-url
```

### Production Setup

1. Run database migrations:
   ```bash
   npm run db:migrate
   ```

2. Initialize the worker system:
   ```bash
   curl -X POST http://localhost:3000/api/workers/startup \
     -H "Content-Type: application/json" \
     -d '{"action": "initialize", "max_workers": 10, "min_workers": 2}'
   ```

3. Start the system:
   ```bash
   curl -X POST http://localhost:3000/api/workers/startup \
     -H "Content-Type: application/json" \
     -d '{"action": "start"}'
   ```

## Monitoring Dashboard

Access the monitoring dashboard at: `/dashboard/workers`

The dashboard provides:
- Real-time worker status
- System performance metrics
- Job queue statistics
- Throughput analytics
- Health alerts
- Worker management controls

## Troubleshooting

### Common Issues

1. **Workers not starting**:
   - Check database connection
   - Verify migrations are applied
   - Check environment variables

2. **Low throughput**:
   - Increase worker count
   - Optimize batch sizes
   - Check rate limits

3. **High failure rate**:
   - Check email provider status
   - Verify API keys
   - Review error logs

4. **Memory issues**:
   - Reduce batch sizes
   - Increase worker restart frequency
   - Monitor memory usage

### Debugging

Enable detailed logging:
```typescript
const workerConfig = {
  enable_detailed_logging: true
};
```

Check worker logs:
```bash
# View worker logs
docker logs -f your-app-container | grep "Email worker"

# View job logs
docker logs -f your-app-container | grep "Job"

# View metrics logs
docker logs -f your-app-container | grep "Metrics"
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run worker tests
npm test -- --testPathPattern=workers

# Run with coverage
npm run test:coverage
```

### Local Development

```bash
# Start development server
npm run dev

# Initialize workers
curl -X POST http://localhost:3000/api/workers/startup \
  -H "Content-Type: application/json" \
  -d '{"action": "initialize", "auto_start": true}'

# Create test job
curl -X POST http://localhost:3000/api/workers \
  -H "Content-Type: application/json" \
  -d '{"action": "create-job", "workspace_id": "test", "campaign_id": "test", ...}'
```

## License

This Email Workers System is part of MailGenius and follows the same license terms.