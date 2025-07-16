# MailGenius - Guia de Operações e Manutenção

## 🔧 Visão Geral das Operações

Este guia fornece procedimentos completos para operação e manutenção do MailGenius em produção. Inclui rotinas de manutenção, procedures de backup, estratégias de scaling e otimizações para suportar 2MM+ contatos.

## 📅 Rotinas de Manutenção

### **1. Manutenção Diária**

#### **Checklist Diário**
```bash
#!/bin/bash
# scripts/daily-maintenance.sh

echo "=== Daily Maintenance - $(date) ==="

# 1. Health Check
echo "1. Performing health check..."
curl -s http://localhost:3000/api/health | jq -r '.status // "ERROR"'

# 2. System Resources
echo "2. Checking system resources..."
df -h | grep -E "(/$|/var|/tmp)" | awk '{print $1 ": " $5 " used"}'
free -h | grep "Mem:" | awk '{print "Memory: " $3 "/" $2 " (" $3/$2*100 "%)"}'

# 3. Database Health
echo "3. Checking database health..."
sudo -u postgres psql -c "SELECT count(*) as connections FROM pg_stat_activity;" | tail -1

# 4. Queue Status
echo "4. Checking queue status..."
curl -s http://localhost:3000/api/queue/status | jq -r '.queues[] | .name + ": " + (.waiting|tostring) + " waiting"'

# 5. Error Logs
echo "5. Checking for critical errors..."
grep -c "ERROR\|FATAL" /var/log/mailgenius/app.log | tail -1

# 6. Performance Metrics
echo "6. Checking performance metrics..."
curl -s http://localhost:3000/api/monitoring/metrics | jq -r '.api.response_time.p95 // "N/A"'

# 7. Email Delivery
echo "7. Checking email delivery..."
curl -s http://localhost:3000/api/monitoring/emails/metrics | jq -r '.delivery_rate // "N/A"'

echo "=== Daily Maintenance Complete ==="
```

#### **Tarefas Diárias**
- [ ] Verificar health check geral
- [ ] Monitorar uso de recursos (CPU, RAM, Disk)
- [ ] Verificar conexões de database
- [ ] Monitorar status das filas
- [ ] Revisar logs de erro
- [ ] Verificar métricas de performance
- [ ] Monitorar taxa de entrega de emails
- [ ] Executar backup incremental
- [ ] Limpar arquivos temporários
- [ ] Verificar alertas pendentes

### **2. Manutenção Semanal**

#### **Checklist Semanal**
```bash
#!/bin/bash
# scripts/weekly-maintenance.sh

echo "=== Weekly Maintenance - $(date) ==="

# 1. Database Optimization
echo "1. Optimizing database..."
sudo -u postgres psql -d mailgenius -c "ANALYZE; VACUUM ANALYZE;"

# 2. Index Analysis
echo "2. Analyzing indexes..."
sudo -u postgres psql -d mailgenius -c "
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY idx_tup_read DESC
LIMIT 10;"

# 3. Log Rotation
echo "3. Rotating logs..."
sudo logrotate -f /etc/logrotate.d/mailgenius

# 4. Performance Analysis
echo "4. Analyzing performance..."
sudo -u postgres psql -d mailgenius -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY total_time DESC
LIMIT 5;"

# 5. Cache Cleanup
echo "5. Cleaning cache..."
redis-cli eval "
local keys = redis.call('keys', ARGV[1])
for i=1,#keys,5000 do
    redis.call('del', unpack(keys, i, math.min(i+4999, #keys)))
end
return #keys
" 0 "*cache:*"

# 6. Queue Cleanup
echo "6. Cleaning completed jobs..."
curl -X POST http://localhost:3000/api/queue/admin \
  -H "Content-Type: application/json" \
  -d '{"action": "clean", "queue": "email-sending", "type": "completed"}'

# 7. Security Updates
echo "7. Checking security updates..."
sudo apt update && sudo apt list --upgradable | grep -i security

echo "=== Weekly Maintenance Complete ==="
```

#### **Tarefas Semanais**
- [ ] Executar VACUUM e ANALYZE no database
- [ ] Analisar uso de índices
- [ ] Rodar análise de performance
- [ ] Limpar cache Redis
- [ ] Limpar jobs completed das filas
- [ ] Executar backup completo
- [ ] Verificar security updates
- [ ] Rodar testes de performance
- [ ] Revisar capacidade e usage
- [ ] Atualizar documentação operacional

