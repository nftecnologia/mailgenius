import { initializeMonitoring } from '@/lib/monitoring/init'
import { logger } from '@/lib/logger'

// This function is called when the application starts
export function register() {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
    try {
      // Initialize monitoring system
      initializeMonitoring()
      
      logger.info('MailGenius monitoring instrumentation initialized', {
        metadata: {
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          pid: process.pid
        }
      })
    } catch (error) {
      console.error('Failed to initialize MailGenius monitoring:', error)
    }
  }
}

// Optional: Called when the application shuts down
export function onShutdown() {
  try {
    logger.info('MailGenius monitoring shutdown initiated')
    
    // Any cleanup if needed
    // The alert manager intervals will be cleaned up automatically
    
  } catch (error) {
    console.error('Error during monitoring shutdown:', error)
  }
}