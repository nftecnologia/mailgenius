import { NextRequest, NextResponse } from 'next/server'
import { corsConfig } from '@/lib/cors-config'
import { corsManager } from '@/lib/cors'

/**
 * Endpoint para fornecer informações de CORS
 */
export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get('origin')
    const allowedDomains = corsConfig.getAllowedDomains()
    const corsConfiguration = corsConfig.getCORSConfig()
    const securityConfig = corsConfig.getSecurityConfig()
    
    const response = {
      success: true,
      data: {
        allowedOrigins: allowedDomains,
        currentOrigin: origin,
        isAllowed: origin ? allowedDomains.includes(origin) : false,
        corsEnabled: true,
        environment: process.env.NODE_ENV,
        configuration: corsConfiguration,
        security: securityConfig,
        stats: corsConfig.getStats()
      },
      timestamp: new Date().toISOString()
    }

    return corsManager.createCORSResponse(response, 200, request)
  } catch (error) {
    console.error('CORS info endpoint error:', error)
    
    return corsManager.createCORSResponse({
      success: false,
      error: {
        message: 'Failed to retrieve CORS information',
        code: 'CORS_INFO_ERROR'
      }
    }, 500, request)
  }
}

/**
 * Endpoint para validar origem específica
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { origin: targetOrigin } = body
    
    if (!targetOrigin) {
      return corsManager.createCORSResponse({
        success: false,
        error: {
          message: 'Origin is required',
          code: 'ORIGIN_REQUIRED'
        }
      }, 400, request)
    }

    const allowedDomains = corsConfig.getAllowedDomains()
    const isAllowed = allowedDomains.includes(targetOrigin)
    
    const response = {
      success: true,
      data: {
        origin: targetOrigin,
        isAllowed,
        environment: process.env.NODE_ENV,
        allowedDomains,
        validationTimestamp: new Date().toISOString()
      }
    }

    return corsManager.createCORSResponse(response, 200, request)
  } catch (error) {
    console.error('CORS validation endpoint error:', error)
    
    return corsManager.createCORSResponse({
      success: false,
      error: {
        message: 'Failed to validate origin',
        code: 'CORS_VALIDATION_ERROR'
      }
    }, 500, request)
  }
}

/**
 * Endpoint para debug de CORS
 */
export async function PUT(request: NextRequest) {
  try {
    const requestOrigin = request.headers.get('origin')
    const userAgent = request.headers.get('user-agent')
    const referer = request.headers.get('referer')
    
    const debugInfo = {
      request: {
        origin: requestOrigin,
        userAgent,
        referer,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
      },
      cors: {
        allowedDomains: corsConfig.getAllowedDomains(),
        configuration: corsConfig.getCORSConfig(),
        security: corsConfig.getSecurityConfig(),
        validation: corsConfig.validateConfig()
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    }

    return corsManager.createCORSResponse({
      success: true,
      data: debugInfo
    }, 200, request)
  } catch (error) {
    console.error('CORS debug endpoint error:', error)
    
    return corsManager.createCORSResponse({
      success: false,
      error: {
        message: 'Failed to generate debug information',
        code: 'CORS_DEBUG_ERROR'
      }
    }, 500, request)
  }
}

/**
 * Endpoint para health check com CORS
 */
export async function OPTIONS(request: NextRequest) {
  return corsManager.createCORSResponse({
    success: true,
    data: {
      message: 'CORS preflight successful',
      timestamp: new Date().toISOString()
    }
  }, 200, request)
}