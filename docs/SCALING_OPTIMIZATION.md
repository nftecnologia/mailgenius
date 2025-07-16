# MailGenius - Guia de Scaling e Otimização

## 🚀 Visão Geral do Scaling

Este guia apresenta estratégias avançadas de scaling e otimização para o MailGenius, permitindo crescimento de 2MM para 10MM+ contatos. Inclui técnicas de scaling horizontal, vertical, otimizações de arquitetura e estratégias de performance.

## 📊 Targets de Scaling

### **Objetivos de Capacidade**
- **Atual**: 2MM contatos por workspace
- **Próximo**: 5MM contatos por workspace
- **Futuro**: 10MM+ contatos por workspace
- **Throughput**: 50,000+ emails/hora
- **Concurrent Users**: 500+ usuários simultâneos

### **Métricas de Performance**
- **Database Response**: <200ms para 10MM+ registros
- **API Latency**: <100ms (p95)
- **Email Processing**: 100K+ emails/hora
- **Bulk Operations**: 1MM+ leads em <60 segundos
- **Uptime**: 99.99% SLA

## 🏗️ Arquitetura de Scaling

### **1. Microservices Architecture**

#### **Service Decomposition**
```
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway (Nginx)                       │
├─────────────────────────────────────────────────────────────┤
│  • Rate Limiting    • Load Balancing                       │
│  • Authentication   • SSL Termination                      │
│  • Request Routing  • Caching                              │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                 Core Services                               │
├─────────────────────────────────────────────────────────────┤
│  • User Service     • Campaign Service                     │
│  • Lead Service     • Template Service                     │
│  • Email Service    • Analytics Service                    │
│  • Upload Service   • Monitoring Service                   │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                Background Services                          │
├─────────────────────────────────────────────────────────────┤
│  • Queue Workers    • Email Workers                        │
│  • Import Workers   • Analytics Workers                    │
│  • Cleanup Workers  • Monitoring Workers                   │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                  Data Layer                                 │
├─────────────────────────────────────────────────────────────┤
│  • Primary DB       • Read Replicas                        │
│  • Cache Layer      • Message Queues                       │
│  • File Storage     • Analytics Store                      │
└─────────────────────────────────────────────────────────────┘
```

#### **Service Configuration**
```javascript
// services/config.js
const SERVICES_CONFIG = {
  // User Service
  user_service: {
    instances: 3,
    memory: '512MB',
    cpu: '0.5',
    ports: [3001, 3002, 3003]
  },
  
  // Lead Service
  lead_service: {
    instances: 5,
    memory: '1GB',
    cpu: '1.0',
    ports: [3011, 3012, 3013, 3014, 3015]
  },
  
  // Email Service
  email_service: {
    instances: 10,
    memory: '2GB',
    cpu: '2.0',
    ports: [3021, 3022, 3023, 3024, 3025, 3026, 3027, 3028, 3029, 3030]
  },
  
  // Campaign Service
  campaign_service: {
    instances: 4,
    memory: '1GB',
    cpu: '1.0',
    ports: [3031, 3032, 3033, 3034]
  },
  
  // Upload Service
  upload_service: {
    instances: 3,
    memory: '2GB',
    cpu: '1.5',
    ports: [3041, 3042, 3043]
  },
  
  // Analytics Service
  analytics_service: {
    instances: 2,
    memory: '1GB',
    cpu: '0.5',
    ports: [3051, 3052]
  }
};

module.exports = SERVICES_CONFIG;
```

### **2. Database Scaling Strategy**

#### **Read Replicas Configuration**
```sql
-- Primary Database Configuration
-- postgresql.conf
wal_level = replica
max_wal_senders = 10
wal_keep_segments = 100
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'

-- Create replication user
CREATE USER replica_user REPLICATION LOGIN ENCRYPTED PASSWORD 'replica_password';

-- Create replication slots
SELECT pg_create_physical_replication_slot('replica_slot_1');
SELECT pg_create_physical_replication_slot('replica_slot_2');
SELECT pg_create_physical_replication_slot('replica_slot_3');
```

#### **Replica Setup Script**
```bash
#!/bin/bash
# scripts/setup-replica.sh

REPLICA_NAME=$1
REPLICA_PORT=$2
MASTER_HOST="localhost"
MASTER_PORT="5432"

echo "Setting up replica: $REPLICA_NAME on port $REPLICA_PORT"

# Create replica directory
sudo mkdir -p /var/lib/postgresql/replicas/$REPLICA_NAME

# Stop replica if running
sudo pg_ctlcluster 13 $REPLICA_NAME stop

# Base backup from master
sudo -u postgres pg_basebackup -h $MASTER_HOST -p $MASTER_PORT -D /var/lib/postgresql/replicas/$REPLICA_NAME -U replica_user -W -v -P

# Create recovery.conf
cat > /var/lib/postgresql/replicas/$REPLICA_NAME/recovery.conf << EOF
standby_mode = 'on'
primary_conninfo = 'host=$MASTER_HOST port=$MASTER_PORT user=replica_user password=replica_password'
primary_slot_name = 'replica_slot_1'
EOF

# Create postgresql.conf for replica
cat > /var/lib/postgresql/replicas/$REPLICA_NAME/postgresql.conf << EOF
port = $REPLICA_PORT
hot_standby = on
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 32
EOF

# Start replica
sudo pg_ctlcluster 13 $REPLICA_NAME start

echo "Replica $REPLICA_NAME setup completed on port $REPLICA_PORT"
```

