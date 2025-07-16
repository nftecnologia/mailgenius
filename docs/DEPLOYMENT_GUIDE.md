# MailGenius - Guia de Deployment e Configuração

## 🚀 Visão Geral do Deployment

Este guia fornece instruções completas para deployment do MailGenius em produção, incluindo configuração de ambiente, banco de dados, workers, monitoramento e otimizações para suportar 2MM+ contatos.

## 📋 Pré-requisitos

### **Infraestrutura Mínima**
- **CPU**: 4 cores (8 cores recomendado)
- **RAM**: 4GB (8GB recomendado)
- **Storage**: 100GB SSD
- **Network**: 1Gbps
- **OS**: Ubuntu 20.04+ / Docker

### **Serviços Externos**
- **Supabase**: Database & Auth
- **Vercel**: Hosting & CDN
- **Redis**: Upstash ou self-hosted
- **Resend**: Email delivery
- **Anthropic**: AI services

## 🛠️ Configuração do Ambiente

### **1. Variáveis de Ambiente**

Crie um arquivo `.env.local` com as seguintes configurações:

```bash
# ======================
# CORE CONFIGURATION
# ======================

# Next.js
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com/api

# ======================
# DATABASE (Supabase)
# ======================

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database Connection
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_DIRECT_URL=postgresql://user:password@host:5432/database

# Connection Pool
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=60000

# ======================
# REDIS (Queue & Cache)
# ======================

# Redis Configuration
REDIS_URL=redis://username:password@host:6379
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Redis Pool
REDIS_POOL_MIN=5
REDIS_POOL_MAX=20
REDIS_POOL_IDLE_TIMEOUT=30000

# ======================
# EMAIL SERVICE
# ======================

# Resend API
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Your App Name

# Email Rate Limits
EMAIL_RATE_LIMIT_PER_MINUTE=100
EMAIL_RATE_LIMIT_PER_HOUR=3000
EMAIL_RATE_LIMIT_PER_DAY=50000

# ======================
# AI SERVICE
# ======================

# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# ======================
# UPLOAD SYSTEM
# ======================

# Upload Configuration
UPLOAD_MAX_FILE_SIZE=104857600  # 100MB
UPLOAD_CHUNK_SIZE=1048576       # 1MB
UPLOAD_MAX_CONCURRENT=3
UPLOAD_BATCH_SIZE=1000
UPLOAD_MAX_RECORDS=500000

# Storage
UPLOAD_STORAGE_PATH=/tmp/uploads
UPLOAD_RETENTION_HOURS=24

# ======================
# QUEUE SYSTEM
# ======================

# Bull Queue Configuration
QUEUE_REDIS_URL=redis://username:password@host:6379
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY=5000

# Worker Configuration
WORKER_CONCURRENCY=10
WORKER_MAX_JOBS=100
WORKER_POLL_INTERVAL=5000

# ======================
# MONITORING
# ======================

# Monitoring Configuration
MONITORING_ENABLED=true
MONITORING_METRICS_RETENTION_HOURS=24
MONITORING_LOGS_RETENTION_HOURS=24
MONITORING_HEALTH_CHECK_INTERVAL=30000

# External Monitoring
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=production

# ======================
# SECURITY
# ======================

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRATION=7d

# API Security
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX_REQUESTS=1000
API_RATE_LIMIT_SKIP_FAILED_REQUESTS=true

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With

# ======================
# PERFORMANCE
# ======================

# Node.js Performance
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=4096

# Next.js Performance
NEXT_TELEMETRY_DISABLED=1
NEXT_PRIVATE_STANDALONE=true

# ======================
# FEATURE FLAGS
# ======================

# Features
FEATURE_AI_ENABLED=true
FEATURE_UPLOAD_ENABLED=true
FEATURE_MONITORING_ENABLED=true
FEATURE_QUEUE_ENABLED=true
FEATURE_WEBHOOKS_ENABLED=true

# ======================
# DEVELOPMENT
# ======================

# Development Only
DEBUG=false
VERBOSE_LOGGING=false
SKIP_MIGRATIONS=false
```

### **2. Configuração do Package.json**

Adicione ou atualize os scripts de deployment:

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "start:production": "NODE_ENV=production next start",
    "workers": "node scripts/start-workers.js",
    "workers:production": "NODE_ENV=production node scripts/start-workers.js",
    "db:migrate": "node scripts/run-migrations.js",
    "db:seed": "node scripts/seed-database.js",
    "health-check": "node scripts/health-check.js",
    "setup:production": "npm run db:migrate && npm run db:seed"
  }
}
```

## 📦 Deployment Steps

### **1. Preparação do Ambiente**

```bash
# 1. Clone o repositório
git clone https://github.com/your-org/mailgenius.git
cd mailgenius

# 2. Instale dependências
npm install

# 3. Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas configurações

# 4. Construa a aplicação
npm run build

# 5. Execute migrações
npm run db:migrate

