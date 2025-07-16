# MailGenius - Guia de Troubleshooting

## 🔍 Visão Geral do Troubleshooting

Este guia fornece procedimentos sistemáticos para identificar, diagnosticar e resolver problemas no MailGenius. Inclui troubleshooting para todos os componentes do sistema escalável para 2MM+ contatos.

## 📋 Procedimentos Gerais

### **1. Diagnóstico Inicial**

#### **Health Check Completo**
```bash
# Verificar status geral do sistema
curl -s http://localhost:3000/api/health | jq

# Verificar serviços individuais
curl -s http://localhost:3000/api/health/database | jq
curl -s http://localhost:3000/api/health/redis | jq
curl -s http://localhost:3000/api/health/queue | jq
curl -s http://localhost:3000/api/health/email | jq
```

#### **Verificar Recursos do Sistema**
```bash
# CPU, Memory, Disk usage
htop
free -h
df -h

# Verificar processos
ps aux | grep -E "(node|postgres|redis)" | head -20

# Verificar conexões de rede
netstat -tuln | grep -E "(3000|5432|6379)"
```

#### **Verificar Logs do Sistema**
```bash
# Logs da aplicação
tail -f /var/log/mailgenius/app.log

# Logs dos workers
tail -f /var/log/mailgenius/workers.log

# Logs de erro
tail -f /var/log/mailgenius/error.log

# Logs do sistema
journalctl -u mailgenius-app -f
journalctl -u mailgenius-workers -f
```

### **2. Ferramentas de Diagnóstico**

#### **Scripts de Diagnóstico**
```bash
# Script completo de diagnóstico
./scripts/diagnose-system.sh

# Verificar performance
./scripts/performance-check.sh

# Verificar conectividade
./scripts/connectivity-check.sh

# Verificar configurações
./scripts/config-check.sh
```

#### **Dashboard de Monitoramento**
```
URL: http://localhost:3000/dashboard/monitoring
Seções:
- System Health
- Performance Metrics
- Queue Status
- Error Logs
- Real-time Alerts
```

## 🗄️ Problemas de Database

### **1. Conexão com Database**

#### **Symptoms**
- Aplicação não consegue conectar ao banco
- Timeouts de conexão
- Erro "too many connections"
- Queries muito lentas

#### **Diagnosis**
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Verificar conexões ativas
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Verificar configuração de conexões
sudo -u postgres psql -c "SHOW max_connections;"
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Verificar logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### **Solutions**
```bash
# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Aumentar max_connections (se necessário)
sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = 200;"
sudo systemctl restart postgresql

# Matar conexões ociosas
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '1 hour';"

# Verificar configuração de pool
grep -r "pool" /path/to/mailgenius/src/lib/
```

### **2. Performance de Database**

#### **Symptoms**
- Queries lentas (>1 segundo)
- Alto uso de CPU no database
- Locks de database
- Timeouts de query

#### **Diagnosis**
```sql
-- Verificar queries lentas
SELECT query, calls, total_time, mean_time, stddev_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Verificar locks
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

-- Verificar uso de índices
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Verificar tamanho das tabelas
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
       pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

#### **Solutions**
```sql
-- Matar queries problemáticas
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 'problema_pid';

-- Executar VACUUM e ANALYZE
VACUUM ANALYZE;

-- Recriar índices se necessário
REINDEX INDEX index_name;

-- Atualizar estatísticas
ANALYZE;

-- Limpar cache de queries
SELECT pg_stat_reset();
```

### **3. Espaço em Disco**

#### **Symptoms**
- Erro "disk full"
- Database não consegue escrever
- Logs pararam de crescer

#### **Diagnosis**
```bash
# Verificar espaço em disco
df -h

# Verificar tamanho do database
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('mailgenius'));"

# Verificar logs grandes
find /var/log -name "*.log" -size +100M

# Verificar arquivos temporários
find /tmp -name "*mailgenius*" -size +10M
```

#### **Solutions**
```bash
# Limpar logs antigos
find /var/log -name "*.log" -mtime +7 -delete

