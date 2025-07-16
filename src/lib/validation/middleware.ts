import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { createAPIError } from '@/lib/api-auth'

// Validation middleware types
export interface ValidationSchemas {
  body?: z.ZodSchema<any>
  query?: z.ZodSchema<any>
  params?: z.ZodSchema<any>
  headers?: z.ZodSchema<any>
}

export interface ValidationResult {
  success: boolean
  data?: {
    body?: any
    query?: any
    params?: any
    headers?: any
  }
  errors?: {
    body?: string[]
    query?: string[]
    params?: string[]
    headers?: string[]
  }
}

// Format Zod error messages
function formatZodError(error: ZodError): string[] {
  return error.errors.map(err => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : ''
    return `${path}${err.message}`
  })
}

// Main validation function
export async function validateRequest(
  request: NextRequest,
  schemas: ValidationSchemas
): Promise<ValidationResult> {
  const errors: ValidationResult['errors'] = {}
  const data: ValidationResult['data'] = {}
  let hasErrors = false

  try {
    // Validate request body
    if (schemas.body) {
      try {
        const contentType = request.headers.get('content-type')
        let body: any

        if (contentType?.includes('application/json')) {
          body = await request.json()
        } else if (contentType?.includes('application/x-www-form-urlencoded')) {
          const formData = await request.formData()
          body = Object.fromEntries(formData)
        } else if (contentType?.includes('multipart/form-data')) {
          const formData = await request.formData()
          body = Object.fromEntries(formData)
        } else {
          body = await request.text()
        }

        data.body = schemas.body.parse(body)
      } catch (error) {
        if (error instanceof ZodError) {
          errors.body = formatZodError(error)
          hasErrors = true
        } else {
          errors.body = ['Invalid request body format']
          hasErrors = true
        }
      }
    }

    // Validate query parameters
    if (schemas.query) {
      try {
        const { searchParams } = new URL(request.url)
        const queryObject = Object.fromEntries(searchParams.entries())
        data.query = schemas.query.parse(queryObject)
      } catch (error) {
        if (error instanceof ZodError) {
          errors.query = formatZodError(error)
          hasErrors = true
        } else {
          errors.query = ['Invalid query parameters']
          hasErrors = true
        }
      }
    }

    // Validate URL parameters (for dynamic routes)
    if (schemas.params) {
      try {
        // This would need to be passed from the route handler
        // For now, we'll extract from the URL or context
        const url = new URL(request.url)
        const pathSegments = url.pathname.split('/').filter(Boolean)
        
        // Extract dynamic parameters based on common patterns
        const params: Record<string, string> = {}
        
        // Look for UUIDs in path segments (common pattern)
        pathSegments.forEach((segment, index) => {
          if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // Try to determine parameter name from previous segment
            const prevSegment = pathSegments[index - 1]
            if (prevSegment) {
              const paramName = prevSegment.endsWith('s') ? prevSegment.slice(0, -1) + '_id' : prevSegment + '_id'
              params[paramName] = segment
            } else {
              params.id = segment
            }
          }
        })

        data.params = schemas.params.parse(params)
      } catch (error) {
        if (error instanceof ZodError) {
          errors.params = formatZodError(error)
          hasErrors = true
        } else {
          errors.params = ['Invalid URL parameters']
          hasErrors = true
        }
      }
    }

    // Validate headers
    if (schemas.headers) {
      try {
        const headers = Object.fromEntries(request.headers.entries())
        data.headers = schemas.headers.parse(headers)
      } catch (error) {
        if (error instanceof ZodError) {
          errors.headers = formatZodError(error)
          hasErrors = true
        } else {
          errors.headers = ['Invalid headers']
          hasErrors = true
        }
      }
    }

    return {
      success: !hasErrors,
      data: hasErrors ? undefined : data,
      errors: hasErrors ? errors : undefined
    }

  } catch (error) {
    return {
      success: false,
      errors: {
        body: ['Failed to validate request']
      }
    }
  }
}

// Validation decorator for route handlers
export function withValidation(schemas: ValidationSchemas) {
  return function <T extends (...args: any[]) => any>(
    target: T,
    context: ClassMethodDecoratorContext<T>
  ) {
    return async function (this: any, request: NextRequest, ...args: any[]) {
      const validation = await validateRequest(request, schemas)
      
      if (!validation.success) {
        const errorMessages = Object.values(validation.errors || {})
          .flat()
          .join(', ')
        
        return createAPIError(
          errorMessages || 'Validation failed',
          400,
          'VALIDATION_ERROR',
          validation.errors
        )
      }
      
      // Add validated data to request context
      ;(request as any).validated = validation.data
      
      return target.call(this, request, ...args)
    }
  }
}

// Helper function to create validation middleware
export function createValidationMiddleware(schemas: ValidationSchemas) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const validation = await validateRequest(request, schemas)
    
    if (!validation.success) {
      const errorMessages = Object.values(validation.errors || {})
        .flat()
        .join(', ')
      
      return createAPIError(
        errorMessages || 'Validation failed',
        400,
        'VALIDATION_ERROR',
        validation.errors
      )
    }
    
    // Add validated data to request
    ;(request as any).validated = validation.data
    
    return null // Continue to next middleware/handler
  }
}

// Helper function to get validated data from request
export function getValidatedData(request: NextRequest): {
  body?: any
  query?: any
  params?: any
  headers?: any
} {
  return (request as any).validated || {}
}

// Error response helper
export function createValidationErrorResponse(
  errors: ValidationResult['errors'],
  message: string = 'Validation failed'
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'VALIDATION_ERROR',
        details: errors
      }
    },
    { status: 400 }
  )
}

// Type-safe route handler wrapper
export function createValidatedHandler<
  TBody = any,
  TQuery = any,
  TParams = any,
  THeaders = any
>(
  schemas: ValidationSchemas,
  handler: (
    request: NextRequest,
    validated: {
      body?: TBody
      query?: TQuery
      params?: TParams
      headers?: THeaders
    },
    context?: any
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const validation = await validateRequest(request, schemas)
    
    if (!validation.success) {
      const errorMessages = Object.values(validation.errors || {})
        .flat()
        .join(', ')
      
      return createAPIError(
        errorMessages || 'Validation failed',
        400,
        'VALIDATION_ERROR',
        validation.errors
      )
    }
    
    return handler(request, validation.data as any, context)
  }
}

// Helper for extracting params from dynamic routes
export function extractParamsFromPath(
  path: string,
  template: string
): Record<string, string> {
  const pathSegments = path.split('/').filter(Boolean)
  const templateSegments = template.split('/').filter(Boolean)
  const params: Record<string, string> = {}
  
  templateSegments.forEach((segment, index) => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const paramName = segment.slice(1, -1)
      if (pathSegments[index]) {
        params[paramName] = pathSegments[index]
      }
    }
  })
  
  return params
}