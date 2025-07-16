import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { RateLimitHelper } from '@/lib/rate-limit-helpers'
import { logger } from '@/lib/logger'
import { metricsCollector } from '@/lib/monitoring/metrics'
import { rateLimitMonitoringMiddleware } from '@/lib/monitoring/middleware'

export async function middleware(req: NextRequest) {
  const startTime = Date.now()
  const res = NextResponse.next()
  const { pathname } = req.nextUrl
  const method = req.method
  const context = logger.createRequestContext(req)

  console.log(`🔍 Middleware: ${pathname}`)

  // Apply rate limiting to specific route patterns
  if (pathname.startsWith('/api/public')) {
    const rateLimitInfo = await RateLimitHelper.checkPublicAPILimit(req)
    
    // Record rate limit metrics
    await rateLimitMonitoringMiddleware(req, rateLimitInfo.allowed, 100, Date.now() + 60000)
    
    if (!rateLimitInfo.allowed) {
      // Record blocked request metrics
      await metricsCollector.recordApiMetrics(pathname, method, 429, Date.now() - startTime)
      
      return new NextResponse(JSON.stringify({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitInfo.headers
        }
      })
    }
  }

  if (pathname.startsWith('/api/webhooks')) {
    const rateLimitInfo = await RateLimitHelper.checkWebhookLimit(req)
    
    // Record rate limit metrics
    await rateLimitMonitoringMiddleware(req, rateLimitInfo.allowed, 100, Date.now() + 60000)
    
    if (!rateLimitInfo.allowed) {
      // Record blocked request metrics
      await metricsCollector.recordApiMetrics(pathname, method, 429, Date.now() - startTime)
      
      return new NextResponse(JSON.stringify({
        error: 'Webhook rate limit exceeded',
        code: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitInfo.headers
        }
      })
    }
  }

  // Public routes and auth routes - always allow
  const publicRoutes = ['/', '/pricing', '/features', '/about', '/admin/setup', '/admin/fix-rls']
  const authRoutes = ['/auth', '/auth/callback']

  if (publicRoutes.includes(pathname) || authRoutes.includes(pathname)) {
    console.log(`🌐 Middleware: Public/auth route, allowing: ${pathname}`)
    return res
  }

  // For dashboard routes, check authentication
  if (pathname.startsWith('/dashboard')) {
    try {
      const supabase = createMiddlewareClient({ req, res })

      // Refresh session to ensure it's valid
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        logger.error('Error getting session in middleware', context, error)
      }

      const hasSession = !!session
      logger.info(`Session check result: ${hasSession ? 'valid' : 'invalid'}`, {
        ...context,
        userId: session?.user?.id
      })

      // If has Supabase session, allow access
      if (session) {
        logger.info(`Valid session, allowing access`, {
          ...context,
          userId: session.user.id
        })

        // Important: Return the response with the refreshed session
        return res
      }

      // If no Supabase session, redirect to auth
      logger.warn(`No valid session, redirecting to auth`, context)
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth'
      redirectUrl.searchParams.set('redirectedFrom', pathname)
      return NextResponse.redirect(redirectUrl)

    } catch (error) {
      logger.error('Middleware error, redirecting to auth', context, error as Error)

      // In case of error, redirect to auth
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth'
      redirectUrl.searchParams.set('error', 'auth_error')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // For other protected routes, apply same logic
  logger.info(`Allowing access to route`, context)
  
  // Record successful request metrics
  const duration = Date.now() - startTime
  await metricsCollector.recordApiMetrics(pathname, method, 200, duration)
  
  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}