# Sistema de Automações MailGenius

## 🚀 Visão Geral

O sistema de automações do MailGenius permite criar fluxos automatizados para leads, incluindo envio de emails, adição de tags, delays e chamadas para webhooks. O sistema foi completamente implementado com execução automática, triggers e interface de gerenciamento.

## 🏗️ Arquitetura

### Componentes Principais

1. **AutomationEngine** (`/src/lib/automation/automation-engine.ts`)
   - Motor principal de execução de automações
   - Processa steps sequencialmente
   - Gerencia delays e retries
   - Integra com Resend para envio de emails

2. **AutomationMiddleware** (`/src/lib/automation/automation-middleware.ts`)
   - Processamento em background
   - Health checks
   - Triggers para novos leads

3. **APIs de Automação**
   - `/api/automation/execute` - Executa automações manualmente
   - `/api/automation/process-scheduled` - Processa runs agendadas
   - `/api/cron/automations` - Cron job para processamento

4. **Componentes React**
   - `AutomationTester` - Interface para testar automações
   - `AutomationRunStatus` - Visualização de status de execução
   - Páginas de detalhes e listagem

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

```sql
-- Automações
automation_flows (
    id UUID PRIMARY KEY,
    workspace_id UUID,
    name VARCHAR(255),
    description TEXT,
    trigger_type VARCHAR(50),
    trigger_config JSONB,
    flow_definition JSONB,
    status VARCHAR(20) -- draft, active, paused, archived
)

-- Execuções
automation_runs (
    id UUID PRIMARY KEY,
    automation_id UUID,
    lead_id UUID,
    status VARCHAR(20), -- pending, running, completed, failed, cancelled
    current_step_index INTEGER,
    execution_data JSONB,
    retry_count INTEGER,
    next_execution_at TIMESTAMP
)

-- Log de execução de steps
automation_step_executions (
    id UUID PRIMARY KEY,
    automation_run_id UUID,
    step_id VARCHAR(255),
    step_type VARCHAR(50),
    status VARCHAR(20),
    result_data JSONB,
    error_message TEXT
)
```

## 🔧 Tipos de Steps Suportados

### 1. Triggers
- **new_lead**: Executa quando um novo lead é criado
- **webhook**: Executa via webhook externo
- **date**: Executa em data específica

### 2. Conditions
- **condition-tag**: Verifica se lead possui tag específica
- **condition-source**: Verifica origem do lead

### 3. Actions
- **action-send-email**: Envia email usando template
- **action-add-tag**: Adiciona tag ao lead
- **action-webhook**: Chama webhook externo

### 4. Delays
- **delay-time**: Aguarda período específico (minutos, horas, dias, semanas)

## 🚦 Fluxo de Execução

### 1. Criação de Automação
```javascript
// Builder visual permite criar automações drag-and-drop
const automation = {
  name: "Boas-vindas",
  trigger_type: "new_lead",
  flow_definition: {
    steps: [
      {
        id: "trigger-new-lead",
        type: "trigger",
        name: "Novo Lead",
        config: { source: "any" }
      },
      {
        id: "delay-time",
        type: "delay",
        name: "Aguardar",
        config: { wait_amount: 1, wait_unit: "hours" }
      },
      {
        id: "action-send-email",
        type: "action",
        name: "Enviar Email",
        config: { 
          template_id: "welcome-template",
          subject: "Bem-vindo, {{name}}!"
        }
      }
    ]
  }
}
```

### 2. Trigger Automático
```javascript
// Quando um novo lead é criado
await automationEngine.triggerForNewLead(leadId, workspaceId)

// Executa todas as automações ativas com trigger 'new_lead'
```

### 3. Execução de Steps
```javascript
// Processa cada step sequencialmente
for (const step of automation.steps) {
  const result = await automationEngine.executeStep(step, context)
  
  if (result.delay) {
    // Agenda próxima execução
    await scheduleNextExecution(runId, result.delay)
    return
  }
  
  if (result.shouldStop) {
    // Para execução (condição falsa)
    break
  }
}
```

## 🔄 Processamento em Background

### Cron Jobs
```javascript
// Executa a cada 5 minutos
// /api/cron/automations
await automationEngine.processScheduledRuns()
```

### Middleware
```javascript
// Processamento contínuo em background
automationMiddleware.startBackgroundProcessing()
```

## 📧 Integração com Emails

### Templates Dinâmicos
```javascript
// Variáveis substituídas automaticamente
const variables = {
  name: lead.name,
  email: lead.email,
  company: lead.company
}

// {{name}} → João Silva
// {{email}} → joao@empresa.com
```

