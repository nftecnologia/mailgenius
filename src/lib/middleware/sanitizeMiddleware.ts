import { NextRequest, NextResponse } from 'next/server'
import { sanitizeFormData, sanitizeEmailTemplate, validateHtmlSafety } from '@/lib/sanitize'

/**
 * Middleware para sanitizar dados de entrada nas APIs
 */
export function withSanitization(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      // Clona a requisição para poder modificar o body
      const clonedRequest = req.clone()
      
      // Verifica se há body para sanitizar
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const contentType = req.headers.get('content-type')
        
        if (contentType?.includes('application/json')) {
          const body = await clonedRequest.json()
          
          // Sanitiza o body baseado no tipo de dados
          const sanitizedBody = sanitizeRequestBody(body, req.url)
          
          // Cria uma nova requisição com o body sanitizado
          const sanitizedRequest = new NextRequest(req.url, {
            method: req.method,
            headers: req.headers,
            body: JSON.stringify(sanitizedBody)
          })
          
          return handler(sanitizedRequest)
        }
      }
      
      return handler(req)
    } catch (error) {
      console.error('Error in sanitization middleware:', error)
      return NextResponse.json(
        { error: 'Error processing request' },
        { status: 500 }
      )
    }
  }
}

/**
 * Sanitiza o body da requisição baseado na URL
 */
function sanitizeRequestBody(body: any, url: string): any {
  if (!body || typeof body !== 'object') {
    return body
  }
  
  // Templates de email
  if (url.includes('/templates') || url.includes('/email')) {
    if (body.html_content || body.htmlContent) {
      return sanitizeEmailTemplate(body)
    }
  }
  
  // Campanhas de email
  if (url.includes('/campaigns')) {
    if (body.template || body.content) {
      return {
        ...body,
        template: body.template ? sanitizeEmailTemplate(body.template) : body.template,
        content: body.content ? sanitizeEmailTemplate(body.content) : body.content
      }
    }
  }
  
  // Dados de formulário genéricos
  return sanitizeFormData(body)
}

/**
 * Valida se o conteúdo HTML é seguro antes de salvar
 */
export function validateHtmlContent(html: string): { isValid: boolean; issues: string[] } {
  const issues = validateHtmlSafety(html)
  return {
    isValid: issues.length === 0,
    issues
  }
}

/**
 * Middleware específico para endpoints de templates
 */
export function withTemplateValidation(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const body = await req.json()
        
        // Valida conteúdo HTML se presente
        if (body.html_content) {
          const validation = validateHtmlContent(body.html_content)
          
          if (!validation.isValid) {
            return NextResponse.json(
              { 
                error: 'Conteúdo HTML inválido',
                issues: validation.issues
              },
              { status: 400 }
            )
          }
        }
        
        // Sanitiza o template
        const sanitizedTemplate = sanitizeEmailTemplate(body)
        
        // Cria nova requisição com dados sanitizados
        const sanitizedRequest = new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(sanitizedTemplate)
        })
        
        return handler(sanitizedRequest)
      }
      
      return handler(req)
    } catch (error) {
      console.error('Error in template validation middleware:', error)
      return NextResponse.json(
        { error: 'Error validating template' },
        { status: 500 }
      )
    }
  }
}

/**
 * Sanitiza parâmetros de query
 */
export function sanitizeQueryParams(params: Record<string, string | string[]>): Record<string, string | string[]> {
  const sanitized: Record<string, string | string[]> = {}
  
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      sanitized[key] = value.map(v => sanitizeQueryValue(v))
    } else {
      sanitized[key] = sanitizeQueryValue(value)
    }
  }
  
  return sanitized
}

/**
 * Sanitiza um valor de query parameter
 */
function sanitizeQueryValue(value: string): string {
  if (!value || typeof value !== 'string') {
    return ''
  }
  
  // Remove caracteres potencialmente perigosos
  return value
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
}