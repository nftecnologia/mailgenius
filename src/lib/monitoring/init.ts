import { alertManager } from './alerts'
import { logger } from '../logger'

// Initialize monitoring system
export function initializeMonitoring() {
  try {
    // Start alert monitoring
    alertManager.startMonitoring(1) // Check every minute
    
    logger.info('Monitoring system initialized successfully', {
      metadata: {
        alertRules: alertManager.getRules().length,
        alertsEnabled: alertManager.getRules().filter(r => r.enabled).length
      }
    })
  } catch (error) {
    logger.error('Failed to initialize monitoring system', {
      error: error instanceof Error ? error : new Error('Unknown error')
    })
  }
}

// Shutdown monitoring system
export function shutdownMonitoring() {
  try {
    logger.info('Monitoring system shutting down')
    
    // Clear any intervals or cleanup here if needed
    // Currently the alert manager uses setInterval which will be cleaned up on process exit
    
  } catch (error) {
    logger.error('Error during monitoring shutdown', {
      error: error instanceof Error ? error : new Error('Unknown error')
    })
  }
}

// Export for Next.js initialization
export { initializeMonitoring as default }