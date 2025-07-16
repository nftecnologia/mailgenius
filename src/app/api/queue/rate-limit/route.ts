import { NextRequest, NextResponse } from 'next/server'
import { intelligentRateLimiter } from '@/lib/queue/rate-limiter'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const identifier = searchParams.get('identifier')
    const configKey = searchParams.get('configKey')
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    if (!identifier || !configKey) {
      return NextResponse.json({ error: 'Identifier and configKey required' }, { status: 400 })
    }

    // Get rate limit status
    const status = await intelligentRateLimiter.getRateLimitStatus(identifier, configKey)

    return NextResponse.json({
      success: true,
      rateLimit: status,
    })
  } catch (error) {
    console.error('Rate limit status API error:', error)
    return NextResponse.json(
      { error: 'Failed to get rate limit status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, configKey, customConfig } = body
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    if (!identifier || !configKey) {
      return NextResponse.json({ error: 'Identifier and configKey required' }, { status: 400 })
    }

    // Check rate limit
    const result = await intelligentRateLimiter.checkRateLimit(
      identifier,
      configKey,
      customConfig
    )

    return NextResponse.json({
      success: true,
      rateLimit: result,
    })
  } catch (error) {
    console.error('Rate limit check API error:', error)
    return NextResponse.json(
      { error: 'Failed to check rate limit' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const identifier = searchParams.get('identifier')
    const configKey = searchParams.get('configKey')
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    if (!identifier || !configKey) {
      return NextResponse.json({ error: 'Identifier and configKey required' }, { status: 400 })
    }

    // Reset rate limit
    const reset = await intelligentRateLimiter.resetRateLimit(identifier, configKey)

    return NextResponse.json({
      success: reset,
      message: reset ? 'Rate limit reset' : 'Failed to reset rate limit',
    })
  } catch (error) {
    console.error('Reset rate limit API error:', error)
    return NextResponse.json(
      { error: 'Failed to reset rate limit' },
      { status: 500 }
    )
  }
}