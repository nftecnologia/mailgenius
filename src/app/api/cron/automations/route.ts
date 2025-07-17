import { NextRequest, NextResponse } from 'next/server'
import { automationEngine } from '@/lib/automation/automation-engine'

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request
    const authHeader = request.headers.get('authorization')
    const userAgent = request.headers.get('user-agent')
    const cronSecret = process.env.CRON_SECRET

    // Check for Vercel Cron or manual cron authentication
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Valid cron secret
    } else if (userAgent?.includes('Vercel-Cron')) {
      // Vercel cron job
    } else {
      console.log('Unauthorized cron request:', { authHeader, userAgent })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting automation cron job...')
    
    // Process scheduled automation runs
    await automationEngine.processScheduledRuns()

    console.log('Automation cron job completed successfully')

    return NextResponse.json({ 
      success: true, 
      message: 'Automation cron job completed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in automation cron job:', error)
    return NextResponse.json(
      { 
        error: 'Cron job failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Allow both GET and POST for different cron services
export async function POST(request: NextRequest) {
  return GET(request)
}