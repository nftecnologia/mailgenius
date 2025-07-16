# Rate Limiting System - MailGenius

## Overview

O MailGenius implementa um sistema avançado de rate limiting distribuído que suporta Redis para ambientes de produção e fallback em memória para desenvolvimento. O sistema é flexível, configurável e inclui diferentes perfis de rate limiting para diferentes tipos de endpoints.

## Características

- **Distribuído**: Usa Redis em produção, fallback em memória para desenvolvimento
- **Flexível**: Múltiplos perfis de rate limiting para diferentes casos de uso
- **Configurável**: Limites personalizáveis por endpoint
- **Headers padrão**: Inclui headers de rate limit nas respostas
- **Middleware integrado**: Aplicação automática em rotas específicas
- **Múltiplos identificadores**: Suporte para IP, API key, usuário, etc.

## Configuração

### Variáveis de Ambiente

```env
# Redis Configuration (Opcional - fallback para memória se não configurado)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_ENABLED=true

# Rate Limiting Configuration
RATE_LIMIT_REDIS_ENABLED=true
RATE_LIMIT_FALLBACK_MEMORY=true
```

### Profiles Disponíveis

```typescript
// Autenticação
AUTH_STRICT: 5 tentativas em 15 minutos
AUTH_NORMAL: 10 tentativas em 15 minutos

// API endpoints
API_STANDARD: 1000 requests por hora
API_HEAVY: 200 requests por hora (operações pesadas)
API_BURST: 100 requests por minuto

// Envio de email
EMAIL_SENDING: 1000 emails por hora
EMAIL_BURST: 50 emails por minuto

// Campanhas
CAMPAIGN_CREATION: 100 campanhas por hora
CAMPAIGN_SENDING: 10 envios de campanha por hora

// Dados
DATA_IMPORT: 5 importações por hora
DATA_EXPORT: 10 exportações por hora

// Analytics
ANALYTICS_HEAVY: 100 requests pesados por hora

// API pública por IP
PUBLIC_API_IP: 10k requests por hora por IP

// Webhooks
WEBHOOK_PROCESSING: 1000 webhooks por minuto
```

## Como Usar

### 1. Usando o RateLimitHelper

```typescript
import { RateLimitHelper } from '@/lib/rate-limit-helpers'

// Verificar rate limit em um endpoint
const rateLimitInfo = await RateLimitHelper.checkAPIRateLimit(request)
if (!rateLimitInfo.allowed) {
  return RateLimitHelper.createRateLimitError(rateLimitInfo)
}

// Usar um perfil específico
const authLimit = await RateLimitHelper.checkAuthRateLimit(request)
const campaignLimit = await RateLimitHelper.checkCampaignCreationLimit(request)
```

### 2. Usando o Middleware

```typescript
import { withRateLimit } from '@/lib/rate-limit-helpers'

// Aplicar rate limiting a uma função handler
export const POST = withRateLimit('API_STANDARD', 'api_key')(async (req) => {
  // Sua lógica aqui
})

// Ou usar decorators específicos
export const POST = withAPIRateLimit(async (req) => {
  // Sua lógica aqui
})
```

### 3. Verificação Manual

```typescript
import { checkAndHandleRateLimit } from '@/lib/rate-limit-helpers'

export async function POST(request: NextRequest) {
  const rateLimitCheck = await checkAndHandleRateLimit(request, 'API_STANDARD')
  
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response
  }
  
  // Sua lógica aqui
  const response = await yourLogic()
  
  // Adicionar headers de rate limit
  Object.entries(rateLimitCheck.headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}
```

### 4. Múltiplos Rate Limits

```typescript
// Verificar tanto burst quanto limites sustentados
const rateLimitInfo = await RateLimitHelper.checkAPIWithBurstLimit(request)
const emailLimit = await RateLimitHelper.checkEmailWithBurstLimit(request)

// Verificar múltiplos perfis
const multipleCheck = await RateLimitHelper.checkMultipleRateLimits(
  request,
  ['API_BURST', 'API_STANDARD'],
  'api_key'
)
```

## Headers de Rate Limit

