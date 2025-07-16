# MailGenius - Guia de Monitoramento e Troubleshooting

## 🎯 Visão Geral do Monitoramento

O MailGenius possui um sistema de monitoramento completo projetado para operações de alta escala com 2MM+ contatos. Este guia cobre todas as ferramentas, métricas, alertas e procedimentos de troubleshooting.

## 🏗️ Arquitetura do Sistema de Monitoramento

### **Componentes Principais**
```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Principal                      │
├─────────────────────────────────────────────────────────────┤
│  • System Health      • Performance Metrics                │
│  • Real-time Alerts   • Historical Analysis                │
│  • Queue Status       • Error Tracking                     │
│  • Business KPIs      • Capacity Planning                  │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                  Metrics Collection                         │
├─────────────────────────────────────────────────────────────┤
│  • API Latency        • Email Delivery                     │
│  • Database Queries   • Queue Performance                  │
│  • User Activity      • System Resources                   │
│  • Error Rates        • Business Metrics                   │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                   Data Storage                              │
├─────────────────────────────────────────────────────────────┤
│  • Redis (Real-time)  • PostgreSQL (Historical)           │
│  • Structured Logs    • Metrics Aggregation               │
│  • Alert Rules        • Incident Tracking                 │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Dashboard de Monitoramento

### **Acesso ao Dashboard**
```
URL: https://mailgenius.com/dashboard/monitoring
Local: http://localhost:3000/dashboard/monitoring
```

### **Seções do Dashboard**

#### **1. System Health Overview**
- **Status Geral**: Healthy, Degraded, Unhealthy
- **Serviços Monitorados**: Database, Redis, Email Service, Queue System
- **Uptime**: Tempo de atividade dos serviços
- **Response Times**: Tempo de resposta médio

#### **2. Import Progress Dashboard**
- **Active Jobs**: Jobs de importação ativos
- **Queue Status**: Status da fila de importação
- **Processing Rate**: Taxa de processamento (records/segundo)
- **Error Rate**: Taxa de erros na importação
- **CSV Validation**: Métricas de validação de CSV

#### **3. Email Metrics Dashboard**
- **Delivery Statistics**: Estatísticas de entrega
- **Engagement Metrics**: Métricas de engajamento
- **Provider Performance**: Performance dos provedores
- **Campaign Analytics**: Análise de campanhas
- **Real-time Throughput**: Throughput em tempo real

#### **4. Queue Health Dashboard**
- **Queue Depth**: Profundidade da fila
- **Processing Rate**: Taxa de processamento
- **Worker Status**: Status dos workers
- **Job Statistics**: Estatísticas de jobs
- **Error Tracking**: Rastreamento de erros

#### **5. Alerts & Incidents Dashboard**
- **Active Alerts**: Alertas ativos
- **Alert Rules**: Regras de alerta
- **Incident Timeline**: Timeline de incidentes
- **MTTR/MTBF**: Métricas de recuperação

#### **6. Structured Logs Dashboard**
- **Real-time Logs**: Logs em tempo real
- **Log Filtering**: Filtros avançados
- **Search Capability**: Busca em logs
- **Export Features**: Exportação de logs

## 🔍 Métricas e KPIs

### **System Metrics**

#### **API Performance**
```json
{
  "api_latency": {
    "p50": 120,
    "p95": 350,
    "p99": 800,
    "unit": "ms"
  },
  "request_rate": {
    "current": 1500,
    "average": 1200,
    "unit": "req/min"
  },
  "error_rate": {
    "current": 0.05,
    "threshold": 1.0,
    "unit": "percent"
  }
}
```

#### **Database Performance**
```json
{
  "query_performance": {
    "avg_query_time": 45,
    "slow_queries": 12,
    "active_connections": 18,
    "max_connections": 100
  },
  "cache_hit_ratio": {
    "current": 95.5,
    "threshold": 90.0,
    "unit": "percent"
  }
}
```

#### **Email Delivery Metrics**
```json
{
  "email_stats": {
    "sent_per_hour": 12500,
    "delivery_rate": 97.5,
    "bounce_rate": 2.1,
    "open_rate": 24.5,
    "click_rate": 3.2
  },
  "provider_performance": {
    "resend": {
      "delivery_rate": 97.8,
      "avg_delivery_time": 2.3
    }
  }
}
```

#### **Queue Metrics**
```json
{
  "queue_health": {
    "email_queue": {
      "waiting": 250,
      "active": 10,
      "completed": 125000,
      "failed": 125,
      "processing_rate": 500
    },
    "import_queue": {
      "waiting": 5,
      "active": 2,
      "completed": 450,
      "failed": 12,
      "processing_rate": 100
    }
  }
}
```

### **Business Metrics**

#### **Lead Management**
```json
{
  "lead_metrics": {
    "total_leads": 1850000,
    "active_leads": 1780000,
    "growth_rate": 2.5,
    "import_success_rate": 98.2,
    "validation_error_rate": 1.8
  }
}
```

#### **Campaign Performance**
```json
{
  "campaign_metrics": {
    "active_campaigns": 15,
    "completed_campaigns": 125,
    "avg_open_rate": 24.5,
    "avg_click_rate": 3.2,
    "avg_conversion_rate": 1.1
  }
}
```

## 🚨 Sistema de Alertas

### **Configuração de Alertas**

#### **Alert Rules**
```json
{
  "alert_rules": [
    {
      "name": "High API Latency",
      "condition": "api_latency_p95 > 500",
      "severity": "warning",
      "cooldown": 300,
      "notifications": ["email", "slack"]
    },
    {
      "name": "Database Connection High",
      "condition": "db_connections > 80",
      "severity": "critical",
      "cooldown": 60,
      "notifications": ["email", "slack", "pagerduty"]
    },
    {
      "name": "Email Delivery Rate Low",
      "condition": "email_delivery_rate < 95",
      "severity": "warning",
      "cooldown": 600,
      "notifications": ["email"]
    },
    {
      "name": "Queue Depth High",
      "condition": "queue_depth > 1000",
      "severity": "critical",
      "cooldown": 300,
      "notifications": ["email", "slack"]
    }
  ]
}
```

#### **Notification Channels**
```json
{
  "notification_channels": {
    "email": {
      "recipients": ["ops@mailgenius.com", "dev@mailgenius.com"],
      "template": "alert_email_template"
    },
    "slack": {
      "webhook": "https://hooks.slack.com/services/...",
      "channel": "#alerts"
    },
    "pagerduty": {
      "service_key": "your-pagerduty-key",
      "escalation_policy": "default"
    }
  }
}
```

### **Tipos de Alertas**

#### **System Alerts**
- **High CPU Usage**: CPU > 80%
- **High Memory Usage**: Memory > 85%
- **Disk Space Low**: Disk usage > 90%
- **Database Connections**: Connections > 80
- **Redis Memory**: Memory usage > 75%

#### **Application Alerts**
- **API Response Time**: P95 > 500ms
- **Error Rate High**: Error rate > 1%
- **Queue Depth**: Queue depth > 1000
- **Worker Failures**: Worker failure rate > 5%

#### **Business Alerts**
- **Email Delivery Rate**: Delivery rate < 95%
- **Bounce Rate High**: Bounce rate > 5%
- **Import Failures**: Import failure rate > 5%
- **Campaign Failures**: Campaign failure rate > 2%

## 📋 Procedimentos de Troubleshooting

### **1. API Performance Issues**

#### **Symptoms**
- Slow response times
- High error rates
- Timeouts
- User complaints

#### **Diagnosis Steps**
```bash
# 1. Check API metrics
curl http://localhost:3000/api/monitoring/metrics

