import { parse } from 'csv-parse';
import { Transform } from 'stream';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  ProcessingBatch,
  TempValidationData,
  ValidationError,
  CSVMappingConfig,
  LeadImportConfig,
  LeadImportResult,
  FileUploadJob
} from '@/lib/types/upload-types';

export class CSVProcessor {
  private readonly BATCH_SIZE = 1000;
  private readonly MAX_CONCURRENT_BATCHES = 5;

  /**
   * Process CSV file in chunks with streaming
   */
  async processCSVFile(
    uploadJobId: string,
    filePath: string,
    mappingConfig: CSVMappingConfig,
    importConfig: LeadImportConfig
  ): Promise<LeadImportResult> {
    try {
      await this.updateJobStatus(uploadJobId, 'processing', 'Starting CSV processing');

      // Initialize result tracking
      const result: LeadImportResult = {
        total_processed: 0,
        leads_created: 0,
        leads_updated: 0,
        leads_skipped: 0,
        leads_failed: 0,
        validation_errors: [],
        duplicate_emails: [],
        invalid_emails: []
      };

      // Process file in streaming fashion
      const batches = await this.createProcessingBatches(uploadJobId, filePath, mappingConfig);
      
      // Process batches concurrently
      const batchResults = await this.processBatchesConcurrently(
        batches,
        mappingConfig,
        importConfig
      );

      // Aggregate results
      for (const batchResult of batchResults) {
        result.total_processed += batchResult.total_processed;
        result.leads_created += batchResult.leads_created;
        result.leads_updated += batchResult.leads_updated;
        result.leads_skipped += batchResult.leads_skipped;
        result.leads_failed += batchResult.leads_failed;
        result.validation_errors.push(...batchResult.validation_errors);
        result.duplicate_emails.push(...batchResult.duplicate_emails);
        result.invalid_emails.push(...batchResult.invalid_emails);
      }

      // Update job with final results
      await this.updateJobResults(uploadJobId, result);
      await this.updateJobStatus(uploadJobId, 'completed', 'CSV processing completed');

      return result;
    } catch (error) {
      logger.error('Error processing CSV file:', error);
      await this.updateJobStatus(uploadJobId, 'failed', 
        error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Create processing batches from CSV file
   */
  private async createProcessingBatches(
    uploadJobId: string,
    filePath: string,
    mappingConfig: CSVMappingConfig
  ): Promise<ProcessingBatch[]> {
    return new Promise((resolve, reject) => {
      const batches: ProcessingBatch[] = [];
      let currentBatch: any[] = [];
      let rowIndex = 0;
      let batchIndex = 0;

      const parser = parse({
        columns: mappingConfig.skip_header ? true : false,
        skip_empty_lines: true,
        delimiter: mappingConfig.delimiter || ',',
        encoding: mappingConfig.encoding || 'utf8'
      });

      const batchProcessor = new Transform({
        objectMode: true,
        transform: async (row: any, encoding, callback) => {
          try {
            currentBatch.push({
              row_index: rowIndex++,
              data: row
            });

            // When batch is full, save it and create new batch
            if (currentBatch.length >= this.BATCH_SIZE) {
              const batch = await this.saveBatch(
                uploadJobId,
                batchIndex++,
                currentBatch
              );
              batches.push(batch);
              currentBatch = [];
            }

            callback();
          } catch (error) {
            callback(error);
          }
        },
        flush: async (callback) => {
          try {
            // Save remaining items in current batch
            if (currentBatch.length > 0) {
              const batch = await this.saveBatch(
                uploadJobId,
                batchIndex++,
                currentBatch
              );
              batches.push(batch);
            }
            callback();
          } catch (error) {
            callback(error);
          }
        }
      });

      // Create readable stream from file
      const fs = require('fs');
      const fileStream = fs.createReadStream(filePath);

      fileStream
        .pipe(parser)
        .pipe(batchProcessor)
        .on('finish', () => {
          resolve(batches);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Save batch to database
   */
  private async saveBatch(
    uploadJobId: string,
    batchIndex: number,
    batchData: any[]
  ): Promise<ProcessingBatch> {
    const startRecord = batchIndex * this.BATCH_SIZE;
    const endRecord = startRecord + batchData.length;

    const batchRecord: Partial<ProcessingBatch> = {
      upload_job_id: uploadJobId,
      batch_index: batchIndex,
      start_record: startRecord,
      end_record: endRecord,
      batch_size: batchData.length,
      status: 'pending',
      processing_progress: 0,
      total_records: batchData.length,
      valid_records: 0,
      invalid_records: 0,
      processed_data: { raw_data: batchData },
      validation_errors: {},
      retry_count: 0
    };

    const { data: batch, error } = await supabase
      .from('processing_batches')
      .insert(batchRecord)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save batch ${batchIndex}: ${error.message}`);
    }

    return batch;
  }

  /**
   * Process batches concurrently
   */
  private async processBatchesConcurrently(
    batches: ProcessingBatch[],
    mappingConfig: CSVMappingConfig,
    importConfig: LeadImportConfig
  ): Promise<LeadImportResult[]> {
    const results: LeadImportResult[] = [];
    const semaphore = new Semaphore(this.MAX_CONCURRENT_BATCHES);

    const batchPromises = batches.map(async (batch) => {
      await semaphore.acquire();
      try {
        return await this.processBatch(batch, mappingConfig, importConfig);
      } finally {
        semaphore.release();
      }
    });

    const batchResults = await Promise.all(batchPromises);
    return batchResults;
  }

  /**
   * Process individual batch
   */
  private async processBatch(
    batch: ProcessingBatch,
    mappingConfig: CSVMappingConfig,
    importConfig: LeadImportConfig
  ): Promise<LeadImportResult> {
    try {
      await this.updateBatchStatus(batch.id, 'processing', 'Processing batch');

      const result: LeadImportResult = {
        total_processed: 0,
        leads_created: 0,
        leads_updated: 0,
        leads_skipped: 0,
        leads_failed: 0,
        validation_errors: [],
        duplicate_emails: [],
        invalid_emails: []
      };

      const rawData = batch.processed_data.raw_data as any[];
      const validatedData: TempValidationData[] = [];

      // Validate each row
      for (let i = 0; i < rawData.length; i++) {
        const rowData = rawData[i];
        const validationResult = await this.validateRow(
          rowData,
          mappingConfig,
          batch.start_record + i
        );

        if (validationResult.is_valid) {
          validatedData.push(validationResult);
        } else {
          result.leads_failed++;
          result.validation_errors.push(...this.extractValidationErrors(validationResult));
        }

        result.total_processed++;
      }

      // Save validated data to temp table
      if (validatedData.length > 0) {
        await this.saveValidatedData(batch.id, validatedData);
      }

      // Import leads to main table
      const importResult = await this.importLeadsFromValidatedData(
        batch.upload_job_id,
        batch.id,
        importConfig
      );

      result.leads_created += importResult.created;
      result.leads_updated += importResult.updated;
      result.leads_skipped += importResult.skipped;
      result.duplicate_emails.push(...importResult.duplicates);

      // Update batch status
      await this.updateBatchResults(batch.id, {
        status: 'completed',
        processing_progress: 100,
        valid_records: validatedData.length,
        invalid_records: result.leads_failed,
        processed_data: { ...batch.processed_data, result }
      });

      return result;
    } catch (error) {
      logger.error(`Error processing batch ${batch.id}:`, error);
      await this.updateBatchStatus(batch.id, 'failed', 
        error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Validate individual row
   */
  private async validateRow(
    rowData: any,
    mappingConfig: CSVMappingConfig,
    rowIndex: number
  ): Promise<TempValidationData> {
    const validationResult: TempValidationData = {
      id: '',
      upload_job_id: '',
      batch_id: '',
      record_index: rowIndex,
      raw_data: rowData,
      is_valid: true,
      validation_errors: {},
      processed_data: {},
      custom_fields: {},
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const errors: Record<string, string> = {};

    // Validate required fields
    for (const column of mappingConfig.columns) {
      const fieldName = mappingConfig.field_mapping[column.name];
      const value = rowData[column.name];

      if (column.required && (!value || value.toString().trim() === '')) {
        errors[column.name] = `${column.name} is required`;
        validationResult.is_valid = false;
        continue;
      }

      if (value) {
        // Type-specific validation
        switch (column.type) {
          case 'email':
            if (!this.isValidEmail(value)) {
              errors[column.name] = `Invalid email format: ${value}`;
              validationResult.is_valid = false;
            } else {
              validationResult.email = value.toLowerCase().trim();
            }
            break;

          case 'phone':
            if (!this.isValidPhone(value)) {
              errors[column.name] = `Invalid phone format: ${value}`;
              validationResult.is_valid = false;
            } else {
              validationResult.phone = this.normalizePhone(value);
            }
            break;

          case 'string':
            if (fieldName === 'name') {
              validationResult.name = value.toString().trim();
            } else if (fieldName === 'company') {
              validationResult.company = value.toString().trim();
            } else if (fieldName === 'position') {
              validationResult.position = value.toString().trim();
            } else {
              validationResult.custom_fields[fieldName] = value.toString().trim();
            }
            break;

          default:
            validationResult.custom_fields[fieldName] = value;
        }
      }
    }

    validationResult.validation_errors = errors;
    validationResult.processed_data = {
      email: validationResult.email,
      name: validationResult.name,
      phone: validationResult.phone,
      company: validationResult.company,
      position: validationResult.position,
      custom_fields: validationResult.custom_fields
    };

    return validationResult;
  }

  /**
   * Save validated data to temp table
   */
  private async saveValidatedData(
    batchId: string,
    validatedData: TempValidationData[]
  ): Promise<void> {
    const records = validatedData.map(data => ({
      ...data,
      batch_id: batchId
    }));

    const { error } = await supabase
      .from('temp_validation_data')
      .insert(records);

    if (error) {
      throw new Error(`Failed to save validated data: ${error.message}`);
    }
  }

  /**
   * Import leads from validated data
   */
  private async importLeadsFromValidatedData(
    uploadJobId: string,
    batchId: string,
    importConfig: LeadImportConfig
  ): Promise<{ created: number; updated: number; skipped: number; duplicates: string[] }> {
    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      duplicates: [] as string[]
    };

    // Get workspace ID
    const { data: job } = await supabase
      .from('file_upload_jobs')
      .select('workspace_id')
      .eq('id', uploadJobId)
      .single();

    if (!job) {
      throw new Error('Upload job not found');
    }

    // Get validated data
    const { data: validatedData } = await supabase
      .from('temp_validation_data')
      .select('*')
      .eq('batch_id', batchId)
      .eq('is_valid', true);

    if (!validatedData || validatedData.length === 0) {
      return result;
    }

    // Process each validated record
    for (const record of validatedData) {
      try {
        const leadData = {
          workspace_id: job.workspace_id,
          email: record.email,
          name: record.name,
          phone: record.phone,
          company: record.company,
          position: record.position,
          source: importConfig.source,
          tags: importConfig.default_tags,
          custom_fields: record.custom_fields,
          status: 'active'
        };

        // Check for duplicates
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('workspace_id', job.workspace_id)
          .eq('email', record.email)
          .single();

        if (existingLead) {
          result.duplicates.push(record.email!);
          
          if (importConfig.duplicate_handling === 'skip') {
            result.skipped++;
            continue;
          } else if (importConfig.duplicate_handling === 'overwrite') {
            const { error } = await supabase
              .from('leads')
              .update(leadData)
              .eq('id', existingLead.id);

            if (error) {
              throw error;
            }
            result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          // Create new lead
          const { error } = await supabase
            .from('leads')
            .insert(leadData);

          if (error) {
            throw error;
          }
          result.created++;
        }

        // Update temp record status
        await supabase
          .from('temp_validation_data')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', record.id);

      } catch (error) {
        logger.error(`Error importing lead ${record.email}:`, error);
        result.skipped++;
      }
    }

    return result;
  }

  // Utility methods

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  private extractValidationErrors(validationResult: TempValidationData): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const [column, error] of Object.entries(validationResult.validation_errors)) {
      errors.push({
        row: validationResult.record_index,
        column,
        value: validationResult.raw_data[column],
        error_type: 'validation',
        error_message: error
      });
    }

    return errors;
  }

  private async updateJobStatus(
    uploadJobId: string,
    status: string,
    message?: string
  ): Promise<void> {
    await supabase
      .from('file_upload_jobs')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', uploadJobId);

    if (message) {
      await supabase
        .from('upload_progress_events')
        .insert({
          upload_job_id: uploadJobId,
          event_type: 'status_update',
          event_data: { status },
          message,
          created_at: new Date().toISOString()
        });
    }
  }

  private async updateBatchStatus(
    batchId: string,
    status: string,
    message?: string
  ): Promise<void> {
    await supabase
      .from('processing_batches')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);
  }

  private async updateBatchResults(
    batchId: string,
    results: Partial<ProcessingBatch>
  ): Promise<void> {
    await supabase
      .from('processing_batches')
      .update({
        ...results,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', batchId);
  }

  private async updateJobResults(
    uploadJobId: string,
    result: LeadImportResult
  ): Promise<void> {
    await supabase
      .from('file_upload_jobs')
      .update({
        total_records: result.total_processed,
        processed_records: result.total_processed,
        valid_records: result.leads_created + result.leads_updated,
        invalid_records: result.leads_failed,
        processing_progress: 100,
        completed_at: new Date().toISOString()
      })
      .eq('id', uploadJobId);
  }
}

/**
 * Semaphore for controlling concurrent processing
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      this.permits--;
      resolve();
    }
  }
}

// Export singleton instance
export const csvProcessor = new CSVProcessor();