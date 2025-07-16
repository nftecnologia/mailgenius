import { authSchemas } from '../auth'

describe('Auth validation schemas', () => {
  describe('signUp schema', () => {
    it('validates valid signup data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
        workspace_name: 'Test Workspace',
        terms_accepted: true,
        marketing_consent: false,
      }
      
      const result = authSchemas.signUp.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('rejects invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'Password123',
        name: 'Test User',
        terms_accepted: true,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email format')
      }
    })

    it('rejects weak password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'weakpass',
        name: 'Test User',
        terms_accepted: true,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Password must contain')
      }
    })

    it('rejects password without uppercase', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        terms_accepted: true,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects password without lowercase', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'PASSWORD123',
        name: 'Test User',
        terms_accepted: true,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects password without number', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'PasswordABC',
        name: 'Test User',
        terms_accepted: true,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects short password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Pass1',
        name: 'Test User',
        terms_accepted: true,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at least 8 characters')
      }
    })

    it('requires name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123',
        name: '',
        terms_accepted: true,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name is required')
      }
    })

    it('requires terms acceptance', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
        terms_accepted: false,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Terms must be accepted')
      }
    })

    it('makes marketing consent optional with default false', () => {
      const data = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
        terms_accepted: true,
        // marketing_consent omitted
      }
      
      const result = authSchemas.signUp.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.marketing_consent).toBe(false)
      }
    })

    it('rejects name that is too long', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'A'.repeat(256), // Too long
        terms_accepted: true,
      }
      
      const result = authSchemas.signUp.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name too long')
      }
    })
  })

  describe('signIn schema', () => {
    it('validates valid signin data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        remember_me: true,
      }
      
      const result = authSchemas.signIn.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('makes remember_me optional with default false', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        // remember_me omitted
      }
      
      const result = authSchemas.signIn.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.remember_me).toBe(false)
      }
    })

    it('rejects empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      }
      
      const result = authSchemas.signIn.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password is required')
      }
    })

    it('rejects invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123',
      }
      
      const result = authSchemas.signIn.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('resetPasswordRequest schema', () => {
    it('validates valid reset request', () => {
      const validData = {
        email: 'test@example.com',
        redirect_url: 'https://example.com/reset',
      }
      
      const result = authSchemas.resetPasswordRequest.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('makes redirect_url optional', () => {
      const data = {
        email: 'test@example.com',
        // redirect_url omitted
      }
      
      const result = authSchemas.resetPasswordRequest.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects invalid redirect URL', () => {
      const invalidData = {
        email: 'test@example.com',
        redirect_url: 'not-a-url',
      }
      
      const result = authSchemas.resetPasswordRequest.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('resetPasswordConfirm schema', () => {
    it('validates valid reset confirmation', () => {
      const validData = {
        token: 'reset-token-123',
        password: 'NewPassword123',
        confirm_password: 'NewPassword123',
      }
      
      const result = authSchemas.resetPasswordConfirm.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('rejects mismatched passwords', () => {
      const invalidData = {
        token: 'reset-token-123',
        password: 'NewPassword123',
        confirm_password: 'DifferentPassword123',
      }
      
      const result = authSchemas.resetPasswordConfirm.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Passwords do not match')
        expect(result.error.issues[0].path).toEqual(['confirm_password'])
      }
    })

    it('rejects weak new password', () => {
      const invalidData = {
        token: 'reset-token-123',
        password: 'weak',
        confirm_password: 'weak',
      }
      
      const result = authSchemas.resetPasswordConfirm.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('requires token', () => {
      const invalidData = {
        token: '',
        password: 'NewPassword123',
        confirm_password: 'NewPassword123',
      }
      
      const result = authSchemas.resetPasswordConfirm.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('createWorkspace schema', () => {
    it('validates valid workspace data', () => {
      const validData = {
        name: 'Test Workspace',
        slug: 'test-workspace',
        domain: 'https://test.example.com',
        description: 'A test workspace',
      }
      
      const result = authSchemas.createWorkspace.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('validates slug format', () => {
      const validData = {
        name: 'Test Workspace',
        slug: 'test-workspace-123',
      }
      
      const result = authSchemas.createWorkspace.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('rejects invalid slug format', () => {
      const invalidData = {
        name: 'Test Workspace',
        slug: 'Test_Workspace!',
      }
      
      const result = authSchemas.createWorkspace.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects slug starting with hyphen', () => {
      const invalidData = {
        name: 'Test Workspace',
        slug: '-test-workspace',
      }
      
      const result = authSchemas.createWorkspace.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects slug ending with hyphen', () => {
      const invalidData = {
        name: 'Test Workspace',
        slug: 'test-workspace-',
      }
      
      const result = authSchemas.createWorkspace.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects short slug', () => {
      const invalidData = {
        name: 'Test Workspace',
        slug: 'ab',
      }
      
      const result = authSchemas.createWorkspace.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects long slug', () => {
      const invalidData = {
        name: 'Test Workspace',
        slug: 'a'.repeat(51),
      }
      
      const result = authSchemas.createWorkspace.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects invalid domain', () => {
      const invalidData = {
        name: 'Test Workspace',
        slug: 'test-workspace',
        domain: 'not-a-domain',
      }
      
      const result = authSchemas.createWorkspace.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('createAPIKey schema', () => {
    it('validates valid API key data', () => {
      const validData = {
        name: 'Test API Key',
        description: 'For testing purposes',
        permissions: ['leads:read', 'leads:write', 'campaigns:read'],
        expires_at: '2024-12-31T23:59:59Z',
      }
      
      const result = authSchemas.createAPIKey.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('requires at least one permission', () => {
      const invalidData = {
        name: 'Test API Key',
        permissions: [],
      }
      
      const result = authSchemas.createAPIKey.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects invalid permissions', () => {
      const invalidData = {
        name: 'Test API Key',
        permissions: ['invalid:permission'],
      }
      
      const result = authSchemas.createAPIKey.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('makes description optional', () => {
      const data = {
        name: 'Test API Key',
        permissions: ['leads:read'],
        // description omitted
      }
      
      const result = authSchemas.createAPIKey.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('makes expires_at optional', () => {
      const data = {
        name: 'Test API Key',
        permissions: ['leads:read'],
        // expires_at omitted
      }
      
      const result = authSchemas.createAPIKey.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects invalid expiration date', () => {
      const invalidData = {
        name: 'Test API Key',
        permissions: ['leads:read'],
        expires_at: 'not-a-date',
      }
      
      const result = authSchemas.createAPIKey.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('verifyTwoFactor schema', () => {
    it('validates valid 2FA code', () => {
      const validData = {
        code: '123456',
      }
      
      const result = authSchemas.verifyTwoFactor.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('rejects non-numeric code', () => {
      const invalidData = {
        code: 'abc123',
      }
      
      const result = authSchemas.verifyTwoFactor.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects wrong length code', () => {
      const invalidData = {
        code: '12345',
      }
      
      const result = authSchemas.verifyTwoFactor.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('accepts backup code', () => {
      const validData = {
        code: '123456',
        backup_code: 'backup-code-123',
      }
      
      const result = authSchemas.verifyTwoFactor.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe('magicLinkAuth schema', () => {
    it('validates valid magic link data', () => {
      const validData = {
        email: 'test@example.com',
        redirect_url: 'https://example.com/dashboard',
      }
      
      const result = authSchemas.magicLinkAuth.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('makes redirect_url optional', () => {
      const data = {
        email: 'test@example.com',
        // redirect_url omitted
      }
      
      const result = authSchemas.magicLinkAuth.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects invalid redirect URL', () => {
      const invalidData = {
        email: 'test@example.com',
        redirect_url: 'not-a-url',
      }
      
      const result = authSchemas.magicLinkAuth.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })
})