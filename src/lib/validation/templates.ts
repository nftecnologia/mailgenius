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

// Template validation schemas
export const templateSchemas = {
  // GET /api/public/v1/templates query parameters
  getTemplates: z.object({
    ...paginationSchema.shape,
    template_type: z.enum(['campaign', 'automation', 'transactional']).optional(),
    search: z.string().optional(),
  }),

  // POST /api/public/v1/templates body
  createTemplate: z.object({
    name: z.string().min(1, 'Template name is required').max(255, 'Template name too long'),
    subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long'),
    html_content: z.string().min(1, 'HTML content is required'),
    text_content: z.string().optional(),
    template_type: z.enum(['campaign', 'automation', 'transactional']).default('campaign'),
    variables: z.record(z.object({
      name: z.string(),
      description: z.string().optional(),
      type: z.enum(['text', 'number', 'boolean', 'date', 'url', 'email']).default('text'),
      default_value: z.any().optional(),
      required: z.boolean().default(false),
    })).optional(),
    category: z.string().max(100, 'Category too long').optional(),
    tags: z.array(z.string()).optional(),
    preview_text: z.string().max(150, 'Preview text too long').optional(),
    is_public: z.boolean().default(false),
  }),

  // PUT /api/public/v1/templates body
  updateTemplate: z.object({
    name: z.string().min(1, 'Template name is required').max(255, 'Template name too long').optional(),
    subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long').optional(),
    html_content: z.string().min(1, 'HTML content is required').optional(),
    text_content: z.string().optional(),
    template_type: z.enum(['campaign', 'automation', 'transactional']).optional(),
    variables: z.record(z.object({
      name: z.string(),
      description: z.string().optional(),
      type: z.enum(['text', 'number', 'boolean', 'date', 'url', 'email']).default('text'),
      default_value: z.any().optional(),
      required: z.boolean().default(false),
    })).optional(),
    category: z.string().max(100, 'Category too long').optional(),
    tags: z.array(z.string()).optional(),
    preview_text: z.string().max(150, 'Preview text too long').optional(),
    is_public: z.boolean().optional(),
  }),

  // Template parameters
  templateParams: z.object({
    id: commonSchemas.uuid,
  }),

  // Template preview
  previewTemplate: z.object({
    template_id: commonSchemas.uuid,
    variables: z.record(z.any()).optional(),
    test_data: z.object({
      lead_name: z.string().optional(),
      lead_email: commonSchemas.email.optional(),
      company_name: z.string().optional(),
      unsubscribe_url: z.string().url().optional(),
    }).optional(),
  }),

  // Template duplicate
  duplicateTemplate: z.object({
    template_id: commonSchemas.uuid,
    name: z.string().min(1, 'Template name is required').max(255, 'Template name too long').optional(),
  }),

  // Template test send
  testSendTemplate: z.object({
    template_id: commonSchemas.uuid,
    test_emails: z.array(commonSchemas.email).min(1, 'At least one test email is required').max(10, 'Maximum 10 test emails'),
    variables: z.record(z.any()).optional(),
    subject_override: z.string().max(255, 'Subject too long').optional(),
  }),

  // Template validation
  validateTemplate: z.object({
    html_content: z.string().min(1, 'HTML content is required'),
    text_content: z.string().optional(),
    variables: z.record(z.any()).optional(),
    check_links: z.boolean().default(true),
    check_images: z.boolean().default(true),
    check_spam: z.boolean().default(true),
  }),

  // Template export
  exportTemplate: z.object({
    template_id: commonSchemas.uuid,
    format: z.enum(['html', 'json', 'zip']).default('html'),
    include_assets: z.boolean().default(false),
  }),

  // Template import
  importTemplate: z.object({
    name: z.string().min(1, 'Template name is required').max(255, 'Template name too long'),
    source: z.enum(['html', 'json', 'url', 'file']),
    data: z.string().min(1, 'Template data is required'),
    url: z.string().url('Invalid URL').optional(),
    overwrite_existing: z.boolean().default(false),
  }),

  // Template folder operations
  createTemplateFolder: z.object({
    name: z.string().min(1, 'Folder name is required').max(255, 'Folder name too long'),
    parent_id: commonSchemas.uuid.optional(),
    description: z.string().max(1000, 'Description too long').optional(),
  }),

  updateTemplateFolder: z.object({
    name: z.string().min(1, 'Folder name is required').max(255, 'Folder name too long').optional(),
    parent_id: commonSchemas.uuid.optional(),
    description: z.string().max(1000, 'Description too long').optional(),
  }),

  moveTemplateToFolder: z.object({
    template_id: commonSchemas.uuid,
    folder_id: commonSchemas.uuid.optional(),
  }),

  // Template versioning
  createTemplateVersion: z.object({
    template_id: commonSchemas.uuid,
    version_name: z.string().min(1, 'Version name is required').max(100, 'Version name too long'),
    changes_description: z.string().max(1000, 'Description too long').optional(),
  }),

  restoreTemplateVersion: z.object({
    template_id: commonSchemas.uuid,
    version_id: commonSchemas.uuid,
  }),

  // Template analytics
  getTemplateAnalytics: z.object({
    template_id: commonSchemas.uuid,
    date_range: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
    metrics: z.array(z.enum(['usage_count', 'open_rate', 'click_rate', 'conversion_rate'])).optional(),
  }),

  // Template collaboration
  shareTemplate: z.object({
    template_id: commonSchemas.uuid,
    share_type: z.enum(['public', 'workspace', 'users']),
    user_ids: z.array(commonSchemas.uuid).optional(),
    permissions: z.array(z.enum(['view', 'edit', 'duplicate'])).default(['view']),
    expires_at: z.string().datetime('Invalid expiration date').optional(),
  }),

  // Template AI generation
  generateTemplateWithAI: z.object({
    prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(1000, 'Prompt too long'),
    template_type: z.enum(['campaign', 'automation', 'transactional']).default('campaign'),
    industry: z.string().optional(),
    tone: z.enum(['professional', 'friendly', 'casual', 'formal', 'playful']).default('professional'),
    length: z.enum(['short', 'medium', 'long']).default('medium'),
    include_images: z.boolean().default(false),
    brand_colors: z.array(z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')).optional(),
  }),
}