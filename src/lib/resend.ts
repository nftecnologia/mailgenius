import { Resend } from 'resend'

// Initialize Resend client
export const resend = new Resend(process.env.RESEND_API_KEY)

export interface SendEmailParams {
  to: string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  tags?: { name: string; value: string }[]
}

export interface EmailResponse {
  id: string
  success: boolean
  error?: string
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResponse> {
  try {
    const { data, error } = await resend.emails.send({
      from: params.from || 'noreply@yourapp.com', // Configure this with your domain
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      tags: params.tags,
    })

    if (error) {
      console.error('Resend error:', error)
      return {
        id: '',
        success: false,
        error: error.message || 'Failed to send email'
      }
    }

    return {
      id: data?.id || '',
      success: true
    }
  } catch (error) {
    console.error('Unexpected error sending email:', error)
    return {
      id: '',
      success: false,
      error: 'Unexpected error occurred'
    }
  }
}

export async function sendBulkEmails(emails: SendEmailParams[]): Promise<EmailResponse[]> {
  // For bulk emails, we'll send them one by one
  // In production, you might want to implement proper queuing with BullMQ or similar
  const results: EmailResponse[] = []

  for (const email of emails) {
    const result = await sendEmail(email)
    results.push(result)

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}

export function replaceEmailVariables(template: string, variables: Record<string, string>): string {
  let result = template

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, value)
  })

  return result
}

export function extractEmailVariables(template: string): string[] {
  const regex = /{{\\s*([^}]+)\\s*}}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(template)) !== null) {
    const variable = match[1].trim()
    if (!variables.includes(variable)) {
      variables.push(variable)
    }
  }

  return variables
}

// Webhook verification for Resend webhooks
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    return signature === expectedSignature
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

// Email templates
export const defaultEmailTemplates = {
  welcome: {
    subject: 'Bem-vindo(a) {{name}}!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Bem-vindo(a), {{name}}!</h1>
        <p>Obrigado por se juntar a nós. Estamos animados para tê-lo(a) conosco!</p>
        <p>{{company}} - {{position}}</p>
        <p>Atenciosamente,<br>Equipe EmailSend</p>
      </div>
    `,
    text: 'Bem-vindo(a), {{name}}! Obrigado por se juntar a nós.'
  },
  newsletter: {
    subject: 'Newsletter {{month}} - {{company}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Newsletter {{month}}</h1>
        <p>Olá {{name}},</p>
        <p>Confira as novidades deste mês:</p>
        <ul>
          <li>Novidade 1</li>
          <li>Novidade 2</li>
          <li>Novidade 3</li>
        </ul>
        <p>Atenciosamente,<br>{{company}}</p>
      </div>
    `,
    text: 'Newsletter {{month}} - Olá {{name}}, confira as novidades deste mês.'
  },
  promotion: {
    subject: 'Oferta especial para {{name}} - {{discount}}% OFF',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Oferta Especial!</h1>
        <p>Olá {{name}},</p>
        <p>Temos uma oferta especial para você: <strong>{{discount}}% OFF</strong></p>
        <p>Use o código: <strong>{{code}}</strong></p>
        <a href="{{link}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          Aproveitar Oferta
        </a>
        <p>Atenciosamente,<br>{{company}}</p>
      </div>
    `,
    text: 'Oferta especial para {{name}} - {{discount}}% OFF. Use o código: {{code}}'
  }
}
