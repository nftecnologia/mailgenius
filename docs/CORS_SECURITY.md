# Configuração de CORS Restritivo - MailGenius

## Visão Geral

O sistema de CORS (Cross-Origin Resource Sharing) implementado no MailGenius é uma solução robusta e restritiva que garante a segurança da aplicação controlando quais domínios podem acessar as APIs e recursos.

## Arquitetura

### Componentes Principais

1. **CORSManager** (`/src/lib/cors.ts`) - Gerenciador principal de CORS
2. **CORSConfigManager** (`/src/lib/cors-config.ts`) - Configuração dinâmica
3. **Middleware** (`/src/middleware.ts`) - Aplicação de CORS em todas as rotas
4. **withCORS** - HOC para rotas de API
5. **CORSMonitor** - Componente React para monitoramento

## Configuração

### Variáveis de Ambiente

```env
# Ambiente
NODE_ENV=development

# Domínios permitidos (desenvolvimento)
CORS_DEVELOPMENT_DOMAINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000

# Domínios permitidos (produção)
CORS_PRODUCTION_DOMAINS=https://mailgenius.com,https://www.mailgenius.com,https://app.mailgenius.com

# Configurações CORS
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
CORS_PREFLIGHT_MAX_AGE=3600

# Configurações de segurança
SECURITY_BLOCK_SUSPICIOUS_USER_AGENTS=true
SECURITY_VALIDATE_CONTENT_TYPE=true
SECURITY_RATE_LIMIT_REQUESTS=1000
SECURITY_RATE_LIMIT_WINDOW=3600000
```

### Configuração por Ambiente

#### Desenvolvimento
- Permite localhost em várias portas
- Métodos HTTP mais permissivos
- Headers de debug habilitados
- Validação menos restritiva

#### Produção
- Apenas domínios específicos
- Métodos HTTP limitados
- Headers de segurança obrigatórios
- Validação rigorosa

## Implementação

### 1. Middleware Principal

```typescript
// src/middleware.ts
import { corsManager } from '@/lib/cors'

export async function middleware(req: NextRequest) {
  // Aplicar CORS para rotas da API
  if (pathname.startsWith('/api/')) {
    const corsResponse = corsManager.handleAPICORS(req)
    if (corsResponse) {
      return corsResponse
    }
  }
  
  // Aplicar CORS para outras rotas
  return corsManager.handleCORS(req, res)
}
```

### 2. Proteção de Rotas API

```typescript
// src/app/api/exemplo/route.ts
import { withCORS } from '@/lib/cors'

export const GET = withCORS(async (request: NextRequest) => {
  // Sua lógica aqui
  return Response.json({ data: 'success' })
})
```

### 3. Uso no Frontend

```typescript
// Hook para gerenciar CORS
import { useCORS } from '@/lib/hooks/useCORS'

function MyComponent() {
  const { corsInfo, fetchWithCORS } = useCORS()
  
  const handleAPICall = async () => {
    try {
      const response = await fetchWithCORS('/api/data')
      const data = await response.json()
    } catch (error) {
      console.error('CORS error:', error)
    }
  }
}
```

## Funcionalidades de Segurança

### 1. Validação de Origem

- Verifica se a origem está na lista permitida
- Bloqueia origens não autorizadas
- Suporte a wildcards em desenvolvimento

### 2. Validação de Headers

- Content-Type obrigatório para POST/PUT
- User-Agent suspeito bloqueado
- Headers de segurança aplicados

### 3. Rate Limiting

- Limita requisições por API key
- Janela de tempo configurável
- Bloqueio temporário em caso de abuso

### 4. Monitoramento

- Rastreamento de violações
- Logs detalhados
- Alertas em tempo real

## Métodos HTTP Permitidos

### Desenvolvimento
- GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH

### Produção
- GET, POST, PUT, DELETE, OPTIONS

## Headers Permitidos

### Sempre Permitidos
- Content-Type
- Authorization
- X-Requested-With
- Accept
- Origin

### APIs Públicas
- X-API-Key
- X-Client-Version

## Headers de Segurança Aplicados

```
Access-Control-Allow-Origin: [origem-permitida]
Access-Control-Allow-Methods: [métodos-permitidos]
Access-Control-Allow-Headers: [headers-permitidos]
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## Monitoramento e Debug

### Componente Monitor

```tsx
import { CORSMonitor } from '@/components/security/CORSMonitor'

function AdminPanel() {
  return (
    <div>
      <CORSMonitor 
        showDetails={true}
        autoRefresh={true}
      />
    </div>
  )
}
```

### API de Debug

```bash
# Obter informações de CORS
GET /api/cors/info

# Validar origem específica
POST /api/cors/info
{
  "origin": "https://example.com"
}

# Debug completo
PUT /api/cors/info
```

### Logs de Debug

```typescript
import { debugCORS } from '@/lib/cors-config'

// Em desenvolvimento
debugCORS()
```

## Tratamento de Erros

### Códigos de Erro CORS

- `CORS_ORIGIN_NOT_ALLOWED` - Origem não permitida
- `CORS_METHOD_NOT_ALLOWED` - Método HTTP não permitido
- `CORS_HEADERS_NOT_ALLOWED` - Headers não permitidos
- `SECURITY_HEADERS_INVALID` - Headers de segurança inválidos
- `RATE_LIMIT_EXCEEDED` - Limite de requisições excedido

### Respostas de Erro

```json
{
  "success": false,
  "error": {
    "message": "Origin not allowed",
    "code": "CORS_ORIGIN_NOT_ALLOWED",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Configuração Dinâmica

### Adicionar Domínio

```typescript
import { corsConfig } from '@/lib/cors-config'

// Apenas em desenvolvimento
corsConfig.addAllowedDomain('http://localhost:3002')
```

### Validar Configuração

```typescript
const validation = corsConfig.validateConfig()
if (!validation.isValid) {
  console.error('CORS config errors:', validation.errors)
}
```

## Boas Práticas

### 1. Domínios Específicos
- Nunca usar `*` em produção
- Listar apenas domínios necessários
- Usar HTTPS em produção

### 2. Headers Mínimos
- Permitir apenas headers necessários
- Validar Content-Type
- Aplicar headers de segurança

### 3. Monitoramento
- Usar componente de monitoramento
- Alertas para violações
- Logs detalhados

### 4. Testes
- Testar em diferentes origens
- Verificar preflight requests
- Validar error handling

## Solução de Problemas

### CORS Bloqueado
1. Verificar se a origem está na lista permitida
2. Confirmar protocolo (HTTP/HTTPS)
3. Validar headers obrigatórios

### Preflight Falha
1. Verificar método HTTP permitido
2. Validar headers solicitados
3. Confirmar configuração OPTIONS

### Rate Limit
1. Verificar limites configurados
2. Implementar retry logic
3. Monitorar uso da API

### Debug em Produção
1. Usar endpoint de debug
2. Verificar logs do servidor
3. Usar componente de monitoramento

## Exemplo de Configuração Completa

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' 
              ? 'http://localhost:3000' 
              : 'https://mailgenius.com'
          }
        ]
      }
    ]
  }
}
```

## Suporte e Manutenção

Para suporte técnico ou questões sobre CORS:

1. Verificar logs de debug
2. Usar componente de monitoramento
3. Consultar documentação da API
4. Testar em ambiente de desenvolvimento

---

Este sistema de CORS foi projetado para máxima segurança mantendo a flexibilidade necessária para desenvolvimento e produção.