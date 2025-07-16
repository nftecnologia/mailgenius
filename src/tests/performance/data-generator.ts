import { faker } from '@faker-js/faker';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { stringify } from 'csv-stringify';
import { logger } from '@/lib/logger';

export interface ContactTestData {
  email: string;
  name: string;
  phone?: string;
  company?: string;
  position?: string;
  country?: string;
  city?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  leadSource?: string;
  leadScore?: number;
  subscriptionDate?: string;
  status?: 'active' | 'inactive' | 'bounced' | 'unsubscribed';
}

export interface EmailTestData {
  subject: string;
  html: string;
  text: string;
  attachments?: any[];
  metadata?: Record<string, any>;
}

export interface CampaignTestData {
  name: string;
  type: 'newsletter' | 'promotional' | 'transactional' | 'automated_drip' | 'ab_test' | 'broadcast';
  template: EmailTestData;
  recipients: ContactTestData[];
  sender: {
    email: string;
    name: string;
  };
  settings: {
    sendRate: number;
    batchSize: number;
    retryAttempts: number;
    trackOpens: boolean;
    trackClicks: boolean;
  };
}

export class PerformanceDataGenerator {
  private readonly locales = ['en', 'es', 'fr', 'de', 'it', 'pt_BR', 'zh_CN', 'ja', 'ko', 'ar'];
  private readonly domains = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'tutanota.com', 'company.com',
    'business.org', 'startup.io', 'enterprise.net', 'test.local'
  ];
  private readonly companies = [
    'Tech Corp', 'Innovation Inc', 'Digital Solutions', 'Global Systems',
    'Future Tech', 'Data Analytics Co', 'Cloud Services', 'AI Solutions',
    'Marketing Hub', 'Sales Force', 'Customer Success', 'Growth Partners'
  ];
  private readonly positions = [
    'CEO', 'CTO', 'CFO', 'CMO', 'VP Sales', 'VP Marketing', 'Director',
    'Manager', 'Senior Developer', 'Product Manager', 'Data Scientist',
    'UX Designer', 'Sales Representative', 'Marketing Specialist'
  ];
  private readonly leadSources = [
    'website', 'social_media', 'email_campaign', 'referral', 'trade_show',
    'webinar', 'content_download', 'demo_request', 'cold_outreach', 'partner'
  ];

  /**
   * Generate realistic test contacts with various patterns
   */
  async generateContacts(
    count: number,
    pattern: 'standard' | 'minimal' | 'complete' | 'international' | 'edge_cases' | 'invalid_mixed' = 'standard',
    options: {
      outputFile?: string;
      chunkSize?: number;
      includeInvalid?: boolean;
      invalidRate?: number;
    } = {}
  ): Promise<ContactTestData[]> {
    const { outputFile, chunkSize = 10000, includeInvalid = false, invalidRate = 0.05 } = options;
    const contacts: ContactTestData[] = [];
    
    logger.info(`Starting generation of ${count} contacts with pattern: ${pattern}`);
    
    for (let i = 0; i < count; i++) {
      const contact = this.generateSingleContact(pattern, includeInvalid && Math.random() < invalidRate);
      contacts.push(contact);
      
      // Write to file in chunks if specified
      if (outputFile && contacts.length >= chunkSize) {
        await this.writeContactsToFile(contacts, outputFile, i === 0);
        contacts.length = 0; // Clear array
      }
      
      // Log progress
      if (i % 100000 === 0 && i > 0) {
        logger.info(`Generated ${i} contacts (${((i / count) * 100).toFixed(1)}%)`);
      }
    }
    
    // Write remaining contacts
    if (outputFile && contacts.length > 0) {
      await this.writeContactsToFile(contacts, outputFile, false);
    }
    
    logger.info(`Completed generation of ${count} contacts`);
    return contacts;
  }

  /**
   * Generate a single contact based on pattern
   */
  private generateSingleContact(pattern: string, makeInvalid: boolean = false): ContactTestData {
    const locale = faker.helpers.arrayElement(this.locales);
    faker.setLocale(locale);
    
    const contact: ContactTestData = {
      email: makeInvalid ? this.generateInvalidEmail() : this.generateValidEmail(),
      name: faker.name.fullName(),
      status: faker.helpers.arrayElement(['active', 'inactive', 'bounced', 'unsubscribed'])
    };
    
    switch (pattern) {
      case 'minimal':
        // Only email is required
        break;
        
      case 'complete':
        contact.phone = faker.phone.number();
        contact.company = faker.helpers.arrayElement(this.companies);
        contact.position = faker.helpers.arrayElement(this.positions);
        contact.country = faker.address.country();
        contact.city = faker.address.city();
        contact.tags = faker.helpers.arrayElements(['VIP', 'Lead', 'Customer', 'Prospect', 'Partner'], 2);
        contact.customFields = {
          industry: faker.company.catchPhraseDescriptor(),
          companySize: faker.helpers.arrayElement(['1-10', '11-50', '51-200', '201-1000', '1000+']),
          budget: faker.commerce.price(1000, 100000, 0),
          lastActivity: faker.date.recent(30).toISOString()
        };
        contact.leadSource = faker.helpers.arrayElement(this.leadSources);
        contact.leadScore = faker.datatype.number({ min: 0, max: 100 });
        contact.subscriptionDate = faker.date.past(2).toISOString();
        break;
        
      case 'international':
        contact.phone = faker.phone.number();
        contact.company = faker.company.name();
        contact.country = faker.address.country();
        contact.city = faker.address.city();
        // Add international character variations
        contact.name = this.addInternationalCharacters(contact.name);
        break;
        
      case 'edge_cases':
        contact.email = makeInvalid ? this.generateEdgeCaseEmail() : this.generateValidEmail();
        contact.name = this.generateEdgeCaseName();
        contact.phone = this.generateEdgeCasePhone();
        break;
        
      case 'invalid_mixed':
        // Mix of valid and invalid data
        if (Math.random() < 0.3) {
          contact.email = this.generateInvalidEmail();
        }
        if (Math.random() < 0.2) {
          contact.name = ''; // Empty name
        }
        break;
        
      default: // 'standard'
        contact.phone = faker.phone.number();
        contact.company = faker.helpers.arrayElement(this.companies);
        contact.position = faker.helpers.arrayElement(this.positions);
        contact.country = faker.address.country();
        contact.leadSource = faker.helpers.arrayElement(this.leadSources);
        contact.leadScore = faker.datatype.number({ min: 0, max: 100 });
        contact.subscriptionDate = faker.date.past(1).toISOString();
    }
    
    return contact;
  }

  /**
   * Generate valid email addresses
   */
  private generateValidEmail(): string {
    const domain = faker.helpers.arrayElement(this.domains);
    const username = faker.internet.userName().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    return `${username}@${domain}`;
  }

  /**
   * Generate invalid email addresses for testing
   */
  private generateInvalidEmail(): string {
    const invalidPatterns = [
      'invalid-email',
      'test@',
      '@domain.com',
      'test..test@domain.com',
      'test@domain',
      'test@.domain.com',
      'test@domain.',
      'test@domain..com',
      'test space@domain.com',
      'test@domain space.com'
    ];
    return faker.helpers.arrayElement(invalidPatterns);
  }

  /**
   * Generate edge case email addresses
   */
  private generateEdgeCaseEmail(): string {
    const edgeCases = [
      'test.email+tag@domain.com',
      'test_email123@domain-name.com',
      'test-email@domain.co.uk',
      'test.email@subdomain.domain.com',
      'verylongemailaddressusername@verylongdomainname.com',
      'test.email@123.456.789.012',
      'test@domain-with-many-hyphens.com',
      'test.email@unicode-domain.测试'
    ];
    return faker.helpers.arrayElement(edgeCases);
  }

  /**
   * Generate edge case names
   */
  private generateEdgeCaseName(): string {
    const edgeCases = [
      'José María González-Pérez',
      '李小明',
      'محمد عبد الله',
      'O\'Connor',
      'Jean-Baptiste',
      'Very Long Name That Exceeds Normal Length Limits',
      'Müller-Lüdenscheidt',
      'D\'Artagnan',
      'Van Der Berg',
      'Al-Mahmoud'
    ];
    return faker.helpers.arrayElement(edgeCases);
  }

  /**
   * Generate edge case phone numbers
   */
  private generateEdgeCasePhone(): string {
    const edgeCases = [
      '+1 (555) 123-4567',
      '+44 20 7946 0958',
      '+86 138 0013 8000',
      '+33 1 42 86 83 26',
      '+49 30 12345678',
      '+55 11 98765-4321',
      '+91 98765 43210',
      '555-123-4567',
      '(555) 123-4567',
      '555.123.4567'
    ];
    return faker.helpers.arrayElement(edgeCases);
  }

  /**
   * Add international characters to names
   */
  private addInternationalCharacters(name: string): string {
    const variations = [
      name,
      name.replace(/a/g, 'à').replace(/e/g, 'é').replace(/i/g, 'í'),
      name.replace(/o/g, 'ö').replace(/u/g, 'ü'),
      name.replace(/n/g, 'ñ').replace(/c/g, 'ç'),
      name.replace(/s/g, 'ß').replace(/a/g, 'å')
    ];
    return faker.helpers.arrayElement(variations);
  }

  /**
   * Write contacts to CSV file
   */
  private async writeContactsToFile(
    contacts: ContactTestData[],
    filename: string,
    isFirst: boolean = false
  ): Promise<void> {
    const writeStream = createWriteStream(filename, { flags: isFirst ? 'w' : 'a' });
    
    const transform = new Transform({
      objectMode: true,
      transform(contact: ContactTestData, encoding, callback) {
        // Flatten the object for CSV
        const flatContact = {
          email: contact.email,
          name: contact.name,
          phone: contact.phone || '',
          company: contact.company || '',
          position: contact.position || '',
          country: contact.country || '',
          city: contact.city || '',
          tags: contact.tags ? contact.tags.join(';') : '',
          leadSource: contact.leadSource || '',
          leadScore: contact.leadScore || 0,
          subscriptionDate: contact.subscriptionDate || '',
          status: contact.status || 'active',
          customFields: contact.customFields ? JSON.stringify(contact.customFields) : ''
        };
        callback(null, flatContact);
      }
    });
    
    const csvStringifier = stringify({
      header: isFirst,
      columns: {
        email: 'email',
        name: 'name',
        phone: 'phone',
        company: 'company',
        position: 'position',
        country: 'country',
        city: 'city',
        tags: 'tags',
        leadSource: 'leadSource',
        leadScore: 'leadScore',
        subscriptionDate: 'subscriptionDate',
        status: 'status',
        customFields: 'customFields'
      }
    });
    
    await pipeline(
      contacts,
      transform,
      csvStringifier,
      writeStream
    );
  }

  /**
   * Generate email templates for testing
   */
  generateEmailTemplates(count: number = 10): EmailTestData[] {
    const templates: EmailTestData[] = [];
    
    for (let i = 0; i < count; i++) {
      templates.push({
        subject: faker.lorem.sentence(),
        html: this.generateHtmlTemplate(),
        text: this.generateTextTemplate(),
        attachments: Math.random() < 0.3 ? this.generateAttachments() : undefined,
        metadata: {
          category: faker.helpers.arrayElement(['newsletter', 'promotional', 'transactional']),
          priority: faker.helpers.arrayElement(['high', 'medium', 'low']),
          tags: faker.helpers.arrayElements(['marketing', 'sales', 'support', 'announcement'], 2)
        }
      });
    }
    
    return templates;
  }

  /**
   * Generate HTML email template
   */
  private generateHtmlTemplate(): string {
    const templates = [
      `<html><body><h1>{{name}}</h1><p>Welcome to our newsletter!</p><p>${faker.lorem.paragraphs(2)}</p></body></html>`,
      `<html><body><div style="font-family: Arial;"><h2>Hello {{name}}!</h2><p>${faker.lorem.paragraph()}</p><a href="https://example.com">Click here</a></div></body></html>`,
      `<html><body><table width="100%"><tr><td><h1>{{company}}</h1></td></tr><tr><td><p>Dear {{name}},</p><p>${faker.lorem.paragraphs(3)}</p></td></tr></table></body></html>`
    ];
    
    return faker.helpers.arrayElement(templates);
  }

  /**
   * Generate text email template
   */
  private generateTextTemplate(): string {
    return `Hello {{name}},\n\n${faker.lorem.paragraphs(2, '\n\n')}\n\nBest regards,\nThe Team`;
  }

  /**
   * Generate email attachments
   */
  private generateAttachments(): any[] {
    return [
      {
        filename: 'document.pdf',
        content: Buffer.from('fake pdf content'),
        contentType: 'application/pdf'
      }
    ];
  }

  /**
   * Generate complete campaign test data
   */
  async generateCampaignTestData(
    campaignCount: number = 1,
    recipientsPerCampaign: number = 1000
  ): Promise<CampaignTestData[]> {
    const campaigns: CampaignTestData[] = [];
    
    for (let i = 0; i < campaignCount; i++) {
      const recipients = await this.generateContacts(recipientsPerCampaign, 'standard');
      const templates = this.generateEmailTemplates(1);
      
      campaigns.push({
        name: faker.company.catchPhrase(),
        type: faker.helpers.arrayElement(['newsletter', 'promotional', 'transactional', 'automated_drip', 'ab_test', 'broadcast']),
        template: templates[0],
        recipients,
        sender: {
          email: faker.internet.email(),
          name: faker.name.fullName()
        },
        settings: {
          sendRate: faker.datatype.number({ min: 10, max: 100 }),
          batchSize: faker.datatype.number({ min: 50, max: 500 }),
          retryAttempts: faker.datatype.number({ min: 1, max: 5 }),
          trackOpens: faker.datatype.boolean(),
          trackClicks: faker.datatype.boolean()
        }
      });
    }
    
    return campaigns;
  }

  /**
   * Generate test data for different scales
   */
  async generateScaledTestData(scale: 'small' | 'medium' | 'large' | 'xl' | 'xxl' = 'medium'): Promise<{
    contacts: number;
    campaigns: number;
    estimatedSize: string;
  }> {
    const scales = {
      small: { contacts: 10000, campaigns: 5 },
      medium: { contacts: 100000, campaigns: 20 },
      large: { contacts: 500000, campaigns: 50 },
      xl: { contacts: 1000000, campaigns: 100 },
      xxl: { contacts: 2000000, campaigns: 200 }
    };
    
    const config = scales[scale];
    const estimatedSize = this.estimateDataSize(config.contacts, config.campaigns);
    
    logger.info(`Generating ${scale} scale test data: ${config.contacts} contacts, ${config.campaigns} campaigns`);
    
    // Generate contacts in chunks to avoid memory issues
    const contacts = await this.generateContacts(
      config.contacts,
      'standard',
      { 
        outputFile: `/tmp/test-contacts-${scale}.csv`,
        chunkSize: 50000 
      }
    );
    
    // Generate campaigns
    const campaigns = await this.generateCampaignTestData(config.campaigns, 1000);
    
    return {
      contacts: config.contacts,
      campaigns: config.campaigns,
      estimatedSize
    };
  }

  /**
   * Estimate data size for planning
   */
  private estimateDataSize(contacts: number, campaigns: number): string {
    // Rough estimates based on average field sizes
    const avgContactSize = 300; // bytes
    const avgCampaignSize = 5000; // bytes
    
    const totalSize = (contacts * avgContactSize) + (campaigns * avgCampaignSize);
    
    if (totalSize > 1073741824) { // 1GB
      return `${(totalSize / 1073741824).toFixed(2)} GB`;
    } else if (totalSize > 1048576) { // 1MB
      return `${(totalSize / 1048576).toFixed(2)} MB`;
    } else {
      return `${(totalSize / 1024).toFixed(2)} KB`;
    }
  }
}

// Export singleton instance
export const performanceDataGenerator = new PerformanceDataGenerator();