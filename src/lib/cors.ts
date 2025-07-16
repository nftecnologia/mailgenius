import { NextRequest, NextResponse } from 'next/server'

export interface CORSConfig {
  origin: string[] | string | boolean
  methods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  credentials: boolean
  maxAge: number
  preflightContinue: boolean
  optionsSuccessStatus: number
}

export interface CORSOptions {
  development?: Partial<CORSConfig>
  production?: Partial<CORSConfig>
  api?: Partial<CORSConfig>
}

// Domínios permitidos por ambiente
const ALLOWED_DOMAINS = {
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://localhost:3000',
    'https://localhost:3001'
  ],
  production: [
    'https://mailgenius.com',
    'https://www.mailgenius.com',
    'https://app.mailgenius.com',
    'https://mailgenius.vercel.app',
    'https://mailgenius.netlify.app'
  ]
}

// Configuração padrão do CORS
const DEFAULT_CORS_CONFIG: CORSConfig = {
  origin: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-API-Key',
    'X-Client-Version'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  credentials: true,
  maxAge: 86400, // 24 horas
  preflightContinue: false,
  optionsSuccessStatus: 204
}

// Configurações específicas por contexto
export const CORS_CONFIGS: CORSOptions = {
  development: {
    origin: ALLOWED_DOMAINS.development,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    credentials: true,
    maxAge: 3600 // 1 hora em desenvolvimento
  },
  production: {
    origin: ALLOWED_DOMAINS.production,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400 // 24 horas
  },
  api: {
    origin: [...ALLOWED_DOMAINS.development, ...ALLOWED_DOMAINS.production],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Client-Version',
      'X-Requested-With'
    ],
    credentials: false, // APIs públicas não precisam de credentials
    maxAge: 86400
  }
}

class CORSManager {
  private isDevelopment: boolean
  private allowedOrigins: string[]

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    this.allowedOrigins = this.isDevelopment 
      ? ALLOWED_DOMAINS.development 
      : ALLOWED_DOMAINS.production
  }

  /**
   * Verifica se a origem é permitida
   */
  private isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false
    
    // Em desenvolvimento, permite localhost com qualquer porta
    if (this.isDevelopment) {
      return this.allowedOrigins.some(allowed => 
        origin.startsWith(allowed) || 
        /^https?:\/\/localhost:\d+$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)
      )
    }

    // Em produção, apenas domínios específicos
    return this.allowedOrigins.includes(origin)
  }

  /**
   * Aplica headers CORS na resposta
   */
  private applyCORSHeaders(
    response: NextResponse, 
    request: NextRequest, 
    config: CORSConfig
  ): NextResponse {
    const origin = request.headers.get('origin')
    
    // Verificar origem
    if (config.origin === true) {
      response.headers.set('Access-Control-Allow-Origin', '*')
    } else if (Array.isArray(config.origin)) {
      if (origin && config.origin.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin)
      }
    } else if (typeof config.origin === 'string') {
      response.headers.set('Access-Control-Allow-Origin', config.origin)
    } else if (origin && this.isOriginAllowed(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }

    // Métodos permitidos
    if (config.methods.length > 0) {
      response.headers.set('Access-Control-Allow-Methods', config.methods.join(', '))
    }

    // Headers permitidos
    if (config.allowedHeaders.length > 0) {
      response.headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '))
    }

    // Headers expostos
    if (config.exposedHeaders.length > 0) {
      response.headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '))
    }

    // Credentials
    if (config.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    // Max Age
    if (config.maxAge > 0) {
      response.headers.set('Access-Control-Max-Age', config.maxAge.toString())
    }

    // Headers de segurança adiccionais
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return response
  }

  /**
   * Middleware CORS para rotas da aplicação
   */
  public handleCORS(request: NextRequest, response: NextResponse): NextResponse {
    const config = this.getConfig('development')
    
    // Se for uma requisição OPTIONS (preflight), responder imediatamente
    if (request.method === 'OPTIONS') {
      const preflightResponse = new NextResponse(null, { status: config.optionsSuccessStatus })
      return this.applyCORSHeaders(preflightResponse, request, config)
    }

    // Aplicar CORS na resposta normal
    return this.applyCORSHeaders(response, request, config)
  }

  /**
   * Middleware CORS específico para APIs
   */
  public handleAPICORS(request: NextRequest): NextResponse | null {
    const config = this.getConfig('api')
    const origin = request.headers.get('origin')

    // Verificar se a origem é permitida
    if (origin && !this.isOriginAllowed(origin)) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            message: 'Origin not allowed',
            code: 'CORS_ORIGIN_NOT_ALLOWED'
          }
        }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Se for preflight, responder com headers CORS
    if (request.method === 'OPTIONS') {
      const preflightResponse = new NextResponse(null, { status: config.optionsSuccessStatus })
      return this.applyCORSHeaders(preflightResponse, request, config)
    }

    return null
  }

  /**
   * Obter configuração CORS
   */
  private getConfig(type: keyof CORSOptions): CORSConfig {
    const envConfig = this.isDevelopment ? CORS_CONFIGS.development : CORS_CONFIGS.production
    const typeConfig = CORS_CONFIGS[type]
    
    return {
      ...DEFAULT_CORS_CONFIG,
      ...envConfig,
      ...typeConfig
    }
  }

  /**
   * Criar response com CORS aplicado
   */
  public createCORSResponse(data: any, status: number = 200, request: NextRequest): NextResponse {
    const response = NextResponse.json(data, { status })
    const config = this.getConfig('api')
    
    return this.applyCORSHeaders(response, request, config)
  }

  /**
   * Validar headers de segurança
   */
  public validateSecurityHeaders(request: NextRequest): boolean {
    const userAgent = request.headers.get('user-agent')
    const contentType = request.headers.get('content-type')
    
    // Bloquear requisições suspeitas
    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      return false
    }
    
    // Validar Content-Type para métodos que enviam dados
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
        return false
      }
    }
    
    return true
  }

  /**
   * Verificar User-Agent suspeito
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /curl/i,
      /wget/i,
      /python/i,
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i
    ]
    
    // Em produção, bloquear alguns user agents suspeitos
    if (!this.isDevelopment) {
      return suspiciousPatterns.some(pattern => pattern.test(userAgent))
    }
    
    return false
  }

  /**
   * Obter domínios permitidos para o ambiente atual
   */
  public getAllowedDomains(): string[] {
    return this.allowedOrigins
  }

  /**
   * Adicionar domínio permitido dinamicamente (apenas em desenvolvimento)
   */
  public addAllowedDomain(domain: string): void {
    if (this.isDevelopment && !this.allowedOrigins.includes(domain)) {
      this.allowedOrigins.push(domain)
    }
  }
}

export const corsManager = new CORSManager()

// Helpers para uso em rotas API
export function withCORS(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Verificar CORS primeiro
    const corsResponse = corsManager.handleAPICORS(request)
    if (corsResponse) {
      return corsResponse
    }

    // Validar headers de segurança
    if (!corsManager.validateSecurityHeaders(request)) {
      return corsManager.createCORSResponse({
        success: false,
        error: {
          message: 'Invalid security headers',
          code: 'SECURITY_HEADERS_INVALID'
        }
      }, 400, request)
    }

    // Executar handler
    try {
      const response = await handler(request)
      
      // Aplicar CORS na resposta
      const config = corsManager['getConfig']('api')
      return corsManager['applyCORSHeaders'](response, request, config)
    } catch (error) {
      return corsManager.createCORSResponse({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      }, 500, request)
    }
  }
}

// Tipos para export
export type { CORSConfig, CORSOptions }