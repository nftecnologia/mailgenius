import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIEmailGenerator from '../AIEmailGenerator'

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}))

const mockGenerate = jest.fn()
const mockOnGenerated = jest.fn()

describe('AIEmailGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const defaultProps = {
    onGenerated: mockOnGenerated,
  }

  it('renders the AI email generator form', () => {
    render(<AIEmailGenerator {...defaultProps} />)
    
    expect(screen.getByText('Gerador de Email com IA')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')).toBeInTheDocument()
    expect(screen.getByText('Gerar Email')).toBeInTheDocument()
  })

  it('shows campaign type selection', () => {
    render(<AIEmailGenerator {...defaultProps} />)
    
    expect(screen.getByText('Tipo de Campanha')).toBeInTheDocument()
    expect(screen.getByText('Newsletter')).toBeInTheDocument()
    expect(screen.getByText('Promocional')).toBeInTheDocument()
    expect(screen.getByText('Produto')).toBeInTheDocument()
    expect(screen.getByText('Evento')).toBeInTheDocument()
  })

  it('shows tone selection', () => {
    render(<AIEmailGenerator {...defaultProps} />)
    
    expect(screen.getByText('Tom')).toBeInTheDocument()
    expect(screen.getByText('Profissional')).toBeInTheDocument()
    expect(screen.getByText('Amigável')).toBeInTheDocument()
    expect(screen.getByText('Entusiástico')).toBeInTheDocument()
    expect(screen.getByText('Urgente')).toBeInTheDocument()
  })

  it('shows target audience selection', () => {
    render(<AIEmailGenerator {...defaultProps} />)
    
    expect(screen.getByText('Público-alvo')).toBeInTheDocument()
    expect(screen.getByText('Empresas')).toBeInTheDocument()
    expect(screen.getByText('Consumidores')).toBeInTheDocument()
    expect(screen.getByText('Profissionais')).toBeInTheDocument()
    expect(screen.getByText('Estudantes')).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    render(<AIEmailGenerator {...defaultProps} />)
    
    const generateButton = screen.getByText('Gerar Email')
    fireEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText('Por favor, descreva o email que você quer gerar')).toBeInTheDocument()
    })
  })

  it('generates email with valid input', async () => {
    const user = userEvent.setup()
    const mockGeneratedEmail = {
      subject: 'Oferta Especial de Verão',
      content: '<h1>Aproveite nossa oferta especial!</h1><p>Conteúdo do email...</p>',
      variables: ['name', 'company'],
      reasoning: 'Email promocional focado em oferta sazonal',
    }

    // Mock the fetch request
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockGeneratedEmail,
      }),
    })

    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Criar um email promocional para oferta de verão')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    await waitFor(() => {
      expect(mockOnGenerated).toHaveBeenCalledWith(mockGeneratedEmail)
    })
  })

  it('shows loading state during generation', async () => {
    const user = userEvent.setup()
    
    // Mock a delayed response
    global.fetch = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { subject: 'Test', content: 'Test content' },
        }),
      }), 100))
    )

    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    expect(screen.getByText('Gerando...')).toBeInTheDocument()
    expect(generateButton).toBeDisabled()
  })

  it('handles generation errors', async () => {
    const user = userEvent.setup()
    
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText('Erro ao gerar email. Tente novamente.')).toBeInTheDocument()
    })
  })

  it('handles API error responses', async () => {
    const user = userEvent.setup()
    
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Rate limit exceeded',
      }),
    })

    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
    })
  })

  it('updates campaign type selection', async () => {
    const user = userEvent.setup()
    
    render(<AIEmailGenerator {...defaultProps} />)
    
    const promotionalButton = screen.getByText('Promocional')
    await user.click(promotionalButton)
    
    expect(promotionalButton).toHaveClass('bg-blue-500') // Assuming selected state styling
  })

  it('updates tone selection', async () => {
    const user = userEvent.setup()
    
    render(<AIEmailGenerator {...defaultProps} />)
    
    const enthusiasticButton = screen.getByText('Entusiástico')
    await user.click(enthusiasticButton)
    
    expect(enthusiasticButton).toHaveClass('bg-blue-500') // Assuming selected state styling
  })

  it('updates target audience selection', async () => {
    const user = userEvent.setup()
    
    render(<AIEmailGenerator {...defaultProps} />)
    
    const businessButton = screen.getByText('Empresas')
    await user.click(businessButton)
    
    expect(businessButton).toHaveClass('bg-blue-500') // Assuming selected state styling
  })

  it('includes company info in generation request', async () => {
    const user = userEvent.setup()
    
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { subject: 'Test', content: 'Test content' },
      }),
    })

    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    const companyInput = screen.getByPlaceholderText('Nome da sua empresa (opcional)')
    await user.type(companyInput, 'Test Company')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test prompt',
          type: 'newsletter',
          tone: 'professional',
          target_audience: 'consumers',
          company_info: 'Test Company',
        }),
      })
    })
  })

  it('clears form after successful generation', async () => {
    const user = userEvent.setup()
    
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { subject: 'Test', content: 'Test content' },
      }),
    })

    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    await waitFor(() => {
      expect(promptInput).toHaveValue('')
    })
  })

  it('preserves form data on error', async () => {
    const user = userEvent.setup()
    
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    await waitFor(() => {
      expect(promptInput).toHaveValue('Test prompt')
    })
  })

  it('shows character count for prompt', async () => {
    const user = userEvent.setup()
    
    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    expect(screen.getByText('11/500')).toBeInTheDocument()
  })

  it('limits prompt length', async () => {
    const user = userEvent.setup()
    
    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    const longText = 'A'.repeat(600) // Exceeds 500 character limit
    
    await user.type(promptInput, longText)
    
    expect(promptInput).toHaveValue('A'.repeat(500))
    expect(screen.getByText('500/500')).toBeInTheDocument()
  })

  it('shows advanced options toggle', async () => {
    const user = userEvent.setup()
    
    render(<AIEmailGenerator {...defaultProps} />)
    
    const advancedToggle = screen.getByText('Opções Avançadas')
    await user.click(advancedToggle)
    
    expect(screen.getByText('Palavras-chave')).toBeInTheDocument()
    expect(screen.getByText('CTA Sugerido')).toBeInTheDocument()
  })

  it('includes advanced options in generation request', async () => {
    const user = userEvent.setup()
    
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { subject: 'Test', content: 'Test content' },
      }),
    })

    render(<AIEmailGenerator {...defaultProps} />)
    
    // Open advanced options
    const advancedToggle = screen.getByText('Opções Avançadas')
    await user.click(advancedToggle)
    
    // Fill advanced fields
    const keywordsInput = screen.getByPlaceholderText('desconto, promoção, limitado')
    await user.type(keywordsInput, 'desconto, oferta')
    
    const ctaInput = screen.getByPlaceholderText('Compre Agora, Saiba Mais, etc.')
    await user.type(ctaInput, 'Aproveite Agora')
    
    // Fill required fields
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test prompt',
          type: 'newsletter',
          tone: 'professional',
          target_audience: 'consumers',
          company_info: '',
          keywords: 'desconto, oferta',
          cta: 'Aproveite Agora',
        }),
      })
    })
  })

  it('disables generation button when loading', async () => {
    const user = userEvent.setup()
    
    global.fetch = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { subject: 'Test', content: 'Test content' },
        }),
      }), 100))
    )

    render(<AIEmailGenerator {...defaultProps} />)
    
    const promptInput = screen.getByPlaceholderText('Descreva o tipo de email que você quer gerar...')
    await user.type(promptInput, 'Test prompt')
    
    const generateButton = screen.getByText('Gerar Email')
    await user.click(generateButton)
    
    expect(generateButton).toBeDisabled()
    expect(screen.getByText('Gerando...')).toBeInTheDocument()
  })
})