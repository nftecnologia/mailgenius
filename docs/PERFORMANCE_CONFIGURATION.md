# MailGenius - Configuração de Performance

## 🚀 Visão Geral das Configurações de Performance

Este documento fornece configurações detalhadas para otimizar o MailGenius para suportar 2MM+ contatos com performance máxima. Inclui configurações de database, cache, workers, e otimizações específicas para alto volume.

## 📊 Targets de Performance

### **Especificações de Performance**
- **Database Queries**: <500ms para 2MM+ registros
- **API Response Time**: <200ms (p95)
- **Email Throughput**: 10,000+ emails/hora
- **Bulk Import**: 100K leads em <15 segundos
- **Concurrent Users**: 100+ usuários simultâneos
- **Uptime**: 99.9% SLA

### **Métricas de Capacidade**
- **Storage**: Suporte para 50GB+ de dados
- **Memory**: Uso otimizado de 4GB+ RAM
- **CPU**: Utilização eficiente de 4+ cores
- **Network**: Throughput de 1Gbps+

## 🗄️ Configurações de Database

### **1. PostgreSQL Performance Tuning**

#### **Configuração Principal (postgresql.conf)**
```ini
# ======================
# MEMORY CONFIGURATION
# ======================

# Shared buffers - 25% of available RAM
shared_buffers = 1GB

# Effective cache size - 75% of available RAM
effective_cache_size = 3GB

# Work memory for sorting and hash operations
work_mem = 64MB

# Maintenance work memory
maintenance_work_mem = 256MB

# ======================
# CHECKPOINT CONFIGURATION
# ======================

# Checkpoint completion target
checkpoint_completion_target = 0.9

# WAL buffers
wal_buffers = 16MB

# WAL checkpoint timeout
checkpoint_timeout = 15min

# ======================
# CONNECTION CONFIGURATION
# ======================

# Maximum connections
max_connections = 200

# Connection pool settings
shared_preload_libraries = 'pg_stat_statements'

# ======================
# QUERY PLANNER
# ======================

# Default statistics target
default_statistics_target = 100

# Random page cost (SSD optimized)
random_page_cost = 1.1

# Sequential page cost
seq_page_cost = 1.0

# ======================
# PARALLEL PROCESSING
# ======================

# Maximum worker processes
max_worker_processes = 8

# Maximum parallel workers per gather
max_parallel_workers_per_gather = 4

# Maximum parallel workers
max_parallel_workers = 8

# Maximum parallel maintenance workers
max_parallel_maintenance_workers = 4

# ======================
# LOGGING CONFIGURATION
# ======================

# Log slow queries
log_min_duration_statement = 1000

# Log checkpoints
log_checkpoints = on

# Log connections
log_connections = on

# Log disconnections
log_disconnections = on

# ======================
# AUTOVACUUM CONFIGURATION
# ======================

# Enable autovacuum
autovacuum = on

# Autovacuum scale factor
autovacuum_vacuum_scale_factor = 0.1

# Autovacuum analyze scale factor
autovacuum_analyze_scale_factor = 0.05

# Maximum autovacuum workers
autovacuum_max_workers = 6

# ======================
# REPLICATION (if needed)
# ======================

# WAL level
wal_level = replica

# Maximum WAL senders
max_wal_senders = 3

# WAL keep segments
wal_keep_segments = 32
```

#### **Aplicar Configurações**
```bash
# Aplicar configurações
sudo systemctl restart postgresql

# Verificar configurações
sudo -u postgres psql -c "SHOW shared_buffers;"
sudo -u postgres psql -c "SHOW effective_cache_size;"
sudo -u postgres psql -c "SHOW work_mem;"
```

### **2. Database Optimization Scripts**

#### **Script de Otimização Diária**
```sql
-- daily_optimization.sql

-- Update table statistics
ANALYZE;

-- Vacuum tables (not full)
VACUUM ANALYZE;

-- Reindex if needed (check fragmentation first)
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
       pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size,
       pg_size_pretty(pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- Check for bloated tables
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
       pg_stat_get_tuples_inserted(c.oid) as inserts,
       pg_stat_get_tuples_updated(c.oid) as updates,
       pg_stat_get_tuples_deleted(c.oid) as deletes
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

#### **Script de Otimização Semanal**
```sql
-- weekly_optimization.sql