# Limpar arquivos temporários
find /tmp -name "*mailgenius*" -mtime +1 -delete

# Vacuum full (cuidado - pode demorar)
sudo -u postgres psql -c "VACUUM FULL;"

# Configurar log rotation
sudo nano /etc/logrotate.d/mailgenius
```

## 🔄 Problemas de Redis

### **1. Conexão Redis**

#### **Symptoms**
- Aplicação não consegue conectar ao Redis
- Timeouts de conexão
- Cache não funciona

#### **Diagnosis**
```bash
# Verificar se Redis está rodando
sudo systemctl status redis

# Testar conexão
redis-cli ping

# Verificar configuração
redis-cli config get "*"

# Verificar logs
sudo tail -f /var/log/redis/redis-server.log
```

#### **Solutions**
```bash
# Reiniciar Redis
sudo systemctl restart redis

# Verificar configuração de bind
sudo nano /etc/redis/redis.conf
# Procurar por: bind 127.0.0.1

# Verificar senha
redis-cli auth your_password

# Testar com telnet
telnet localhost 6379
```

### **2. Memória Redis**

#### **Symptoms**
- Redis usando muita memória
- Erro "OOM command not allowed"
- Performance degradada

#### **Diagnosis**
```bash
# Verificar uso de memória
redis-cli info memory

# Verificar configuração de memória
redis-cli config get maxmemory
redis-cli config get maxmemory-policy

# Verificar keys grandes
redis-cli --bigkeys

# Verificar stats
redis-cli info stats
```

#### **Solutions**
```bash
# Aumentar limite de memória
redis-cli config set maxmemory 2gb

# Configurar policy de eviction
redis-cli config set maxmemory-policy allkeys-lru

# Flush cache se necessário
redis-cli flushall

# Otimizar estruturas de dados
redis-cli config set hash-max-ziplist-entries 512
```

### **3. Performance Redis**

#### **Symptoms**
- Operações lentas
- Timeouts
- Alto uso de CPU

#### **Diagnosis**
```bash
# Verificar operações lentas
redis-cli slowlog get 10

# Verificar stats
redis-cli info stats

# Monitorar comandos
redis-cli monitor

# Verificar latência
redis-cli --latency
```

#### **Solutions**
```bash
# Limpar slowlog
redis-cli slowlog reset

# Otimizar configuração
redis-cli config set timeout 300
redis-cli config set tcp-keepalive 300

# Verificar se há operações bloqueantes
redis-cli info clients
```

## 🚀 Problemas de Aplicação

### **1. Aplicação Não Inicia**

#### **Symptoms**
- Aplicação não responde
- Processo não inicia
- Erros de dependência

#### **Diagnosis**
```bash
# Verificar se o processo está rodando
ps aux | grep node

# Verificar logs de inicialização
journalctl -u mailgenius-app -n 50

# Verificar dependências
npm list --depth=0

# Verificar configuração
node -e "console.log(process.env)" | grep -E "(DB|REDIS|EMAIL)"
```

#### **Solutions**
```bash
# Reinstalar dependências
npm install

# Limpar cache
npm cache clean --force

# Verificar versão do Node
node --version
npm --version

# Reiniciar aplicação
pm2 restart mailgenius-app

# Verificar variáveis de ambiente
printenv | grep -E "(DB|REDIS|EMAIL)"
```

### **2. Alto Uso de Memória**

#### **Symptoms**
- Aplicação usando muita RAM
- Memory leaks
- Aplicação travando

#### **Diagnosis**
```bash
# Verificar uso de memória
ps aux | grep node
free -h

# Verificar heap
node --expose-gc -e "console.log(process.memoryUsage())"

# Usar ferramentas de profiling
node --inspect server.js
```

#### **Solutions**
```bash
# Aumentar limite de memória
export NODE_OPTIONS="--max-old-space-size=4096"

# Forçar garbage collection
node --expose-gc -e "global.gc()"

# Reiniciar aplicação
pm2 restart mailgenius-app

