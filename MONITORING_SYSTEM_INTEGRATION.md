# MailGenius Monitoring System - Integration Guide

## Overview

The MailGenius monitoring system provides comprehensive real-time monitoring capabilities for your email marketing platform. This system has been designed to handle 2MM+ contact operations with complete visibility into system health, performance, and user activities.

## Features Implemented

### 1. Real-Time Monitoring Dashboards
- **Import Progress Dashboard**: Track CSV imports, validation, and processing
- **Email Metrics Dashboard**: Monitor email delivery, opens, clicks, and bounces
- **Queue Health Dashboard**: Monitor job queues and worker status
- **Alerts & Incidents Dashboard**: Track system alerts and incidents
- **Logs Dashboard**: Structured logging with advanced filtering

### 2. Comprehensive Metrics Collection
- API request metrics (latency, errors, throughput)
- Email delivery metrics (sent, delivered, bounced, opened, clicked)
- Campaign performance metrics
- User activity metrics
- System resource metrics (memory, CPU usage)
- Rate limiting metrics

### 3. Structured Logging System
- Redis-based log storage with indexing
- Multiple log levels (debug, info, warn, error)
- Trace ID support for request tracking
- User activity logging
- Service and component-based organization

### 4. Alert Management
- Real-time alert monitoring
- Configurable alert rules
- Incident tracking with MTTR/MTBF calculations
- Escalation and notification management

### 5. Monitoring Middleware
- Automatic API request monitoring
- Email delivery event tracking
- Campaign lifecycle monitoring
- User activity tracking
- Rate limiting monitoring

## Directory Structure

```
src/
├── lib/
│   └── monitoring/
│       ├── alerts.ts              # Alert management system
│       ├── dashboard.ts           # Dashboard data aggregation
│       ├── health-check.ts        # System health monitoring
│       ├── init.ts                # Monitoring initialization
│       ├── metrics.ts             # Metrics collection and storage
│       ├── middleware.ts          # Monitoring middleware
│       └── structured-logger.ts   # Structured logging system
├── components/
│   └── monitoring/
│       ├── RealtimeMonitoringDashboard.tsx    # Main dashboard
│       ├── ImportProgressDashboard.tsx        # Import monitoring
│       ├── EmailMetricsDashboard.tsx          # Email metrics
│       ├── QueueHealthDashboard.tsx           # Queue monitoring
│       ├── AlertsAndIncidentsDashboard.tsx    # Alerts dashboard
│       └── LogsDashboard.tsx                  # Logs viewer
├── app/
│   ├── api/
│   │   └── monitoring/
│   │       ├── imports/           # Import monitoring APIs
│   │       ├── emails/            # Email metrics APIs
│   │       ├── queues/            # Queue health APIs
│   │       ├── alerts/            # Alert management APIs
│   │       └── logs/              # Logs APIs
│   └── dashboard/
│       └── monitoring/
│           └── page.tsx           # Monitoring dashboard page
└── instrumentation.ts             # Next.js instrumentation
```

## Setup Instructions

### 1. Configuration

The monitoring system uses your existing Redis and Supabase configuration. No additional setup is required.

### 2. Environment Variables

Ensure these environment variables are set:

```bash
# Required for Redis (used for metrics and logs storage)
REDIS_URL=your_redis_url

# Required for Supabase (used for persistent storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Automatic Initialization

The monitoring system is automatically initialized when your application starts through the `instrumentation.ts` file.

## Usage Guide

### 1. Accessing the Dashboard

Navigate to `/dashboard/monitoring` to access the comprehensive monitoring dashboard.

### 2. Using Monitoring Middleware

The monitoring middleware is automatically applied to all API routes. For custom monitoring:

```typescript
import { 
  emailMonitoringMiddleware,
  campaignMonitoringMiddleware,
  userMonitoringMiddleware 
} from '@/lib/monitoring/middleware'

// Track email events
await emailMonitoringMiddleware.onEmailSent(
  'user@example.com',
  'campaign-123',
  'template-456'
)

// Track campaign events
await campaignMonitoringMiddleware.onCampaignCreated(
  'campaign-123',
  'user-456',
  'newsletter'
)

// Track user activity
await userMonitoringMiddleware.onUserActivity(
  'user-456',
  'email_sent'
)
```

### 3. Custom Metrics

Record custom metrics using the metrics collector:

```typescript
import { metricsCollector } from '@/lib/monitoring/metrics'

// Record a custom metric
await metricsCollector.recordMetric('custom.metric', 42, {
  category: 'business',
  type: 'conversion'
})

// Get metric data
const metrics = await metricsCollector.getMetric('custom.metric', 1) // Last 1 hour
```

### 4. Structured Logging

Use the structured logger for comprehensive logging:

```typescript
import { structuredLogger } from '@/lib/monitoring/structured-logger'

// Log API request
await structuredLogger.logApiRequest(
  'POST',
  '/api/campaigns',
  200,
  150, // duration in ms
  'user-123',
  'req-456'
)

// Log email event
await structuredLogger.logEmailEvent(
  'delivered',
  'email-123',
  'campaign-456',
  'user-789'
)

