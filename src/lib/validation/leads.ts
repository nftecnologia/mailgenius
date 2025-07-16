import { z } from 'zod'

// Import common schemas to avoid circular dependency
const commonSchemas = {
  email: z.string().email('Invalid email format'),
  uuid: z.string().uuid('Invalid UUID format'),
  phoneNumber: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format').optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
}

const paginationSchema = z.object({
  page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(50),
})

const leadStatusEnum = z.enum(['active', 'unsubscribed', 'bounced', 'complained'])

// Lead validation schemas
export const leadSchemas = {
  // GET /api/public/v1/leads query parameters
  getLeads: z.object({
    ...paginationSchema.shape,
    status: leadStatusEnum.optional(),
    source: z.string().optional(),
    tags: z.string().optional(), // comma-separated string
  }),

  // POST /api/public/v1/leads body
  createLead: z.object({
    email: commonSchemas.email,
    name: z.string().min(1, 'Name must not be empty').max(255, 'Name too long').optional(),
    phone: commonSchemas.phoneNumber,
    company: z.string().max(255, 'Company name too long').optional(),
    position: z.string().max(255, 'Position too long').optional(),
    source: z.string().max(100, 'Source too long').default('api'),
    tags: commonSchemas.tags,
    custom_fields: commonSchemas.customFields,
  }),

  // PUT /api/public/v1/leads body
  updateLead: z.object({
    email: commonSchemas.email.optional(),
    name: z.string().min(1, 'Name must not be empty').max(255, 'Name too long').optional(),
    phone: commonSchemas.phoneNumber,
    company: z.string().max(255, 'Company name too long').optional(),
    position: z.string().max(255, 'Position too long').optional(),
    source: z.string().max(100, 'Source too long').optional(),
    tags: commonSchemas.tags,
    custom_fields: commonSchemas.customFields,
    status: leadStatusEnum.optional(),
  }),

  // PUT /api/public/v1/leads query parameters
  updateLeadParams: z.object({
    id: commonSchemas.uuid,
  }),

  // DELETE /api/public/v1/leads query parameters
  deleteLeadParams: z.object({
    id: commonSchemas.uuid,
  }),

  // Lead segment schemas
  createLeadSegment: z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    conditions: z.object({
      rules: z.array(z.object({
        field: z.string(),
        operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'in', 'not_in']),
        value: z.any(),
      })),
      logic: z.enum(['and', 'or']).default('and'),
    }),
  }),

  updateLeadSegment: z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    conditions: z.object({
      rules: z.array(z.object({
        field: z.string(),
        operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'in', 'not_in']),
        value: z.any(),
      })),
      logic: z.enum(['and', 'or']).default('and'),
    }).optional(),
  }),

  // Bulk operations
  bulkUpdateLeads: z.object({
    lead_ids: z.array(commonSchemas.uuid).min(1, 'At least one lead ID is required'),
    updates: z.object({
      tags: commonSchemas.tags,
      status: leadStatusEnum.optional(),
      custom_fields: commonSchemas.customFields,
    }),
  }),

  bulkDeleteLeads: z.object({
    lead_ids: z.array(commonSchemas.uuid).min(1, 'At least one lead ID is required'),
  }),

  // Import leads
  importLeads: z.object({
    leads: z.array(z.object({
      email: commonSchemas.email,
      name: z.string().max(255, 'Name too long').optional(),
      phone: commonSchemas.phoneNumber,
      company: z.string().max(255, 'Company name too long').optional(),
      position: z.string().max(255, 'Position too long').optional(),
      source: z.string().max(100, 'Source too long').default('import'),
      tags: commonSchemas.tags,
      custom_fields: commonSchemas.customFields,
    })).min(1, 'At least one lead is required').max(1000, 'Maximum 1000 leads per import'),
    update_existing: z.boolean().default(false),
  }),
}