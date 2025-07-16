import Bull from 'bull'
import { queueManager, JobProgress, JobResult } from '../index'
import { supabase } from '../../supabase'
import { resend } from '../../resend'

export interface EmailSendJobData {
  campaignId: string
  recipients: Array<{
    id: string
    email: string
    name?: string
    metadata?: Record<string, any>
  }>
  template: {
    subject: string
    html: string
    text?: string
  }
  sender: {
    email: string
    name?: string
  }
  batchId: string
  totalBatches: number
  currentBatch: number
  userId: string
}

export interface EmailSendProgress extends JobProgress {
  data: {
    sent: number
    total: number
    currentBatch: number
    totalBatches: number
    campaignId: string
    failures?: Array<{
      email: string
      error: string
    }>
  }
}

export class EmailSendingService {
  private static instance: EmailSendingService
  private queue: Bull.Queue
  private readonly QUEUE_NAME = 'email-sending'
  private readonly CONCURRENCY = 3 // Conservative concurrency for email sending
  private readonly BATCH_SIZE = 100 // Smaller batches for email sending
  private readonly RATE_LIMIT_DELAY = 1000 // 1 second between email batches

  private constructor() {
    this.queue = queueManager.createQueue({
      name: this.QUEUE_NAME,
      concurrency: this.CONCURRENCY,
      removeOnComplete: 50,
      removeOnFail: 100,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    })

    this.setupProcessors()
  }

  static getInstance(): EmailSendingService {
    if (!EmailSendingService.instance) {
      EmailSendingService.instance = new EmailSendingService()
    }
    return EmailSendingService.instance
  }

  private setupProcessors(): void {
    this.queue.process(this.CONCURRENCY, async (job: Bull.Job<EmailSendJobData>) => {
      return this.processEmailSendBatch(job)
    })
  }

  async sendCampaignEmails(
    campaignId: string,
    recipients: Array<{
      id: string
      email: string
      name?: string
      metadata?: Record<string, any>
    }>,
    template: {
      subject: string
      html: string
      text?: string
    },
    sender: {
      email: string
      name?: string
    },
    userId: string
  ): Promise<string> {
    const sendId = `send_${campaignId}_${Date.now()}`
    const batches = this.chunkArray(recipients, this.BATCH_SIZE)
    
    // Create campaign send record
    const { error: sendError } = await supabase
      .from('campaign_sends')
      .insert({
        id: sendId,
        campaign_id: campaignId,
        user_id: userId,
        total_recipients: recipients.length,
        total_batches: batches.length,
        status: 'processing',
        created_at: new Date().toISOString(),
      })

    if (sendError) {
      console.error('Failed to create campaign send record:', sendError)
      throw new Error('Failed to create campaign send record')
    }

    // Create jobs for each batch with rate limiting
    const jobs = batches.map((batch, index) => ({
      campaignId,
      recipients: batch,
      template,
      sender,
      batchId: `${sendId}_batch_${index + 1}`,
      totalBatches: batches.length,
      currentBatch: index + 1,
      userId,
    }))

    // Add jobs to queue with progressive delays for rate limiting
    await this.queue.addBulk(
      jobs.map((jobData, index) => ({
        name: 'send-email-batch',
        data: jobData,
        opts: {
          priority: -index, // Higher priority for earlier batches
          delay: index * this.RATE_LIMIT_DELAY, // Rate limiting delay
        },
      }))
    )

    return sendId
  }