### **3. Manutenção Mensal**

#### **Checklist Mensal**
```bash
#!/bin/bash
# scripts/monthly-maintenance.sh

echo "=== Monthly Maintenance - $(date) ==="

# 1. Full Database Vacuum
echo "1. Performing full database vacuum..."
sudo -u postgres psql -d mailgenius -c "VACUUM FULL ANALYZE;"

# 2. Reindex Critical Tables
echo "2. Reindexing critical tables..."
sudo -u postgres psql -d mailgenius -c "
REINDEX TABLE leads;
REINDEX TABLE email_sends;
REINDEX TABLE campaigns;
"

# 3. Partition Maintenance
echo "3. Managing partitions..."
sudo -u postgres psql -d mailgenius -c "
SELECT create_monthly_partitions();
SELECT cleanup_old_partitions();
"

# 4. Capacity Analysis
echo "4. Analyzing capacity..."
sudo -u postgres psql -d mailgenius -c "
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
       pg_stat_get_tuples_inserted(c.oid) as inserts,
       pg_stat_get_tuples_updated(c.oid) as updates,
       pg_stat_get_tuples_deleted(c.oid) as deletes
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC
LIMIT 10;
"

# 5. Security Audit
echo "5. Performing security audit..."
./scripts/security-audit.sh

# 6. Performance Baseline
echo "6. Establishing performance baseline..."
./scripts/performance-baseline.sh

# 7. Dependency Updates
echo "7. Checking dependency updates..."
npm outdated

echo "=== Monthly Maintenance Complete ==="
```

#### **Tarefas Mensais**
- [ ] Executar VACUUM FULL
- [ ] Reindex tabelas críticas
- [ ] Gerenciar partições
- [ ] Análise de capacidade
- [ ] Auditoria de segurança
- [ ] Baseline de performance
- [ ] Atualizar dependências
- [ ] Revisão de configurações
- [ ] Testes de disaster recovery
- [ ] Planejamento de capacidade

## 💾 Estratégias de Backup

### **1. Backup do Database**

#### **Backup Incremental (Diário)**
```bash
#!/bin/bash
# scripts/backup-database-incremental.sh

BACKUP_DIR="/backup/mailgenius/incremental"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/incremental_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

echo "Starting incremental backup - $(date)"

# Backup with compression
pg_dump -h localhost -U mailgenius -d mailgenius \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_FILE.backup"

# Verify backup
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_FILE.backup"
    
    # Create manifest
    echo "Backup Date: $(date)" > "$BACKUP_FILE.manifest"
    echo "Backup Size: $(du -h $BACKUP_FILE.backup | cut -f1)" >> "$BACKUP_FILE.manifest"
    echo "Database Size: $(psql -h localhost -U mailgenius -d mailgenius -c "SELECT pg_size_pretty(pg_database_size('mailgenius'));" -t)" >> "$BACKUP_FILE.manifest"
    
    # Remove backups older than 7 days
    find $BACKUP_DIR -name "incremental_*.backup" -mtime +7 -delete
    find $BACKUP_DIR -name "incremental_*.manifest" -mtime +7 -delete
    
    echo "Incremental backup completed successfully"
else
    echo "ERROR: Backup failed"
    exit 1
fi
```