#### **Database Sharding Strategy**
```javascript
// lib/database/sharding.js
const ShardManager = {
  // Shard configuration
  shards: {
    shard_1: {
      host: 'shard1.mailgenius.com',
      port: 5432,
      database: 'mailgenius_shard_1',
      range: { start: 0, end: 2000000 }
    },
    shard_2: {
      host: 'shard2.mailgenius.com',
      port: 5432,
      database: 'mailgenius_shard_2',
      range: { start: 2000001, end: 4000000 }
    },
    shard_3: {
      host: 'shard3.mailgenius.com',
      port: 5432,
      database: 'mailgenius_shard_3',
      range: { start: 4000001, end: 6000000 }
    },
    shard_4: {
      host: 'shard4.mailgenius.com',
      port: 5432,
      database: 'mailgenius_shard_4',
      range: { start: 6000001, end: 8000000 }
    },
    shard_5: {
      host: 'shard5.mailgenius.com',
      port: 5432,
      database: 'mailgenius_shard_5',
      range: { start: 8000001, end: 10000000 }
    }
  },
  
  // Shard selection logic
  getShardForWorkspace(workspaceId) {
    const hash = this.hashWorkspace(workspaceId);
    const shardIndex = hash % Object.keys(this.shards).length;
    return Object.keys(this.shards)[shardIndex];
  },
  
  // Hash function for consistent sharding
  hashWorkspace(workspaceId) {
    let hash = 0;
    for (let i = 0; i < workspaceId.length; i++) {
      const char = workspaceId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  },
  
  // Get connection for shard
  getConnection(shardName) {
    const shard = this.shards[shardName];
    return new Pool({
      host: shard.host,
      port: shard.port,
      database: shard.database,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  },
  
  // Cross-shard query execution
  async executeCrossShardQuery(query, params) {
    const results = [];
    
    for (const shardName of Object.keys(this.shards)) {
      const connection = this.getConnection(shardName);
      try {
        const result = await connection.query(query, params);
        results.push({
          shard: shardName,
          data: result.rows
        });
      } catch (error) {
        console.error(`Error executing query on shard ${shardName}:`, error);
        results.push({
          shard: shardName,
          error: error.message
        });
      }
    }
    
    return results;
  }
};

module.exports = ShardManager;
```

### **3. Cache Layer Optimization**

#### **Multi-Level Caching**
```javascript
// lib/cache/multi-level-cache.js
const Redis = require('ioredis');
const LRU = require('lru-cache');

class MultiLevelCache {
  constructor() {
    // L1 Cache - In-memory (fastest)
    this.l1Cache = new LRU({
      max: 10000,
      ttl: 5 * 60 * 1000 // 5 minutes
    });
    
    // L2 Cache - Redis (fast)
    this.l2Cache = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
    
    // L3 Cache - Database (slow but persistent)
    this.l3Cache = require('../database/pool');
  }
  
  async get(key) {
    // Try L1 cache first
    let value = this.l1Cache.get(key);
    if (value) {
      return { value, source: 'L1' };
    }
    
    // Try L2 cache
    value = await this.l2Cache.get(key);
    if (value) {
      // Promote to L1
      this.l1Cache.set(key, JSON.parse(value));
      return { value: JSON.parse(value), source: 'L2' };
    }
    
    // Try L3 cache (database)
    const result = await this.l3Cache.query(
      'SELECT value, expires_at FROM cache_table WHERE key = $1',
      [key]
    );
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      if (new Date(row.expires_at) > new Date()) {
        value = JSON.parse(row.value);
        
        // Promote to L2 and L1
        await this.l2Cache.setex(key, 3600, JSON.stringify(value));
        this.l1Cache.set(key, value);
        
        return { value, source: 'L3' };
      }
    }
    
    return { value: null, source: 'MISS' };
  }
  
  async set(key, value, ttl = 3600) {
    // Set in all cache levels
    this.l1Cache.set(key, value);
    await this.l2Cache.setex(key, ttl, JSON.stringify(value));
    
    // Set in L3 with expiration
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.l3Cache.query(
      'INSERT INTO cache_table (key, value, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = $3',
      [key, JSON.stringify(value), expiresAt]
    );
  }
  
  async delete(key) {
    // Delete from all cache levels
    this.l1Cache.delete(key);
    await this.l2Cache.del(key);
    await this.l3Cache.query('DELETE FROM cache_table WHERE key = $1', [key]);
  }
  
  async clear() {
    // Clear all cache levels
    this.l1Cache.clear();
    await this.l2Cache.flushdb();
    await this.l3Cache.query('DELETE FROM cache_table');
  }
}

module.exports = MultiLevelCache;
```

