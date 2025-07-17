// This function is called when the application starts
export function register() {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
    try {
      console.log('MailGenius monitoring instrumentation initialized', {
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
    console.log('MailGenius monitoring shutdown initiated')
  } catch (error) {
    console.error('Error during monitoring shutdown:', error)
  }
}