// Log error
await structuredLogger.logError(
  error,
  'email',
  'delivery',
  'user-123'
)
```

### 5. Alert Management

Configure alerts programmatically:

```typescript
import { alertManager } from '@/lib/monitoring/alerts'

// Add alert rule
await alertManager.addRule({
  name: 'High Email Bounce Rate',
  condition: 'email.bounce_rate > 10',
  threshold: 10,
  operator: 'greater_than',
  timeWindow: 300, // 5 minutes
  enabled: true,
  severity: 'warning',
  description: 'Email bounce rate is too high'
})

// Get active alerts
const activeAlerts = await alertManager.getActiveAlerts()
```

## API Endpoints

### Monitoring APIs

- `GET /api/monitoring/imports/jobs` - Get import job status
- `GET /api/monitoring/imports/metrics` - Get import metrics
- `GET /api/monitoring/emails/metrics` - Get email delivery metrics
- `GET /api/monitoring/queues/health` - Get queue health status
- `GET /api/monitoring/alerts/incidents` - Get alert incidents
- `GET /api/monitoring/alerts/rules` - Get alert rules
- `GET /api/monitoring/logs` - Query structured logs

### Query Parameters

Most endpoints support these query parameters:

- `hours`: Time window in hours (default: 1)
- `limit`: Maximum number of results (default: 100)
- `offset`: Pagination offset (default: 0)
- `service`: Filter by service name
- `component`: Filter by component name
- `level`: Filter by log level (debug, info, warn, error)

## Dashboard Features

### 1. Import Progress Dashboard
- Real-time import job tracking
- Validation metrics and error reporting
- Worker status and performance
- Job queue management

### 2. Email Metrics Dashboard
- Email delivery statistics
- Open and click rates
- Bounce and unsubscribe tracking
- Provider performance comparison
- Campaign performance analysis

### 3. Queue Health Dashboard
- Queue depth and throughput
- Worker status and performance
- Job processing times
- Error rates and retry statistics

### 4. Alerts & Incidents Dashboard
- Active alerts and incidents
- Alert rule configuration
- Incident timeline and resolution
- MTTR/MTBF calculations
- Escalation management

### 5. Logs Dashboard
- Real-time log streaming
- Advanced filtering and search
- Error tracking and analysis
- Request tracing
- Export capabilities

## Performance Considerations

### 1. Metrics Storage
- Metrics are stored in Redis with 24-hour retention
- Memory usage is limited to 1000 points per metric
- Automatic cleanup runs hourly

### 2. Log Storage
- Logs are stored in Redis with 24-hour retention
- Maximum 10,000 log entries per service/component
- Automatic indexing for fast queries

### 3. Monitoring Overhead
- Middleware adds ~1-2ms to request processing
- Metrics collection is asynchronous
- Log storage is non-blocking

## Best Practices

### 1. Monitoring Strategy
- Monitor key business metrics (emails sent, campaigns created)
- Set up alerts for system health (error rates, response times)
- Track user behavior (logins, activity)
- Monitor resource usage (memory, CPU)

### 2. Alert Configuration
- Set appropriate thresholds to avoid alert fatigue
- Use different severity levels (info, warning, critical)
- Configure escalation for critical alerts
- Review and adjust alert rules regularly

### 3. Log Management
- Use structured logging for better searchability
- Include context (user ID, request ID, trace ID)
- Log errors with full stack traces
- Use appropriate log levels

### 4. Dashboard Usage
- Use real-time dashboards for operations
- Set up automated reports for management
- Create custom dashboards for specific use cases
- Monitor trends over time

## Troubleshooting

### Common Issues

1. **Monitoring not working**
   - Check Redis connection
   - Verify environment variables
   - Check instrumentation initialization

2. **Missing metrics**
   - Ensure middleware is properly applied
   - Check metric collection configuration
   - Verify Redis storage

3. **Alerts not firing**
   - Check alert rule configuration
   - Verify metric availability
   - Check alert manager status

4. **Dashboard not loading**
   - Check API endpoints
   - Verify Supabase connection
   - Check browser console for errors

### Debug Mode

Enable debug logging:

```typescript
// In your environment variables
DEBUG=monitoring:*
```

### Health Check

Check monitoring system health:

```bash
curl http://localhost:3000/api/monitoring/health
```

## Future Enhancements

### Planned Features
1. **Advanced Analytics**: Predictive analytics for email performance
2. **Custom Dashboards**: User-configurable dashboard widgets
3. **Webhook Integration**: Real-time notifications to external systems
4. **Performance Optimization**: Caching and query optimization
5. **Export Capabilities**: CSV/PDF report generation

### Extensibility
The monitoring system is designed to be extensible. You can:
- Add custom metrics collectors
- Create new dashboard components
- Implement custom alert rules
- Add new log processing pipelines

## Support

For issues or questions about the monitoring system:
1. Check the dashboard health indicators
2. Review system logs for errors
3. Verify configuration and environment variables
4. Test with smaller datasets first

The monitoring system is designed to provide complete visibility into your MailGenius operations, enabling you to maintain high performance and reliability for your 2MM+ contact operations.