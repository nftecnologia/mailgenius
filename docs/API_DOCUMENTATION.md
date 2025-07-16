# MailGenius - API Documentation

## 🌐 Visão Geral da API

O MailGenius oferece uma API REST completa para gerenciar campanhas de email, contatos, templates e análises. A API é projetada para suportar operações em alta escala com 2MM+ contatos e oferece endpoints públicos e privados.

## 📋 Informações Gerais

### **Base URL**
```
Production: https://mailgenius.com/api
Staging: https://staging.mailgenius.com/api
Development: http://localhost:3000/api
```

### **Autenticação**
```
Bearer Token: Authorization: Bearer <token>
API Key: X-API-Key: <api-key>
```

### **Rate Limits**
- **Public API**: 1000 requests/hour
- **Authenticated**: 10000 requests/hour
- **Premium**: 50000 requests/hour

### **Response Format**
Todas as respostas seguem o formato JSON padrão:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2024-07-16T10:30:00Z",
  "version": "2.0"
}
```

## 🔑 Autenticação

### **1. JWT Authentication**

```bash
POST /api/auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "workspaces": [...]
    },
    "expires_at": "2024-07-23T10:30:00Z"
  }
}
```

### **2. API Key Authentication**

```bash
GET /api/settings/api-keys
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "uuid",
        "name": "Production API Key",
        "key": "mk_live_...",
        "permissions": ["leads:read", "leads:write", "campaigns:read"],
        "created_at": "2024-07-16T10:30:00Z",
        "last_used_at": "2024-07-16T10:30:00Z"
      }
    ]
  }
}
```

**Create API Key:**
```bash
POST /api/settings/api-keys
Authorization: Bearer <token>
```

```json
{
  "name": "Mobile App API Key",
  "permissions": ["leads:read", "campaigns:read"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

## 📊 Public API v1

### **Leads Management**

#### **Get Leads**
```bash
GET /api/public/v1/leads
X-API-Key: <api-key>
```

**Query Parameters:**
- `limit`: Number of results (default: 50, max: 1000)
- `offset`: Pagination offset
- `status`: Filter by status (active, unsubscribed, bounced)
- `source`: Filter by source
- `tags`: Filter by tags (comma-separated)
- `search`: Search in name/email
- `created_after`: ISO date string
- `created_before`: ISO date string

**Response:**
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "uuid",
        "email": "lead@example.com",
        "name": "John Doe",
        "phone": "+1234567890",
        "company": "Example Corp",
        "position": "Manager",
        "source": "website",
        "status": "active",
        "tags": ["vip", "newsletter"],
        "custom_fields": {
          "industry": "tech",
          "budget": "high"
        },
        "created_at": "2024-07-16T10:30:00Z",
        "updated_at": "2024-07-16T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 25000,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}
```

#### **Create Lead**
```bash
POST /api/public/v1/leads
X-API-Key: <api-key>
```

**Request:**
```json
{
  "email": "new-lead@example.com",
  "name": "Jane Smith",
  "phone": "+1234567890",
  "company": "New Company",
  "position": "Director",
  "source": "api",
  "tags": ["prospect", "demo"],
  "custom_fields": {
    "budget": "medium",
    "timeline": "Q2"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lead": {
      "id": "uuid",
      "email": "new-lead@example.com",
      "name": "Jane Smith",
      "phone": "+1234567890",
      "company": "New Company",
      "position": "Director",
      "source": "api",
      "status": "active",
      "tags": ["prospect", "demo"],
      "custom_fields": {
        "budget": "medium",
        "timeline": "Q2"
      },
      "created_at": "2024-07-16T10:30:00Z",
      "updated_at": "2024-07-16T10:30:00Z"
    }
  }
}
```

#### **Update Lead**
```bash
PUT /api/public/v1/leads/{id}
X-API-Key: <api-key>
```

**Request:**
```json
{
  "name": "Jane Smith Updated",
  "position": "Senior Director",
  "tags": ["prospect", "demo", "qualified"],
  "custom_fields": {
    "budget": "high",
    "timeline": "Q1"
  }
}
```

#### **Delete Lead**
```bash
DELETE /api/public/v1/leads/{id}
X-API-Key: <api-key>
```

#### **Bulk Operations**
```bash
POST /api/public/v1/leads/bulk
X-API-Key: <api-key>
```

**Bulk Create:**
```json
{
  "operation": "create",
  "leads": [
    {
      "email": "bulk1@example.com",
      "name": "Bulk User 1",
      "source": "bulk_api"
    },
    {
      "email": "bulk2@example.com",
      "name": "Bulk User 2",
      "source": "bulk_api"
    }
  ]
}
```

**Bulk Update:**
```json
{
  "operation": "update",
  "filter": {
    "tags": ["old_tag"]
  },
  "update": {
    "tags": ["new_tag"]
  }
}
```

### **Campaigns Management**

#### **Get Campaigns**
```bash
GET /api/public/v1/campaigns
X-API-Key: <api-key>
```

**Query Parameters:**
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Pagination offset
- `status`: Filter by status (draft, scheduled, sending, sent, paused)
- `created_after`: ISO date string
- `created_before`: ISO date string

**Response:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "uuid",
        "name": "Welcome Campaign",
        "subject": "Welcome to our platform!",
        "status": "sent",
        "send_at": "2024-07-16T10:30:00Z",
        "sent_at": "2024-07-16T10:30:00Z",
        "stats": {
          "total_recipients": 10000,
          "delivered": 9850,
          "opened": 3940,
          "clicked": 590,
          "bounced": 150,
          "unsubscribed": 25,
          "complained": 5
        },
        "rates": {
          "delivery_rate": 98.5,
          "open_rate": 40.0,
          "click_rate": 15.0,
          "bounce_rate": 1.5,
          "unsubscribe_rate": 0.25
        },
        "created_at": "2024-07-16T10:30:00Z",
        "updated_at": "2024-07-16T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}
```

#### **Create Campaign**
```bash
POST /api/public/v1/campaigns
X-API-Key: <api-key>
```

**Request:**
```json
{
  "name": "Product Launch Campaign",
  "subject": "🚀 New Product Launch",
  "template_id": "uuid",
  "segment_id": "uuid",
  "schedule_at": "2024-07-17T10:00:00Z",
  "settings": {
    "track_opens": true,
    "track_clicks": true,
    "unsubscribe_enabled": true
  }
}
```

#### **Send Campaign**
```bash
POST /api/public/v1/campaigns/{id}/send
X-API-Key: <api-key>
```

**Request:**
```json
{
  "send_immediately": true,
  "test_emails": ["test@example.com"]
}
```

### **Templates Management**

#### **Get Templates**
```bash
GET /api/public/v1/templates
X-API-Key: <api-key>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "uuid",
        "name": "Welcome Email Template",
        "subject": "Welcome {{name}}!",
        "html_content": "<html>...</html>",
        "text_content": "Welcome {{name}}!...",
        "variables": ["name", "company"],
        "template_type": "campaign",
        "created_at": "2024-07-16T10:30:00Z",
        "updated_at": "2024-07-16T10:30:00Z"
      }
    ]
  }
}
```

#### **Create Template**
```bash
POST /api/public/v1/templates
X-API-Key: <api-key>
```

**Request:**
```json
{
  "name": "Newsletter Template",
  "subject": "Monthly Newsletter - {{month}}",
  "html_content": "<html><body>Hello {{name}}...</body></html>",
  "text_content": "Hello {{name}}...",
  "variables": ["name", "month"],
  "template_type": "campaign"
}
```

### **Analytics**

#### **Get Analytics**
```bash
GET /api/public/v1/analytics
X-API-Key: <api-key>
```

**Query Parameters:**
- `start_date`: ISO date string
- `end_date`: ISO date string
- `metrics`: Comma-separated list (campaigns, leads, emails, conversions)
- `group_by`: Group by period (hour, day, week, month)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-07-01T00:00:00Z",
      "end": "2024-07-16T23:59:59Z"
    },
    "campaigns": {
      "total": 25,
      "sent": 20,
      "scheduled": 3,
      "draft": 2
    },
    "leads": {
      "total": 125000,
      "active": 120000,
      "unsubscribed": 3000,
      "bounced": 2000
    },
    "emails": {
      "sent": 500000,
      "delivered": 485000,
      "opened": 194000,
      "clicked": 29100,
      "bounced": 15000,
      "unsubscribed": 1250
    },
    "rates": {
      "delivery_rate": 97.0,
      "open_rate": 40.0,
      "click_rate": 15.0,
      "bounce_rate": 3.0,
      "unsubscribe_rate": 0.25
    },
    "timeline": [
      {
        "date": "2024-07-01",
        "emails_sent": 12500,
        "emails_delivered": 12125,
        "emails_opened": 4850,
        "emails_clicked": 728
      }
    ]
  }
}
```

## 🔧 Internal APIs

### **Queue Management**

#### **Get Queue Status**
```bash
GET /api/queue/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "queues": [
      {
        "name": "email-sending",
        "waiting": 1250,
        "active": 10,
        "completed": 125000,
        "failed": 250,
        "delayed": 0,
        "paused": false
      },
      {
        "name": "leads-import",
        "waiting": 5,
        "active": 2,
        "completed": 450,
        "failed": 12,
        "delayed": 0,
        "paused": false
      }
    ]
  }
}
```

#### **Queue Operations**
```bash
POST /api/queue/admin
Authorization: Bearer <token>
```

**Pause Queue:**
```json
{
  "action": "pause",
  "queue": "email-sending"
}
```

**Resume Queue:**
```json
{
  "action": "resume",
  "queue": "email-sending"
}
```

**Clear Queue:**
```json
{
  "action": "clear",
  "queue": "email-sending",
  "type": "failed"
}
```

### **Upload Management**

#### **Create Upload Job**
```bash
POST /api/upload/create
Authorization: Bearer <token>
```

**Request:**
```json
{
  "filename": "leads.csv",
  "file_size": 52428800,
  "content_type": "text/csv",
  "upload_type": "leads_import",
  "chunk_size": 1048576,
  "validation_rules": {
    "required_fields": ["email"],
    "validate_email": true,
    "skip_duplicates": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "upload_url": "https://api.example.com/upload/uuid",
    "chunk_urls": [
      "https://api.example.com/upload/uuid/chunk/0",
      "https://api.example.com/upload/uuid/chunk/1"
    ],
    "total_chunks": 50,
    "expires_at": "2024-07-16T11:30:00Z"
  }
}
```

#### **Upload Chunk**
```bash
POST /api/upload/{jobId}/chunk/{chunkIndex}
Authorization: Bearer <token>
Content-Type: application/octet-stream
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chunk_index": 0,
    "chunk_size": 1048576,
    "hash": "sha256:abc123...",
    "uploaded_at": "2024-07-16T10:30:00Z"
  }
}
```

#### **Process Upload**
```bash
POST /api/upload/{jobId}/process
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "processing",
    "progress": {
      "total_chunks": 50,
      "completed_chunks": 50,
      "total_records": 100000,
      "processed_records": 0,
      "valid_records": 0,
      "invalid_records": 0
    }
  }
}
```

#### **Get Upload Progress**
```bash
GET /api/upload/{jobId}/progress
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "processing",
    "progress": {
      "total_chunks": 50,
      "completed_chunks": 50,
      "total_records": 100000,
      "processed_records": 75000,
      "valid_records": 73500,
      "invalid_records": 1500,
      "percentage": 75.0,
      "estimated_time_remaining": 120
    },
    "validation_errors": [
      {
        "row": 123,
        "field": "email",
        "message": "Invalid email format",
        "value": "invalid-email"
      }
    ]
  }
}
```

### **Monitoring APIs**

#### **System Health**
```bash
GET /api/monitoring/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": {
        "status": "up",
        "response_time": 15,
        "connections": 12
      },
      "redis": {
        "status": "up",
        "response_time": 2,
        "memory_usage": "45%"
      },
      "email_service": {
        "status": "up",
        "response_time": 250,
        "rate_limit": "80%"
      },
      "queue_system": {
        "status": "up",
        "active_jobs": 25,
        "failed_jobs": 2
      }
    }
  }
}
```

#### **System Metrics**
```bash
GET /api/monitoring/metrics
Authorization: Bearer <token>
```

**Query Parameters:**
- `start_time`: ISO date string
- `end_time`: ISO date string
- `metrics`: Comma-separated list
- `interval`: Time interval (1m, 5m, 1h, 1d)

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "api_requests": {
        "total": 125000,
        "success": 123750,
        "errors": 1250,
        "avg_response_time": 185
      },
      "email_delivery": {
        "sent": 50000,
        "delivered": 48500,
        "bounced": 1500,
        "delivery_rate": 97.0
      },
      "database": {
        "queries": 250000,
        "avg_query_time": 45,
        "slow_queries": 125,
        "connections": 18
      },
      "queue": {
        "jobs_processed": 75000,
        "jobs_failed": 250,
        "avg_processing_time": 2.5
      }
    },
    "timeline": [
      {
        "timestamp": "2024-07-16T10:00:00Z",
        "api_requests": 1250,
        "emails_sent": 500,
        "database_queries": 2500
      }
    ]
  }
}
```

