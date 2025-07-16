# MailGenius Performance Tests

Sistema completo de testes de performance para validar que o MailGenius suporta 2MM+ contatos com performance adequada.

## 🚀 Visão Geral

Este sistema de testes de performance foi desenvolvido para validar que o MailGenius pode lidar com:

- ✅ **2MM+ contatos** - Importação e gestão de grandes volumes
- ✅ **Envio de emails em escala** - 500+ emails/segundo sustentados
- ✅ **Operações de banco otimizadas** - Queries eficientes para grandes datasets
- ✅ **Workers paralelos** - Processamento distribuído e escalável
- ✅ **Sistema de filas robusto** - Gestão de 50K+ jobs simultâneos
- ✅ **Monitoramento em tempo real** - Métricas detalhadas de performance
- ✅ **Relatórios automáticos** - Análise completa de resultados

## 📋 Estrutura do Projeto

```
src/tests/performance/
├── config.ts                          # Configurações centralizadas
├── data-generator.ts                   # Gerador de dados de teste
├── load-tests/                         # Testes de carga
│   ├── contact-import.test.ts         # Importação de 2MM contatos
│   ├── email-performance.test.ts      # Performance de envio
│   ├── worker-parallel.test.ts        # Workers paralelos
│   └── queue-stress.test.ts           # Stress do sistema de filas
├── benchmarks/                        # Benchmarks de performance
│   └── database-benchmark.test.ts     # Benchmark de banco
├── monitoring/                        # Monitoramento
│   └── performance-monitor.ts         # Monitor de performance
├── reports/                           # Relatórios
│   └── report-generator.ts           # Gerador de relatórios
├── runners/                           # Executores de teste
│   └── load-test-runner.ts           # Runner principal
└── scripts/                           # Scripts de execução
    ├── run-tests.ts                   # Script principal
    └── load-test-2mm.ts              # Teste específico 2MM
```

## 🛠️ Instalação

```bash
# Instalar dependências
npm install

# Verificar configuração
npm run performance:validate

# Listar testes disponíveis
npm run performance:list
```

## 📊 Execução dos Testes

### **Testes Rápidos (5-10 minutos)**

```bash
# Testes críticos básicos
npm run performance:test:critical

# Testes rápidos de validação
npm run performance:test:quick
```

### **Testes Completos (30-60 minutos)**

```bash
# Suite completa de testes
npm run performance:test:all

# Testes de carga específicos
npm run performance:test:load

# Benchmarks de performance
npm run performance:test:benchmark
```

### **Teste Específico de 2MM Contatos**

```bash
# Teste completo de 2MM contatos (30-45 minutos)
npm run performance:test:2mm

# Teste específico de importação
npm run performance:test:2mm:import

# Teste específico de envio de emails
npm run performance:test:2mm:email

# Teste específico de banco de dados
npm run performance:test:2mm:database
```

### **Testes Individuais**

```bash
# Executar teste específico
npm run performance:test -- --scenario contact-import

# Executar com configuração personalizada
npm run performance:test -- --scenario email-performance --concurrency 100

# Executar em paralelo
npm run performance:test -- --suite load --parallel

# Executar sem monitoramento
npm run performance:test -- --suite quick --no-monitor
```

## 🎯 Cenários de Teste

### **1. Importação de 2MM Contatos**
- **Objetivo**: Validar capacidade de importar 2MM contatos
- **Métricas**: Tempo de processamento, uso de memória, throughput
- **Thresholds**: < 5s por batch, < 85% memória, > 10 batches/s

### **2. Performance de Envio de Emails**
- **Objetivo**: Sustentar 500+ emails/segundo
- **Métricas**: Taxa de envio, latência, taxa de erro
- **Thresholds**: > 500 emails/s, < 2s latência, < 2% erro

### **3. Workers Paralelos**
- **Objetivo**: Escalabilidade horizontal
- **Métricas**: Distribuição de carga, tempo de resposta
- **Thresholds**: Balanceamento uniforme, < 1s resposta

### **4. Stress do Sistema de Filas**
- **Objetivo**: Processar 50K+ jobs
- **Métricas**: Throughput, latência, uso de Redis
- **Thresholds**: > 1000 jobs/s, < 500ms latência

### **5. Benchmark de Banco**
- **Objetivo**: Operações eficientes em grandes datasets
- **Métricas**: Tempo de query, uso de índices, conexões
- **Thresholds**: < 1s queries, < 200 conexões

## 📈 Interpretação dos Resultados

### **Métricas Principais**

| Métrica | Valor Alvo | Crítico |
|---------|-----------|---------|
| **Importação** | < 5s/batch | > 10s/batch |
| **Envio de Emails** | > 500/s | < 100/s |
| **Resposta da API** | < 2s | > 5s |
| **Uso de CPU** | < 80% | > 90% |
| **Uso de Memória** | < 85% | > 95% |
| **Taxa de Erro** | < 5% | > 10% |

### **Scores de Performance**

- **A (90-100%)**: Excelente performance, sistema otimizado
- **B (80-89%)**: Boa performance, pequenas otimizações
- **C (70-79%)**: Performance aceitável, requer melhorias
- **D (60-69%)**: Performance abaixo do esperado
- **F (< 60%)**: Performance crítica, intervenção necessária