#### **Cache Strategies**
```javascript
// lib/cache/strategies.js
const CacheStrategies = {
  // Cache-aside pattern
  cacheAside: {
    async get(key, fetchFunction, ttl = 3600) {
      const cached = await cache.get(key);
      if (cached.value) {
        return cached.value;
      }
      
      const data = await fetchFunction();
      await cache.set(key, data, ttl);
      return data;
    }
  },
  
  // Write-through pattern
  writeThrough: {
    async set(key, value, persistFunction, ttl = 3600) {
      await cache.set(key, value, ttl);
      await persistFunction(value);
    }
  },
  
  // Write-behind pattern
  writeBehind: {
    async set(key, value, persistFunction, ttl = 3600) {
      await cache.set(key, value, ttl);
      
      // Queue for async persistence
      await queue.add('persist-data', {
        key,
        value,
        persistFunction: persistFunction.toString()
      });
    }
  },
  
  // Cache warming
  warmCache: {
    async warmLeadCache(workspaceId) {
      const leads = await database.query(
        'SELECT * FROM leads WHERE workspace_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1000',
        [workspaceId, 'active']
      );
      
      for (const lead of leads.rows) {
        await cache.set(`lead:${lead.id}`, lead, 3600);
      }
    },
    
    async warmCampaignCache(workspaceId) {
      const campaigns = await database.query(
        'SELECT * FROM campaigns WHERE workspace_id = $1 AND status IN ($2, $3) ORDER BY created_at DESC LIMIT 100',
        [workspaceId, 'active', 'scheduled']
      );
      
      for (const campaign of campaigns.rows) {
        await cache.set(`campaign:${campaign.id}`, campaign, 1800);
      }
    }
  }
};

module.exports = CacheStrategies;
```

### **4. Queue System Scaling**

#### **Distributed Queue Architecture**
```javascript
// lib/queue/distributed-queue.js
const Bull = require('bull');
const Redis = require('ioredis');

class DistributedQueue {
  constructor() {
    // Multiple Redis instances for queue distribution
    this.redisInstances = [
      new Redis({
        host: process.env.REDIS_QUEUE_1_HOST,
        port: process.env.REDIS_QUEUE_1_PORT,
        password: process.env.REDIS_QUEUE_1_PASSWORD
      }),
      new Redis({
        host: process.env.REDIS_QUEUE_2_HOST,
        port: process.env.REDIS_QUEUE_2_PORT,
        password: process.env.REDIS_QUEUE_2_PASSWORD
      }),
      new Redis({
        host: process.env.REDIS_QUEUE_3_HOST,
        port: process.env.REDIS_QUEUE_3_PORT,
        password: process.env.REDIS_QUEUE_3_PASSWORD
      })
    ];
    
    // Create distributed queues
    this.queues = {
      email: this.createDistributedQueue('email-queue'),
      import: this.createDistributedQueue('import-queue'),
      analytics: this.createDistributedQueue('analytics-queue')
    };
  }
  
  createDistributedQueue(queueName) {
    return this.redisInstances.map((redis, index) => 
      new Bull(`${queueName}-${index}`, {
        redis: {
          port: redis.options.port,
          host: redis.options.host,
          password: redis.options.password
        },
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      })
    );
  }
  
  // Distribute jobs across queue instances
  async addJob(queueType, jobData, options = {}) {
    const queues = this.queues[queueType];
    const queueIndex = this.getQueueIndex(jobData);
    const queue = queues[queueIndex];
    
    return await queue.add(jobData, options);
  }
  
  // Load balancing logic
  getQueueIndex(jobData) {
    // Use workspace_id for consistent hashing
    if (jobData.workspace_id) {
      return this.hashString(jobData.workspace_id) % this.redisInstances.length;
    }
    
    // Random distribution as fallback
    return Math.floor(Math.random() * this.redisInstances.length);
  }
  
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Process jobs with auto-scaling
  setupProcessors() {
    // Email processing with high concurrency
    this.queues.email.forEach((queue, index) => {
      queue.process('send-email', 50, async (job) => {
        return await this.processEmailJob(job);
      });
    });
    
    // Import processing with medium concurrency
    this.queues.import.forEach((queue, index) => {
      queue.process('import-leads', 10, async (job) => {
        return await this.processImportJob(job);
      });
    });
    
    // Analytics processing with low concurrency
    this.queues.analytics.forEach((queue, index) => {
      queue.process('calculate-analytics', 5, async (job) => {
        return await this.processAnalyticsJob(job);
      });
    });
  }
  
  async processEmailJob(job) {
    const { emailData, campaignId, leadId } = job.data;
    
    try {
      const result = await emailService.sendEmail(emailData);
      
      // Update campaign metrics
      await this.updateCampaignMetrics(campaignId, 'sent');
      
      return result;
    } catch (error) {
      await this.updateCampaignMetrics(campaignId, 'failed');
      throw error;
    }
  }
  
  async processImportJob(job) {
    const { filePath, workspaceId, importConfig } = job.data;
    
    const processor = new CSVProcessor({
      batchSize: 5000,
      concurrency: 10,
      validation: importConfig.validation
    });
    
    return await processor.processFile(filePath);
  }
  
  async processAnalyticsJob(job) {
    const { workspaceId, analyticsType, dateRange } = job.data;
    
    const calculator = new AnalyticsCalculator();
    return await calculator.calculate(workspaceId, analyticsType, dateRange);
  }
  
  // Queue monitoring and auto-scaling
  async monitorQueues() {
    setInterval(async () => {
      for (const queueType in this.queues) {
        const queues = this.queues[queueType];
        
        for (const queue of queues) {
          const waiting = await queue.getWaiting();
          const active = await queue.getActive();
          
          // Auto-scale based on queue depth
          if (waiting.length > 1000) {
            await this.scaleUp(queueType);
          } else if (waiting.length < 100 && active.length < 10) {
            await this.scaleDown(queueType);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  async scaleUp(queueType) {
    console.log(`Scaling up ${queueType} queue processing`);
    // Implementation depends on your deployment strategy
    // Could spawn new worker processes or increase concurrency
  }
  
  async scaleDown(queueType) {
    console.log(`Scaling down ${queueType} queue processing`);
    // Implementation depends on your deployment strategy
    // Could terminate worker processes or decrease concurrency
  }
}

module.exports = DistributedQueue;
```