#### **Backup Completo (Semanal)**
```bash
#!/bin/bash
# scripts/backup-database-full.sh

BACKUP_DIR="/backup/mailgenius/full"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/full_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

echo "Starting full backup - $(date)"

# Full backup with all data
pg_dump -h localhost -U mailgenius -d mailgenius \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="$BACKUP_FILE.backup"

# Backup schema only
pg_dump -h localhost -U mailgenius -d mailgenius \
  --schema-only \
  --file="$BACKUP_FILE.schema.sql"

# Backup data only
pg_dump -h localhost -U mailgenius -d mailgenius \
  --data-only \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_FILE.data.backup"

# Verify backup
if [ $? -eq 0 ]; then
    echo "Full backup completed successfully"
    
    # Create detailed manifest
    echo "Full Backup Report - $(date)" > "$BACKUP_FILE.manifest"
    echo "=================================" >> "$BACKUP_FILE.manifest"
    echo "Backup Files:" >> "$BACKUP_FILE.manifest"
    echo "- Full: $BACKUP_FILE.backup ($(du -h $BACKUP_FILE.backup | cut -f1))" >> "$BACKUP_FILE.manifest"
    echo "- Schema: $BACKUP_FILE.schema.sql ($(du -h $BACKUP_FILE.schema.sql | cut -f1))" >> "$BACKUP_FILE.manifest"
    echo "- Data: $BACKUP_FILE.data.backup ($(du -h $BACKUP_FILE.data.backup | cut -f1))" >> "$BACKUP_FILE.manifest"
    echo "" >> "$BACKUP_FILE.manifest"
    
    # Database statistics
    echo "Database Statistics:" >> "$BACKUP_FILE.manifest"
    psql -h localhost -U mailgenius -d mailgenius -c "
    SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
        pg_stat_get_tuples_inserted(c.oid) as inserts,
        pg_stat_get_tuples_updated(c.oid) as updates,
        pg_stat_get_tuples_deleted(c.oid) as deletes
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(tablename::regclass) DESC;
    " >> "$BACKUP_FILE.manifest"
    
    # Remove backups older than 30 days
    find $BACKUP_DIR -name "full_*.backup" -mtime +30 -delete
    find $BACKUP_DIR -name "full_*.sql" -mtime +30 -delete
    find $BACKUP_DIR -name "full_*.manifest" -mtime +30 -delete
    
    echo "Full backup completed successfully"
else
    echo "ERROR: Full backup failed"
    exit 1
fi
```

### **2. Backup do Redis**

#### **Backup Redis**
```bash
#!/bin/bash
# scripts/backup-redis.sh

BACKUP_DIR="/backup/mailgenius/redis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/redis_$TIMESTAMP.rdb"

mkdir -p $BACKUP_DIR

echo "Starting Redis backup - $(date)"

# Force Redis to save
redis-cli BGSAVE

# Wait for save to complete
while [ $(redis-cli LASTSAVE) -eq $(redis-cli LASTSAVE) ]; do
    sleep 1
done

# Copy RDB file
cp /var/lib/redis/dump.rdb $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Verify backup
if [ -f "$BACKUP_FILE.gz" ]; then
    echo "Redis backup completed: $BACKUP_FILE.gz"
    
    # Create manifest
    echo "Redis Backup - $(date)" > "$BACKUP_FILE.manifest"
    echo "Backup Size: $(du -h $BACKUP_FILE.gz | cut -f1)" >> "$BACKUP_FILE.manifest"
    echo "Redis Info:" >> "$BACKUP_FILE.manifest"
    redis-cli info memory >> "$BACKUP_FILE.manifest"
    
    # Remove old backups
    find $BACKUP_DIR -name "redis_*.rdb.gz" -mtime +7 -delete
    find $BACKUP_DIR -name "redis_*.manifest" -mtime +7 -delete
    
    echo "Redis backup completed successfully"
else
    echo "ERROR: Redis backup failed"
    exit 1
fi
```

### **3. Backup de Arquivos e Configurações**

#### **Backup de Aplicação**
```bash
#!/bin/bash
# scripts/backup-application.sh

BACKUP_DIR="/backup/mailgenius/application"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/app_$TIMESTAMP.tar.gz"
APP_DIR="/path/to/mailgenius"

mkdir -p $BACKUP_DIR

echo "Starting application backup - $(date)"

# Create application backup
tar -czf $BACKUP_FILE \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="*.log" \
  --exclude="tmp" \
  $APP_DIR

# Backup configuration files
tar -czf "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" \
  /etc/nginx/sites-available/mailgenius \
  /etc/postgresql/*/main/postgresql.conf \
  /etc/redis/redis.conf \
  /etc/logrotate.d/mailgenius

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    echo "Application backup completed: $BACKUP_FILE"
    
    # Create manifest
    echo "Application Backup - $(date)" > "$BACKUP_FILE.manifest"
    echo "Backup Size: $(du -h $BACKUP_FILE | cut -f1)" >> "$BACKUP_FILE.manifest"
    echo "Git Commit: $(cd $APP_DIR && git rev-parse HEAD)" >> "$BACKUP_FILE.manifest"
    echo "Node Version: $(node --version)" >> "$BACKUP_FILE.manifest"
    echo "NPM Version: $(npm --version)" >> "$BACKUP_FILE.manifest"
    
    # Remove old backups
    find $BACKUP_DIR -name "app_*.tar.gz" -mtime +14 -delete
    find $BACKUP_DIR -name "config_*.tar.gz" -mtime +14 -delete
    find $BACKUP_DIR -name "app_*.manifest" -mtime +14 -delete
    
    echo "Application backup completed successfully"
else
    echo "ERROR: Application backup failed"
    exit 1
fi
```