# 2. Check system resources
htop
free -h
df -h

# 3. Check database performance
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

# 4. Check Redis performance
redis-cli info stats
redis-cli slowlog get 10
```

#### **Resolution Steps**
```bash
# 1. Restart application if needed
pm2 restart mailgenius-app

# 2. Clear Redis cache if needed
redis-cli flushall

# 3. Check for blocking queries
SELECT * FROM pg_stat_activity WHERE state = 'active';

# 4. Scale workers if needed
pm2 scale mailgenius-app +2
```

### **2. Database Performance Issues**

#### **Symptoms**
- Slow query execution
- High connection usage
- Lock timeouts
- Memory issues

#### **Diagnosis Steps**
```sql
-- Check active connections
SELECT * FROM pg_stat_activity;

-- Check blocking queries
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Check table sizes
SELECT schemaname,tablename,attname,n_distinct,correlation FROM pg_stats;

-- Check slow queries
SELECT query, calls, total_time, mean_time, stddev_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;
```

#### **Resolution Steps**
```sql
-- Kill blocking queries if necessary
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 'blocking_pid';

-- Update table statistics
ANALYZE;

-- Vacuum if needed
VACUUM ANALYZE;

-- Reindex if needed
REINDEX DATABASE mailgenius;
```

### **3. Queue System Issues**

#### **Symptoms**
- Jobs stuck in queue
- High failure rates
- Workers not processing
- Memory leaks

#### **Diagnosis Steps**
```bash
# Check queue status
curl http://localhost:3000/api/queue/status