## 🔧 Advanced Optimizations

### **1. Database Optimizations**

#### **Query Optimization**
```sql
-- Advanced indexing for 10MM+ records
CREATE INDEX CONCURRENTLY idx_leads_workspace_status_created_btree 
ON leads USING btree (workspace_id, status, created_at DESC)
WHERE status IN ('active', 'unsubscribed');

-- Partial index for active leads only
CREATE INDEX CONCURRENTLY idx_leads_active_email_gin 
ON leads USING gin(email gin_trgm_ops)
WHERE status = 'active';

-- Composite index for campaign queries
CREATE INDEX CONCURRENTLY idx_campaigns_workspace_status_send_at 
ON campaigns (workspace_id, status, send_at)
WHERE status IN ('scheduled', 'sending');

-- Index for email sends optimization
CREATE INDEX CONCURRENTLY idx_email_sends_campaign_status_created 
ON email_sends (campaign_id, status, created_at DESC)
WHERE status IN ('sent', 'delivered', 'opened');

-- Expression index for analytics
CREATE INDEX CONCURRENTLY idx_lead_activities_workspace_date_trunc 
ON lead_activities (workspace_id, date_trunc('day', created_at))
WHERE activity_type IN ('email_sent', 'email_opened', 'email_clicked');
```

#### **Query Optimization Functions**
```sql
-- Function for optimized lead search
CREATE OR REPLACE FUNCTION search_leads_optimized(
    p_workspace_id UUID,
    p_search_term TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE(
    id UUID,
    email CITEXT,
    name TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_leads AS (
        SELECT l.id, l.email, l.name, l.status, l.created_at
        FROM leads l
        WHERE l.workspace_id = p_workspace_id
        AND (p_status IS NULL OR l.status = p_status)
        AND (p_search_term IS NULL OR (
            l.email ILIKE '%' || p_search_term || '%' OR
            l.name ILIKE '%' || p_search_term || '%'
        ))
        AND (p_tags IS NULL OR l.tags && p_tags)
        ORDER BY l.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ),
    total_count AS (
        SELECT COUNT(*) as count
        FROM leads l
        WHERE l.workspace_id = p_workspace_id
        AND (p_status IS NULL OR l.status = p_status)
        AND (p_search_term IS NULL OR (
            l.email ILIKE '%' || p_search_term || '%' OR
            l.name ILIKE '%' || p_search_term || '%'
        ))
        AND (p_tags IS NULL OR l.tags && p_tags)
    )
    SELECT fl.id, fl.email, fl.name, fl.status, fl.created_at, tc.count
    FROM filtered_leads fl
    CROSS JOIN total_count tc;
END;
$$ LANGUAGE plpgsql;

-- Function for bulk lead operations
CREATE OR REPLACE FUNCTION bulk_update_leads(
    p_workspace_id UUID,
    p_lead_ids UUID[],
    p_updates JSONB
) RETURNS TABLE(
    updated_count INTEGER,
    error_count INTEGER
) AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_lead_id UUID;
BEGIN
    FOREACH v_lead_id IN ARRAY p_lead_ids
    LOOP
        BEGIN
            UPDATE leads
            SET
                name = COALESCE((p_updates->>'name')::TEXT, name),
                status = COALESCE((p_updates->>'status')::TEXT, status),
                tags = COALESCE((p_updates->>'tags')::TEXT[], tags),
                custom_fields = COALESCE(p_updates->'custom_fields', custom_fields),
                updated_at = NOW()
            WHERE id = v_lead_id AND workspace_id = p_workspace_id;
            
            IF FOUND THEN
                v_updated_count := v_updated_count + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            RAISE NOTICE 'Error updating lead %: %', v_lead_id, SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_updated_count, v_error_count;
END;
$$ LANGUAGE plpgsql;
```

### **2. Connection Pool Optimization**

