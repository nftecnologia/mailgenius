# Zod Validation Implementation for MailGenius

## Overview

This implementation adds robust validation using Zod to all APIs in the MailGenius project. The validation system provides type-safe input validation with clear error messages.

## File Structure

```
src/lib/validation/
├── index.ts          # Main exports and common schemas
├── middleware.ts     # Validation middleware and helpers
├── leads.ts          # Lead-related validation schemas
├── campaigns.ts      # Campaign-related validation schemas
├── webhooks.ts       # Webhook validation schemas
├── auth.ts           # Authentication validation schemas
├── templates.ts      # Template validation schemas
├── analytics.ts      # Analytics validation schemas
├── ab-tests.ts       # A/B test validation schemas
└── README.md         # This documentation
```

## Key Features

### 1. Comprehensive Schema Coverage
- **Leads**: Create, update, delete, bulk operations, imports
- **Campaigns**: Create, update, delete, scheduling, A/B tests
- **Webhooks**: Resend, Mailgun, SendGrid webhook validation
- **Auth**: OAuth, registration, password reset, profile updates
- **Templates**: Create, update, preview, versioning
- **Analytics**: Reporting, cohort analysis, funnels
- **A/B Tests**: Creation, analysis, multivariate testing

### 2. Type-Safe Validation Middleware
- `createValidatedHandler()` - Type-safe route handler wrapper
- `validateRequest()` - Request validation function
- `getValidatedData()` - Extract validated data from request
- Automatic error formatting with clear messages

### 3. Common Validation Patterns
- Email validation with proper format checking
- UUID validation for IDs
- Phone number validation with international formats
- URL validation for webhooks and redirects
- Date/time validation with timezone support
- Pagination with limits and defaults

### 4. Error Handling
- Clear, user-friendly error messages
- Structured error responses with field-specific details
- Integration with existing API error handling
- Proper HTTP status codes for validation errors

## Implementation Details

### API Routes Updated

#### Leads API (`/api/public/v1/leads`)
- **GET**: Query parameter validation (pagination, filters)
- **POST**: Body validation (email, name, company, etc.)
- **PUT**: Body + query parameter validation
- **DELETE**: Query parameter validation (ID)

#### Campaigns API (`/api/public/v1/campaigns`)
- **GET**: Query parameter validation (pagination, filters, stats)
- **POST**: Body validation (name, subject, content/template)
- **PUT**: Body + query parameter validation
- **DELETE**: Query parameter validation (ID)

#### Auth Callback (`/auth/callback`)
- **GET**: Query parameter validation (code, error, state)
- OAuth error handling
- Proper redirect with error messages

#### Webhooks (`/api/webhooks/resend`)
- **POST**: Webhook event validation
- Signature verification
- Event type validation

### Validation Features

1. **Field-Level Validation**
   - Required fields
   - String length limits
   - Email format validation
   - UUID format validation
   - Date format validation

2. **Business Logic Validation**
   - Future date validation for scheduling
   - Template or content requirement
   - Percentage ranges for A/B tests
   - Rate limiting integration

3. **Cross-Field Validation**
   - Password confirmation matching
   - Date range validation (from <= to)
   - Conditional requirements

4. **Security Validation**
   - SQL injection prevention
   - XSS protection through sanitization
   - Input size limits
   - Rate limiting integration

## Usage Examples

### Basic Route Validation
```typescript
import { createValidatedHandler } from '@/lib/validation/middleware'
import { leadSchemas } from '@/lib/validation'

export const POST = createValidatedHandler(
  { body: leadSchemas.createLead },
  async (request: NextRequest, { body }) => {
    // body is now fully validated and typed
    const { email, name, company } = body
    // ... implementation
  }
)
```

### Multiple Validation Sources
```typescript
export const PUT = createValidatedHandler(
  { 
    body: leadSchemas.updateLead,
    query: leadSchemas.updateLeadParams
  },
  async (request: NextRequest, { body, query }) => {
    const { id } = query
    const { email, name } = body
    // ... implementation
  }
)
```

### Custom Validation
```typescript
const customSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18).max(100)
}).refine(
  (data) => data.email.endsWith('@company.com'),
  { message: 'Must use company email' }
)
```

## Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "body": [
        "email: Invalid email format",
        "name: Name must not be empty"
      ]
    }
  }
}
```

## Performance Considerations

1. **Validation Caching**: Schemas are created once and reused
2. **Minimal Overhead**: Validation happens before processing
3. **Early Returns**: Failed validation stops execution immediately
4. **Type Safety**: Compile-time type checking reduces runtime errors

## Security Benefits

1. **Input Sanitization**: All inputs are validated and sanitized
2. **Type Safety**: Prevents type-related vulnerabilities
3. **Consistent Validation**: Same validation logic across all endpoints
4. **Clear Error Messages**: No information leakage in error responses

## Migration Notes

- All existing manual validation has been replaced with Zod schemas
- Error messages are now consistent across all endpoints
- Type safety has been improved throughout the codebase
- Rate limiting integration has been maintained

## Future Enhancements

1. **Custom Validation Rules**: Add domain-specific validation
2. **Async Validation**: Database existence checks
3. **Conditional Schemas**: Dynamic validation based on user roles
4. **Validation Analytics**: Track validation failures for insights
5. **Schema Versioning**: Support for API versioning