# Sistema de Logging - MailGenius

## Visão Geral

O MailGenius implementa um sistema de logging estruturado e seguro que:

- **Sanitiza dados sensíveis** automaticamente
- **Suporta diferentes níveis de log** (DEBUG, INFO, WARN, ERROR, FATAL)
- **Configurável por ambiente** (desenvolvimento vs produção)
- **Estruturado e pesquisável**
- **Otimizado para performance**

## Configuração

### Variáveis de Ambiente

```bash
# Nível de log (DEBUG, INFO, WARN, ERROR, FATAL)
LOG_LEVEL=INFO

# Habilitar logging no console
LOGGING_CONSOLE=true

# Habilitar logging estruturado (JSON)
LOGGING_STRUCTURED=false

# Habilitar logging em arquivo (futuro)
LOGGING_FILE=false

# Ambiente (development, production)
NODE_ENV=development
```

### Níveis de Log por Ambiente

- **Desenvolvimento**: DEBUG e acima
- **Produção**: WARN e acima (por segurança)

## Uso Básico

```typescript
import { logger } from '@/lib/logger'

// Logs básicos
logger.debug('Informação de debug')
logger.info('Informação geral')
logger.warn('Aviso importante')
logger.error('Erro ocorrido', context, error)
logger.fatal('Erro crítico', context, error)

// Logs especializados
logger.auth('User login', userId, { email: 'user@example.com' })
logger.webhook('Resend webhook', eventData)
logger.api('GET /api/campaigns', 'GET', userId)
logger.security('Invalid API key attempt')
logger.performance('Database query', 150)
```

## Contexto de Logging

O sistema suporta contexto estruturado para logs:

```typescript
import { logger } from '@/lib/logger'

const context = {
  userId: 'user123',
  workspaceId: 'workspace456',
  requestId: 'req789',
  path: '/api/campaigns',
  method: 'POST',
  metadata: {
    campaignId: 'campaign123',
    recipientCount: 1000
  }
}

logger.info('Campaign sent successfully', context)
```

## Sanitização de Dados

### Dados Automaticamente Sanitizados

- **Emails**: `user@example.com` → `[REDACTED_EMAIL]`
- **API Keys**: `es_live_abc123` → `[REDACTED_API_KEY]`
- **Passwords**: `password: secret123` → `password: [REDACTED]`
- **JWTs**: `eyJhbGciOiJIUzI1NiIs...` → `[REDACTED_JWT]`
- **Telefones**: `(11) 99999-9999` → `[REDACTED_PHONE]`
- **CPFs**: `123.456.789-00` → `[REDACTED_CPF]`
- **Cartões**: `4111 1111 1111 1111` → `[REDACTED_CREDIT_CARD]`
- **UUIDs**: `550e8400-e29b-41d4-a716-446655440000` → `[REDACTED_UUID]`
- **IPs**: `192.168.1.1` → `[REDACTED_IP]`

### Chaves de Objeto Sensíveis

As seguintes chaves são automaticamente removidas de objetos:

```typescript
const sensitiveKeys = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'auth', 'key',
  'credential', 'authorization', 'session', 'cookie', 'api_key',
  'apikey', 'access_token', 'refresh_token', 'private_key',
  'public_key', 'webhook_secret', 'database_url', 'connection_string',
  'email', 'user_metadata', 'identities'
]
```

## Padrões de Uso

### Middleware

```typescript
import { logger } from '@/lib/logger'

export async function middleware(req: NextRequest) {
  const context = logger.createRequestContext(req)
  
  logger.info('Processing request', context)
  
  // ... middleware logic
  
  if (error) {
    logger.error('Middleware error', context, error)
  }
}
```

### API Routes

```typescript
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const context = logger.createRequestContext(request)
  
  try {
    logger.api('Creating campaign', 'POST', userId, context)
    
    // ... API logic
    
    logger.info('Campaign created successfully', {
      ...context,
      metadata: { campaignId: campaign.id }
    })
    
  } catch (error) {
    logger.error('Failed to create campaign', context, error as Error)
    throw error
  }
}
```

### Webhooks

