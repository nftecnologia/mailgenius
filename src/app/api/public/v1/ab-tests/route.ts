import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { authenticateAPIRequest, APIPermission, createAPIResponse, createAPIError, rateLimiter } from '@/lib/api-auth'
import { abTestAnalyzer } from '@/lib/ab-testing'

export async function GET(request: NextRequest) {
  try {
    // Authenticate API request
    const user = await authenticateAPIRequest(request)

    // Check rate limiting
    if (!rateLimiter.checkLimit(user.api_key_id)) {
      return createAPIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Check permissions
    if (!user.permissions.includes('ab_tests:read' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const status = searchParams.get('status')
    const test_type = searchParams.get('test_type')
    const include_analysis = searchParams.get('include_analysis') === 'true'
    const offset = (page - 1) * limit

    const supabase = createSupabaseServerClient()

    // For demo, return mock data with structure
    // In production, this would query the ab_tests table
    const mockTests = [
      {
        id: 'test_001',
        workspace_id: user.workspace_id,
        name: 'Subject Line Test - Newsletter',
        description: 'Testing direct vs curious subject lines',
        hypothesis: 'Direct subject lines will have higher open rates',
        test_type: 'subject_line',
        status: 'completed',
        variants: [
          {
            id: 'control',
            name: 'Control - Direct',
            type: 'subject_line' as const,
            content: 'Weekly Newsletter - Company Updates',
            recipients: 1000,
            sent: 1000,
            delivered: 985,
            opened: 245,
            clicked: 47,
            unsubscribed: 2,
            bounced: 15
          },
          {
            id: 'variant_1',
            name: 'Variant - Curious',
            type: 'subject_line' as const,
            content: 'You won\'t believe what happened this week...',
            recipients: 1000,
            sent: 1000,
            delivered: 992,
            opened: 287,
            clicked: 61,
            unsubscribed: 3,
            bounced: 8
          }
        ],
        control_variant_id: 'control',
        winner_variant_id: 'variant_1',
        confidence_level: 95,
        minimum_sample_size: 1000,
        test_duration_days: 7,
        start_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        total_audience_size: 2000,
        statistical_significance: {
          p_value: 0.03,
          confidence_level: 95,
          is_significant: true,
          winner_lift: 17.1
        },
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    // Apply filters
    let filteredTests = mockTests
    if (status) {
      filteredTests = filteredTests.filter(test => test.status === status)
    }
    if (test_type) {
      filteredTests = filteredTests.filter(test => test.test_type === test_type)
    }

    // Add analysis if requested
    let responseTests = filteredTests
    if (include_analysis) {
      responseTests = filteredTests.map(test => {
        if (test.variants.length >= 2) {
          const analysis = abTestAnalyzer.analyzeABTest(
            test.variants[0],
            test.variants[1],
            test.test_duration_days
          )
          return {
            ...test,
            analysis: {
              statistical_significance: analysis.statistical_analysis,
              metrics: analysis.metrics,
              recommendation: analysis.statistical_analysis.recommendation
            }
          }
        }
        return test
      })
    }

    const totalPages = Math.ceil(filteredTests.length / limit)
    const paginatedTests = responseTests.slice(offset, offset + limit)

    return createAPIResponse({
      ab_tests: paginatedTests,
      pagination: {
        page,
        limit,
        total: filteredTests.length,
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
    if (!user.permissions.includes('ab_tests:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const body = await request.json()
    const {
      name,
      description,
      hypothesis,
      test_type,
      variants,
      confidence_level = 95,
      test_duration_days = 7,
      total_audience_size,
      segment_id
    } = body

    // Validate required fields
    if (!name || !test_type || !variants || variants.length < 2) {
      return createAPIError('Name, test_type, and at least 2 variants are required', 400, 'VALIDATION_ERROR')
    }

    // Validate test type
    const validTestTypes = ['subject_line', 'content', 'send_time', 'from_name']
    if (!validTestTypes.includes(test_type)) {
      return createAPIError('Invalid test_type. Valid types: ' + validTestTypes.join(', '), 400, 'VALIDATION_ERROR')
    }

    // Validate variants
    if (variants.some((v: any) => !v.name || !v.content)) {
      return createAPIError('All variants must have name and content', 400, 'VALIDATION_ERROR')
    }

    // Calculate minimum sample size
    const minSampleSize = abTestAnalyzer.calculateMinimumSampleSize(0.20, 0.02)

    const supabase = createSupabaseServerClient()

    // In production, this would create records in the database
    const testId = `test_${Date.now()}`

    const testData = {
      id: testId,
      workspace_id: user.workspace_id,
      name,
      description: description || '',
      hypothesis: hypothesis || '',
      test_type,
      status: 'draft',
      variants: variants.map((v: any, index: number) => ({
        id: `variant_${index}`,
        name: v.name,
        type: test_type,
        content: v.content,
        recipients: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        bounced: 0
      })),
      control_variant_id: 'variant_0',
      confidence_level,
      minimum_sample_size: minSampleSize,
      test_duration_days,
      total_audience_size: total_audience_size || 0,
      segment_id: segment_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return createAPIResponse(testData, 201)

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
    if (!user.permissions.includes('ab_tests:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('id')

    if (!testId) {
      return createAPIError('Test ID is required', 400, 'VALIDATION_ERROR')
    }

    const body = await request.json()
    const { name, description, hypothesis, status, test_duration_days } = body

    // Validate status changes
    if (status) {
      const validStatuses = ['draft', 'running', 'paused', 'completed']
      if (!validStatuses.includes(status)) {
        return createAPIError('Invalid status. Valid statuses: ' + validStatuses.join(', '), 400, 'VALIDATION_ERROR')
      }
    }

    const supabase = createSupabaseServerClient()

    // In production, this would update the test in the database
    const updatedTest = {
      id: testId,
      workspace_id: user.workspace_id,
      name: name || 'Updated Test',
      description: description || '',
      hypothesis: hypothesis || '',
      status: status || 'draft',
      test_duration_days: test_duration_days || 7,
      updated_at: new Date().toISOString(),
      ...(status === 'running' && { start_date: new Date().toISOString() }),
      ...(status === 'completed' && { end_date: new Date().toISOString() })
    }

    return createAPIResponse(updatedTest)

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
    if (!user.permissions.includes('ab_tests:write' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('id')

    if (!testId) {
      return createAPIError('Test ID is required', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseServerClient()

    // In production, this would check if test can be deleted and remove from database
    // Cannot delete running or completed tests with significant data

    return createAPIResponse({ message: 'A/B test deleted successfully' })

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
