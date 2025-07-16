# EmailSend SaaS - Plataforma Inteligente de Email Marketing

## 📧 Sobre o Projeto

**EmailSend** é uma plataforma completa de Email Marketing SaaS com foco em inteligência artificial, automações avançadas e entregabilidade máxima. Desenvolvida com tecnologias modernas para empresas que querem escalar suas estratégias de email marketing.

## ✨ Funcionalidades Principais

### 🎯 CRM de Leads Inteligente
- ✅ Cadastro, edição e gestão completa de contatos
- ✅ Segmentação avançada com tags e filtros personalizados
- ✅ Importação/exportação de leads via CSV
- ✅ Campos customizados e histórico de interações
- ✅ Sistema de tags dinâmicas

### 📧 Gestão de Campanhas
- ✅ Criação de campanhas de email personalizadas
- ✅ Templates profissionais com variáveis dinâmicas
- ✅ Agendamento de envios
- ✅ Métricas em tempo real (aberturas, cliques, bounces)
- ✅ Relatórios detalhados e exportação de dados

### 🤖 Automações com IA
- 🚧 Builder visual para fluxos automatizados
- 🚧 IA para geração de conteúdo e otimização
- 🚧 Triggers baseados em comportamento do usuário
- 🚧 Sugestões inteligentes de campanhas

### 🔗 Integração e APIs
- ✅ Integração nativa com Resend para máxima entregabilidade
- ✅ Webhooks RESTful para receber dados externos
- ✅ APIs completas para integrações customizadas
- ✅ Sistema de eventos em tempo real

### 🏢 Multi-tenant e Segurança
- ✅ Isolamento completo de dados por workspace
- ✅ Autenticação segura com Supabase Auth
- ✅ Roles e permissões granulares
- ✅ Logs de auditoria completos

### 📊 Dashboard e Relatórios
- ✅ Dashboard com KPIs principais
- ✅ Gráficos de performance em tempo real
- ✅ Análise de engajamento detalhada
- ✅ Exportação de relatórios customizados

## 🛠 Stack Tecnológica

### Frontend
- **Next.js 14** - Framework React com SSR/SSG
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework de CSS utilitário
- **Shadcn/UI** - Componentes modernos e acessíveis
- **Radix UI** - Primitivos de UI headless
- **Lucide React** - Ícones SVG otimizados

### Backend & Banco de Dados
- **Supabase** - Backend-as-a-Service (PostgreSQL)
- **Supabase Auth** - Autenticação e autorização
- **Row Level Security (RLS)** - Segurança de dados
- **PostgreSQL Functions** - Lógica de negócio no banco

### Serviços Externos
- **Resend** - Entrega de emails transacionais
- **OpenAI/Claude** - IA para geração de conteúdo (planejado)
- **Digital Ocean** - Deploy e hospedagem

### Ferramentas de Desenvolvimento
- **Bun** - Runtime e package manager
- **Biome** - Linter e formatter
- **ESLint** - Análise estática de código
- **TypeScript** - Desenvolvimento type-safe

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+ ou Bun
- Conta no Supabase
- Conta no Resend
- Git

### 1. Clone o repositório
```bash
git clone https://github.com/your-username/emailsend.git
cd emailsend
```

### 2. Instale as dependências
```bash
bun install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env.local
```

Edite o arquivo `.env.local` com suas credenciais:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Resend
RESEND_API_KEY=your_resend_api_key

# OpenAI/Claude (opcional)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
WEBHOOK_SECRET=your_webhook_secret
```

### 4. Configure o banco de dados

1. Crie um novo projeto no Supabase
2. Execute o schema SQL:
```bash
# No SQL Editor do Supabase, execute:
# 1. database/schema.sql
# 2. database/functions.sql
```

3. Configure as políticas RLS no painel do Supabase

### 5. Configure o Resend

1. Crie uma conta no [Resend](https://resend.com)
2. Adicione e verifique seu domínio
3. Obtenha sua API Key
4. Configure webhooks (opcional) apontando para:
   - `https://yourdomain.com/api/webhooks/resend`

### 6. Inicie o servidor de desenvolvimento
```bash
bun run dev
```

