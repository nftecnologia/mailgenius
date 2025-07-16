import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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

    console.log('🔍 Initializing Supabase auth...')

    // Get initial session only after hydration
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('❌ Error getting session:', error)
          setError(error.message)
        } else {
          console.log('📝 Initial session:', session ? '✅ Found' : '❌ None')
          setSession(session)

          if (session?.user) {
            await loadUserWorkspace(session.user)
          }
        }
      } catch (error) {
        console.error('❌ Error in getInitialSession:', error)
        setError('Erro ao verificar sessão')
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session ? '✅ Session' : '❌ No session')

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
      console.log('🔄 Loading user workspace for:', authUser.email)

      // First, check if user exists in our users table
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      // If user doesn't exist, create them
      if (userError && userError.code === 'PGRST116') {
        console.log('👤 Creating new user record...')

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
      console.log('✅ User workspace loaded:', enhancedUser.workspaceName)

    } catch (error) {
      console.error('❌ Error loading user workspace:', error)
      setError('Erro ao carregar dados do usuário')

      // Set basic user info even if workspace loading fails
      setUser(authUser as AuthUser)
    }
  }

  // Create default workspace for new users
  const createDefaultWorkspace = async (userId: string, userName: string) => {
    try {
      console.log('🏢 Creating default workspace for user...')

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

      console.log('✅ Default workspace created:', workspace.name)
      return workspace

    } catch (error) {
      console.error('❌ Error creating default workspace:', error)
      throw error
    }
  }

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔐 Signing in user:', email)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      console.log('✅ Sign in successful')
      return { user: data.user, session: data.session }

    } catch (error: any) {
      console.error('❌ Sign in error:', error)
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

      console.log('📝 Signing up user:', email)

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

      console.log('✅ Sign up successful')
      return { user: data.user, session: data.session }

    } catch (error: any) {
      console.error('❌ Sign up error:', error)
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
      console.log('🚪 Signing out user...')

      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setUser(null)
      setSession(null)
      console.log('✅ Sign out successful')

    } catch (error: any) {
      console.error('❌ Sign out error:', error)
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
