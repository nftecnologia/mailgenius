# Sistema de Condições Avançadas e Branching - MailGenius

## 🚀 Visão Geral

O sistema de condições avançadas e branching permite criar fluxos de automação complexos com lógica condicional sofisticada, múltiplas condições (AND/OR), e ramificações baseadas em resultados.

## 🏗️ Arquitetura

### Componentes Principais

1. **AdvancedConditionEngine** (`/src/lib/automation/advanced-conditions.ts`)
   - Motor de avaliação de condições avançadas
   - Suporta condições simples e grupos
   - Operadores lógicos AND/OR
   - Comparações flexíveis

2. **BranchingStep** (Interface)
   - Definição de passos de ramificação
   - Suporte a múltiplas condições
   - Caminhos condicionais

3. **Componentes React**
   - `AdvancedConditionBuilder` - Construtor visual de condições
   - `BranchingStepBuilder` - Construtor de ramificações
   - `AdvancedConditionTester` - Testador de condições

## 📊 Tipos de Condições

### 1. Condições Simples
```typescript
interface SimpleCondition {
  id: string
  type: 'simple'
  field: string // Ex: 'lead.name', 'lead.email'
  comparison: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in'
  value: any
  case_sensitive?: boolean
}
```

### 2. Condições de Grupo
```typescript
interface GroupCondition {
  id: string
  type: 'group'
  operator: 'and' | 'or'
  conditions: AdvancedCondition[]
}
```

## 🔧 Operadores de Comparação

### Operadores de String
- **equals**: Comparação exata
- **not_equals**: Diferente de
- **contains**: Contém texto
- **not_contains**: Não contém texto
- **is_empty**: Campo vazio
- **is_not_empty**: Campo preenchido

### Operadores Numéricos
- **greater_than**: Maior que
- **less_than**: Menor que
- **equals**: Igual a
- **not_equals**: Diferente de

### Operadores de Lista
- **in**: Está na lista
- **not_in**: Não está na lista

### Operadores de Data
- **greater_than**: Depois de
- **less_than**: Antes de
- **equals**: Mesma data

## 🎯 Campos Disponíveis

### Campos do Lead
```typescript
const LEAD_FIELDS = [
  'lead.name',         // Nome do lead
  'lead.email',        // Email do lead
  'lead.company',      // Empresa do lead
  'lead.phone',        // Telefone do lead
  'lead.source',       // Fonte do lead
  'lead.status',       // Status do lead
  'lead.tags',         // Tags do lead (array)
  'lead.created_at',   // Data de criação
  'lead.updated_at',   // Data de atualização
]
```

### Campos de Variáveis
```typescript
const VARIABLE_FIELDS = [
  'variables.trigger',    // Tipo de trigger
  'variables.timestamp',  // Timestamp da execução
  // ... campos personalizados
]
```

## 🔀 Sistema de Branching

### Estrutura de Branching Step
```typescript
interface BranchingStep {
  id: string
  type: 'branching'
  name: string
  description: string
  config: {
    conditions: AdvancedCondition[]
    branches: {
      id: string
      name: string
      condition_result: boolean // true = condição passou, false = falhou
      next_steps: string[] // IDs dos próximos passos
    }[]
  }
}
```

### Exemplo de Branching
```javascript
const branchingStep = {
  id: 'branch-lead-source',
  type: 'branching',
  name: 'Verificar Fonte do Lead',
  description: 'Direciona o fluxo baseado na fonte do lead',
  config: {
    conditions: [
      {
        id: 'cond-1',
        type: 'simple',
        field: 'lead.source',
        comparison: 'equals',
        value: 'website'
      }
    ],
    branches: [
      {
        id: 'branch-website',
        name: 'Lead do Website',
        condition_result: true,
        next_steps: ['email-welcome-website', 'tag-website-lead']
      },
      {
        id: 'branch-other',
        name: 'Outras Fontes',
        condition_result: false,
        next_steps: ['email-welcome-generic', 'tag-other-lead']
      }
    ]
  }
}
```

