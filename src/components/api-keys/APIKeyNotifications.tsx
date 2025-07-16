'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  RotateCcw,
  X,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface APIKeyNotification {
  id: string
  api_key_id: string
  notification_type: 'expiring_soon' | 'expired' | 'renewed' | 'revoked'
  notification_data: {
    key_name: string
    expires_at?: string
    expired_at?: string
    renewed_at?: string
    days_until_expiry?: number
    auto_renew?: boolean
  }
  status: 'pending' | 'sent' | 'failed'
  created_at: string
  api_key?: {
    name: string
    status: string
  }
}

interface APIKeyNotificationsProps {
  workspaceId: string
  onRenewKey?: (keyId: string, keyName: string) => void
}

export default function APIKeyNotifications({ workspaceId, onRenewKey }: APIKeyNotificationsProps) {
  const [notifications, setNotifications] = useState<APIKeyNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pending: 0,
    sent: 0,
    failed: 0,
    total: 0
  })

  useEffect(() => {
    loadNotifications()
    loadStats()
  }, [workspaceId])

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/settings/api-keys/notifications?pending=true')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/settings/api-keys/notifications?stats=true')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || { pending: 0, sent: 0, failed: 0, total: 0 })
      }
    } catch (error) {
      console.error('Error loading notification stats:', error)
    }
  }

  const processNotificationQueue = async () => {
    try {
      const response = await fetch('/api/settings/api-keys/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'process_queue' })
      })

      if (response.ok) {
        toast.success('Fila de notificações processada')
        loadNotifications()
        loadStats()
      } else {
        toast.error('Erro ao processar fila de notificações')
      }
    } catch (error) {
      console.error('Error processing queue:', error)
      toast.error('Erro ao processar fila de notificações')
    }
  }

  const checkExpiringKeys = async () => {
    try {
      const response = await fetch('/api/settings/api-keys/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'check_expiring' })
      })

      if (response.ok) {
        toast.success('Verificação de expiração executada')
        loadNotifications()
        loadStats()
      } else {
        toast.error('Erro ao verificar keys expirando')
      }
    } catch (error) {
      console.error('Error checking expiring keys:', error)
      toast.error('Erro ao verificar keys expirando')
    }
  }

  const dismissNotification = async (notificationId: string) => {
    try {
      const response = await fetch('/api/settings/api-keys/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          notification_id: notificationId,
          status: 'sent'
        })
      })

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        loadStats()
      } else {
        toast.error('Erro ao descartar notificação')
      }
    } catch (error) {
      console.error('Error dismissing notification:', error)
      toast.error('Erro ao descartar notificação')
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'expiring_soon':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'expired':
        return <Clock className="h-4 w-4 text-red-500" />
      case 'renewed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'revoked':
        return <X className="h-4 w-4 text-gray-500" />
      default:
        return <Bell className="h-4 w-4 text-blue-500" />
    }
  }

  const getNotificationTitle = (notification: APIKeyNotification) => {
    const { notification_type, notification_data } = notification
    
    switch (notification_type) {
      case 'expiring_soon':
        return `API Key "${notification_data.key_name}" expirando`
      case 'expired':
        return `API Key "${notification_data.key_name}" expirou`
      case 'renewed':
        return `API Key "${notification_data.key_name}" renovada`
      case 'revoked':
        return `API Key "${notification_data.key_name}" revogada`
      default:
        return `Notificação sobre "${notification_data.key_name}"`
    }
  }

  const getNotificationDescription = (notification: APIKeyNotification) => {
    const { notification_type, notification_data } = notification
    
    switch (notification_type) {
      case 'expiring_soon':
        return `Expira em ${notification_data.days_until_expiry} dia(s)`
      case 'expired':
        return `Expirou em ${notification_data.expired_at ? formatDistanceToNow(new Date(notification_data.expired_at), { addSuffix: true, locale: ptBR }) : 'data desconhecida'}`
      case 'renewed':
        return `Renovada ${notification_data.renewed_at ? formatDistanceToNow(new Date(notification_data.renewed_at), { addSuffix: true, locale: ptBR }) : 'recentemente'}`
      case 'revoked':
        return 'Key foi revogada'
      default:
        return 'Notificação sobre API key'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            Notificações de API Keys
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkExpiringKeys}
              className="text-xs"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Verificar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={processNotificationQueue}
              className="text-xs"
            >
              <Bell className="mr-1 h-3 w-3" />
              Processar
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-xs text-gray-500">Pendentes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
            <div className="text-xs text-gray-500">Enviadas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-gray-500">Falharam</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.notification_type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm">
                      {getNotificationTitle(notification)}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={notification.status === 'pending' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {notification.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissNotification(notification.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {getNotificationDescription(notification)}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                    
                    {notification.notification_type === 'expiring_soon' && onRenewKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRenewKey(notification.api_key_id, notification.notification_data.key_name)}
                        className="text-xs"
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Renovar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Bell className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>Nenhuma notificação pendente</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}