### **4. Restore Procedures**

#### **Restore Database**
```bash
#!/bin/bash
# scripts/restore-database.sh

BACKUP_FILE=$1
TARGET_DB=${2:-mailgenius}

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file> [target_db]"
    exit 1
fi

echo "Starting database restore - $(date)"
echo "Backup file: $BACKUP_FILE"
echo "Target database: $TARGET_DB"

# Stop application
pm2 stop all

# Create backup of current database
pg_dump -h localhost -U mailgenius -d $TARGET_DB > "/tmp/${TARGET_DB}_pre_restore_$(date +%Y%m%d_%H%M%S).sql"

# Drop existing database
dropdb -h localhost -U mailgenius $TARGET_DB

# Create new database
createdb -h localhost -U mailgenius $TARGET_DB

# Restore from backup
if [[ $BACKUP_FILE == *.backup ]]; then
    pg_restore -h localhost -U mailgenius -d $TARGET_DB -v $BACKUP_FILE
else
    psql -h localhost -U mailgenius -d $TARGET_DB -f $BACKUP_FILE
fi

# Verify restore
if [ $? -eq 0 ]; then
    echo "Database restore completed successfully"
    
    # Start application
    pm2 start all
    
    # Wait for application to start
    sleep 10
    
    # Test application
    curl -s http://localhost:3000/api/health
    
    echo "Database restore completed successfully"
else
    echo "ERROR: Database restore failed"
    exit 1
fi
```

#### **Restore Redis**
```bash
#!/bin/bash
# scripts/restore-redis.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

echo "Starting Redis restore - $(date)"
echo "Backup file: $BACKUP_FILE"

# Stop Redis
sudo systemctl stop redis

# Backup current data
cp /var/lib/redis/dump.rdb "/tmp/redis_pre_restore_$(date +%Y%m%d_%H%M%S).rdb"

# Restore backup
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c $BACKUP_FILE > /var/lib/redis/dump.rdb
else
    cp $BACKUP_FILE /var/lib/redis/dump.rdb
fi

# Set permissions
chown redis:redis /var/lib/redis/dump.rdb
chmod 660 /var/lib/redis/dump.rdb

# Start Redis
sudo systemctl start redis

# Verify restore
if redis-cli ping > /dev/null; then
    echo "Redis restore completed successfully"
else
    echo "ERROR: Redis restore failed"
    exit 1
fi
```

## 📈 Estratégias de Scaling

### **1. Horizontal Scaling**

#### **Database Scaling**
```bash
#!/bin/bash
# scripts/setup-read-replica.sh

MASTER_HOST="localhost"
REPLICA_HOST="replica.mailgenius.com"
REPLICA_USER="replica_user"

echo "Setting up read replica - $(date)"

# Configure master for replication
sudo -u postgres psql -c "
CREATE USER $REPLICA_USER REPLICATION LOGIN ENCRYPTED PASSWORD 'replica_password';
SELECT pg_create_physical_replication_slot('replica_slot');
"

# Configure pg_hba.conf
echo "host replication $REPLICA_USER $REPLICA_HOST/32 md5" >> /etc/postgresql/*/main/pg_hba.conf

# Configure postgresql.conf
echo "wal_level = replica" >> /etc/postgresql/*/main/postgresql.conf
echo "max_wal_senders = 3" >> /etc/postgresql/*/main/postgresql.conf
echo "wal_keep_segments = 32" >> /etc/postgresql/*/main/postgresql.conf

# Restart PostgreSQL
sudo systemctl restart postgresql

echo "Read replica setup completed"
```