# Verificar por memory leaks
node --inspect --inspect-brk server.js
```

### **3. Performance da API**

#### **Symptoms**
- Respostas lentas
- Timeouts
- Alto uso de CPU

#### **Diagnosis**
```bash
# Verificar métricas da API
curl -s http://localhost:3000/api/monitoring/metrics | jq

# Testar endpoints específicos
time curl -s http://localhost:3000/api/public/v1/leads

# Verificar logs de performance
grep "slow" /var/log/mailgenius/app.log | tail -10

# Monitorar CPU
htop
```

#### **Solutions**
```bash
# Reiniciar aplicação
pm2 restart mailgenius-app

# Aumentar workers
pm2 scale mailgenius-app +2

# Limpar cache
redis-cli flushall

# Verificar queries lentas
# (ver seção de database)
```

## 📧 Problemas de Email

### **1. Emails Não Enviando**

#### **Symptoms**
- Emails ficam presos na fila
- Erros de envio
- Taxa de entrega baixa

#### **Diagnosis**
```bash
# Verificar fila de emails
curl -s http://localhost:3000/api/queue/status | jq

# Verificar logs de email
grep "email-worker" /var/log/mailgenius/workers.log | tail -20

# Verificar configuração do Resend
curl -s http://localhost:3000/api/health/email | jq

# Verificar DNS
dig TXT _dmarc.yourdomain.com
dig TXT default._domainkey.yourdomain.com
```

#### **Solutions**
```bash
# Reiniciar workers
pm2 restart mailgenius-workers

# Limpar fila de emails falhos
curl -X POST http://localhost:3000/api/queue/admin \
  -H "Content-Type: application/json" \
  -d '{"action": "clear", "queue": "email-sending", "type": "failed"}'

# Verificar API key do Resend
echo $RESEND_API_KEY

# Testar envio manual
curl -X POST http://localhost:3000/api/email/test
```

### **2. Alta Taxa de Bounce**

#### **Symptoms**
- Muitos emails retornando
- Reclamações de spam
- Bloqueios de provedores

#### **Diagnosis**
```bash
# Verificar métricas de email
curl -s http://localhost:3000/api/monitoring/emails/metrics | jq

# Verificar logs de bounce
grep "bounce" /var/log/mailgenius/workers.log | tail -20

# Verificar configuração SPF/DKIM
dig TXT yourdomain.com
```

#### **Solutions**
```bash
# Limpar lista de emails
# (procedimento manual para remover emails inválidos)

# Verificar configuração DNS
# Garantir que SPF, DKIM e DMARC estão configurados

# Implementar double opt-in
# (configuração na aplicação)

# Monitorar reputation
# Verificar ferramentas de reputation
```

### **3. Performance de Envio**

#### **Symptoms**
- Envios muito lentos
- Timeouts de envio
- Workers travando

#### **Diagnosis**
```bash
# Verificar throughput
curl -s http://localhost:3000/api/monitoring/emails/metrics | jq '.throughput'

# Verificar workers
ps aux | grep worker

# Verificar fila
redis-cli llen email-queue
```

#### **Solutions**
```bash
# Aumentar workers
pm2 scale mailgenius-workers +2

# Otimizar configuração
# Ajustar QUEUE_CONCURRENCY

# Verificar rate limits
# Ajustar EMAIL_RATE_LIMIT_PER_HOUR
```

## 📤 Problemas de Upload

### **1. Upload Falhando**

#### **Symptoms**
- Uploads não completam
- Erros de chunk
- Timeouts

#### **Diagnosis**
```bash
# Verificar jobs de upload
curl -s http://localhost:3000/api/upload/monitoring | jq

# Verificar espaço em disco
df -h /tmp/uploads

# Verificar logs de upload
grep "upload" /var/log/mailgenius/app.log | tail -20
```

#### **Solutions**
```bash
# Limpar uploads antigos
find /tmp/uploads -name "*.tmp" -mtime +1 -delete

# Reiniciar serviço
pm2 restart mailgenius-app

