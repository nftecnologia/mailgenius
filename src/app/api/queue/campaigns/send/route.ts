import { NextRequest, NextResponse } from 'next/server'
import { emailSendingService } from '@/lib/queue/jobs/email-sending'
import { progressTracker } from '@/lib/queue/progress-tracker'
import { intelligentRateLimiter } from '@/lib/queue/rate-limiter'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const sendCampaignSchema = z.object({
  campaignId: z.string(),
  recipients: z.array(z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })),
  template: z.object({
    subject: z.string(),
    html: z.string(),
    text: z.string().optional(),
  }),
  sender: z.object({
    email: z.string().email(),
    name: z.string().optional(),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId, recipients, template, sender } = sendCampaignSchema.parse(body)

    // Get user from header or auth
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Check rate limit
    const rateLimit = await intelligentRateLimiter.checkRateLimit(
      userId,
      'email-sending'
    )

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime,
          remaining: rateLimit.remaining
        },
        { status: 429 }
      )
    }

    // Start email sending process
    const sendId = await emailSendingService.sendCampaignEmails(
      campaignId,
      recipients,
      template,
      sender,
      userId
    )

    // Create progress tracker
    await progressTracker.createProgress(
      sendId,
      'email-sending',
      userId,
      recipients.length,
      { 
        campaignId,
        sendType: 'campaign' 
      }
    )

    return NextResponse.json({
      success: true,
      sendId,
      message: `Started sending to ${recipients.length} recipients`,
    })
  } catch (error) {
    console.error('Campaign send API error:', error)
    return NextResponse.json(
      { error: 'Failed to start campaign send' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const sendId = searchParams.get('sendId')
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    if (sendId) {
      // Get specific send progress
      const progress = await progressTracker.getProgress(sendId)
      if (!progress || progress.userId !== userId) {
        return NextResponse.json({ error: 'Send not found' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        progress,
      })
    } else if (campaignId) {
      // Get campaign send progress
      const sendProgress = await emailSendingService.getCampaignSendProgress(campaignId)
      
      return NextResponse.json({
        success: true,
        progress: sendProgress,
      })
    } else {
      // Get all email sends for user
      const allProgress = await progressTracker.getUserProgress(userId)
      const emailSends = allProgress.filter(p => p.type === 'email-sending')

      return NextResponse.json({
        success: true,
        sends: emailSends,
      })
    }
  } catch (error) {
    console.error('Get send progress API error:', error)
    return NextResponse.json(
      { error: 'Failed to get send progress' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const userId = request.headers.get('x-user-id')

    if (!userId || !campaignId) {
      return NextResponse.json({ error: 'User ID and Campaign ID required' }, { status: 400 })
    }

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Cancel the campaign send
    const cancelled = await emailSendingService.cancelCampaignSend(campaignId)
    
    if (cancelled) {
      // Update progress if exists
      const allProgress = await progressTracker.getUserProgress(userId)
      const campaignSends = allProgress.filter(p => 
        p.type === 'email-sending' && 
        p.metadata?.campaignId === campaignId &&
        p.status === 'processing'
      )

      for (const send of campaignSends) {
        await progressTracker.updateProgress(send.id, {
          status: 'cancelled',
          message: 'Campaign send cancelled by user',
        })
      }
    }

    return NextResponse.json({
      success: cancelled,
      message: cancelled ? 'Campaign send cancelled' : 'Failed to cancel campaign send',
    })
  } catch (error) {
    console.error('Cancel campaign send API error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel campaign send' },
      { status: 500 }
    )
  }
}