-- Full vacuum for heavily updated tables
VACUUM FULL ANALYZE leads;
VACUUM FULL ANALYZE email_sends;
VACUUM FULL ANALYZE lead_activities;

-- Reindex critical tables
REINDEX TABLE leads;
REINDEX TABLE email_sends;
REINDEX TABLE campaigns;

-- Update statistics with higher target
ALTER TABLE leads ALTER COLUMN email SET STATISTICS 1000;
ALTER TABLE leads ALTER COLUMN workspace_id SET STATISTICS 1000;
ANALYZE leads;
```

### **3. Connection Pooling**

#### **PgBouncer Configuration**
```ini
# /etc/pgbouncer/pgbouncer.ini

[databases]
mailgenius = host=localhost port=5432 dbname=mailgenius user=mailgenius

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool configuration
pool_mode = transaction
max_client_conn = 200
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 10
reserve_pool_timeout = 3

# Connection limits
max_db_connections = 100
max_user_connections = 50

# Timeouts
server_connect_timeout = 15
server_login_retry = 3
query_timeout = 30
query_wait_timeout = 120
client_idle_timeout = 0
server_idle_timeout = 600

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

#### **Application Connection Pool**
```javascript
// lib/database-pool.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 6432, // PgBouncer port
  database: process.env.DB_NAME || 'mailgenius',
  user: process.env.DB_USER || 'mailgenius',
  password: process.env.DB_PASSWORD,
  
  // Pool configuration
  min: 10,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 60000,
  
  // Query timeout
  query_timeout: 30000,
  statement_timeout: 30000,
  
  // SSL configuration
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  
  // Application name for monitoring
  application_name: 'mailgenius-app'
});

// Pool event handlers
pool.on('connect', (client) => {
  console.log('New client connected');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
```

## 🔄 Configurações de Redis

### **1. Redis Configuration**

#### **Redis Server Configuration (redis.conf)**
```ini
# ======================
# MEMORY CONFIGURATION
# ======================

# Maximum memory limit
maxmemory 2gb

# Memory policy when limit reached
maxmemory-policy allkeys-lru

# Memory samples for LRU
maxmemory-samples 10

# ======================
# PERSISTENCE CONFIGURATION
# ======================

# Save configuration
save 900 1
save 300 10
save 60 10000

# RDB file name
dbfilename dump.rdb

# Directory for RDB files
dir /var/lib/redis/

# ======================
# NETWORK CONFIGURATION
# ======================

# Bind address
bind 127.0.0.1

# Port
port 6379

# TCP listen backlog
tcp-backlog 511

# TCP keepalive
tcp-keepalive 300

# ======================
# PERFORMANCE CONFIGURATION
# ======================

# IO threads
io-threads 4
io-threads-do-reads yes

# Hash max ziplist entries
hash-max-ziplist-entries 512
hash-max-ziplist-value 64

# List max ziplist size
list-max-ziplist-size -2

# Set max intset entries
set-max-intset-entries 512

# ======================
# LOGGING CONFIGURATION
# ======================

# Log level
loglevel notice

# Log file
logfile /var/log/redis/redis-server.log

# ======================
# SECURITY CONFIGURATION
# ======================

# Require password
requirepass your_redis_password

# Rename dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
```

### **2. Redis Connection Pool**

#### **Application Redis Configuration**
```javascript
// lib/redis-pool.js
const Redis = require('ioredis');

// Main Redis instance
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  
  // Connection pool
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  
  // Performance settings
  keepAlive: 30000,
  commandTimeout: 5000,
  
  // Connection management
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  
  // Cluster support (if needed)
  enableOfflineQueue: false
});

// Redis Cluster (for high availability)
const redisCluster = new Redis.Cluster([
  {
    host: process.env.REDIS_HOST_1 || 'localhost',
    port: process.env.REDIS_PORT_1 || 6379,
  },
  {
    host: process.env.REDIS_HOST_2 || 'localhost',
    port: process.env.REDIS_PORT_2 || 6380,
  },
  {
    host: process.env.REDIS_HOST_3 || 'localhost',
    port: process.env.REDIS_PORT_3 || 6381,
  }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    commandTimeout: 5000,
  },
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false
});

// Connection event handlers
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

module.exports = { redis, redisCluster };
```

