import Bull from 'bull'
import { queueManager, JobProgress, JobResult } from '../index'
import { supabase } from '../../supabase'

export interface LeadImportJobData {
  userId: string
  chunkData: Array<{
    email: string
    name?: string
    phone?: string
    tags?: string[]
    metadata?: Record<string, any>
  }>
  batchId: string
  totalBatches: number
  currentBatch: number
  importId: string
}

export interface LeadImportProgress extends JobProgress {
  data: {
    processed: number
    total: number
    currentBatch: number
    totalBatches: number
    importId: string
    errors?: string[]
  }
}

export class LeadsImportService {
  private static instance: LeadsImportService
  private queue: Bull.Queue
  private readonly QUEUE_NAME = 'leads-import'
  private readonly CONCURRENCY = 5
  private readonly CHUNK_SIZE = 1000 // Process 1000 leads per job

  private constructor() {
    this.queue = queueManager.createQueue({
      name: this.QUEUE_NAME,
      concurrency: this.CONCURRENCY,
      removeOnComplete: 100,
      removeOnFail: 50,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    })

    this.setupProcessors()
  }

  static getInstance(): LeadsImportService {
    if (!LeadsImportService.instance) {
      LeadsImportService.instance = new LeadsImportService()
    }
    return LeadsImportService.instance
  }

  private setupProcessors(): void {
    this.queue.process(this.CONCURRENCY, async (job: Bull.Job<LeadImportJobData>) => {
      return this.processLeadImportChunk(job)
    })
  }

  async importLeads(
    userId: string,
    leads: Array<{
      email: string
      name?: string
      phone?: string
      tags?: string[]
      metadata?: Record<string, any>
    }>
  ): Promise<string> {
    const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const chunks = this.chunkArray(leads, this.CHUNK_SIZE)
    
    // Create import record
    const { error: importError } = await supabase
      .from('lead_imports')
      .insert({
        id: importId,
        user_id: userId,
        total_leads: leads.length,
        total_batches: chunks.length,
        status: 'processing',
        created_at: new Date().toISOString(),
      })

    if (importError) {
      console.error('Failed to create import record:', importError)
      throw new Error('Failed to create import record')
    }

    // Create jobs for each chunk
    const jobs = chunks.map((chunk, index) => ({
      userId,
      chunkData: chunk,
      batchId: `${importId}_batch_${index + 1}`,
      totalBatches: chunks.length,
      currentBatch: index + 1,
      importId,
    }))

    // Add jobs to queue
    await this.queue.addBulk(
      jobs.map((jobData, index) => ({
        name: 'import-leads-chunk',
        data: jobData,
        opts: {
          priority: -index, // Higher priority for earlier batches
          delay: index * 100, // Slight delay to prevent overwhelming the system
        },
      }))
    )

    return importId
  }

