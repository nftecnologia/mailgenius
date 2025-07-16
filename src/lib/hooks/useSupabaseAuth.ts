import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { User, Session } from '@supabase/supabase-js'

interface AuthUser extends User {
  workspaceId?: string
  workspaceName?: string
  role?: string
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // Initialize auth state
  useEffect(() => {
    setIsHydrated(true)

    logger.info('Initializing Supabase auth')

    // Get initial session only after hydration
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          logger.error('Error getting initial session', {}, error)
          setError(error.message)
        } else {
          logger.info(`Initial session: ${session ? 'found' : 'none'}`)
          setSession(session)

          if (session?.user) {
            await loadUserWorkspace(session.user)
          }
        }
      } catch (error) {
        logger.error('Error in getInitialSession', {}, error as Error)
        setError('Erro ao verificar sessão')
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.info(`Auth state changed: ${event}`, { metadata: { hasSession: !!session } })

        setSession(session)
        setError(null)

        if (session?.user) {
          await loadUserWorkspace(session.user)
        } else {
          setUser(null)
        }

        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Load user's workspace information
  const loadUserWorkspace = async (authUser: User) => {
    try {
      logger.info('Loading user workspace', { userId: authUser.id })

      // First, check if user exists in our users table
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      // If user doesn't exist, create them
      if (userError && userError.code === 'PGRST116') {
        logger.info('Creating new user record', { userId: authUser.id })

        const newUser = {
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
          avatar_url: authUser.user_metadata?.avatar_url || null
        }

        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert(newUser)
          .select()
          .single()

        if (createError) throw createError
        userData = createdUser

        // Create a default workspace for new users
        await createDefaultWorkspace(authUser.id, userData.name)
      } else if (userError) {
        throw userError
      }

      // Get user's workspace membership
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select(`
          *,
          workspaces:workspace_id (
            id,
            name,
            slug,
            plan
          )
        `)
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .single()

      if (membershipError && membershipError.code !== 'PGRST116') {
        throw membershipError
      }

      const enhancedUser: AuthUser = {
        ...authUser,
        workspaceId: membership?.workspace_id || null,
        workspaceName: membership?.workspaces?.name || null,
        role: membership?.role || 'member'
      }

      setUser(enhancedUser)
      logger.info('User workspace loaded', { userId: authUser.id, workspaceId: enhancedUser.workspaceId })

    } catch (error) {
      logger.error('Error loading user workspace', { userId: authUser.id }, error as Error)
      setError('Erro ao carregar dados do usuário')

      // Set basic user info even if workspace loading fails
      setUser(authUser as AuthUser)
    }
  }

  // Create default workspace for new users
  const createDefaultWorkspace = async (userId: string, userName: string) => {
    try {
      logger.info('Creating default workspace', { userId })

      const workspaceName = `Workspace de ${userName}`
      const workspaceSlug = `workspace-${userId.slice(0, 8)}`

      // Create workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: workspaceName,
          slug: workspaceSlug,
          plan: 'starter',
          settings: {}
        })
        .select()
        .single()

      if (workspaceError) throw workspaceError

      // Add user as owner of the workspace
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString()
        })

      if (membershipError) throw membershipError

      logger.info('Default workspace created', { userId, workspaceId: workspace.id })
      return workspace

    } catch (error) {
      logger.error('Error creating default workspace', { userId }, error as Error)
      throw error
    }
  }

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)

      logger.auth('Sign in attempt', undefined, { email })

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      logger.auth('Sign in successful', data.user?.id)
      return { user: data.user, session: data.session }

    } catch (error: any) {
      logger.error('Sign in error', { metadata: { email } }, error)
      setError(error.message || 'Erro no login')
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Sign up with email and password
  const signUp = async (email: string, password: string, name: string) => {
    try {
      setLoading(true)
      setError(null)

      logger.auth('Sign up attempt', undefined, { email })

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name
          }
        }
      })

      if (error) throw error

      logger.auth('Sign up successful', data.user?.id)
      return { user: data.user, session: data.session }

    } catch (error: any) {
      logger.error('Sign up error', { metadata: { email } }, error)
      setError(error.message || 'Erro no cadastro')
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true)
      logger.auth('Sign out attempt', user?.id)

      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setUser(null)
      setSession(null)
      logger.auth('Sign out successful', user?.id)

    } catch (error: any) {
      logger.error('Sign out error', { userId: user?.id }, error)
      setError(error.message || 'Erro no logout')
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    isAuthenticated: isHydrated && !!session,
    workspaceId: user?.workspaceId || null
  }
}
