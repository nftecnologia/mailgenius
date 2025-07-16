import { createSupabaseServerClient } from '@/lib/supabase'
import { apiAuth } from '@/lib/api-auth'

export interface APIKeyNotification {
  id: string
  workspace_id: string
  api_key_id: string
  notification_type: 'expiring_soon' | 'expired' | 'renewed' | 'revoked'
  notification_data: any
  sent_at?: string
  status: 'pending' | 'sent' | 'failed'
  created_at: string
}

export class APIKeyNotificationService {
  private supabase = createSupabaseServerClient()

  async checkExpiringKeys(workspaceId?: string): Promise<void> {
    const supabase = createSupabaseServerClient()
    
    try {
      // Get all workspaces or specific workspace
      let workspaces: string[] = []
      
      if (workspaceId) {
        workspaces = [workspaceId]
      } else {
        const { data: workspaceData } = await supabase
          .from('workspaces')
          .select('id')
        
        workspaces = workspaceData?.map(w => w.id) || []
      }

      for (const workspace of workspaces) {
        await this.processWorkspaceNotifications(workspace)
      }
    } catch (error) {
      console.error('Error checking expiring keys:', error)
    }
  }

  private async processWorkspaceNotifications(workspaceId: string): Promise<void> {
    // Get keys expiring in the next 7 days
    const expiringKeys = await apiAuth.getExpiringAPIKeys(workspaceId, 7)
    
    // Get already expired keys
    const expiredKeys = await apiAuth.getExpiringAPIKeys(workspaceId, 0)
    
    // Process expiring soon notifications
    for (const key of expiringKeys) {
      await this.createExpiringNotification(key)
    }
    
    // Process expired notifications
    for (const key of expiredKeys) {
      if (key.status === 'expired') {
        await this.createExpiredNotification(key)
      }
    }
  }

