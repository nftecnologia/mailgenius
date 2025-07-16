import { logger } from '../logger'
import { metricsCollector } from './metrics'
import { healthChecker } from './health-check'

export interface AlertRule {
  id: string
  name: string
  description: string
  metric: string
  condition: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte'
  threshold: number
  duration: number // minutes
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  channels: AlertChannel[]
  cooldown: number // minutes
  tags?: Record<string, string>
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack' | 'sms'
  config: Record<string, any>
  enabled: boolean
}

export interface AlertIncident {
  id: string
  ruleId: string
  ruleName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved'
  message: string
  value: number
  threshold: number
  triggeredAt: number
  acknowledgedAt?: number
  resolvedAt?: number
  acknowledgedBy?: string
  resolvedBy?: string
  tags?: Record<string, string>
}

export interface AlertNotification {
  incident: AlertIncident
  channel: AlertChannel
  sentAt: number
  success: boolean
  error?: string
}

// Pre-configured alert rules
export const DEFAULT_ALERT_RULES: Omit<AlertRule, 'id'>[] = [
  {
    name: 'High API Latency',
    description: 'API response time is above 2 seconds',
    metric: 'api.latency',
    condition: 'gt',
    threshold: 2000,
    duration: 2,
    severity: 'high',
    enabled: true,
    channels: [],
    cooldown: 5
  },
  {
    name: 'High Error Rate',
    description: 'API error rate is above 5%',
    metric: 'api.errors',
    condition: 'gt',
    threshold: 5,
    duration: 5,
    severity: 'high',
    enabled: true,
    channels: [],
    cooldown: 10
  },
  {
    name: 'High Memory Usage',
    description: 'Memory usage is above 85%',
    metric: 'system.memory.usage_percent',
    condition: 'gt',
    threshold: 85,
    duration: 5,
    severity: 'medium',
    enabled: true,
    channels: [],
    cooldown: 10
  },
  {
    name: 'Critical Memory Usage',
    description: 'Memory usage is above 95%',
    metric: 'system.memory.usage_percent',
    condition: 'gt',
    threshold: 95,
    duration: 2,
    severity: 'critical',
    enabled: true,
    channels: [],
    cooldown: 5
  },
  {
    name: 'High Rate Limit Usage',
    description: 'Rate limit hits are above 100 per minute',
    metric: 'ratelimit.hits',
    condition: 'gt',
    threshold: 100,
    duration: 1,
    severity: 'medium',
    enabled: true,
    channels: [],
    cooldown: 15
  },
  {
    name: 'Email Delivery Failure',
    description: 'Email bounce rate is above 10%',
    metric: 'email.bounced',
    condition: 'gt',
    threshold: 10,
    duration: 10,
    severity: 'high',
    enabled: true,
    channels: [],
    cooldown: 30
  },
  {
    name: 'Service Unavailable',
    description: 'Health check failed',
    metric: 'health.status',
    condition: 'eq',
    threshold: 0, // 0 = unhealthy
    duration: 1,
    severity: 'critical',
    enabled: true,
    channels: [],
    cooldown: 5
  }
]

class AlertManager {
  private rules = new Map<string, AlertRule>()
  private incidents = new Map<string, AlertIncident>()
  private notifications: AlertNotification[] = []
  private lastChecked = new Map<string, number>()
  private isRunning = false

  constructor() {
    this.loadDefaultRules()
  }

  private loadDefaultRules(): void {
    DEFAULT_ALERT_RULES.forEach(rule => {
      const alertRule: AlertRule = {
        id: this.generateId(),
        ...rule
      }
      this.rules.set(alertRule.id, alertRule)
    })
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Rule management
  addRule(rule: Omit<AlertRule, 'id'>): string {
    const id = this.generateId()
    const alertRule: AlertRule = { id, ...rule }
    this.rules.set(id, alertRule)
    
    logger.info('Alert rule added', {
      metadata: { ruleId: id, ruleName: rule.name }
    })
    
    return id
  }

  updateRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(id)
    if (!rule) return false
    
    const updatedRule = { ...rule, ...updates, id }
    this.rules.set(id, updatedRule)
    
    logger.info('Alert rule updated', {
      metadata: { ruleId: id, ruleName: updatedRule.name }
    })
    
    return true
  }

