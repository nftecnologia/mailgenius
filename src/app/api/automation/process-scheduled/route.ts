import { NextRequest, NextResponse } from 'next/server'
import { automationEngine } from '@/lib/automation/automation-engine'

export async function POST(request: NextRequest) {
  try {
    // Basic authentication check for cron jobs
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Process scheduled automation runs
    await automationEngine.processScheduledRuns()

    return NextResponse.json({ 
      success: true, 
      message: 'Scheduled automation runs processed successfully' 
    })
  } catch (error) {
    console.error('Error processing scheduled runs:', error)
    return NextResponse.json(
      { error: 'Failed to process scheduled runs' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Health check endpoint
    return NextResponse.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString() 
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 500 }
    )
  }
}