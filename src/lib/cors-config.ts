import { corsManager } from './cors'

/**
 * Configuração dinâmica de CORS baseada em variáveis de ambiente
 */
export class CORSConfigManager {
  private static instance: CORSConfigManager
  private developmentDomains: string[]
  private productionDomains: string[]
  private isInitialized = false

  private constructor() {
    this.developmentDomains = []
    this.productionDomains = []
  }

  public static getInstance(): CORSConfigManager {
    if (!CORSConfigManager.instance) {
      CORSConfigManager.instance = new CORSConfigManager()
    }
    return CORSConfigManager.instance
  }

  /**
   * Inicializar configurações de CORS
   */
  public initialize(): void {
    if (this.isInitialized) return

    // Carregar domínios de desenvolvimento
    const devDomains = process.env.CORS_DEVELOPMENT_DOMAINS
    if (devDomains) {
      this.developmentDomains = devDomains.split(',').map(domain => domain.trim())
    }

    // Carregar domínios de produção
    const prodDomains = process.env.CORS_PRODUCTION_DOMAINS
    if (prodDomains) {
      this.productionDomains = prodDomains.split(',').map(domain => domain.trim())
    }

    // Adicionar domínios ao corsManager
    const allDomains = [...this.developmentDomains, ...this.productionDomains]
    allDomains.forEach(domain => {
      if (domain) {
        corsManager.addAllowedDomain(domain)
      }
    })

    this.isInitialized = true
  }

  /**
   * Obter domínios permitidos para o ambiente atual
   */
  public getAllowedDomains(): string[] {
    if (!this.isInitialized) {
      this.initialize()
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    return isDevelopment ? this.developmentDomains : this.productionDomains
  }

  /**
   * Verificar se um domínio é permitido
   */
  public isDomainAllowed(domain: string): boolean {
    if (!this.isInitialized) {
      this.initialize()
    }

    const allowedDomains = this.getAllowedDomains()
    return allowedDomains.includes(domain)
  }

  /**
   * Adicionar domínio permitido dinamicamente
   */
  public addAllowedDomain(domain: string): void {
    if (!this.isInitialized) {
      this.initialize()
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (isDevelopment) {
      if (!this.developmentDomains.includes(domain)) {
        this.developmentDomains.push(domain)
        corsManager.addAllowedDomain(domain)
      }
    } else {
      if (!this.productionDomains.includes(domain)) {
        this.productionDomains.push(domain)
        corsManager.addAllowedDomain(domain)
      }
    }
  }

  /**
   * Remover domínio permitido
   */
  public removeAllowedDomain(domain: string): void {
    if (!this.isInitialized) {
      this.initialize()
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (isDevelopment) {
      this.developmentDomains = this.developmentDomains.filter(d => d !== domain)
    } else {
      this.productionDomains = this.productionDomains.filter(d => d !== domain)
    }
  }

  /**
   * Obter configuração de CORS baseada no ambiente
   */
  public getCORSConfig() {
    if (!this.isInitialized) {
      this.initialize()
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    
    return {
      origin: this.getAllowedDomains(),
      credentials: process.env.CORS_CREDENTIALS === 'true',
      maxAge: parseInt(process.env.CORS_MAX_AGE || '86400'),
      preflightMaxAge: parseInt(process.env.CORS_PREFLIGHT_MAX_AGE || '3600'),
      methods: isDevelopment 
        ? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH']
        : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-API-Key',
        'X-Client-Version'
      ]
    }
  }

  /**
   * Obter configurações de segurança
   */
  public getSecurityConfig() {
    return {
      blockSuspiciousUserAgents: process.env.SECURITY_BLOCK_SUSPICIOUS_USER_AGENTS === 'true',
      validateContentType: process.env.SECURITY_VALIDATE_CONTENT_TYPE === 'true',
      rateLimitRequests: parseInt(process.env.SECURITY_RATE_LIMIT_REQUESTS || '1000'),
      rateLimitWindow: parseInt(process.env.SECURITY_RATE_LIMIT_WINDOW || '3600000')
    }
  }

  /**
   * Validar configuração de CORS
   */
  public validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (this.developmentDomains.length === 0) {
      errors.push('No development domains configured')
    }

    if (this.productionDomains.length === 0) {
      errors.push('No production domains configured')
    }

    // Validar formato dos domínios
    const allDomains = [...this.developmentDomains, ...this.productionDomains]
    allDomains.forEach(domain => {
      if (domain && !this.isValidDomainFormat(domain)) {
        errors.push(`Invalid domain format: ${domain}`)
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validar formato de domínio
   */
  private isValidDomainFormat(domain: string): boolean {
    try {
      const url = new URL(domain)
      return ['http:', 'https:'].includes(url.protocol)
    } catch {
      return false
    }
  }

  /**
   * Obter estatísticas de CORS
   */
  public getStats() {
    return {
      developmentDomains: this.developmentDomains.length,
      productionDomains: this.productionDomains.length,
      totalAllowedDomains: this.getAllowedDomains().length,
      environment: process.env.NODE_ENV,
      isInitialized: this.isInitialized
    }
  }
}

// Instância singleton
export const corsConfig = CORSConfigManager.getInstance()

// Inicializar automaticamente
corsConfig.initialize()

// Função auxiliar para debug
export function debugCORS() {
  console.log('🔒 CORS Debug Information:')
  console.log('Environment:', process.env.NODE_ENV)
  console.log('Allowed domains:', corsConfig.getAllowedDomains())
  console.log('Config:', corsConfig.getCORSConfig())
  console.log('Security:', corsConfig.getSecurityConfig())
  console.log('Stats:', corsConfig.getStats())
  
  const validation = corsConfig.validateConfig()
  if (!validation.isValid) {
    console.warn('❌ CORS Configuration Issues:', validation.errors)
  } else {
    console.log('✅ CORS Configuration Valid')
  }
}