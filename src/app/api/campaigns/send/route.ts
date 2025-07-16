import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { sendEmail, replaceEmailVariables } from '@/lib/resend'
import { logger } from '@/lib/logger'
import { emailWorkerManager } from '@/lib/email-workers'

export async function POST(request: NextRequest) {
  const context = logger.createRequestContext(request)
  
  try {
    const body = await request.json()
    const { campaignId } = body

    if (!campaignId) {
      logger.warn('Campaign send request missing campaignId', context)
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    logger.api('Campaign send request', 'POST', undefined, { 
      ...context, 
      metadata: { campaignId } 
    })

    const supabase = createSupabaseServerClient()

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        email_templates (
          subject,
          html_content,
          text_content,
          variables
        ),
        lead_segments (
          conditions
        )
      `)
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      logger.warn('Campaign not found', { ...context, metadata: { campaignId } })
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.status !== 'scheduled' && campaign.status !== 'draft') {
      logger.warn('Campaign cannot be sent in current status', { 
        ...context, 
        metadata: { campaignId, status: campaign.status } 
      })
      return NextResponse.json(
        { error: 'Campaign cannot be sent in current status' },
        { status: 400 }
      )
    }

    // Get leads for the campaign
    const leadsQuery = supabase
      .from('leads')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('status', 'active')

    // Apply segment filtering if specified
    if (campaign.segment_id && campaign.lead_segments?.conditions) {
      // Here you would apply the segment conditions
      // For now, we'll just get all active leads
    }

    const { data: leads, error: leadsError } = await leadsQuery

    if (leadsError || !leads || leads.length === 0) {
      logger.warn('No leads found for campaign', { 
        ...context, 
        metadata: { campaignId, leadCount: leads?.length || 0 } 
      })
      return NextResponse.json(
        { error: 'No leads found for this campaign' },
        { status: 400 }
      )
    }

    // Update campaign status to queued
    logger.info('Queuing campaign for parallel processing', { 
      ...context, 
      metadata: { campaignId, recipientCount: leads.length } 
    })
    
    await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        total_recipients: leads.length,
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    // Create job payload for worker system
    const jobPayload = {
      campaign_id: campaignId,
      template_id: campaign.template_id,
      leads: leads.map(lead => ({
        id: lead.id,
        email: lead.email,
        name: lead.name,
        company: lead.company,
        position: lead.position,
        phone: lead.phone,
        custom_fields: lead.custom_fields
      })),
      template_data: {
        subject: campaign.email_templates?.subject || campaign.subject,
        html_content: campaign.email_templates?.html_content || '',
        text_content: campaign.email_templates?.text_content,
        variables: campaign.email_templates?.variables || {}
      },
      sender_info: {
        from: 'noreply@yourapp.com', // Configure with your domain
        reply_to: undefined
      },
      tracking_config: {
        campaign_id: campaignId,
        workspace_id: campaign.workspace_id
      }
    }

    // Create job using worker manager
    const jobId = await emailWorkerManager.createCampaignJob({
      workspace_id: campaign.workspace_id,
      campaign_id: campaignId,
      priority: 0, // Normal priority
      job_type: 'campaign',
      payload: jobPayload,
      batch_size: 100, // Process 100 emails per batch
      max_retries: 3
    })

    logger.info('Campaign job created successfully', { 
      ...context, 
      metadata: { 
        campaignId, 
        jobId,
        totalRecipients: leads.length
      } 
    })

    return NextResponse.json({
      success: true,
      message: `Campaign queued for processing`,
      job_id: jobId,
      stats: {
        totalRecipients: leads.length,
        queued: true,
        batch_size: 100
      }
    })

  } catch (error) {
    logger.error('Error sending campaign', context, error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
