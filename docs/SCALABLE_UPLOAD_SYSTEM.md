# Sistema de Upload Escalável - MailGenius

## Visão Geral

Este sistema de upload escalável foi desenvolvido para processar arquivos grandes (até 100MB) de forma eficiente, com suporte a streaming, chunking e processamento assíncrono. Ele é especialmente otimizado para importação de leads em massa, podendo processar mais de 500.000 registros por arquivo.

## Características Principais

### 1. **Streaming de Upload**
- Suporte a arquivos até 100MB
- Upload em chunks de 1MB para otimizar transferência
- Controle de concorrência (máximo 3 chunks simultâneos)
- Retry automático para chunks falhos

### 2. **Processamento Assíncrono**
- Processamento em lotes de 1000 registros
- Validação assíncrona de dados
- Processamento concorrente de até 5 lotes
- Controle de progresso em tempo real

### 3. **Validação Robusta**
- Validação de email obrigatória
- Validação de telefone opcional
- Campos customizáveis
- Detecção e tratamento de duplicatas

### 4. **Monitoramento Completo**
- Dashboard de monitoramento em tempo real
- Métricas de performance
- Logs detalhados de progresso
- Alertas de erro e status

### 5. **Armazenamento Otimizado**
- Armazenamento temporário com limpeza automática
- Compressão de dados
- Deduplicação por hash
- Expiração automática de uploads

## Arquitetura

### Banco de Dados

O sistema utiliza 5 tabelas principais:

1. **`file_upload_jobs`** - Metadados do upload
2. **`file_upload_chunks`** - Controle de chunks
3. **`processing_batches`** - Lotes de processamento
4. **`upload_progress_events`** - Eventos de progresso
5. **`temp_validation_data`** - Dados temporários de validação

### Fluxo de Dados

```
[Upload] → [Chunking] → [Reassembly] → [Validation] → [Processing] → [Import]
```

### Componentes

1. **`UploadService`** - Serviço principal de upload
2. **`CSVProcessor`** - Processador de CSV assíncrono
3. **`ScalableUploader`** - Componente React de upload
4. **`UploadMonitoringDashboard`** - Dashboard de monitoramento
5. **`useScalableUpload`** - Hook personalizado

## Configuração

### 1. Aplicar Migração

```bash
node scripts/apply-upload-migration.js
```

### 2. Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Upload Settings (opcionais)
UPLOAD_MAX_FILE_SIZE=104857600  # 100MB
UPLOAD_CHUNK_SIZE=1048576       # 1MB
UPLOAD_MAX_CONCURRENT=3
UPLOAD_BATCH_SIZE=1000
```

### 3. Instalar Dependências

```bash
npm install csv-parse csv-stringify stream-transform react-dropzone multer
npm install -D @types/multer
```

## Uso

### Upload Básico

```typescript
import { ScalableUploader } from '@/components/upload/ScalableUploader';

function MyComponent() {
  const handleUploadComplete = (result) => {
    console.log(`Imported ${result.leads_created} leads`);
  };

  return (
    <ScalableUploader
      onUploadComplete={handleUploadComplete}
      uploadType="leads_import"
      maxFileSize={104857600} // 100MB
    />
  );
}
```

### Hook Personalizado

```typescript
import { useScalableUpload } from '@/lib/hooks/useScalableUpload';

function MyComponent() {
  const {
    startUpload,
    uploadProgress,
    processingStats,
    isUploading,
    isProcessing,
    error
  } = useScalableUpload({
    uploadType: 'leads_import',
    onUploadComplete: (result) => {
      console.log('Upload completed:', result);
    }
  });

  const handleFileSelect = (file) => {
    startUpload(file, {
      required_fields: ['email'],
      email_validation: true,
      max_records: 500000
    });
  };

  return (
    <div>
      <input type="file" onChange={handleFileSelect} />
      {uploadProgress && (
        <div>Progress: {uploadProgress.upload_progress}%</div>
      )}
    </div>
  );
}
```

## API Endpoints

### 1. Criar Upload Job

```http
POST /api/upload/create
Content-Type: application/json

{
  "filename": "leads.csv",
  "file_size": 50000000,
  "file_type": "text/csv",
  "upload_type": "leads_import",
  "chunk_size": 1048576,
  "validation_rules": {
    "required_fields": ["email"],
    "email_validation": true,
    "max_records": 500000
  }
}
```

### 2. Upload Chunk

```http
POST /api/upload/{jobId}/chunk/{chunkIndex}
Content-Type: application/octet-stream

