export const mockAIResponse = {
  subject: 'Test AI Subject',
  content: '<p>Test AI generated content</p>',
  variables: ['name', 'email'],
  reasoning: 'AI generated this based on the prompt',
}

export const mockOpenAIClient = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockAIResponse),
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      }),
    },
  },
}

export const mockAnthropicClient = {
  messages: {
    create: jest.fn().mockResolvedValue({
      content: [
        {
          text: JSON.stringify(mockAIResponse),
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    }),
  },
}