#### **Advanced Connection Pool**
```javascript
// lib/database/advanced-pool.js
const { Pool } = require('pg');
const EventEmitter = require('events');

class AdvancedConnectionPool extends EventEmitter {
  constructor(config) {
    super();
    
    // Read pool for read-only queries
    this.readPool = new Pool({
      ...config,
      host: config.readHost || config.host,
      port: config.readPort || config.port,
      min: config.readMin || 10,
      max: config.readMax || 30,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 3000,
      application_name: 'mailgenius-read'
    });
    
    // Write pool for write operations
    this.writePool = new Pool({
      ...config,
      host: config.writeHost || config.host,
      port: config.writePort || config.port,
      min: config.writeMin || 5,
      max: config.writeMax || 20,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 5000,
      application_name: 'mailgenius-write'
    });
    
    // Analytics pool for heavy analytical queries
    this.analyticsPool = new Pool({
      ...config,
      host: config.analyticsHost || config.host,
      port: config.analyticsPort || config.port,
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      application_name: 'mailgenius-analytics'
    });
    
    this.setupEventHandlers();
    this.setupHealthChecks();
  }
  
  setupEventHandlers() {
    [this.readPool, this.writePool, this.analyticsPool].forEach((pool, index) => {
      const poolName = ['read', 'write', 'analytics'][index];
      
      pool.on('connect', (client) => {
        console.log(`${poolName} pool: client connected`);
        this.emit('connect', { pool: poolName, client });
      });
      
      pool.on('acquire', (client) => {
        console.log(`${poolName} pool: client acquired`);
        this.emit('acquire', { pool: poolName, client });
      });
      
      pool.on('error', (err, client) => {
        console.error(`${poolName} pool error:`, err);
        this.emit('error', { pool: poolName, error: err, client });
      });
      
      pool.on('remove', (client) => {
        console.log(`${poolName} pool: client removed`);
        this.emit('remove', { pool: poolName, client });
      });
    });
  }
  
  setupHealthChecks() {
    setInterval(async () => {
      await this.checkPoolHealth();
    }, 30000); // Check every 30 seconds
  }
  
  async checkPoolHealth() {
    const pools = [
      { name: 'read', pool: this.readPool },
      { name: 'write', pool: this.writePool },
      { name: 'analytics', pool: this.analyticsPool }
    ];
    
    for (const { name, pool } of pools) {
      try {
        const start = Date.now();
        await pool.query('SELECT 1');
        const duration = Date.now() - start;
        
        if (duration > 5000) {
          console.warn(`${name} pool health check slow: ${duration}ms`);
        }
        
        this.emit('healthCheck', {
          pool: name,
          status: 'healthy',
          duration,
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        });
      } catch (error) {
        console.error(`${name} pool health check failed:`, error);
        this.emit('healthCheck', {
          pool: name,
          status: 'unhealthy',
          error: error.message
        });
      }
    }
  }
  
  // Smart query routing
  async query(text, params, options = {}) {
    const { queryType = 'read', timeout = 30000 } = options;
    
    let pool;
    if (queryType === 'write' || this.isWriteQuery(text)) {
      pool = this.writePool;
    } else if (queryType === 'analytics' || this.isAnalyticsQuery(text)) {
      pool = this.analyticsPool;
    } else {
      pool = this.readPool;
    }
    
    const client = await pool.connect();
    
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query detected: ${duration}ms`, {
          query: text,
          params: params,
          pool: queryType
        });
      }
      
      return result;
    } finally {
      client.release();
    }
  }
  
  isWriteQuery(query) {
    const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE'];
    const upperQuery = query.toUpperCase().trim();
    return writeKeywords.some(keyword => upperQuery.startsWith(keyword));
  }
  
  isAnalyticsQuery(query) {
    const analyticsKeywords = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'GROUP BY', 'ORDER BY', 'HAVING'];
    const upperQuery = query.toUpperCase();
    return analyticsKeywords.some(keyword => upperQuery.includes(keyword));
  }
  
  // Transaction support
  async transaction(callback, options = {}) {
    const client = await this.writePool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Batch operations
  async batch(queries, options = {}) {
    const { batchSize = 100, queryType = 'write' } = options;
    const results = [];
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(({ query, params }) => this.query(query, params, { queryType }))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  // Pool statistics
  getPoolStats() {
    return {
      read: {
        totalCount: this.readPool.totalCount,
        idleCount: this.readPool.idleCount,
        waitingCount: this.readPool.waitingCount
      },
      write: {
        totalCount: this.writePool.totalCount,
        idleCount: this.writePool.idleCount,
        waitingCount: this.writePool.waitingCount
      },
      analytics: {
        totalCount: this.analyticsPool.totalCount,
        idleCount: this.analyticsPool.idleCount,
        waitingCount: this.analyticsPool.waitingCount
      }
    };
  }
  
  async close() {
    await Promise.all([
      this.readPool.end(),
      this.writePool.end(),
      this.analyticsPool.end()
    ]);
  }
}

module.exports = AdvancedConnectionPool;
```

### **3. Performance Monitoring**

#### **Advanced Metrics Collection**
```javascript
// lib/monitoring/advanced-metrics.js
const client = require('prom-client');

class AdvancedMetrics {
  constructor() {
    // Database metrics
    this.dbQueryDuration = new client.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'pool', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10]
    });
    
    this.dbConnectionsActive = new client.Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      labelNames: ['pool']
    });
    
    // API metrics
    this.apiRequestDuration = new client.Histogram({
      name: 'api_request_duration_seconds',
      help: 'Duration of API requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10]
    });
    
    this.apiRequestsTotal = new client.Counter({
      name: 'api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['method', 'route', 'status_code']
    });
    
    // Queue metrics
    this.queueJobsProcessed = new client.Counter({
      name: 'queue_jobs_processed_total',
      help: 'Total number of queue jobs processed',
      labelNames: ['queue', 'status']
    });
    
    this.queueJobDuration = new client.Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Duration of queue job processing in seconds',
      labelNames: ['queue', 'job_type'],
      buckets: [0.1, 1, 5, 10, 30, 60, 300]
    });
    
    // Email metrics
    this.emailsSent = new client.Counter({
      name: 'emails_sent_total',
      help: 'Total number of emails sent',
      labelNames: ['provider', 'campaign_type']
    });
    
    this.emailDeliveryRate = new client.Gauge({
      name: 'email_delivery_rate',
      help: 'Email delivery rate percentage',
      labelNames: ['provider']
    });
    
    // Business metrics
    this.leadsTotal = new client.Gauge({
      name: 'leads_total',
      help: 'Total number of leads',
      labelNames: ['workspace', 'status']
    });
    
    this.campaignsActive = new client.Gauge({
      name: 'campaigns_active',
      help: 'Number of active campaigns',
      labelNames: ['workspace']
    });
    
    // System metrics
    this.memoryUsage = new client.Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Node.js memory usage in bytes',
      labelNames: ['type']
    });
    
    this.cpuUsage = new client.Gauge({
      name: 'nodejs_cpu_usage_percent',
      help: 'Node.js CPU usage percentage'
    });
    
    this.setupAutomaticCollection();
  }
  
  setupAutomaticCollection() {
    // Collect system metrics every 10 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);
    
    // Collect business metrics every 30 seconds
    setInterval(() => {
      this.collectBusinessMetrics();
    }, 30000);
  }
  
  collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    this.memoryUsage.set({ type: 'rss' }, memoryUsage.rss);
    this.memoryUsage.set({ type: 'heapTotal' }, memoryUsage.heapTotal);
    this.memoryUsage.set({ type: 'heapUsed' }, memoryUsage.heapUsed);
    this.memoryUsage.set({ type: 'external' }, memoryUsage.external);
    
    const cpuUsage = process.cpuUsage();
    this.cpuUsage.set((cpuUsage.user + cpuUsage.system) / 1000000);
  }
  
  async collectBusinessMetrics() {
    try {
      // Collect lead metrics
      const leadStats = await db.query(`
        SELECT 
          workspace_id,
          status,
          COUNT(*) as count
        FROM leads
        GROUP BY workspace_id, status
      `);
      
      for (const row of leadStats.rows) {
        this.leadsTotal.set(
          { workspace: row.workspace_id, status: row.status },
          parseInt(row.count)
        );
      }
      
      // Collect campaign metrics
      const campaignStats = await db.query(`
        SELECT 
          workspace_id,
          COUNT(*) as count
        FROM campaigns
        WHERE status IN ('active', 'scheduled', 'sending')
        GROUP BY workspace_id
      `);
      
      for (const row of campaignStats.rows) {
        this.campaignsActive.set(
          { workspace: row.workspace_id },
          parseInt(row.count)
        );
      }
    } catch (error) {
      console.error('Error collecting business metrics:', error);
    }
  }
  
  // Middleware for API metrics
  apiMetricsMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;
        
        this.apiRequestDuration.observe(
          { method: req.method, route, status_code: res.statusCode },
          duration
        );
        
        this.apiRequestsTotal.inc({
          method: req.method,
          route,
          status_code: res.statusCode
        });
      });
      
      next();
    };
  }
  
  // Database query metrics
  recordDatabaseQuery(queryType, pool, table, duration) {
    this.dbQueryDuration.observe(
      { query_type: queryType, pool, table },
      duration / 1000
    );
  }
  
  // Queue job metrics
  recordQueueJob(queue, jobType, duration, status) {
    this.queueJobDuration.observe(
      { queue, job_type: jobType },
      duration / 1000
    );
    
    this.queueJobsProcessed.inc({
      queue,
      status
    });
  }
  
  // Email metrics
  recordEmailSent(provider, campaignType) {
    this.emailsSent.inc({
      provider,
      campaign_type: campaignType
    });
  }
  
  recordEmailDeliveryRate(provider, rate) {
    this.emailDeliveryRate.set({ provider }, rate);
  }
  
  // Get metrics for scraping
  async getMetrics() {
    return await client.register.metrics();
  }
  
  // Reset metrics
  reset() {
    client.register.resetMetrics();
  }
}

