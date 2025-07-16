import { z } from 'zod'

// Common validation schemas
export const commonSchemas = {
  email: z.string().email('Invalid email format'),
  uuid: z.string().uuid('Invalid UUID format'),
  phoneNumber: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format').optional(),
  url: z.string().url('Invalid URL format').optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  dateString: z.string().datetime('Invalid date format').optional(),
}

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(50),
})

// Status enums
export const leadStatusEnum = z.enum(['active', 'unsubscribed', 'bounced', 'complained'])
export const campaignStatusEnum = z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'])
export const workspaceMemberRoleEnum = z.enum(['admin', 'editor', 'member', 'viewer'])
export const workspaceMemberStatusEnum = z.enum(['active', 'invited', 'suspended'])

// Export validation middleware
export * from './middleware'

// Export all schemas
export { leadSchemas } from './leads'
export { campaignSchemas } from './campaigns'
export { webhookSchemas } from './webhooks'
export { authSchemas } from './auth'
export { templateSchemas } from './templates'
export { analyticsSchemas } from './analytics'
export { abTestSchemas } from './ab-tests'