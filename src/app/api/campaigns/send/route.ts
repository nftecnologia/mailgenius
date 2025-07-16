import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { sendEmail, replaceEmailVariables } from '@/lib/resend'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

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
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.status !== 'scheduled' && campaign.status !== 'draft') {
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
      return NextResponse.json(
        { error: 'No leads found for this campaign' },
        { status: 400 }
      )
    }

    // Update campaign status to sending
    await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        total_recipients: leads.length,
        sent_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    let successCount = 0
    let errorCount = 0

    // Send emails to all leads
    for (const lead of leads) {
      try {
        // Prepare variables for template replacement
        const variables = {
          name: lead.name || 'Cliente',
          email: lead.email,
          company: lead.company || '',
          position: lead.position || '',
          phone: lead.phone || '',
          ...lead.custom_fields,
        }

        // Replace variables in email content
        const subject = replaceEmailVariables(
          campaign.email_templates?.subject || campaign.subject,
          variables
        )
        const htmlContent = replaceEmailVariables(
          campaign.email_templates?.html_content || '',
          variables
        )
        const textContent = campaign.email_templates?.text_content
          ? replaceEmailVariables(campaign.email_templates.text_content, variables)
          : undefined

        // Send email via Resend
        const emailResult = await sendEmail({
          to: [lead.email],
          subject,
          html: htmlContent,
          text: textContent,
          from: 'noreply@yourapp.com', // Configure with your domain
          tags: [
            { name: 'campaign_id', value: campaignId },
            { name: 'workspace_id', value: campaign.workspace_id }
          ]
        })

        // Record email send status
        await supabase
          .from('email_sends')
          .insert({
            workspace_id: campaign.workspace_id,
            campaign_id: campaignId,
            lead_id: lead.id,
            email: lead.email,
            status: emailResult.success ? 'sent' : 'failed',
            resend_id: emailResult.id,
            sent_at: emailResult.success ? new Date().toISOString() : null,
            error_message: emailResult.error || null
          })

        if (emailResult.success) {
          successCount++
        } else {
          errorCount++
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error sending email to ${lead.email}:`, error)
        errorCount++

        // Record failed send
        await supabase
          .from('email_sends')
          .insert({
            workspace_id: campaign.workspace_id,
            campaign_id: campaignId,
            lead_id: lead.id,
            email: lead.email,
            status: 'failed',
            error_message: 'Unexpected error occurred'
          })
      }
    }

    // Update campaign with final stats
    await supabase
      .from('campaigns')
      .update({
        status: 'sent',
        delivered: successCount // This will be updated by webhooks later
      })
      .eq('id', campaignId)

    return NextResponse.json({
      success: true,
      message: `Campaign sent successfully`,
      stats: {
        totalRecipients: leads.length,
        successful: successCount,
        failed: errorCount
      }
    })

  } catch (error) {
    console.error('Error sending campaign:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
