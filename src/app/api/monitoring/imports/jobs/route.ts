import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { redisManager } from '@/lib/redis'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestContext = logger.createRequestContext(request)

  try {
    const redis = redisManager.getClient()
    if (!redis) {
      throw new Error('Redis client not available')
    }

    // Get all import jobs
    const jobKeys = await redis.keys('import:job:*')
    const jobs = await Promise.all(
      jobKeys.map(async (key) => {
        const jobData = await redis.hgetall(key)
        return {
          id: key.replace('import:job:', ''),
          filename: jobData.filename,
          status: jobData.status,
          totalRecords: parseInt(jobData.totalRecords || '0'),
          processedRecords: parseInt(jobData.processedRecords || '0'),
          validRecords: parseInt(jobData.validRecords || '0'),
          invalidRecords: parseInt(jobData.invalidRecords || '0'),
          duplicateRecords: parseInt(jobData.duplicateRecords || '0'),
          errorRecords: parseInt(jobData.errorRecords || '0'),
          startTime: parseInt(jobData.startTime || '0'),
          endTime: jobData.endTime ? parseInt(jobData.endTime) : undefined,
          throughput: parseFloat(jobData.throughput || '0'),
          errors: JSON.parse(jobData.errors || '[]'),
          validation: JSON.parse(jobData.validation || '{}')
        }
      })
    )

    // Sort by start time (newest first)
    jobs.sort((a, b) => b.startTime - a.startTime)

    logger.info('Import jobs retrieved', {
      ...requestContext,
      duration: Date.now() - startTime,
      metadata: { count: jobs.length }
    })

    return NextResponse.json(jobs)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to retrieve import jobs', {
      ...requestContext,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(errorMessage)
    })
    
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}