import { z } from 'zod'

// Import common schemas to avoid circular dependency
const commonSchemas = {
  email: z.string().email('Invalid email format'),
  uuid: z.string().uuid('Invalid UUID format'),
}

// Webhook validation schemas
export const webhookSchemas = {
  // Resend webhook event types
  resendWebhookEvent: z.object({
    type: z.enum([
      'email.sent',
      'email.delivered',
      'email.bounced',
      'email.complained',
      'email.opened',
      'email.clicked',
      'email.delivery_delayed',
      'email.complaint',
      'email.unsubscribe'
    ]),
    data: z.object({
      email_id: z.string().min(1, 'Email ID is required'),
      bounce_type: z.enum(['hard', 'soft']).optional(),
      reason: z.string().optional(),
      url: z.string().url('Invalid URL format').optional(),
      user_agent: z.string().optional(),
      ip_address: z.string().ip('Invalid IP address').optional(),
      timestamp: z.string().datetime('Invalid timestamp format').optional(),
      subject: z.string().optional(),
      to: z.array(commonSchemas.email).optional(),
      from: commonSchemas.email.optional(),
      tags: z.array(z.string()).optional(),
      metadata: z.record(z.any()).optional(),
    }),
    created_at: z.string().datetime('Invalid created_at format').optional(),
  }),

  // Generic webhook validation
  genericWebhook: z.object({
    event_type: z.string().min(1, 'Event type is required'),
    data: z.record(z.any()),
    timestamp: z.string().datetime('Invalid timestamp format').optional(),
    source: z.string().optional(),
    signature: z.string().optional(),
    webhook_id: z.string().optional(),
  }),

  // Webhook configuration
  createWebhook: z.object({
    url: z.string().url('Invalid webhook URL'),
    events: z.array(z.string()).min(1, 'At least one event type is required'),
    name: z.string().min(1, 'Webhook name is required').max(255, 'Webhook name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    secret: z.string().min(8, 'Secret must be at least 8 characters').optional(),
    active: z.boolean().default(true),
    retry_config: z.object({
      max_retries: z.number().min(0).max(10).default(3),
      retry_delay: z.number().min(1).max(3600).default(60), // seconds
      exponential_backoff: z.boolean().default(true),
    }).optional(),
    headers: z.record(z.string()).optional(),
  }),

  updateWebhook: z.object({
    url: z.string().url('Invalid webhook URL').optional(),
    events: z.array(z.string()).min(1, 'At least one event type is required').optional(),
    name: z.string().min(1, 'Webhook name is required').max(255, 'Webhook name too long').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    secret: z.string().min(8, 'Secret must be at least 8 characters').optional(),
    active: z.boolean().optional(),
    retry_config: z.object({
      max_retries: z.number().min(0).max(10).default(3),
      retry_delay: z.number().min(1).max(3600).default(60), // seconds
      exponential_backoff: z.boolean().default(true),
    }).optional(),
    headers: z.record(z.string()).optional(),
  }),

  // Webhook delivery log
  webhookDeliveryLog: z.object({
    webhook_id: commonSchemas.uuid,
    event_type: z.string(),
    payload: z.record(z.any()),
    response_status: z.number().min(100).max(999),
    response_body: z.string().optional(),
    response_headers: z.record(z.string()).optional(),
    attempt_number: z.number().min(1).max(10),
    delivered_at: z.string().datetime(),
    error_message: z.string().optional(),
  }),

  // Webhook test
  testWebhook: z.object({
    webhook_id: commonSchemas.uuid,
    event_type: z.string().min(1, 'Event type is required'),
    test_data: z.record(z.any()).optional(),
  }),

  // Webhook signature validation
  validateWebhookSignature: z.object({
    payload: z.string().min(1, 'Payload is required'),
    signature: z.string().min(1, 'Signature is required'),
    secret: z.string().min(1, 'Secret is required'),
    timestamp: z.string().datetime('Invalid timestamp format').optional(),
  }),

  // Mailgun webhook (if needed)
  mailgunWebhook: z.object({
    signature: z.object({
      timestamp: z.string(),
      token: z.string(),
      signature: z.string(),
    }),
    'event-data': z.object({
      event: z.enum(['delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed']),
      timestamp: z.number(),
      id: z.string(),
      recipient: commonSchemas.email,
      message: z.object({
        headers: z.record(z.string()),
        size: z.number().optional(),
      }),
      'user-variables': z.record(z.any()).optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),

  // SendGrid webhook (if needed)
  sendgridWebhook: z.array(z.object({
    email: commonSchemas.email,
    timestamp: z.number(),
    event: z.enum(['delivered', 'open', 'click', 'bounce', 'dropped', 'deferred', 'processed', 'spam_report', 'unsubscribe']),
    sg_event_id: z.string(),
    sg_message_id: z.string(),
    useragent: z.string().optional(),
    ip: z.string().ip().optional(),
    url: z.string().url().optional(),
    reason: z.string().optional(),
    status: z.string().optional(),
    response: z.string().optional(),
    attempt: z.string().optional(),
    category: z.array(z.string()).optional(),
    unique_args: z.record(z.any()).optional(),
  })),
}