# Verificar configuração de upload
grep -r "UPLOAD_" /path/to/mailgenius/.env
```

### **2. Processamento Lento**

#### **Symptoms**
- CSV demora para processar
- Validação lenta
- Timeouts de processamento

#### **Diagnosis**
```bash
# Verificar jobs de processamento
curl -s http://localhost:3000/api/queue/status | jq '.import_queue'

# Verificar uso de CPU/memória
htop

# Verificar logs de processamento
grep "csv-processor" /var/log/mailgenius/workers.log | tail -20
```

#### **Solutions**
```bash
# Aumentar workers de processamento
# Ajustar UPLOAD_MAX_CONCURRENT_BATCHES

# Otimizar batch size
# Ajustar UPLOAD_BATCH_SIZE

# Verificar recursos
# Garantir CPU e memória suficientes
```

## 🔍 Problemas de Monitoramento

### **1. Dashboard Não Carrega**

#### **Symptoms**
- Dashboard não responde
- Métricas não atualizam
- Erros de API

#### **Diagnosis**
```bash
# Verificar endpoint de monitoramento
curl -s http://localhost:3000/api/monitoring/health | jq

# Verificar logs
grep "monitoring" /var/log/mailgenius/app.log | tail -20

# Verificar Redis
redis-cli ping
```

#### **Solutions**
```bash
# Reiniciar aplicação
pm2 restart mailgenius-app

# Limpar cache de métricas
redis-cli flushdb 1

# Verificar configuração
grep -r "MONITORING_" /path/to/mailgenius/.env
```

### **2. Métricas Inconsistentes**

#### **Symptoms**
- Dados inconsistentes
- Métricas zeradas
- Histórico perdido

#### **Diagnosis**
```bash
# Verificar coleta de métricas
curl -s http://localhost:3000/api/monitoring/metrics | jq

# Verificar armazenamento
redis-cli keys "*metrics*"

# Verificar logs de coleta
grep "metrics" /var/log/mailgenius/app.log | tail -20
```

#### **Solutions**
```bash
# Reiniciar coleta de métricas
# (restart da aplicação)

# Verificar configuração de retenção
# MONITORING_METRICS_RETENTION_HOURS

# Limpar métricas corruptas
redis-cli flushdb 1
```

## 🛠️ Ferramentas de Troubleshooting

### **1. Scripts de Diagnóstico**

#### **Script Principal de Diagnóstico**
```bash
#!/bin/bash
# scripts/diagnose-system.sh

echo "=== MailGenius System Diagnosis ==="
echo "Timestamp: $(date)"
echo

echo "=== System Resources ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4 "%"}'

echo "Memory Usage:"
free -h | grep "Mem:" | awk '{print $3 "/" $2 " (" $3/$2*100 "%)"}'

echo "Disk Usage:"
df -h | grep -E "(/$|/var|/tmp)"

echo
echo "=== Services Status ==="
systemctl status postgresql --no-pager | head -5
systemctl status redis --no-pager | head -5
pm2 status | head -10

echo
echo "=== Application Health ==="
curl -s http://localhost:3000/api/health | jq -r '.status // "ERROR"'

echo
echo "=== Database Health ==="
sudo -u postgres psql -c "SELECT count(*) as active_connections FROM pg_stat_activity;" 2>/dev/null | tail -1

echo
echo "=== Redis Health ==="
redis-cli ping 2>/dev/null | head -1

echo
echo "=== Recent Errors ==="
tail -n 10 /var/log/mailgenius/error.log 2>/dev/null | head -10

echo
echo "=== Queue Status ==="
curl -s http://localhost:3000/api/queue/status | jq -r '.queues[].name + ": " + (.queues[].waiting|tostring) + " waiting"' 2>/dev/null

echo
echo "=== Diagnosis Complete ==="
```

#### **Script de Performance**
```bash
#!/bin/bash
# scripts/performance-check.sh

echo "=== Performance Check ==="
echo "Timestamp: $(date)"
echo

echo "=== Database Performance ==="
sudo -u postgres psql -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 5;" 2>/dev/null

echo
echo "=== Redis Performance ==="
redis-cli slowlog get 5 2>/dev/null

echo
echo "=== API Performance ==="
curl -s http://localhost:3000/api/monitoring/metrics | jq -r '.api.response_time // "N/A"' 2>/dev/null

