import DOMPurify from 'dompurify'

// Configuração de tags permitidas para emails
const EMAIL_ALLOWED_TAGS = [
  'a', 'abbr', 'acronym', 'address', 'area', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo',
  'big', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code',
  'col', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir',
  'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'img', 'input',
  'ins', 'kbd', 'label', 'legend', 'li', 'main', 'map', 'mark', 'menu', 'menuitem',
  'meter', 'nav', 'ol', 'optgroup', 'option', 'output', 'p', 'pre', 'progress', 'q',
  'rp', 'rt', 'ruby', 's', 'samp', 'section', 'select', 'small', 'source', 'span',
  'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea',
  'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
]

// Atributos permitidos para emails
const EMAIL_ALLOWED_ATTRIBUTES = [
  'accept', 'accept-charset', 'accesskey', 'action', 'align', 'alt', 'aria-describedby',
  'aria-hidden', 'aria-label', 'aria-labelledby', 'autocomplete', 'bgcolor', 'border',
  'cellpadding', 'cellspacing', 'charset', 'checked', 'cite', 'class', 'colspan',
  'color', 'cols', 'content', 'contenteditable', 'controls', 'coords', 'data',
  'datetime', 'default', 'dir', 'dirname', 'disabled', 'download', 'draggable',
  'enctype', 'for', 'form', 'formaction', 'headers', 'height', 'hidden', 'high',
  'href', 'hreflang', 'http-equiv', 'id', 'inputmode', 'integrity', 'is', 'ismap',
  'itemid', 'itemprop', 'itemref', 'itemscope', 'itemtype', 'kind', 'label',
  'lang', 'list', 'loop', 'low', 'manifest', 'max', 'maxlength', 'media', 'method',
  'min', 'minlength', 'multiple', 'muted', 'name', 'novalidate', 'open', 'optimum',
  'pattern', 'placeholder', 'poster', 'preload', 'readonly', 'rel', 'required',
  'reversed', 'rows', 'rowspan', 'sandbox', 'scope', 'selected', 'shape', 'size',
  'sizes', 'span', 'spellcheck', 'src', 'srcdoc', 'srclang', 'srcset', 'start',
  'step', 'style', 'tabindex', 'target', 'title', 'translate', 'type', 'usemap',
  'value', 'width', 'wrap'
]

// Protocolos permitidos para URLs
const ALLOWED_URI_SCHEMES = ['http', 'https', 'mailto', 'tel']

// Interface para configurações de sanitização
export interface SanitizeConfig {
  allowedTags?: string[]
  allowedAttributes?: string[]
  allowedSchemes?: string[]
  allowDataUri?: boolean
  stripIgnoreTag?: boolean
  stripIgnoreTagBody?: boolean
  keepClean?: boolean
}

// Configurações padrão para diferentes contextos
export const SANITIZE_CONFIGS = {
  EMAIL: {
    allowedTags: EMAIL_ALLOWED_TAGS,
    allowedAttributes: EMAIL_ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_URI_SCHEMES,
    allowDataUri: false,
    stripIgnoreTag: true,
    stripIgnoreTagBody: true,
    keepClean: true
  },
  TEMPLATE: {
    allowedTags: EMAIL_ALLOWED_TAGS,
    allowedAttributes: EMAIL_ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_URI_SCHEMES,
    allowDataUri: false,
    stripIgnoreTag: true,
    stripIgnoreTagBody: true,
    keepClean: true
  },
  PREVIEW: {
    allowedTags: EMAIL_ALLOWED_TAGS,
    allowedAttributes: EMAIL_ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_URI_SCHEMES,
    allowDataUri: false,
    stripIgnoreTag: true,
    stripIgnoreTagBody: true,
    keepClean: true
  },
  STRICT: {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'span', 'div', 'a'],
    allowedAttributes: ['href', 'title', 'class', 'style', 'target'],
    allowedSchemes: ['http', 'https', 'mailto'],
    allowDataUri: false,
    stripIgnoreTag: true,
    stripIgnoreTagBody: true,
    keepClean: true
  }
}

/**
 * Sanitiza conteúdo HTML removendo elementos e atributos potencialmente perigosos
 * @param html - Conteúdo HTML para sanitizar
 * @param config - Configurações de sanitização
 * @returns HTML sanitizado
 */
