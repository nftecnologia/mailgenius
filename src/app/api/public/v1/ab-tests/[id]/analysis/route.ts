import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { authenticateAPIRequest, APIPermission, createAPIResponse, createAPIError, rateLimiter } from '@/lib/api-auth'
import { abTestAnalyzer } from '@/lib/ab-testing'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id: testId } = await context.params
    const { searchParams } = new URL(request.url)
    const include_recommendations = searchParams.get('include_recommendations') === 'true'
    const include_confidence_intervals = searchParams.get('include_confidence_intervals') === 'true'

    const supabase = createSupabaseServerClient()

    // For demo, return mock analysis data
    // In production, this would fetch the test from database
    const mockTest = {
      id: testId,
      workspace_id: user.workspace_id,
      name: 'Subject Line Test - Newsletter',
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
      test_duration_days: 7,
      confidence_level: 95
    }

    if (!mockTest || mockTest.workspace_id !== user.workspace_id) {
      return createAPIError('A/B test not found', 404, 'NOT_FOUND')
    }

    if (mockTest.variants.length < 2) {
      return createAPIError('Test must have at least 2 variants for analysis', 400, 'INSUFFICIENT_DATA')
    }

    // Perform statistical analysis
    const analysis = abTestAnalyzer.analyzeABTest(
      mockTest.variants[0],
      mockTest.variants[1],
      mockTest.test_duration_days
    )

    const response: any = {
      test_id: testId,
      test_name: mockTest.name,
      test_type: mockTest.test_type,
      status: mockTest.status,
      analysis: {
        metrics: {
          open_rate: {
            control: analysis.metrics.open_rate_a,
            variant: analysis.metrics.open_rate_b,
            improvement: analysis.statistical_analysis.open_rate_significance.improvement,
            improvement_percentage: analysis.statistical_analysis.open_rate_significance.improvement_percentage
          },
          click_rate: {
            control: analysis.metrics.click_rate_a,
            variant: analysis.metrics.click_rate_b,
            improvement: analysis.statistical_analysis.click_rate_significance.improvement,
            improvement_percentage: analysis.statistical_analysis.click_rate_significance.improvement_percentage
          },
          conversion_rate: {
            control: analysis.metrics.conversion_rate_a,
            variant: analysis.metrics.conversion_rate_b,
            improvement: analysis.statistical_analysis.conversion_significance.improvement,
            improvement_percentage: analysis.statistical_analysis.conversion_significance.improvement_percentage
          }
        },
        statistical_significance: {
          overall_winner: analysis.statistical_analysis.winner,
          confidence_level: analysis.statistical_analysis.confidence_level,
          sample_size_adequate: analysis.statistical_analysis.sample_size_adequate,
          test_duration_days: analysis.statistical_analysis.test_duration_days,
          recommendation: analysis.statistical_analysis.recommendation,
          metrics: {
            open_rate: {
              p_value: analysis.statistical_analysis.open_rate_significance.p_value,
              z_score: analysis.statistical_analysis.open_rate_significance.z_score,
              is_significant: analysis.statistical_analysis.open_rate_significance.is_significant,
              power: analysis.statistical_analysis.open_rate_significance.power
            },
            click_rate: {
              p_value: analysis.statistical_analysis.click_rate_significance.p_value,
              z_score: analysis.statistical_analysis.click_rate_significance.z_score,
              is_significant: analysis.statistical_analysis.click_rate_significance.is_significant,
              power: analysis.statistical_analysis.click_rate_significance.power
            },
            conversion_rate: {
              p_value: analysis.statistical_analysis.conversion_significance.p_value,
              z_score: analysis.statistical_analysis.conversion_significance.z_score,
              is_significant: analysis.statistical_analysis.conversion_significance.is_significant,
              power: analysis.statistical_analysis.conversion_significance.power
            }
          }
        }
      },
      variants: mockTest.variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        content: variant.content,
        metrics: {
          recipients: variant.recipients,
          sent: variant.sent,
          delivered: variant.delivered,
          opened: variant.opened,
          clicked: variant.clicked,
          unsubscribed: variant.unsubscribed,
          bounced: variant.bounced,
          open_rate: variant.delivered > 0 ? (variant.opened / variant.delivered) : 0,
          click_rate: variant.opened > 0 ? (variant.clicked / variant.opened) : 0,
          delivery_rate: variant.sent > 0 ? (variant.delivered / variant.sent) : 0,
          unsubscribe_rate: variant.delivered > 0 ? (variant.unsubscribed / variant.delivered) : 0
        }
      }))
    }

    // Add confidence intervals if requested
    if (include_confidence_intervals) {
      response.analysis.confidence_intervals = {
        open_rate: analysis.statistical_analysis.open_rate_significance.confidence_interval,
        click_rate: analysis.statistical_analysis.click_rate_significance.confidence_interval,
        conversion_rate: analysis.statistical_analysis.conversion_significance.confidence_interval
      }
    }

    // Add recommendations if requested
    if (include_recommendations) {
      const historicalData = {
        avgOpenRate: (analysis.metrics.open_rate_a + analysis.metrics.open_rate_b) / 2,
        avgClickRate: (analysis.metrics.click_rate_a + analysis.metrics.click_rate_b) / 2,
        avgUnsubscribeRate: 0.005 // Mock value
      }

      response.recommendations = {
        implementation: analysis.statistical_analysis.recommendation,
        future_tests: abTestAnalyzer.generateTestRecommendations(historicalData),
        statistical_notes: [
          `This test achieved ${analysis.statistical_analysis.open_rate_significance.power * 100}% statistical power`,
          `Sample size was ${analysis.statistical_analysis.sample_size_adequate ? 'adequate' : 'insufficient'} for detecting meaningful effects`,
          `Test duration of ${analysis.statistical_analysis.test_duration_days} days is ${analysis.statistical_analysis.test_duration_days >= 7 ? 'sufficient' : 'short'} for reliable results`
        ]
      }
    }

    return createAPIResponse(response)

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
