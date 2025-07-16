import { apiKeyNotificationService } from '@/lib/api-key-notifications'
import { NextRequest, NextResponse } from 'next/server'

// This endpoint should be called by a cron job (e.g., Vercel Cron Jobs)
// or can be triggered manually for testing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cronSecret = searchParams.get('secret')
    
    // Verify cron secret (you should set this in environment variables)
    const expectedSecret = process.env.CRON_SECRET || 'default-secret'
    
    if (cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting API key maintenance tasks...')
    
    // 1. Check for expiring keys and create notifications
    await apiKeyNotificationService.checkExpiringKeys()
    console.log('✓ Checked expiring keys')
    
    // 2. Process auto-renewal
    await apiKeyNotificationService.processAutoRenewal()
    console.log('✓ Processed auto-renewal')
    
    // 3. Process notification queue
    await apiKeyNotificationService.processNotificationQueue()
    console.log('✓ Processed notification queue')
    
    console.log('API key maintenance tasks completed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'API key maintenance tasks completed successfully',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error in API key maintenance:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error in API key maintenance',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// For manual testing/triggering
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { task, workspace_id } = body

    console.log(`Manual trigger: ${task} for workspace: ${workspace_id || 'all'}`)

    switch (task) {
      case 'check_expiring':
        await apiKeyNotificationService.checkExpiringKeys(workspace_id)
        break
        
      case 'auto_renew':
        await apiKeyNotificationService.processAutoRenewal(workspace_id)
        break
        
      case 'process_notifications':
        await apiKeyNotificationService.processNotificationQueue(workspace_id)
        break
        
      case 'all':
        await apiKeyNotificationService.checkExpiringKeys(workspace_id)
        await apiKeyNotificationService.processAutoRenewal(workspace_id)
        await apiKeyNotificationService.processNotificationQueue(workspace_id)
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid task. Use: check_expiring, auto_renew, process_notifications, or all' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `Task ${task} completed successfully`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in manual API key task:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error in manual API key task',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}