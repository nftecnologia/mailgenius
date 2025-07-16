# Guia de Execução - Testes de Performance

## 🚀 Comandos Principais

### **Testes Rápidos (5-10 minutos)**
```bash
npm run performance:test:quick
```

### **Testes Críticos (10-20 minutos)**
```bash
npm run performance:test:critical
```

### **Teste de 2MM Contatos (30-45 minutos)**
```bash
npm run performance:test:2mm
```

### **Testes Específicos de 2MM**
```bash
# Importação de 2MM contatos
npm run performance:test:2mm:import

# Envio de emails para 2MM
npm run performance:test:2mm:email  

# Operações de banco com 2MM
npm run performance:test:2mm:database
```

### **Suites Completas**
```bash
# Todos os testes de carga
npm run performance:test:load

# Todos os benchmarks
npm run performance:test:benchmark

# Suite completa (60-90 minutos)
npm run performance:test:all
```

## 📊 Comandos Úteis

### **Listar Testes**
```bash
npm run performance:list
```

### **Validar Configuração**
```bash
npm run performance:validate
```

### **Monitoramento**
```bash
npm run performance:monitor
```

## 🎯 Validação de 2MM Contatos

Para validar que o sistema suporta 2MM contatos:

```bash
# Executa todos os testes de 2MM contatos
npm run performance:test:2mm

# Resultado esperado:
# ✅ 2MM Contact Support: VALIDATED
```

## 📈 Interpretação dos Resultados

### **Scores de Performance**
- **A (90-100%)**: Sistema otimizado para 2MM contatos
- **B (80-89%)**: Boa performance, pequenos ajustes
- **C (70-79%)**: Performance aceitável
- **D (60-69%)**: Requer otimizações
- **F (< 60%)**: Performance crítica

### **Métricas Críticas**
- **Importação**: < 5s por batch de 10K contatos
- **Envio**: > 500 emails/segundo sustentados
- **Banco**: < 1s para queries em 2MM registros
- **Recursos**: CPU < 80%, Memória < 85%

## 🔧 Configuração de Ambiente

### **Variáveis Necessárias**
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export REDIS_URL="redis://host:6379"
export NODE_ENV="test"
```

### **Recursos Mínimos**
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Disco**: 20GB+ livre
- **Rede**: Conexão estável

## 🚨 Solução de Problemas

### **Memória Insuficiente**
```bash
export NODE_OPTIONS="--max-old-space-size=8192"
npm run performance:test:2mm
```

### **Timeout de Testes**
```bash
npm run performance:test -- --timeout 1800000
```

### **Verificar Logs**
```bash
# Logs detalhados
DEBUG=performance:* npm run performance:test:critical

# Logs de erro
tail -f performance-reports/error.log
```

## 📊 Relatórios

Os relatórios são gerados automaticamente em:
- `performance-reports/` - Todos os relatórios
- `*.html` - Relatórios visuais
- `*.json` - Dados estruturados
- `*.csv` - Dados para análise

## 🎯 Critérios de Validação

### **Para 2MM Contatos**
1. ✅ Importação em < 30 minutos
2. ✅ Envio sustentado > 500/s
3. ✅ Queries de banco < 1s
4. ✅ Uso de CPU < 80%
5. ✅ Uso de RAM < 85%
6. ✅ Taxa de erro < 5%

### **Comando de Verificação**
```bash
npm run performance:test:2mm --report
```

Resultado esperado: **"2MM Contact Support: VALIDATED ✅"**