  private async createExpiringNotification(apiKey: any): Promise<void> {
    const daysUntilExpiry = Math.ceil(
      (new Date(apiKey.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    // Don't create notification if already exists in last 24 hours
    const { data: existingNotification } = await this.supabase
      .from('api_key_notifications')
      .select('id')
      .eq('api_key_id', apiKey.id)
      .eq('notification_type', 'expiring_soon')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (existingNotification) {
      return
    }

    const notificationData = {
      key_name: apiKey.name,
      expires_at: apiKey.expires_at,
      days_until_expiry: daysUntilExpiry,
      auto_renew: apiKey.auto_renew
    }

    await this.supabase
      .from('api_key_notifications')
      .insert({
        workspace_id: apiKey.workspace_id,
        api_key_id: apiKey.id,
        notification_type: 'expiring_soon',
        notification_data: notificationData,
        status: 'pending'
      })
  }

  private async createExpiredNotification(apiKey: any): Promise<void> {
    // Don't create notification if already exists in last 24 hours
    const { data: existingNotification } = await this.supabase
      .from('api_key_notifications')
      .select('id')
      .eq('api_key_id', apiKey.id)
      .eq('notification_type', 'expired')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (existingNotification) {
      return
    }

    const notificationData = {
      key_name: apiKey.name,
      expired_at: apiKey.expires_at,
      auto_renew: apiKey.auto_renew
    }

    await this.supabase
      .from('api_key_notifications')
      .insert({
        workspace_id: apiKey.workspace_id,
        api_key_id: apiKey.id,
        notification_type: 'expired',
        notification_data: notificationData,
        status: 'pending'
      })
  }

  async getPendingNotifications(workspaceId: string): Promise<APIKeyNotification[]> {
    const { data, error } = await this.supabase
      .from('api_key_notifications')
      .select(`
        *,
        api_key:api_keys(name, status, expires_at)
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending notifications:', error)
      return []
    }

    return data || []
  }

  async markNotificationAsSent(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('api_key_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', notificationId)

    return !error
  }

  async markNotificationAsFailed(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('api_key_notifications')
      .update({
        status: 'failed'
      })
      .eq('id', notificationId)

    return !error
  }

  async getNotificationHistory(workspaceId: string, limit: number = 50): Promise<APIKeyNotification[]> {
    const { data, error } = await this.supabase
      .from('api_key_notifications')
      .select(`
        *,
        api_key:api_keys(name, status)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching notification history:', error)
      return []
    }

    return data || []
  }

  async sendEmailNotification(notification: APIKeyNotification): Promise<boolean> {
    try {
      // Get workspace admin emails
      const { data: admins } = await this.supabase
        .from('workspace_members')
        .select(`
          user:users(email, name)
        `)
        .eq('workspace_id', notification.workspace_id)
        .eq('role', 'admin')
        .eq('status', 'active')

      if (!admins || admins.length === 0) {
        console.warn('No admin users found for workspace:', notification.workspace_id)
        return false
      }

      // In a real implementation, you would send emails here
      // For now, we'll just log the notification
      console.log('Sending notification email:', {
        type: notification.notification_type,
        data: notification.notification_data,
        recipients: admins.map(admin => admin.user?.email).filter(Boolean)
      })

      // Mark as sent
      await this.markNotificationAsSent(notification.id)
      return true
    } catch (error) {
      console.error('Error sending email notification:', error)
      await this.markNotificationAsFailed(notification.id)
      return false
    }
  }

  async processNotificationQueue(workspaceId?: string): Promise<void> {
    try {
      let notifications: APIKeyNotification[] = []

      if (workspaceId) {
        notifications = await this.getPendingNotifications(workspaceId)
      } else {
        // Get all pending notifications across all workspaces
        const { data, error } = await this.supabase
          .from('api_key_notifications')
          .select(`
            *,
            api_key:api_keys(name, status, expires_at)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching all pending notifications:', error)
          return
        }

        notifications = data || []
      }

      // Process each notification
      for (const notification of notifications) {
        await this.sendEmailNotification(notification)
      }
    } catch (error) {
      console.error('Error processing notification queue:', error)
    }
  }

  async getNotificationStats(workspaceId: string): Promise<{
    pending: number
    sent: number
    failed: number
    total: number
  }> {
    const { data, error } = await this.supabase
      .from('api_key_notifications')
      .select('status')
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error fetching notification stats:', error)
      return { pending: 0, sent: 0, failed: 0, total: 0 }
    }

    const stats = {
      pending: 0,
      sent: 0,
      failed: 0,
      total: data?.length || 0
    }

    data?.forEach(notification => {
      if (notification.status === 'pending') stats.pending++
      else if (notification.status === 'sent') stats.sent++
      else if (notification.status === 'failed') stats.failed++
    })

    return stats
  }

  // Auto-renewal process
  async processAutoRenewal(workspaceId?: string): Promise<void> {
    try {
      const supabase = createSupabaseServerClient()
      
      // Get keys that should be auto-renewed (expiring within 7 days and auto_renew = true)
      let query = supabase
        .from('api_keys')
        .select('*')
        .eq('auto_renew', true)
        .eq('status', 'active')
        .lt('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId)
      }

      const { data: keysToRenew, error } = await query

      if (error) {
        console.error('Error fetching keys for auto-renewal:', error)
        return
      }

      for (const key of keysToRenew || []) {
        try {
          await apiAuth.renewAPIKey(key.id, key.workspace_id, null, key.renewal_period_days)
          
          // Create renewal notification
          await this.supabase
            .from('api_key_notifications')
            .insert({
              workspace_id: key.workspace_id,
              api_key_id: key.id,
              notification_type: 'renewed',
              notification_data: {
                key_name: key.name,
                renewed_at: new Date().toISOString(),
                auto_renewal: true,
                new_expiry: new Date(Date.now() + key.renewal_period_days * 24 * 60 * 60 * 1000).toISOString()
              },
              status: 'pending'
            })

          console.log(`Auto-renewed API key: ${key.name} (${key.id})`)
        } catch (error) {
          console.error(`Error auto-renewing key ${key.id}:`, error)
        }
      }
    } catch (error) {
      console.error('Error processing auto-renewal:', error)
    }
  }
}

export const apiKeyNotificationService = new APIKeyNotificationService()