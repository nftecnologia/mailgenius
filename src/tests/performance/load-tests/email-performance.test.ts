import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { performanceDataGenerator } from '../data-generator';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { LoadTestRunner } from '../runners/load-test-runner';
import { emailWorkersService } from '@/lib/email-workers';
import { queueManager } from '@/lib/queue';
import { redisManager } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { LOAD_TEST_SCENARIOS } from '../config';

describe('Email Performance Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let loadTestRunner: LoadTestRunner;
  let testStartTime: number;

  beforeAll(async () => {
    logger.info('Starting Email Performance Test Setup');
    
    // Initialize performance monitoring
    performanceMonitor = new PerformanceMonitor({
      metricsInterval: 5000,
      resourceMonitoring: true,
      enableDetailedMetrics: true
    });
    
    // Initialize load test runner
    loadTestRunner = new LoadTestRunner(LOAD_TEST_SCENARIOS.EMAIL_SENDING_STRESS);
    
    // Setup infrastructure
    await queueManager.initialize();
    await redisManager.connect();
    await emailWorkersService.initialize({
      autoStart: true,
      maxWorkers: 20,
      targetThroughput: 500
    });
    
    // Start monitoring
    await performanceMonitor.start();
    
    logger.info('Email Performance Test Setup Complete');
  });

  afterAll(async () => {
    logger.info('Cleaning up Email Performance Test');
    
    // Stop monitoring and generate reports
    const report = await performanceMonitor.stop();
    await performanceMonitor.generateReport(report, 'email-performance-test');
    
    // Cleanup
    await emailWorkersService.stop();
    await queueManager.closeAll();
    await redisManager.disconnect();
    
    logger.info('Email Performance Test Cleanup Complete');
  });

  beforeEach(() => {
    testStartTime = performance.now();
  });

  afterEach(() => {
    const testDuration = performance.now() - testStartTime;
    logger.info(`Test completed in ${testDuration.toFixed(2)}ms`);
  });

  describe('High-Volume Email Sending', () => {
    it('should handle 500 emails per second sustained throughput', async () => {
      const scenario = LOAD_TEST_SCENARIOS.EMAIL_SENDING_STRESS;
      const testId = 'high-volume-email-sending';
      
      logger.info('Starting high-volume email sending test');
      
      const testMonitor = performanceMonitor.startTest(testId);
      
      try {
        const targetThroughput = 500; // emails per second
        const testDuration = 300; // 5 minutes
        const totalEmails = targetThroughput * testDuration;
        
        // Generate test data
        const campaigns = await performanceDataGenerator.generateCampaignTestData(
          10, // 10 campaigns
          totalEmails / 10 // emails per campaign
        );
        
        logger.info(`Generated ${campaigns.length} campaigns with ${totalEmails} total emails`);
        
        // Start email sending with controlled rate
        const startTime = performance.now();
        const sendingPromises: Promise<any>[] = [];
        
        for (const campaign of campaigns) {
          const sendingPromise = this.sendCampaignWithRateControl(
            campaign,
            targetThroughput / campaigns.length, // distribute throughput across campaigns
            testDuration
          );
          sendingPromises.push(sendingPromise);
        }
        
        const results = await Promise.all(sendingPromises);
        const totalTime = performance.now() - startTime;
        
        // Calculate aggregate metrics
        const totalSent = results.reduce((sum, result) => sum + result.sent, 0);
        const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);
        const actualThroughput = totalSent / (totalTime / 1000);
        const errorRate = totalFailed / (totalSent + totalFailed);
        
        logger.info(`High-volume email sending completed`, {
          totalSent,
          totalFailed,
          actualThroughput,
          errorRate,
          totalTime
        });
        
        // Verify performance thresholds
        expect(actualThroughput).toBeGreaterThan(scenario.thresholds.throughput);
        expect(errorRate).toBeLessThan(scenario.thresholds.errorRate);
        expect(totalTime).toBeLessThan(scenario.sustainDuration * 1000 * 1.1); // 10% tolerance
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('High-volume email sending test completed successfully', {
          testMetrics,
          results
        });
        
      } catch (error) {
        logger.error('High-volume email sending test failed', error);
        throw error;
      }
    }, 10 * 60 * 1000); // 10 minutes timeout
  });

  describe('Burst Email Sending', () => {
    it('should handle sudden bursts of email sending requests', async () => {
      const testId = 'burst-email-sending';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting burst email sending test');
      
      try {
        const burstSizes = [100, 500, 1000, 2000, 5000];
        const results = [];
        
        for (const burstSize of burstSizes) {
          logger.info(`Testing burst size: ${burstSize} emails`);
          
          // Generate campaign for this burst
          const campaign = (await performanceDataGenerator.generateCampaignTestData(1, burstSize))[0];
          
          const burstStartTime = performance.now();
          
          // Send all emails at once (burst)
          const sendingPromises = campaign.recipients.map(recipient => 
            this.sendSingleEmail(campaign, recipient)
          );
          
          const burstResults = await Promise.allSettled(sendingPromises);
          const burstTime = performance.now() - burstStartTime;
          
          const successful = burstResults.filter(r => r.status === 'fulfilled').length;
          const failed = burstResults.filter(r => r.status === 'rejected').length;
          const burstThroughput = successful / (burstTime / 1000);
          
          results.push({
            burstSize,
            successful,
            failed,
            burstTime,
            burstThroughput,
            successRate: successful / (successful + failed)
          });
          
          logger.info(`Burst ${burstSize} completed`, {
            successful,
            failed,
            burstTime,
            burstThroughput
          });
          
          // Wait between bursts
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        // Verify all bursts performed within acceptable limits
        for (const result of results) {
          expect(result.successRate).toBeGreaterThan(0.9); // 90% success rate
          expect(result.burstThroughput).toBeGreaterThan(10); // At least 10 emails/second
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Burst email sending test completed successfully', {
          testMetrics,
          results
        });
        
      } catch (error) {
        logger.error('Burst email sending test failed', error);
        throw error;
      }
    }, 15 * 60 * 1000); // 15 minutes timeout
  });

  describe('Large Email Templates', () => {
    it('should handle large email templates efficiently', async () => {
      const testId = 'large-email-templates';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting large email templates test');
      
      try {
        const templateSizes = [
          { name: 'small', size: 1000 }, // 1KB
          { name: 'medium', size: 10000 }, // 10KB
          { name: 'large', size: 100000 }, // 100KB
          { name: 'xlarge', size: 500000 }, // 500KB
          { name: 'xxlarge', size: 1000000 } // 1MB
        ];
        
        const results = [];
        
        for (const templateConfig of templateSizes) {
          logger.info(`Testing template size: ${templateConfig.name} (${templateConfig.size} bytes)`);
          
          // Generate large email template
          const largeTemplate = {
            subject: 'Large Template Test',
            html: this.generateLargeHtmlTemplate(templateConfig.size),
            text: this.generateLargeTextTemplate(templateConfig.size / 2)
          };
          
          // Generate recipients
          const recipients = await performanceDataGenerator.generateContacts(100, 'standard');
          
          const campaign = {
            name: `Large Template Test - ${templateConfig.name}`,
            type: 'newsletter' as const,
            template: largeTemplate,
            recipients,
            sender: {
              email: 'test@example.com',
              name: 'Test Sender'
            },
            settings: {
              sendRate: 50,
              batchSize: 10,
              retryAttempts: 3,
              trackOpens: true,
              trackClicks: true
            }
          };
          
          const templateStartTime = performance.now();
          
          // Send emails with large template
          const sendingPromises = recipients.map(recipient => 
            this.sendSingleEmail(campaign, recipient)
          );
          
          const templateResults = await Promise.allSettled(sendingPromises);
          const templateTime = performance.now() - templateStartTime;
          
          const successful = templateResults.filter(r => r.status === 'fulfilled').length;
          const failed = templateResults.filter(r => r.status === 'rejected').length;
          const templateThroughput = successful / (templateTime / 1000);
          
          results.push({
            templateSize: templateConfig.size,
            templateName: templateConfig.name,
            successful,
            failed,
            templateTime,
            templateThroughput,
            avgTimePerEmail: templateTime / recipients.length
          });
          
          logger.info(`Template ${templateConfig.name} completed`, {
            successful,
            failed,
            templateTime,
            templateThroughput
          });
          
          // Verify performance doesn't degrade significantly with larger templates
          expect(templateThroughput).toBeGreaterThan(5); // At least 5 emails/second
          expect(successful / (successful + failed)).toBeGreaterThan(0.95); // 95% success rate
        }
        
        // Verify performance scaling
        const smallResult = results.find(r => r.templateName === 'small');
        const largeResult = results.find(r => r.templateName === 'large');
        
        if (smallResult && largeResult) {
          const performanceDegradation = largeResult.avgTimePerEmail / smallResult.avgTimePerEmail;
          expect(performanceDegradation).toBeLessThan(10); // No more than 10x slower
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Large email templates test completed successfully', {
          testMetrics,
          results
        });
        
      } catch (error) {
        logger.error('Large email templates test failed', error);
        throw error;
      }
    }, 20 * 60 * 1000); // 20 minutes timeout
  });

  describe('Concurrent Campaign Sending', () => {
    it('should handle multiple concurrent campaigns', async () => {
      const testId = 'concurrent-campaign-sending';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting concurrent campaign sending test');
      
      try {
        const concurrentCampaigns = 20;
        const recipientsPerCampaign = 1000;
        
        // Generate campaigns
        const campaigns = await performanceDataGenerator.generateCampaignTestData(
          concurrentCampaigns,
          recipientsPerCampaign
        );
        
        logger.info(`Generated ${campaigns.length} campaigns with ${recipientsPerCampaign} recipients each`);
        
        const startTime = performance.now();
        
        // Start all campaigns concurrently
        const campaignPromises = campaigns.map((campaign, index) => 
          this.sendCampaignWithRateControl(campaign, 25, 120) // 25 emails/second for 2 minutes
        );
        
        const results = await Promise.all(campaignPromises);
        const totalTime = performance.now() - startTime;
        
        // Calculate aggregate metrics
        const totalSent = results.reduce((sum, result) => sum + result.sent, 0);
        const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);
        const overallThroughput = totalSent / (totalTime / 1000);
        const overallErrorRate = totalFailed / (totalSent + totalFailed);
        
        logger.info(`Concurrent campaign sending completed`, {
          totalSent,
          totalFailed,
          overallThroughput,
          overallErrorRate,
          totalTime
        });
        
        // Verify performance thresholds
        expect(overallThroughput).toBeGreaterThan(300); // At least 300 emails/second overall
        expect(overallErrorRate).toBeLessThan(0.05); // Less than 5% error rate
        expect(totalSent).toBe(concurrentCampaigns * recipientsPerCampaign);
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Concurrent campaign sending test completed successfully', {
          testMetrics,
          results
        });
        
      } catch (error) {
        logger.error('Concurrent campaign sending test failed', error);
        throw error;
      }
    }, 15 * 60 * 1000); // 15 minutes timeout
  });

  describe('Email Personalization Performance', () => {
    it('should handle complex email personalization efficiently', async () => {
      const testId = 'email-personalization-performance';
      const testMonitor = performanceMonitor.startTest(testId);
      
      logger.info('Starting email personalization performance test');
      
      try {
        const personalizationLevels = [
          { name: 'basic', fields: 3 },
          { name: 'moderate', fields: 10 },
          { name: 'complex', fields: 25 },
          { name: 'extreme', fields: 50 }
        ];
        
        const results = [];
        
        for (const level of personalizationLevels) {
          logger.info(`Testing personalization level: ${level.name} (${level.fields} fields)`);
          
          // Generate highly personalized template
          const personalizedTemplate = this.generatePersonalizedTemplate(level.fields);
          
          // Generate recipients with custom fields
          const recipients = await performanceDataGenerator.generateContacts(500, 'complete');
          
          const campaign = {
            name: `Personalization Test - ${level.name}`,
            type: 'promotional' as const,
            template: personalizedTemplate,
            recipients,
            sender: {
              email: 'test@example.com',
              name: 'Test Sender'
            },
            settings: {
              sendRate: 100,
              batchSize: 50,
              retryAttempts: 3,
              trackOpens: true,
              trackClicks: true
            }
          };
          
          const personalizationStartTime = performance.now();
          
          // Send personalized emails
          const sendingPromises = recipients.map(recipient => 
            this.sendPersonalizedEmail(campaign, recipient)
          );
          
          const personalizationResults = await Promise.allSettled(sendingPromises);
          const personalizationTime = performance.now() - personalizationStartTime;
          
          const successful = personalizationResults.filter(r => r.status === 'fulfilled').length;
          const failed = personalizationResults.filter(r => r.status === 'rejected').length;
          const personalizationThroughput = successful / (personalizationTime / 1000);
          
          results.push({
            level: level.name,
            fields: level.fields,
            successful,
            failed,
            personalizationTime,
            personalizationThroughput,
            avgPersonalizationTime: personalizationTime / recipients.length
          });
          
          logger.info(`Personalization ${level.name} completed`, {
            successful,
            failed,
            personalizationTime,
            personalizationThroughput
          });
          
          // Verify performance doesn't degrade significantly with more personalization
          expect(personalizationThroughput).toBeGreaterThan(10); // At least 10 emails/second
          expect(successful / (successful + failed)).toBeGreaterThan(0.95); // 95% success rate
        }
        
        const testMetrics = await testMonitor.stop();
        
        logger.info('Email personalization performance test completed successfully', {
          testMetrics,
          results
        });
        
      } catch (error) {
        logger.error('Email personalization performance test failed', error);
        throw error;
      }
    }, 10 * 60 * 1000); // 10 minutes timeout
  });

  // Helper methods
  private async sendCampaignWithRateControl(
    campaign: any,
    targetRate: number,
    durationSeconds: number
  ): Promise<{ sent: number; failed: number; duration: number }> {
    const startTime = performance.now();
    const endTime = startTime + (durationSeconds * 1000);
    const intervalMs = 1000 / targetRate;
    
    let sent = 0;
    let failed = 0;
    let recipientIndex = 0;
    
    while (performance.now() < endTime && recipientIndex < campaign.recipients.length) {
      const batchStartTime = performance.now();
      
      // Send email
      try {
        await this.sendSingleEmail(campaign, campaign.recipients[recipientIndex]);
        sent++;
      } catch (error) {
        failed++;
      }
      
      recipientIndex++;
      
      // Control rate
      const batchTime = performance.now() - batchStartTime;
      if (batchTime < intervalMs) {
        await new Promise(resolve => setTimeout(resolve, intervalMs - batchTime));
      }
    }
    
    return {
      sent,
      failed,
      duration: performance.now() - startTime
    };
  }

  private async sendSingleEmail(campaign: any, recipient: any): Promise<void> {
    // Simulate email sending with processing time
    const processingTime = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failures
    if (Math.random() < 0.02) { // 2% failure rate
      throw new Error('Simulated email sending failure');
    }
  }

  private async sendPersonalizedEmail(campaign: any, recipient: any): Promise<void> {
    // Simulate personalization processing
    const personalizationTime = Math.random() * 50 + 25; // 25-75ms
    await new Promise(resolve => setTimeout(resolve, personalizationTime));
    
    // Simulate email sending
    await this.sendSingleEmail(campaign, recipient);
  }

  private generateLargeHtmlTemplate(size: number): string {
    const baseTemplate = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .header { background: #f0f0f0; padding: 20px; }
            .content { padding: 20px; }
            .footer { background: #e0e0e0; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Hello {{name}}!</h1>
            <p>Welcome to our newsletter from {{company}}</p>
          </div>
          <div class="content">
    `;
    
    const contentSize = size - baseTemplate.length - 200; // Reserve space for closing tags
    const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
      Math.floor(contentSize / 60)
    );
    
    return baseTemplate + content + `
          </div>
          <div class="footer">
            <p>Best regards, {{sender_name}}</p>
          </div>
        </body>
      </html>
    `;
  }

  private generateLargeTextTemplate(size: number): string {
    const baseTemplate = `
Hello {{name}},

Welcome to our newsletter from {{company}}.

`;
    
    const contentSize = size - baseTemplate.length - 100;
    const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
      Math.floor(contentSize / 60)
    );
    
    return baseTemplate + content + `

Best regards,
{{sender_name}}
`;
  }

  private generatePersonalizedTemplate(fieldCount: number): any {
    let htmlTemplate = `
      <html>
        <body>
          <h1>Hello {{name}}!</h1>
          <p>Welcome from {{company}}</p>
    `;
    
    let textTemplate = `
Hello {{name}},

Welcome from {{company}}.

`;
    
    // Add personalization fields
    for (let i = 0; i < fieldCount; i++) {
      const fieldName = `custom_field_${i}`;
      htmlTemplate += `<p>Your ${fieldName}: {{${fieldName}}}</p>`;
      textTemplate += `Your ${fieldName}: {{${fieldName}}}\n`;
    }
    
    htmlTemplate += `
          <p>Best regards,</p>
          <p>{{sender_name}}</p>
        </body>
      </html>
    `;
    
    textTemplate += `
Best regards,
{{sender_name}}
`;
    
    return {
      subject: 'Personalized email for {{name}} from {{company}}',
      html: htmlTemplate,
      text: textTemplate
    };
  }
});