[chunk data]
```

### 3. Iniciar Processamento

```http
POST /api/upload/{jobId}/process
Content-Type: application/json

{
  "csv_config": {
    "columns": [...],
    "field_mapping": {...},
    "skip_header": true,
    "delimiter": ","
  },
  "import_config": {
    "duplicate_handling": "skip",
    "default_tags": ["imported"],
    "source": "csv_import"
  }
}
```

### 4. Progresso do Upload

```http
GET /api/upload/{jobId}/progress
```

### 5. Monitoramento

```http
GET /api/upload/monitoring?action=stats
GET /api/upload/monitoring?action=health
```

## Limitações e Capacidades

### Capacidades

- **Tamanho máximo do arquivo**: 100MB
- **Registros por arquivo**: 500,000+
- **Throughput**: ~1000 registros/segundo
- **Concorrência**: 3 chunks simultâneos
- **Lotes**: 1000 registros por lote
- **Retenção**: 24 horas para arquivos temporários

### Limitações

- Apenas arquivos CSV são suportados
- Requer JavaScript habilitado
- Dependente de conexão estável
- Armazenamento temporário limitado

## Monitoramento

### Dashboard

O dashboard de monitoramento fornece:

- Status do sistema em tempo real
- Métricas de performance
- Uploads ativos e em fila
- Taxa de erro e tempo médio
- Histórico de uploads recentes

### Métricas

- **Uploads ativos**: Número de uploads em andamento
- **Fila de uploads**: Uploads aguardando processamento
- **Taxa de sucesso**: Porcentagem de uploads bem-sucedidos
- **Tempo médio**: Tempo médio de upload e processamento
- **Uso de armazenamento**: Espaço utilizado pelos uploads

### Alertas

- Uploads com falha
- Sistema sobrecarregado
- Armazenamento esgotado
- Erros de validação

## Troubleshooting

### Problemas Comuns

1. **Chunk upload falha**
   - Verificar conexão de rede
   - Tentar novamente automaticamente
   - Verificar logs de erro

2. **Processamento lento**
   - Verificar recursos do servidor
   - Ajustar tamanho do lote
   - Verificar índices do banco

3. **Validação falha**
   - Verificar formato dos dados
   - Confirmar mapeamento de campos
   - Revisar regras de validação

### Logs

```typescript
// Habilitar logs detalhados
logger.level = 'debug';

// Monitorar eventos de progresso
await supabase
  .from('upload_progress_events')
  .select('*')
  .eq('upload_job_id', jobId)
  .order('created_at', { ascending: false });
```

### Limpeza

```javascript
// Limpar uploads expirados
const deletedCount = await uploadService.cleanupExpiredUploads();
console.log(`Cleaned up ${deletedCount} expired uploads`);
```

## Otimizações

### Performance

1. **Chunk size**: 1MB oferece melhor balance
2. **Concorrência**: 3 chunks simultâneos evita sobrecarga
3. **Batch size**: 1000 registros otimiza memória
4. **Índices**: Criados automaticamente na migração

### Escabilidade

1. **Processamento assíncrono**: Evita timeouts
2. **Lotes concorrentes**: Acelera processamento
3. **Validação em stream**: Reduz uso de memória
4. **Cleanup automático**: Mantém sistema limpo

## Segurança

### Validação

- Validação de tipo de arquivo
- Limite de tamanho rigoroso
- Sanitização de dados
- Verificação de permissões

### Isolamento

- RLS (Row Level Security) habilitado
- Dados por workspace
- Sessões isoladas
- Cleanup automático

## Manutenção

### Rotinas

1. **Cleanup diário** de uploads expirados
2. **Monitoramento** de métricas
3. **Backup** de dados importantes
4. **Análise** de performance

### Atualizações

1. Monitorar versões das dependências
2. Testar em ambiente de desenvolvimento
3. Aplicar patches de segurança
4. Atualizar documentação

## Roadmap

### Próximas Funcionalidades

1. **Suporte a mais formatos**: Excel, JSON
2. **Compressão avançada**: Gzip, Brotli
3. **Cache inteligente**: Redis
4. **Webhooks**: Notificações de progresso
5. **Agendamento**: Imports programados

### Melhorias

1. **UI/UX**: Interface mais intuitiva
2. **Performance**: Otimizações de velocidade
3. **Monitoramento**: Métricas avançadas
4. **Relatórios**: Análises detalhadas