```typescript
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const context = logger.createRequestContext(request)
  
  try {
    const event = await request.json()
    
    logger.webhook('Received webhook', {
      type: event.type,
      id: event.data?.id
    }, context)
    
    // ... webhook processing
    
  } catch (error) {
    logger.error('Webhook processing failed', context, error as Error)
  }
}
```

### Autenticação

```typescript
import { logger } from '@/lib/logger'

// Login
logger.auth('Sign in attempt', undefined, { email })
logger.auth('Sign in successful', user.id)
logger.auth('Sign in failed', undefined, { email, reason: 'invalid_credentials' })

// Logout
logger.auth('Sign out', user.id)

// Eventos de segurança
logger.security('Invalid API key attempt', { 
  ip: request.ip,
  userAgent: request.headers.get('user-agent')
})
```

## Logs Estruturados

Para análise avançada, habilite logs estruturados:

```bash
LOGGING_STRUCTURED=true
```

Saída exemplo:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Campaign sent successfully",
  "context": {
    "userId": "user123",
    "workspaceId": "workspace456",
    "requestId": "req789",
    "path": "/api/campaigns/send",
    "method": "POST",
    "metadata": {
      "campaignId": "campaign123",
      "recipientCount": 1000
    }
  }
}
```

## Performance

### Medição de Performance

```typescript
const startTime = Date.now()

// ... operação

const duration = Date.now() - startTime
logger.performance('Database query', duration, {
  query: 'SELECT * FROM campaigns',
  recordCount: results.length
})
```

### Logging HTTP

```typescript
logger.http(request, { status: 200 }, duration)
```

## Migração do Console.log

### Antes (Inseguro)

```typescript
console.log('User logged in:', user.email, user.password)
console.log('API Key:', process.env.OPENAI_API_KEY)
console.error('Error:', error)
```

### Depois (Seguro)

```typescript
logger.auth('User logged in', user.id, { email: user.email })
logger.info('API configured', { provider: 'openai', configured: !!process.env.OPENAI_API_KEY })
logger.error('Operation failed', context, error)
```

## Script de Migração

Execute o script para migrar automaticamente:

```bash
./scripts/fix-logging.sh
```

O script irá:
1. Fazer backup dos arquivos originais
2. Adicionar imports do logger
3. Substituir console.log por logger.info
4. Substituir console.error por logger.error
5. Substituir console.warn por logger.warn

## Monitoramento

### Logs de Segurança

```typescript
// Tentativas de acesso inválidas
logger.security('Invalid API key', { ip, userAgent })

// Tentativas de webhook inválidas
logger.security('Invalid webhook signature', { ip, endpoint })

// Rate limiting
logger.security('Rate limit exceeded', { userId, ip })
```

### Logs de Performance

```typescript
// Queries lentas
logger.performance('Slow database query', 5000, { query: 'SELECT...' })

// APIs lentas
logger.performance('Slow API response', 3000, { endpoint: '/api/campaigns' })
```

## Produção

### Configuração Recomendada

```bash
LOG_LEVEL=WARN
LOGGING_CONSOLE=true
LOGGING_STRUCTURED=true
LOGGING_FILE=true
NODE_ENV=production
```

### Integração com Serviços Externos

O sistema está preparado para integração com:
- **Datadog**: Para monitoramento APM
- **Sentry**: Para tracking de erros
- **CloudWatch**: Para AWS
- **LogRocket**: Para debugging de frontend

## Troubleshooting

### Logs Não Aparecem

1. Verifique `LOGGING_CONSOLE=true`
2. Verifique o `LOG_LEVEL`
3. Verifique se está em desenvolvimento: `NODE_ENV=development`

### Dados Sensíveis Aparecendo

1. Adicione padrões em `SENSITIVE_PATTERNS`
2. Adicione chaves em `SENSITIVE_KEYS`
3. Use contexto estruturado ao invés de strings

### Performance Issues

1. Reduza o `LOG_LEVEL` em produção
2. Desabilite `LOGGING_STRUCTURED` se não necessário
3. Use `logger.debug()` para logs verbosos

## Roadmap

- [ ] Logging em arquivo
- [ ] Integração com Datadog
- [ ] Integração com Sentry
- [ ] Dashboard de logs
- [ ] Alertas automáticos
- [ ] Retenção de logs
- [ ] Compressão de logs
- [ ] Logs distribuídos