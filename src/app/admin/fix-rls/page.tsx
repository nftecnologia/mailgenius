'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabaseAdmin } from '@/lib/supabase'
import { Database, Shield, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react'

export default function FixRLSPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const checkRLS = async () => {
    setLoading(true)
    setResults([])

    try {
      // Tables to check
      const tables = ['users', 'workspaces', 'workspace_members', 'leads', 'campaigns', 'email_templates']
      const checkResults = []

      for (const table of tables) {
        console.log(`🔍 Checking RLS for table: ${table}`)

        try {
          // Try to query the table
          const { data, error } = await supabaseAdmin
            .from(table)
            .select('*')
            .limit(1)

          if (error) {
            checkResults.push({
              table,
              status: 'error',
              message: error.message,
              code: error.code
            })
          } else {
            checkResults.push({
              table,
              status: 'success',
              message: 'Table accessible',
              hasData: data && data.length > 0
            })
          }
        } catch (err: any) {
          checkResults.push({
            table,
            status: 'error',
            message: err.message || 'Unknown error'
          })
        }
      }

      setResults(checkResults)
    } catch (error) {
      console.error('Error checking RLS:', error)
    } finally {
      setLoading(false)
    }
  }

  const fixRLS = async () => {
    setLoading(true)

    try {
      console.log('🔧 Applying RLS fixes...')

      // SQL to fix common RLS issues
      const fixes = [
        // Enable RLS on all tables
        `ALTER TABLE users ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE leads ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;`,

        // Basic policies for users table
        `CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);`,
        `CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);`,
        `CREATE POLICY "Service role can manage users" ON users FOR ALL USING (auth.jwt()->>'role' = 'service_role');`,

        // Basic policies for workspace_members
        `CREATE POLICY "Users can view their memberships" ON workspace_members FOR SELECT USING (auth.uid() = user_id);`,
        `CREATE POLICY "Service role can manage memberships" ON workspace_members FOR ALL USING (auth.jwt()->>'role' = 'service_role');`,

        // Basic policies for workspaces
        `CREATE POLICY "Members can view their workspaces" ON workspaces FOR SELECT
          USING (EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
          ));`,

        // Basic policies for leads
        `CREATE POLICY "Members can view workspace leads" ON leads FOR SELECT
          USING (EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = leads.workspace_id
            AND workspace_members.user_id = auth.uid()
          ));`,

        // Basic policies for campaigns
        `CREATE POLICY "Members can view workspace campaigns" ON campaigns FOR SELECT
          USING (EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = campaigns.workspace_id
            AND workspace_members.user_id = auth.uid()
          ));`,

        // Basic policies for email_templates
        `CREATE POLICY "Members can view workspace templates" ON email_templates FOR SELECT
          USING (EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = email_templates.workspace_id
            AND workspace_members.user_id = auth.uid()
          ));`,
      ]

      const fixResults = []

      for (const fix of fixes) {
        try {
          // Skip if it's a policy that might already exist
          if (fix.includes('CREATE POLICY')) {
            const policyName = fix.match(/"([^"]+)"/)?.[1]
            const tableName = fix.match(/ON (\w+)/)?.[1]

            // Check if policy exists first
            const { data: existingPolicies } = await supabaseAdmin
              .rpc('pg_policies')
              .eq('tablename', tableName)
              .eq('policyname', policyName)

            if (existingPolicies && existingPolicies.length > 0) {
              fixResults.push({
                sql: fix.substring(0, 50) + '...',
                status: 'skipped',
                message: 'Policy already exists'
              })
              continue
            }
          }

          const { error } = await supabaseAdmin.rpc('exec_sql', { sql: fix })

          if (error) {
            fixResults.push({
              sql: fix.substring(0, 50) + '...',
              status: 'error',
              message: error.message
            })
          } else {
            fixResults.push({
              sql: fix.substring(0, 50) + '...',
              status: 'success',
              message: 'Applied successfully'
            })
          }
        } catch (err: any) {
          fixResults.push({
            sql: fix.substring(0, 50) + '...',
            status: 'error',
            message: err.message || 'Unknown error'
          })
        }
      }

      // Re-check after fixes
      await checkRLS()

    } catch (error) {
      console.error('Error fixing RLS:', error)
    } finally {
      setLoading(false)
    }
  }

  const createExecSqlFunction = async () => {
    setLoading(true)

    try {
      const createFunction = `
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$;
      `

      const { error } = await supabaseAdmin.rpc('query', { query: createFunction })

      if (error) {
        alert('Error creating function: ' + error.message)
      } else {
        alert('exec_sql function created successfully!')
      }
    } catch (error) {
      console.error('Error creating function:', error)
      alert('Error: ' + (error as any).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Corrigir RLS do Supabase
          </h1>
          <p className="text-gray-600">
            Diagnosticar e corrigir problemas de Row Level Security
          </p>
        </div>

        {/* Warning Alert */}
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Atenção:</strong> Esta página executa operações administrativas no banco de dados.
            Use apenas em ambiente de desenvolvimento ou com cuidado em produção.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Ações de RLS
            </CardTitle>
            <CardDescription>
              Verifique e corrija problemas de segurança nas tabelas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={checkRLS}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Verificar RLS
              </Button>

              <Button
                onClick={fixRLS}
                disabled={loading}
                variant="default"
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                Aplicar Correções
              </Button>

              <Button
                onClick={createExecSqlFunction}
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                Criar Função exec_sql
              </Button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-900">
              <p className="font-medium mb-2">Como usar:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Clique em "Verificar RLS" para diagnosticar problemas</li>
                <li>Se houver erros 403 ou 406, clique em "Aplicar Correções"</li>
                <li>As correções criarão políticas básicas de RLS</li>
                <li>Verifique novamente após aplicar as correções</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados da Verificação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.status === 'success'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {result.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <h4 className="font-medium">
                            {result.table || result.sql}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {result.message}
                          </p>
                          {result.code && (
                            <Badge variant="secondary" className="mt-1">
                              {result.code}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {result.hasData !== undefined && (
                        <Badge variant={result.hasData ? 'default' : 'secondary'}>
                          {result.hasData ? 'Com dados' : 'Vazio'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Links Úteis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <Button variant="outline" asChild>
                <a href="/admin/setup">Admin Setup</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/dashboard">Dashboard</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://supabase.com/dashboard" target="_blank">
                  Supabase Dashboard
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
