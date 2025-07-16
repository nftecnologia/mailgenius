# Sistema de Monitoring e Alertas - MailGenius

Este sistema fornece monitoramento completo, alertas e observabilidade para a plataforma MailGenius.

## Componentes Principais

### 1. Health Checks (`health-check.ts`)
- Verifica saúde dos serviços críticos (Database, Redis, APIs externas)
- Monitora uso de memória e performance
- Fornece endpoints para load balancers
- Calcula uptime e latência

### 2. Coleta de Métricas (`metrics.ts`)
- Coleta métricas de performance em tempo real
- Armazena dados no Redis com fallback para memória
- Métricas de API, email, usuários e sistema
- Agregações e séries temporais

### 3. Sistema de Alertas (`alerts.ts`)
- Regras de alerta configuráveis
- Múltiplos canais de notificação (email, webhook, Slack)
- Gerenciamento de incidentes
- Cooldown e deduplicação

### 4. Dashboard (`dashboard.ts`)
- Interface unificada para dados de monitoramento
- Métricas de negócio e técnicas
- Exportação de dados
- Cache inteligente

### 5. Middleware de Monitoramento (`middleware.ts`)
- Instrumentação automática de APIs
- Coleta de métricas de rate limiting
- Monitoramento de emails e campanhas
- Tracking de atividade de usuários

## Configuração

### Variáveis de Ambiente

```bash
# Logging
LOG_LEVEL=info
LOGGING_CONSOLE=true
LOGGING_STRUCTURED=true

# Redis (opcional - fallback para memória)
REDIS_URL=redis://localhost:6379

# APIs externas
RESEND_API_KEY=your_resend_key
ANTHROPIC_API_KEY=your_anthropic_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Inicialização

```typescript
import { initializeMonitoring } from '@/lib/monitoring/init'

// Em seu app startup
initializeMonitoring()
```

## Uso

### Health Checks

```typescript
import { healthChecker } from '@/lib/monitoring/health-check'

// Check rápido
const quickStatus = await healthChecker.quickHealthCheck()

// Check completo
const fullHealth = await healthChecker.performFullHealthCheck()
```

### Métricas

```typescript
import { metricsCollector } from '@/lib/monitoring/metrics'

// Registrar métrica
await metricsCollector.recordMetric('api.latency', 150, { endpoint: '/api/campaigns' })

// Buscar métricas
const metrics = await metricsCollector.getTimeSeriesMetric('api.latency', 1)
```

### Alertas

```typescript
import { alertManager } from '@/lib/monitoring/alerts'

// Criar regra de alerta
const ruleId = alertManager.addRule({
  name: 'High API Latency',
  metric: 'api.latency',
  condition: 'gt',
  threshold: 1000,
  duration: 5,
  severity: 'high',
  enabled: true,
  channels: [{
    type: 'email',
    config: { to: 'admin@mailgenius.com' },
    enabled: true
  }],
  cooldown: 10
})

// Reconhecer incidente
alertManager.acknowledgeIncident(incidentId, 'admin@mailgenius.com')
```

### Dashboard

```typescript
import { monitoringDashboard } from '@/lib/monitoring/dashboard'

// Dados completos do dashboard
const dashboardData = await monitoringDashboard.getDashboardData()

// Página de status público
const statusData = await monitoringDashboard.getStatusPageData()

// Cards de métricas
const metricCards = await monitoringDashboard.getMetricCards()
```

## Endpoints de API

### Health Check
- `GET /api/monitoring/health` - Health check completo
- `GET /api/monitoring/health?quick=true` - Health check rápido

### Métricas
- `GET /api/monitoring/metrics?metric=api.latency&hours=1` - Buscar métricas
- `POST /api/monitoring/metrics` - Registrar métrica

### Alertas
- `GET /api/monitoring/alerts?type=incidents` - Listar incidentes
- `POST /api/monitoring/alerts` - Gerenciar alertas

### Dashboard
- `GET /api/monitoring/dashboard?type=full` - Dados completos
- `GET /api/monitoring/dashboard?type=realtime` - Dados em tempo real

### Status Público
- `GET /api/monitoring/status` - Status público (sem autenticação)

## Páginas Web

### Dashboard de Monitoramento
- `/dashboard/monitoring` - Dashboard completo para administradores
- Métricas em tempo real
- Alertas e incidentes
- Performance e negócio

### Página de Status
- `/status` - Página pública de status
- Uptime histórico
- Status de serviços
- Incidentes recentes

## Métricas Coletadas

### API
- `api.latency` - Latência de resposta
- `api.requests` - Total de requisições
- `api.errors` - Taxa de erro

### Email
- `email.sent` - Emails enviados
- `email.delivered` - Emails entregues
- `email.bounced` - Emails rejeitados
- `email.opened` - Emails abertos
- `email.clicked` - Cliques em emails

### Campanhas
- `campaign.created` - Campanhas criadas
- `campaign.sent` - Campanhas enviadas
- `campaign.completed` - Campanhas concluídas

### Usuários
- `user.login` - Logins
- `user.signup` - Registros
- `user.active` - Usuários ativos

### Sistema
- `system.memory.usage_percent` - Uso de memória
- `system.uptime` - Uptime do sistema
- `ratelimit.hits` - Hits de rate limiting
- `ratelimit.blocked` - Requests bloqueados

## Regras de Alerta Padrão

1. **High API Latency** - Latência > 2s por 2 minutos
2. **High Error Rate** - Taxa de erro > 5% por 5 minutos
3. **High Memory Usage** - Uso de memória > 85% por 5 minutos
4. **Critical Memory Usage** - Uso de memória > 95% por 2 minutos
5. **Email Delivery Failure** - Taxa de rejeição > 10% por 10 minutos
6. **Service Unavailable** - Health check falha por 1 minuto

## Canais de Notificação

### Email
```typescript
{
  type: 'email',
  config: {
    to: 'admin@mailgenius.com',
    subject: 'Alert: {{incident.ruleName}}'
  },
  enabled: true
}
```

### Webhook
```typescript
{
  type: 'webhook',
  config: {
    url: 'https://hooks.slack.com/services/...',
    headers: { 'Authorization': 'Bearer token' }
  },
  enabled: true
}
```

### Slack
```typescript
{
  type: 'slack',
  config: {
    webhook_url: 'https://hooks.slack.com/services/...'
  },
  enabled: true
}
```

## Middleware de Instrumentação

### API Monitoring
```typescript
import { monitoringMiddleware } from '@/lib/monitoring/middleware'

