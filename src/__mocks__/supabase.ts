import { User, Session } from '@supabase/supabase-js'

// Mock User
export const mockUser: User = {
  id: 'user-123',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  phone: null,
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {
    name: 'Test User',
  },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
}

// Mock Session
export const mockSession: Session = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() + 3600000,
  token_type: 'bearer',
  user: mockUser,
}

// Mock Workspace
export const mockWorkspace = {
  id: 'workspace-123',
  name: 'Test Workspace',
  slug: 'test-workspace',
  plan: 'starter',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  settings: {},
}

// Mock Workspace Member
export const mockWorkspaceMember = {
  id: 'member-123',
  workspace_id: 'workspace-123',
  user_id: 'user-123',
  role: 'owner',
  status: 'active',
  joined_at: new Date().toISOString(),
  workspaces: mockWorkspace,
}

// Mock Lead
export const mockLead = {
  id: 'lead-123',
  workspace_id: 'workspace-123',
  email: 'lead@example.com',
  name: 'Test Lead',
  status: 'active',
  source: 'manual',
  tags: ['test'],
  custom_fields: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Mock Campaign
export const mockCampaign = {
  id: 'campaign-123',
  workspace_id: 'workspace-123',
  name: 'Test Campaign',
  subject: 'Test Subject',
  content: '<p>Test content</p>',
  status: 'draft',
  send_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  template_id: null,
  settings: {},
}

// Mock Template
export const mockTemplate = {
  id: 'template-123',
  workspace_id: 'workspace-123',
  name: 'Test Template',
  content: '<p>Test template</p>',
  variables: ['name', 'email'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Mock Supabase Client
export const createMockSupabaseClient = () => ({
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: mockSession },
      error: null,
    }),
    signInWithPassword: jest.fn().mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    }),
    signUp: jest.fn().mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    }),
    signOut: jest.fn().mockResolvedValue({
      error: null,
    }),
    signInWithOAuth: jest.fn().mockResolvedValue({
      data: { provider: 'google', url: 'https://google.com' },
      error: null,
    }),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    }),
  },
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: mockUser,
      error: null,
    }),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: jest.fn().mockResolvedValue({
      data: [mockUser],
      error: null,
    }),
  }),
  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      }),
      download: jest.fn().mockResolvedValue({
        data: new Blob(['test']),
        error: null,
      }),
      remove: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }),
  },
})

export const mockSupabaseClient = createMockSupabaseClient()