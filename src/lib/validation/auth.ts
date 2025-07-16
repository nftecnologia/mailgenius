import { z } from 'zod'

// Import common schemas to avoid circular dependency
const commonSchemas = {
  email: z.string().email('Invalid email format'),
  uuid: z.string().uuid('Invalid UUID format'),
}

const workspaceMemberRoleEnum = z.enum(['admin', 'editor', 'member', 'viewer'])
const workspaceMemberStatusEnum = z.enum(['active', 'invited', 'suspended'])

// Auth validation schemas
export const authSchemas = {
  // OAuth callback parameters
  oauthCallback: z.object({
    code: z.string().min(1, 'Authorization code is required'),
    state: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
  }),

  // Sign up / registration
  signUp: z.object({
    email: commonSchemas.email,
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    workspace_name: z.string().min(1, 'Workspace name is required').max(255, 'Workspace name too long').optional(),
    terms_accepted: z.boolean().refine(val => val === true, 'Terms must be accepted'),
    marketing_consent: z.boolean().default(false),
  }),

  // Sign in / login
  signIn: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required'),
    remember_me: z.boolean().default(false),
  }),

  // Password reset request
  resetPasswordRequest: z.object({
    email: commonSchemas.email,
    redirect_url: z.string().url('Invalid redirect URL').optional(),
  }),

  // Password reset confirmation
  resetPasswordConfirm: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    confirm_password: z.string(),
  }).refine(
    (data) => data.password === data.confirm_password,
    {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    }
  ),

  // Change password (authenticated user)
  changePassword: z.object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    confirm_password: z.string(),
  }).refine(
    (data) => data.new_password === data.confirm_password,
    {
      message: 'Passwords do not match',
      path: ['confirm_password'],
    }
  ),

  // Update profile
  updateProfile: z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
    email: commonSchemas.email.optional(),
    avatar_url: z.string().url('Invalid avatar URL').optional(),
    bio: z.string().max(1000, 'Bio too long').optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    notifications: z.object({
      email_campaigns: z.boolean().default(true),
      email_system: z.boolean().default(true),
      desktop: z.boolean().default(true),
      mobile: z.boolean().default(true),
    }).optional(),
  }),

  // Workspace creation
  createWorkspace: z.object({
    name: z.string().min(1, 'Workspace name is required').max(255, 'Workspace name too long'),
    slug: z.string()
      .min(3, 'Slug must be at least 3 characters')
      .max(50, 'Slug too long')
      .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
      .refine(val => !val.startsWith('-') && !val.endsWith('-'), 'Slug cannot start or end with a hyphen'),
    domain: z.string().url('Invalid domain').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
  }),

  // Update workspace
  updateWorkspace: z.object({
    name: z.string().min(1, 'Workspace name is required').max(255, 'Workspace name too long').optional(),
    slug: z.string()
      .min(3, 'Slug must be at least 3 characters')
      .max(50, 'Slug too long')
      .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
      .refine(val => !val.startsWith('-') && !val.endsWith('-'), 'Slug cannot start or end with a hyphen')
      .optional(),
    domain: z.string().url('Invalid domain').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    settings: z.record(z.any()).optional(),
  }),

  // Workspace member invitation
  inviteWorkspaceMember: z.object({
    email: commonSchemas.email,
    role: workspaceMemberRoleEnum.default('member'),
    message: z.string().max(500, 'Message too long').optional(),
  }),

  // Update workspace member
  updateWorkspaceMember: z.object({
    role: workspaceMemberRoleEnum.optional(),
    status: workspaceMemberStatusEnum.optional(),
  }),

  // Accept workspace invitation
  acceptWorkspaceInvitation: z.object({
    invitation_token: z.string().min(1, 'Invitation token is required'),
    workspace_id: commonSchemas.uuid,
  }),

  // API key creation
  createAPIKey: z.object({
    name: z.string().min(1, 'API key name is required').max(255, 'API key name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    permissions: z.array(z.enum([
      'leads:read',
      'leads:write',
      'leads:delete',
      'campaigns:read',
      'campaigns:write',
      'campaigns:delete',
      'campaigns:send',
      'templates:read',
      'templates:write',
      'templates:delete',
      'analytics:read',
      'webhooks:read',
      'webhooks:write',
      'webhooks:delete',
    ])).min(1, 'At least one permission is required'),
    expires_at: z.string().datetime('Invalid expiration date').optional(),
  }),

  // Update API key
  updateAPIKey: z.object({
    name: z.string().min(1, 'API key name is required').max(255, 'API key name too long').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    permissions: z.array(z.enum([
      'leads:read',
      'leads:write',
      'leads:delete',
      'campaigns:read',
      'campaigns:write',
      'campaigns:delete',
      'campaigns:send',
      'templates:read',
      'templates:write',
      'templates:delete',
      'analytics:read',
      'webhooks:read',
      'webhooks:write',
      'webhooks:delete',
    ])).min(1, 'At least one permission is required').optional(),
    expires_at: z.string().datetime('Invalid expiration date').optional(),
    active: z.boolean().optional(),
  }),

  // Email verification
  verifyEmail: z.object({
    token: z.string().min(1, 'Verification token is required'),
    email: commonSchemas.email,
  }),

  // Two-factor authentication setup
  setupTwoFactor: z.object({
    backup_codes: z.array(z.string()).optional(),
  }),

  // Two-factor authentication verification
  verifyTwoFactor: z.object({
    code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
    backup_code: z.string().optional(),
  }),

  // Session management
  refreshSession: z.object({
    refresh_token: z.string().min(1, 'Refresh token is required'),
  }),

  // Magic link authentication
  magicLinkAuth: z.object({
    email: commonSchemas.email,
    redirect_url: z.string().url('Invalid redirect URL').optional(),
  }),
}