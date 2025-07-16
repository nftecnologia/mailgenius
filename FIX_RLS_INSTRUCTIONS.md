# 🔧 Como Corrigir o Erro de RLS no Supabase

## ⚠️ IMPORTANTE: Execute os scripts na ordem correta!

### 📝 Ordem de Execução:
1. **SE TIVER ERRO DE ENUM**: `scripts/fix-enum-quick.sql` (corrige tipo user_role)
2. **DEPOIS**: `scripts/fix-database-structure.sql` (corrige estrutura)
3. **POR ÚLTIMO**: `scripts/fix-rls.sql` (aplica políticas RLS)

**OU use o script completo**: `scripts/fix-all-database-issues.sql` (faz tudo de uma vez)

## ⚡ Solução Rápida (Recomendada)

1. **Acesse seu Painel do Supabase**
   - Vá para: https://supabase.com/dashboard
   - Faça login e selecione seu projeto

2. **Vá para o SQL Editor**
   - No menu lateral, clique em "SQL Editor"

3. **Execute os Scripts na Ordem**

   **PRIMEIRO - Corrigir Estrutura:**
   - Copie todo o conteúdo do arquivo `scripts/fix-database-structure.sql`
   - Cole no editor SQL
   - Clique em "RUN" ou pressione Ctrl+Enter
   - Aguarde a mensagem: "Database structure fixed successfully!"

   **DEPOIS - Aplicar RLS:**
   - Copie todo o conteúdo do arquivo `scripts/fix-rls.sql`
   - Cole no editor SQL
   - Clique em "RUN" ou pressione Ctrl+Enter

4. **Verifique o Resultado**
   - Você deve ver a mensagem: "RLS policies applied successfully!"
   - Se houver erros, veja a seção de solução de problemas abaixo

## 🎯 O que os scripts fazem?

### Script 1: fix-database-structure.sql
- ✅ Cria tabela `lead_segments` se não existir
- ✅ Adiciona colunas faltantes em todas as tabelas
- ✅ Cria índices para melhor performance
- ✅ Adiciona chaves estrangeiras necessárias

### Script 2: fix-rls.sql
Configura as políticas de segurança (RLS) necessárias para:
- ✅ Permitir que usuários criem seus próprios perfis
- ✅ Permitir que usuários visualizem e editem seus dados
- ✅ Permitir que usuários criem e gerenciem workspaces
- ✅ Proteger dados de outros usuários
- ✅ Garantir acesso adequado a leads, campanhas e templates

## 🚨 Solução de Problemas

### Erro: "column segment_id does not exist"

Este erro indica que faltam colunas ou tabelas no banco. Execute PRIMEIRO o script `fix-database-structure.sql` antes do script RLS.

### Erro: "invalid input value for enum user_role: editor"

Este erro ocorre porque o tipo ENUM `user_role` não tem o valor "editor". Execute o script `fix-enum-quick.sql` ANTES dos outros scripts.

### Se o script falhar:

1. **Erro: "function exec_sql does not exist"**
   - Ignore este erro, é normal na primeira execução

2. **Erro: "policy already exists"**
   - Execute apenas a parte de DROP POLICY primeiro
   - Depois execute o resto do script

3. **Erro: "permission denied"**
   - Certifique-se de estar usando as credenciais corretas
   - Verifique se você tem permissões de administrador

## 📝 Alternativa Manual

Se preferir aplicar as correções manualmente:

1. Acesse `/fix-rls-now` no seu app local
2. Clique em "Fix RLS Now"
3. Aguarde a confirmação

## ✅ Como verificar se funcionou?

1. Tente criar uma nova conta no sistema
2. O erro "new row violates row-level security policy" não deve mais aparecer
3. Você deve conseguir fazer login e acessar o dashboard

## 🆘 Ainda com problemas?

Se o erro persistir:
1. Verifique se o Supabase está configurado corretamente no `.env`
2. Certifique-se de que as tabelas existem no banco
3. Verifique os logs do Supabase para mais detalhes

---

**Nota:** Essas políticas de RLS são essenciais para a segurança do seu aplicativo. Elas garantem que cada usuário só possa acessar seus próprios dados.