## 💻 Uso Programático

### Avaliação de Condições
```typescript
import { advancedConditionEngine } from '@/lib/automation/advanced-conditions'

const context = {
  lead: {
    name: 'João Silva',
    email: 'joao@exemplo.com',
    company: 'Empresa XYZ',
    source: 'website',
    tags: ['premium', 'interested']
  },
  variables: {
    trigger: 'new_lead',
    timestamp: new Date().toISOString()
  },
  workspace_id: 'workspace-123'
}

const conditions = [
  {
    id: 'cond-1',
    type: 'simple',
    field: 'lead.source',
    comparison: 'equals',
    value: 'website'
  },
  {
    id: 'cond-2',
    type: 'simple',
    field: 'lead.tags',
    comparison: 'contains',
    value: 'premium'
  }
]

const result = await advancedConditionEngine.evaluateConditions(conditions, context)
// result = true (se ambas condições passarem)
```

### Execução de Branching
```typescript
const branchingStep = {
  id: 'branch-1',
  type: 'branching',
  name: 'Check Lead Type',
  config: {
    conditions: [/* ... */],
    branches: [/* ... */]
  }
}

const result = await advancedConditionEngine.executeBranchingStep(branchingStep, context)
// result = { success: true, nextSteps: ['step-1', 'step-2'], data: {...} }
```

## 🎨 Componentes React

### AdvancedConditionBuilder
```tsx
import AdvancedConditionBuilder from '@/components/automation/AdvancedConditionBuilder'

function MyComponent() {
  const [conditions, setConditions] = useState([])
  
  return (
    <AdvancedConditionBuilder
      conditions={conditions}
      onChange={setConditions}
    />
  )
}
```

### BranchingStepBuilder
```tsx
import BranchingStepBuilder from '@/components/automation/BranchingStepBuilder'

function MyComponent() {
  const [step, setStep] = useState(branchingStep)
  
  return (
    <BranchingStepBuilder
      step={step}
      onChange={setStep}
      availableSteps={availableSteps}
    />
  )
}
```

### AdvancedConditionTester
```tsx
import AdvancedConditionTester from '@/components/automation/AdvancedConditionTester'

function MyComponent() {
  return (
    <AdvancedConditionTester
      conditions={conditions}
      leads={leads}
    />
  )
}
```

## 📊 Estrutura do Banco de Dados

### Tabelas Principais
```sql
-- Suporte a ramificações
automation_flow_branches (
    id UUID PRIMARY KEY,
    automation_id UUID,
    step_id VARCHAR(255),
    branch_id VARCHAR(255),
    branch_name VARCHAR(255),
    condition_result BOOLEAN,
    next_steps JSONB
)

-- Condições avançadas
automation_advanced_conditions (
    id UUID PRIMARY KEY,
    automation_id UUID,
    step_id VARCHAR(255),
    condition_id VARCHAR(255),
    condition_type VARCHAR(50),
    parent_condition_id VARCHAR(255),
    operator VARCHAR(10),
    field_name VARCHAR(255),
    comparison_operator VARCHAR(50),
    condition_value JSONB,
    case_sensitive BOOLEAN
)

-- Relacionamentos entre passos
automation_step_relationships (
    id UUID PRIMARY KEY,
    automation_id UUID,
    source_step_id VARCHAR(255),
    target_step_id VARCHAR(255),
    relationship_type VARCHAR(50),
    condition_result BOOLEAN
)
```

## 🧪 Testes e Validação

### Testador de Condições
```typescript
// Teste individual
const result = await advancedConditionEngine.evaluateConditions(
  conditions, 
  { lead: testLead, variables: testVars }
)

// Teste em lote
const results = await Promise.all(
  leads.map(lead => 
    advancedConditionEngine.evaluateConditions(conditions, { lead, variables })
  )
)
```

### Validação de Estrutura
```sql
-- Função para validar estrutura da automação
SELECT * FROM validate_automation_flow_structure('automation-id');
```