# Check Redis memory usage
redis-cli info memory

# Check worker processes
ps aux | grep worker

# Check logs
tail -f /var/log/mailgenius/workers.log
```

#### **Resolution Steps**
```bash
# Restart workers
pm2 restart mailgenius-workers

# Clear failed jobs
curl -X POST http://localhost:3000/api/queue/admin \
  -H "Content-Type: application/json" \
  -d '{"action": "clear", "queue": "email-sending", "type": "failed"}'

# Scale workers
pm2 scale mailgenius-workers +2

# Check for memory leaks
node --inspect scripts/start-workers.js
```

### **4. Email Delivery Issues**

#### **Symptoms**
- Low delivery rates
- High bounce rates
- Provider errors
- Slow sending

#### **Diagnosis Steps**
```bash
# Check email metrics
curl http://localhost:3000/api/monitoring/emails/metrics

# Check provider status
curl https://status.resend.com

# Check email logs
grep "email-worker" /var/log/mailgenius/combined.log

# Check DNS records
dig TXT _dmarc.yourdomain.com
dig TXT default._domainkey.yourdomain.com
```

#### **Resolution Steps**
```bash
# Retry failed emails
curl -X POST http://localhost:3000/api/campaigns/retry-failed

# Check email authentication
curl -X POST http://localhost:3000/api/email/test-authentication

# Update email settings
curl -X PUT http://localhost:3000/api/settings/email \
  -H "Content-Type: application/json" \
  -d '{"provider": "resend", "rate_limit": 100}'
```

### **5. Upload System Issues**

#### **Symptoms**
- Upload failures
- Slow processing
- Validation errors
- Memory issues

#### **Diagnosis Steps**
```bash
# Check upload metrics
curl http://localhost:3000/api/upload/monitoring

# Check disk space
df -h /tmp/uploads

# Check processing jobs
curl http://localhost:3000/api/queue/status

# Check memory usage
free -h
```

#### **Resolution Steps**
```bash
# Clean up temp files
find /tmp/uploads -name "*.tmp" -mtime +1 -delete

# Restart upload workers
pm2 restart upload-workers

# Increase memory limits
export NODE_OPTIONS="--max-old-space-size=8192"

# Clear stuck uploads
curl -X POST http://localhost:3000/api/upload/cleanup
```

## 🔧 Ferramentas de Monitoramento

### **1. Built-in Monitoring Dashboard**

#### **Acesso**
```
URL: /dashboard/monitoring
Features: Real-time metrics, alerts, logs, queue status
```

#### **Características**
- **Real-time Updates**: Atualização a cada 5 segundos
- **Historical Data**: Dados históricos de 24 horas
- **Export Capabilities**: Exportação de dados e logs
- **Alert Management**: Gerenciamento de alertas

### **2. Health Check Endpoints**

#### **System Health**
```bash
# Overall health
curl http://localhost:3000/api/health

# Database health
curl http://localhost:3000/api/health/database

# Redis health
curl http://localhost:3000/api/health/redis

# Queue health
curl http://localhost:3000/api/health/queue
```

#### **Service Status**
```bash
# Email service
curl http://localhost:3000/api/health/email

# Upload service
curl http://localhost:3000/api/health/upload

# Worker status
curl http://localhost:3000/api/health/workers
```

### **3. Command Line Tools**

#### **System Status**
```bash
# Check all services
./scripts/check-system-status.sh

# Check specific service
./scripts/check-service.sh database
./scripts/check-service.sh redis
./scripts/check-service.sh workers
```

#### **Performance Analysis**
```bash
# Database performance
./scripts/analyze-db-performance.sh

# API performance
./scripts/analyze-api-performance.sh

