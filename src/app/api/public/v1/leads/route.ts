import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { authenticateAPIRequest, APIPermission, createAPIResponse, createAPIError } from '@/lib/api-auth'
import { RateLimitHelper } from '@/lib/rate-limit-helpers'

export async function GET(request: NextRequest) {
  try {
    // Authenticate API request
    const user = await authenticateAPIRequest(request)

    // Check rate limiting
    const rateLimitInfo = await RateLimitHelper.checkAPIWithBurstLimit(request)
    if (!rateLimitInfo.allowed) {
      return RateLimitHelper.createRateLimitError(rateLimitInfo)
    }

    // Check permissions
    if (!user.permissions.includes('leads:read' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
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

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
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
    }, 200, rateLimitInfo.headers)

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

    // Check rate limiting for data creation
    const rateLimitInfo = await RateLimitHelper.checkAPIRateLimit(request)
    if (!rateLimitInfo.allowed) {
      return RateLimitHelper.createRateLimitError(rateLimitInfo)
    }

    // Check permissions
    if (!user.permissions.includes('leads:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const body = await request.json()
    const { email, name, phone, tags, custom_fields, status = 'active' } = body

    // Validate required fields
    if (!email) {
      return createAPIError('Email is required', 400, 'VALIDATION_ERROR')
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return createAPIError('Invalid email format', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseServerClient()

    // Check if lead already exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', email)
      .eq('workspace_id', user.workspace_id)
      .single()

    if (existingLead) {
      return createAPIError('Lead with this email already exists', 409, 'DUPLICATE_LEAD')
    }

    const leadData = {
      workspace_id: user.workspace_id,
      email,
      name: name || null,
      phone: phone || null,
      tags: tags || [],
      custom_fields: custom_fields || {},
      status,
      source: 'api'
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single()

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse(lead, 201, rateLimitInfo.headers)

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