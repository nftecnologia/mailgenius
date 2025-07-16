#!/usr/bin/env node

/**
 * Setup script for API Key Expiration System
 * This script helps configure the API key expiration system
 */

const fs = require('fs')
const path = require('path')

console.log('🚀 Setting up API Key Expiration System...\n')

// Check if required files exist
const requiredFiles = [
  'database/migrations/008_api_key_expiration.sql',
  'src/lib/api-auth.ts',
  'src/lib/api-key-notifications.ts',
  'src/app/api/settings/api-keys/route.ts',
  'src/app/api/cron/api-keys/route.ts',
  'vercel.json'
]

console.log('📋 Checking required files...')
let missingFiles = []

requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file)
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`)
  } else {
    console.log(`❌ ${file} - MISSING`)
    missingFiles.push(file)
  }
})

if (missingFiles.length > 0) {
  console.log(`\n❌ Missing ${missingFiles.length} required files. Please ensure all files are created.\n`)
  process.exit(1)
}

// Check environment variables
console.log('\n🔑 Checking environment variables...')
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'CRON_SECRET'
]

const envFile = path.join(process.cwd(), '.env.local')
let envContent = ''

if (fs.existsSync(envFile)) {
  envContent = fs.readFileSync(envFile, 'utf8')
}

requiredEnvVars.forEach(envVar => {
  if (envContent.includes(envVar) || process.env[envVar]) {
    console.log(`✅ ${envVar}`)
  } else {
    console.log(`⚠️  ${envVar} - NOT SET`)
  }
})

// Check if CRON_SECRET is set
if (!envContent.includes('CRON_SECRET') && !process.env.CRON_SECRET) {
  console.log('\n🔐 Generating CRON_SECRET...')
  const crypto = require('crypto')
  const cronSecret = crypto.randomBytes(32).toString('hex')
  
  const newEnvLine = `CRON_SECRET=${cronSecret}\n`
  
  if (fs.existsSync(envFile)) {
    fs.appendFileSync(envFile, newEnvLine)
  } else {
    fs.writeFileSync(envFile, newEnvLine)
  }
  
  console.log('✅ CRON_SECRET generated and added to .env.local')
}

// Update vercel.json with proper cron secret
console.log('\n⚙️  Updating vercel.json...')
const vercelConfigPath = path.join(process.cwd(), 'vercel.json')

if (fs.existsSync(vercelConfigPath)) {
  const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'))
  
  if (vercelConfig.crons && vercelConfig.crons.length > 0) {
    // Update cron path with proper secret
    vercelConfig.crons[0].path = vercelConfig.crons[0].path.replace(
      'secret=your-secret-here',
      `secret=${process.env.CRON_SECRET || 'generated-secret'}`
    )
    
    fs.writeFileSync(vercelConfigPath, JSON.stringify(vercelConfig, null, 2))
    console.log('✅ vercel.json updated with cron secret')
  }
}

// Database migration instructions
console.log('\n📊 Database Setup Instructions:')
console.log('1. Run the migration script:')
console.log('   psql -d your_database -f database/migrations/008_api_key_expiration.sql')
console.log('')
console.log('2. Or if using Supabase Dashboard:')
console.log('   - Go to SQL Editor')
console.log('   - Copy and paste the contents of 008_api_key_expiration.sql')
console.log('   - Run the migration')

// Testing instructions
console.log('\n🧪 Testing Instructions:')
console.log('1. Run the test suite:')
console.log('   npm test src/lib/__tests__/api-key-expiration.test.ts')
console.log('')
console.log('2. Test the cron job manually:')
console.log('   curl -X POST http://localhost:3000/api/cron/api-keys \\')
console.log('     -H "Content-Type: application/json" \\')
console.log('     -d \'{"task": "all"}\'')
console.log('')
console.log('3. Test API key creation:')
console.log('   Navigate to /dashboard/settings/api and create a new API key')

// Deployment checklist
console.log('\n🚀 Deployment Checklist:')
console.log('☐ Database migration applied')
console.log('☐ Environment variables configured')
console.log('☐ Cron jobs configured (Vercel/other platform)')
console.log('☐ API endpoints tested')
console.log('☐ Email notifications configured (optional)')
console.log('☐ Monitoring/alerting setup')

// Configuration recommendations
console.log('\n⚡ Configuration Recommendations:')
console.log('1. Cron Job Frequency:')
console.log('   - Development: Every hour (0 * * * *)')
console.log('   - Production: Every 6 hours (0 */6 * * *)')
console.log('')
console.log('2. Default Expiration Periods:')
console.log('   - Development/Testing: 30 days')
console.log('   - Production: 90 days')
console.log('   - High-security: 30 days with auto-renewal')
console.log('')
console.log('3. Notification Settings:')
console.log('   - Expiration warning: 7 days before')
console.log('   - Auto-renewal: 7 days before expiration')
console.log('   - Failed notification retry: 24 hours')

// Security reminders
console.log('\n🔒 Security Reminders:')
console.log('• Keep CRON_SECRET secure and rotate regularly')
console.log('• Monitor audit logs for suspicious activity')
console.log('• Review expired keys quarterly')
console.log('• Use minimal permissions for API keys')
console.log('• Enable auto-renewal for production keys')
console.log('• Set up alerting for failed cron jobs')

console.log('\n✅ Setup complete! Your API Key Expiration System is ready.')
console.log('📖 See API_KEY_EXPIRATION_SYSTEM.md for detailed documentation.')

// Optional: Create a sample configuration file
const sampleConfig = {
  apiKeyExpiration: {
    defaultExpirationDays: 90,
    maxExpirationDays: 365,
    minExpirationDays: 1,
    warningDays: 7,
    autoRenewalEnabled: true,
    cronSchedule: "0 */6 * * *",
    emailNotifications: {
      enabled: false,
      senderEmail: "noreply@yourdomain.com",
      adminEmails: ["admin@yourdomain.com"]
    }
  }
}

const configPath = path.join(process.cwd(), 'api-key-config.json')
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2))
  console.log('\n📄 Sample configuration created: api-key-config.json')
}

console.log('\n🎉 Happy coding!')