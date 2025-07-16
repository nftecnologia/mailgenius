#!/bin/bash

# MailGenius Performance Test Runner
# Este script facilita a execução dos testes de performance

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Função para imprimir header
print_header() {
    echo ""
    echo "=============================================="
    echo "  MailGenius Performance Test Runner"
    echo "=============================================="
    echo ""
}

# Função para mostrar ajuda
show_help() {
    print_header
    echo "Uso: $0 [COMANDO] [OPÇÕES]"
    echo ""
    echo "COMANDOS:"
    echo "  quick           Testes rápidos (5-10 min)"
    echo "  critical        Testes críticos (10-20 min)"
    echo "  load            Testes de carga (20-30 min)"
    echo "  benchmark       Benchmarks (15-25 min)"
    echo "  2mm             Teste de 2MM contatos (30-45 min)"
    echo "  2mm-import      Teste de importação 2MM (10-15 min)"
    echo "  2mm-email       Teste de email 2MM (10-15 min)"
    echo "  2mm-database    Teste de banco 2MM (10-15 min)"
    echo "  all             Todos os testes (60-90 min)"
    echo "  list            Listar testes disponíveis"
    echo "  validate        Validar configuração"
    echo "  monitor         Iniciar monitoramento"
    echo ""
    echo "OPÇÕES:"
    echo "  -h, --help      Mostrar esta ajuda"
    echo "  -v, --verbose   Output detalhado"
    echo "  -r, --report    Gerar relatório"
    echo "  -p, --parallel  Executar em paralelo"
    echo "  -n, --no-monitor Desabilitar monitoramento"
    echo ""
    echo "EXEMPLOS:"
    echo "  $0 quick                 # Executa testes rápidos"
    echo "  $0 2mm --report          # Executa teste 2MM com relatório"
    echo "  $0 load --parallel       # Executa testes de carga em paralelo"
    echo "  $0 critical --verbose    # Executa testes críticos com output detalhado"
    echo ""
}

# Função para verificar dependências
check_dependencies() {
    print_message $BLUE "🔍 Verificando dependências..."
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        print_message $RED "❌ Node.js não encontrado. Instale Node.js 18+"
        exit 1
    fi
    
    # Verificar versão do Node.js
    NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_message $RED "❌ Node.js 18+ requerido. Versão atual: $(node -v)"
        exit 1
    fi
    
    # Verificar npm
    if ! command -v npm &> /dev/null; then
        print_message $RED "❌ npm não encontrado"
        exit 1
    fi
    
    # Verificar tsx
    if ! command -v npx &> /dev/null; then
        print_message $RED "❌ npx não encontrado"
        exit 1
    fi
    
    print_message $GREEN "✅ Dependências verificadas"
}

# Função para verificar serviços
check_services() {
    print_message $BLUE "🔍 Verificando serviços..."
    
    # Verificar PostgreSQL
    if ! nc -z localhost 5432; then
        print_message $YELLOW "⚠️ PostgreSQL não está rodando em localhost:5432"
        print_message $YELLOW "   Certifique-se de que o banco está ativo para testes completos"
    fi
    
    # Verificar Redis
    if ! nc -z localhost 6379; then
        print_message $YELLOW "⚠️ Redis não está rodando em localhost:6379"
        print_message $YELLOW "   Certifique-se de que o Redis está ativo para testes completos"
    fi
    
    print_message $GREEN "✅ Verificação de serviços concluída"
}

# Função para preparar ambiente
prepare_environment() {
    print_message $BLUE "🔧 Preparando ambiente de testes..."
    
    # Criar diretório de relatórios
    mkdir -p performance-reports
    
    # Limpar relatórios antigos (manter apenas últimos 10)
    find performance-reports -name "*.html" -mtime +7 -delete 2>/dev/null || true
    
    # Verificar variáveis de ambiente
    if [ -z "$DATABASE_URL" ]; then
        export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mailgenius_test"
    fi
    
    if [ -z "$REDIS_URL" ]; then
        export REDIS_URL="redis://localhost:6379"
    fi
    
    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV="test"
    fi
    
    print_message $GREEN "✅ Ambiente preparado"
}