O sistema adiciona automaticamente os seguintes headers nas respostas:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-Reset-Time: 2022-01-01T00:00:00.000Z
Retry-After: 3600 (apenas quando limite excedido)
```

## Implementação em Rotas

### Exemplo de Rota com Rate Limiting

```typescript
import { NextRequest } from 'next/server'
import { RateLimitHelper } from '@/lib/rate-limit-helpers'
import { authenticateAPIRequest, createAPIResponse, createAPIError } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    // Autenticação
    const user = await authenticateAPIRequest(request)

    // Rate limiting
    const rateLimitInfo = await RateLimitHelper.checkAPIWithBurstLimit(request)
    if (!rateLimitInfo.allowed) {
      return RateLimitHelper.createRateLimitError(rateLimitInfo)
    }

    // Sua lógica aqui
    const data = await fetchData()

    // Resposta com headers de rate limit
    return createAPIResponse(data, 200, rateLimitInfo.headers)

  } catch (error) {
    return createAPIError('Internal server error', 500)
  }
}
```

### Exemplo de Rota com Rate Limiting Personalizado

```typescript
import { rateLimiter, createRateLimitConfig } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  // Rate limiting personalizado
  const customConfig = createRateLimitConfig(
    'custom-identifier',
    {
      windowMs: 60 * 1000, // 1 minuto
      max: 10, // 10 requests
      message: 'Limite personalizado excedido'
    }
  )

  const result = await rateLimiter.checkLimit(customConfig)
  if (!result.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: result.retryAfter
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': result.retryAfter?.toString() || '60'
      }
    })
  }

  // Sua lógica aqui
}
```

## Middleware Global

O sistema inclui middleware global para aplicar rate limiting automaticamente:

```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  // Rate limiting automático para APIs públicas
  if (pathname.startsWith('/api/public')) {
    const rateLimitInfo = await RateLimitHelper.checkPublicAPILimit(req)
    if (!rateLimitInfo.allowed) {
      return new NextResponse(JSON.stringify({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitInfo.headers
        }
      })
    }
  }

  // Rate limiting para webhooks
  if (pathname.startsWith('/api/webhooks')) {
    const rateLimitInfo = await RateLimitHelper.checkWebhookLimit(req)
    if (!rateLimitInfo.allowed) {
      return new NextResponse(JSON.stringify({
        error: 'Webhook rate limit exceeded',
        code: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitInfo.headers
        }
      })
    }
  }

  // Resto da lógica do middleware
}
```

## Monitoramento e Debugging

### Logs

O sistema inclui logs detalhados para debugging:

```typescript
// Logs automáticos
console.log('✅ Redis connected successfully')
console.log('⚠️  Max Redis connection attempts reached, falling back to memory storage')
console.log('❌ Redis connection error:', error.message)
```

### Verificação de Status

```typescript
import { redisManager } from '@/lib/redis'

// Verificar se Redis está conectado
const isConnected = redisManager.isReady()

// Testar conexão
const pingResult = await redisManager.ping()
```

## Personalização

### Criando Perfis Personalizados

```typescript
// Adicionar novos perfis em rate-limiter.ts
export const RATE_LIMIT_PROFILES = {
  ...existing_profiles,
  
  CUSTOM_PROFILE: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 50, // 50 requests
    message: 'Limite personalizado excedido'
  }
}
```

### Identificadores Personalizados

```typescript
// Usar identificador personalizado
const rateLimitInfo = await RateLimitHelper.checkRateLimit(
  request,
  'API_STANDARD',
  'custom',
  'my-custom-identifier'
)
```

## Produção vs Desenvolvimento

### Desenvolvimento
- Usa storage em memória como fallback
- Logs detalhados para debugging
- Rate limits mais permissivos (opcional)

### Produção
- Usa Redis para storage distribuído
- Logs otimizados
- Rate limits rigorosos
- Cleanup automático de dados expirados

## Troubleshooting

### Redis não conecta
1. Verificar variáveis de ambiente
2. Sistema faz fallback para memória automaticamente
3. Verificar logs de conexão

### Rate limits muito restritivos
1. Ajustar perfis em `RATE_LIMIT_PROFILES`
2. Usar identificadores mais específicos
3. Implementar whitelist para IPs específicos

### Performance
1. Redis é mais eficiente que memória para múltiplas instâncias
2. Cleanup automático evita vazamentos de memória
3. Usar perfis apropriados para cada endpoint

## Segurança

- Headers de rate limit não expõem informações sensíveis
- Identificadores são hashados quando necessário
- Logs não incluem dados sensíveis
- Fallback seguro para memória em caso de falha do Redis