  private async processLeadImportChunk(job: Bull.Job<LeadImportJobData>): Promise<JobResult> {
    const { userId, chunkData, batchId, totalBatches, currentBatch, importId } = job.data
    
    try {
      // Update progress
      await job.progress({
        percentage: 0,
        message: `Processing batch ${currentBatch} of ${totalBatches}`,
        data: {
          processed: 0,
          total: chunkData.length,
          currentBatch,
          totalBatches,
          importId,
        },
      } as LeadImportProgress)

      const processedLeads = []
      const errors = []

      for (let i = 0; i < chunkData.length; i++) {
        const lead = chunkData[i]
        
        try {
          // Validate email format
          if (!this.isValidEmail(lead.email)) {
            errors.push(`Invalid email format: ${lead.email}`)
            continue
          }

          // Check if lead already exists
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('email', lead.email)
            .eq('user_id', userId)
            .single()

          if (existingLead) {
            // Update existing lead
            const { error: updateError } = await supabase
              .from('leads')
              .update({
                name: lead.name,
                phone: lead.phone,
                tags: lead.tags,
                metadata: lead.metadata,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingLead.id)

            if (updateError) {
              errors.push(`Failed to update lead ${lead.email}: ${updateError.message}`)
              continue
            }
          } else {
            // Create new lead
            const { error: insertError } = await supabase
              .from('leads')
              .insert({
                user_id: userId,
                email: lead.email,
                name: lead.name,
                phone: lead.phone,
                tags: lead.tags,
                metadata: lead.metadata,
                source: 'import',
                status: 'active',
                created_at: new Date().toISOString(),
              })

            if (insertError) {
              errors.push(`Failed to create lead ${lead.email}: ${insertError.message}`)
              continue
            }
          }

          processedLeads.push(lead.email)

          // Update progress periodically
          if (i % 100 === 0 || i === chunkData.length - 1) {
            const percentage = Math.round(((i + 1) / chunkData.length) * 100)
            await job.progress({
              percentage,
              message: `Processing batch ${currentBatch} of ${totalBatches} - ${i + 1}/${chunkData.length} leads`,
              data: {
                processed: i + 1,
                total: chunkData.length,
                currentBatch,
                totalBatches,
                importId,
                errors: errors.length > 0 ? errors : undefined,
              },
            } as LeadImportProgress)
          }
        } catch (error) {
          console.error(`Error processing lead ${lead.email}:`, error)
          errors.push(`Error processing lead ${lead.email}: ${error.message}`)
        }
      }

      // Update batch status
      await supabase
        .from('lead_import_batches')
        .upsert({
          id: batchId,
          import_id: importId,
          batch_number: currentBatch,
          total_leads: chunkData.length,
          processed_leads: processedLeads.length,
          failed_leads: errors.length,
          status: 'completed',
          errors: errors.length > 0 ? errors : null,
          completed_at: new Date().toISOString(),
        })

      // Check if all batches are completed
      const { data: completedBatches } = await supabase
        .from('lead_import_batches')
        .select('id')
        .eq('import_id', importId)
        .eq('status', 'completed')

      if (completedBatches && completedBatches.length === totalBatches) {
        // Update import status
        await supabase
          .from('lead_imports')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', importId)
      }

      return {
        success: true,
        data: {
          processedLeads: processedLeads.length,
          errors: errors.length,
          batchId,
          importId,
        },
      }
    } catch (error) {
      console.error('Lead import chunk processing failed:', error)
      
      // Update batch status as failed
      await supabase
        .from('lead_import_batches')
        .upsert({
          id: batchId,
          import_id: importId,
          batch_number: currentBatch,
          total_leads: chunkData.length,
          processed_leads: 0,
          failed_leads: chunkData.length,
          status: 'failed',
          errors: [error.message],
          completed_at: new Date().toISOString(),
        })

      return {
        success: false,
        error: error.message,
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  async getImportProgress(importId: string): Promise<{
    status: string
    progress: number
    totalLeads: number
    processedLeads: number
    failedLeads: number
    batches: Array<{
      batchNumber: number
      status: string
      processedLeads: number
      failedLeads: number
      errors?: string[]
    }>
  }> {
    const { data: importData } = await supabase
      .from('lead_imports')
      .select('*')
      .eq('id', importId)
      .single()

    if (!importData) {
      throw new Error('Import not found')
    }

    const { data: batches } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('import_id', importId)
      .order('batch_number')

    const totalProcessed = batches?.reduce((sum, batch) => sum + (batch.processed_leads || 0), 0) || 0
    const totalFailed = batches?.reduce((sum, batch) => sum + (batch.failed_leads || 0), 0) || 0
    const progress = importData.total_leads > 0 ? Math.round(((totalProcessed + totalFailed) / importData.total_leads) * 100) : 0

    return {
      status: importData.status,
      progress,
      totalLeads: importData.total_leads,
      processedLeads: totalProcessed,
      failedLeads: totalFailed,
      batches: batches?.map(batch => ({
        batchNumber: batch.batch_number,
        status: batch.status,
        processedLeads: batch.processed_leads || 0,
        failedLeads: batch.failed_leads || 0,
        errors: batch.errors,
      })) || [],
    }
  }

  async cancelImport(importId: string): Promise<boolean> {
    try {
      // Get all jobs for this import
      const jobs = await this.queue.getJobs(['waiting', 'active', 'delayed'])
      const importJobs = jobs.filter(job => job.data.importId === importId)

      // Cancel all jobs
      await Promise.all(importJobs.map(job => job.remove()))

      // Update import status
      await supabase
        .from('lead_imports')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId)

      return true
    } catch (error) {
      console.error('Failed to cancel import:', error)
      return false
    }
  }

  getQueue(): Bull.Queue {
    return this.queue
  }
}

export const leadsImportService = LeadsImportService.getInstance()