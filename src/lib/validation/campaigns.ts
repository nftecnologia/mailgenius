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

const campaignStatusEnum = z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'])

// Campaign validation schemas
export const campaignSchemas = {
  // GET /api/public/v1/campaigns query parameters
  getCampaigns: z.object({
    ...paginationSchema.shape,
    status: campaignStatusEnum.optional(),
    include_stats: z.coerce.boolean().default(false),
  }),

  // POST /api/public/v1/campaigns body
  createCampaign: z.object({
    name: z.string().min(1, 'Campaign name is required').max(255, 'Campaign name too long'),
    subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long'),
    template_id: commonSchemas.uuid.optional(),
    segment_id: commonSchemas.uuid.optional(),
    send_at: z.string().datetime('Invalid send_at date format').optional(),
    content: z.object({
      html: z.string().optional(),
      text: z.string().optional(),
      variables: z.record(z.any()).optional(),
    }).optional(),
    status: campaignStatusEnum.default('draft'),
  }).refine(
    (data) => data.template_id || data.content,
    {
      message: 'Either template_id or content is required',
      path: ['template_id'],
    }
  ).refine(
    (data) => !data.send_at || new Date(data.send_at) > new Date(),
    {
      message: 'send_at must be a future date',
      path: ['send_at'],
    }
  ),

  // PUT /api/public/v1/campaigns body
  updateCampaign: z.object({
    name: z.string().min(1, 'Campaign name is required').max(255, 'Campaign name too long').optional(),
    subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long').optional(),
    template_id: commonSchemas.uuid.optional(),
    segment_id: commonSchemas.uuid.optional(),
    send_at: z.string().datetime('Invalid send_at date format').optional(),
    content: z.object({
      html: z.string().optional(),
      text: z.string().optional(),
      variables: z.record(z.any()).optional(),
    }).optional(),
    status: campaignStatusEnum.optional(),
  }).refine(
    (data) => !data.send_at || new Date(data.send_at) > new Date(),
    {
      message: 'send_at must be a future date',
      path: ['send_at'],
    }
  ),

  // PUT /api/public/v1/campaigns query parameters
  updateCampaignParams: z.object({
    id: commonSchemas.uuid,
  }),

  // DELETE /api/public/v1/campaigns query parameters
  deleteCampaignParams: z.object({
    id: commonSchemas.uuid,
  }),

  // POST /api/public/v1/campaigns/send body
  sendCampaign: z.object({
    campaign_id: commonSchemas.uuid,
    send_immediately: z.boolean().default(false),
    test_emails: z.array(commonSchemas.email).optional(),
  }),

  // Campaign scheduling
  scheduleCampaign: z.object({
    campaign_id: commonSchemas.uuid,
    send_at: z.string().datetime('Invalid send_at date format'),
  }).refine(
    (data) => new Date(data.send_at) > new Date(),
    {
      message: 'send_at must be a future date',
      path: ['send_at'],
    }
  ),

  // Campaign duplicate
  duplicateCampaign: z.object({
    campaign_id: commonSchemas.uuid,
    name: z.string().min(1, 'Campaign name is required').max(255, 'Campaign name too long').optional(),
  }),

  // Campaign stats query
  getCampaignStats: z.object({
    campaign_id: commonSchemas.uuid,
    date_range: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
    group_by: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  }),

  // Campaign A/B test
  createCampaignABTest: z.object({
    campaign_id: commonSchemas.uuid,
    test_name: z.string().min(1, 'Test name is required').max(255, 'Test name too long'),
    test_type: z.enum(['subject', 'content', 'send_time']),
    variant_a: z.object({
      name: z.string().min(1, 'Variant name is required'),
      subject: z.string().optional(),
      content: z.object({
        html: z.string().optional(),
        text: z.string().optional(),
      }).optional(),
      send_time: z.string().datetime().optional(),
    }),
    variant_b: z.object({
      name: z.string().min(1, 'Variant name is required'),
      subject: z.string().optional(),
      content: z.object({
        html: z.string().optional(),
        text: z.string().optional(),
      }).optional(),
      send_time: z.string().datetime().optional(),
    }),
    test_percentage: z.number().min(10, 'Test percentage must be at least 10%').max(50, 'Test percentage cannot exceed 50%').default(20),
    winning_metric: z.enum(['open_rate', 'click_rate', 'conversion_rate']).default('open_rate'),
    test_duration_hours: z.number().min(1, 'Test duration must be at least 1 hour').max(168, 'Test duration cannot exceed 168 hours').default(24),
  }),

  // Campaign pause/resume
  pauseCampaign: z.object({
    campaign_id: commonSchemas.uuid,
  }),

  resumeCampaign: z.object({
    campaign_id: commonSchemas.uuid,
  }),

  // Campaign recipients
  getCampaignRecipients: z.object({
    campaign_id: commonSchemas.uuid,
    ...paginationSchema.shape,
    status: z.enum(['pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained']).optional(),
  }),
}