# Queue performance
./scripts/analyze-queue-performance.sh
```

### **4. Log Analysis**

#### **Log Locations**
```
Application: /var/log/mailgenius/app.log
Workers: /var/log/mailgenius/workers.log
Nginx: /var/log/nginx/mailgenius.log
Database: /var/log/postgresql/postgresql.log
Redis: /var/log/redis/redis.log
```

#### **Log Analysis Commands**
```bash
# Error analysis
grep "ERROR" /var/log/mailgenius/app.log | tail -100

# Performance analysis
grep "slow" /var/log/mailgenius/app.log | tail -50

# Email delivery analysis
grep "email-worker" /var/log/mailgenius/workers.log | tail -100

# API latency analysis
awk '{print $9}' /var/log/nginx/mailgenius.log | sort -n | tail -20
```

## 📈 Performance Optimization

### **1. Database Optimization**

#### **Query Optimization**
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY total_time DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Check table bloat
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(tablename::regclass))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

#### **Connection Pool Optimization**
```javascript
// Adjust pool settings
const poolConfig = {
  min: 10,
  max: 50,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
  createTimeoutMillis: 30000
};
```

### **2. Redis Optimization**

#### **Memory Optimization**
```bash
# Check memory usage
redis-cli info memory

# Set memory policy
redis-cli config set maxmemory-policy allkeys-lru

# Monitor slow operations
redis-cli slowlog get 10
```

#### **Connection Optimization**
```javascript
// Optimize Redis connection
const redisConfig = {
  host: 'localhost',
  port: 6379,
  db: 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  keepAlive: 30000
};
```

### **3. Application Optimization**

#### **Memory Management**
```javascript
// Monitor memory usage
const memoryUsage = process.memoryUsage();
console.log('Memory usage:', {
  rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
  heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
  heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
});

// Trigger garbage collection
if (global.gc) {
  global.gc();
}
```

#### **Worker Optimization**
```javascript
// Optimize worker concurrency
const workerConfig = {
  concurrency: 10,
  stalledInterval: 30000,
  maxStalledCount: 1,
  retryProcessDelay: 5000
};
```

## 🔄 Capacity Planning

### **1. Resource Monitoring**

#### **CPU and Memory**
```bash
# Monitor CPU usage
iostat -x 1

# Monitor memory usage
free -h

# Monitor disk usage
df -h
iostat -x 1
```

#### **Database Growth**
```sql
-- Monitor table growth
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- Monitor connection usage
SELECT count(*) as active_connections,
       max_conn.setting as max_connections,
       (count(*) * 100.0 / max_conn.setting::int) as usage_percent