### **3. Cache Strategies**

#### **Cache Configuration**
```javascript
// lib/cache-config.js
const CACHE_CONFIG = {
  // TTL settings (in seconds)
  ttl: {
    user_session: 3600,        // 1 hour
    api_response: 300,         // 5 minutes
    database_query: 600,       // 10 minutes
    email_template: 1800,      // 30 minutes
    lead_data: 300,            // 5 minutes
    campaign_stats: 120        // 2 minutes
  },
  
  // Cache keys
  keys: {
    user_session: 'session:user:',
    api_response: 'api:response:',
    database_query: 'db:query:',
    email_template: 'template:',
    lead_data: 'lead:',
    campaign_stats: 'campaign:stats:'
  },
  
  // Cache strategies
  strategies: {
    // Cache aside pattern
    cache_aside: {
      get: async (key) => {
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached);
        
        const data = await fetchFromDatabase(key);
        await redis.setex(key, CACHE_CONFIG.ttl.database_query, JSON.stringify(data));
        return data;
      }
    },
    
    // Write through pattern
    write_through: {
      set: async (key, data) => {
        await redis.setex(key, CACHE_CONFIG.ttl.database_query, JSON.stringify(data));
        await saveToDatabase(key, data);
      }
    },
    
    // Write behind pattern
    write_behind: {
      set: async (key, data) => {
        await redis.setex(key, CACHE_CONFIG.ttl.database_query, JSON.stringify(data));
        // Queue for async database write
        await redis.lpush('write_queue', JSON.stringify({ key, data }));
      }
    }
  }
};

module.exports = CACHE_CONFIG;
```

## ⚙️ Configurações da Aplicação

### **1. Node.js Performance**

#### **Environment Variables**
```bash
# Node.js performance settings
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=128"

# V8 optimization flags
NODE_OPTIONS="$NODE_OPTIONS --optimize-for-size"

# Enable performance profiling
NODE_OPTIONS="$NODE_OPTIONS --prof"

# Garbage collection settings
NODE_OPTIONS="$NODE_OPTIONS --expose-gc"

# Thread pool size
UV_THREADPOOL_SIZE=128

# DNS resolution
NODE_OPTIONS="$NODE_OPTIONS --dns-result-order=ipv4first"
```

#### **Process Manager Configuration (PM2)**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'mailgenius-app',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    
    // Memory management
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 5,
    
    // Performance settings
    node_args: [
      '--max-old-space-size=4096',
      '--max-semi-space-size=128',
      '--optimize-for-size',
      '--expose-gc'
    ],
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      UV_THREADPOOL_SIZE: 128
    },
    
    // Monitoring
    monitor: true,
    
    // Logging
    log_file: '/var/log/mailgenius/combined.log',
    out_file: '/var/log/mailgenius/out.log',
    error_file: '/var/log/mailgenius/error.log',
    time: true,
    
    // Auto restart
    watch: false,
    ignore_watch: ['node_modules', 'logs']
  }]
};
```

### **2. Next.js Performance**

#### **Next.js Configuration**
```javascript
// next.config.js
const nextConfig = {
  // Performance optimizations
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  
  // Bundle optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimize chunks
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10
        },
        common: {
          name: 'commons',
          minChunks: 2,
          chunks: 'all',
          priority: 5
        }
      }
    };
    
    // Enable gzip compression
    if (!dev && !isServer) {
      config.plugins.push(
        new webpack.optimize.LimitChunkCountPlugin({
          maxChunks: 50
        })
      );
    }
    
    return config;
  },
  
  // Image optimization
  images: {
    domains: ['mailgenius.com'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true
  },
  
  // Headers for caching
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=600'
          }
        ]
      }
    ];
  },
  
  // Redirects and rewrites
  async redirects() {
    return [];
  },
  
  // Experimental features
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['mongoose'],
    optimizeCss: true,
    optimizePackageImports: ['lucide-react']
  }
};

module.exports = nextConfig;
```

### **3. Worker Configuration**

#### **Bull Queue Configuration**
```javascript
// lib/queue-config.js
const Queue = require('bull');
const { redis } = require('./redis-pool');

