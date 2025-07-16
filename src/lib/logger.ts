import { NextRequest } from 'next/server'
import crypto from 'crypto'

// Log levels in order of severity
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

// Log context interface for structured logging
export interface LogContext {
  userId?: string
  workspaceId?: string
  requestId?: string
  userAgent?: string
  ip?: string
  path?: string
  method?: string
  duration?: number
  statusCode?: number
  error?: Error
  metadata?: Record<string, any>
}

// Sensitive data patterns to sanitize
const SENSITIVE_PATTERNS = {
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  API_KEY: /\b(?:es_live_|sk_|pk_)[A-Za-z0-9_-]+/g,
  PASSWORD: /(?:password|passwd|pwd|secret|token|auth|key|credential)["']?\s*[:=]\s*["']?[^"'\s,}]+/gi,
  JWT: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  PHONE: /\b(?:\+?55\s?)?(?:\(?[1-9]{2}\)?\s?)?(?:9\d{4}[-.\s]?\d{4}|\d{4}[-.\s]?\d{4})\b/g,
  CPF: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  CREDIT_CARD: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
  UUID: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  IP: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
}

// Sensitive object keys to redact
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'auth',
  'key',
  'credential',
  'authorization',
  'session',
  'cookie',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'private_key',
  'public_key',
  'webhook_secret',
  'database_url',
  'connection_string',
  'email',
  'user_metadata',
  'identities'
]

class Logger {
  private level: LogLevel
  private isProduction: boolean
  private enableConsole: boolean
  private enableFile: boolean
  private enableStructured: boolean

  constructor() {
    this.level = this.getLogLevel()
    this.isProduction = process.env.NODE_ENV === 'production'
    this.enableConsole = process.env.LOGGING_CONSOLE !== 'false'
    this.enableFile = process.env.LOGGING_FILE === 'true'
    this.enableStructured = process.env.LOGGING_STRUCTURED === 'true'
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO'
    
    if (process.env.NODE_ENV === 'production') {
      return LogLevel.WARN // Only warn and error in production
    }
    
    switch (level) {
      case 'DEBUG': return LogLevel.DEBUG
      case 'INFO': return LogLevel.INFO
      case 'WARN': return LogLevel.WARN
      case 'ERROR': return LogLevel.ERROR
      case 'FATAL': return LogLevel.FATAL
      default: return LogLevel.INFO
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level
  }

  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeString(data)
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item))
    }
    
    if (data && typeof data === 'object') {
      return this.sanitizeObject(data)
    }
    
    return data
  }

  private sanitizeString(str: string): string {
    let sanitized = str
    
    // Replace sensitive patterns
    Object.entries(SENSITIVE_PATTERNS).forEach(([type, pattern]) => {
      sanitized = sanitized.replace(pattern, `[REDACTED_${type}]`)
    })
    
    return sanitized
  }

  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    const sanitized: any = Array.isArray(obj) ? [] : {}
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase()
      
      if (SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
        sanitized[key] = '[REDACTED]'
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value)
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value)
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const levelStr = LogLevel[level]
    
    let formatted = `[${timestamp}] [${levelStr}]`
    
    if (context?.requestId) {
      formatted += ` [${context.requestId}]`
    }
    
    if (context?.path) {
      formatted += ` [${context.method || 'GET'} ${context.path}]`
    }
    
    if (context?.userId) {
      formatted += ` [user:${context.userId.slice(0, 8)}...]`
    }
    
    formatted += ` ${message}`
    
    return formatted
  }

  private writeLog(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return
    }

    const sanitizedContext = context ? this.sanitizeData(context) : undefined
    const sanitizedMessage = this.sanitizeString(message)
    
    if (this.enableConsole) {
      const formatted = this.formatMessage(level, sanitizedMessage, sanitizedContext)
      
      if (this.enableStructured) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: LogLevel[level],
          message: sanitizedMessage,
          context: sanitizedContext,
          error: error ? {
            name: error.name,
            message: this.sanitizeString(error.message),
            stack: this.isProduction ? undefined : error.stack
          } : undefined
        }
        
        this.logToConsole(level, JSON.stringify(logEntry, null, 2))
      } else {
        this.logToConsole(level, formatted)
      }
    }

    // Future: Add file logging, external service logging, etc.
    if (this.enableFile) {
      // TODO: Implement file logging
    }
  }

  private logToConsole(level: LogLevel, message: string): void {
    if (!this.enableConsole) return
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message)
        break
      case LogLevel.INFO:
        console.info(message)
        break
      case LogLevel.WARN:
        console.warn(message)
        break
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message)
        break
    }
  }

  // Public logging methods
  debug(message: string, context?: LogContext): void {
    this.writeLog(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext): void {
    this.writeLog(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.writeLog(LogLevel.WARN, message, context)
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.writeLog(LogLevel.ERROR, message, context, error)
  }

  fatal(message: string, context?: LogContext, error?: Error): void {
    this.writeLog(LogLevel.FATAL, message, context, error)
  }

  // Specialized logging methods
  http(request: NextRequest, response: { status: number }, duration: number): void {
    const context: LogContext = {
      path: request.nextUrl.pathname,
      method: request.method,
      statusCode: response.status,
      duration,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.ip || request.headers.get('x-forwarded-for') || undefined
    }

    const message = `HTTP ${request.method} ${request.nextUrl.pathname} ${response.status} - ${duration}ms`
    
    if (response.status >= 400) {
      this.error(message, context)
    } else {
      this.info(message, context)
    }
  }

  auth(event: string, userId?: string, context?: Partial<LogContext>): void {
    const message = `Auth: ${event}`
    this.info(message, { ...context, userId })
  }

  webhook(event: string, data: any, context?: Partial<LogContext>): void {
    const sanitizedData = this.sanitizeData(data)
    const message = `Webhook: ${event}`
    this.info(message, { ...context, metadata: sanitizedData })
  }

  api(endpoint: string, method: string, userId?: string, context?: Partial<LogContext>): void {
    const message = `API: ${method} ${endpoint}`
    this.info(message, { ...context, userId, path: endpoint, method })
  }

  security(event: string, context?: LogContext): void {
    const message = `Security: ${event}`
    this.warn(message, context)
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    const message = `Performance: ${operation} took ${duration}ms`
    
    if (duration > 5000) {
      this.warn(message, { ...context, duration })
    } else {
      this.info(message, { ...context, duration })
    }
  }

  // Helper to create request context
  createRequestContext(request: NextRequest, additionalContext?: Partial<LogContext>): LogContext {
    return {
      requestId: crypto.randomUUID(),
      path: request.nextUrl.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.ip || request.headers.get('x-forwarded-for') || undefined,
      ...additionalContext
    }
  }
}

// Create singleton instance
export const logger = new Logger()

// Convenience exports
export const log = logger
export default logger