# Função para executar teste
run_test() {
    local test_type=$1
    local options=$2
    
    print_message $BLUE "🚀 Executando testes: $test_type"
    print_message $YELLOW "⏱️ Isso pode demorar alguns minutos..."
    
    case $test_type in
        "quick")
            npm run performance:test:quick $options
            ;;
        "critical")
            npm run performance:test:critical $options
            ;;
        "load")
            npm run performance:test:load $options
            ;;
        "benchmark")
            npm run performance:test:benchmark $options
            ;;
        "2mm")
            npm run performance:test:2mm $options
            ;;
        "2mm-import")
            npm run performance:test:2mm:import $options
            ;;
        "2mm-email")
            npm run performance:test:2mm:email $options
            ;;
        "2mm-database")
            npm run performance:test:2mm:database $options
            ;;
        "all")
            npm run performance:test:all $options
            ;;
        "list")
            npm run performance:list
            ;;
        "validate")
            npm run performance:validate
            ;;
        "monitor")
            npm run performance:monitor
            ;;
        *)
            print_message $RED "❌ Teste desconhecido: $test_type"
            show_help
            exit 1
            ;;
    esac
}

# Função para mostrar resumo final
show_summary() {
    print_message $GREEN "✅ Testes de performance concluídos!"
    echo ""
    
    # Verificar se há relatórios
    if [ -d "performance-reports" ] && [ "$(ls -A performance-reports)" ]; then
        print_message $BLUE "📊 Relatórios gerados:"
        ls -la performance-reports/ | grep -E '\.(html|json)$' | tail -5
        echo ""
        
        # Mostrar último relatório HTML
        LATEST_HTML=$(ls -t performance-reports/*.html 2>/dev/null | head -1)
        if [ -n "$LATEST_HTML" ]; then
            print_message $BLUE "📄 Último relatório: $LATEST_HTML"
            print_message $YELLOW "   Abra no navegador para visualizar os resultados"
        fi
    fi
    
    echo ""
    print_message $BLUE "🔗 Recursos úteis:"
    echo "  - Documentação: src/tests/performance/README.md"
    echo "  - Troubleshooting: docs/TROUBLESHOOTING.md"
    echo "  - Monitoring: docs/MONITORING_GUIDE.md"
    echo ""
}

# Função principal
main() {
    # Verificar se há argumentos
    if [ $# -eq 0 ]; then
        show_help
        exit 1
    fi
    
    # Parse dos argumentos
    local command=""
    local options=""
    local verbose=false
    local report=true
    local parallel=false
    local monitor=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                options="$options --verbose"
                shift
                ;;
            -r|--report)
                report=true
                options="$options --report"
                shift
                ;;
            -p|--parallel)
                parallel=true
                options="$options --parallel"
                shift
                ;;
            -n|--no-monitor)
                monitor=false
                options="$options --no-monitor"
                shift
                ;;
            *)
                if [ -z "$command" ]; then
                    command=$1
                else
                    print_message $RED "❌ Comando desconhecido: $1"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Adicionar opções padrão
    if [ "$monitor" = true ]; then
        options="$options --monitor"
    fi
    
    if [ "$report" = true ]; then
        options="$options --report"
    fi
    
    # Executar
    print_header
    
    # Verificações iniciais
    if [ "$command" != "list" ] && [ "$command" != "validate" ]; then
        check_dependencies
        check_services
        prepare_environment
    fi
    
    # Executar teste
    if run_test "$command" "$options"; then
        if [ "$command" != "list" ] && [ "$command" != "validate" ] && [ "$command" != "monitor" ]; then
            show_summary
        fi
    else
        print_message $RED "❌ Teste falhou!"
        exit 1
    fi
}

# Executar função principal
main "$@"