# 6. Execute seeding (opcional)
npm run db:seed
```

### **2. Configuração do Banco de Dados**

```bash
# Aplicar todas as migrações
psql -f database/schema.sql
psql -f database/functions.sql

# Migrações individuais
psql -f database/migrations/001_initial_setup.sql
psql -f database/migrations/002_campaigns_templates.sql
psql -f database/migrations/003_automations.sql
psql -f database/migrations/004_webhooks_api.sql
psql -f database/migrations/005_ab_testing.sql
psql -f database/migrations/006_add_foreign_keys.sql
psql -f database/migrations/007_fix_missing_tables.sql
psql -f database/migrations/008_api_key_expiration.sql
psql -f database/migrations/009_database_optimization_2mm_contacts.sql

# Verificar status das migrações
SELECT * FROM schema_migrations ORDER BY version;
```

### **3. Configuração do Redis**

```bash
# Instalar Redis (se self-hosted)
sudo apt update
sudo apt install redis-server

# Configurar Redis
sudo nano /etc/redis/redis.conf

# Configurações recomendadas:
# maxmemory 2gb
# maxmemory-policy allkeys-lru
# save 900 1
# save 300 10
# save 60 10000

# Reiniciar Redis
sudo systemctl restart redis
sudo systemctl enable redis
```

### **4. Configuração dos Workers**

```bash
# Criar serviço systemd para workers
sudo nano /etc/systemd/system/mailgenius-workers.service
```

```ini
[Unit]
Description=MailGenius Background Workers
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/mailgenius
Environment=NODE_ENV=production
ExecStart=/usr/bin/node scripts/start-workers.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=mailgenius-workers

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar e iniciar workers
sudo systemctl enable mailgenius-workers
sudo systemctl start mailgenius-workers
sudo systemctl status mailgenius-workers
```

### **5. Configuração do Nginx (se necessário)**

```bash
# Instalar Nginx
sudo apt install nginx

# Configurar proxy reverso
sudo nano /etc/nginx/sites-available/mailgenius
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Upload limits
    client_max_body_size 100M;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

```bash
# Habilitar site
sudo ln -s /etc/nginx/sites-available/mailgenius /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔧 Configuração Avançada

### **1. Database Optimization**

```sql
-- Configurações de performance do PostgreSQL
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET max_worker_processes = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_maintenance_workers = 4;

-- Reload configuration
SELECT pg_reload_conf();
```

### **2. Connection Pooling**

```javascript
// lib/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  min: parseInt(process.env.DB_POOL_MIN) || 5,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT) || 60000,
  maxUses: 7500,
  allowExitOnIdle: true
});

module.exports = pool;
```

### **3. Redis Configuration**

```javascript
// lib/redis.js
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  commandTimeout: 5000
});

module.exports = redis;
```

### **4. Queue Configuration**

```javascript
// lib/queue-config.js
const Queue = require('bull');
const redis = require('./redis');

const createQueue = (name, options = {}) => {
  return new Queue(name, {
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
    ...options
  });
};

module.exports = { createQueue };
```

## 🔍 Monitoramento e Health Checks

### **1. Health Check Endpoint**

```javascript
// api/health/route.js
export async function GET() {
  try {
    // Check database
    const dbCheck = await checkDatabase();
    
    // Check Redis
    const redisCheck = await checkRedis();
    
    // Check queue
    const queueCheck = await checkQueue();
    
    // Check external services
    const emailCheck = await checkEmailService();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        redis: redisCheck,
        queue: queueCheck,
        email: emailCheck
      }
    };
    
    return Response.json(health);
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 500 });
  }
}
```

### **2. Monitoring Dashboard**

```bash
# Configurar dashboard de monitoramento
npm install pm2 -g

# Configurar PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Monitorar aplicação
pm2 monit
pm2 logs
pm2 status
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'mailgenius-app',
      script: 'npm',
      args: 'start',
      cwd: '/path/to/mailgenius',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 5,
      error_file: '/var/log/mailgenius/error.log',
      out_file: '/var/log/mailgenius/out.log',
      log_file: '/var/log/mailgenius/combined.log',
      time: true
    },
    {
      name: 'mailgenius-workers',
      script: 'scripts/start-workers.js',
      cwd: '/path/to/mailgenius',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 5
    }
  ]
};
```

## 🔐 Segurança

### **1. SSL/TLS Configuration**

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Configurar renovação automática
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
```

### **2. Firewall Configuration**

```bash
# Configurar UFW
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5432/tcp  # PostgreSQL
sudo ufw deny 6379/tcp  # Redis
sudo ufw status
```

### **3. Security Headers**

```javascript
// middleware.js
export function middleware(request) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  return response;
}
```

## 🚀 Deployment em Vercel

### **1. Configuração do Vercel**

```json
// vercel.json
{
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096"
    }
  },
  "functions": {
    "app/api/**/*.js": {
      "maxDuration": 30
    }
  },
  "regions": ["iad1"],
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

### **2. Environment Variables**

```bash
# Configurar variáveis no Vercel
vercel env add NODE_ENV
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add RESEND_API_KEY
# ... outras variáveis
```

### **3. Deploy**

```bash
# Deploy para produção
vercel --prod