export function sanitizeHtml(html: string, config: SanitizeConfig = SANITIZE_CONFIGS.EMAIL): string {
  // Verifica se estamos no lado do cliente
  if (typeof window === 'undefined') {
    // No servidor, retornamos o HTML sem sanitização por enquanto
    // Em produção, você pode usar uma versão server-side do DOMPurify
    console.warn('sanitizeHtml: Running on server-side, HTML not sanitized')
    return html
  }

  if (!html || typeof html !== 'string') {
    return ''
  }

  // Configura DOMPurify com base nas configurações fornecidas
  const purifyConfig: any = {
    ALLOWED_TAGS: config.allowedTags || EMAIL_ALLOWED_TAGS,
    ALLOWED_ATTR: config.allowedAttributes || EMAIL_ALLOWED_ATTRIBUTES,
    ALLOWED_URI_REGEXP: new RegExp(
      `^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))`,
      'i'
    ),
    ALLOW_DATA_ATTR: config.allowDataUri || false,
    STRIP_COMMENTS: true,
    KEEP_CONTENT: !config.stripIgnoreTag,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
    FORCE_BODY: false,
    SANITIZE_DOM: true,
    SANITIZE_NAMED_PROPS: true,
    KEEP_CLEAN: config.keepClean || true,
    IN_PLACE: false
  }

  // Adiciona hooks personalizados para validação extra
  DOMPurify.addHook('beforeSanitizeElements', (node) => {
    // Remove qualquer elemento suspeito
    if (node.nodeName && ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FORM'].includes(node.nodeName)) {
      node.remove()
    }
  })

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Sanitiza atributos href para evitar XSS
    if (node.hasAttribute('href')) {
      const href = node.getAttribute('href')
      if (href && !isValidUrl(href)) {
        node.removeAttribute('href')
      }
    }

    // Sanitiza atributos src para imagens
    if (node.hasAttribute('src')) {
      const src = node.getAttribute('src')
      if (src && !isValidImageUrl(src)) {
        node.removeAttribute('src')
      }
    }

    // Remove atributos on* que possam ter passado
    Array.from(node.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        node.removeAttribute(attr.name)
      }
    })
  })

  try {
    // Sanitiza o HTML
    const sanitized = DOMPurify.sanitize(html, purifyConfig)
    
    // Limpa os hooks após o uso
    DOMPurify.removeAllHooks()
    
    return sanitized
  } catch (error) {
    console.error('Error sanitizing HTML:', error)
    return ''
  }
}

/**
 * Valida se uma URL é segura
 * @param url - URL para validar
 * @returns true se a URL é válida e segura
 */
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ALLOWED_URI_SCHEMES.includes(urlObj.protocol.replace(':', ''))
  } catch {
    // Se não é uma URL válida, verifica se é um link interno
    return url.startsWith('#') || url.startsWith('/')
  }
}

/**
 * Valida se uma URL de imagem é segura
 * @param url - URL da imagem para validar
 * @returns true se a URL é válida e segura
 */
function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

/**
 * Sanitiza texto simples removendo HTML
 * @param text - Texto para sanitizar
 * @returns Texto sanitizado sem HTML
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }
  
  // Remove tags HTML
  return text.replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim()
}

/**
 * Sanitiza dados de formulário
 * @param data - Dados do formulário
 * @returns Dados sanitizados
 */
export function sanitizeFormData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Para campos que podem conter HTML
      if (key.includes('html') || key.includes('content') || key.includes('template')) {
        sanitized[key] = sanitizeHtml(value)
      } else {
        // Para campos de texto simples
        sanitized[key] = sanitizeText(value)
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      )
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

/**
 * Sanitiza conteúdo de email template
 * @param template - Template de email
 * @returns Template sanitizado
 */
export function sanitizeEmailTemplate(template: {
  subject?: string
  html_content?: string
  text_content?: string
  [key: string]: any
}): any {
  return {
    ...template,
    subject: template.subject ? sanitizeText(template.subject) : '',
    html_content: template.html_content ? sanitizeHtml(template.html_content, SANITIZE_CONFIGS.TEMPLATE) : '',
    text_content: template.text_content ? sanitizeText(template.text_content) : ''
  }
}

/**
 * Valida se o conteúdo HTML é seguro
 * @param html - Conteúdo HTML para validar
 * @returns Array de problemas encontrados
 */
export function validateHtmlSafety(html: string): string[] {
  const issues: string[] = []
  
  if (!html || typeof html !== 'string') {
    return issues
  }
  
  // Verifica scripts
  if (html.includes('<script') || html.includes('</script>')) {
    issues.push('Contém tags script')
  }
  
  // Verifica eventos inline
  const eventHandlers = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur']
  for (const handler of eventHandlers) {
    if (html.toLowerCase().includes(handler)) {
      issues.push(`Contém handler de evento: ${handler}`)
    }
  }
  
  // Verifica URLs suspeitas
  const suspiciousPatterns = [
    /javascript:/i,
    /vbscript:/i,
    /data:(?!image)/i,
    /file:/i
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(html)) {
      issues.push(`Contém padrão suspeito: ${pattern.source}`)
    }
  }
  
  return issues
}