// Instrumenta automaticamente todas as rotas
export const middleware = monitoringMiddleware
```

### Email Tracking
```typescript
import { emailMonitoringMiddleware } from '@/lib/monitoring/middleware'

// Após enviar email
await emailMonitoringMiddleware.onEmailSent(email, campaignId)
```

### Rate Limiting
```typescript
import { rateLimitMonitoringMiddleware } from '@/lib/monitoring/middleware'

// Após verificar rate limit
await rateLimitMonitoringMiddleware(request, allowed, remaining, resetTime)
```

## Integração com Sistemas Existentes

### Supabase
- Health checks verificam conectividade
- Métricas armazenadas no PostgreSQL (futuro)
- Alertas podem ser enviados via Supabase

### Redis
- Armazenamento principal de métricas
- Fallback automático para memória
- Cache de dados do dashboard

### Resend
- Notificações de alerta por email
- Health checks da API
- Métricas de entrega

## Monitoramento de Negócio

### KPIs Principais
- Total de emails enviados
- Taxa de conversão
- Taxa de clique (CTR)
- Taxa de rejeição
- Usuários ativos

### Métricas de Performance
- Latência de API
- Uso de memória
- Taxa de erro
- Uptime dos serviços

### Alertas Críticos
- Falha de serviços
- Alta latência
- Uso excessivo de recursos
- Falhas de entrega de email

## Desenvolvimento e Extensão

### Adicionar Nova Métrica
```typescript
// Registrar métrica customizada
await metricsCollector.recordMetric('custom.metric', value, { tag: 'value' })

// Criar alerta para métrica
alertManager.addRule({
  name: 'Custom Alert',
  metric: 'custom.metric',
  condition: 'gt',
  threshold: 100,
  // ... outras configurações
})
```

### Novo Canal de Notificação
```typescript
// Estender alertManager para suportar novo canal
private async sendCustomNotification(incident: AlertIncident, channel: AlertChannel) {
  // Implementar lógica de envio
}
```

### Middleware Customizado
```typescript
import { createMonitoringMiddleware } from '@/lib/monitoring/middleware'

const customMiddleware = createMonitoringMiddleware({
  slowRequestThreshold: 500,
  excludePaths: ['/health', '/metrics']
})
```

## Troubleshooting

### Métricas Não Coletadas
1. Verificar se Redis está funcionando
2. Confirmar se middleware está configurado
3. Verificar logs de erro

### Alertas Não Enviados
1. Verificar regras de alerta ativas
2. Confirmar configuração dos canais
3. Verificar cooldown e deduplicação

### Dashboard Lento
1. Verificar cache do Redis
2. Otimizar consultas de métricas
3. Reduzir período de coleta

### Health Checks Falhando
1. Verificar conectividade de rede
2. Confirmar credenciais de API
3. Verificar timeouts de conexão

## Segurança

### Dados Sensíveis
- Logs sanitizados automaticamente
- Métricas não contêm PII
- Alertas redacted em produção

### Acesso
- Dashboard requer autenticação
- Status page é público
- APIs protegidas por rate limiting

### Retenção
- Métricas: 24 horas
- Logs: conforme configuração
- Incidentes: permanente até limpeza manual

## Performance

### Otimizações
- Cache inteligente de 30 segundos
- Métricas agregadas em memória
- Consultas otimizadas no Redis

### Limites
- Máximo 1000 pontos por métrica
- Retenção de 24 horas
- Limpeza automática de dados antigos

### Escalabilidade
- Suporte a múltiplas instâncias
- Dados distribuídos no Redis
- Agregação em tempo real