#### **System Logs**
```bash
GET /api/monitoring/logs
Authorization: Bearer <token>
```

**Query Parameters:**
- `level`: Log level (debug, info, warn, error)
- `service`: Service name
- `component`: Component name
- `start_time`: ISO date string
- `end_time`: ISO date string
- `limit`: Number of results (default: 100, max: 1000)
- `search`: Search query

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2024-07-16T10:30:00Z",
        "level": "info",
        "service": "email-worker",
        "component": "email-sender",
        "message": "Email sent successfully",
        "metadata": {
          "campaign_id": "uuid",
          "lead_id": "uuid",
          "email": "user@example.com",
          "provider": "resend"
        },
        "trace_id": "abc123",
        "user_id": "uuid"
      }
    ],
    "pagination": {
      "total": 10000,
      "limit": 100,
      "offset": 0,
      "has_more": true
    }
  }
}
```

## 🔔 Webhooks

### **Webhook Configuration**

#### **Create Webhook**
```bash
POST /api/webhooks
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Email Events Webhook",
  "url": "https://yourapp.com/webhooks/mailgenius",
  "events": [
    "email.sent",
    "email.delivered",
    "email.opened",
    "email.clicked",
    "email.bounced",
    "email.unsubscribed",
    "campaign.completed",
    "lead.created",
    "lead.updated"
  ],
  "secret": "your-webhook-secret",
  "active": true
}
```

### **Webhook Events**

#### **Email Events**
```json
{
  "event": "email.delivered",
  "timestamp": "2024-07-16T10:30:00Z",
  "data": {
    "email_id": "uuid",
    "campaign_id": "uuid",
    "lead_id": "uuid",
    "email": "user@example.com",
    "subject": "Welcome to our platform!",
    "delivered_at": "2024-07-16T10:30:00Z",
    "provider": "resend",
    "provider_id": "resend-id"
  }
}
```

#### **Campaign Events**
```json
{
  "event": "campaign.completed",
  "timestamp": "2024-07-16T10:30:00Z",
  "data": {
    "campaign_id": "uuid",
    "name": "Welcome Campaign",
    "stats": {
      "total_recipients": 10000,
      "delivered": 9850,
      "opened": 3940,
      "clicked": 590,
      "bounced": 150,
      "unsubscribed": 25
    }
  }
}
```

#### **Lead Events**
```json
{
  "event": "lead.created",
  "timestamp": "2024-07-16T10:30:00Z",
  "data": {
    "lead_id": "uuid",
    "email": "newlead@example.com",
    "name": "New Lead",
    "source": "api",
    "tags": ["prospect"]
  }
}
```

### **Webhook Verification**

Para verificar webhooks, use HMAC SHA256:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expected = hmac.digest('hex');
  return signature === `sha256=${expected}`;
}
```

