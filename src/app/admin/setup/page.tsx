'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { seedSupabaseData, checkSupabaseData } from '@/lib/utils/seedData'
import { supabase } from '@/lib/supabase'
import { Database, CheckCircle, XCircle, RefreshCw, Play, Settings, Zap } from 'lucide-react'

export default function AdminSetupPage() {
  const [loading, setLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [dataStatus, setDataStatus] = useState<any>(null)

  const testConnection = async () => {
    setLoading(true)
    setResult(null)

    try {
      console.log('🔌 Testing Supabase connection...')

      // Test basic connection
      const { data, error } = await supabase
        .from('workspaces')
        .select('count')
        .limit(1)

      if (error) {
        setConnectionStatus('error')
        setResult({
          success: false,
          message: 'Erro na conexão com Supabase',
          error: error.message
        })
      } else {
        setConnectionStatus('connected')
        setResult({
          success: true,
          message: 'Conexão com Supabase estabelecida com sucesso!',
          data
        })

        // Check existing data
        const dataCheck = await checkSupabaseData()
        setDataStatus(dataCheck)
      }

    } catch (error) {
      setConnectionStatus('error')
      setResult({
        success: false,
        message: 'Erro inesperado na conexão',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const seedData = async () => {
    setSeedLoading(true)
    setResult(null)

    try {
      console.log('🌱 Starting data seeding...')
      const seedResult = await seedSupabaseData()

      setResult({
        success: seedResult.success,
        message: seedResult.success
          ? 'Dados de exemplo criados com sucesso!'
          : 'Erro ao criar dados de exemplo',
        details: seedResult
      })

      // Refresh data status
      if (seedResult.success) {
        const dataCheck = await checkSupabaseData()
        setDataStatus(dataCheck)
      }

    } catch (error) {
      setResult({
        success: false,
        message: 'Erro ao popular banco de dados',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setSeedLoading(false)
    }
  }

  const checkData = async () => {
    setLoading(true)
    try {
      const dataCheck = await checkSupabaseData()
      setDataStatus(dataCheck)
    } catch (error) {
      console.error('Error checking data:', error)
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
            MailGenius - Configuração Administrativa
          </h1>
          <p className="text-gray-600">
            Teste e configure a conexão com Supabase
          </p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Status da Conexão Supabase
            </CardTitle>
            <CardDescription>
              Verifique se a conexão com o banco de dados está funcionando
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={testConnection}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Testar Conexão
              </Button>

              {connectionStatus !== 'unknown' && (
                <Badge
                  variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
                  className="flex items-center gap-1"
                >
                  {connectionStatus === 'connected' ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {connectionStatus === 'connected' ? 'Conectado' : 'Erro'}
                </Badge>
              )}
            </div>

            {/* Connection Details */}
            <div className="bg-gray-100 rounded-lg p-4 space-y-2">
              <div className="text-sm">
                <strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Não configurado'}
              </div>
              <div className="text-sm">
                <strong>API Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?
                  `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` :
                  'Não configurado'
                }
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Status dos Dados
            </CardTitle>
            <CardDescription>
              Verifique se existem dados de exemplo no banco
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={checkData}
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Verificar Dados
              </Button>

              <Button
                onClick={seedData}
                disabled={seedLoading || connectionStatus !== 'connected'}
                className="flex items-center gap-2"
              >
                {seedLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Popular com Dados de Exemplo
              </Button>
            </div>

            {/* Data Status Details */}
            {dataStatus && (
              <div className="bg-gray-100 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <strong>Workspace:</strong>
                  {dataStatus.workspace ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Existente
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Não encontrado
                    </Badge>
                  )}
                </div>
                <div className="text-sm">
                  <strong>Leads:</strong> {dataStatus.leadsCount || 0} registros
                </div>
                <div className="text-sm">
                  <strong>Campanhas:</strong> {dataStatus.campaignsCount || 0} registros
                </div>
                <div className="text-sm">
                  <strong>Templates:</strong> {dataStatus.templatesCount || 0} registros
                </div>
                <div className="flex items-center gap-2">
                  <strong>Status Geral:</strong>
                  {dataStatus.hasData ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Dados Disponíveis
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Sem Dados
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result Display */}
        {result && (
          <Card className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.message}
                  </h4>
                  {result.error && (
                    <p className="text-sm text-red-700 mt-1">
                      Erro: {result.error}
                    </p>
                  )}
                  {result.details && (
                    <div className="text-sm mt-2">
                      <pre className="bg-white p-2 rounded border text-xs overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Links úteis para desenvolvimento e teste
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" asChild className="h-auto p-4">
                <a href="/dashboard" className="flex flex-col items-center space-y-2">
                  <Database className="h-6 w-6" />
                  <span>Dashboard</span>
                  <span className="text-xs text-gray-500">Ver dashboard com dados reais</span>
                </a>
              </Button>

              <Button variant="outline" asChild className="h-auto p-4">
                <a href="/auth" className="flex flex-col items-center space-y-2">
                  <Settings className="h-6 w-6" />
                  <span>Autenticação</span>
                  <span className="text-xs text-gray-500">Página de login/cadastro</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
