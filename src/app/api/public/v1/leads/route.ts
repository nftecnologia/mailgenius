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
    if (!user.permissions.includes('leads:read' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100 per page
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const tags = searchParams.get('tags')?.split(',')
    const offset = (page - 1) * limit

    const supabase = createSupabaseServerClient()

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('workspace_id', user.workspace_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (source) {
      query = query.eq('source', source)
    }
    if (tags) {
      query = query.overlaps('tags', tags)
    }

    const { data: leads, error, count } = await query

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return createAPIResponse({
      leads: leads || [],
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
    if (!user.permissions.includes('leads:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const body = await request.json()
    const { email, name, phone, company, position, source, tags, custom_fields } = body

    // Validate required fields
    if (!email) {
      return createAPIError('Email is required', 400, 'VALIDATION_ERROR')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return createAPIError('Invalid email format', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseServerClient()

    const leadData = {
      workspace_id: user.workspace_id,
      email,
      name: name || null,
      phone: phone || null,
      company: company || null,
      position: position || null,
      source: source || 'api',
      tags: tags || [],
      custom_fields: custom_fields || {},
      status: 'active'
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return createAPIError('Lead with this email already exists', 409, 'DUPLICATE_EMAIL')
      }
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse(lead, 201)

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
    if (!user.permissions.includes('leads:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('id')

    if (!leadId) {
      return createAPIError('Lead ID is required', 400, 'VALIDATION_ERROR')
    }

    const body = await request.json()
    const { email, name, phone, company, position, source, tags, custom_fields, status } = body

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return createAPIError('Invalid email format', 400, 'VALIDATION_ERROR')
      }
    }

    const supabase = createSupabaseServerClient()

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (email !== undefined) updateData.email = email
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (company !== undefined) updateData.company = company
    if (position !== undefined) updateData.position = position
    if (source !== undefined) updateData.source = source
    if (tags !== undefined) updateData.tags = tags
    if (custom_fields !== undefined) updateData.custom_fields = custom_fields
    if (status !== undefined) updateData.status = status

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('workspace_id', user.workspace_id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return createAPIError('Lead not found', 404, 'NOT_FOUND')
      }
      if (error.code === '23505') {
        return createAPIError('Lead with this email already exists', 409, 'DUPLICATE_EMAIL')
      }
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse(lead)

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
    if (!user.permissions.includes('leads:delete' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('id')

    if (!leadId) {
      return createAPIError('Lead ID is required', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseServerClient()

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('workspace_id', user.workspace_id)

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse({ message: 'Lead deleted successfully' })

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
