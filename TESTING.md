# MailGenius Testing Guide

Este documento descreve a estratégia de testes implementada no projeto MailGenius, focando em funcionalidades críticas e segurança.

## Estrutura de Testes

### Framework e Ferramentas

- **Jest** - Framework de testes principal
- **React Testing Library** - Testes de componentes React
- **Testing Library User Event** - Simulação de interações do usuário
- **Supertest** - Testes de API (se necessário)

### Configuração

```bash
# Instalar dependências de teste
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom

# Executar testes
npm test

# Executar com coverage
npm run test:coverage

# Executar em modo watch
npm run test:watch
```

## Tipos de Testes

### 1. Testes de Componentes

**Localização:** `src/components/**/__tests__/`

**Foco:**
- Renderização correta
- Interações do usuário
- Estados e props
- Acessibilidade

**Exemplo:**
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthForm from '../AuthForm'

test('should handle login correctly', async () => {
  const user = userEvent.setup()
  render(<AuthForm />)
  
  await user.type(screen.getByLabelText('Email'), 'test@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Login' }))
  
  expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
})
```

### 2. Testes de Hooks

**Localização:** `src/lib/hooks/**/__tests__/`

**Foco:**
- Estados e efeitos
- Gerenciamento de dados
- Autenticação
- Integração com APIs

**Exemplo:**
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useSupabaseAuth } from '../useSupabaseAuth'

test('should handle authentication flow', async () => {
  const { result } = renderHook(() => useSupabaseAuth())
  
  expect(result.current.loading).toBe(true)
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })
})
```

### 3. Testes de API

**Localização:** `src/app/api/**/__tests__/`

**Foco:**
- Endpoints HTTP
- Validação de dados
- Autenticação e autorização
- Tratamento de erros

**Exemplo:**
```typescript
import { NextRequest } from 'next/server'
import { GET } from '../route'

test('should return leads for authenticated user', async () => {
  const request = new NextRequest('http://localhost:3000/api/leads', {
    headers: { 'Authorization': 'Bearer valid-token' }
  })
  
  const response = await GET(request)
  const data = await response.json()
  
  expect(response.status).toBe(200)
  expect(data.success).toBe(true)
})
```

### 4. Testes de Segurança

**Localização:** `src/lib/**/__tests__/`

**Foco:**
- Sanitização de HTML
- Validação de entrada
- Rate limiting
- Prevenção de XSS

**Exemplo:**
```typescript
import { sanitizeHtml } from '../sanitize'

test('should remove malicious scripts', () => {
  const maliciousHtml = '<div>Content<script>alert("XSS")</script></div>'
  const result = sanitizeHtml(maliciousHtml)
  
  expect(result).not.toContain('<script>')
  expect(result).toContain('Content')
})
```

### 5. Testes de Validação

**Localização:** `src/lib/validation/**/__tests__/`

**Foco:**
- Schemas Zod
- Validação de formulários
- Validação de API
- Tratamento de erros

## Componentes Críticos Testados

### Autenticação
- `AuthForm` - Formulário de login/registro
- `useSupabaseAuth` - Hook de autenticação
- Rotas de autenticação da API

### Geração de Conteúdo AI
- `AIEmailGenerator` - Gerador de emails com IA
- API `/api/ai/generate-email`
- Sanitização de conteúdo gerado

### Dashboard
- `DashboardLayout` - Layout principal
- Componentes de navegação
- Controle de acesso

### APIs Principais
- `/api/public/v1/leads` - Gestão de leads
- `/api/campaigns/send` - Envio de campanhas
- `/api/webhooks/resend` - Webhooks

### Funcionalidades de Segurança
- Sanitização HTML
- Validação de entrada
- Rate limiting
- Prevenção de XSS/CSRF

## Estratégia de Mocking

### Supabase
```typescript
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: () => mockSupabaseClient
}))
```

### Resend
```typescript
jest.mock('resend', () => ({
  Resend: () => mockResendClient
}))
```

