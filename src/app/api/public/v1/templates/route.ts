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
    if (!user.permissions.includes('templates:read' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const template_type = searchParams.get('type')
    const offset = (page - 1) * limit

    const supabase = createSupabaseServerClient()

    let query = supabase
      .from('email_templates')
      .select('*', { count: 'exact' })
      .eq('workspace_id', user.workspace_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (template_type) {
      query = query.eq('template_type', template_type)
    }

    const { data: templates, error, count } = await query

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return createAPIResponse({
      templates: templates || [],
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
    if (!user.permissions.includes('templates:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const body = await request.json()
    const {
      name,
      subject,
      html_content,
      text_content,
      template_type = 'campaign',
      variables
    } = body

    // Validate required fields
    if (!name || !subject || !html_content) {
      return createAPIError('Name, subject, and html_content are required', 400, 'VALIDATION_ERROR')
    }

    // Extract variables from content if not provided
    let extractedVariables = variables || []
    if (!variables) {
      const regex = /\{\{([^}]+)\}\}/g
      const foundVariables: string[] = []
      let match

      const fullContent = `${subject} ${html_content} ${text_content || ''}`
      while ((match = regex.exec(fullContent)) !== null) {
        const variable = match[1].trim()
        if (!foundVariables.includes(variable)) {
          foundVariables.push(variable)
        }
      }
      extractedVariables = foundVariables
    }

    const supabase = createSupabaseServerClient()

    const templateData = {
      workspace_id: user.workspace_id,
      name,
      subject,
      html_content,
      text_content: text_content || null,
      template_type,
      variables: extractedVariables
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .insert(templateData)
      .select()
      .single()

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse(template, 201)

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
    if (!user.permissions.includes('templates:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('id')

    if (!templateId) {
      return createAPIError('Template ID is required', 400, 'VALIDATION_ERROR')
    }

    const body = await request.json()
    const { name, subject, html_content, text_content, template_type, variables } = body

    const supabase = createSupabaseServerClient()

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (subject !== undefined) updateData.subject = subject
    if (html_content !== undefined) updateData.html_content = html_content
    if (text_content !== undefined) updateData.text_content = text_content
    if (template_type !== undefined) updateData.template_type = template_type

    // Update variables if content changed or explicitly provided
    if (variables !== undefined) {
      updateData.variables = variables
    } else if (html_content !== undefined || subject !== undefined) {
      // Re-extract variables from updated content
      const regex = /\{\{([^}]+)\}\}/g
      const foundVariables: string[] = []
      let match

      const fullContent = `${subject || ''} ${html_content || ''} ${text_content || ''}`
      while ((match = regex.exec(fullContent)) !== null) {
        const variable = match[1].trim()
        if (!foundVariables.includes(variable)) {
          foundVariables.push(variable)
        }
      }
      updateData.variables = foundVariables
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('workspace_id', user.workspace_id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return createAPIError('Template not found', 404, 'NOT_FOUND')
      }
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse(template)

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
    if (!user.permissions.includes('templates:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('id')

    if (!templateId) {
      return createAPIError('Template ID is required', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseServerClient()

    // Check if template is being used by any campaigns
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('template_id', templateId)
      .eq('workspace_id', user.workspace_id)
      .limit(1)

    if (campaignError) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    if (campaigns && campaigns.length > 0) {
      return createAPIError('Cannot delete template that is being used by campaigns', 400, 'TEMPLATE_IN_USE')
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId)
      .eq('workspace_id', user.workspace_id)

    if (error) {
      return createAPIError('Database error', 500, 'DATABASE_ERROR')
    }

    return createAPIResponse({ message: 'Template deleted successfully' })

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
