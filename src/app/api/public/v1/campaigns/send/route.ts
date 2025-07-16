import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { authenticateAPIRequest, APIPermission, createAPIResponse, createAPIError } from '@/lib/api-auth'
import { RateLimitHelper } from '@/lib/rate-limit-helpers'

export async function POST(request: NextRequest) {
  try {
    // Authenticate API request
    const user = await authenticateAPIRequest(request)

    // Check rate limiting for campaign sending (strict limit)
    const rateLimitInfo = await RateLimitHelper.checkCampaignSendingLimit(request)
    if (!rateLimitInfo.allowed) {
      return RateLimitHelper.createRateLimitError(rateLimitInfo)
    }

    // Check permissions
    if (!user.permissions.includes('campaigns:send' as APIPermission)) {
      return createAPIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS')
    }

    const body = await request.json()
    const { campaign_id, send_immediately = false } = body

    if (!campaign_id) {
      return createAPIError('Campaign ID is required', 400, 'VALIDATION_ERROR')
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
      .eq('id', campaign_id)
      .eq('workspace_id', user.workspace_id)
      .single()

    if (campaignError || !campaign) {
      return createAPIError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
    }

    // Validate campaign status
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return createAPIError('Campaign cannot be sent in current status', 400, 'INVALID_STATUS')
    }

    // Check if immediate send or scheduled
    if (!send_immediately && !campaign.send_at) {
      return createAPIError('Campaign must have send_at date or send_immediately must be true', 400, 'VALIDATION_ERROR')
    }

    // If sending immediately, check that we have content
    if (send_immediately) {
      if (!campaign.email_templates && !campaign.content) {
        return createAPIError('Campaign must have template or content to send immediately', 400, 'NO_CONTENT')
      }
    }

    // Get target leads
    const leadsQuery = supabase
      .from('leads')
      .select('*')
      .eq('workspace_id', user.workspace_id)
      .eq('status', 'active')

    // Apply segment filtering if specified
    if (campaign.segment_id && campaign.lead_segments?.conditions) {
      // Here you would apply the segment conditions
      // For now, we'll just get all active leads
    }

    const { data: leads, error: leadsError } = await leadsQuery

    if (leadsError) {
      return createAPIError('Error fetching leads', 500, 'DATABASE_ERROR')
    }

    if (!leads || leads.length === 0) {
      return createAPIError('No active leads found for this campaign', 400, 'NO_LEADS')
    }

    // Update campaign status
    const updateData: any = {
      total_recipients: leads.length,
      updated_at: new Date().toISOString()
    }

    if (send_immediately) {
      updateData.status = 'sending'
      updateData.sent_at = new Date().toISOString()
    } else {
      updateData.status = 'scheduled'
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', campaign_id)

    if (updateError) {
      return createAPIError('Error updating campaign', 500, 'DATABASE_ERROR')
    }

    let sendResult = null

    // If sending immediately, trigger the send process
    if (send_immediately) {
      try {
        // Call the internal send API
        const sendResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/campaigns/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ campaignId: campaign_id })
        })

        if (sendResponse.ok) {
          const sendData = await sendResponse.json()
          sendResult = sendData
        } else {
          // If send fails, revert campaign status
          await supabase
            .from('campaigns')
            .update({
              status: 'draft',
              sent_at: null
            })
            .eq('id', campaign_id)

          return createAPIError('Failed to send campaign', 500, 'SEND_FAILED')
        }
      } catch (sendError) {
        console.error('Error sending campaign:', sendError)

        // Revert campaign status
        await supabase
          .from('campaigns')
          .update({
            status: 'draft',
            sent_at: null
          })
          .eq('id', campaign_id)

        return createAPIError('Failed to send campaign', 500, 'SEND_FAILED')
      }
    }

    const response: any = {
      campaign_id,
      status: send_immediately ? 'sending' : 'scheduled',
      total_recipients: leads.length,
      message: send_immediately ? 'Campaign is being sent' : 'Campaign has been scheduled'
    }

    if (sendResult) {
      response.send_stats = sendResult.stats
    }

    if (!send_immediately && campaign.send_at) {
      response.scheduled_for = campaign.send_at
    }

    return createAPIResponse(response, send_immediately ? 200 : 202, rateLimitInfo.headers)

  } catch (error) {
    console.error('Public API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('Token de autorização') || error.message.includes('API key')) {
        return createAPIError(error.message, 401, 'UNAUTHORIZED')
      }
      return createAPIError(error.message, 400, 'BAD_REQUEST')
    }

    return createAPIError('Internal server error', 500, 'INTERNAL_ERROR')
  }
}
