# Database Optimization Implementation Guide

## 🚀 Step-by-Step Implementation for 2MM Contacts Support

This guide provides detailed instructions for implementing the database optimizations to support 2 million contacts in production.

## ⚠️ Pre-Implementation Checklist

### **Prerequisites**
- [ ] Database backup completed
- [ ] Maintenance window scheduled
- [ ] Application downtime planned (if needed)
- [ ] Resource monitoring in place
- [ ] Rollback plan prepared

### **Required Extensions**
```sql
-- Check if extensions exist
SELECT extname FROM pg_extension WHERE extname IN ('pg_partman', 'pg_stat_statements', 'btree_gin', 'btree_gist', 'pg_cron');

-- Install missing extensions (run as superuser)
CREATE EXTENSION IF NOT EXISTS "pg_partman";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
```

### **Database Configuration**
```sql
-- Check current settings
SELECT name, setting FROM pg_settings WHERE name IN ('max_connections', 'shared_buffers', 'effective_cache_size');

-- Apply optimizations (requires restart)
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '2GB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET max_parallel_workers = 8;

-- Reload configuration
SELECT pg_reload_conf();
```

## 📋 Implementation Steps

### **Step 1: Apply Main Migration**

```bash
# Navigate to project directory
cd /Users/oliveira/Documents/GitHub/mailgenius

# Apply the optimization migration
# Choose your preferred method:

# Method 1: Using Supabase CLI
supabase db push

# Method 2: Direct SQL execution
psql -h your-host -p 5432 -U your-user -d your-db -f database/migrations/009_database_optimization_2mm_contacts.sql

# Method 3: Using application migration system
npm run migrate
```

### **Step 2: Verify Index Creation**

```sql
-- Check if indexes were created successfully
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('leads', 'email_sends', 'lead_activities', 'campaigns')
ORDER BY tablename, indexname;

-- Verify index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE tablename IN ('leads', 'email_sends', 'lead_activities')
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

### **Step 3: Validate Partitioning**

```sql
-- Check partition tables were created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename LIKE 'email_sends_y%' OR tablename LIKE 'lead_activities_y%'
ORDER BY tablename;

-- Verify partition constraints
SELECT 
    schemaname,
    tablename,
    pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE contype = 'c'
AND (t.relname LIKE 'email_sends_y%' OR t.relname LIKE 'lead_activities_y%');
```

### **Step 4: Test Functions**

```sql
-- Test bulk lead import function
SELECT fast_bulk_lead_import(
    'your-workspace-id'::uuid,
    '[{"email": "test@example.com", "name": "Test User"}]'::jsonb
);

-- Test segmentation function
SELECT COUNT(*) FROM get_segmented_leads(
    'your-workspace-id'::uuid,
    '{"conditions": [{"field": "status", "operator": "equals", "value": "active"}]}'::jsonb,
    10,
    0
);

-- Test performance monitoring
SELECT * FROM get_database_performance_metrics();
```

### **Step 5: Configure Scheduled Jobs**

```sql
-- Verify pg_cron extension
SELECT * FROM cron.job ORDER BY jobid;

-- Check job schedules were created
SELECT 
    jobid,
    schedule,
    command,
    active
FROM cron.job
WHERE command LIKE '%perform_maintenance_tasks%'
   OR command LIKE '%refresh_analytics_views%'
   OR command LIKE '%create_monthly_partitions%';
```

## 🔍 Performance Validation

### **Query Performance Tests**

```sql
-- Test lead query performance (should be < 500ms for 2M records)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM leads 
WHERE workspace_id = 'your-workspace-id' 
AND status = 'active' 
ORDER BY created_at DESC 
LIMIT 50;

-- Test bulk operations performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM fast_bulk_lead_import(
    'your-workspace-id'::uuid,
    '[]'::jsonb -- Empty array for test
);

-- Test segmentation query performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM get_segmented_leads(
    'your-workspace-id'::uuid,
    '{"conditions": [{"field": "email", "operator": "contains", "value": "gmail"}]}'::jsonb,
    1000,
    0
);
```

### **Index Usage Verification**

```sql
-- Check index usage statistics
SELECT * FROM get_index_usage_stats() 
WHERE table_name LIKE '%leads%' 
ORDER BY index_scans DESC;

