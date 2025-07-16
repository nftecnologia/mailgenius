export const mockResendClient = {
  emails: {
    send: jest.fn().mockResolvedValue({
      data: {
        id: 'email-123',
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
        created_at: new Date().toISOString(),
      },
      error: null,
    }),
  },
}

export const createMockResend = () => mockResendClient