## 🔧 Configuração Avançada

### **Variáveis de Ambiente**

```bash
# Configurações de teste
PERFORMANCE_TEST_CONTACTS=2000000
PERFORMANCE_TEST_CONCURRENCY=50
PERFORMANCE_TEST_DURATION=1800000

# Configurações de monitoramento
PERFORMANCE_METRICS_INTERVAL=5000
PERFORMANCE_ALERTS_ENABLED=true
PERFORMANCE_DETAILED_METRICS=true

# Configurações de relatórios
PERFORMANCE_REPORTS_DIR=./performance-reports
PERFORMANCE_REPORT_FORMATS=html,json,csv
```

### **Arquivo de Configuração**

```typescript
// src/tests/performance/config.custom.ts
export const CUSTOM_PERFORMANCE_CONFIG = {
  contactImport: {
    batchSize: 10000,
    maxConcurrency: 100,
    timeoutMs: 30000
  },
  emailSending: {
    targetThroughput: 500,
    maxLatency: 2000,
    errorThreshold: 0.02
  },
  monitoring: {
    metricsInterval: 5000,
    alertThresholds: {
      cpuUsage: 80,
      memoryUsage: 85,
      responseTime: 5000
    }
  }
};
```

## 📊 Relatórios

### **Formatos de Relatório**

1. **HTML** - Relatório visual completo
2. **JSON** - Dados estruturados para análise
3. **CSV** - Dados para planilhas
4. **Executive Summary** - Resumo executivo

### **Localização dos Relatórios**

```
performance-reports/
├── 2mm-contact-load-test-1234567890.html
├── 2mm-contact-load-test-1234567890.json
├── 2mm-contact-load-test-1234567890.csv
└── 2mm-contact-load-test-1234567890-executive-summary.md
```

### **Acesso aos Relatórios**

```bash
# Gerar relatório específico
npm run performance:report

# Abrir relatório no navegador
open performance-reports/latest.html

# Comparar relatórios
npm run performance:report -- --compare previous.json current.json
```

## 🚨 Monitoramento e Alertas

### **Alertas Automáticos**

- **CPU > 90%** - Alerta crítico
- **Memória > 95%** - Alerta crítico
- **Latência > 10s** - Alerta de performance
- **Taxa de erro > 10%** - Alerta de qualidade

### **Monitoramento em Tempo Real**

```bash
# Iniciar monitoramento
npm run performance:monitor

# Dashboard de monitoramento
npm run dev
# Acesse: http://localhost:3000/dashboard/performance
```

## 🔍 Troubleshooting

### **Problemas Comuns**

#### **1. Memória Insuficiente**
```bash
# Aumentar limite de memória
export NODE_OPTIONS="--max-old-space-size=8192"
npm run performance:test:2mm
```

#### **2. Timeout de Teste**
```bash
# Aumentar timeout
npm run performance:test -- --timeout 1200000
```

#### **3. Conexões de Banco**
```bash
# Verificar pool de conexões
npm run performance:test -- --scenario database-benchmark --verbose
```

### **Logs de Debug**

```bash
# Logs detalhados
DEBUG=performance:* npm run performance:test:2mm

# Logs específicos
DEBUG=performance:database npm run performance:test:benchmark
```

## 📚 Recursos Adicionais

### **Documentação Relacionada**

- [System Architecture](../../docs/SYSTEM_ARCHITECTURE.md)
- [Performance Configuration](../../docs/PERFORMANCE_CONFIGURATION.md)
- [Monitoring Guide](../../docs/MONITORING_GUIDE.md)
- [Troubleshooting](../../docs/TROUBLESHOOTING.md)

### **Scripts Úteis**

```bash
# Validar configuração
npm run performance:validate

# Listar testes disponíveis
npm run performance:list

# Monitorar recursos
npm run performance:monitor

# Gerar relatório
npm run performance:report
```

### **Integração CI/CD**

```yaml
# .github/workflows/performance.yml
name: Performance Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run critical performance tests
        run: npm run ci:performance
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: performance-reports
          path: performance-reports/
```

## 🎯 Validação de 2MM Contatos

### **Critérios de Sucesso**

Para validar que o sistema suporta 2MM contatos com performance adequada:

1. ✅ **Importação** - Processar 2MM contatos em < 30 minutos
2. ✅ **Envio** - Sustentar 500+ emails/segundo
3. ✅ **Banco** - Queries < 1 segundo em dataset de 2MM
4. ✅ **Recursos** - CPU < 80%, Memória < 85%
5. ✅ **Disponibilidade** - Taxa de erro < 5%

### **Comando de Validação**

```bash
# Validação completa de 2MM contatos
npm run performance:test:2mm

# Resultado esperado:
# ✅ 2MM Contact Support: VALIDATED
```

---

## 📞 Suporte

Para questões sobre os testes de performance:

- **Documentação**: [docs/PERFORMANCE_CONFIGURATION.md](../../docs/PERFORMANCE_CONFIGURATION.md)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md)
- **Monitoring**: [docs/MONITORING_GUIDE.md](../../docs/MONITORING_GUIDE.md)

---

**Atualizado**: 2024-07-16  
**Versão**: 2.0  
**Autor**: Performance Team  
**Status**: Produção Ready