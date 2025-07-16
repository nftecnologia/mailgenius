# 📋 Instruções de Migração - EmailSend SaaS

## 🚨 IMPORTANTE: Executar em ORDEM EXATA

### 🔧 **CORREÇÃO: Erro "lead_segments does not exist"**
Se você já executou algumas migrações e está vendo erro sobre `lead_segments`, execute a **migração 007** que corrige tabelas faltantes!

### ✅ **Passo 1: Acessar Supabase**
1. Abra: https://supabase.com/dashboard/project/gdssxrzeclqmgshazvxy
2. Vá para: **SQL Editor** (menu lateral)

### ✅ **Passo 2: Executar Migrações (EM ORDEM)**

**Copie e cole CADA arquivo completamente no SQL Editor:**

#### 1️⃣ **001_initial_setup.sql** (PRIMEIRO)
```
Cria: workspaces, users, leads, lists, lead_segments
Resultado esperado: ✅ Success
```

#### 2️⃣ **002_campaigns_templates.sql** (SEGUNDO)
```
Cria: email_templates, campaigns, tracking
Resultado esperado: ✅ Success
```

#### 3️⃣ **003_automations.sql** (TERCEIRO)
```
Cria: automations, sequences, steps
Resultado esperado: ✅ Success
```

#### 4️⃣ **004_webhooks_api.sql** (QUARTO)
```
Cria: api_keys, webhooks, integrations
Resultado esperado: ✅ Success
```

#### 5️⃣ **005_ab_testing.sql** (QUINTO)
```
Cria: ab_tests, variants, participants
Resultado esperado: ✅ Success
```

#### 6️⃣ **006_add_foreign_keys.sql** (SEXTO)
```
Migração de compatibilidade (não faz nada)
Resultado esperado: ✅ Success - apenas uma mensagem
```

#### 7️⃣ **007_fix_missing_tables.sql** (ÚLTIMO - CORREÇÃO)
```
Cria: tabelas faltantes + foreign keys com verificações
SOLUÇÃO: para erro "relation lead_segments does not exist"
Resultado esperado: ✅ Success - cria tudo que estava faltando
```

## 🔧 **Se houver ERROS:**

### ❌ "relation does not exist"
1. **PARE** a execução
2. Verifique se executou as migrações anteriores
3. Execute `SELECT tablename FROM pg_tables WHERE schemaname='public';` para ver tabelas criadas
4. Continue apenas se todas as tabelas estão presentes

### ❌ "constraint already exists"
- ✅ **NORMAL** - pode ignorar, significa que já foi criado

### ❌ "syntax error"
- ❌ **PROBLEMA** - copie o arquivo novamente, pode ter faltado parte

## 🎯 **Verificação Final**

Execute este comando para verificar se tudo foi criado:

```sql
-- Verificar todas as tabelas criadas
SELECT
    t.table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'auth%'
ORDER BY table_name;
```

**Resultado esperado: ~35 tabelas**

## 🔑 **Passo 3: Configurar Autenticação**

1. Vá para: **Authentication > Settings**
2. Enable: **Email/Password**
3. Configure: **Redirect URLs**
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback`

## 🔐 **Passo 4: Obter API Keys**

1. Vá para: **Settings > API**
2. Copie:
   - `anon` key
   - `service_role` key
3. Atualize arquivo `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gdssxrzeclqmgshazvxy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=seu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=seu_service_role_key_aqui
```

## ✅ **Verificação de Sucesso**

Após tudo configurado, execute no seu projeto:

```bash
cd emailsend
bun run dev
```

E acesse: http://localhost:3000

Se conseguir fazer login/registro, tudo está funcionando! 🎉
