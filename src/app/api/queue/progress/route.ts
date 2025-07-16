import { NextRequest, NextResponse } from 'next/server'
import { progressTracker } from '@/lib/queue/progress-tracker'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const progressId = searchParams.get('id')
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    if (progressId) {
      // Get specific progress
      const progress = await progressTracker.getProgress(progressId)
      if (!progress || progress.userId !== userId) {
        return NextResponse.json({ error: 'Progress not found' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        progress,
      })
    } else {
      // Get all progress for user
      const allProgress = await progressTracker.getUserProgress(userId)
      const stats = await progressTracker.getProgressStats(userId)

      return NextResponse.json({
        success: true,
        progress: allProgress,
        stats,
      })
    }
  } catch (error) {
    console.error('Progress API error:', error)
    return NextResponse.json(
      { error: 'Failed to get progress' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const progressId = searchParams.get('id')
    const userId = request.headers.get('x-user-id')

    if (!userId || !progressId) {
      return NextResponse.json({ error: 'User ID and Progress ID required' }, { status: 400 })
    }

    // Verify ownership
    const progress = await progressTracker.getProgress(progressId)
    if (!progress || progress.userId !== userId) {
      return NextResponse.json({ error: 'Progress not found' }, { status: 404 })
    }

    // Delete progress
    const deleted = await progressTracker.deleteProgress(progressId)

    return NextResponse.json({
      success: deleted,
      message: deleted ? 'Progress deleted' : 'Failed to delete progress',
    })
  } catch (error) {
    console.error('Delete progress API error:', error)
    return NextResponse.json(
      { error: 'Failed to delete progress' },
      { status: 500 }
    )
  }
}