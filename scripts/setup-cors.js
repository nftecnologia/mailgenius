#!/usr/bin/env node

/**
 * Script de setup para configuração de CORS
 * 
 * Execute: node scripts/setup-cors.js
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const envPath = path.join(__dirname, '../.env')
const envExamplePath = path.join(__dirname, '../.env.example')

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

function createEnvFile(config) {
  const envContent = `# Environment Configuration
NODE_ENV=${config.environment}

# Application URLs
NEXT_PUBLIC_APP_URL=${config.appUrl}
NEXT_PUBLIC_API_URL=${config.apiUrl}

# CORS Configuration
CORS_DEVELOPMENT_DOMAINS=${config.devDomains}
CORS_PRODUCTION_DOMAINS=${config.prodDomains}
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
CORS_PREFLIGHT_MAX_AGE=3600

# Security Settings
SECURITY_BLOCK_SUSPICIOUS_USER_AGENTS=true
SECURITY_VALIDATE_CONTENT_TYPE=true
SECURITY_RATE_LIMIT_REQUESTS=1000
SECURITY_RATE_LIMIT_WINDOW=3600000

# Supabase Configuration (adicione suas chaves)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# API Keys (adicione suas chaves)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
RESEND_API_KEY=your_resend_api_key

# Database
DATABASE_URL=your_database_url
`

  fs.writeFileSync(envPath, envContent)
}

function validateDomain(domain) {
  try {
    new URL(domain)
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log('🔒 Configuração de CORS para MailGenius')
  console.log('=====================================\n')

  // Verificar se já existe .env
  if (fs.existsSync(envPath)) {
    const overwrite = await askQuestion('.env já existe. Deseja sobrescrever? (y/N): ')
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Configuração cancelada.')
      rl.close()
      return
    }
  }

  // Ambiente
  const environment = await askQuestion('Ambiente (development/production) [development]: ') || 'development'
  
  // URLs da aplicação
  const appUrl = await askQuestion('URL da aplicação [http://localhost:3000]: ') || 'http://localhost:3000'
  const apiUrl = await askQuestion('URL da API [http://localhost:3000/api]: ') || 'http://localhost:3000/api'

  // Domínios de desenvolvimento
  let devDomains = await askQuestion('Domínios de desenvolvimento (separados por vírgula) [http://localhost:3000,http://localhost:3001]: ')
  if (!devDomains) {
    devDomains = 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001'
  }

  // Validar domínios de desenvolvimento
  const devDomainsArray = devDomains.split(',').map(d => d.trim())
  const invalidDevDomains = devDomainsArray.filter(d => !validateDomain(d))
  if (invalidDevDomains.length > 0) {
    console.log(`❌ Domínios de desenvolvimento inválidos: ${invalidDevDomains.join(', ')}`)
    rl.close()
    return
  }

  // Domínios de produção
  let prodDomains = await askQuestion('Domínios de produção (separados por vírgula): ')
  if (!prodDomains) {
    prodDomains = 'https://mailgenius.com,https://www.mailgenius.com,https://app.mailgenius.com'
  }

  // Validar domínios de produção
  const prodDomainsArray = prodDomains.split(',').map(d => d.trim())
  const invalidProdDomains = prodDomainsArray.filter(d => !validateDomain(d))
  if (invalidProdDomains.length > 0) {
    console.log(`❌ Domínios de produção inválidos: ${invalidProdDomains.join(', ')}`)
    rl.close()
    return
  }

  // Criar arquivo .env
  createEnvFile({
    environment,
    appUrl,
    apiUrl,
    devDomains,
    prodDomains
  })

  console.log('\n✅ Configuração de CORS criada com sucesso!')
  console.log(`📁 Arquivo criado: ${envPath}`)
  
  console.log('\n📋 Próximos passos:')
  console.log('1. Adicione suas chaves de API no arquivo .env')
  console.log('2. Configure as URLs do Supabase')
  console.log('3. Execute npm run dev para testar')
  console.log('4. Monitore CORS no painel de admin')

  console.log('\n🔍 Para testar a configuração:')
  console.log('npm run dev')
  console.log('# Em outro terminal:')
  console.log('curl -H "Origin: http://localhost:3000" http://localhost:3000/api/cors/info')

  console.log('\n📚 Documentação completa: docs/CORS_SECURITY.md')

  rl.close()
}

// Verificar se o script está sendo executado diretamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main, validateDomain }