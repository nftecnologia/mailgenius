import { z } from 'zod'
import { sanitizeText, sanitizeHtml, validateHtmlSafety } from './sanitize'

// Schema para validação de template de email
export const emailTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .transform(sanitizeText),
  
  subject: z.string()
    .min(1, 'Assunto é obrigatório')
    .max(200, 'Assunto deve ter no máximo 200 caracteres')
    .transform(sanitizeText),
  
  html_content: z.string()
    .min(1, 'Conteúdo HTML é obrigatório')
    .max(1000000, 'Conteúdo HTML muito grande')
    .refine((html) => {
      const safety = validateHtmlSafety(html)
      return safety.length === 0
    }, 'HTML contém elementos não seguros')
    .transform(sanitizeHtml),
  
  text_content: z.string()
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  template_type: z.enum(['campaign', 'transactional', 'automation', 'wysiwyg'])
    .default('campaign'),
  
  variables: z.array(z.string().transform(sanitizeText))
    .optional()
    .default([])
})

// Schema para validação de campanha
export const campaignSchema = z.object({
  name: z.string()
    .min(1, 'Nome da campanha é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .transform(sanitizeText),
  
  subject: z.string()
    .min(1, 'Assunto é obrigatório')
    .max(200, 'Assunto deve ter no máximo 200 caracteres')
    .transform(sanitizeText),
  
  template_id: z.string()
    .uuid('ID do template inválido')
    .optional(),
  
  html_content: z.string()
    .min(1, 'Conteúdo HTML é obrigatório')
    .refine((html) => {
      const safety = validateHtmlSafety(html)
      return safety.length === 0
    }, 'HTML contém elementos não seguros')
    .transform(sanitizeHtml),
  
  text_content: z.string()
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  scheduled_at: z.string()
    .datetime('Data/hora inválida')
    .optional(),
  
  recipient_lists: z.array(z.string().uuid('ID da lista inválido'))
    .min(1, 'Pelo menos uma lista de destinatários é obrigatória')
})

// Schema para validação de lead
export const leadSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .max(254, 'Email muito longo'),
  
  name: z.string()
    .max(100, 'Nome muito longo')
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  phone: z.string()
    .max(20, 'Telefone muito longo')
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  company: z.string()
    .max(100, 'Nome da empresa muito longo')
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  tags: z.array(z.string().max(50, 'Tag muito longa').transform(sanitizeText))
    .optional()
    .default([]),
  
  metadata: z.record(z.string().max(500, 'Valor de metadado muito longo').transform(sanitizeText))
    .optional()
    .default({})
})

// Schema para validação de automação
export const automationSchema = z.object({
  name: z.string()
    .min(1, 'Nome da automação é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .transform(sanitizeText),
  
  description: z.string()
    .max(500, 'Descrição muito longa')
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  trigger_type: z.enum(['signup', 'purchase', 'abandoned_cart', 'date_based', 'behavior']),
  
  trigger_config: z.object({
    delay_minutes: z.number().min(0).max(525600).optional(), // max 1 year
    conditions: z.array(z.object({
      field: z.string().max(50).transform(sanitizeText),
      operator: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'exists']),
      value: z.string().max(200).transform(sanitizeText)
    })).optional()
  }),
  
  steps: z.array(z.object({
    type: z.enum(['email', 'delay', 'condition']),
    config: z.record(z.any()),
    template_id: z.string().uuid().optional()
  }))
})

// Schema para validação de configurações de API
export const apiConfigSchema = z.object({
  api_name: z.string()
    .min(1, 'Nome da API é obrigatório')
    .max(50, 'Nome muito longo')
    .transform(sanitizeText),
  
  api_key: z.string()
    .min(1, 'Chave da API é obrigatória')
    .max(500, 'Chave muito longa'),
  
  endpoint: z.string()
    .url('URL inválida')
    .optional(),
  
  webhook_url: z.string()
    .url('URL do webhook inválida')
    .optional()
})

// Schema para validação de dados de usuário
export const userProfileSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome muito longo')
    .transform(sanitizeText),
  
  email: z.string()
    .email('Email inválido')
    .max(254, 'Email muito longo'),
  
  company: z.string()
    .max(100, 'Nome da empresa muito longo')
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  phone: z.string()
    .max(20, 'Telefone muito longo')
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  timezone: z.string()
    .max(50, 'Timezone inválido')
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
  
  preferences: z.object({
    email_notifications: z.boolean().default(true),
    sms_notifications: z.boolean().default(false),
    marketing_emails: z.boolean().default(false)
  }).optional()
})

// Função para validar e sanitizar dados de forma segura
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      )
      return { success: false, errors }
    }
    return { success: false, errors: ['Erro de validação desconhecido'] }
  }
}

// Função para validar dados de forma assíncrona
export async function validateAndSanitizeAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: string[] }> {
  try {
    const result = await schema.parseAsync(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      )
      return { success: false, errors }
    }
    return { success: false, errors: ['Erro de validação desconhecido'] }
  }
}

// Função para sanitizar campos de busca
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return ''
  }
  
  return query
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/['"]/g, '') // Remove aspas
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/vbscript:/gi, '') // Remove vbscript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim()
    .substring(0, 200) // Limita tamanho
}

// Função para sanitizar parâmetros de URL
export function sanitizeUrlParams(params: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeSearchQuery(value)
    }
  }
  
  return sanitized
}

// Validação de tipos de arquivo permitidos
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'text/plain', 'text/csv'],
  imports: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
}

// Função para validar tipo de arquivo
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type)
}

// Função para validar tamanho de arquivo
export function validateFileSize(file: File, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024
  return file.size <= maxSizeInBytes
}

// Função para validar upload de arquivo
export function validateFileUpload(
  file: File,
  type: keyof typeof ALLOWED_FILE_TYPES,
  maxSizeInMB: number = 5
): { valid: boolean; error?: string } {
  const allowedTypes = ALLOWED_FILE_TYPES[type]
  
  if (!validateFileType(file, allowedTypes)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.join(', ')}`
    }
  }
  
  if (!validateFileSize(file, maxSizeInMB)) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${maxSizeInMB}MB`
    }
  }
  
  return { valid: true }
}