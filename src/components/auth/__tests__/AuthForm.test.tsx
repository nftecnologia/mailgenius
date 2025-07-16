import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import AuthForm from '../AuthForm'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@supabase/auth-helpers-nextjs')

const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    signInWithOAuth: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
}

describe('AuthForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClientComponentClient as jest.Mock).mockReturnValue(mockSupabase)
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        replace: jest.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initial render', () => {
    it('renders login form by default', () => {
      render(<AuthForm />)
      
      expect(screen.getByRole('tab', { name: 'Entrar' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Cadastrar' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('********')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    })

    it('shows demo mode warning when Supabase is not configured', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'placeholder'
      
      render(<AuthForm />)
      
      expect(screen.getByText(/Sistema em modo de demonstração/)).toBeInTheDocument()
    })

    it('renders EmailSend branding', () => {
      render(<AuthForm />)
      
      expect(screen.getByText('EmailSend')).toBeInTheDocument()
      expect(screen.getByText('Plataforma inteligente de Email Marketing')).toBeInTheDocument()
    })
  })

  describe('Sign In functionality', () => {
    it('handles successful login', async () => {
      const user = userEvent.setup()
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })
      
      render(<AuthForm />)
      
      await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('********'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      
      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        })
      })
    })

    it('handles login error', async () => {
      const user = userEvent.setup()
      const mockError = { message: 'Invalid credentials' }
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      })
      
      render(<AuthForm />)
      
      await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('********'), 'wrongpassword')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Erro no login: Invalid credentials')
      })
    })

    it('shows demo mode error when Supabase is not configured', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'placeholder'
      const user = userEvent.setup()
      
      render(<AuthForm />)
      
      await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('********'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Sistema em modo de demonstração. Configure o Supabase para usar autenticação real.'
        )
      })
    })

    it('disables button while loading', async () => {
      const user = userEvent.setup()
      
      // Mock a delayed response
      mockSupabase.auth.signInWithPassword.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 100))
      )
      
      render(<AuthForm />)
      
      await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('********'), 'password123')
      
      const button = screen.getByRole('button', { name: 'Entrar' })
      await user.click(button)
      
      expect(button).toBeDisabled()
      expect(screen.getByText('Entrando...')).toBeInTheDocument()
    })
  })

  describe('Sign Up functionality', () => {
    it('switches to signup tab', async () => {
      const user = userEvent.setup()
      
      render(<AuthForm />)
      
      await user.click(screen.getByRole('tab', { name: 'Cadastrar' }))
      
      expect(screen.getByPlaceholderText('Seu nome')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Nome da sua empresa')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument()
    })

    it('handles successful signup', async () => {
      const user = userEvent.setup()
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })
      
      render(<AuthForm />)
      
      await user.click(screen.getByRole('tab', { name: 'Cadastrar' }))
      await user.type(screen.getByPlaceholderText('Seu nome'), 'Test User')
      await user.type(screen.getByPlaceholderText('Nome da sua empresa'), 'Test Company')
      await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('********'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Criar conta' }))
      
      await waitFor(() => {
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          options: {
            data: {
              name: 'Test User',
              workspace_name: 'Test Company',
            },
          },
        })
      })
    })

    it('validates required fields', async () => {
      const user = userEvent.setup()
      
      render(<AuthForm />)
      
      await user.click(screen.getByRole('tab', { name: 'Cadastrar' }))
      await user.click(screen.getByRole('button', { name: 'Criar conta' }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Preencha todos os campos obrigatórios')
      })
    })

    it('handles signup error', async () => {
      const user = userEvent.setup()
      const mockError = { message: 'Email already exists' }
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      })
      
      render(<AuthForm />)
      
      await user.click(screen.getByRole('tab', { name: 'Cadastrar' }))
      await user.type(screen.getByPlaceholderText('Seu nome'), 'Test User')
      await user.type(screen.getByPlaceholderText('Nome da sua empresa'), 'Test Company')
      await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('********'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Criar conta' }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Erro no cadastro: Email already exists')
      })
    })
  })

  describe('Google OAuth', () => {
    it('handles Google authentication', async () => {
      const user = userEvent.setup()
      
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { provider: 'google', url: 'https://google.com' },
        error: null,
      })
      
      render(<AuthForm />)
      
      await user.click(screen.getByRole('button', { name: 'Google' }))
      
      await waitFor(() => {
        expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: 'http://localhost:3000/auth/callback',
          },
        })
      })
    })

    it('handles Google authentication error', async () => {
      const user = userEvent.setup()
      const mockError = { message: 'OAuth error' }
      
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: null,
        error: mockError,
      })
      
      render(<AuthForm />)
      
      await user.click(screen.getByRole('button', { name: 'Google' }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Erro na autenticação: OAuth error')
      })
    })
  })

  describe('Session management', () => {
    it('redirects to dashboard if session exists', async () => {
      const mockSession = { user: { id: 'user-123' }, access_token: 'token-123' }
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })
      
      render(<AuthForm />)
      
      await waitFor(() => {
        expect(window.location.replace).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('handles auth state changes', async () => {
      const mockUser = { id: 'user-123' }
      const mockSession = { user: mockUser, access_token: 'token-123' }
      
      let authStateChangeCallback: (event: string, session: any) => void
      
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateChangeCallback = callback
        return { data: { subscription: { unsubscribe: jest.fn() } } }
      })
      
      render(<AuthForm />)
      
      // Simulate SIGNED_IN event
      authStateChangeCallback('SIGNED_IN', mockSession)
      
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Autenticação realizada com sucesso!')
      })
    })
  })

  describe('Input validation', () => {
    it('updates email field correctly', async () => {
      const user = userEvent.setup()
      
      render(<AuthForm />)
      
      const emailInput = screen.getByPlaceholderText('seu@email.com')
      await user.type(emailInput, 'test@example.com')
      
      expect(emailInput).toHaveValue('test@example.com')
    })

    it('updates password field correctly', async () => {
      const user = userEvent.setup()
      
      render(<AuthForm />)
      
      const passwordInput = screen.getByPlaceholderText('********')
      await user.type(passwordInput, 'password123')
      
      expect(passwordInput).toHaveValue('password123')
    })

    it('updates name field correctly in signup', async () => {
      const user = userEvent.setup()
      
      render(<AuthForm />)
      
      await user.click(screen.getByRole('tab', { name: 'Cadastrar' }))
      
      const nameInput = screen.getByPlaceholderText('Seu nome')
      await user.type(nameInput, 'Test User')
      
      expect(nameInput).toHaveValue('Test User')
    })
  })

  describe('Error handling', () => {
    it('handles unexpected errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'))
      
      render(<AuthForm />)
      
      await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('********'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Erro inesperado no login')
      })
    })

    it('clears loading state after error', async () => {
      const user = userEvent.setup()
      
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'))
      
      render(<AuthForm />)
      
      await user.type(screen.getByPlaceholderText('seu@email.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('********'), 'password123')
      await user.click(screen.getByRole('button', { name: 'Entrar' }))
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Entrar' })).not.toBeDisabled()
      })
    })
  })
})