echo
echo "=== System Load ==="
uptime
```

### **2. Monitoring Commands**

#### **Real-time Monitoring**
```bash
# Monitor logs em tempo real
tail -f /var/log/mailgenius/app.log | grep -E "(ERROR|WARN|slow)"

# Monitor performance
watch -n 5 'curl -s http://localhost:3000/api/health | jq'

# Monitor recursos
htop

# Monitor database
watch -n 5 'sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"'

# Monitor Redis
redis-cli --latency-history

# Monitor queues
watch -n 5 'curl -s http://localhost:3000/api/queue/status | jq'
```

#### **Log Analysis**
```bash
# Análise de erros
grep -E "(ERROR|FATAL)" /var/log/mailgenius/app.log | tail -20

# Análise de performance
grep "slow" /var/log/mailgenius/app.log | tail -20

# Análise de email
grep "email-worker" /var/log/mailgenius/workers.log | tail -20

# Análise de upload
grep "upload" /var/log/mailgenius/app.log | tail -20
```

### **3. Recovery Procedures**

#### **Emergency Recovery**
```bash
#!/bin/bash
# scripts/emergency-recovery.sh

echo "=== Emergency Recovery Started ==="

# Stop all services
pm2 stop all
sudo systemctl stop postgresql
sudo systemctl stop redis

# Wait for services to stop
sleep 10

# Start core services
sudo systemctl start postgresql
sudo systemctl start redis

# Wait for services to start
sleep 5

# Verify services
if ! sudo systemctl is-active postgresql > /dev/null; then
    echo "ERROR: PostgreSQL failed to start"
    exit 1
fi

if ! sudo systemctl is-active redis > /dev/null; then
    echo "ERROR: Redis failed to start"
    exit 1
fi

# Start application
pm2 start all

# Wait for application to start
sleep 10

# Verify application
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "ERROR: Application failed to start"
    exit 1
fi

echo "=== Emergency Recovery Completed ==="
```

#### **Database Recovery**
```bash
#!/bin/bash
# scripts/recover-database.sh

echo "=== Database Recovery Started ==="

# Stop application
pm2 stop all

# Backup current database
sudo -u postgres pg_dump mailgenius > /tmp/mailgenius_backup_$(date +%Y%m%d_%H%M%S).sql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Verify database
if ! sudo -u postgres psql -c "\l" | grep mailgenius > /dev/null; then
    echo "ERROR: Database not accessible"
    exit 1
fi

# Run maintenance
sudo -u postgres psql -d mailgenius -c "VACUUM ANALYZE;"

# Start application
pm2 start all

echo "=== Database Recovery Completed ==="
```

## 📊 Alertas e Notificações

### **1. Configuração de Alertas**

#### **Alertas Críticos**
```bash
# CPU > 90%
if [ $(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}' | cut -d'%' -f1) -gt 90 ]; then
    echo "CRITICAL: CPU usage > 90%" | mail -s "MailGenius Alert" admin@mailgenius.com
fi

# Memory > 90%
if [ $(free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -d'.' -f1) -gt 90 ]; then
    echo "CRITICAL: Memory usage > 90%" | mail -s "MailGenius Alert" admin@mailgenius.com
fi

# Disk > 90%
if [ $(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1) -gt 90 ]; then
    echo "CRITICAL: Disk usage > 90%" | mail -s "MailGenius Alert" admin@mailgenius.com
fi
```

#### **Alertas de Aplicação**
```bash
# Application down
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "CRITICAL: Application is down" | mail -s "MailGenius Alert" admin@mailgenius.com
fi

# Database down
if ! sudo -u postgres psql -c "\l" > /dev/null 2>&1; then
    echo "CRITICAL: Database is down" | mail -s "MailGenius Alert" admin@mailgenius.com
fi

# Redis down
if ! redis-cli ping > /dev/null 2>&1; then
    echo "CRITICAL: Redis is down" | mail -s "MailGenius Alert" admin@mailgenius.com
fi
```

### **2. Notification Scripts**

#### **Email Notifications**
```bash
#!/bin/bash
# scripts/send-alert.sh

ALERT_TYPE=$1
ALERT_MESSAGE=$2
ALERT_EMAIL="admin@mailgenius.com"

case $ALERT_TYPE in
    "critical")
        SUBJECT="🚨 CRITICAL: MailGenius Alert"
        ;;
    "warning")
        SUBJECT="⚠️ WARNING: MailGenius Alert"
        ;;
    "info")
        SUBJECT="ℹ️ INFO: MailGenius Alert"
        ;;
    *)
        SUBJECT="📧 MailGenius Alert"
        ;;
