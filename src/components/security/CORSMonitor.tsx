'use client'

import React, { useState, useEffect } from 'react'
import { useCORS, useCORSMonitoring } from '@/lib/hooks/useCORS'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Globe, 
  Lock,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react'

interface CORSMonitorProps {
  showDetails?: boolean
  autoRefresh?: boolean
  className?: string
}

export function CORSMonitor({ 
  showDetails = false, 
  autoRefresh = true,
  className = ''
}: CORSMonitorProps) {
  const { 
    corsInfo, 
    corsErrors, 
    loading, 
    checkAPIConnectivity,
    clearCORSErrors,
    getDebugInfo
  } = useCORS()
  
  const { 
    violations, 
    clearViolations, 
    violationCount 
  } = useCORSMonitoring()
  
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(async () => {
        const connected = await checkAPIConnectivity()
        setApiConnected(connected)
      }, 30000) // Check every 30 seconds

      return () => clearInterval(interval)
    }
  }, [autoRefresh, checkAPIConnectivity])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const connected = await checkAPIConnectivity()
      setApiConnected(connected)
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusIcon = () => {
    if (loading) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (!corsInfo) return <XCircle className="h-4 w-4 text-red-500" />
    if (corsInfo.isAllowed) return <CheckCircle className="h-4 w-4 text-green-500" />
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />
  }

  const getStatusText = () => {
    if (loading) return 'Verificando CORS...'
    if (!corsInfo) return 'Erro ao carregar CORS'
    if (corsInfo.isAllowed) return 'CORS Configurado'
    return 'Origem não permitida'
  }

  const getTotalIssues = () => {
    return corsErrors.length + violationCount
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-600">Carregando informações de CORS...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Status Principal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Status CORS
            {getStatusIcon()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={corsInfo?.isAllowed ? 'default' : 'destructive'}>
                {getStatusText()}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Origem Atual:</span>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                {corsInfo?.currentOrigin}
              </code>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Ambiente:</span>
              <Badge variant="outline">
                {corsInfo?.environment}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Conectividade API:</span>
              <div className="flex items-center gap-2">
                <Badge variant={apiConnected ? 'default' : 'destructive'}>
                  {apiConnected === null ? 'Não testado' : apiConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-6 px-2"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problemas detectados */}
      {getTotalIssues() > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Problemas Detectados ({getTotalIssues()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {corsErrors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{error.code}:</strong> {error.message}
                    {error.origin && (
                      <div className="text-xs mt-1">Origem: {error.origin}</div>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
              
              {violations.map((violation, index) => (
                <Alert key={`violation-${index}`} variant="destructive">
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{violation.code}:</strong> {violation.message}
                  </AlertDescription>
                </Alert>
              ))}
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearCORSErrors}
                  className="h-8"
                >
                  Limpar Erros CORS
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearViolations}
                  className="h-8"
                >
                  Limpar Violações
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhes (opcional) */}
      {showDetails && corsInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              Origens Permitidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {corsInfo.allowedOrigins.map((origin, index) => (
                <div key={index} className="flex items-center justify-between">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {origin}
                  </code>
                  <Badge variant={origin === corsInfo.currentOrigin ? 'default' : 'outline'}>
                    {origin === corsInfo.currentOrigin ? 'Atual' : 'Permitido'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Debug CORS
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="h-8"
            >
              {showDebugInfo ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {showDebugInfo && (
          <CardContent>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(getDebugInfo(), null, 2)}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/**
 * Componente compacto para mostrar apenas o status
 */
export function CORSStatusBadge({ className = '' }: { className?: string }) {
  const { corsInfo, corsErrors, loading } = useCORS()
  const { violationCount } = useCORSMonitoring()
  
  if (loading) {
    return (
      <Badge variant="outline" className={className}>
        <RefreshCw className="h-3 w-3 animate-spin mr-1" />
        Carregando...
      </Badge>
    )
  }

  const totalIssues = corsErrors.length + violationCount
  const hasIssues = totalIssues > 0
  const isAllowed = corsInfo?.isAllowed

  return (
    <Badge 
      variant={hasIssues ? 'destructive' : isAllowed ? 'default' : 'secondary'}
      className={className}
    >
      {hasIssues ? (
        <AlertTriangle className="h-3 w-3 mr-1" />
      ) : isAllowed ? (
        <CheckCircle className="h-3 w-3 mr-1" />
      ) : (
        <XCircle className="h-3 w-3 mr-1" />
      )}
      CORS {hasIssues ? `(${totalIssues})` : isAllowed ? 'OK' : 'Bloqueado'}
    </Badge>
  )
}