## 📊 Rate Limiting

### **Rate Limit Headers**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1626433200
X-RateLimit-Window: 3600
```

### **Rate Limit Response**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2024-07-16T11:00:00Z"
    }
  }
}
```

## 🚨 Error Handling

### **Error Response Format**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "field": "email",
      "message": "Invalid email format"
    }
  },
  "timestamp": "2024-07-16T10:30:00Z"
}
```

### **Common Error Codes**
- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_ERROR`: Invalid credentials
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource already exists
- `INTERNAL_ERROR`: Internal server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable

### **HTTP Status Codes**
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `422`: Validation Error
- `429`: Rate Limit Exceeded
- `500`: Internal Server Error
- `503`: Service Unavailable

## 🔒 Security

### **API Key Security**
- Store API keys securely
- Use different keys for different environments
- Rotate keys regularly
- Monitor key usage
- Revoke compromised keys immediately

### **Request Security**
- Use HTTPS only
- Validate all input data
- Sanitize user input
- Implement proper authentication
- Use proper authorization checks

### **Data Protection**
- Encrypt sensitive data
- Follow GDPR compliance
- Implement proper data retention
- Use secure connection strings
- Regular security audits

## 📚 SDK Examples

### **JavaScript/Node.js**
```javascript
const MailGenius = require('@mailgenius/sdk');

const client = new MailGenius({
  apiKey: 'your-api-key',
  baseUrl: 'https://mailgenius.com/api'
});

// Create a lead
const lead = await client.leads.create({
  email: 'user@example.com',
  name: 'John Doe',
  source: 'website'
});

// Send campaign
const campaign = await client.campaigns.send({
  name: 'Welcome Campaign',
  templateId: 'template-id',
  segmentId: 'segment-id'
});
```

