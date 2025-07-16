import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { performanceDataGenerator } from '../data-generator';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

describe('Database Benchmark Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let testStartTime: number;
  let testDatabase: string;

  beforeAll(async () => {
    logger.info('Starting Database Benchmark Test Setup');
    
    // Initialize performance monitoring
    performanceMonitor = new PerformanceMonitor({
      metricsInterval: 2000,
      resourceMonitoring: true,
      enableDetailedMetrics: true
    });
    
    // Create test database tables if needed
    await this.setupTestTables();
    
    // Start monitoring
    await performanceMonitor.start();
    
    logger.info('Database Benchmark Test Setup Complete');
  });

  afterAll(async () => {
    logger.info('Cleaning up Database Benchmark Test');
    
    // Clean up test data
    await this.cleanupTestData();
    
    // Stop monitoring and generate reports
    const report = await performanceMonitor.stop();
    await performanceMonitor.generateReport(report, 'database-benchmark-test');
    
    logger.info('Database Benchmark Test Cleanup Complete');
  });

  beforeEach(() => {
    testStartTime = performance.now();
  });

  afterEach(() => {
    const testDuration = performance.now() - testStartTime;
    logger.info(`Test completed in ${testDuration.toFixed(2)}ms`);
  });

  describe('Large Insert Operations', () => {
    it('should handle bulk inserts of 2MM contacts efficiently', async () => {
      const testId = 'large-insert-operations';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting large insert operations benchmark');
      
      try {
        const totalContacts = 2_000_000;
        const batchSize = 10000;
        const batches = Math.ceil(totalContacts / batchSize);
        
        logger.info(`Preparing to insert ${totalContacts} contacts in ${batches} batches`);
        
        // Generate test data
        const contacts = await performanceDataGenerator.generateContacts(
          totalContacts,
          'standard',
          { chunkSize: batchSize }
        );
        
        // Perform bulk inserts
        const insertResults = [];
        const insertStartTime = performance.now();
        
        for (let i = 0; i < batches; i++) {
          const batchStartTime = performance.now();
          const batchContacts = contacts.slice(i * batchSize, (i + 1) * batchSize);
          
          // Prepare batch data for insertion
          const batchData = batchContacts.map(contact => ({
            email: contact.email,
            name: contact.name,
            phone: contact.phone,
            company: contact.company,
            position: contact.position,
            country: contact.country,
            city: contact.city,
            lead_source: contact.leadSource,
            lead_score: contact.leadScore,
            status: contact.status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            workspace_id: 'test-workspace-id',
            custom_fields: contact.customFields || {}
          }));
          
          // Insert batch
          const { data, error } = await supabase
            .from('leads')
            .insert(batchData);
          
          const batchTime = performance.now() - batchStartTime;
          
          if (error) {
            logger.error(`Batch ${i + 1} failed:`, error);
            insertResults.push({
              batch: i + 1,
              success: false,
              error: error.message,
              batchTime,
              recordCount: 0
            });
          } else {
            insertResults.push({
              batch: i + 1,
              success: true,
              batchTime,
              recordCount: batchContacts.length
            });
          }
          
          // Log progress every 10 batches
          if (i % 10 === 0) {
            logger.info(`Inserted batch ${i + 1}/${batches} (${((i + 1) / batches * 100).toFixed(1)}%)`);
          }
        }
        
        const totalInsertTime = performance.now() - insertStartTime;
        
        // Calculate metrics
        const successfulBatches = insertResults.filter(r => r.success).length;
        const failedBatches = insertResults.filter(r => !r.success).length;
        const totalRecordsInserted = insertResults.reduce((sum, r) => sum + r.recordCount, 0);
        const averageBatchTime = insertResults.reduce((sum, r) => sum + r.batchTime, 0) / insertResults.length;
        const insertThroughput = totalRecordsInserted / (totalInsertTime / 1000);
        
        logger.info(`Large insert operations benchmark completed`, {
          totalContacts,
          batches,
          successfulBatches,
          failedBatches,
          totalRecordsInserted,
          averageBatchTime,
          insertThroughput,
          totalInsertTime
        });
        
        // Verify performance thresholds
        expect(successfulBatches / batches).toBeGreaterThan(0.95); // 95% success rate
        expect(insertThroughput).toBeGreaterThan(1000); // At least 1000 records/second
        expect(averageBatchTime).toBeLessThan(30000); // Average batch under 30 seconds
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Large insert operations benchmark completed successfully', {
          testMetrics,
          insertThroughput,
          successfulBatches
        });
        
      } catch (error) {
        logger.error('Large insert operations benchmark failed', error);
        throw error;
      }
    }, 60 * 60 * 1000); // 1 hour timeout
  });

  describe('Complex Query Performance', () => {
    it('should handle complex queries on large datasets efficiently', async () => {
      const testId = 'complex-query-performance';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting complex query performance benchmark');
      
      try {
        // Ensure we have test data
        await this.ensureTestData(500000); // 500K records
        
        // Define complex queries to test
        const complexQueries = [
          {
            name: 'leadScoreAggregation',
            description: 'Aggregate lead scores by country and company',
            query: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select('country, company, lead_score')
                .not('lead_score', 'is', null)
                .order('lead_score', { ascending: false })
                .limit(10000);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'dateRangeFilter',
            description: 'Filter leads by date range with status',
            query: async () => {
              const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
              
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .gte('created_at', thirtyDaysAgo)
                .in('status', ['active', 'inactive'])
                .order('created_at', { ascending: false })
                .limit(5000);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'textSearch',
            description: 'Full-text search across multiple fields',
            query: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .or('name.ilike.%test%,email.ilike.%test%,company.ilike.%test%')
                .limit(1000);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'joinWithCampaigns',
            description: 'Join leads with campaigns and analyze performance',
            query: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select(`
                  *,
                  campaign_recipients!inner (
                    campaign_id,
                    sent_at,
                    opened_at,
                    clicked_at
                  )
                `)
                .not('campaign_recipients.sent_at', 'is', null)
                .limit(2000);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'customFieldsQuery',
            description: 'Query JSON custom fields',
            query: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .not('custom_fields', 'is', null)
                .limit(3000);
              
              if (error) throw error;
              return data;
            }
          }
        ];
        
        const queryResults = [];
        
        for (const queryTest of complexQueries) {
          logger.info(`Running query benchmark: ${queryTest.name}`);
          
          const queryStartTime = performance.now();
          
          try {
            const result = await queryTest.query();
            const queryTime = performance.now() - queryStartTime;
            
            queryResults.push({
              name: queryTest.name,
              description: queryTest.description,
              success: true,
              queryTime,
              recordCount: result.length,
              throughput: result.length / (queryTime / 1000)
            });
            
            logger.info(`Query ${queryTest.name} completed`, {
              queryTime,
              recordCount: result.length,
              throughput: result.length / (queryTime / 1000)
            });
            
          } catch (error) {
            const queryTime = performance.now() - queryStartTime;
            
            queryResults.push({
              name: queryTest.name,
              description: queryTest.description,
              success: false,
              queryTime,
              error: error.message,
              recordCount: 0,
              throughput: 0
            });
            
            logger.error(`Query ${queryTest.name} failed:`, error);
          }
          
          // Wait between queries
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Analyze results
        const successfulQueries = queryResults.filter(r => r.success).length;
        const averageQueryTime = queryResults.reduce((sum, r) => sum + r.queryTime, 0) / queryResults.length;
        const totalRecordsQueried = queryResults.reduce((sum, r) => sum + r.recordCount, 0);
        
        logger.info(`Complex query performance benchmark completed`, {
          totalQueries: complexQueries.length,
          successfulQueries,
          averageQueryTime,
          totalRecordsQueried,
          queryResults
        });
        
        // Verify performance thresholds
        expect(successfulQueries / complexQueries.length).toBeGreaterThan(0.8); // 80% success rate
        expect(averageQueryTime).toBeLessThan(10000); // Average query under 10 seconds
        
        // Verify specific query performance
        for (const result of queryResults) {
          if (result.success) {
            expect(result.queryTime).toBeLessThan(30000); // Individual queries under 30 seconds
          }
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Complex query performance benchmark completed successfully', {
          testMetrics,
          queryResults,
          averageQueryTime
        });
        
      } catch (error) {
        logger.error('Complex query performance benchmark failed', error);
        throw error;
      }
    }, 30 * 60 * 1000); // 30 minutes timeout
  });

  describe('Concurrent Database Operations', () => {
    it('should handle concurrent read/write operations efficiently', async () => {
      const testId = 'concurrent-db-operations';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting concurrent database operations benchmark');
      
      try {
        const concurrentOperations = 50;
        const operationsPerType = 100;
        
        // Define operation types
        const operationTypes = [
          {
            name: 'read',
            weight: 0.4, // 40% of operations
            operation: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .limit(Math.floor(Math.random() * 100) + 1);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'write',
            weight: 0.3, // 30% of operations
            operation: async () => {
              const contact = (await performanceDataGenerator.generateContacts(1, 'standard'))[0];
              
              const { data, error } = await supabase
                .from('leads')
                .insert({
                  email: contact.email,
                  name: contact.name,
                  phone: contact.phone,
                  company: contact.company,
                  workspace_id: 'test-workspace-id',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'update',
            weight: 0.2, // 20% of operations
            operation: async () => {
              const { data, error } = await supabase
                .from('leads')
                .update({
                  lead_score: Math.floor(Math.random() * 100),
                  updated_at: new Date().toISOString()
                })
                .eq('workspace_id', 'test-workspace-id')
                .limit(10);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'delete',
            weight: 0.1, // 10% of operations
            operation: async () => {
              const { data, error } = await supabase
                .from('leads')
                .delete()
                .eq('workspace_id', 'test-workspace-id')
                .limit(5);
              
              if (error) throw error;
              return data;
            }
          }
        ];
        
        // Generate operations based on weights
        const operations = [];
        for (const opType of operationTypes) {
          const count = Math.floor(operationsPerType * opType.weight);
          for (let i = 0; i < count; i++) {
            operations.push({
              type: opType.name,
              operation: opType.operation
            });
          }
        }
        
        // Shuffle operations
        this.shuffleArray(operations);
        
        logger.info(`Generated ${operations.length} database operations`);
        
        // Execute operations concurrently
        const startTime = performance.now();
        const operationPromises = [];
        
        for (let i = 0; i < concurrentOperations; i++) {
          const workerOperations = operations.slice(
            i * Math.floor(operations.length / concurrentOperations),
            (i + 1) * Math.floor(operations.length / concurrentOperations)
          );
          
          const workerPromise = this.executeOperationWorker(i, workerOperations);
          operationPromises.push(workerPromise);
        }
        
        const results = await Promise.allSettled(operationPromises);
        const totalTime = performance.now() - startTime;
        
        // Analyze results
        const successfulWorkers = results.filter(r => r.status === 'fulfilled').length;
        const failedWorkers = results.filter(r => r.status === 'rejected').length;
        
        let totalOperations = 0;
        let totalSuccessful = 0;
        let totalFailed = 0;
        
        for (const result of results) {
          if (result.status === 'fulfilled') {
            totalOperations += result.value.totalOperations;
            totalSuccessful += result.value.successful;
            totalFailed += result.value.failed;
          }
        }
        
        const operationThroughput = totalOperations / (totalTime / 1000);
        const successRate = totalSuccessful / totalOperations;
        
        logger.info(`Concurrent database operations benchmark completed`, {
          concurrentOperations,
          totalOperations,
          totalSuccessful,
          totalFailed,
          successfulWorkers,
          failedWorkers,
          operationThroughput,
          successRate,
          totalTime
        });
        
        // Verify performance thresholds
        expect(successfulWorkers / concurrentOperations).toBeGreaterThan(0.9); // 90% of workers successful
        expect(successRate).toBeGreaterThan(0.85); // 85% success rate
        expect(operationThroughput).toBeGreaterThan(10); // At least 10 operations/second
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Concurrent database operations benchmark completed successfully', {
          testMetrics,
          operationThroughput,
          successRate
        });
        
      } catch (error) {
        logger.error('Concurrent database operations benchmark failed', error);
        throw error;
      }
    }, 20 * 60 * 1000); // 20 minutes timeout
  });

  describe('Index Performance', () => {
    it('should verify index effectiveness on large datasets', async () => {
      const testId = 'index-performance';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting index performance benchmark');
      
      try {
        // Ensure we have test data
        await this.ensureTestData(1000000); // 1M records
        
        // Define queries to test index performance
        const indexQueries = [
          {
            name: 'emailIndex',
            description: 'Query by email (should use index)',
            query: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('email', 'test@example.com');
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'workspaceIndex',
            description: 'Query by workspace_id (should use index)',
            query: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('workspace_id', 'test-workspace-id')
                .limit(1000);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'dateIndex',
            description: 'Query by created_at (should use index)',
            query: async () => {
              const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
              
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .gte('created_at', yesterday)
                .limit(1000);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'statusIndex',
            description: 'Query by status (should use index)',
            query: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('status', 'active')
                .limit(1000);
              
              if (error) throw error;
              return data;
            }
          },
          {
            name: 'fullTableScan',
            description: 'Query without index (full table scan)',
            query: async () => {
              const { data, error } = await supabase
                .from('leads')
                .select('*')
                .like('name', '%test%')
                .limit(100);
              
              if (error) throw error;
              return data;
            }
          }
        ];
        
        const indexResults = [];
        
        // Run each query multiple times to get average performance
        for (const queryTest of indexQueries) {
          logger.info(`Running index performance test: ${queryTest.name}`);
          
          const runs = 5;
          const runTimes = [];
          
          for (let run = 0; run < runs; run++) {
            const runStartTime = performance.now();
            
            try {
              await queryTest.query();
              const runTime = performance.now() - runStartTime;
              runTimes.push(runTime);
              
            } catch (error) {
              logger.error(`Query ${queryTest.name} run ${run + 1} failed:`, error);
            }
            
            // Wait between runs
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          if (runTimes.length > 0) {
            const avgTime = runTimes.reduce((sum, time) => sum + time, 0) / runTimes.length;
            const minTime = Math.min(...runTimes);
            const maxTime = Math.max(...runTimes);
            
            indexResults.push({
              name: queryTest.name,
              description: queryTest.description,
              runs: runTimes.length,
              avgTime,
              minTime,
              maxTime,
              consistency: (maxTime - minTime) / avgTime
            });
          }
        }
        
        // Analyze index performance
        const indexedQueries = indexResults.filter(r => r.name !== 'fullTableScan');
        const fullTableScan = indexResults.find(r => r.name === 'fullTableScan');
        
        const avgIndexedTime = indexedQueries.reduce((sum, r) => sum + r.avgTime, 0) / indexedQueries.length;
        
        logger.info(`Index performance benchmark completed`, {
          totalQueries: indexQueries.length,
          avgIndexedTime,
          fullTableScanTime: fullTableScan?.avgTime,
          indexResults
        });
        
        // Verify index effectiveness
        expect(avgIndexedTime).toBeLessThan(5000); // Indexed queries under 5 seconds
        
        if (fullTableScan) {
          expect(avgIndexedTime).toBeLessThan(fullTableScan.avgTime); // Indexed faster than full scan
        }
        
        // Verify query consistency
        for (const result of indexResults) {
          expect(result.consistency).toBeLessThan(1.0); // Consistent performance
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Index performance benchmark completed successfully', {
          testMetrics,
          indexResults,
          avgIndexedTime
        });
        
      } catch (error) {
        logger.error('Index performance benchmark failed', error);
        throw error;
      }
    }, 15 * 60 * 1000); // 15 minutes timeout
  });

  describe('Connection Pool Performance', () => {
    it('should handle connection pool efficiently under load', async () => {
      const testId = 'connection-pool-performance';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting connection pool performance benchmark');
      
      try {
        const maxConcurrentConnections = 100;
        const operationsPerConnection = 10;
        const totalOperations = maxConcurrentConnections * operationsPerConnection;
        
        // Create connection pool stress test
        const connectionPromises = [];
        
        for (let i = 0; i < maxConcurrentConnections; i++) {
          const connectionPromise = this.testConnectionPoolWorker(i, operationsPerConnection);
          connectionPromises.push(connectionPromise);
        }
        
        const startTime = performance.now();
        const results = await Promise.allSettled(connectionPromises);
        const totalTime = performance.now() - startTime;
        
        // Analyze connection pool performance
        const successfulConnections = results.filter(r => r.status === 'fulfilled').length;
        const failedConnections = results.filter(r => r.status === 'rejected').length;
        
        let totalSuccessfulOps = 0;
        let totalFailedOps = 0;
        let totalConnectionTime = 0;
        
        for (const result of results) {
          if (result.status === 'fulfilled') {
            totalSuccessfulOps += result.value.successful;
            totalFailedOps += result.value.failed;
            totalConnectionTime += result.value.connectionTime;
          }
        }
        
        const avgConnectionTime = totalConnectionTime / successfulConnections;
        const operationThroughput = totalSuccessfulOps / (totalTime / 1000);
        const connectionSuccessRate = successfulConnections / maxConcurrentConnections;
        const operationSuccessRate = totalSuccessfulOps / totalOperations;
        
        logger.info(`Connection pool performance benchmark completed`, {
          maxConcurrentConnections,
          totalOperations,
          successfulConnections,
          failedConnections,
          totalSuccessfulOps,
          totalFailedOps,
          avgConnectionTime,
          operationThroughput,
          connectionSuccessRate,
          operationSuccessRate,
          totalTime
        });
        
        // Verify connection pool performance
        expect(connectionSuccessRate).toBeGreaterThan(0.8); // 80% of connections successful
        expect(operationSuccessRate).toBeGreaterThan(0.85); // 85% of operations successful
        expect(avgConnectionTime).toBeLessThan(10000); // Average connection time under 10 seconds
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Connection pool performance benchmark completed successfully', {
          testMetrics,
          connectionSuccessRate,
          operationThroughput
        });
        
      } catch (error) {
        logger.error('Connection pool performance benchmark failed', error);
        throw error;
      }
    }, 15 * 60 * 1000); // 15 minutes timeout
  });

  // Helper methods
  private async setupTestTables(): Promise<void> {
    logger.info('Setting up test tables');
    
    // Test tables should already exist from migrations
    // This is just a placeholder for any additional setup
  }

  private async cleanupTestData(): Promise<void> {
    logger.info('Cleaning up test data');
    
    try {
      // Clean up test leads
      await supabase
        .from('leads')
        .delete()
        .eq('workspace_id', 'test-workspace-id');
      
      logger.info('Test data cleanup completed');
    } catch (error) {
      logger.error('Error cleaning up test data:', error);
    }
  }

  private async ensureTestData(minRecords: number): Promise<void> {
    logger.info(`Ensuring at least ${minRecords} test records exist`);
    
    const { data: existingCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('workspace_id', 'test-workspace-id');
    
    const currentCount = existingCount?.length || 0;
    
    if (currentCount < minRecords) {
      const recordsToCreate = minRecords - currentCount;
      logger.info(`Creating ${recordsToCreate} additional test records`);
      
      const contacts = await performanceDataGenerator.generateContacts(recordsToCreate, 'standard');
      
      // Insert in batches
      const batchSize = 1000;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const batchData = batch.map(contact => ({
          email: contact.email,
          name: contact.name,
          phone: contact.phone,
          company: contact.company,
          workspace_id: 'test-workspace-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        await supabase.from('leads').insert(batchData);
      }
    }
  }

  private async executeOperationWorker(workerId: number, operations: any[]): Promise<{
    workerId: number;
    totalOperations: number;
    successful: number;
    failed: number;
    avgTime: number;
  }> {
    let successful = 0;
    let failed = 0;
    const operationTimes = [];
    
    for (const operation of operations) {
      const operationStartTime = performance.now();
      
      try {
        await operation.operation();
        successful++;
      } catch (error) {
        failed++;
      }
      
      const operationTime = performance.now() - operationStartTime;
      operationTimes.push(operationTime);
    }
    
    const avgTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length;
    
    return {
      workerId,
      totalOperations: operations.length,
      successful,
      failed,
      avgTime
    };
  }

  private async testConnectionPoolWorker(workerId: number, operationsCount: number): Promise<{
    workerId: number;
    successful: number;
    failed: number;
    connectionTime: number;
  }> {
    const startTime = performance.now();
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < operationsCount; i++) {
      try {
        // Simple query to test connection
        const { data, error } = await supabase
          .from('leads')
          .select('id')
          .limit(1);
        
        if (error) throw error;
        successful++;
      } catch (error) {
        failed++;
      }
    }
    
    const connectionTime = performance.now() - startTime;
    
    return {
      workerId,
      successful,
      failed,
      connectionTime
    };
  }

  private shuffleArray(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
});