Acesse [http://localhost:3000](http://localhost:3000) para ver a aplicação.

## 📚 Estrutura do Projeto

```
emailsend/
├── src/
│   ├── app/                     # App Router do Next.js
│   │   ├── api/                 # API Routes
│   │   │   ├── campaigns/       # Endpoints de campanhas
│   │   │   └── webhooks/        # Webhooks externos
│   │   ├── auth/                # Páginas de autenticação
│   │   ├── dashboard/           # Área administrativa
│   │   │   ├── leads/           # Gestão de leads
│   │   │   ├── campaigns/       # Gestão de campanhas
│   │   │   ├── automations/     # Automações (planejado)
│   │   │   └── settings/        # Configurações
│   │   └── page.tsx             # Landing page
│   ├── components/              # Componentes React
│   │   ├── ui/                  # Componentes Shadcn/UI
│   │   ├── auth/                # Componentes de auth
│   │   └── layout/              # Layouts da aplicação
│   └── lib/                     # Utilitários e configurações
│       ├── supabase.ts          # Cliente Supabase
│       ├── resend.ts            # Integração Resend
│       └── utils.ts             # Funções utilitárias
├── database/                    # Scripts SQL
│   ├── schema.sql               # Schema do banco
│   └── functions.sql            # Funções PostgreSQL
├── public/                      # Arquivos estáticos
└── docs/                        # Documentação
```

## 🔧 Configuração Avançada

### Webhooks do Resend

Para receber eventos de email em tempo real, configure webhooks no Resend:

1. Acesse o painel do Resend
2. Vá em "Webhooks" > "Add webhook"
3. URL: `https://yourdomain.com/api/webhooks/resend`
4. Eventos: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`

### Automações com IA

Para habilitar recursos de IA:

1. Configure as API keys da OpenAI ou Anthropic
2. Implemente os fluxos de automação (em desenvolvimento)
3. Configure triggers e condições personalizadas

### Deploy na Digital Ocean

1. Crie um App no Digital Ocean
2. Conecte com seu repositório GitHub
3. Configure as variáveis de ambiente
4. Deploy automático a cada push

## 📊 Banco de Dados

### Principais Tabelas

- **workspaces** - Espaços de trabalho (multi-tenant)
- **users** - Usuários do sistema
- **workspace_members** - Membros de workspaces
- **leads** - Contatos/prospects
- **campaigns** - Campanhas de email
- **email_sends** - Registro de envios
- **email_templates** - Templates de email
- **automation_flows** - Fluxos de automação
- **webhooks** - Configuração de webhooks
- **lead_activities** - Histórico de atividades

### Funções Importantes

- `increment_campaign_*()` - Atualização de estatísticas
- `get_campaign_stats()` - Métricas agregadas
- `create_workspace_with_user()` - Setup inicial
- `handle_email_unsubscribe()` - Descadastro

## 🔐 Segurança

### Row Level Security (RLS)
- Isolamento completo de dados por workspace
- Políticas granulares por tabela
- Validação de permissões em tempo real

### Autenticação
- OAuth com Google
- Email/senha com confirmação
- JWT tokens seguros
- Refresh tokens automáticos

### Validação de Dados
- Schemas Zod para validação
- Sanitização de inputs
- Rate limiting nas APIs
- Verificação de webhooks

## 🧪 Testes (Planejado)

```bash
# Testes unitários
bun test

# Testes de integração
bun test:integration

# Testes E2E
bun test:e2e
```

## 📈 Monitoramento

### Métricas Principais
- Taxa de entregabilidade
- Taxa de abertura de emails
- Taxa de cliques
- Crescimento de leads
- Performance de campanhas

### Logs
- Logs de aplicação
- Logs de API
- Logs de webhook
- Logs de auditoria

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

- 📧 Email: support@emailsend.com
- 💬 Discord: [EmailSend Community](https://discord.gg/emailsend)
- 📚 Docs: [docs.emailsend.com](https://docs.emailsend.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/emailsend/issues)

## 🛣 Roadmap

### ✅ Fase 1 - Fundação (Concluída)
- [x] Sistema de autenticação
- [x] CRM básico de leads
- [x] Campanhas de email
- [x] Integração Resend
- [x] Dashboard inicial

### 🚧 Fase 2 - Automações (Em Desenvolvimento)
- [ ] Builder visual de fluxos
- [ ] Triggers automatizados
- [ ] Integração com IA
- [ ] Templates avançados

### 📋 Fase 3 - Escalabilidade
- [ ] Analytics avançados
- [ ] A/B Testing
- [ ] Segmentação por ML
- [ ] API completa
- [ ] Marketplace de templates

### 🎯 Fase 4 - Enterprise
- [ ] White-label
- [ ] SSO/SAML
- [ ] Compliance GDPR
- [ ] SLA garantido
- [ ] Suporte dedicado

---

**EmailSend** - Revolucionando o Email Marketing com Inteligência Artificial 🚀
