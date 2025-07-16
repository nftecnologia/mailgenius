import { NextRequest, NextResponse } from 'next/server'
import { leadsImportService } from '@/lib/queue/jobs/leads-import'
import { progressTracker } from '@/lib/queue/progress-tracker'
import { intelligentRateLimiter } from '@/lib/queue/rate-limiter'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const importLeadsSchema = z.object({
  leads: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    phone: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  })),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leads } = importLeadsSchema.parse(body)

    // Get user from header or auth
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    // Check rate limit
    const rateLimit = await intelligentRateLimiter.checkRateLimit(
      userId,
      'lead-import'
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

    // Start import process
    const importId = await leadsImportService.importLeads(userId, leads)

    // Create progress tracker
    await progressTracker.createProgress(
      importId,
      'leads-import',
      userId,
      leads.length,
      { importType: 'manual' }
    )

    return NextResponse.json({
      success: true,
      importId,
      message: `Started importing ${leads.length} leads`,
    })
  } catch (error) {
    console.error('Leads import API error:', error)
    return NextResponse.json(
      { error: 'Failed to start import' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('importId')
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    if (importId) {
      // Get specific import progress
      const progress = await progressTracker.getProgress(importId)
      if (!progress || progress.userId !== userId) {
        return NextResponse.json({ error: 'Import not found' }, { status: 404 })
      }

      const importProgress = await leadsImportService.getImportProgress(importId)
      
      return NextResponse.json({
        success: true,
        progress: {
          ...progress,
          details: importProgress,
        },
      })
    } else {
      // Get all imports for user
      const allProgress = await progressTracker.getUserProgress(userId)
      const importProgress = allProgress.filter(p => p.type === 'leads-import')

      return NextResponse.json({
        success: true,
        imports: importProgress,
      })
    }
  } catch (error) {
    console.error('Get import progress API error:', error)
    return NextResponse.json(
      { error: 'Failed to get import progress' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('importId')
    const userId = request.headers.get('x-user-id')

    if (!userId || !importId) {
      return NextResponse.json({ error: 'User ID and Import ID required' }, { status: 400 })
    }

    // Verify ownership
    const progress = await progressTracker.getProgress(importId)
    if (!progress || progress.userId !== userId) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    // Cancel the import
    const cancelled = await leadsImportService.cancelImport(importId)
    
    if (cancelled) {
      await progressTracker.updateProgress(importId, {
        status: 'cancelled',
        message: 'Import cancelled by user',
      })
    }

    return NextResponse.json({
      success: cancelled,
      message: cancelled ? 'Import cancelled' : 'Failed to cancel import',
    })
  } catch (error) {
    console.error('Cancel import API error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel import' },
      { status: 500 }
    )
  }
}