# Deploy de preview
vercel

# Logs em tempo real
vercel logs
```

## 🔄 Backup e Recovery

### **1. Database Backup**

```bash
#!/bin/bash
# scripts/backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/mailgenius"
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Executar backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compactar backup
gzip $BACKUP_FILE

# Remover backups antigos (manter 7 dias)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### **2. Redis Backup**

```bash
#!/bin/bash
# scripts/backup-redis.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/redis"
BACKUP_FILE="$BACKUP_DIR/redis_$TIMESTAMP.rdb"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Executar backup
redis-cli BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb $BACKUP_FILE

# Compactar backup
gzip $BACKUP_FILE

echo "Redis backup completed: $BACKUP_FILE.gz"
```

### **3. Automated Backup**

```bash
# Configurar cron job
sudo crontab -e

# Backup diário às 2:00 AM
0 2 * * * /path/to/scripts/backup-database.sh
0 2 * * * /path/to/scripts/backup-redis.sh

# Backup semanal completo
0 1 * * 0 /path/to/scripts/full-backup.sh
```

## 📊 Performance Tuning

### **1. Database Performance**

```sql
-- Analyzes performance
ANALYZE;

-- Vacuum full (durante manutenção)
VACUUM FULL ANALYZE;

-- Reindex (se necessário)
REINDEX DATABASE mailgenius;

-- Verificar queries lentas
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

### **2. Application Performance**

```javascript
// next.config.js
module.exports = {
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['mongoose']
  },
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ];
  }
};
```

### **3. Memory Optimization**

```javascript
// Configurar limits de memória
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Garbage collection
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    if (global.gc) {
      global.gc();
    }
  }, 60000); // Cada minuto
}
```

## 📈 Scaling Strategies

### **1. Horizontal Scaling**

```bash
# Load balancer configuration
upstream mailgenius {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://mailgenius;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### **2. Database Scaling**

```sql
-- Read replicas
CREATE PUBLICATION mailgenius_pub FOR ALL TABLES;

-- Partitioning
CREATE TABLE leads_2024 PARTITION OF leads
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### **3. Queue Scaling**

```javascript
// Multiple Redis instances
const queues = [
  new Queue('email-queue', { redis: redis1 }),
  new Queue('import-queue', { redis: redis2 }),
  new Queue('analytics-queue', { redis: redis3 })
];
```

## 🔍 Troubleshooting

### **1. Common Issues**

```bash
# Check logs
tail -f /var/log/mailgenius/error.log

# Check system resources
htop
df -h
free -h

# Check database connections
SELECT * FROM pg_stat_activity;

# Check Redis connections
redis-cli info clients
```

### **2. Debug Mode**

```bash
# Enable debug mode
export DEBUG=mailgenius:*
export VERBOSE_LOGGING=true

# Run with debug
npm run start
```

### **3. Health Checks**

```bash
# Application health
curl http://localhost:3000/api/health

# Database health
curl http://localhost:3000/api/health/database

# Queue health
curl http://localhost:3000/api/health/queue
```

## 📋 Deployment Checklist

### **Pre-deployment**
- [ ] Configurar variáveis de ambiente
- [ ] Testar conexões com banco de dados
- [ ] Verificar configuração do Redis
- [ ] Testar APIs externas
- [ ] Executar testes unitários
- [ ] Verificar builds de produção

### **Deployment**
- [ ] Aplicar migrações do banco
- [ ] Executar build de produção
- [ ] Configurar workers
- [ ] Configurar nginx/proxy
- [ ] Configurar SSL/TLS
- [ ] Configurar monitoramento

### **Post-deployment**
- [ ] Verificar health checks
- [ ] Testar funcionalidades críticas
- [ ] Configurar alertas
- [ ] Configurar backups
- [ ] Documentar configuração
- [ ] Treinar equipe

## 📚 Scripts Úteis

### **1. Deployment Script**

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "Starting deployment..."

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Build application
npm run build

# Restart services
sudo systemctl restart mailgenius-app
sudo systemctl restart mailgenius-workers

# Health check
sleep 10
curl -f http://localhost:3000/api/health || exit 1

echo "Deployment completed successfully!"
```

### **2. Monitoring Script**

```bash
#!/bin/bash
# scripts/monitor.sh

# Check application status
if ! curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "Application is down!"
    sudo systemctl restart mailgenius-app
fi

# Check workers
if ! sudo systemctl is-active --quiet mailgenius-workers; then
    echo "Workers are down!"
    sudo systemctl restart mailgenius-workers
fi

# Check database
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "Database is down!"
    # Alert admin
fi
```

---

## 📞 Support

Para suporte e dúvidas:
- **Email**: devops@yourdomain.com
- **Slack**: #mailgenius-ops
- **Documentation**: https://docs.yourdomain.com

---

**Atualizado**: 2024-07-16  
**Versão**: 2.0  
**Autor**: DevOps Team  
**Status**: Produção Ready