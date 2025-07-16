# Sistema de Expiração de API Keys - MailGenius

Este documento descreve o sistema de expiração implementado para API keys no projeto MailGenius.

## Funcionalidades Implementadas

### 1. Expiração de API Keys
- **Campo de expiração**: Adicionado campo `expires_at` na tabela `api_keys`
- **Verificação automática**: API keys são verificadas na validação
- **Status de expiração**: Keys expiradas são marcadas automaticamente como `expired`

### 2. Renovação de API Keys
- **Renovação manual**: Interface para renovar keys manualmente
- **Renovação automática**: Sistema de auto-renovação configurável
- **Período personalizável**: Dias de renovação configuráveis (30, 60, 90, 180, 365 dias)

### 3. Alertas e Notificações
- **Notificações de expiração**: Alertas para keys expirando em 7 dias
- **Interface visual**: Indicadores visuais na interface do usuário
- **Email notifications**: Sistema de notificações por email (preparado)

### 4. Auditoria e Logs
- **Logs de auditoria**: Tabela `api_key_audit_logs` para rastrear ações
- **Tracking de uso**: Registro de uso das API keys
- **Histórico completo**: Logs de criação, uso, renovação e revogação

### 5. Gerenciamento Avançado
- **Revogação**: Soft delete com motivo e usuário responsável
- **Estatísticas**: Dashboard com métricas de uso das keys
- **Filtros**: Visualização de keys por status

## Estrutura do Banco de Dados

### Tabela `api_keys` (campos adicionados)
```sql
-- Campos de expiração
expires_at TIMESTAMP WITH TIME ZONE,
auto_renew BOOLEAN DEFAULT FALSE,
renewal_period_days INTEGER DEFAULT 90,
status VARCHAR(50) DEFAULT 'active',

-- Campos de revogação
revoked_at TIMESTAMP WITH TIME ZONE,
revoked_by UUID REFERENCES users(id),
revoked_reason TEXT
```

### Tabela `api_key_audit_logs`
```sql
CREATE TABLE api_key_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id),
    api_key_id UUID REFERENCES api_keys(id),
    action VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabela `api_key_notifications`
```sql
CREATE TABLE api_key_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id),
    api_key_id UUID REFERENCES api_keys(id),
    notification_type VARCHAR(50) NOT NULL,
    notification_data JSONB DEFAULT '{}',
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Endpoints da API

### Gerenciamento de API Keys
- `GET /api/settings/api-keys` - Listar API keys
- `POST /api/settings/api-keys` - Criar nova API key
- `PUT /api/settings/api-keys` - Atualizar configurações
- `DELETE /api/settings/api-keys` - Revogar API key

### Renovação
- `POST /api/settings/api-keys/renew` - Renovar API key

### Auditoria
- `GET /api/settings/api-keys/audit-logs` - Logs de auditoria

### Notificações
- `GET /api/settings/api-keys/notifications` - Notificações
- `POST /api/settings/api-keys/notifications` - Processar notificações

### Cron Jobs
- `GET /api/cron/api-keys` - Tarefas automáticas
- `POST /api/cron/api-keys` - Trigger manual

## Configuração de Cron Jobs

### Vercel Cron Jobs
```json
{
  "crons": [
    {
      "path": "/api/cron/api-keys?secret=your-secret-here",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### Tarefas Automáticas
- **Verificação de expiração**: A cada 6 horas
- **Renovação automática**: Keys com auto_renew ativado
- **Processamento de notificações**: Envio de alertas

## Segurança

### Compatibilidade
- **Backward compatibility**: Keys existentes recebem expiração padrão de 90 dias
- **Soft delete**: Keys revogadas são mantidas no banco para auditoria
- **Validação rigorosa**: Verificação de status e expiração em todas as requisições

### Logs de Segurança
- **IP tracking**: Registro de endereços IP nas requisições
- **User agent**: Tracking de user agents
- **Ações auditadas**: Criação, uso, renovação, revogação

## Interface do Usuário

### Dashboard de API Keys
- **Estatísticas**: Resumo do status das keys
- **Alertas visuais**: Indicadores para keys expirando
- **Ações rápidas**: Botões para renovar e revogar
- **Filtros**: Visualização por status

### Criação de API Keys
- **Período de expiração**: Seleção de 30, 60, 90, 180 ou 365 dias
- **Auto-renovação**: Checkbox para ativar renovação automática
- **Permissões**: Seleção granular de permissões

### Tabela de API Keys
- **Status visual**: Indicadores coloridos por status
- **Informações de expiração**: Dias restantes até expiração
- **Ações contextuais**: Renovar, revogar baseado no status

## Monitoramento

### Métricas Disponíveis
- Total de API keys
- Keys ativas
- Keys expirando (próximos 7 dias)
- Keys expiradas
- Histórico de uso

### Notificações
- Email para administradores
- Alertas na interface
- Logs estruturados

## Exemplo de Uso

### Criação de API Key
```javascript
const response = await fetch('/api/settings/api-keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Production API',
    permissions: ['leads:read', 'campaigns:write'],
    expiration_days: 90,
    auto_renew: true
  })
});
```

### Renovação Manual
```javascript
const response = await fetch('/api/settings/api-keys/renew', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key_id: 'uuid-here',
    extension_days: 90
  })
});
```

### Verificação de Status
```javascript
const response = await fetch('/api/settings/api-keys?stats=true');
const data = await response.json();
console.log(data.stats); // { total: 5, active: 3, expired: 1, expiring_soon: 1 }
```

## Configuração de Ambiente

### Variáveis de Ambiente
```env
# Cron job secret
CRON_SECRET=your-secret-here

# Database connection
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
```

### Migração do Banco
Execute a migração `008_api_key_expiration.sql`:
```bash
psql -d your_database -f database/migrations/008_api_key_expiration.sql
```

## Arquivos Modificados/Criados

### Novos Arquivos
- `database/migrations/008_api_key_expiration.sql`
- `src/lib/api-key-notifications.ts`
- `src/app/api/settings/api-keys/route.ts`
- `src/app/api/settings/api-keys/renew/route.ts`
- `src/app/api/settings/api-keys/audit-logs/route.ts`
- `src/app/api/settings/api-keys/notifications/route.ts`
- `src/app/api/cron/api-keys/route.ts`
- `vercel.json`

### Arquivos Modificados
- `src/lib/api-auth.ts` - Adicionadas funcionalidades de expiração
- `src/app/dashboard/settings/api/page.tsx` - Interface atualizada

## Próximos Passos

1. **Integração com email**: Implementar envio real de emails
2. **Webhooks**: Notificações via webhook para expiração
3. **Métricas avançadas**: Dashboard com gráficos de uso
4. **Políticas de expiração**: Configuração por workspace
5. **Rotação automática**: Geração de novas keys automaticamente

## Suporte

Para dúvidas ou problemas, consulte os logs de auditoria ou verifique o status das API keys no dashboard.