### Envio via Resend
```javascript
await resend.emails.send({
  from: `${config.from_name} <noreply@mailgenius.com>`,
  to: lead.email,
  subject: replaceVariables(subject, variables),
  html: replaceVariables(htmlContent, variables)
})
```

## 🔗 Webhooks

### Chamada de Webhook
```javascript
const payload = {
  lead: leadData,
  automation: automationData,
  execution_data: context.execution_data,
  timestamp: new Date().toISOString()
}

await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
```

## 🧪 Sistema de Testes

### Testar Automação
```javascript
// Executa automação para lead específico
const run = await automationEngine.executeAutomation(
  automationId,
  leadId,
  { trigger: 'manual_test' }
)
```

### Monitoramento
```javascript
// Acompanha execução em tempo real
const runStatus = await fetch(`/api/automation/execute?run_id=${runId}`)
```

## 📊 Métricas e Monitoramento

### Estatísticas Disponíveis
- Total de execuções
- Taxa de sucesso
- Tempo médio de execução
- Falhas por período
- Leads processados

### Health Check
```javascript
const health = await automationMiddleware.healthCheck()
// { status: 'healthy', details: { ... } }
```

## 🔐 Segurança

### Row Level Security (RLS)
- Isolamento por workspace
- Validação de permissões
- Auditoria de execuções

### Rate Limiting
- Limites por workspace
- Throttling de execuções
- Proteção contra spam

## 📱 Interface do Usuário

### Páginas Principais
1. **Lista de Automações** (`/dashboard/automations`)
   - Visão geral de todas as automações
   - Filtros por status
   - Estatísticas rápidas

2. **Builder Visual** (`/dashboard/automations/builder`)
   - Drag-and-drop para criar fluxos
   - Configuração de steps
   - Integração com IA

3. **Detalhes da Automação** (`/dashboard/automations/[id]`)
   - Visualização do fluxo
   - Histórico de execuções
   - Testes e configurações

### Componentes Reutilizáveis
- `AutomationTester` - Testa automações
- `AutomationRunStatus` - Status de execução
- `AutomationFlowVisualizer` - Visualiza fluxos

## 🚀 Implantação

### Variáveis de Ambiente
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Resend
RESEND_API_KEY=your_resend_api_key

# Cron
CRON_SECRET=your_cron_secret
```

### Migrações
```bash
# Aplicar migrações
psql -f database/migrations/010_automation_flows_compatibility.sql
```

### Cron Jobs (Vercel)
```json
{
  "crons": [
    {
      "path": "/api/cron/automations",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## 🔧 Configuração de Desenvolvimento

### Executar Localmente
```bash
# Instalar dependências
npm install

# Executar desenvolvimento
npm run dev

# Executar workers
npm run workers
```

### Testar Automações
```bash
# Testar processamento
curl -X POST http://localhost:3000/api/automation/process-scheduled \
  -H "Authorization: Bearer your-cron-secret"
```

## 🎯 Próximos Passos

### Melhorias Planejadas
1. **Condições Avançadas**
   - Branching condicional
   - Múltiplas condições
   - Operadores lógicos

2. **Integração com Webhooks**
   - Listeners bidirecionais
   - Validação de webhooks
   - Retry automático

3. **Relatórios Avançados**
   - Dashboards personalizáveis
   - Análise de performance
   - Métricas de conversão

4. **Templates Avançados**
   - Editor WYSIWYG
   - Suporte a anexos
   - Imagens inline

## 🆘 Troubleshooting

### Problemas Comuns

1. **Automação não executa**
   - Verificar se está ativa
   - Verificar trigger_type
   - Verificar logs de erro

2. **Emails não enviados**
   - Verificar configuração Resend
   - Verificar template
   - Verificar dados do lead

3. **Delays não funcionam**
   - Verificar cron job
   - Verificar next_execution_at
   - Verificar processamento em background

### Logs
```javascript
// Logs detalhados em automation_step_executions
SELECT * FROM automation_step_executions 
WHERE automation_run_id = 'run-id' 
ORDER BY executed_at;
```

## 🤝 Contribuição

Para contribuir com o sistema de automações:

1. Entender a arquitetura
2. Adicionar testes
3. Documentar mudanças
4. Seguir padrões de código
5. Testar integrações

---

**Sistema de Automações MailGenius** - Versão 1.0  
Última atualização: Janeiro 2025