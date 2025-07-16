#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

const runCommand = (command, description) => {
  log(`\n🚀 ${description}`, 'cyan')
  log(`Command: ${command}`, 'blue')
  
  try {
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    log(`✅ ${description} completed successfully`, 'green')
    return true
  } catch (error) {
    log(`❌ ${description} failed`, 'red')
    return false
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const command = args[0] || 'all'
  
  log('🧪 MailGenius Test Runner', 'magenta')
  log('========================', 'magenta')
  
  switch (command) {
    case 'unit':
      log('Running unit tests only...', 'yellow')
      runCommand('npm test -- --testPathPattern="__tests__"', 'Unit tests')
      break
      
    case 'integration':
      log('Running integration tests only...', 'yellow')
      runCommand('npm test -- --testPathPattern="integration"', 'Integration tests')
      break
      
    case 'auth':
      log('Running authentication tests...', 'yellow')
      runCommand('npm test -- --testPathPattern="auth"', 'Authentication tests')
      break
      
    case 'api':
      log('Running API tests...', 'yellow')
      runCommand('npm test -- --testPathPattern="api"', 'API tests')
      break
      
    case 'components':
      log('Running component tests...', 'yellow')
      runCommand('npm test -- --testPathPattern="components"', 'Component tests')
      break
      
    case 'security':
      log('Running security tests...', 'yellow')
      runCommand('npm test -- --testPathPattern="(sanitize|validation|security)"', 'Security tests')
      break
      
    case 'coverage':
      log('Running tests with coverage report...', 'yellow')
      runCommand('npm run test:coverage', 'Coverage report')
      break
      
    case 'ci':
      log('Running CI tests...', 'yellow')
      runCommand('npm run test:ci', 'CI tests')
      break
      
    case 'watch':
      log('Running tests in watch mode...', 'yellow')
      runCommand('npm run test:watch', 'Watch mode')
      break
      
    case 'critical':
      log('Running critical functionality tests...', 'yellow')
      const criticalTests = [
        'npm test -- --testPathPattern="auth.*test"',
        'npm test -- --testPathPattern="hooks.*test"',
        'npm test -- --testPathPattern="api.*test"',
        'npm test -- --testPathPattern="sanitize.*test"',
        'npm test -- --testPathPattern="validation.*test"',
      ]
      
      let allPassed = true
      for (const test of criticalTests) {
        if (!runCommand(test, `Critical test: ${test}`)) {
          allPassed = false
        }
      }
      
      if (allPassed) {
        log('\n🎉 All critical tests passed!', 'green')
      } else {
        log('\n💥 Some critical tests failed!', 'red')
        process.exit(1)
      }
      break
      
    case 'all':
    default:
      log('Running all tests...', 'yellow')
      
      const testSuites = [
        { cmd: 'npm test -- --testPathPattern="auth"', name: 'Authentication' },
        { cmd: 'npm test -- --testPathPattern="components"', name: 'Components' },
        { cmd: 'npm test -- --testPathPattern="hooks"', name: 'Hooks' },
        { cmd: 'npm test -- --testPathPattern="api"', name: 'API' },
        { cmd: 'npm test -- --testPathPattern="validation"', name: 'Validation' },
        { cmd: 'npm test -- --testPathPattern="sanitize"', name: 'Sanitization' },
        { cmd: 'npm test -- --testPathPattern="rate-limit"', name: 'Rate Limiting' },
      ]
      
      let results = []
      
      for (const suite of testSuites) {
        const passed = runCommand(suite.cmd, suite.name)
        results.push({ name: suite.name, passed })
      }
      
      // Summary
      log('\n📊 Test Results Summary', 'magenta')
      log('======================', 'magenta')
      
      results.forEach(result => {
        const status = result.passed ? '✅ PASSED' : '❌ FAILED'
        const color = result.passed ? 'green' : 'red'
        log(`${result.name}: ${status}`, color)
      })
      
      const passedCount = results.filter(r => r.passed).length
      const totalCount = results.length
      
      log(`\nTotal: ${passedCount}/${totalCount} test suites passed`, 
          passedCount === totalCount ? 'green' : 'red')
      
      if (passedCount !== totalCount) {
        process.exit(1)
      }
      break
      
    case 'help':
      log('Available commands:', 'yellow')
      log('  all       - Run all tests (default)')
      log('  unit      - Run unit tests only')
      log('  integration - Run integration tests only')
      log('  auth      - Run authentication tests')
      log('  api       - Run API tests')
      log('  components - Run component tests')
      log('  security  - Run security tests')
      log('  coverage  - Run tests with coverage')
      log('  ci        - Run CI tests')
      log('  watch     - Run tests in watch mode')
      log('  critical  - Run critical functionality tests')
      log('  help      - Show this help message')
      break
      
    default:
      log(`Unknown command: ${command}`, 'red')
      log('Use "help" to see available commands', 'yellow')
      process.exit(1)
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log('Unhandled promise rejection:', 'red')
  console.error(error)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  log('Uncaught exception:', 'red')
  console.error(error)
  process.exit(1)
})

main().catch(error => {
  log('Script failed:', 'red')
  console.error(error)
  process.exit(1)
})