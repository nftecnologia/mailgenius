'use client'

import { useEffect, useState } from 'react'
import { useHydration } from '@/lib/hooks/useHydration'
import { QueryProvider } from '@/components/providers/QueryProvider'

export function ClientBody({ className, children }: { className?: string, children: React.ReactNode }) {
  const isHydrated = useHydration()
  const [bodyClass, setBodyClass] = useState('')

  useEffect(() => {
    if (!isHydrated) return

    // Set body class after hydration
    if (className) {
      setBodyClass(className)
      document.body.className = className
    }

    // Suppress console warnings from external libraries
    const originalWarn = console.warn
    const originalError = console.error
    const originalLog = console.log

    console.warn = (...args) => {
      const message = args[0]?.toString() || ''

      // Suppress hcaptcha warnings
      if (message.includes('hcaptcha') || message.includes('Unable to find hCaptcha')) {
        return
      }

      // Suppress "Unrecognized feature" warnings
      if (message.includes('Unrecognized feature') || message.includes('location')) {
        return
      }

      // Suppress Multiple GoTrueClient warnings
      if (message.includes('Multiple GoTrueClient instances')) {
        return
      }

      originalWarn.apply(console, args)
    }

    console.error = (...args) => {
      const message = args[0]?.toString() || ''

      // Suppress hcaptcha errors
      if (message.includes('hcaptcha') || message.includes('Unable to find hCaptcha')) {
        return
      }

      // Suppress 504 Gateway timeout errors from external services
      if (message.includes('504 (Gateway Time-out)')) {
        return
      }

      originalError.apply(console, args)
    }

    console.log = (...args) => {
      const message = args[0]?.toString() || ''

      // Suppress hcaptcha logs
      if (message.includes('loading hcaptcha')) {
        return
      }

      originalLog.apply(console, args)
    }

    return () => {
      // Restore original console methods
      console.warn = originalWarn
      console.error = originalError
      console.log = originalLog

      // Clean up body class
      if (className) {
        document.body.className = ''
      }
    }
  }, [className, isHydrated])

  // Don't render with className until hydrated to avoid mismatch
  return (
    <QueryProvider>
      <div className={isHydrated ? bodyClass : ''}>
        {children}
      </div>
    </QueryProvider>
  )
}