const QUEUE_CONFIG = {
  // Redis connection
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    db: 1, // Use separate database for queues
    
    // Connection settings
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true,
    
    // Performance settings
    keepAlive: 30000,
    commandTimeout: 5000
  },
  
  // Default job options
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    delay: 0
  },
  
  // Queue settings
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1,
    retryProcessDelay: 5000
  }
};

// Create optimized queues
const createQueue = (name, options = {}) => {
  const queue = new Queue(name, {
    redis: QUEUE_CONFIG.redis,
    defaultJobOptions: {
      ...QUEUE_CONFIG.defaultJobOptions,
      ...options.defaultJobOptions
    },
    settings: {
      ...QUEUE_CONFIG.settings,
      ...options.settings
    }
  });
  
  // Queue events for monitoring
  queue.on('error', (error) => {
    console.error(`Queue ${name} error:`, error);
  });
  
  queue.on('stalled', (job) => {
    console.warn(`Queue ${name} job stalled:`, job.id);
  });
  
  queue.on('failed', (job, err) => {
    console.error(`Queue ${name} job failed:`, job.id, err);
  });
  
  return queue;
};

module.exports = { QUEUE_CONFIG, createQueue };
```

#### **Email Worker Optimization**
```javascript
// lib/email-workers/optimized-worker.js
const { createQueue } = require('../queue-config');
const { sendEmail } = require('../email-service');

class OptimizedEmailWorker {
  constructor() {
    this.queue = createQueue('email-sending', {
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    });
    
    this.setupProcessor();
  }
  
  setupProcessor() {
    // Process jobs with concurrency
    this.queue.process('send-email', 20, async (job) => {
      const { campaignId, leadId, emailData } = job.data;
      
      try {
        // Add performance monitoring
        const startTime = Date.now();
        
        const result = await sendEmail(emailData);
        
        // Log performance
        const duration = Date.now() - startTime;
        if (duration > 5000) {
          console.warn(`Slow email send: ${duration}ms`);
        }
        
        // Update job progress
        job.progress(100);
        
        return result;
      } catch (error) {
        console.error('Email send failed:', error);
        throw error;
      }
    });
    
    // Bulk email processing
    this.queue.process('bulk-send', 5, async (job) => {
      const { campaignId, emails } = job.data;
      const results = [];
      
      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(emailData => sendEmail(emailData))
        );
        
        results.push(...batchResults);
        
        // Update progress
        const progress = Math.round((i + batchSize) / emails.length * 100);
        job.progress(progress);
      }
      
      return results;
    });
  }
}

module.exports = OptimizedEmailWorker;
```

## 🔧 Sistema de Upload Escalável

### **1. Upload Configuration**

#### **Optimized Upload Settings**
```javascript
// lib/config/upload-performance.js
const UPLOAD_PERFORMANCE_CONFIG = {
  // Memory optimization
  memory_limit: '512MB',
  
  // Chunk settings
  chunk_size: 2 * 1024 * 1024, // 2MB for large files
  min_chunk_size: 64 * 1024,   // 64KB minimum
  max_chunk_size: 5 * 1024 * 1024, // 5MB maximum
  
  // Concurrency settings
  max_concurrent_uploads: 10,
  max_concurrent_chunks: 5,
  max_concurrent_processing: 3,
  
  // Processing settings
  batch_size: 2000,            // Increased batch size
  max_processing_time: 300,    // 5 minutes
  
  // Buffer settings
  buffer_size: 64 * 1024,      // 64KB buffer
  high_water_mark: 16 * 1024,  // 16KB high water mark
  
  // Retry settings
  max_retries: 5,
  retry_delay: 1000,
  exponential_backoff: true,
  
  // Validation optimization
  validation_batch_size: 5000,
  skip_validation_for_large_files: true,
  validation_timeout: 60000,
  
  // Storage optimization
  use_compression: true,
  compression_level: 6,
  temp_file_cleanup: true,
  cleanup_interval: 300000, // 5 minutes
  
  // Memory management
  gc_interval: 60000, // 1 minute
  memory_threshold: 0.8 // 80% memory usage
};