-- Verify query plans are using indexes
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM leads 
WHERE workspace_id = 'your-workspace-id' 
AND email = 'test@example.com';
```

## 🔄 Data Migration Strategy

### **For Existing Large Datasets**

If you have existing data that needs to be migrated to partitioned tables:

```sql
-- Step 1: Create a migration script
CREATE OR REPLACE FUNCTION migrate_existing_data()
RETURNS void AS $$
DECLARE
    batch_size INTEGER := 10000;
    total_rows INTEGER;
    processed_rows INTEGER := 0;
BEGIN
    -- Get total rows to migrate
    SELECT COUNT(*) INTO total_rows FROM email_sends;
    
    RAISE NOTICE 'Starting migration of % rows', total_rows;
    
    -- Migrate in batches
    WHILE processed_rows < total_rows LOOP
        -- Insert batch into partitioned table
        INSERT INTO email_sends_partitioned
        SELECT * FROM email_sends
        ORDER BY created_at
        LIMIT batch_size OFFSET processed_rows;
        
        processed_rows := processed_rows + batch_size;
        RAISE NOTICE 'Migrated % of % rows', processed_rows, total_rows;
        
        -- Commit batch
        COMMIT;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Step 2: Execute migration
SELECT migrate_existing_data();

-- Step 3: Verify data integrity
SELECT 
    COUNT(*) as original_count,
    (SELECT COUNT(*) FROM email_sends_partitioned) as migrated_count;

-- Step 4: Switch to partitioned table (after verification)
-- This requires application code changes
```

## 🎯 Application Integration

### **API Endpoints to Update**

#### **Bulk Lead Import**
```javascript
// Before: Individual inserts
for (const lead of leads) {
    await supabase.from('leads').insert(lead);
}

// After: Bulk operation
const result = await supabase.rpc('fast_bulk_lead_import', {
    p_workspace_id: workspaceId,
    p_leads_json: leads
});
```

#### **Lead Segmentation**
```javascript
// Before: Client-side filtering
const { data: allLeads } = await supabase
    .from('leads')
    .select('*')
    .eq('workspace_id', workspaceId);

// After: Server-side segmentation
const { data: segmentedLeads } = await supabase.rpc('get_segmented_leads', {
    p_workspace_id: workspaceId,
    p_segment_conditions: {
        conditions: [
            { field: 'status', operator: 'equals', value: 'active' },
            { field: 'tags', operator: 'contains', value: 'premium' }
        ]
    },
    p_limit: 1000,
    p_offset: 0
});
```

#### **Campaign Analytics**
```javascript
// Before: Multiple queries
const campaigns = await supabase.from('campaigns').select('*');
const analytics = await Promise.all(
    campaigns.map(c => calculateAnalytics(c))
);

// After: Optimized analytics function
const { data: analytics } = await supabase.rpc('get_campaign_analytics', {
    p_workspace_id: workspaceId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_group_by: 'day'
});
```

### **Environment Variables**

Add these to your `.env` file:

```bash
# Database optimizations
DB_MAX_CONNECTIONS=200
DB_SHARED_BUFFERS=512MB
DB_EFFECTIVE_CACHE_SIZE=2GB

# Connection pooling
DB_POOL_SIZE=20
DB_POOL_TIMEOUT=30000

# Performance monitoring
ENABLE_QUERY_MONITORING=true
SLOW_QUERY_THRESHOLD=1000
```

## 🏥 Health Checks

### **Daily Health Check Script**

```sql
-- Create health check function
CREATE OR REPLACE FUNCTION daily_health_check()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    
    -- Check connection pool usage
    SELECT 
        'connection_pool'::TEXT,
        CASE 
            WHEN connection_usage_percent < 80 THEN 'HEALTHY'
            WHEN connection_usage_percent < 95 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        'Usage: ' || connection_usage_percent || '%',
        NOW()
    FROM get_connection_pool_status();
    
    -- Check database size growth
    SELECT 
        'database_size'::TEXT,
        'INFO'::TEXT,
        'Size: ' || pg_size_pretty(pg_database_size(current_database())),
        NOW();
    
    -- Check slow queries
    SELECT 
        'slow_queries'::TEXT,
        CASE 
            WHEN COUNT(*) = 0 THEN 'HEALTHY'
            WHEN COUNT(*) < 10 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        'Slow queries: ' || COUNT(*),
        NOW()
    FROM pg_stat_statements
    WHERE mean_exec_time > 5000; -- 5 seconds
    
    -- Check index usage
    SELECT 
        'index_usage'::TEXT,
        CASE 
            WHEN AVG(idx_scan) > 100 THEN 'HEALTHY'
            WHEN AVG(idx_scan) > 10 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        'Average index scans: ' || ROUND(AVG(idx_scan)),
        NOW()
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public';
    
