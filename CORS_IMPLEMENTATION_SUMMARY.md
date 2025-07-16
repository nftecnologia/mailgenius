# Implementação de CORS Restritivo - MailGenius

## Resumo da Implementação

Foi implementado um sistema completo de CORS (Cross-Origin Resource Sharing) restritivo para melhorar a segurança do projeto MailGenius. O sistema inclui validação de origem, headers de segurança, rate limiting e monitoramento em tempo real.

## Arquivos Criados/Modificados

### 📁 Novos Arquivos

1. **`/src/lib/cors.ts`** - Gerenciador principal de CORS
   - Classe CORSManager com validação de origem
   - Headers de segurança aplicados automaticamente
   - Rate limiting integrado
   - Middleware withCORS para APIs

2. **`/src/lib/cors-config.ts`** - Configuração dinâmica de CORS
   - Singleton para gerenciar configurações
   - Suporte a variáveis de ambiente
   - Validação de domínios
   - Configurações por ambiente

3. **`/src/lib/hooks/useCORS.ts`** - Hooks React para CORS
   - useCORS: informações e validação
   - useCORSMonitoring: monitoramento de violações
   - Integração com APIs

4. **`/src/app/api/cors/info/route.ts`** - Endpoint de informações CORS
   - GET: informações de configuração
   - POST: validação de origem
   - PUT: debug detalhado
   - OPTIONS: preflight support

5. **`/src/components/security/CORSMonitor.tsx`** - Componente de monitoramento
   - Monitor completo de CORS
   - Badge de status
   - Alertas em tempo real
   - Debug integrado

6. **`/docs/CORS_SECURITY.md`** - Documentação completa
   - Guia de configuração
   - Exemplos de uso
   - Solução de problemas
   - Boas práticas

7. **`/src/tests/cors.test.ts`** - Testes unitários
   - Testes de configuração
   - Testes de validação
   - Testes de segurança
   - Testes de integração

8. **`/scripts/setup-cors.js`** - Script de configuração
   - Configuração interativa
   - Validação de domínios
   - Geração de .env

9. **`/scripts/test-cors.js`** - Script de teste
   - Testes automatizados
   - Relatório detalhado
   - Verificações de segurança

10. **`/.env.example`** - Exemplo de configuração
    - Variáveis de ambiente
    - Domínios por ambiente
    - Configurações de segurança

### 📝 Arquivos Modificados

1. **`/src/middleware.ts`** - Middleware principal
   - Integração com corsManager
   - Aplicação de CORS em todas as rotas
   - Validação de APIs

2. **`/src/app/api/public/v1/campaigns/route.ts`** - API exemplo
   - Implementação do withCORS
   - Todas as rotas protegidas
   - Headers de segurança

3. **`/next.config.js`** - Configuração do Next.js
   - Headers de segurança globais
   - Configuração de CORS
   - Políticas de segurança

4. **`/package.json`** - Scripts adicionais
   - cors:setup
   - cors:test
   - cors:test:prod

## Funcionalidades Implementadas

### 🔒 Segurança
- ✅ Validação rigorosa de origem
- ✅ Headers de segurança obrigatórios
- ✅ Rate limiting por API key
- ✅ Bloqueio de User-Agents suspeitos
- ✅ Validação de Content-Type
- ✅ Proteção contra ataques XSS

### 🌐 CORS
- ✅ Configuração por ambiente
- ✅ Domínios específicos permitidos
- ✅ Métodos HTTP controlados
- ✅ Headers permitidos restritivos
- ✅ Preflight requests suportados
- ✅ Credentials controlados

### 📊 Monitoramento
- ✅ Componente React de monitoramento
- ✅ Rastreamento de violações
- ✅ Alertas em tempo real
- ✅ Debug detalhado
- ✅ Métricas de uso

### 🛠️ Ferramentas
- ✅ Setup interativo
- ✅ Testes automatizados
- ✅ Validação de configuração
- ✅ Scripts de manutenção
- ✅ Documentação completa

## Configuração de Domínios

### Desenvolvimento
```
http://localhost:3000
http://localhost:3001
http://127.0.0.1:3000
http://127.0.0.1:3001
```

### Produção
```
https://mailgenius.com
https://www.mailgenius.com
https://app.mailgenius.com
https://mailgenius.vercel.app
https://mailgenius.netlify.app
```

## Headers de Segurança Aplicados

```
Access-Control-Allow-Origin: [origem-permitida]
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-API-Key
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Como Usar

### 1. Configuração Inicial
```bash
npm run cors:setup
```

### 2. Testar Configuração
```bash
npm run cors:test
```

### 3. Monitorar no Frontend
```tsx
import { CORSMonitor } from '@/components/security/CORSMonitor'

function AdminPanel() {
  return <CORSMonitor showDetails={true} />
}
```

### 4. Usar em APIs
```typescript
import { withCORS } from '@/lib/cors'

export const GET = withCORS(async (request) => {
  // Sua lógica aqui
})
```

## Validação de Segurança

### ✅ Testes Implementados
- Validação de origem
- Preflight requests
- Headers de segurança
- Rate limiting
- User-Agent filtering
- Content-Type validation

### 🔍 Monitoramento
- Violações em tempo real
- Alertas automáticos
- Debug detalhado
- Métricas de uso

## Próximos Passos

1. **Configurar variáveis de ambiente**
   - Adicionar domínios de produção
   - Configurar chaves de API
   - Definir limites de rate limiting

2. **Testar em produção**
   - Validar domínios permitidos
   - Verificar headers de segurança
   - Monitorar performance

3. **Implementar monitoramento**
   - Adicionar CORSMonitor no admin
   - Configurar alertas
   - Acompanhar métricas

4. **Manutenção contínua**
   - Revisar domínios permitidos
   - Atualizar configurações
   - Monitorar logs de segurança

## Suporte

Para dúvidas ou problemas:

1. Consulte `/docs/CORS_SECURITY.md`
2. Execute `npm run cors:test` para diagnóstico
3. Verifique logs no componente CORSMonitor
4. Revise configurações no arquivo .env

---

**Implementação concluída com sucesso!** 🎉

O sistema de CORS está agora completamente configurado e pronto para uso em desenvolvimento e produção, proporcionando máxima segurança sem comprometer a funcionalidade.