#### **Application Scaling**
```bash
#!/bin/bash
# scripts/scale-application.sh

SCALE_TYPE=$1
SCALE_VALUE=$2

case $SCALE_TYPE in
    "up")
        echo "Scaling up application..."
        pm2 scale mailgenius-app +$SCALE_VALUE
        pm2 scale mailgenius-workers +$SCALE_VALUE
        ;;
    "down")
        echo "Scaling down application..."
        pm2 scale mailgenius-app -$SCALE_VALUE
        pm2 scale mailgenius-workers -$SCALE_VALUE
        ;;
    "set")
        echo "Setting application scale..."
        pm2 scale mailgenius-app $SCALE_VALUE
        pm2 scale mailgenius-workers $SCALE_VALUE
        ;;
    *)
        echo "Usage: $0 {up|down|set} <value>"
        exit 1
        ;;
esac

# Wait for scaling to complete
sleep 5

# Verify scaling
pm2 status

echo "Application scaling completed"
```

### **2. Vertical Scaling**

#### **Resource Monitoring**
```bash
#!/bin/bash
# scripts/monitor-resources.sh

echo "=== Resource Monitoring - $(date) ==="

# CPU Usage
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print "  Total: " $2 + $4 "%"}'

# Memory Usage
echo "Memory Usage:"
free -h | grep "Mem:" | awk '{print "  Used: " $3 " / " $2 " (" $3/$2*100 "%)"}'

# Disk Usage
echo "Disk Usage:"
df -h | grep -E "(/$|/var|/tmp)" | awk '{print "  " $1 ": " $5 " used (" $4 " available)"}'

# Database Connections
echo "Database Connections:"
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;" | tail -1 | awk '{print "  Active: " $1}'

# Redis Memory
echo "Redis Memory:"
redis-cli info memory | grep "used_memory_human:" | awk -F: '{print "  Used: " $2}'

# Queue Status
echo "Queue Status:"
curl -s http://localhost:3000/api/queue/status | jq -r '.queues[] | "  " + .name + ": " + (.waiting|tostring) + " waiting"'

echo "=== Resource Monitoring Complete ==="
```

#### **Auto-scaling Configuration**
```bash
#!/bin/bash
# scripts/auto-scale.sh

# Configuration
CPU_THRESHOLD=80
MEMORY_THRESHOLD=80
QUEUE_THRESHOLD=1000
SCALE_UP_AMOUNT=2
SCALE_DOWN_AMOUNT=1

# Get current metrics
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}' | cut -d'%' -f1)
MEMORY_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -d'.' -f1)
QUEUE_DEPTH=$(curl -s http://localhost:3000/api/queue/status | jq -r '.queues[] | select(.name=="email-sending") | .waiting')

echo "Current metrics: CPU=$CPU_USAGE%, Memory=$MEMORY_USAGE%, Queue=$QUEUE_DEPTH"

# Scale up conditions
if [ $CPU_USAGE -gt $CPU_THRESHOLD ] || [ $MEMORY_USAGE -gt $MEMORY_THRESHOLD ] || [ $QUEUE_DEPTH -gt $QUEUE_THRESHOLD ]; then
    echo "Scaling up..."
    ./scripts/scale-application.sh up $SCALE_UP_AMOUNT
    
    # Log scaling event
    echo "$(date): Scaled up - CPU=$CPU_USAGE%, Memory=$MEMORY_USAGE%, Queue=$QUEUE_DEPTH" >> /var/log/mailgenius/scaling.log
fi

# Scale down conditions (more conservative)
if [ $CPU_USAGE -lt 30 ] && [ $MEMORY_USAGE -lt 30 ] && [ $QUEUE_DEPTH -lt 100 ]; then
    CURRENT_INSTANCES=$(pm2 list | grep mailgenius-app | wc -l)
    
    if [ $CURRENT_INSTANCES -gt 2 ]; then
        echo "Scaling down..."
        ./scripts/scale-application.sh down $SCALE_DOWN_AMOUNT
        
        # Log scaling event
        echo "$(date): Scaled down - CPU=$CPU_USAGE%, Memory=$MEMORY_USAGE%, Queue=$QUEUE_DEPTH" >> /var/log/mailgenius/scaling.log
    fi
fi
```

### **3. Load Balancing**

