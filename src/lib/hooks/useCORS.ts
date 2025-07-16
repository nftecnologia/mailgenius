import { useEffect, useState } from 'react'

export interface CORSInfo {
  allowedOrigins: string[]
  currentOrigin: string
  isAllowed: boolean
  environment: string
  corsEnabled: boolean
}

export interface CORSError {
  code: string
  message: string
  origin?: string
  timestamp: string
}

/**
 * Hook para gerenciar informações de CORS no cliente
 */
export function useCORS() {
  const [corsInfo, setCORSInfo] = useState<CORSInfo | null>(null)
  const [corsErrors, setCORSErrors] = useState<CORSError[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeCORS = async () => {
      try {
        const currentOrigin = window.location.origin
        const environment = process.env.NODE_ENV || 'development'
        
        // Simular verificação de CORS
        const response = await fetch('/api/cors/info', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Origin': currentOrigin
          }
        })

        if (response.ok) {
          const data = await response.json()
          setCORSInfo({
            allowedOrigins: data.allowedOrigins || [],
            currentOrigin,
            isAllowed: data.isAllowed || false,
            environment,
            corsEnabled: data.corsEnabled || false
          })
        } else {
          // Se a API não existir, inferir configurações
          const allowedOrigins = environment === 'development' 
            ? ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000']
            : ['https://mailgenius.com', 'https://www.mailgenius.com', 'https://app.mailgenius.com']
          
          setCORSInfo({
            allowedOrigins,
            currentOrigin,
            isAllowed: allowedOrigins.includes(currentOrigin),
            environment,
            corsEnabled: true
          })
        }
      } catch (error) {
        console.error('Error initializing CORS:', error)
        addCORSError('CORS_INIT_ERROR', 'Failed to initialize CORS information')
      } finally {
        setLoading(false)
      }
    }

    initializeCORS()
  }, [])

  /**
   * Adicionar erro de CORS
   */
  const addCORSError = (code: string, message: string, origin?: string) => {
    const error: CORSError = {
      code,
      message,
      origin,
      timestamp: new Date().toISOString()
    }
    
    setCORSErrors(prev => [...prev, error])
  }

  /**
   * Limpar erros de CORS
   */
  const clearCORSErrors = () => {
    setCORSErrors([])
  }

  /**
   * Verificar se uma origem é permitida
   */
  const isOriginAllowed = (origin: string): boolean => {
    if (!corsInfo) return false
    return corsInfo.allowedOrigins.includes(origin)
  }

  /**
   * Fazer requisição com verificação de CORS
   */
  const fetchWithCORS = async (
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> => {
    const currentOrigin = window.location.origin
    
    // Verificar se a origem é permitida
    if (!isOriginAllowed(currentOrigin)) {
      addCORSError('CORS_ORIGIN_NOT_ALLOWED', 'Current origin is not allowed', currentOrigin)
      throw new Error('CORS: Origin not allowed')
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Origin': currentOrigin
        },
        mode: 'cors',
        credentials: 'include'
      })

      // Verificar se houve erro de CORS
      if (!response.ok && response.status === 403) {
        const errorData = await response.json()
        if (errorData.error?.code === 'CORS_ORIGIN_NOT_ALLOWED') {
          addCORSError('CORS_REQUEST_BLOCKED', 'Request blocked by CORS policy', currentOrigin)
        }
      }

      return response
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('CORS')) {
          addCORSError('CORS_REQUEST_FAILED', error.message, currentOrigin)
        }
      }
      throw error
    }
  }

  /**
   * Verificar conectividade com API
   */
  const checkAPIConnectivity = async (): Promise<boolean> => {
    try {
      const response = await fetchWithCORS('/api/health')
      return response.ok
    } catch (error) {
      addCORSError('API_CONNECTIVITY_ERROR', 'Failed to connect to API')
      return false
    }
  }

  /**
   * Obter informações de debug
   */
  const getDebugInfo = () => {
    return {
      corsInfo,
      corsErrors,
      userAgent: navigator.userAgent,
      currentURL: window.location.href,
      referrer: document.referrer,
      hasSecureContext: window.isSecureContext
    }
  }

  return {
    corsInfo,
    corsErrors,
    loading,
    isOriginAllowed,
    fetchWithCORS,
    checkAPIConnectivity,
    addCORSError,
    clearCORSErrors,
    getDebugInfo
  }
}

/**
 * Hook para monitorar violações de CORS
 */
export function useCORSMonitoring() {
  const [violations, setViolations] = useState<CORSError[]>([])

  useEffect(() => {
    const handleSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => {
      if (event.violatedDirective.includes('connect-src')) {
        const violation: CORSError = {
          code: 'CSP_VIOLATION',
          message: `CSP violation: ${event.violatedDirective}`,
          origin: event.sourceFile,
          timestamp: new Date().toISOString()
        }
        setViolations(prev => [...prev, violation])
      }
    }

    // Interceptar erros de fetch que podem ser relacionados a CORS
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        
        // Verificar se houve erro de CORS
        if (!response.ok && response.status === 0) {
          const violation: CORSError = {
            code: 'CORS_FETCH_ERROR',
            message: 'Fetch request blocked, possibly by CORS',
            origin: window.location.origin,
            timestamp: new Date().toISOString()
          }
          setViolations(prev => [...prev, violation])
        }
        
        return response
      } catch (error) {
        if (error instanceof Error && error.message.includes('CORS')) {
          const violation: CORSError = {
            code: 'CORS_FETCH_EXCEPTION',
            message: error.message,
            origin: window.location.origin,
            timestamp: new Date().toISOString()
          }
          setViolations(prev => [...prev, violation])
        }
        throw error
      }
    }

    document.addEventListener('securitypolicyviolation', handleSecurityPolicyViolation)

    return () => {
      document.removeEventListener('securitypolicyviolation', handleSecurityPolicyViolation)
      window.fetch = originalFetch
    }
  }, [])

  const clearViolations = () => {
    setViolations([])
  }

  return {
    violations,
    clearViolations,
    violationCount: violations.length
  }
}