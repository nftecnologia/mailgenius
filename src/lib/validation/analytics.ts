import { z } from 'zod'

// Import common schemas to avoid circular dependency
const commonSchemas = {
  email: z.string().email('Invalid email format'),
  uuid: z.string().uuid('Invalid UUID format'),
}

const paginationSchema = z.object({
  page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(50),
})

// Analytics validation schemas
export const analyticsSchemas = {
  // GET /api/public/v1/analytics query parameters
  getAnalytics: z.object({
    date_range: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
    date_from: z.string().datetime('Invalid date_from format').optional(),
    date_to: z.string().datetime('Invalid date_to format').optional(),
    metrics: z.array(z.enum([
      'total_sent',
      'total_delivered',
      'total_opened',
      'total_clicked',
      'total_bounced',
      'total_complained',
      'total_unsubscribed',
      'delivery_rate',
      'open_rate',
      'click_rate',
      'bounce_rate',
      'complaint_rate',
      'unsubscribe_rate',
      'engagement_rate',
      'list_growth',
      'revenue',
      'roi'
    ])).optional(),
    group_by: z.enum(['hour', 'day', 'week', 'month']).default('day'),
    campaign_ids: z.array(commonSchemas.uuid).optional(),
    segment_ids: z.array(commonSchemas.uuid).optional(),
    template_ids: z.array(commonSchemas.uuid).optional(),
  }).refine(
    (data) => {
      if (data.date_from && data.date_to) {
        return new Date(data.date_from) <= new Date(data.date_to)
      }
      return true
    },
    {
      message: 'date_from must be before date_to',
      path: ['date_from'],
    }
  ),

  // Campaign analytics
  getCampaignAnalytics: z.object({
    campaign_id: commonSchemas.uuid,
    date_range: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
    metrics: z.array(z.enum([
      'delivery_rate',
      'open_rate',
      'click_rate',
      'bounce_rate',
      'complaint_rate',
      'unsubscribe_rate',
      'engagement_over_time',
      'top_clicked_links',
      'device_stats',
      'location_stats',
      'email_client_stats'
    ])).optional(),
  }),

  // Lead analytics
  getLeadAnalytics: z.object({
    lead_id: commonSchemas.uuid,
    date_range: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
    include_activities: z.boolean().default(true),
    activity_types: z.array(z.enum([
      'email_sent',
      'email_delivered',
      'email_opened',
      'email_clicked',
      'email_bounced',
      'email_complained',
      'unsubscribed',
      'form_submitted',
      'page_visited',
      'lead_scored'
    ])).optional(),
  }),

  // Segment analytics
  getSegmentAnalytics: z.object({
    segment_id: commonSchemas.uuid,
    date_range: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
    metrics: z.array(z.enum([
      'total_leads',
      'growth_rate',
      'engagement_rate',
      'conversion_rate',
      'revenue_per_lead',
      'lifetime_value'
    ])).optional(),
  }),

  // Template analytics
  getTemplateAnalytics: z.object({
    template_id: commonSchemas.uuid,
    date_range: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
    metrics: z.array(z.enum([
      'usage_count',
      'avg_open_rate',
      'avg_click_rate',
      'avg_conversion_rate',
      'performance_trend'
    ])).optional(),
  }),

  // Real-time analytics
  getRealtimeAnalytics: z.object({
    time_window: z.enum(['5m', '15m', '30m', '1h', '3h', '6h', '12h', '24h']).default('1h'),
    metrics: z.array(z.enum([
      'emails_sent',
      'emails_delivered',
      'emails_opened',
      'emails_clicked',
      'active_campaigns',
      'new_leads',
      'unsubscribes'
    ])).optional(),
    refresh_interval: z.number().min(5).max(300).default(30), // seconds
  }),

  // Cohort analysis
  getCohortAnalysis: z.object({
    date_range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
    cohort_type: z.enum(['acquisition', 'engagement', 'retention']).default('engagement'),
    period: z.enum(['day', 'week', 'month']).default('week'),
    segment_ids: z.array(commonSchemas.uuid).optional(),
  }),

  // Funnel analysis
  getFunnelAnalysis: z.object({
    funnel_steps: z.array(z.object({
      name: z.string().min(1, 'Step name is required'),
      event_type: z.enum(['email_sent', 'email_opened', 'email_clicked', 'form_submitted', 'page_visited', 'purchase']),
      conditions: z.record(z.any()).optional(),
    })).min(2, 'At least 2 funnel steps are required'),
    date_range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
    segment_ids: z.array(commonSchemas.uuid).optional(),
  }),

  // A/B test analytics
  getABTestAnalytics: z.object({
    test_id: commonSchemas.uuid,
    metrics: z.array(z.enum([
      'conversion_rate',
      'open_rate',
      'click_rate',
      'revenue',
      'statistical_significance',
      'confidence_interval'
    ])).optional(),
    include_segments: z.boolean().default(false),
  }),

  // Revenue analytics
  getRevenueAnalytics: z.object({
    date_range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
    metrics: z.array(z.enum([
      'total_revenue',
      'revenue_per_email',
      'revenue_per_lead',
      'conversion_value',
      'roi',
      'ltv'
    ])).optional(),
    attribution_window: z.number().min(1).max(365).default(30), // days
  }),

  // Deliverability analytics
  getDeliverabilityAnalytics: z.object({
    date_range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
    metrics: z.array(z.enum([
      'delivery_rate',
      'bounce_rate',
      'complaint_rate',
      'spam_rate',
      'inbox_placement',
      'reputation_score'
    ])).optional(),
    email_providers: z.array(z.string()).optional(),
  }),

  // Engagement analytics
  getEngagementAnalytics: z.object({
    date_range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
    metrics: z.array(z.enum([
      'engagement_rate',
      'avg_time_to_open',
      'avg_time_to_click',
      'repeat_engagement',
      'forward_rate',
      'social_sharing'
    ])).optional(),
    segment_ids: z.array(commonSchemas.uuid).optional(),
  }),

  // List growth analytics
  getListGrowthAnalytics: z.object({
    date_range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
    metrics: z.array(z.enum([
      'new_subscribers',
      'unsubscribes',
      'net_growth',
      'growth_rate',
      'churn_rate',
      'acquisition_sources'
    ])).optional(),
  }),

  // Custom report
  createCustomReport: z.object({
    name: z.string().min(1, 'Report name is required').max(255, 'Report name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    metrics: z.array(z.string()).min(1, 'At least one metric is required'),
    dimensions: z.array(z.string()).optional(),
    filters: z.array(z.object({
      field: z.string(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in']),
      value: z.any(),
    })).optional(),
    date_range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
    schedule: z.object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
      recipients: z.array(commonSchemas.email).min(1, 'At least one recipient is required'),
    }).optional(),
  }),

  // Export analytics
  exportAnalytics: z.object({
    report_type: z.enum(['campaigns', 'leads', 'templates', 'segments', 'custom']),
    format: z.enum(['csv', 'xlsx', 'json', 'pdf']).default('csv'),
    date_range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
    filters: z.record(z.any()).optional(),
    include_raw_data: z.boolean().default(false),
  }),
}