#### **Nginx Load Balancer**
```nginx
# /etc/nginx/sites-available/mailgenius-lb
upstream mailgenius_backend {
    # Application servers
    server 127.0.0.1:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 weight=2 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

server {
    listen 80;
    server_name mailgenius.com www.mailgenius.com;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Load balancing
    location / {
        proxy_pass http://mailgenius_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffer settings
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://mailgenius_backend/api/health;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
    
    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri @backend;
    }
    
    location @backend {
        proxy_pass http://mailgenius_backend;
    }
}
```

## 🔐 Segurança e Compliance

### **1. Security Audit**

#### **Security Checklist**
```bash
#!/bin/bash
# scripts/security-audit.sh

echo "=== Security Audit - $(date) ==="

# 1. System Updates
echo "1. Checking system updates..."
sudo apt list --upgradable | grep -i security | wc -l

# 2. SSH Configuration
echo "2. Checking SSH configuration..."
grep -E "(PasswordAuthentication|PermitRootLogin|Port)" /etc/ssh/sshd_config

# 3. Firewall Status
echo "3. Checking firewall status..."
sudo ufw status

# 4. SSL Certificates
echo "4. Checking SSL certificates..."
echo | openssl s_client -connect mailgenius.com:443 2>/dev/null | openssl x509 -noout -dates

# 5. Database Security
echo "5. Checking database security..."
sudo -u postgres psql -c "SELECT rolname, rolcreaterole, rolcreatedb, rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg_%';"

# 6. File Permissions
echo "6. Checking file permissions..."
find /path/to/mailgenius -name "*.env*" -exec ls -la {} \;

# 7. API Security
echo "7. Checking API security..."
curl -s -I http://localhost:3000/api/health | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection)"

# 8. Dependency Vulnerabilities
echo "8. Checking dependency vulnerabilities..."
npm audit --audit-level=moderate

echo "=== Security Audit Complete ==="
```

### **2. Compliance Procedures**

#### **GDPR Compliance**
```bash
#!/bin/bash
# scripts/gdpr-compliance.sh

echo "=== GDPR Compliance Check - $(date) ==="

# 1. Data Retention
echo "1. Checking data retention..."
sudo -u postgres psql -d mailgenius -c "
SELECT 
    'leads' as table_name,
    count(*) as total_records,
    count(*) FILTER (WHERE created_at < NOW() - INTERVAL '2 years') as old_records
FROM leads
UNION ALL
SELECT 
    'lead_activities' as table_name,
    count(*) as total_records,
    count(*) FILTER (WHERE created_at < NOW() - INTERVAL '2 years') as old_records
FROM lead_activities;
"

# 2. Data Encryption
echo "2. Checking data encryption..."
sudo -u postgres psql -d mailgenius -c "SELECT name, setting FROM pg_settings WHERE name LIKE '%ssl%';"

# 3. Access Logs
echo "3. Checking access logs..."
grep -c "personal_data_access" /var/log/mailgenius/audit.log

# 4. Data Deletion Requests
echo "4. Processing data deletion requests..."
# Implementation depends on your specific requirements

echo "=== GDPR Compliance Check Complete ==="
```

## 📊 Capacity Planning

### **1. Growth Analysis**

