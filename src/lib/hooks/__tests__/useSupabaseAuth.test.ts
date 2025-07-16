import { renderHook, waitFor } from '@testing-library/react'
import { useSupabaseAuth } from '../useSupabaseAuth'
import { supabase } from '@/lib/supabase'

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    auth: jest.fn(),
  },
}))

const mockSupabase = supabase as jest.Mocked<typeof supabase>

describe('useSupabaseAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementations
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })
    
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    } as any)
  })

  describe('initialization', () => {
    it('initializes with loading state', () => {
      const { result } = renderHook(() => useSupabaseAuth())
      
      expect(result.current.loading).toBe(true)
      expect(result.current.user).toBe(null)
      expect(result.current.session).toBe(null)
      expect(result.current.error).toBe(null)
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('sets up auth state listener', () => {
      renderHook(() => useSupabaseAuth())
      
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled()
    })

    it('gets initial session', async () => {
      renderHook(() => useSupabaseAuth())
      
      await waitFor(() => {
        expect(mockSupabase.auth.getSession).toHaveBeenCalled()
      })
    })
  })

  describe('session management', () => {
    it('handles existing session', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })
      
      // Mock user and workspace data
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'user-123', name: 'Test User' },
          error: null,
        }),
      } as any)
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.session).toEqual(mockSession)
        expect(result.current.isAuthenticated).toBe(true)
      })
    })

    it('handles session error', async () => {
      const mockError = { message: 'Session error' }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: mockError,
      })
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBe('Session error')
      })
    })
  })

  describe('signIn', () => {
    it('successfully signs in user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      const signInResult = await result.current.signIn('test@example.com', 'password123')
      
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(signInResult).toEqual({ user: mockUser, session: mockSession })
    })

    it('handles sign in error', async () => {
      const mockError = { message: 'Invalid credentials' }
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      })
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await expect(result.current.signIn('test@example.com', 'wrongpassword')).rejects.toThrow()
      
      await waitFor(() => {
        expect(result.current.error).toBe('Invalid credentials')
      })
    })

    it('sets loading state during sign in', async () => {
      let resolveSignIn: (value: any) => void
      const signInPromise = new Promise((resolve) => {
        resolveSignIn = resolve
      })
      
      mockSupabase.auth.signInWithPassword.mockReturnValue(signInPromise)
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      // Start sign in
      result.current.signIn('test@example.com', 'password123')
      
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })
      
      // Resolve sign in
      resolveSignIn!({ data: { user: null, session: null }, error: null })
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('signUp', () => {
    it('successfully signs up user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      const signUpResult = await result.current.signUp('test@example.com', 'password123', 'Test User')
      
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            name: 'Test User',
          },
        },
      })
      expect(signUpResult).toEqual({ user: mockUser, session: mockSession })
    })

    it('handles sign up error', async () => {
      const mockError = { message: 'Email already exists' }
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      })
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await expect(result.current.signUp('test@example.com', 'password123', 'Test User')).rejects.toThrow()
      
      await waitFor(() => {
        expect(result.current.error).toBe('Email already exists')
      })
    })
  })

  describe('signOut', () => {
    it('successfully signs out user', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null })
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await result.current.signOut()
      
      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
      expect(result.current.user).toBe(null)
      expect(result.current.session).toBe(null)
    })

    it('handles sign out error', async () => {
      const mockError = { message: 'Sign out failed' }
      
      mockSupabase.auth.signOut.mockResolvedValue({ error: mockError })
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await expect(result.current.signOut()).rejects.toThrow()
      
      await waitFor(() => {
        expect(result.current.error).toBe('Sign out failed')
      })
    })
  })

  describe('user workspace loading', () => {
    it('creates user record if not exists', async () => {
      const mockUser = { 
        id: 'user-123', 
        email: 'test@example.com',
        user_metadata: { name: 'Test User' }
      }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })
      
      // Mock user not found, then created
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // User not found
          .mockResolvedValueOnce({ data: { id: 'user-123', name: 'Test User' }, error: null }) // User created
          .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }), // Workspace membership not found
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.user).toBeTruthy()
      })
      
      // Verify user was created
      expect(mockFrom.insert).toHaveBeenCalled()
    })

    it('loads existing workspace membership', async () => {
      const mockUser = { 
        id: 'user-123', 
        email: 'test@example.com',
        user_metadata: { name: 'Test User' }
      }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      const mockWorkspace = { id: 'workspace-123', name: 'Test Workspace' }
      const mockMembership = {
        workspace_id: 'workspace-123',
        role: 'owner',
        workspaces: mockWorkspace,
      }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })
      
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: { id: 'user-123', name: 'Test User' }, error: null }) // User found
          .mockResolvedValueOnce({ data: mockMembership, error: null }), // Membership found
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.user?.workspaceId).toBe('workspace-123')
        expect(result.current.user?.workspaceName).toBe('Test Workspace')
        expect(result.current.user?.role).toBe('owner')
        expect(result.current.workspaceId).toBe('workspace-123')
      })
    })
  })

  describe('auth state changes', () => {
    it('handles SIGNED_IN event', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      let authStateCallback: (event: string, session: any) => void
      
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: jest.fn() } } }
      })
      
      // Mock workspace loading
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'user-123', name: 'Test User' },
          error: null,
        }),
      } as any)
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      // Simulate SIGNED_IN event
      authStateCallback!('SIGNED_IN', mockSession)
      
      await waitFor(() => {
        expect(result.current.session).toEqual(mockSession)
        expect(result.current.isAuthenticated).toBe(true)
      })
    })

    it('handles SIGNED_OUT event', async () => {
      let authStateCallback: (event: string, session: any) => void
      
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: jest.fn() } } }
      })
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      // Simulate SIGNED_OUT event
      authStateCallback!('SIGNED_OUT', null)
      
      await waitFor(() => {
        expect(result.current.session).toBe(null)
        expect(result.current.user).toBe(null)
        expect(result.current.isAuthenticated).toBe(false)
      })
    })
  })

  describe('error handling', () => {
    it('handles workspace creation error gracefully', async () => {
      const mockUser = { 
        id: 'user-123', 
        email: 'test@example.com',
        user_metadata: { name: 'Test User' }
      }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })
      
      // Mock user creation success, workspace creation failure
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // User not found
          .mockResolvedValueOnce({ data: { id: 'user-123', name: 'Test User' }, error: null }) // User created
          .mockRejectedValue(new Error('Workspace creation failed')), // Workspace creation error
      }
      
      mockSupabase.from.mockReturnValue(mockFrom as any)
      
      const { result } = renderHook(() => useSupabaseAuth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBe('Erro ao carregar dados do usuário')
        expect(result.current.user).toBeTruthy() // Should still set basic user info
      })
    })
  })

  describe('cleanup', () => {
    it('unsubscribes from auth state changes on unmount', () => {
      const mockUnsubscribe = jest.fn()
      
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      })
      
      const { unmount } = renderHook(() => useSupabaseAuth())
      
      unmount()
      
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })
})