module.exports = AdvancedMetrics;
```

## 📊 Auto-scaling Configuration

### **1. Kubernetes Auto-scaling**

#### **HPA Configuration**
```yaml
# k8s/hpa-mailgenius.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mailgenius-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mailgenius-app
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: queue_depth
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min
```

#### **VPA Configuration**
```yaml
# k8s/vpa-mailgenius.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: mailgenius-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mailgenius-app
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: mailgenius-app
      minAllowed:
        cpu: 200m
        memory: 512Mi
      maxAllowed:
        cpu: 4000m
        memory: 8Gi
      controlledResources: ["cpu", "memory"]
```

### **2. Database Auto-scaling**

#### **Connection Pool Auto-scaling**
```javascript
// lib/database/auto-scaling-pool.js
class AutoScalingConnectionPool {
  constructor(config) {
    this.config = config;
    this.currentSize = config.initialSize || 10;
    this.minSize = config.minSize || 5;
    this.maxSize = config.maxSize || 100;
    
    this.metrics = {
      avgWaitTime: 0,
      activeConnections: 0,
      queuedRequests: 0,
      cpuUsage: 0
    };
    
    this.pool = this.createPool();
    this.setupAutoScaling();
  }
  
  createPool() {
    return new Pool({
      ...this.config,
      min: this.minSize,
      max: this.currentSize
    });
  }
  
  setupAutoScaling() {
    // Monitor metrics every 10 seconds
    setInterval(() => {
      this.collectMetrics();
      this.evaluateScaling();
    }, 10000);
  }
  
