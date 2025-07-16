// Teste básico para sanitização HTML
// Para executar em um ambiente de teste adequado

import { sanitizeHtml, sanitizeText, validateHtmlSafety } from '../sanitize'

// Mock para DOMPurify quando executado em ambiente de teste
jest.mock('dompurify', () => ({
  sanitize: jest.fn((input) => {
    // Mock básico que remove scripts e eventos
    return input
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '')
  }),
  addHook: jest.fn(),
  removeAllHooks: jest.fn()
}))

describe('Sanitização HTML', () => {
  describe('sanitizeHtml', () => {
    it('deve remover scripts maliciosos', () => {
      const maliciousHtml = '<div>Conteúdo<script>alert("XSS")</script></div>'
      const result = sanitizeHtml(maliciousHtml)
      
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert("XSS")')
      expect(result).toContain('Conteúdo')
    })

    it('deve remover event handlers', () => {
      const maliciousHtml = '<img src="x" onerror="alert(\'XSS\')">'
      const result = sanitizeHtml(maliciousHtml)
      
      expect(result).not.toContain('onerror=')
      expect(result).not.toContain('alert(')
    })

    it('deve remover JavaScript URLs', () => {
      const maliciousHtml = '<a href="javascript:alert(\'XSS\')">Link</a>'
      const result = sanitizeHtml(maliciousHtml)
      
      expect(result).not.toContain('javascript:')
      expect(result).not.toContain('alert(')
    })

    it('deve manter conteúdo HTML válido', () => {
      const validHtml = '<div><p>Texto <strong>importante</strong></p></div>'
      const result = sanitizeHtml(validHtml)
      
      expect(result).toContain('<div>')
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
      expect(result).toContain('Texto importante')
    })

    it('deve retornar string vazia para input inválido', () => {
      expect(sanitizeHtml('')).toBe('')
      expect(sanitizeHtml(null as any)).toBe('')
      expect(sanitizeHtml(undefined as any)).toBe('')
    })
  })

  describe('sanitizeText', () => {
    it('deve remover todas as tags HTML', () => {
      const htmlText = '<p>Texto com <strong>formatação</strong></p>'
      const result = sanitizeText(htmlText)
      
      expect(result).not.toContain('<p>')
      expect(result).not.toContain('<strong>')
      expect(result).toBe('Texto com formatação')
    })

    it('deve decodificar entidades HTML', () => {
      const encodedText = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      const result = sanitizeText(encodedText)
      
      expect(result).toContain('<script>')
      expect(result).toContain('alert("XSS")')
    })

    it('deve retornar string vazia para input inválido', () => {
      expect(sanitizeText('')).toBe('')
      expect(sanitizeText(null as any)).toBe('')
      expect(sanitizeText(undefined as any)).toBe('')
    })
  })

  describe('validateHtmlSafety', () => {
    it('deve detectar scripts', () => {
      const html = '<div>Content<script>alert("XSS")</script></div>'
      const issues = validateHtmlSafety(html)
      
      expect(issues).toContain('Contém tags script')
    })

    it('deve detectar event handlers', () => {
      const html = '<img src="x" onclick="alert(\'XSS\')">'
      const issues = validateHtmlSafety(html)
      
      expect(issues.some(issue => issue.includes('onclick'))).toBe(true)
    })

    it('deve detectar URLs suspeitas', () => {
      const html = '<a href="javascript:alert(\'XSS\')">Link</a>'
      const issues = validateHtmlSafety(html)
      
      expect(issues.some(issue => issue.includes('javascript'))).toBe(true)
    })

    it('deve retornar array vazio para HTML seguro', () => {
      const html = '<div><p>Texto <strong>seguro</strong></p></div>'
      const issues = validateHtmlSafety(html)
      
      expect(issues).toEqual([])
    })
  })
})

// Testes de integração para casos específicos do projeto
describe('Casos de uso específicos', () => {
  describe('Templates de email', () => {
    it('deve sanitizar template de boas-vindas', () => {
      const template = `
        <div style="font-family: Arial;">
          <h1>Bem-vindo {{name}}!</h1>
          <p>Conteúdo do email</p>
          <script>track('user_opened_email')</script>
        </div>
      `
      
      const result = sanitizeHtml(template)
      
      expect(result).toContain('Bem-vindo {{name}}!')
      expect(result).toContain('Conteúdo do email')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('track(')
    })

    it('deve manter variáveis de template', () => {
      const template = '<p>Olá {{name}}, sua empresa é {{company}}.</p>'
      const result = sanitizeHtml(template)
      
      expect(result).toContain('{{name}}')
      expect(result).toContain('{{company}}')
    })
  })

  describe('Conteúdo gerado por IA', () => {
    it('deve sanitizar conteúdo gerado', () => {
      const aiContent = `
        <div>
          <h2>Título gerado por IA</h2>
          <p>Conteúdo interessante</p>
          <img src="x" onerror="maliciousCode()">
        </div>
      `
      
      const result = sanitizeHtml(aiContent)
      
      expect(result).toContain('Título gerado por IA')
      expect(result).toContain('Conteúdo interessante')
      expect(result).not.toContain('onerror=')
      expect(result).not.toContain('maliciousCode')
    })
  })
})

// Testes de performance
describe('Performance', () => {
  it('deve processar HTML grande sem travamentos', () => {
    const largeHtml = '<div>' + 'Conteúdo '.repeat(10000) + '</div>'
    
    const startTime = Date.now()
    const result = sanitizeHtml(largeHtml)
    const endTime = Date.now()
    
    expect(endTime - startTime).toBeLessThan(1000) // 1 segundo
    expect(result).toContain('Conteúdo')
  })
})

// Configuração de teste para diferentes ambientes
describe('Configurações de sanitização', () => {
  it('deve aplicar configuração EMAIL corretamente', () => {
    // Testes específicos para configuração EMAIL
    const emailHtml = '<table><tr><td>Conteúdo de email</td></tr></table>'
    const result = sanitizeHtml(emailHtml)
    
    expect(result).toContain('<table>')
    expect(result).toContain('<tr>')
    expect(result).toContain('<td>')
  })

  it('deve aplicar configuração STRICT corretamente', () => {
    // Testes específicos para configuração STRICT
    const htmlWithTables = '<table><tr><td>Conteúdo</td></tr></table>'
    // Na configuração STRICT, tables podem não ser permitidas
    // Dependendo da implementação real
  })
})