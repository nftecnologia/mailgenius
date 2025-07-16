import { NextRequest, NextResponse } from 'next/server'
import { healthChecker } from '@/lib/monitoring/health-check'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const searchParams = request.nextUrl.searchParams
    const quick = searchParams.get('quick') === 'true'
    
    if (quick) {
      // Quick health check for load balancers
      const quickCheck = await healthChecker.quickHealthCheck()
      
      logger.info('Quick health check completed', {
        ...requestContext,
        duration: Date.now() - startTime,
        metadata: quickCheck
      })
      
      return NextResponse.json(quickCheck, {
        status: quickCheck.status === 'ok' ? 200 : 503
      })
    }

    // Full health check
    const healthReport = await healthChecker.performFullHealthCheck()
    
    const statusCode = healthReport.overall === 'healthy' ? 200 : 
                      healthReport.overall === 'degraded' ? 200 : 503
    
    logger.info('Full health check completed', {
      ...requestContext,
      duration: Date.now() - startTime,
      statusCode,
      metadata: {
        overall: healthReport.overall,
        services: healthReport.services.length,
        uptime: healthReport.uptime
      }
    })
    
    return NextResponse.json(healthReport, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Health check failed', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      overall: 'unhealthy',
      error: errorMessage,
      timestamp: Date.now()
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}