  collectMetrics() {
    this.metrics.activeConnections = this.pool.totalCount;
    this.metrics.queuedRequests = this.pool.waitingCount;
    
    // Calculate average wait time
    const waitTimes = this.pool.waitingClients || [];
    this.metrics.avgWaitTime = waitTimes.length > 0 
      ? waitTimes.reduce((sum, client) => sum + (Date.now() - client.waitStart), 0) / waitTimes.length
      : 0;
  }
  
  evaluateScaling() {
    const shouldScaleUp = this.shouldScaleUp();
    const shouldScaleDown = this.shouldScaleDown();
    
    if (shouldScaleUp) {
      this.scaleUp();
    } else if (shouldScaleDown) {
      this.scaleDown();
    }
  }
  
  shouldScaleUp() {
    // Scale up if:
    // - Average wait time > 1 second
    // - Queue depth > 50% of current pool size
    // - Active connections > 80% of current pool size
    return (
      this.metrics.avgWaitTime > 1000 ||
      this.metrics.queuedRequests > (this.currentSize * 0.5) ||
      this.metrics.activeConnections > (this.currentSize * 0.8)
    ) && this.currentSize < this.maxSize;
  }
  
  shouldScaleDown() {
    // Scale down if:
    // - No queued requests
    // - Active connections < 30% of current pool size
    // - Average wait time < 100ms
    return (
      this.metrics.queuedRequests === 0 &&
      this.metrics.activeConnections < (this.currentSize * 0.3) &&
      this.metrics.avgWaitTime < 100
    ) && this.currentSize > this.minSize;
  }
  
  scaleUp() {
    const newSize = Math.min(
      this.currentSize + Math.ceil(this.currentSize * 0.5),
      this.maxSize
    );
    
    console.log(`Scaling up connection pool from ${this.currentSize} to ${newSize}`);
    
    this.pool.options.max = newSize;
    this.currentSize = newSize;
    
    // Emit scaling event
    this.emit('scaleUp', { oldSize: this.currentSize, newSize });
  }
  
  scaleDown() {
    const newSize = Math.max(
      this.currentSize - Math.ceil(this.currentSize * 0.25),
      this.minSize
    );
    
    console.log(`Scaling down connection pool from ${this.currentSize} to ${newSize}`);
    
    this.pool.options.max = newSize;
    this.currentSize = newSize;
    
    // Emit scaling event
    this.emit('scaleDown', { oldSize: this.currentSize, newSize });
  }
}

module.exports = AutoScalingConnectionPool;
```

### **3. Queue Auto-scaling**

#### **Dynamic Worker Scaling**
```javascript
// lib/queue/auto-scaling-workers.js
const cluster = require('cluster');
const os = require('os');

class AutoScalingWorkers {
  constructor(config) {
    this.config = config;
    this.workers = new Map();
    this.minWorkers = config.minWorkers || 2;
    this.maxWorkers = config.maxWorkers || os.cpus().length * 2;
    this.currentWorkers = 0;
    
    this.metrics = {
      queueDepth: 0,
      processingRate: 0,
      avgProcessingTime: 0,
      failureRate: 0
    };
    
    this.setupMaster();
    this.startInitialWorkers();
    this.setupAutoScaling();
  }
  
