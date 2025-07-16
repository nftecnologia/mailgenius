#!/usr/bin/env node

/**
 * Script para testar configuração de CORS
 * 
 * Execute: node scripts/test-cors.js
 */

const https = require('https')
const http = require('http')
const { URL } = require('url')

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : http
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        })
      })
    })

    req.on('error', reject)
    req.on('timeout', () => reject(new Error('Request timeout')))
    
    if (options.body) {
      req.write(options.body)
    }
    
    req.end()
  })
}

async function testCORS(baseUrl) {
  log(`\n🔒 Testando CORS para: ${baseUrl}`, 'blue')
  log('=' + '='.repeat(50), 'blue')

  const tests = [
    {
      name: 'Preflight Request (OPTIONS)',
      url: `${baseUrl}/api/cors/info`,
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    },
    {
      name: 'CORS Info Endpoint',
      url: `${baseUrl}/api/cors/info`,
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000',
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Origem Não Permitida',
      url: `${baseUrl}/api/cors/info`,
      method: 'GET',
      headers: {
        'Origin': 'http://malicious.com',
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Sem Cabeçalho Origin',
      url: `${baseUrl}/api/cors/info`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Validação de Origem',
      url: `${baseUrl}/api/cors/info`,
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:3000',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origin: 'http://localhost:3000'
      })
    }
  ]

  const results = []

  for (const test of tests) {
    try {
      log(`\n📋 Teste: ${test.name}`, 'yellow')
      
      const response = await makeRequest(test.url, {
        method: test.method,
        headers: test.headers,
        body: test.body
      })

      const corsHeaders = {
        'access-control-allow-origin': response.headers['access-control-allow-origin'],
        'access-control-allow-methods': response.headers['access-control-allow-methods'],
        'access-control-allow-headers': response.headers['access-control-allow-headers'],
        'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
        'access-control-max-age': response.headers['access-control-max-age']
      }

      const securityHeaders = {
        'x-content-type-options': response.headers['x-content-type-options'],
        'x-frame-options': response.headers['x-frame-options'],
        'x-xss-protection': response.headers['x-xss-protection'],
        'referrer-policy': response.headers['referrer-policy']
      }

      const result = {
        test: test.name,
        status: response.status,
        success: response.status < 400,
        corsHeaders,
        securityHeaders,
        hasOriginHeader: !!corsHeaders['access-control-allow-origin'],
        hasSecurityHeaders: !!securityHeaders['x-content-type-options']
      }

      results.push(result)

      // Exibir resultado
      if (result.success) {
        log(`✅ Status: ${response.status}`, 'green')
      } else {
        log(`❌ Status: ${response.status}`, 'red')
      }

      if (result.hasOriginHeader) {
        log(`🎯 Origin: ${corsHeaders['access-control-allow-origin']}`, 'green')
      }

      if (result.hasSecurityHeaders) {
        log(`🔒 Security Headers: OK`, 'green')
      }

      // Mostrar dados de resposta se for JSON
      if (response.headers['content-type']?.includes('application/json')) {
        try {
          const jsonData = JSON.parse(response.data)
          if (jsonData.success === false) {
            log(`❌ Erro: ${jsonData.error?.message || 'Erro desconhecido'}`, 'red')
          }
        } catch (e) {
          // Não é JSON válido
        }
      }

    } catch (error) {
      log(`❌ Erro: ${error.message}`, 'red')
      results.push({
        test: test.name,
        error: error.message,
        success: false
      })
    }
  }

  return results
}

function generateReport(results) {
  log('\n📊 Relatório de Testes CORS', 'bold')
  log('=' + '='.repeat(40), 'blue')

  const totalTests = results.length
  const passedTests = results.filter(r => r.success).length
  const failedTests = totalTests - passedTests

  log(`\n📈 Resumo:`, 'bold')
  log(`   Total de testes: ${totalTests}`)
  log(`   ✅ Aprovados: ${passedTests}`, 'green')
  log(`   ❌ Reprovados: ${failedTests}`, failedTests > 0 ? 'red' : 'green')
  log(`   📊 Taxa de sucesso: ${((passedTests / totalTests) * 100).toFixed(1)}%`)

  log(`\n📋 Detalhes dos testes:`, 'bold')
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌'
    const color = result.success ? 'green' : 'red'
    log(`   ${icon} ${result.test}`, color)
    
    if (result.error) {
      log(`      Erro: ${result.error}`, 'red')
    }
    
    if (result.status) {
      log(`      Status: ${result.status}`)
    }
  })

  log(`\n🔍 Verificações de Segurança:`, 'bold')
  
  const securityChecks = {
    'CORS Headers': results.some(r => r.hasOriginHeader),
    'Security Headers': results.some(r => r.hasSecurityHeaders),
    'Origin Validation': results.some(r => r.test.includes('Não Permitida') && !r.success),
    'Preflight Support': results.some(r => r.test.includes('Preflight') && r.success)
  }

  Object.entries(securityChecks).forEach(([check, passed]) => {
    const icon = passed ? '✅' : '❌'
    const color = passed ? 'green' : 'red'
    log(`   ${icon} ${check}`, color)
  })

  log('\n💡 Recomendações:', 'bold')
  
  if (failedTests > 0) {
    log('   • Verifique a configuração de CORS no arquivo .env', 'yellow')
    log('   • Confirme se o servidor está rodando', 'yellow')
    log('   • Valide os domínios permitidos', 'yellow')
  }
  
  if (!securityChecks['Security Headers']) {
    log('   • Configure headers de segurança no next.config.js', 'yellow')
  }
  
  if (!securityChecks['Origin Validation']) {
    log('   • Implemente validação de origem mais rigorosa', 'yellow')
  }

  log('\n📚 Para mais informações, consulte: docs/CORS_SECURITY.md', 'blue')
}

async function main() {
  const args = process.argv.slice(2)
  const baseUrl = args[0] || 'http://localhost:3000'

  log('🔒 Teste de Configuração CORS - MailGenius', 'bold')
  log('=' + '='.repeat(50), 'blue')

  try {
    const results = await testCORS(baseUrl)
    generateReport(results)
  } catch (error) {
    log(`❌ Erro fatal: ${error.message}`, 'red')
    process.exit(1)
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { testCORS, generateReport }