### **Python**
```python
from mailgenius import MailGenius

client = MailGenius(api_key='your-api-key')

# Create a lead
lead = client.leads.create({
    'email': 'user@example.com',
    'name': 'John Doe',
    'source': 'website'
})

# Get analytics
analytics = client.analytics.get(
    start_date='2024-07-01',
    end_date='2024-07-16'
)
```

### **cURL Examples**
```bash
# Create a lead
curl -X POST https://mailgenius.com/api/public/v1/leads \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "source": "api"
  }'

# Get campaigns
curl -X GET https://mailgenius.com/api/public/v1/campaigns \
  -H "X-API-Key: your-api-key"

# Send campaign
curl -X POST https://mailgenius.com/api/public/v1/campaigns/uuid/send \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"send_immediately": true}'
```

## 📋 Best Practices

### **API Usage**
- Use appropriate HTTP methods (GET, POST, PUT, DELETE)
- Include proper Content-Type headers
- Handle errors gracefully
- Implement retry logic for failed requests
- Use pagination for large datasets
- Cache responses when appropriate

### **Performance**
- Use bulk operations when possible
- Implement proper pagination
- Cache frequently accessed data
- Use compression for large payloads
- Monitor API usage and performance

### **Security**
- Never expose API keys in client-side code
- Use HTTPS for all requests
- Validate and sanitize all input
- Implement proper error handling
- Log security events

## 🧪 Testing

### **API Testing Tools**
- **Postman**: Collection available
- **Insomnia**: Workspace export
- **curl**: Command examples
- **HTTPie**: Modern CLI client

### **Test Environment**
```
Base URL: https://api-test.mailgenius.com
API Key: mk_test_...
Rate Limit: 10000 requests/hour
```

### **Test Data**
```json
{
  "test_leads": [
    {
      "email": "test1@example.com",
      "name": "Test User 1",
      "source": "test"
    }
  ],
  "test_campaigns": [
    {
      "name": "Test Campaign",
      "subject": "Test Subject",
      "template_id": "test-template"
    }
  ]
}
```

## 📞 Support

### **API Support**
- **Documentation**: https://docs.mailgenius.com/api
- **Status Page**: https://status.mailgenius.com
- **Community**: https://community.mailgenius.com
- **Email**: api-support@mailgenius.com

### **Rate Limit Increases**
Para aumentar rate limits, entre em contato com suporte incluindo:
- Caso de uso específico
- Volume esperado
- Padrão de uso
- Informações da conta

---

**Versão da API**: 2.0  
**Última atualização**: 2024-07-16  
**Status**: Produção  
**Suporte**: api-support@mailgenius.com