FROM pg_stat_activity, 
     (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_conn
GROUP BY max_conn.setting;
```

### **2. Performance Projections**

#### **Lead Growth Projections**
```javascript
// Calculate storage needs
const leadsPerMonth = 100000;
const avgLeadSize = 1; // KB
const monthlyStorage = leadsPerMonth * avgLeadSize; // KB

// Project yearly growth
const yearlyGrowth = monthlyStorage * 12;
console.log(`Yearly storage growth: ${yearlyGrowth / 1024 / 1024} GB`);
```

#### **Email Volume Projections**
```javascript
// Calculate email processing needs
const emailsPerDay = 50000;
const peakMultiplier = 3;
const peakEmailsPerHour = (emailsPerDay * peakMultiplier) / 24;

console.log(`Peak emails per hour: ${peakEmailsPerHour}`);
console.log(`Required workers: ${Math.ceil(peakEmailsPerHour / 500)}`);
```

### **3. Scaling Recommendations**

#### **Horizontal Scaling**
```bash
# Load balancer configuration
upstream mailgenius {
    server 127.0.0.1:3000 weight=3;
    server 127.0.0.1:3001 weight=2;
    server 127.0.0.1:3002 weight=1;
}
```

#### **Database Scaling**
```sql
-- Read replica setup
CREATE SUBSCRIPTION mailgenius_replica
CONNECTION 'host=primary-db user=replica password=pass'
PUBLICATION mailgenius_pub;
```

## 🛠️ Maintenance Procedures

### **1. Regular Maintenance**

#### **Daily Tasks**
```bash
# Check system health
./scripts/health-check.sh

# Backup database
./scripts/backup-database.sh

# Clean up temp files
./scripts/cleanup-temp-files.sh

# Update metrics
./scripts/update-metrics.sh
```

#### **Weekly Tasks**
```bash
# Database maintenance
./scripts/db-maintenance.sh

# Log rotation
./scripts/rotate-logs.sh

# Performance analysis
./scripts/performance-report.sh

# Security audit
./scripts/security-check.sh
```

#### **Monthly Tasks**
```bash
# Full backup
./scripts/full-backup.sh

# Capacity planning
./scripts/capacity-analysis.sh

# Security updates
./scripts/security-updates.sh

# Performance optimization
./scripts/optimize-performance.sh
```

### **2. Emergency Procedures**

#### **Service Recovery**
```bash
# Quick recovery script
#!/bin/bash
./scripts/emergency-recovery.sh

# Steps:
# 1. Stop all services
# 2. Check data integrity
# 3. Restart services
# 4. Verify functionality
# 5. Alert team
```

#### **Data Recovery**
```bash
# Database recovery
./scripts/recover-database.sh

# Redis recovery
./scripts/recover-redis.sh

# File system recovery
./scripts/recover-files.sh
```

## 📊 Reporting e Analytics

### **1. Performance Reports**

#### **Daily Performance Report**
```bash
# Generate daily report
./scripts/generate-daily-report.sh

# Contents:
# - System performance metrics
# - Error rates and incidents
# - Email delivery statistics
# - Queue processing stats
# - Resource utilization
```

#### **Weekly Performance Report**
```bash
# Generate weekly report
./scripts/generate-weekly-report.sh

# Contents:
# - Performance trends
# - Capacity utilization
# - Optimization recommendations
# - Business metrics
# - Incident summary
```

### **2. Business Intelligence**

#### **Campaign Performance**
```sql
-- Campaign performance report
SELECT 
    c.name,
    c.total_recipients,
    c.delivered,
    c.opened,
    c.clicked,
    (c.delivered::float / c.total_recipients * 100) as delivery_rate,
    (c.opened::float / c.delivered * 100) as open_rate,
    (c.clicked::float / c.opened * 100) as click_rate
FROM campaigns c
WHERE c.sent_at >= NOW() - INTERVAL '30 days'
ORDER BY c.sent_at DESC;
```

#### **Lead Analytics**
```sql
-- Lead growth analysis
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as new_leads,
    SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('day', created_at)) as cumulative_leads
FROM leads
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date;
```

## 📞 Support e Escalation

### **1. Support Levels**

#### **L1 Support - Monitoring**
- **Responsibility**: Monitor dashboards, basic troubleshooting
- **Escalation**: If issue persists > 15 minutes
- **Tools**: Monitoring dashboard, basic scripts

#### **L2 Support - Technical**
- **Responsibility**: Advanced troubleshooting, performance optimization
- **Escalation**: If issue persists > 1 hour
- **Tools**: Database access, log analysis, performance tools

#### **L3 Support - Engineering**
- **Responsibility**: Code-level issues, architecture problems
- **Escalation**: Critical issues, data corruption
- **Tools**: Full system access, debugging tools

### **2. Escalation Procedures**

#### **Severity Levels**
- **Critical**: System down, data loss, security breach
- **High**: Significant performance degradation, feature unavailable
- **Medium**: Minor performance issues, non-critical bugs
- **Low**: Enhancement requests, minor issues

#### **Response Times**
- **Critical**: 15 minutes
- **High**: 1 hour
- **Medium**: 4 hours
- **Low**: 24 hours

### **3. Contact Information**

#### **On-Call Rotation**
```
Primary: ops-primary@mailgenius.com
Secondary: ops-secondary@mailgenius.com
Manager: ops-manager@mailgenius.com
```

#### **Communication Channels**
- **Slack**: #ops-alerts, #ops-general
- **Email**: ops@mailgenius.com
- **PagerDuty**: mailgenius-ops
- **Phone**: +1-XXX-XXX-XXXX

---

## 📚 Recursos Adicionais

### **Documentation**
- [System Architecture](./SYSTEM_ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Performance Configuration](./PERFORMANCE_CONFIGURATION.md)

### **Tools and Scripts**
- [Monitoring Scripts](../scripts/monitoring/)
- [Health Check Scripts](../scripts/health-check/)
- [Backup Scripts](../scripts/backup/)
- [Performance Scripts](../scripts/performance/)

---

**Atualizado**: 2024-07-16  
**Versão**: 2.0  
**Autor**: Ops Team  
**Status**: Produção Ready