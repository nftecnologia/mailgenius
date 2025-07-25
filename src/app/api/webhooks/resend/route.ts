import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { verifyWebhookSignature } from '@/lib/resend'
import { webhookSchemas } from '@/lib/validation'
import { createValidatedHandler } from '@/lib/validation/middleware'

interface WebhookData {
  email_id: string
  bounce_type?: string
  reason?: string
  url?: string
}

type SupabaseClientType = ReturnType<typeof createSupabaseServerClient>

export async function POST(request: NextRequest) {
  const context = logger.createRequestContext(request)
  
  try {
    const body = await request.text()
    const signature = request.headers.get('resend-signature')

    if (!signature) {
      logger.security('Webhook received without signature', context)
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    // Verify webhook signature (optional but recommended)
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret && !verifyWebhookSignature(body, signature, webhookSecret)) {
      logger.security('Invalid webhook signature', context)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = JSON.parse(body)
    const supabase = createSupabaseServerClient()

    logger.webhook('Received Resend webhook', { type: event.type, email_id: event.data?.email_id }, context)

    // Process different event types
    switch (event.type) {
      case 'email.sent':
        await handleEmailSent(event.data, supabase)
        break

      case 'email.delivered':
        await handleEmailDelivered(event.data, supabase)
        break

      case 'email.bounced':
        await handleEmailBounced(event.data, supabase)
        break

      case 'email.complained':
        await handleEmailComplained(event.data, supabase)
        break

      case 'email.opened':
        await handleEmailOpened(event.data, supabase)
        break

      case 'email.clicked':
        await handleEmailClicked(event.data, supabase)
        break

      default:
        logger.warn('Unhandled webhook event type', { ...context, metadata: { eventType: event.type } })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    logger.error('Error processing webhook', context, error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleEmailSent(data: WebhookData, supabase: SupabaseClientType) {
  try {
    await supabase
      .from('email_sends')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('resend_id', data.email_id)
  } catch (error) {
    logger.error('Error handling email sent', { metadata: { email_id: data.email_id } }, error as Error)
  }
}

async function handleEmailDelivered(data: WebhookData, supabase: SupabaseClientType) {
  try {
    // Update email send record
    await supabase
      .from('email_sends')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('resend_id', data.email_id)

    // Get the email send to update campaign stats
    const { data: emailSend } = await supabase
      .from('email_sends')
      .select('campaign_id')
      .eq('resend_id', data.email_id)
      .single()

    if (emailSend) {
      // Increment delivered count for campaign
      await supabase.rpc('increment_campaign_delivered', {
        campaign_id: emailSend.campaign_id
      })
    }
  } catch (error) {
    logger.error('Error handling email delivered', { metadata: { email_id: data.email_id } }, error as Error)
  }
}

async function handleEmailBounced(data: WebhookData, supabase: SupabaseClientType) {
  try {
    // Update email send record
    await supabase
      .from('email_sends')
      .update({
        status: 'bounced',
        bounced_at: new Date().toISOString(),
        error_message: data.reason || 'Email bounced'
      })
      .eq('resend_id', data.email_id)

    // Get the email send to update campaign and lead
    const { data: emailSend } = await supabase
      .from('email_sends')
      .select('campaign_id, lead_id, email')
      .eq('resend_id', data.email_id)
      .single()

    if (emailSend) {
      // Increment bounced count for campaign
      await supabase.rpc('increment_campaign_bounced', {
        campaign_id: emailSend.campaign_id
      })

      // Update lead status if hard bounce
      if (data.bounce_type === 'hard') {
        await supabase
          .from('leads')
          .update({ status: 'bounced' })
          .eq('id', emailSend.lead_id)
      }

      // Log activity
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: emailSend.lead_id,
          activity_type: 'email_bounced',
          activity_data: {
            email_id: data.email_id,
            bounce_type: data.bounce_type,
            reason: data.reason
          }
        })
    }
  } catch (error) {
    logger.error('Error handling email bounced', { metadata: { email_id: data.email_id } }, error as Error)
  }
}

async function handleEmailComplained(data: WebhookData, supabase: SupabaseClientType) {
  try {
    // Update email send record
    await supabase
      .from('email_sends')
      .update({
        status: 'complained',
        complained_at: new Date().toISOString()
      })
      .eq('resend_id', data.email_id)

    // Get the email send to update campaign and lead
    const { data: emailSend } = await supabase
      .from('email_sends')
      .select('campaign_id, lead_id, email')
      .eq('resend_id', data.email_id)
      .single()

    if (emailSend) {
      // Increment complained count for campaign
      await supabase.rpc('increment_campaign_complained', {
        campaign_id: emailSend.campaign_id
      })

      // Update lead status
      await supabase
        .from('leads')
        .update({ status: 'complained' })
        .eq('id', emailSend.lead_id)

      // Log activity
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: emailSend.lead_id,
          activity_type: 'email_complained',
          activity_data: {
            email_id: data.email_id
          }
        })
    }
  } catch (error) {
    logger.error('Error handling email complained', { metadata: { email_id: data.email_id } }, error as Error)
  }
}

async function handleEmailOpened(data: WebhookData, supabase: SupabaseClientType) {
  try {
    // Update email send record (only first open)
    const { data: existingOpen } = await supabase
      .from('email_sends')
      .select('opened_at')
      .eq('resend_id', data.email_id)
      .single()

    if (existingOpen && !existingOpen.opened_at) {
      await supabase
        .from('email_sends')
        .update({
          opened_at: new Date().toISOString()
        })
        .eq('resend_id', data.email_id)

      // Get the email send to update campaign
      const { data: emailSend } = await supabase
        .from('email_sends')
        .select('campaign_id, lead_id')
        .eq('resend_id', data.email_id)
        .single()

      if (emailSend) {
        // Increment opened count for campaign
        await supabase.rpc('increment_campaign_opened', {
          campaign_id: emailSend.campaign_id
        })

        // Log activity
        await supabase
          .from('lead_activities')
          .insert({
            lead_id: emailSend.lead_id,
            activity_type: 'email_opened',
            activity_data: {
              email_id: data.email_id,
              opened_at: new Date().toISOString()
            }
          })
      }
    }
  } catch (error) {
    logger.error('Error handling email opened', { metadata: { email_id: data.email_id } }, error as Error)
  }
}

async function handleEmailClicked(data: WebhookData, supabase: SupabaseClientType) {
  try {
    // Update email send record (only first click)
    const { data: existingClick } = await supabase
      .from('email_sends')
      .select('clicked_at')
      .eq('resend_id', data.email_id)
      .single()

    if (existingClick && !existingClick.clicked_at) {
      await supabase
        .from('email_sends')
        .update({
          clicked_at: new Date().toISOString()
        })
        .eq('resend_id', data.email_id)

      // Get the email send to update campaign
      const { data: emailSend } = await supabase
        .from('email_sends')
        .select('campaign_id, lead_id')
        .eq('resend_id', data.email_id)
        .single()

      if (emailSend) {
        // Increment clicked count for campaign
        await supabase.rpc('increment_campaign_clicked', {
          campaign_id: emailSend.campaign_id
        })

        // Log activity
        await supabase
          .from('lead_activities')
          .insert({
            lead_id: emailSend.lead_id,
            activity_type: 'email_clicked',
            activity_data: {
              email_id: data.email_id,
              url: data.url,
              clicked_at: new Date().toISOString()
            }
          })
      }
    }
  } catch (error) {
    logger.error('Error handling email clicked', { metadata: { email_id: data.email_id } }, error as Error)
  }
}
