import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { authenticateAPIRequest, APIPermission, createAPIResponse, createAPIError, rateLimiter } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    // Authenticate API request
    const user = await authenticateAPIRequest(request)

    // Check rate limiting
    if (!rateLimiter.checkLimit(user.api_key_id)) {
      return createAPIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Check permissions
    if (!user.permissions.includes('campaigns:read' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const status = searchParams.get('status')
    const includeStats = searchParams.get('include_stats') === 'true'
    const offset = (page - 1) * limit

    const supabase = createSupabaseServerClient()

    let query = supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('workspace_id', user.workspace_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    const { data: campaigns, error, count } = await query

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    let responseData = campaigns || []

    // Include detailed stats if requested
    if (includeStats && campaigns) {
      responseData = campaigns.map(campaign => ({
        ...campaign,
        stats: {
          delivery_rate: campaign.total_recipients > 0 ?
            ((campaign.delivered / campaign.total_recipients) * 100).toFixed(2) : '0.00',
          open_rate: campaign.delivered > 0 ?
            ((campaign.opened / campaign.delivered) * 100).toFixed(2) : '0.00',
          click_rate: campaign.opened > 0 ?
            ((campaign.clicked / campaign.opened) * 100).toFixed(2) : '0.00',
          unsubscribe_rate: campaign.total_recipients > 0 ?
            ((campaign.unsubscribed / campaign.total_recipients) * 100).toFixed(2) : '0.00'
        }
      }))
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return createAPIResponse({
      campaigns: responseData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Public API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('Token de autorização') || error.message.includes('API key')) {
        return createAPIError(error.message, 401, 'UNAUTHORIZED')
      }
      return createAPIError(error.message, 400, 'BAD_REQUEST')
    }

    return createAPIError('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate API request
    const user = await authenticateAPIRequest(request)

    // Check rate limiting
    if (!rateLimiter.checkLimit(user.api_key_id)) {
      return createAPIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Check permissions
    if (!user.permissions.includes('campaigns:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const body = await request.json()
    const {
      name,
      subject,
      template_id,
      segment_id,
      send_at,
      content,
      status = 'draft'
    } = body

    // Validate required fields
    if (!name || !subject) {
      return createAPIError('Name and subject are required', 400, 'VALIDATION_ERROR')
    }

    // Validate content or template
    if (!template_id && !content) {
      return createAPIError('Either template_id or content is required', 400, 'VALIDATION_ERROR')
    }

    // Validate send_at if provided
    if (send_at) {
      const sendDate = new Date(send_at)
      if (isNaN(sendDate.getTime()) || sendDate < new Date()) {
        return createAPIError('send_at must be a valid future date', 400, 'VALIDATION_ERROR')
      }
    }

    const supabase = createSupabaseServerClient()

    // Verify template exists if provided
    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('id')
        .eq('id', template_id)
        .eq('workspace_id', user.workspace_id)
        .single()

      if (templateError || !template) {
        return createAPIError('Template not found', 404, 'TEMPLATE_NOT_FOUND')
      }
    }

    // Verify segment exists if provided
    if (segment_id) {
      const { data: segment, error: segmentError } = await supabase
        .from('lead_segments')
        .select('id')
        .eq('id', segment_id)
        .eq('workspace_id', user.workspace_id)
        .single()

      if (segmentError || !segment) {
        return createAPIError('Segment not found', 404, 'SEGMENT_NOT_FOUND')
      }
    }

    const campaignData = {
      workspace_id: user.workspace_id,
      name,
      subject,
      template_id: template_id || null,
      segment_id: segment_id || null,
      send_at: send_at ? new Date(send_at).toISOString() : null,
      status,
      total_recipients: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      complained: 0,
      content: content || null
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single()

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse(campaign, 201)

  } catch (error) {
    console.error('Public API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('Token de autorização') || error.message.includes('API key')) {
        return createAPIError(error.message, 401, 'UNAUTHORIZED')
      }
      return createAPIError(error.message, 400, 'BAD_REQUEST')
    }

    return createAPIError('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate API request
    const user = await authenticateAPIRequest(request)

    // Check rate limiting
    if (!rateLimiter.checkLimit(user.api_key_id)) {
      return createAPIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Check permissions
    if (!user.permissions.includes('campaigns:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('id')

    if (!campaignId) {
      return createAPIError('Campaign ID is required', 400, 'VALIDATION_ERROR')
    }

    const body = await request.json()
    const { name, subject, template_id, segment_id, send_at, content, status } = body

    const supabase = createSupabaseServerClient()

    // Check if campaign exists and can be modified
    const { data: existingCampaign, error: checkError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .eq('workspace_id', user.workspace_id)
      .single()

    if (checkError || !existingCampaign) {
      return createAPIError('Campaign not found', 404, 'NOT_FOUND')
    }

    // Prevent modification of sent campaigns
    if (existingCampaign.status === 'sent' || existingCampaign.status === 'sending') {
      return createAPIError('Cannot modify campaign that has been sent or is being sent', 400, 'INVALID_STATUS')
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (subject !== undefined) updateData.subject = subject
    if (template_id !== undefined) updateData.template_id = template_id
    if (segment_id !== undefined) updateData.segment_id = segment_id
    if (content !== undefined) updateData.content = content
    if (status !== undefined) updateData.status = status

    if (send_at !== undefined) {
      if (send_at) {
        const sendDate = new Date(send_at)
        if (isNaN(sendDate.getTime()) || sendDate < new Date()) {
          return createAPIError('send_at must be a valid future date', 400, 'VALIDATION_ERROR')
        }
        updateData.send_at = sendDate.toISOString()
      } else {
        updateData.send_at = null
      }
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .eq('workspace_id', user.workspace_id)
      .select()
      .single()

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse(campaign)

  } catch (error) {
    console.error('Public API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('Token de autorização') || error.message.includes('API key')) {
        return createAPIError(error.message, 401, 'UNAUTHORIZED')
      }
      return createAPIError(error.message, 400, 'BAD_REQUEST')
    }

    return createAPIError('Internal server error', 500, 'INTERNAL_ERROR')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate API request
    const user = await authenticateAPIRequest(request)

    // Check rate limiting
    if (!rateLimiter.checkLimit(user.api_key_id)) {
      return createAPIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Check permissions
    if (!user.permissions.includes('campaigns:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('id')

    if (!campaignId) {
      return createAPIError('Campaign ID is required', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseServerClient()

    // Check if campaign exists and can be deleted
    const { data: existingCampaign, error: checkError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .eq('workspace_id', user.workspace_id)
      .single()

    if (checkError || !existingCampaign) {
      return createAPIError('Campaign not found', 404, 'NOT_FOUND')
    }

    // Prevent deletion of sent campaigns
    if (existingCampaign.status === 'sent' || existingCampaign.status === 'sending') {
      return createAPIError('Cannot delete campaign that has been sent or is being sent', 400, 'INVALID_STATUS')
    }

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('workspace_id', user.workspace_id)

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse({ message: 'Campaign deleted successfully' })

  } catch (error) {
    console.error('Public API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('Token de autorização') || error.message.includes('API key')) {
        return createAPIError(error.message, 401, 'UNAUTHORIZED')
      }
      return createAPIError(error.message, 400, 'BAD_REQUEST')
    }

    return createAPIError('Internal server error', 500, 'INTERNAL_ERROR')
  }
}