## 🔧 Configuração e Instalação

### 1. Aplicar Migração
```bash
psql -f database/migrations/011_advanced_conditions_and_branching.sql
```

### 2. Instalar Dependências
```bash
npm install # Dependências já incluídas
```

### 3. Configurar Variáveis de Ambiente
```env
# Não requer configuração adicional
```

## 🎯 Exemplos Práticos

### Exemplo 1: Segmentação por Fonte
```typescript
const sourceSegmentation = {
  conditions: [
    {
      id: 'cond-website',
      type: 'simple',
      field: 'lead.source',
      comparison: 'equals',
      value: 'website'
    }
  ],
  branches: [
    {
      id: 'website-branch',
      name: 'Leads do Website',
      condition_result: true,
      next_steps: ['welcome-email-website', 'add-website-tag']
    },
    {
      id: 'other-branch',
      name: 'Outras Fontes',
      condition_result: false,
      next_steps: ['welcome-email-generic']
    }
  ]
}
```

### Exemplo 2: Condições Múltiplas com AND/OR
```typescript
const complexConditions = [
  {
    id: 'group-1',
    type: 'group',
    operator: 'or',
    conditions: [
      {
        id: 'cond-premium',
        type: 'simple',
        field: 'lead.tags',
        comparison: 'contains',
        value: 'premium'
      },
      {
        id: 'cond-company',
        type: 'simple',
        field: 'lead.company',
        comparison: 'not_equals',
        value: ''
      }
    ]
  },
  {
    id: 'cond-source',
    type: 'simple',
    field: 'lead.source',
    comparison: 'in',
    value: ['website', 'referral']
  }
]
```

### Exemplo 3: Condições de Data
```typescript
const dateConditions = [
  {
    id: 'recent-lead',
    type: 'simple',
    field: 'lead.created_at',
    comparison: 'greater_than',
    value: '2024-01-01'
  }
]
```

## 🔍 Debugging e Monitoramento

### Logs de Execução
```typescript
// Logs automáticos são criados em automation_step_executions
const executionLogs = await supabase
  .from('automation_step_executions')
  .select('*')
  .eq('automation_run_id', runId)
  .order('executed_at')
```

### Métricas de Branching
```sql
-- Estatísticas de ramificações
SELECT 
  branch_id,
  condition_result,
  COUNT(*) as execution_count
FROM automation_step_executions ase
JOIN automation_flow_branches afb ON ase.step_id = afb.step_id
WHERE ase.automation_run_id IN (
  SELECT id FROM automation_runs WHERE automation_id = 'automation-id'
)
GROUP BY branch_id, condition_result;
```

## 📈 Performance e Otimização

### Otimizações Implementadas
1. **Índices de Banco**: Índices otimizados para consultas frequentes
2. **Avaliação Lazy**: Condições são avaliadas apenas quando necessário
3. **Cache de Resultados**: Resultados de condições podem ser cacheados
4. **Validação Prévia**: Estrutura é validada antes da execução

### Boas Práticas
1. **Limite de Condições**: Máximo 20 condições por grupo
2. **Profundidade de Grupos**: Máximo 3 níveis de aninhamento
3. **Testes Regulares**: Teste condições com dados reais
4. **Documentação**: Documente lógica complexa

## 🚀 Próximos Passos

### Melhorias Planejadas
1. **Editor Visual Avançado**: Drag-and-drop para condições
2. **Condições Dinâmicas**: Baseadas em dados externos
3. **A/B Testing**: Ramificações para testes
4. **Machine Learning**: Condições baseadas em ML
5. **Integração com BI**: Métricas avançadas

### Roadmap
- **V2.1**: Editor visual melhorado
- **V2.2**: Condições dinâmicas
- **V2.3**: A/B testing integrado
- **V2.4**: ML integration

---

**Sistema de Condições Avançadas** - Versão 2.0  
Última atualização: Janeiro 2025