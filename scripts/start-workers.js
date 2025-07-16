#!/usr/bin/env node

/**
 * Worker startup script for MailGenius Queue System
 * This script starts all queue workers and handles graceful shutdown
 */

const path = require('path')
const { exec } = require('child_process')

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'production'
process.env.START_WORKERS = 'true'

console.log('🚀 Starting MailGenius Queue Workers...')
console.log(`Environment: ${process.env.NODE_ENV}`)
console.log(`Redis Host: ${process.env.REDIS_HOST || 'localhost'}`)
console.log(`Redis Port: ${process.env.REDIS_PORT || '6379'}`)

// Import worker manager
const { workerManager } = require('../src/lib/queue/workers')

async function startWorkers() {
  try {
    console.log('📦 Initializing queue system...')
    
    // Start workers
    await workerManager.startWorkers()
    
    console.log('✅ All workers started successfully!')
    console.log('📊 Worker Status:', workerManager.getWorkerStatus())
    
    // Set up health check endpoint
    const express = require('express')
    const app = express()
    const port = process.env.WORKER_PORT || 3001
    
    app.get('/health', (req, res) => {
      const status = workerManager.getWorkerStatus()
      res.json({
        status: 'healthy',
        workers: status,
        timestamp: new Date().toISOString()
      })
    })
    
    app.get('/stats', async (req, res) => {
      try {
        const stats = await workerManager.getWorkerStats()
        res.json({
          status: 'success',
          stats,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message
        })
      }
    })
    
    app.listen(port, () => {
      console.log(`🔍 Worker health check available at http://localhost:${port}/health`)
      console.log(`📊 Worker stats available at http://localhost:${port}/stats`)
    })
    
  } catch (error) {
    console.error('❌ Failed to start workers:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  try {
    await workerManager.stopWorkers()
    console.log('✅ Workers stopped successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  try {
    await workerManager.stopWorkers()
    console.log('✅ Workers stopped successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
})

process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught exception:', error)
  try {
    await workerManager.stopWorkers()
  } catch (shutdownError) {
    console.error('❌ Error during emergency shutdown:', shutdownError)
  }
  process.exit(1)
})

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason)
  try {
    await workerManager.stopWorkers()
  } catch (shutdownError) {
    console.error('❌ Error during emergency shutdown:', shutdownError)
  }
  process.exit(1)
})

// Start the workers
startWorkers().catch(console.error)