#### **Capacity Analysis**
```bash
#!/bin/bash
# scripts/capacity-analysis.sh

echo "=== Capacity Analysis - $(date) ==="

# 1. Database Growth
echo "1. Database growth analysis..."
sudo -u postgres psql -d mailgenius -c "
WITH growth_data AS (
    SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as new_leads
    FROM leads
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month
)
SELECT 
    month,
    new_leads,
    SUM(new_leads) OVER (ORDER BY month) as cumulative_leads,
    LAG(new_leads, 1) OVER (ORDER BY month) as prev_month,
    CASE 
        WHEN LAG(new_leads, 1) OVER (ORDER BY month) > 0 
        THEN ROUND(((new_leads - LAG(new_leads, 1) OVER (ORDER BY month))::numeric / LAG(new_leads, 1) OVER (ORDER BY month)) * 100, 2)
        ELSE 0
    END as growth_rate
FROM growth_data;
"

# 2. Storage Growth
echo "2. Storage growth analysis..."
sudo -u postgres psql -d mailgenius -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as current_size,
    pg_stat_get_tuples_inserted(c.oid) as total_inserts,
    pg_stat_get_tuples_updated(c.oid) as total_updates,
    pg_stat_get_tuples_deleted(c.oid) as total_deletes,
    CASE 
        WHEN pg_stat_get_tuples_inserted(c.oid) > 0 
        THEN pg_size_pretty(pg_total_relation_size(tablename::regclass) / pg_stat_get_tuples_inserted(c.oid))
        ELSE 'N/A'
    END as avg_size_per_row
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
"

# 3. Performance Trends
echo "3. Performance trends..."
curl -s http://localhost:3000/api/monitoring/metrics | jq -r '
.database.query_performance.avg_query_time as $avg_time |
.api.response_time.p95 as $response_time |
.queue.throughput.current as $throughput |
"Average Query Time: " + ($avg_time|tostring) + "ms",
"API Response Time (p95): " + ($response_time|tostring) + "ms",
"Queue Throughput: " + ($throughput|tostring) + " jobs/min"
'

# 4. Resource Utilization
echo "4. Resource utilization..."
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}')%"
echo "Memory Usage: $(free | grep Mem | awk '{print ($3/$2) * 100.0}')%"
echo "Disk Usage: $(df / | tail -1 | awk '{print $5}')"

echo "=== Capacity Analysis Complete ==="
```

### **2. Forecasting**

#### **Growth Projection**
```bash
#!/bin/bash
# scripts/growth-projection.sh

echo "=== Growth Projection - $(date) ==="

# Current statistics
CURRENT_LEADS=$(sudo -u postgres psql -d mailgenius -c "SELECT count(*) FROM leads;" -t)
CURRENT_SIZE=$(sudo -u postgres psql -d mailgenius -c "SELECT pg_size_pretty(pg_database_size('mailgenius'));" -t)
MONTHLY_GROWTH=$(sudo -u postgres psql -d mailgenius -c "
SELECT COALESCE(COUNT(*), 0) 
FROM leads 
WHERE created_at >= DATE_TRUNC('month', NOW());" -t)

echo "Current Statistics:"
echo "  Total Leads: $CURRENT_LEADS"
echo "  Database Size: $CURRENT_SIZE"
echo "  Monthly Growth: $MONTHLY_GROWTH"
echo

# Projections
echo "6-Month Projections:"
PROJECTED_LEADS=$((CURRENT_LEADS + (MONTHLY_GROWTH * 6)))
PROJECTED_SIZE_GB=$((PROJECTED_LEADS / 100000)) # Rough estimate: 100k leads = 1GB
echo "  Projected Leads: $PROJECTED_LEADS"
echo "  Projected Size: ~${PROJECTED_SIZE_GB}GB"
echo

echo "12-Month Projections:"
PROJECTED_LEADS_12M=$((CURRENT_LEADS + (MONTHLY_GROWTH * 12)))
PROJECTED_SIZE_12M_GB=$((PROJECTED_LEADS_12M / 100000))
echo "  Projected Leads: $PROJECTED_LEADS_12M"
echo "  Projected Size: ~${PROJECTED_SIZE_12M_GB}GB"
echo

# Recommendations
echo "Recommendations:"
if [ $PROJECTED_LEADS_12M -gt 5000000 ]; then
    echo "  - Consider database sharding"
    echo "  - Implement read replicas"
    echo "  - Optimize queries and indexes"
fi

if [ $PROJECTED_SIZE_12M_GB -gt 100 ]; then
    echo "  - Plan for storage expansion"
    echo "  - Implement data archiving"
    echo "  - Consider data partitioning"
fi

echo "=== Growth Projection Complete ==="
```

## 📋 Operational Procedures

### **1. Deployment Procedures**

#### **Production Deployment**
```bash
#!/bin/bash
# scripts/deploy-production.sh

echo "=== Production Deployment - $(date) ==="

# 1. Pre-deployment checks
echo "1. Pre-deployment checks..."
./scripts/pre-deployment-check.sh

# 2. Create backup
echo "2. Creating backup..."
./scripts/backup-database-full.sh

# 3. Stop application
echo "3. Stopping application..."
pm2 stop all

# 4. Update code
echo "4. Updating code..."
git pull origin main

# 5. Install dependencies
echo "5. Installing dependencies..."
npm install --production

# 6. Run migrations
echo "6. Running migrations..."
npm run db:migrate

# 7. Build application
echo "7. Building application..."
npm run build

# 8. Start application
echo "8. Starting application..."
pm2 start all

# 9. Post-deployment checks
echo "9. Post-deployment checks..."
sleep 30
./scripts/post-deployment-check.sh

# 10. Smoke tests
echo "10. Running smoke tests..."
./scripts/smoke-tests.sh

echo "=== Production Deployment Complete ==="
```

