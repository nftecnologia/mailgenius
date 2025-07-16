import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { authSchemas } from '@/lib/validation'
import { createValidatedHandler } from '@/lib/validation/middleware'
import { RateLimitHelper } from '@/lib/rate-limit-helpers'

export const GET = createValidatedHandler(
  { query: authSchemas.oauthCallback },
  async (request: NextRequest, { query }) => {
    // Check rate limiting for auth attempts
    const rateLimitInfo = await RateLimitHelper.checkAuthRateLimit(request)
    if (!rateLimitInfo.allowed) {
      return new NextResponse('Too many authentication attempts', { 
        status: 429,
        headers: rateLimitInfo.headers
      })
    }

    const requestUrl = new URL(request.url)
    const { code, error: authError } = query

    if (authError) {
      // Handle OAuth error
      return NextResponse.redirect(requestUrl.origin + '/auth?error=' + encodeURIComponent(authError))
    }

    if (code) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error && data.user) {
        // Check if user already has a workspace
        const { data: existingMember } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', data.user.id)
          .single()

        // If no workspace, create one for the user
        if (!existingMember) {
          const workspaceName = data.user.user_metadata?.workspace_name ||
                               data.user.user_metadata?.name + "'s Workspace" ||
                               'My Workspace'

          const workspaceSlug = workspaceName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substr(2, 6)

          // Create workspace
          const { data: workspace, error: workspaceError } = await supabase
            .from('workspaces')
            .insert({
              name: workspaceName,
              slug: workspaceSlug,
            })
            .select()
            .single()

          if (!workspaceError && workspace) {
            // Create user record
            await supabase
              .from('users')
              .upsert({
                id: data.user.id,
                email: data.user.email!,
                name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
                avatar_url: data.user.user_metadata?.avatar_url,
              })

            // Add user as admin of the workspace
            await supabase
              .from('workspace_members')
              .insert({
                workspace_id: workspace.id,
                user_id: data.user.id,
                role: 'admin',
                status: 'active',
                joined_at: new Date().toISOString(),
              })
          }
        }
      }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(requestUrl.origin + '/dashboard')
  }
)