END;
$$ LANGUAGE plpgsql;

-- Run health check
SELECT * FROM daily_health_check();
```

## 📊 Monitoring Setup

### **Grafana Dashboard Queries**

```sql
-- Database size over time
SELECT 
    DATE_TRUNC('hour', NOW()) as time,
    pg_database_size(current_database()) / 1024 / 1024 as size_mb;

-- Query performance metrics
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Connection pool metrics
SELECT 
    state,
    COUNT(*) as count
FROM pg_stat_activity
GROUP BY state;
```

### **Alerting Rules**

```yaml
# Example Prometheus alerting rules
groups:
  - name: mailgenius-database
    rules:
      - alert: HighConnectionUsage
        expr: (pg_stat_activity_count / pg_settings_max_connections) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connection usage"
          
      - alert: SlowQueryDetected
        expr: pg_stat_statements_mean_exec_time > 5000
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Slow query detected"
```

## 🔧 Troubleshooting

### **Common Issues**

#### **Issue: Indexes not being used**
```sql
-- Check if statistics are up to date
SELECT 
    schemaname,
    tablename,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename = 'leads';

-- Update statistics
ANALYZE leads;
```

#### **Issue: Partitioning not working**
```sql
-- Check partition constraints
SELECT 
    conname,
    pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'email_sends_y2024m01'::regclass;

-- Test partition routing
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM email_sends_partitioned
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31';
```

#### **Issue: Performance degradation**
```sql
-- Check for bloated tables
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Rebuild indexes if needed
REINDEX TABLE CONCURRENTLY leads;
```

## 🔄 Rollback Plan

### **If Issues Occur**

1. **Disable scheduled jobs**
```sql
SELECT cron.unschedule('daily-maintenance');
SELECT cron.unschedule('refresh-analytics');
SELECT cron.unschedule('create-partitions');
```

2. **Revert to original indexes**
```sql
-- Drop new indexes
DROP INDEX CONCURRENTLY idx_leads_workspace_status_email;
DROP INDEX CONCURRENTLY idx_leads_workspace_created_at;
-- ... other indexes

-- Recreate original indexes
CREATE INDEX idx_leads_workspace_email ON leads(workspace_id, email);
CREATE INDEX idx_leads_workspace_status ON leads(workspace_id, status);
CREATE INDEX idx_leads_workspace_tags ON leads USING GIN(tags);
```

3. **Restore configuration**
```sql
-- Revert database settings
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '128MB';
SELECT pg_reload_conf();
```

## ✅ Success Criteria

### **Performance Benchmarks**
- [ ] Lead queries < 500ms for 2M records
- [ ] Bulk imports < 15s for 100K leads
- [ ] Segmentation queries < 3s
- [ ] Campaign sends < 3min for 1M recipients
- [ ] Connection pool usage < 80%

### **Functionality Tests**
- [ ] All existing features work correctly
- [ ] Bulk operations complete successfully
- [ ] Segmentation returns correct results
- [ ] Analytics views are accurate
- [ ] Scheduled jobs run without errors

### **Monitoring Validation**
- [ ] Performance metrics are collected
- [ ] Health checks pass
- [ ] Alerting rules are active
- [ ] Dashboard shows correct data

---

**Implementation Status**: Ready for Production  
**Estimated Time**: 2-4 hours (depending on data size)  
**Downtime Required**: 30-60 minutes for configuration changes  
**Rollback Time**: 15-30 minutes if needed