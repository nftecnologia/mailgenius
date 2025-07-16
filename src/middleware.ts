import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  console.log(`🔍 Middleware: ${pathname}`)

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
        console.error('❌ Middleware: Error getting session:', error)
      }

      console.log(`📍 Middleware: ${pathname} | Supabase Session: ${session ? '✅ YES' : '❌ NO'}`)

      if (session) {
        console.log(`🔐 Session user: ${session.user.email}`)
      }

      // If has Supabase session, allow access
      if (session) {
        console.log(`✅ Middleware: Valid Supabase session, allowing access to ${pathname}`)

        // Important: Return the response with the refreshed session
        return res
      }

      // If no Supabase session, redirect to auth
      console.log(`🚫 Middleware: No valid session, redirecting ${pathname} → /auth`)
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth'
      redirectUrl.searchParams.set('redirectedFrom', pathname)
      return NextResponse.redirect(redirectUrl)

    } catch (error) {
      console.error('❌ Middleware error:', error)

      // In case of error, redirect to auth
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth'
      redirectUrl.searchParams.set('error', 'auth_error')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // For other protected routes, apply same logic
  console.log(`✅ Middleware: Allowing access to ${pathname}`)
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