  private async processEmailSendBatch(job: Bull.Job<EmailSendJobData>): Promise<JobResult> {
    const { campaignId, recipients, template, sender, batchId, totalBatches, currentBatch, userId } = job.data
    
    try {
      // Update progress
      await job.progress({
        percentage: 0,
        message: `Sending batch ${currentBatch} of ${totalBatches}`,
        data: {
          sent: 0,
          total: recipients.length,
          currentBatch,
          totalBatches,
          campaignId,
        },
      } as EmailSendProgress)

      const sentEmails = []
      const failures = []

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i]
        
        try {
          // Personalize template
          const personalizedTemplate = this.personalizeTemplate(template, recipient)
          
          // Send email using Resend
          const { data: emailData, error: sendError } = await resend.emails.send({
            from: sender.name ? `${sender.name} <${sender.email}>` : sender.email,
            to: recipient.email,
            subject: personalizedTemplate.subject,
            html: personalizedTemplate.html,
            text: personalizedTemplate.text,
          })

          if (sendError) {
            failures.push({
              email: recipient.email,
              error: sendError.message,
            })
            continue
          }

          // Record successful send
          await supabase
            .from('email_sends')
            .insert({
              campaign_id: campaignId,
              recipient_id: recipient.id,
              recipient_email: recipient.email,
              email_id: emailData?.id,
              status: 'sent',
              sent_at: new Date().toISOString(),
            })

          sentEmails.push(recipient.email)

          // Update progress periodically
          if (i % 10 === 0 || i === recipients.length - 1) {
            const percentage = Math.round(((i + 1) / recipients.length) * 100)
            await job.progress({
              percentage,
              message: `Sending batch ${currentBatch} of ${totalBatches} - ${i + 1}/${recipients.length} emails`,
              data: {
                sent: i + 1,
                total: recipients.length,
                currentBatch,
                totalBatches,
                campaignId,
                failures: failures.length > 0 ? failures : undefined,
              },
            } as EmailSendProgress)
          }

          // Rate limiting - small delay between emails
          if (i < recipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } catch (error) {
          console.error(`Error sending email to ${recipient.email}:`, error)
          failures.push({
            email: recipient.email,
            error: error.message,
          })

          // Record failed send
          await supabase
            .from('email_sends')
            .insert({
              campaign_id: campaignId,
              recipient_id: recipient.id,
              recipient_email: recipient.email,
              status: 'failed',
              error: error.message,
              sent_at: new Date().toISOString(),
            })
        }
      }

      // Update batch status
      await supabase
        .from('campaign_send_batches')
        .upsert({
          id: batchId,
          send_id: `send_${campaignId}_${Date.now()}`,
          batch_number: currentBatch,
          total_recipients: recipients.length,
          sent_count: sentEmails.length,
          failed_count: failures.length,
          status: 'completed',
          failures: failures.length > 0 ? failures : null,
          completed_at: new Date().toISOString(),
        })

      return {
        success: true,
        data: {
          sent: sentEmails.length,
          failed: failures.length,
          batchId,
          campaignId,
        },
      }
    } catch (error) {
      console.error('Email send batch processing failed:', error)
      
      // Update batch status as failed
      await supabase
        .from('campaign_send_batches')
        .upsert({
          id: batchId,
          send_id: `send_${campaignId}_${Date.now()}`,
          batch_number: currentBatch,
          total_recipients: recipients.length,
          sent_count: 0,
          failed_count: recipients.length,
          status: 'failed',
          failures: [{ email: 'all', error: error.message }],
          completed_at: new Date().toISOString(),
        })

      return {
        success: false,
        error: error.message,
      }
    }
  }

  private personalizeTemplate(
    template: { subject: string; html: string; text?: string },
    recipient: { name?: string; email: string; metadata?: Record<string, any> }
  ): { subject: string; html: string; text?: string } {
    const personalizedSubject = template.subject
      .replace(/\{\{name\}\}/g, recipient.name || recipient.email)
      .replace(/\{\{email\}\}/g, recipient.email)

    const personalizedHtml = template.html
      .replace(/\{\{name\}\}/g, recipient.name || recipient.email)
      .replace(/\{\{email\}\}/g, recipient.email)

    const personalizedText = template.text
      ? template.text
          .replace(/\{\{name\}\}/g, recipient.name || recipient.email)
          .replace(/\{\{email\}\}/g, recipient.email)
      : undefined

    // Handle custom metadata
    if (recipient.metadata) {
      Object.entries(recipient.metadata).forEach(([key, value]) => {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        personalizedSubject.replace(placeholder, String(value))
        personalizedHtml.replace(placeholder, String(value))
        if (personalizedText) {
          personalizedText.replace(placeholder, String(value))
        }
      })
    }

    return {
      subject: personalizedSubject,
      html: personalizedHtml,
      text: personalizedText,
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  async getCampaignSendProgress(campaignId: string): Promise<{
    status: string
    progress: number
    totalRecipients: number
    sentCount: number
    failedCount: number
    batches: Array<{
      batchNumber: number
      status: string
      sentCount: number
      failedCount: number
      failures?: Array<{ email: string; error: string }>
    }>
  }> {
    const { data: sendData } = await supabase
      .from('campaign_sends')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!sendData) {
      throw new Error('Campaign send not found')
    }

    const { data: batches } = await supabase
      .from('campaign_send_batches')
      .select('*')
      .eq('send_id', sendData.id)
      .order('batch_number')

    const totalSent = batches?.reduce((sum, batch) => sum + (batch.sent_count || 0), 0) || 0
    const totalFailed = batches?.reduce((sum, batch) => sum + (batch.failed_count || 0), 0) || 0
    const progress = sendData.total_recipients > 0 ? Math.round(((totalSent + totalFailed) / sendData.total_recipients) * 100) : 0

    return {
      status: sendData.status,
      progress,
      totalRecipients: sendData.total_recipients,
      sentCount: totalSent,
      failedCount: totalFailed,
      batches: batches?.map(batch => ({
        batchNumber: batch.batch_number,
        status: batch.status,
        sentCount: batch.sent_count || 0,
        failedCount: batch.failed_count || 0,
        failures: batch.failures,
      })) || [],
    }
  }

  async cancelCampaignSend(campaignId: string): Promise<boolean> {
    try {
      // Get all jobs for this campaign
      const jobs = await this.queue.getJobs(['waiting', 'active', 'delayed'])
      const campaignJobs = jobs.filter(job => job.data.campaignId === campaignId)

      // Cancel all jobs
      await Promise.all(campaignJobs.map(job => job.remove()))

      // Update campaign send status
      await supabase
        .from('campaign_sends')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaignId)

      return true
    } catch (error) {
      console.error('Failed to cancel campaign send:', error)
      return false
    }
  }

  getQueue(): Bull.Queue {
    return this.queue
  }
}

export const emailSendingService = EmailSendingService.getInstance()