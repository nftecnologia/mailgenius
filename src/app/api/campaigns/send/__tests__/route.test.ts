import { NextRequest } from 'next/server'
import { POST } from '../route'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  },
}))

jest.mock('resend', () => ({
  Resend: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

jest.mock('@/lib/sanitize', () => ({
  sanitizeHtml: jest.fn((html) => html),
}))

const mockSupabase = supabase as jest.Mocked<typeof supabase>
const mockResend = Resend as jest.MockedFunction<typeof Resend>

describe('/api/campaigns/send', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
    access_token: 'token-123',
  }

  const mockCampaign = {
    id: 'campaign-123',
    workspace_id: 'workspace-123',
    name: 'Test Campaign',
    subject: 'Test Subject',
    content: '<p>Test content for {{name}}</p>',
    status: 'draft',
    created_at: '2023-01-01T00:00:00Z',
    send_at: null,
    settings: {
      from_name: 'Test Sender',
      from_email: 'sender@example.com',
      reply_to: 'reply@example.com',
    },
  }

  const mockLeads = [
    {
      id: 'lead-1',
      email: 'lead1@example.com',
      name: 'Lead One',
      status: 'active',
      custom_fields: { company: 'Company 1' },
    },
    {
      id: 'lead-2',
      email: 'lead2@example.com',
      name: 'Lead Two',
      status: 'active',
      custom_fields: { company: 'Company 2' },
    },
  ]

  const mockResendClient = {
    emails: {
      send: jest.fn(),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })
    
    mockResend.mockReturnValue(mockResendClient as any)
    
    mockResendClient.emails.send.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    })
  })

  it('sends campaign to all leads', async () => {
    // Mock campaign fetch
    const mockCampaignQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockCampaign,
        error: null,
      }),
    }

    // Mock leads fetch
    const mockLeadsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue({
        data: mockLeads,
        error: null,
      }),
    }

    // Mock workspace member check
    const mockMemberQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      }),
    }

    // Mock campaign send log
    const mockLogQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'log-123' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table) => {
      switch (table) {
        case 'campaigns':
          return mockCampaignQuery as any
        case 'leads':
          return mockLeadsQuery as any
        case 'workspace_members':
          return mockMemberQuery as any
        case 'campaign_sends':
          return mockLogQuery as any
        default:
          return {} as any
      }
    })

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'campaign-123',
        send_to: 'all',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.sent_count).toBe(2)
    expect(mockResendClient.emails.send).toHaveBeenCalledTimes(2)
  })

  it('sends campaign to specific lead segments', async () => {
    const mockCampaignQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockCampaign,
        error: null,
      }),
    }

    const mockLeadsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue({
        data: [mockLeads[0]], // Only first lead
        error: null,
      }),
    }

    const mockMemberQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      }),
    }

    const mockLogQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'log-123' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table) => {
      switch (table) {
        case 'campaigns':
          return mockCampaignQuery as any
        case 'leads':
          return mockLeadsQuery as any
        case 'workspace_members':
          return mockMemberQuery as any
        case 'campaign_sends':
          return mockLogQuery as any
        default:
          return {} as any
      }
    })

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'campaign-123',
        send_to: 'segment',
        segment_filters: {
          status: ['active'],
          tags: ['newsletter'],
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.sent_count).toBe(1)
  })

  it('personalizes email content with lead data', async () => {
    const campaignWithVariables = {
      ...mockCampaign,
      subject: 'Hello {{name}} from {{company}}',
      content: '<p>Hi {{name}}, welcome to {{company}}!</p>',
    }

    const mockCampaignQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: campaignWithVariables,
        error: null,
      }),
    }

    const mockLeadsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue({
        data: [mockLeads[0]], // Only first lead
        error: null,
      }),
    }

    const mockMemberQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      }),
    }

    const mockLogQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'log-123' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table) => {
      switch (table) {
        case 'campaigns':
          return mockCampaignQuery as any
        case 'leads':
          return mockLeadsQuery as any
        case 'workspace_members':
          return mockMemberQuery as any
        case 'campaign_sends':
          return mockLogQuery as any
        default:
          return {} as any
      }
    })

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'campaign-123',
        send_to: 'specific',
        lead_ids: ['lead-1'],
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockResendClient.emails.send).toHaveBeenCalledWith({
      from: 'Test Sender <sender@example.com>',
      to: 'lead1@example.com',
      subject: 'Hello Lead One from Company 1',
      html: '<p>Hi Lead One, welcome to Company 1!</p>',
      reply_to: 'reply@example.com',
    })
  })

  it('handles campaign not found', async () => {
    const mockCampaignQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
    }

    const mockMemberQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table) => {
      switch (table) {
        case 'campaigns':
          return mockCampaignQuery as any
        case 'workspace_members':
          return mockMemberQuery as any
        default:
          return {} as any
      }
    })

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'non-existent-campaign',
        send_to: 'all',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Campaign not found')
  })

  it('validates user permissions', async () => {
    const mockCampaignQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockCampaign,
        error: null,
      }),
    }

    const mockMemberQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { role: 'viewer' }, // No send permission
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table) => {
      switch (table) {
        case 'campaigns':
          return mockCampaignQuery as any
        case 'workspace_members':
          return mockMemberQuery as any
        default:
          return {} as any
      }
    })

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'campaign-123',
        send_to: 'all',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Insufficient permissions')
  })

  it('handles email sending failures', async () => {
    const mockCampaignQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockCampaign,
        error: null,
      }),
    }

    const mockLeadsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue({
        data: [mockLeads[0]],
        error: null,
      }),
    }

    const mockMemberQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      }),
    }

    const mockLogQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'log-123' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table) => {
      switch (table) {
        case 'campaigns':
          return mockCampaignQuery as any
        case 'leads':
          return mockLeadsQuery as any
        case 'workspace_members':
          return mockMemberQuery as any
        case 'campaign_sends':
          return mockLogQuery as any
        default:
          return {} as any
      }
    })

    // Mock email sending failure
    mockResendClient.emails.send.mockRejectedValue(new Error('Email sending failed'))

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'campaign-123',
        send_to: 'specific',
        lead_ids: ['lead-1'],
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.sent_count).toBe(0)
    expect(data.failed_count).toBe(1)
    expect(data.errors).toHaveLength(1)
  })

  it('validates request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing campaign_id
        send_to: 'all',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
  })

  it('handles unauthenticated requests', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'campaign-123',
        send_to: 'all',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('schedules campaign for future sending', async () => {
    const scheduledCampaign = {
      ...mockCampaign,
      send_at: '2024-01-01T10:00:00Z',
    }

    const mockCampaignQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: scheduledCampaign,
        error: null,
      }),
    }

    const mockUpdateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { ...scheduledCampaign, status: 'scheduled' },
        error: null,
      }),
    }

    const mockMemberQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table) => {
      switch (table) {
        case 'campaigns':
          return Math.random() > 0.5 ? mockCampaignQuery as any : mockUpdateQuery as any
        case 'workspace_members':
          return mockMemberQuery as any
        default:
          return {} as any
      }
    })

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'campaign-123',
        send_to: 'all',
        schedule_at: '2024-01-01T10:00:00Z',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.scheduled).toBe(true)
    expect(mockResendClient.emails.send).not.toHaveBeenCalled()
  })

  it('tracks email sends in database', async () => {
    const mockCampaignQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockCampaign,
        error: null,
      }),
    }

    const mockLeadsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn().mockResolvedValue({
        data: [mockLeads[0]],
        error: null,
      }),
    }

    const mockMemberQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      }),
    }

    const mockLogQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'log-123' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table) => {
      switch (table) {
        case 'campaigns':
          return mockCampaignQuery as any
        case 'leads':
          return mockLeadsQuery as any
        case 'workspace_members':
          return mockMemberQuery as any
        case 'campaign_sends':
          return mockLogQuery as any
        default:
          return {} as any
      }
    })

    const request = new NextRequest('http://localhost:3000/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: 'campaign-123',
        send_to: 'specific',
        lead_ids: ['lead-1'],
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockLogQuery.insert).toHaveBeenCalledWith({
      campaign_id: 'campaign-123',
      lead_id: 'lead-1',
      email_id: 'email-123',
      status: 'sent',
      sent_at: expect.any(String),
    })
  })
})