esac

echo "$ALERT_MESSAGE" | mail -s "$SUBJECT" "$ALERT_EMAIL"
```

#### **Slack Notifications**
```bash
#!/bin/bash
# scripts/send-slack-alert.sh

SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
ALERT_TYPE=$1
ALERT_MESSAGE=$2

case $ALERT_TYPE in
    "critical")
        COLOR="danger"
        EMOJI="🚨"
        ;;
    "warning")
        COLOR="warning"
        EMOJI="⚠️"
        ;;
    "info")
        COLOR="good"
        EMOJI="ℹ️"
        ;;
    *)
        COLOR="good"
        EMOJI="📧"
        ;;
esac

curl -X POST "$SLACK_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "{
    \"attachments\": [{
      \"color\": \"$COLOR\",
      \"title\": \"$EMOJI MailGenius Alert\",
      \"text\": \"$ALERT_MESSAGE\",
      \"ts\": $(date +%s)
    }]
  }"
```

## 📋 Troubleshooting Checklist

### **Problema Reportado**
- [ ] Identificar sintomas específicos
- [ ] Coletar informações do usuário
- [ ] Determinar urgência/prioridade
- [ ] Verificar se é problema conhecido

### **Diagnóstico Inicial**
- [ ] Executar health check completo
- [ ] Verificar logs de erro
- [ ] Verificar recursos do sistema
- [ ] Verificar status dos serviços

### **Investigação Detalhada**
- [ ] Analisar logs específicos
- [ ] Verificar métricas de performance
- [ ] Testar componentes individuais
- [ ] Reproduzir problema (se possível)

### **Resolução**
- [ ] Implementar fix temporário (se necessário)
- [ ] Aplicar solução definitiva
- [ ] Verificar se problema foi resolvido
- [ ] Testar funcionalidades relacionadas

### **Pós-Resolução**
- [ ] Documentar problema e solução
- [ ] Atualizar runbooks
- [ ] Implementar melhorias preventivas
- [ ] Notificar stakeholders

## 📞 Escalation Procedures

### **Níveis de Suporte**
1. **L1 - Monitoring**: Monitoramento básico e troubleshooting inicial
2. **L2 - Technical**: Troubleshooting técnico avançado
3. **L3 - Engineering**: Problemas de código e arquitetura

### **Critérios de Escalação**
- **Imediata**: Sistema completamente down
- **15 minutos**: Problema crítico não resolvido
- **1 hora**: Problema de alta prioridade não resolvido
- **4 horas**: Problema médio não resolvido

### **Contatos de Escalação**
- **L1 Support**: monitoring@mailgenius.com
- **L2 Support**: technical@mailgenius.com
- **L3 Support**: engineering@mailgenius.com
- **Management**: operations@mailgenius.com

---

## 📚 Recursos Adicionais

### **Documentação**
- [System Architecture](./SYSTEM_ARCHITECTURE.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)
- [Performance Configuration](./PERFORMANCE_CONFIGURATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

### **Tools e Scripts**
- [Diagnostic Scripts](../scripts/diagnosis/)
- [Recovery Scripts](../scripts/recovery/)
- [Monitoring Scripts](../scripts/monitoring/)

### **External Resources**
- PostgreSQL Documentation
- Redis Documentation
- Node.js Performance Guide
- PM2 Documentation

---

**Atualizado**: 2024-07-16  
**Versão**: 2.0  
**Autor**: Support Team  
**Status**: Produção Ready