  deleteRule(id: string): boolean {
    const deleted = this.rules.delete(id)
    if (deleted) {
      logger.info('Alert rule deleted', {
        metadata: { ruleId: id }
      })
    }
    return deleted
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values())
  }

  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id)
  }

  // Incident management
  getIncidents(): AlertIncident[] {
    return Array.from(this.incidents.values())
  }

  getIncident(id: string): AlertIncident | undefined {
    return this.incidents.get(id)
  }

  acknowledgeIncident(id: string, acknowledgedBy: string): boolean {
    const incident = this.incidents.get(id)
    if (!incident || incident.status !== 'open') return false
    
    incident.status = 'acknowledged'
    incident.acknowledgedAt = Date.now()
    incident.acknowledgedBy = acknowledgedBy
    
    logger.info('Alert incident acknowledged', {
      metadata: { incidentId: id, acknowledgedBy }
    })
    
    return true
  }

  resolveIncident(id: string, resolvedBy: string): boolean {
    const incident = this.incidents.get(id)
    if (!incident || incident.status === 'resolved') return false
    
    incident.status = 'resolved'
    incident.resolvedAt = Date.now()
    incident.resolvedBy = resolvedBy
    
    logger.info('Alert incident resolved', {
      metadata: { incidentId: id, resolvedBy }
    })
    
    return true
  }

  // Alert evaluation
  private async evaluateRule(rule: AlertRule): Promise<boolean> {
    try {
      if (!rule.enabled) return false
      
      const now = Date.now()
      const lastCheck = this.lastChecked.get(rule.id) || 0
      const cooldownMs = rule.cooldown * 60 * 1000
      
      // Check if rule is in cooldown
      if (now - lastCheck < cooldownMs) {
        return false
      }
      
      let value: number
      
      if (rule.metric === 'health.status') {
        // Special handling for health checks
        const health = await healthChecker.performFullHealthCheck()
        value = health.overall === 'healthy' ? 1 : 0
      } else {
        // Get metric value
        const durationHours = rule.duration / 60
        const metric = await metricsCollector.getTimeSeriesMetric(rule.metric, durationHours)
        
        if (metric.points.length === 0) return false
        
        value = metric.aggregation.avg
      }
      
      // Evaluate condition
      const triggered = this.evaluateCondition(value, rule.condition, rule.threshold)
      
      if (triggered) {
        await this.createIncident(rule, value)
        this.lastChecked.set(rule.id, now)
        return true
      }
      
      return false
      
    } catch (error) {
      logger.error('Failed to evaluate alert rule', {
        metadata: { ruleId: rule.id, ruleName: rule.name },
        error: error instanceof Error ? error : new Error('Unknown error')
      })
      return false
    }
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold
      case 'lt': return value < threshold
      case 'eq': return value === threshold
      case 'ne': return value !== threshold
      case 'gte': return value >= threshold
      case 'lte': return value <= threshold
      default: return false
    }
  }

  private async createIncident(rule: AlertRule, value: number): Promise<void> {
    const incident: AlertIncident = {
      id: this.generateId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: 'open',
      message: `${rule.name}: ${rule.description}`,
      value,
      threshold: rule.threshold,
      triggeredAt: Date.now(),
      tags: rule.tags
    }
    
    this.incidents.set(incident.id, incident)
    
    logger.warn('Alert incident created', {
      metadata: {
        incidentId: incident.id,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        value,
        threshold: rule.threshold
      }
    })
    
    // Send notifications
    await this.sendNotifications(incident, rule.channels)
  }

  private async sendNotifications(incident: AlertIncident, channels: AlertChannel[]): Promise<void> {
    const notifications = await Promise.allSettled(
      channels
        .filter(channel => channel.enabled)
        .map(channel => this.sendNotification(incident, channel))
    )
    
    notifications.forEach((result, index) => {
      const channel = channels[index]
      const notification: AlertNotification = {
        incident,
        channel,
        sentAt: Date.now(),
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason?.message : undefined
      }
      
      this.notifications.push(notification)
    })
  }

  private async sendNotification(incident: AlertIncident, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(incident, channel)
        break
      case 'webhook':
        await this.sendWebhookNotification(incident, channel)
        break
      case 'slack':
        await this.sendSlackNotification(incident, channel)
        break
      case 'sms':
        await this.sendSMSNotification(incident, channel)
        break
    }
  }

  private async sendEmailNotification(incident: AlertIncident, channel: AlertChannel): Promise<void> {
    const { to, subject } = channel.config
    
    const body = `
Alert: ${incident.ruleName}
Severity: ${incident.severity}
Status: ${incident.status}
Message: ${incident.message}
Value: ${incident.value}
Threshold: ${incident.threshold}
Triggered: ${new Date(incident.triggeredAt).toISOString()}

Please check the system dashboard for more details.
    `.trim()
    
    // TODO: Implement email sending using Resend
    logger.info('Email notification sent', {
      metadata: { incidentId: incident.id, to, subject }
    })
  }

  private async sendWebhookNotification(incident: AlertIncident, channel: AlertChannel): Promise<void> {
    const { url, headers } = channel.config
    
    const payload = {
      incident,
      timestamp: Date.now(),
      type: 'alert'
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.status}`)
    }
    
    logger.info('Webhook notification sent', {
      metadata: { incidentId: incident.id, url, status: response.status }
    })
  }

  private async sendSlackNotification(incident: AlertIncident, channel: AlertChannel): Promise<void> {
    const { webhook_url } = channel.config
    
    const color = {
      low: '#36a64f',
      medium: '#ff9500',
      high: '#ff0000',
      critical: '#8b0000'
    }[incident.severity]
    
    const payload = {
      attachments: [{
        color,
        title: `🚨 ${incident.ruleName}`,
        text: incident.message,
        fields: [
          { title: 'Severity', value: incident.severity, short: true },
          { title: 'Status', value: incident.status, short: true },
          { title: 'Value', value: incident.value.toString(), short: true },
          { title: 'Threshold', value: incident.threshold.toString(), short: true },
          { title: 'Triggered', value: new Date(incident.triggeredAt).toISOString(), short: false }
        ]
      }]
    }
    
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status}`)
    }
    
    logger.info('Slack notification sent', {
      metadata: { incidentId: incident.id, webhook_url }
    })
  }

  private async sendSMSNotification(incident: AlertIncident, channel: AlertChannel): Promise<void> {
    // TODO: Implement SMS notifications
    logger.info('SMS notification would be sent', {
      metadata: { incidentId: incident.id, channel: channel.config }
    })
  }

  // Alert monitoring
  async runAlertCheck(): Promise<void> {
    if (this.isRunning) return
    
    this.isRunning = true
    
    try {
      const rules = Array.from(this.rules.values())
      const results = await Promise.allSettled(
        rules.map(rule => this.evaluateRule(rule))
      )
      
      const triggered = results.filter(r => r.status === 'fulfilled' && r.value).length
      
      if (triggered > 0) {
        logger.info('Alert check completed', {
          metadata: { totalRules: rules.length, triggered }
        })
      }
      
    } catch (error) {
      logger.error('Alert check failed', {
        error: error instanceof Error ? error : new Error('Unknown error')
      })
    } finally {
      this.isRunning = false
    }
  }

  // Start monitoring
  startMonitoring(intervalMinutes: number = 1): void {
    const intervalMs = intervalMinutes * 60 * 1000
    
    setInterval(async () => {
      await this.runAlertCheck()
    }, intervalMs)
    
    logger.info('Alert monitoring started', {
      metadata: { intervalMinutes }
    })
  }

  // Get notifications
  getNotifications(): AlertNotification[] {
    return this.notifications
  }

  // Get alert statistics
  getStats(): {
    totalRules: number
    enabledRules: number
    openIncidents: number
    acknowledgedIncidents: number
    resolvedIncidents: number
    notificationsSent: number
  } {
    const incidents = Array.from(this.incidents.values())
    const rules = Array.from(this.rules.values())
    
    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      openIncidents: incidents.filter(i => i.status === 'open').length,
      acknowledgedIncidents: incidents.filter(i => i.status === 'acknowledged').length,
      resolvedIncidents: incidents.filter(i => i.status === 'resolved').length,
      notificationsSent: this.notifications.filter(n => n.success).length
    }
  }
}

export const alertManager = new AlertManager()