module.exports = UPLOAD_PERFORMANCE_CONFIG;
```

### **2. CSV Processing Optimization**

#### **High-Performance CSV Processor**
```javascript
// lib/services/optimized-csv-processor.js
const csv = require('csv-parser');
const fs = require('fs');
const { Transform } = require('stream');
const { Worker } = require('worker_threads');

class OptimizedCSVProcessor {
  constructor(options = {}) {
    this.options = {
      batchSize: 2000,
      concurrency: 4,
      validation: true,
      ...options
    };
    
    this.workers = [];
    this.initializeWorkers();
  }
  
  initializeWorkers() {
    for (let i = 0; i < this.options.concurrency; i++) {
      const worker = new Worker('./csv-worker.js');
      this.workers.push(worker);
    }
  }
  
  async processFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let batch = [];
      let recordCount = 0;
      
      const batchProcessor = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          batch.push(chunk);
          recordCount++;
          
          if (batch.length >= this.options.batchSize) {
            this.processBatch(batch)
              .then(result => {
                results.push(...result.valid);
                errors.push(...result.errors);
                callback();
              })
              .catch(callback);
            
            batch = [];
          } else {
            callback();
          }
        },
        
        flush(callback) {
          if (batch.length > 0) {
            this.processBatch(batch)
              .then(result => {
                results.push(...result.valid);
                errors.push(...result.errors);
                callback();
              })
              .catch(callback);
          } else {
            callback();
          }
        }
      });
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .pipe(batchProcessor)
        .on('finish', () => {
          resolve({
            total: recordCount,
            valid: results.length,
            errors: errors.length,
            data: results,
            errorDetails: errors
          });
        })
        .on('error', reject);
    });
  }
  
  async processBatch(batch) {
    const worker = this.getAvailableWorker();
    
    return new Promise((resolve, reject) => {
      worker.postMessage({
        type: 'processBatch',
        batch: batch,
        options: this.options
      });
      
      worker.once('message', (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      });
    });
  }
  
  getAvailableWorker() {
    // Simple round-robin selection
    return this.workers[Math.floor(Math.random() * this.workers.length)];
  }
}

module.exports = OptimizedCSVProcessor;
```

## 📊 Monitoramento de Performance

### **1. Metrics Collection**

#### **Performance Metrics Configuration**
```javascript
// lib/monitoring/performance-metrics.js
const performanceMetrics = {
  // Database metrics
  database: {
    query_time: {
      buckets: [10, 50, 100, 500, 1000, 5000],
      unit: 'ms'
    },
    connection_pool: {
      total: 0,
      active: 0,
      idle: 0,
      waiting: 0
    },
    slow_queries: {
      threshold: 1000,
      count: 0
    }
  },
  
  // API metrics
  api: {
    response_time: {
      buckets: [50, 100, 200, 500, 1000, 2000],
      unit: 'ms'
    },
    request_rate: {
      current: 0,
      average: 0,
      unit: 'req/min'
    },
    error_rate: {
      threshold: 1.0,
      current: 0,
      unit: 'percent'
    }
  },
  
  // Queue metrics
  queue: {
    processing_time: {
      buckets: [100, 500, 1000, 5000, 10000],
      unit: 'ms'
    },
    queue_depth: {
      current: 0,
      max: 0,
      threshold: 1000
    },
    throughput: {
      current: 0,
      unit: 'jobs/min'
    }
  },
  
  // System metrics
  system: {
    memory: {
      used: 0,
      total: 0,
      percent: 0,
      threshold: 80
    },
    cpu: {
      usage: 0,
      threshold: 80,
      unit: 'percent'
    },
    disk: {
      usage: 0,
      threshold: 90,
      unit: 'percent'
    }
  }
};

module.exports = performanceMetrics;
```

### **2. Performance Monitoring Middleware**

#### **API Performance Monitoring**
```javascript
// lib/middleware/performance-middleware.js
const { performance } = require('perf_hooks');
const { metricsCollector } = require('../monitoring/metrics');