### **2. Incident Response**

#### **Incident Response Plan**
```bash
#!/bin/bash
# scripts/incident-response.sh

INCIDENT_TYPE=$1
SEVERITY=$2

echo "=== Incident Response - $(date) ==="
echo "Incident Type: $INCIDENT_TYPE"
echo "Severity: $SEVERITY"

case $INCIDENT_TYPE in
    "database_down")
        echo "Responding to database incident..."
        ./scripts/recover-database.sh
        ;;
    "application_down")
        echo "Responding to application incident..."
        pm2 restart all
        ;;
    "high_cpu")
        echo "Responding to high CPU incident..."
        ./scripts/scale-application.sh up 2
        ;;
    "high_memory")
        echo "Responding to high memory incident..."
        ./scripts/optimize-memory.sh
        ;;
    "queue_backup")
        echo "Responding to queue backup incident..."
        ./scripts/clear-queue.sh
        ;;
    *)
        echo "Unknown incident type: $INCIDENT_TYPE"
        exit 1
        ;;
esac

# Notify stakeholders
case $SEVERITY in
    "critical")
        ./scripts/send-alert.sh "critical" "Incident: $INCIDENT_TYPE - Response initiated"
        ;;
    "high")
        ./scripts/send-alert.sh "warning" "Incident: $INCIDENT_TYPE - Response initiated"
        ;;
    *)
        ./scripts/send-alert.sh "info" "Incident: $INCIDENT_TYPE - Response initiated"
        ;;
esac

echo "=== Incident Response Complete ==="
```

### **3. Change Management**

#### **Change Request Process**
```bash
#!/bin/bash
# scripts/change-request.sh

CHANGE_TYPE=$1
CHANGE_DESCRIPTION=$2
REQUESTOR=$3

echo "=== Change Request - $(date) ==="
echo "Change Type: $CHANGE_TYPE"
echo "Description: $CHANGE_DESCRIPTION"
echo "Requestor: $REQUESTOR"

# Create change request record
echo "$(date)|$CHANGE_TYPE|$CHANGE_DESCRIPTION|$REQUESTOR|PENDING" >> /var/log/mailgenius/change-requests.log

# Validate change request
case $CHANGE_TYPE in
    "configuration")
        echo "Configuration change requested..."
        # Require approval for production changes
        if [ "$ENV" = "production" ]; then
            echo "Production configuration change requires approval"
            # Send notification to approvers
        fi
        ;;
    "deployment")
        echo "Deployment change requested..."
        # Run pre-deployment checks
        ./scripts/pre-deployment-check.sh
        ;;
    "infrastructure")
        echo "Infrastructure change requested..."
        # Require senior approval
        echo "Infrastructure change requires senior approval"
        ;;
    *)
        echo "Standard change request"
        ;;
esac

echo "=== Change Request Logged ==="
```

---

## 📞 Support e Contacts

### **Emergency Contacts**
- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **Database Admin**: dba@mailgenius.com
- **DevOps Lead**: devops@mailgenius.com
- **Security Team**: security@mailgenius.com

### **Escalation Matrix**
1. **L1 Support**: Basic operations and monitoring
2. **L2 Support**: Advanced troubleshooting
3. **L3 Support**: Architecture and code issues
4. **Management**: Critical business impact

### **Communication Channels**
- **Slack**: #ops-alerts, #ops-general
- **Email**: ops@mailgenius.com
- **PagerDuty**: mailgenius-ops
- **Status Page**: https://status.mailgenius.com

---

## 📚 Documentation References

### **Internal Documentation**
- [System Architecture](./SYSTEM_ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Performance Configuration](./PERFORMANCE_CONFIGURATION.md)

### **External Resources**
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)

---

**Atualizado**: 2024-07-16  
**Versão**: 2.0  
**Autor**: Operations Team  
**Status**: Produção Ready