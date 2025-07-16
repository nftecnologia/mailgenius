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

// A/B Test validation schemas
export const abTestSchemas = {
  // GET /api/public/v1/ab-tests query parameters
  getABTests: z.object({
    ...paginationSchema.shape,
    status: z.enum(['draft', 'running', 'completed', 'paused', 'cancelled']).optional(),
    test_type: z.enum(['subject', 'content', 'send_time', 'from_name', 'call_to_action']).optional(),
    campaign_id: commonSchemas.uuid.optional(),
  }),

  // POST /api/public/v1/ab-tests body
  createABTest: z.object({
    name: z.string().min(1, 'Test name is required').max(255, 'Test name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    test_type: z.enum(['subject', 'content', 'send_time', 'from_name', 'call_to_action']),
    campaign_id: commonSchemas.uuid.optional(),
    
    // Test configuration
    test_percentage: z.number()
      .min(10, 'Test percentage must be at least 10%')
      .max(50, 'Test percentage cannot exceed 50%')
      .default(20),
    
    winning_metric: z.enum(['open_rate', 'click_rate', 'conversion_rate', 'revenue']).default('open_rate'),
    
    confidence_threshold: z.number()
      .min(90, 'Confidence threshold must be at least 90%')
      .max(99, 'Confidence threshold cannot exceed 99%')
      .default(95),
    
    test_duration_hours: z.number()
      .min(1, 'Test duration must be at least 1 hour')
      .max(168, 'Test duration cannot exceed 168 hours (7 days)')
      .default(24),
    
    auto_select_winner: z.boolean().default(true),
    
    // Variant configurations
    variant_a: z.object({
      name: z.string().min(1, 'Variant name is required').max(100, 'Variant name too long'),
      subject: z.string().max(255, 'Subject too long').optional(),
      content: z.object({
        html: z.string().optional(),
        text: z.string().optional(),
      }).optional(),
      send_time: z.string().datetime('Invalid send_time format').optional(),
      from_name: z.string().max(100, 'From name too long').optional(),
      from_email: commonSchemas.email.optional(),
      call_to_action: z.object({
        text: z.string().max(100, 'CTA text too long'),
        url: z.string().url('Invalid CTA URL'),
        color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
      }).optional(),
    }),
    
    variant_b: z.object({
      name: z.string().min(1, 'Variant name is required').max(100, 'Variant name too long'),
      subject: z.string().max(255, 'Subject too long').optional(),
      content: z.object({
        html: z.string().optional(),
        text: z.string().optional(),
      }).optional(),
      send_time: z.string().datetime('Invalid send_time format').optional(),
      from_name: z.string().max(100, 'From name too long').optional(),
      from_email: commonSchemas.email.optional(),
      call_to_action: z.object({
        text: z.string().max(100, 'CTA text too long'),
        url: z.string().url('Invalid CTA URL'),
        color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
      }).optional(),
    }),
    
    // Targeting
    segment_id: commonSchemas.uuid.optional(),
    exclusion_rules: z.array(z.object({
      field: z.string(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than']),
      value: z.any(),
    })).optional(),
    
    // Scheduling
    start_at: z.string().datetime('Invalid start_at format').optional(),
    end_at: z.string().datetime('Invalid end_at format').optional(),
  }).refine(
    (data) => {
      if (data.start_at && data.end_at) {
        return new Date(data.start_at) < new Date(data.end_at)
      }
      return true
    },
    {
      message: 'start_at must be before end_at',
      path: ['start_at'],
    }
  ).refine(
    (data) => {
      if (data.start_at) {
        return new Date(data.start_at) > new Date()
      }
      return true
    },
    {
      message: 'start_at must be in the future',
      path: ['start_at'],
    }
  ),

  // PUT /api/public/v1/ab-tests body
  updateABTest: z.object({
    name: z.string().min(1, 'Test name is required').max(255, 'Test name too long').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    test_percentage: z.number()
      .min(10, 'Test percentage must be at least 10%')
      .max(50, 'Test percentage cannot exceed 50%')
      .optional(),
    winning_metric: z.enum(['open_rate', 'click_rate', 'conversion_rate', 'revenue']).optional(),
    confidence_threshold: z.number()
      .min(90, 'Confidence threshold must be at least 90%')
      .max(99, 'Confidence threshold cannot exceed 99%')
      .optional(),
    test_duration_hours: z.number()
      .min(1, 'Test duration must be at least 1 hour')
      .max(168, 'Test duration cannot exceed 168 hours')
      .optional(),
    auto_select_winner: z.boolean().optional(),
    start_at: z.string().datetime('Invalid start_at format').optional(),
    end_at: z.string().datetime('Invalid end_at format').optional(),
  }),

  // A/B Test parameters
  abTestParams: z.object({
    id: commonSchemas.uuid,
  }),

  // Start A/B test
  startABTest: z.object({
    test_id: commonSchemas.uuid,
    force_start: z.boolean().default(false),
  }),

  // Stop A/B test
  stopABTest: z.object({
    test_id: commonSchemas.uuid,
    reason: z.string().max(500, 'Reason too long').optional(),
  }),

  // Select winner
  selectWinner: z.object({
    test_id: commonSchemas.uuid,
    winning_variant: z.enum(['variant_a', 'variant_b']),
    reason: z.string().max(500, 'Reason too long').optional(),
  }),

  // A/B Test analysis
  getABTestAnalysis: z.object({
    test_id: commonSchemas.uuid,
    metrics: z.array(z.enum([
      'sample_size',
      'conversion_rate',
      'open_rate',
      'click_rate',
      'revenue',
      'statistical_significance',
      'confidence_interval',
      'p_value',
      'effect_size',
      'power',
      'minimum_detectable_effect'
    ])).optional(),
    include_segments: z.boolean().default(false),
    date_range: z.enum(['test_duration', '24h', '7d', '30d']).default('test_duration'),
  }),

  // Multivariate test (advanced)
  createMultivariateTest: z.object({
    name: z.string().min(1, 'Test name is required').max(255, 'Test name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    
    // Test factors
    factors: z.array(z.object({
      name: z.string().min(1, 'Factor name is required'),
      type: z.enum(['subject', 'content', 'cta', 'from_name', 'send_time']),
      variants: z.array(z.object({
        name: z.string().min(1, 'Variant name is required'),
        value: z.any(),
      })).min(2, 'At least 2 variants per factor'),
    })).min(2, 'At least 2 factors required for multivariate test'),
    
    test_percentage: z.number()
      .min(10, 'Test percentage must be at least 10%')
      .max(50, 'Test percentage cannot exceed 50%')
      .default(20),
    
    winning_metric: z.enum(['open_rate', 'click_rate', 'conversion_rate', 'revenue']).default('open_rate'),
    confidence_threshold: z.number().min(90).max(99).default(95),
    test_duration_hours: z.number().min(1).max(168).default(24),
    
    segment_id: commonSchemas.uuid.optional(),
    start_at: z.string().datetime().optional(),
  }),

  // A/B Test reporting
  generateABTestReport: z.object({
    test_id: commonSchemas.uuid,
    report_type: z.enum(['summary', 'detailed', 'statistical']).default('summary'),
    format: z.enum(['json', 'pdf', 'csv']).default('json'),
    include_charts: z.boolean().default(true),
    include_raw_data: z.boolean().default(false),
  }),

  // A/B Test templates
  createABTestTemplate: z.object({
    name: z.string().min(1, 'Template name is required').max(255, 'Template name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    test_type: z.enum(['subject', 'content', 'send_time', 'from_name', 'call_to_action']),
    default_config: z.object({
      test_percentage: z.number().min(10).max(50).default(20),
      winning_metric: z.enum(['open_rate', 'click_rate', 'conversion_rate', 'revenue']).default('open_rate'),
      confidence_threshold: z.number().min(90).max(99).default(95),
      test_duration_hours: z.number().min(1).max(168).default(24),
      auto_select_winner: z.boolean().default(true),
    }),
    variant_templates: z.object({
      variant_a: z.record(z.any()),
      variant_b: z.record(z.any()),
    }),
  }),

  // A/B Test history
  getABTestHistory: z.object({
    test_id: commonSchemas.uuid,
    ...paginationSchema.shape,
    event_types: z.array(z.enum([
      'created',
      'started',
      'paused',
      'resumed',
      'stopped',
      'winner_selected',
      'completed',
      'cancelled'
    ])).optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),

  // A/B Test optimization suggestions
  getOptimizationSuggestions: z.object({
    test_id: commonSchemas.uuid,
    suggestion_types: z.array(z.enum([
      'sample_size',
      'test_duration',
      'winning_metric',
      'confidence_threshold',
      'variant_improvements',
      'targeting_optimization'
    ])).optional(),
  }),
}