const performanceMiddleware = (req, res, next) => {
  const startTime = performance.now();
  
  // Track request
  metricsCollector.increment('api.requests.total');
  
  // Override res.end to measure response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Record metrics
    metricsCollector.histogram('api.response_time', duration);
    metricsCollector.increment(`api.responses.${res.statusCode}`);
    
    // Track slow requests
    if (duration > 1000) {
      metricsCollector.increment('api.slow_requests');
      console.warn(`Slow request: ${req.method} ${req.url} - ${duration}ms`);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

module.exports = performanceMiddleware;
```

### **3. Database Performance Monitoring**

#### **Query Performance Tracker**
```javascript
// lib/monitoring/db-performance.js
const { Pool } = require('pg');
const { performance } = require('perf_hooks');

class DatabasePerformanceMonitor {
  constructor(pool) {
    this.pool = pool;
    this.slowQueries = [];
    this.queryMetrics = new Map();
    
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // Override pool.query to track performance
    const originalQuery = this.pool.query.bind(this.pool);
    
    this.pool.query = async (text, params) => {
      const startTime = performance.now();
      const queryId = this.generateQueryId(text);
      
      try {
        const result = await originalQuery(text, params);
        const duration = performance.now() - startTime;
        
        // Track query metrics
        this.trackQuery(queryId, duration, true);
        
        // Log slow queries
        if (duration > 1000) {
          this.logSlowQuery(text, params, duration);
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.trackQuery(queryId, duration, false);
        throw error;
      }
    };
  }
  
  trackQuery(queryId, duration, success) {
    if (!this.queryMetrics.has(queryId)) {
      this.queryMetrics.set(queryId, {
        count: 0,
        totalTime: 0,
        errors: 0,
        avgTime: 0
      });
    }
    
    const metrics = this.queryMetrics.get(queryId);
    metrics.count++;
    metrics.totalTime += duration;
    metrics.avgTime = metrics.totalTime / metrics.count;
    
    if (!success) {
      metrics.errors++;
    }
  }
  
  logSlowQuery(text, params, duration) {
    const slowQuery = {
      query: text,
      params: params,
      duration: duration,
      timestamp: new Date().toISOString()
    };
    
    this.slowQueries.push(slowQuery);
    
    // Keep only last 100 slow queries
    if (this.slowQueries.length > 100) {
      this.slowQueries.shift();
    }
    
    console.warn(`Slow query detected: ${duration}ms`, {
      query: text,
      params: params
    });
  }
  
  generateQueryId(text) {
    // Simple hash for query identification
    return text.replace(/\$\d+/g, '$?').substring(0, 100);
  }
  
  getMetrics() {
    return {
      slowQueries: this.slowQueries,
      queryMetrics: Array.from(this.queryMetrics.entries()).map(([id, metrics]) => ({
        queryId: id,
        ...metrics
      }))
    };
  }
}

module.exports = DatabasePerformanceMonitor;
```

## 🔄 Otimizações Específicas

### **1. Memory Management**

#### **Memory Optimization Script**
```javascript
// lib/utils/memory-optimization.js
const v8 = require('v8');

class MemoryOptimizer {
  constructor() {
    this.gcInterval = null;
    this.memoryThreshold = 0.8; // 80% memory usage
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // Monitor memory usage every minute
    this.gcInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      if (heapUsedPercent > this.memoryThreshold) {
        console.warn('High memory usage detected:', {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          percent: Math.round(heapUsedPercent * 100) + '%'
        });
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
      }
    }, 60000);
  }
  
  getMemoryStats() {
    const memoryUsage = process.memoryUsage();
    const heapStatistics = v8.getHeapStatistics();
    
    return {
      process: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      v8: {
        totalHeapSize: heapStatistics.total_heap_size,
        totalHeapSizeExecutable: heapStatistics.total_heap_size_executable,
        totalPhysicalSize: heapStatistics.total_physical_size,
        totalAvailableSize: heapStatistics.total_available_size,
        usedHeapSize: heapStatistics.used_heap_size,
        heapSizeLimit: heapStatistics.heap_size_limit
      }
    };
  }
  
  optimizeMemory() {
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Clear require cache for development
    if (process.env.NODE_ENV === 'development') {
      Object.keys(require.cache).forEach(key => {
        if (!key.includes('node_modules')) {
          delete require.cache[key];
        }
      });
    }
  }
  
  destroy() {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
  }
}

module.exports = MemoryOptimizer;
```

### **2. CPU Optimization**

#### **CPU Usage Monitoring**
```javascript
// lib/utils/cpu-optimization.js
const os = require('os');
const { performance } = require('perf_hooks');

class CPUOptimizer {
  constructor() {
    this.cpuUsage = [];
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // Monitor CPU usage every 30 seconds
    setInterval(() => {
      const usage = this.getCPUUsage();
      this.cpuUsage.push({
        timestamp: Date.now(),
        usage: usage
      });
      
      // Keep only last 100 measurements
      if (this.cpuUsage.length > 100) {
        this.cpuUsage.shift();
      }
      
      // Alert on high CPU usage
      if (usage > 80) {
        console.warn(`High CPU usage detected: ${usage}%`);
      }
    }, 30000);
  }
  
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    return 100 - ~~(100 * totalIdle / totalTick);
  }
  
  getAverageCPUUsage(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentUsage = this.cpuUsage.filter(u => u.timestamp > cutoff);
    
    if (recentUsage.length === 0) return 0;
    
    const average = recentUsage.reduce((sum, u) => sum + u.usage, 0) / recentUsage.length;
    return Math.round(average);
  }
  
  optimizeCPU() {
    // Adjust UV_THREADPOOL_SIZE based on CPU cores
    const cpuCount = os.cpus().length;
    const threadPoolSize = Math.max(4, cpuCount * 2);
    
    if (process.env.UV_THREADPOOL_SIZE !== threadPoolSize.toString()) {
      console.log(`Optimizing thread pool size to ${threadPoolSize}`);
      process.env.UV_THREADPOOL_SIZE = threadPoolSize.toString();
    }
  }
}

