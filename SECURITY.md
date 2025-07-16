# Segurança - MailGenius

## Sanitização HTML

Este projeto implementa sanitização HTML robusta para proteger contra ataques XSS e outros vetores de ataque através de conteúdo HTML dinâmico.

### Biblioteca Utilizada

- **DOMPurify v3.2.6**: Biblioteca principal para sanitização HTML
- **@types/dompurify v3.0.5**: Tipos TypeScript para DOMPurify

### Configurações de Sanitização

#### Configuração EMAIL (Padrão)
- **Tags permitidas**: Tags HTML comuns para email marketing
- **Atributos permitidos**: Atributos seguros para estilização e links
- **Protocolos**: http, https, mailto, tel
- **Data URIs**: Não permitidos
- **Scripts**: Completamente bloqueados

#### Configuração TEMPLATE
- Idêntica à configuração EMAIL
- Otimizada para templates de email

#### Configuração PREVIEW
- Configuração para visualização segura
- Mantém funcionalidade visual sem comprometer segurança

#### Configuração STRICT
- Configuração mais restritiva
- Apenas tags básicas: p, br, strong, em, u, b, i, span, div, a
- Atributos limitados: href, title, class, style, target
- Ideal para conteúdo não confiável

### Locais Implementados

#### 1. Componente AIEmailGenerator
- **Arquivo**: `src/components/ai/AIEmailGenerator.tsx`
- **Uso**: Sanitiza conteúdo HTML gerado por IA
- **Componente**: `SanitizedPreviewHtml`

#### 2. Página de Templates
- **Arquivo**: `src/app/dashboard/templates/page.tsx`
- **Uso**: Sanitiza preview de templates
- **Componente**: `SanitizedTemplateHtml`

#### 3. API de Geração de Email
- **Arquivo**: `src/app/api/ai/generate-email/route.ts`
- **Uso**: Sanitiza dados de entrada e saída
- **Função**: `sanitizeFormData`, `sanitizeHtml`

#### 4. Validação de Formulários
- **Arquivo**: `src/lib/validation.ts`
- **Uso**: Valida e sanitiza dados de formulário
- **Esquemas**: Zod schemas com sanitização automática

### Componentes de Segurança

#### SanitizedHtml
**Localização**: `src/components/ui/sanitized-html.tsx`

```tsx
import { SanitizedHtml } from '@/components/ui/sanitized-html'

// Uso básico
<SanitizedHtml html={htmlContent} />

// Configuração personalizada
<SanitizedHtml 
  html={htmlContent} 
  config={SANITIZE_CONFIGS.STRICT}
  className="my-class"
/>
```

#### Hook useSanitizedHtml
**Localização**: `src/lib/hooks/useSanitizedHtml.ts`

```tsx
import { useSanitizedHtml } from '@/lib/hooks/useSanitizedHtml'

const MyComponent = ({ htmlContent }) => {
  const sanitizedHtml = useSanitizedHtml(htmlContent)
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
}
```

### Funções de Sanitização

#### sanitizeHtml
Sanitiza conteúdo HTML removendo elementos perigosos:

```typescript
import { sanitizeHtml } from '@/lib/sanitize'

const safeHtml = sanitizeHtml(userInput)
```

#### sanitizeText
Remove todas as tags HTML e caracteres especiais:

```typescript
import { sanitizeText } from '@/lib/sanitize'

const safeText = sanitizeText(userInput)
```

#### sanitizeFormData
Sanitiza dados de formulário automaticamente:

```typescript
import { sanitizeFormData } from '@/lib/sanitize'

const sanitizedData = sanitizeFormData(formData)
```

#### sanitizeEmailTemplate
Sanitiza templates de email:

```typescript
import { sanitizeEmailTemplate } from '@/lib/sanitize'

const safeTemplate = sanitizeEmailTemplate(template)
```

### Validação de Segurança

#### validateHtmlSafety
Valida se o HTML é seguro antes da sanitização:

```typescript
import { validateHtmlSafety } from '@/lib/sanitize'

const issues = validateHtmlSafety(htmlContent)
if (issues.length > 0) {
  console.warn('HTML issues:', issues)
}
```

### Middleware de Segurança

#### withSanitization
Middleware para sanitização automática em APIs:

```typescript
import { withSanitization } from '@/lib/middleware/sanitizeMiddleware'

export const POST = withSanitization(async (req) => {
  // Dados já sanitizados
  const body = await req.json()
  // ...
})
```

#### withTemplateValidation
Middleware específico para templates:

```typescript
import { withTemplateValidation } from '@/lib/middleware/sanitizeMiddleware'

export const POST = withTemplateValidation(async (req) => {
  // Template validado e sanitizado
  const template = await req.json()
  // ...
})
```

### Schemas de Validação

#### emailTemplateSchema
Valida e sanitiza templates de email:

```typescript
import { validateAndSanitize, emailTemplateSchema } from '@/lib/validation'

const validation = validateAndSanitize(emailTemplateSchema, formData)
if (validation.success) {
  const safeData = validation.data
}
```

### Configuração de Segurança

#### Tags Proibidas
- `<script>`
- `<object>`
- `<embed>`
- `<form>`
- `<input>`
- `<textarea>`
- `<select>`
- `<button>`

#### Atributos Proibidos
- `onerror`
- `onload`
- `onclick`
- `onmouseover`
- `onfocus`
- `onblur`
- `onchange`
- `onsubmit`
- Qualquer atributo começando com `on`

#### Protocolos Permitidos
- `http:`
- `https:`
- `mailto:`
- `tel:`

### Limitações do Servidor

Por questões de performance, a sanitização completa só ocorre no cliente. No servidor, há um fallback com logging para monitoramento.

### Monitoramento

O sistema registra tentativas de uso de conteúdo não seguro:

```typescript
console.warn('sanitizeHtml: Running on server-side, HTML not sanitized')
```

### Boas Práticas

1. **Sempre use componentes sanitizados**: `SanitizedHtml` ao invés de `dangerouslySetInnerHTML`
2. **Valide dados de entrada**: Use schemas Zod com sanitização
3. **Monitore logs**: Verifique logs de segurança regularmente
4. **Teste conteúdo**: Teste com payloads maliciosos em desenvolvimento
5. **Atualize dependências**: Mantenha DOMPurify atualizado

### Exemplo de Implementação Completa

```tsx
import { useState } from 'react'
import { SanitizedHtml } from '@/components/ui/sanitized-html'
import { validateAndSanitize, emailTemplateSchema } from '@/lib/validation'

const TemplateEditor = () => {
  const [template, setTemplate] = useState('')
  
  const handleSave = async () => {
    const validation = validateAndSanitize(emailTemplateSchema, {
      name: 'Template Test',
      subject: 'Test Subject',
      html_content: template,
      template_type: 'campaign'
    })
    
    if (!validation.success) {
      alert('Erro: ' + validation.errors.join(', '))
      return
    }
    
    // Dados seguros para salvar
    const safeData = validation.data
    await saveTemplate(safeData)
  }
  
  return (
    <div>
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
      />
      <SanitizedHtml html={template} />
      <button onClick={handleSave}>Salvar</button>
    </div>
  )
}
```

### Testes de Segurança

Para testar a sanitização, use payloads como:

```html
<!-- XSS básico -->
<script>alert('XSS')</script>

<!-- Evento inline -->
<img src="x" onerror="alert('XSS')">

<!-- Javascript URL -->
<a href="javascript:alert('XSS')">Link</a>

<!-- Data URI perigoso -->
<img src="data:text/html,<script>alert('XSS')</script>">
```

Todos devem ser neutralizados pela sanitização.