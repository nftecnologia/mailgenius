import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardLayout from '../DashboardLayout'
import { useSupabaseAuth } from '@/lib/hooks/useSupabaseAuth'

// Mock dependencies
jest.mock('@/lib/hooks/useSupabaseAuth')
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}))

const mockUseSupabaseAuth = useSupabaseAuth as jest.MockedFunction<typeof useSupabaseAuth>

describe('DashboardLayout', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: { name: 'Test User' },
    workspaceId: 'workspace-123',
    workspaceName: 'Test Workspace',
    role: 'owner',
  }

  const mockSession = {
    user: mockUser,
    access_token: 'token-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseSupabaseAuth.mockReturnValue({
      user: mockUser,
      session: mockSession,
      loading: false,
      error: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      isAuthenticated: true,
      workspaceId: 'workspace-123',
    })
  })

  it('renders dashboard layout for authenticated user', () => {
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
    expect(screen.getByText('Test Workspace')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockUseSupabaseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      error: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      isAuthenticated: false,
      workspaceId: null,
    })
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('redirects unauthenticated users', () => {
    mockUseSupabaseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      error: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      isAuthenticated: false,
      workspaceId: null,
    })
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Redirecionando...')).toBeInTheDocument()
  })

  it('displays navigation menu', () => {
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Leads')).toBeInTheDocument()
    expect(screen.getByText('Campanhas')).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Automações')).toBeInTheDocument()
    expect(screen.getByText('Testes A/B')).toBeInTheDocument()
  })

  it('highlights active navigation item', () => {
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    const dashboardLink = screen.getByText('Dashboard')
    expect(dashboardLink.closest('a')).toHaveClass('bg-blue-50') // Assuming active state styling
  })

  it('shows user profile menu', async () => {
    const user = userEvent.setup()
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    const userAvatar = screen.getByAltText('User Avatar')
    await user.click(userAvatar)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(screen.getByText('Sair')).toBeInTheDocument()
  })

  it('handles user sign out', async () => {
    const user = userEvent.setup()
    const mockSignOut = jest.fn()
    
    mockUseSupabaseAuth.mockReturnValue({
      user: mockUser,
      session: mockSession,
      loading: false,
      error: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: mockSignOut,
      isAuthenticated: true,
      workspaceId: 'workspace-123',
    })
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    const userAvatar = screen.getByAltText('User Avatar')
    await user.click(userAvatar)
    
    const signOutButton = screen.getByText('Sair')
    await user.click(signOutButton)
    
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('shows workspace selector', () => {
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Test Workspace')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
  })

  it('handles mobile menu toggle', async () => {
    const user = userEvent.setup()
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    const mobileMenuButton = screen.getByLabelText('Toggle menu')
    await user.click(mobileMenuButton)
    
    // Menu should be visible on mobile
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
  })

  it('shows notifications indicator', () => {
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
  })

  it('handles error state', () => {
    mockUseSupabaseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      error: 'Authentication failed',
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      isAuthenticated: false,
      workspaceId: null,
    })
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Erro na autenticação')).toBeInTheDocument()
  })

  it('shows breadcrumbs', () => {
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup()
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    // Tab through navigation items
    await user.tab()
    expect(screen.getByText('Dashboard')).toHaveFocus()
    
    await user.tab()
    expect(screen.getByText('Leads')).toHaveFocus()
  })

  it('shows role-based navigation', () => {
    // Test with admin role
    mockUseSupabaseAuth.mockReturnValue({
      user: { ...mockUser, role: 'admin' },
      session: mockSession,
      loading: false,
      error: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      isAuthenticated: true,
      workspaceId: 'workspace-123',
    })
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(screen.getByText('Usuários')).toBeInTheDocument()
  })

  it('hides admin features for non-admin users', () => {
    // Test with member role
    mockUseSupabaseAuth.mockReturnValue({
      user: { ...mockUser, role: 'member' },
      session: mockSession,
      loading: false,
      error: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      isAuthenticated: true,
      workspaceId: 'workspace-123',
    })
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.queryByText('Usuários')).not.toBeInTheDocument()
  })

  it('shows workspace upgrade notice for free plan', () => {
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    expect(screen.getByText('Upgrade')).toBeInTheDocument()
  })

  it('handles search functionality', async () => {
    const user = userEvent.setup()
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    const searchInput = screen.getByPlaceholderText('Buscar...')
    await user.type(searchInput, 'test search')
    
    expect(searchInput).toHaveValue('test search')
  })

  it('shows quick actions menu', async () => {
    const user = userEvent.setup()
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    const quickActionsButton = screen.getByText('Novo')
    await user.click(quickActionsButton)
    
    expect(screen.getByText('Nova Campanha')).toBeInTheDocument()
    expect(screen.getByText('Novo Template')).toBeInTheDocument()
    expect(screen.getByText('Importar Leads')).toBeInTheDocument()
  })

  it('displays correct layout for different screen sizes', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    })
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    // Should show collapsed sidebar on mobile
    expect(screen.getByTestId('sidebar')).toHaveClass('lg:w-64 w-16')
  })

  it('handles theme toggle', async () => {
    const user = userEvent.setup()
    
    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    )
    
    const themeToggle = screen.getByLabelText('Toggle theme')
    await user.click(themeToggle)
    
    // Should toggle between light and dark mode
    expect(document.documentElement).toHaveClass('dark')
  })

  it('preserves scroll position on navigation', async () => {
    const user = userEvent.setup()
    
    render(
      <DashboardLayout>
        <div style={{ height: '2000px' }}>Long Content</div>
      </DashboardLayout>
    )
    
    // Scroll down
    window.scrollTo(0, 500)
    
    // Navigate to another page
    const campaignsLink = screen.getByText('Campanhas')
    await user.click(campaignsLink)
    
    // Should maintain scroll position
    expect(window.scrollY).toBe(500)
  })
})