module.exports = CPUOptimizer;
```

### **3. Network Optimization**

#### **Network Performance Configuration**
```javascript
// lib/utils/network-optimization.js
const http = require('http');
const https = require('https');

// HTTP Agent optimization
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000
});

// Configure global agents
http.globalAgent = httpAgent;
https.globalAgent = httpsAgent;

// Network optimization functions
const networkOptimization = {
  // Optimize DNS resolution
  optimizeDNS: () => {
    const dns = require('dns');
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  },
  
  // Configure TCP settings
  optimizeTCP: () => {
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --dns-result-order=ipv4first`;
  },
  
  // Monitor network performance
  monitorNetwork: () => {
    const startTime = Date.now();
    
    return {
      measureLatency: (callback) => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        if (callback) callback(latency);
        return latency;
      }
    };
  }
};

module.exports = networkOptimization;
```

## 📋 Checklist de Configuração

### **Database Performance**
- [ ] Configurar shared_buffers (25% da RAM)
- [ ] Ajustar effective_cache_size (75% da RAM)
- [ ] Configurar work_mem apropriadamente
- [ ] Habilitar parallel processing
- [ ] Configurar connection pooling
- [ ] Otimizar autovacuum settings
- [ ] Monitorar slow queries

### **Redis Performance**
- [ ] Configurar maxmemory e policy
- [ ] Otimizar persistence settings
- [ ] Configurar IO threads
- [ ] Implementar connection pooling
- [ ] Monitorar memory usage

### **Application Performance**
- [ ] Configurar Node.js memory limits
- [ ] Otimizar PM2 cluster mode
- [ ] Implementar cache strategies
- [ ] Configurar worker concurrency
- [ ] Monitorar performance metrics

### **Upload System**
- [ ] Otimizar chunk sizes
- [ ] Configurar concurrency limits
- [ ] Implementar memory management
- [ ] Configurar compression
- [ ] Monitorar processing rates

### **Monitoring & Alerting**
- [ ] Configurar performance metrics
- [ ] Implementar slow query monitoring
- [ ] Configurar memory alerts
- [ ] Implementar CPU monitoring
- [ ] Configurar disk space alerts

---

## 📞 Support

Para suporte com configurações de performance:
- **Email**: performance@mailgenius.com
- **Slack**: #performance-optimization
- **Documentation**: https://docs.mailgenius.com/performance

---

**Atualizado**: 2024-07-16  
**Versão**: 2.0  
**Autor**: Performance Team  
**Status**: Produção Ready