### Next.js
```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter
}))
```

## Executando Testes

### Comandos Básicos

```bash
# Todos os testes
npm test

# Testes específicos
npm test -- --testPathPattern="auth"

# Com coverage
npm run test:coverage

# Modo watch
npm run test:watch

# CI
npm run test:ci
```

### Script Customizado

```bash
# Usar script customizado
node scripts/run-tests.js [comando]

# Comandos disponíveis:
# all, unit, integration, auth, api, components, security, coverage, ci, watch, critical, help
```

### Exemplos

```bash
# Testes de autenticação
node scripts/run-tests.js auth

# Testes de segurança
node scripts/run-tests.js security

# Testes críticos
node scripts/run-tests.js critical

# Todos os testes com relatório
node scripts/run-tests.js all
```

## Cobertura de Testes

### Configuração de Cobertura

```javascript
// jest.config.js
collectCoverageFrom: [
  'src/**/*.{js,jsx,ts,tsx}',
  '!src/**/*.d.ts',
  '!src/app/layout.tsx',
  '!src/components/ui/**',
  '!**/node_modules/**',
]

coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

### Relatórios

- **HTML:** `coverage/lcov-report/index.html`
- **LCOV:** `coverage/lcov.info`
- **Terminal:** Exibido após execução

## Integração Contínua

### GitHub Actions

O arquivo `.github/workflows/tests.yml` configura:

1. **Testes unitários** - Node.js 18.x e 20.x
2. **Testes de segurança** - Validação e sanitização
3. **Testes de integração** - Com PostgreSQL e Redis
4. **Cobertura de código** - Upload para Codecov

### Executar Localmente

```bash
# Simular ambiente CI
NODE_ENV=test npm run test:ci

# Verificar linting
npm run lint

# Verificar tipos
npx tsc --noEmit
```

## Boas Práticas

### Nomenclatura
- Arquivos de teste: `*.test.ts` ou `*.test.tsx`
- Pasta de testes: `__tests__/`
- Descritivos: `describe('Component', () => { it('should...') })`

### Estrutura de Teste
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup comum
  })
  
  describe('feature group', () => {
    it('should handle specific case', () => {
      // Teste específico
    })
  })
})
```

### Mocking
- Mock apenas dependências externas
- Use `jest.clearAllMocks()` no beforeEach
- Mantenha mocks próximos aos testes

### Assertions
- Use matchers específicos do Jest
- Prefira `toHaveBeenCalledWith()` sobre `toHaveBeenCalled()`
- Teste comportamentos, não implementação

## Debugging

### Logs de Teste
```typescript
// Habilitar logs durante testes
console.log = jest.fn() // Para silenciar
// ou
global.console = require('console') // Para ver logs
```

### Breakpoints
```typescript
// Usar debugger
debugger

// Ou console.log
console.log('Debug info:', data)
```

### Verbose Mode
```bash
npm test -- --verbose
```

## Troubleshooting

### Problemas Comuns

1. **Timeouts** - Aumentar timeout no Jest
2. **Async/Await** - Usar waitFor() adequadamente
3. **Mocks** - Verificar se mocks estão corretos
4. **Environment** - Verificar variáveis de ambiente

### Ferramentas

- **Jest CLI** - Opções de linha de comando
- **React DevTools** - Debug de componentes
- **VS Code** - Extensão Jest Runner

## Monitoramento

### Métricas
- Cobertura de código
- Tempo de execução
- Taxa de sucesso
- Falhas por categoria

### Alertas
- Cobertura abaixo de 70%
- Testes falhando em CI
- Tempo de execução excessivo

## Contribuindo

### Novos Testes
1. Seguir estrutura existente
2. Adicionar testes para novas funcionalidades
3. Manter cobertura acima de 70%
4. Documentar casos complexos

### Revisão
- Verificar se testes passam
- Validar cobertura
- Revisar qualidade dos testes
- Testar cenários edge cases

## Recursos Adicionais

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)