  setupMaster() {
    if (cluster.isMaster) {
      cluster.setupMaster({
        exec: './lib/queue/worker-process.js',
        args: process.argv.slice(2),
        silent: false
      });
      
      cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        this.workers.delete(worker.id);
        this.currentWorkers--;
        
        // Restart worker if it didn't exit cleanly
        if (code !== 0 && !worker.exitedAfterDisconnect) {
          this.spawnWorker();
        }
      });
    }
  }
  
  startInitialWorkers() {
    for (let i = 0; i < this.minWorkers; i++) {
      this.spawnWorker();
    }
  }
  
  spawnWorker() {
    if (this.currentWorkers >= this.maxWorkers) {
      return null;
    }
    
    const worker = cluster.fork();
    this.workers.set(worker.id, {
      worker,
      startTime: Date.now(),
      jobsProcessed: 0,
      jobsFailed: 0
    });
    
    this.currentWorkers++;
    
    worker.on('message', (msg) => {
      if (msg.type === 'job_completed') {
        this.workers.get(worker.id).jobsProcessed++;
      } else if (msg.type === 'job_failed') {
        this.workers.get(worker.id).jobsFailed++;
      }
    });
    
    console.log(`Spawned worker ${worker.process.pid}`);
    return worker;
  }
  
  terminateWorker() {
    if (this.currentWorkers <= this.minWorkers) {
      return false;
    }
    
    // Find worker with least jobs processed
    let targetWorker = null;
    let minJobs = Infinity;
    
    for (const [id, workerInfo] of this.workers.entries()) {
      if (workerInfo.jobsProcessed < minJobs) {
        minJobs = workerInfo.jobsProcessed;
        targetWorker = workerInfo.worker;
      }
    }
    
    if (targetWorker) {
      targetWorker.disconnect();
      setTimeout(() => {
        if (!targetWorker.isDead()) {
          targetWorker.kill();
        }
      }, 5000);
      
      console.log(`Terminated worker ${targetWorker.process.pid}`);
      return true;
    }
    
    return false;
  }
  
  setupAutoScaling() {
    // Monitor metrics every 15 seconds
    setInterval(async () => {
      await this.collectMetrics();
      this.evaluateScaling();
    }, 15000);
  }
  
  async collectMetrics() {
    try {
      // Get queue depth from Redis
      const queueDepth = await this.getQueueDepth();
      this.metrics.queueDepth = queueDepth;
      
      // Calculate processing rate
      const totalProcessed = Array.from(this.workers.values())
        .reduce((sum, worker) => sum + worker.jobsProcessed, 0);
      
      const totalFailed = Array.from(this.workers.values())
        .reduce((sum, worker) => sum + worker.jobsFailed, 0);
      
      this.metrics.processingRate = totalProcessed;
      this.metrics.failureRate = totalFailed / (totalProcessed + totalFailed) || 0;
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }
  
  evaluateScaling() {
    const shouldScaleUp = this.shouldScaleUp();
    const shouldScaleDown = this.shouldScaleDown();
    
    if (shouldScaleUp) {
      this.scaleUp();
    } else if (shouldScaleDown) {
      this.scaleDown();
    }
  }
  
  shouldScaleUp() {
    // Scale up if:
    // - Queue depth > 500 jobs
    // - Queue depth > 100 * current workers
    // - Processing rate is declining
    return (
      this.metrics.queueDepth > 500 ||
      this.metrics.queueDepth > (100 * this.currentWorkers)
    ) && this.currentWorkers < this.maxWorkers;
  }
  
  shouldScaleDown() {
    // Scale down if:
    // - Queue depth < 50 jobs
    // - Queue depth < 20 * current workers
    // - Low failure rate
    return (
      this.metrics.queueDepth < 50 ||
      this.metrics.queueDepth < (20 * this.currentWorkers)
    ) && this.currentWorkers > this.minWorkers && this.metrics.failureRate < 0.05;
  }
  
  scaleUp() {
    const workersToAdd = Math.min(
      Math.ceil(this.currentWorkers * 0.5),
      this.maxWorkers - this.currentWorkers
    );
    
    console.log(`Scaling up: adding ${workersToAdd} workers`);
    
    for (let i = 0; i < workersToAdd; i++) {
      this.spawnWorker();
    }
  }
  
  scaleDown() {
    const workersToRemove = Math.min(
      Math.floor(this.currentWorkers * 0.25),
      this.currentWorkers - this.minWorkers
    );
    
    console.log(`Scaling down: removing ${workersToRemove} workers`);
    
    for (let i = 0; i < workersToRemove; i++) {
      this.terminateWorker();
    }
  }
  
  async getQueueDepth() {
    // Implementation depends on your queue system
    // This is a placeholder
    return 0;
  }
  
  getWorkerStats() {
    return {
      currentWorkers: this.currentWorkers,
      minWorkers: this.minWorkers,
      maxWorkers: this.maxWorkers,
      metrics: this.metrics,
      workers: Array.from(this.workers.values()).map(w => ({
        pid: w.worker.process.pid,
        startTime: w.startTime,
        jobsProcessed: w.jobsProcessed,
        jobsFailed: w.jobsFailed
      }))
    };
  }
}

module.exports = AutoScalingWorkers;
```

## 📋 Scaling Checklist

### **Database Scaling**
- [ ] Implementar read replicas
- [ ] Configurar connection pooling avançado
- [ ] Implementar sharding estratégico
- [ ] Otimizar queries para 10MM+ registros
- [ ] Configurar particionamento automático
- [ ] Implementar cache multi-level
- [ ] Configurar backup distribuído

### **Application Scaling**
- [ ] Configurar auto-scaling horizontal
- [ ] Implementar load balancing
- [ ] Configurar CDN para assets estáticos
- [ ] Otimizar memory usage
- [ ] Implementar circuit breakers
- [ ] Configurar rate limiting
- [ ] Implementar health checks

### **Queue Scaling**
- [ ] Configurar queue distribution
- [ ] Implementar worker auto-scaling
- [ ] Configurar dead letter queues
- [ ] Implementar job prioritization
- [ ] Configurar retry strategies
- [ ] Implementar queue monitoring
- [ ] Configurar queue persistence

### **Infrastructure Scaling**
- [ ] Configurar Kubernetes HPA/VPA
- [ ] Implementar infrastructure as code
- [ ] Configurar monitoring avançado
- [ ] Implementar automated deployments
- [ ] Configurar disaster recovery
- [ ] Implementar security scanning
- [ ] Configurar cost optimization

## 📊 Performance Targets

### **10MM Contacts Targets**
- **Database Query Time**: <200ms para 10MM registros
- **API Response Time**: <100ms (p95)
- **Email Throughput**: 100,000+ emails/hora
- **Bulk Import**: 1MM leads em <60 segundos
- **Concurrent Users**: 500+ usuários simultâneos
- **System Uptime**: 99.99% SLA

### **Resource Projections**
- **Database**: 50GB+ storage, 16GB+ RAM
- **Cache**: 8GB+ Redis memory
- **Application**: 32GB+ RAM, 16+ CPU cores
- **Queue**: 4GB+ Redis memory
- **Network**: 10Gbps+ bandwidth

---

## 📞 Support

Para suporte com scaling e otimização:
- **Email**: scaling@mailgenius.com
- **Slack**: #scaling-optimization
- **Documentation**: https://docs.mailgenius.com/scaling

---

**Atualizado**: 2024-07-16  
**Versão**: 2.0  
**Autor**: Scaling Team  
**Status**: Produção Ready