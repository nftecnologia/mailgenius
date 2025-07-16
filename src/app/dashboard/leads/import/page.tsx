'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Users,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'

interface CSVRow {
  [key: string]: string
}

interface ParsedData {
  headers: string[]
  rows: CSVRow[]
  validRows: CSVRow[]
  invalidRows: { row: CSVRow; errors: string[] }[]
}

interface FieldMapping {
  csvField: string
  dbField: string
}

type ImportStep = 'upload' | 'map' | 'preview' | 'import' | 'complete'

const requiredFields = ['email']
const optionalFields = ['name', 'phone', 'company', 'position', 'source', 'tags']
const allDbFields = [...requiredFields, ...optionalFields]

export default function ImportLeadsPage() {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResults, setImportResults] = useState<{
    successful: number
    failed: number
    errors: string[]
  } | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createSupabaseClient()

  // Initialize workspace
  useState(() => {
    const initializeWorkspace = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (member) {
        setWorkspaceId(member.workspace_id)
      }
    }
    initializeWorkspace()
  })

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo CSV válido')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('Arquivo muito grande. Limite de 5MB')
      return
    }

    setFile(selectedFile)
    parseCSV(selectedFile)
  }, [])

  const parseCSV = async (csvFile: File) => {
    setIsProcessing(true)

    try {
      const text = await csvFile.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        toast.error('CSV deve ter pelo menos um cabeçalho e uma linha de dados')
        setIsProcessing(false)
        return
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

      // Parse rows
      const rows: CSVRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const row: CSVRow = {}

        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

        rows.push(row)
      }

      // Validate rows
      const validRows: CSVRow[] = []
      const invalidRows: { row: CSVRow; errors: string[] }[] = []

      rows.forEach(row => {
        const errors: string[] = []

        // Check for email (required)
        const emailFields = headers.filter(h =>
          h.toLowerCase().includes('email') || h.toLowerCase().includes('e-mail')
        )

        let hasValidEmail = false
        for (const field of emailFields) {
          const email = row[field]
          if (email && isValidEmail(email)) {
            hasValidEmail = true
            break
          }
        }

        if (!hasValidEmail) {
          errors.push('Email obrigatório e deve ser válido')
        }

        if (errors.length === 0) {
          validRows.push(row)
        } else {
          invalidRows.push({ row, errors })
        }
      })

      const parsed: ParsedData = {
        headers,
        rows,
        validRows,
        invalidRows
      }

      setParsedData(parsed)

      // Auto-map fields
      const mappings: FieldMapping[] = []
      headers.forEach(csvField => {
        const lowerField = csvField.toLowerCase()
        let dbField = ''

        if (lowerField.includes('email') || lowerField.includes('e-mail')) {
          dbField = 'email'
        } else if (lowerField.includes('name') || lowerField.includes('nome')) {
          dbField = 'name'
        } else if (lowerField.includes('phone') || lowerField.includes('telefone') || lowerField.includes('celular')) {
          dbField = 'phone'
        } else if (lowerField.includes('company') || lowerField.includes('empresa')) {
          dbField = 'company'
        } else if (lowerField.includes('position') || lowerField.includes('cargo') || lowerField.includes('função')) {
          dbField = 'position'
        } else if (lowerField.includes('source') || lowerField.includes('origem')) {
          dbField = 'source'
        } else if (lowerField.includes('tag') || lowerField.includes('categoria')) {
          dbField = 'tags'
        }

        mappings.push({ csvField, dbField })
      })

      setFieldMappings(mappings)
      setCurrentStep('map')

      toast.success(`CSV processado: ${validRows.length} linhas válidas, ${invalidRows.length} inválidas`)

    } catch (error) {
      console.error('Error parsing CSV:', error)
      toast.error('Erro ao processar CSV. Verifique o formato do arquivo.')
    } finally {
      setIsProcessing(false)
    }
  }

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const updateFieldMapping = (csvField: string, dbField: string) => {
    setFieldMappings(prev =>
      prev.map(mapping =>
        mapping.csvField === csvField
          ? { ...mapping, dbField }
          : mapping
      )
    )
  }

  const handlePreview = () => {
    // Validate that email is mapped
    const emailMapping = fieldMappings.find(m => m.dbField === 'email')
    if (!emailMapping) {
      toast.error('Campo Email deve ser mapeado')
      return
    }

    setCurrentStep('preview')
  }

  const handleImport = async () => {
    if (!workspaceId || !parsedData) return

    setIsProcessing(true)
    setCurrentStep('import')

    try {
      let successful = 0
      let failed = 0
      const errors: string[] = []

      for (const row of parsedData.validRows) {
        try {
          // Map CSV data to database fields
          const leadData: any = {
            workspace_id: workspaceId,
            source: 'csv_import'
          }

          fieldMappings.forEach(mapping => {
            if (mapping.dbField && row[mapping.csvField]) {
              if (mapping.dbField === 'tags') {
                // Handle tags as array
                leadData.tags = row[mapping.csvField].split(',').map(t => t.trim()).filter(t => t)
              } else {
                leadData[mapping.dbField] = row[mapping.csvField]
              }
            }
          })

          // Insert lead
          const { error } = await supabase
            .from('leads')
            .insert(leadData)

          if (error) {
            if (error.code === '23505') {
              errors.push(`Email ${leadData.email} já existe`)
            } else {
              errors.push(`Erro ao importar ${leadData.email}: ${error.message}`)
            }
            failed++
          } else {
            successful++
          }
        } catch (error) {
          failed++
          errors.push(`Erro inesperado: ${error}`)
        }
      }

      setImportResults({ successful, failed, errors })
      setCurrentStep('complete')

      if (successful > 0) {
        toast.success(`${successful} leads importados com sucesso!`)
      }

      if (failed > 0) {
        toast.warning(`${failed} leads falharam na importação`)
      }

    } catch (error) {
      console.error('Import error:', error)
      toast.error('Erro durante a importação')
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = 'email,name,phone,company,position,source,tags\nexample@email.com,João Silva,11999999999,Empresa XYZ,Desenvolvedor,website,"lead,potencial"'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_leads.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const reset = () => {
    setCurrentStep('upload')
    setFile(null)
    setParsedData(null)
    setFieldMappings([])
    setImportResults(null)
  }

  const getStepNumber = (step: ImportStep): number => {
    const steps = ['upload', 'map', 'preview', 'import', 'complete']
    return steps.indexOf(step) + 1
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importar Leads</h1>
            <p className="text-gray-600">Importe seus contatos via arquivo CSV</p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              {(['upload', 'map', 'preview', 'import', 'complete'] as ImportStep[]).map((step, index) => {
                const stepNumber = index + 1
                const isActive = step === currentStep
                const isCompleted = getStepNumber(currentStep) > stepNumber
                const isDisabled = getStepNumber(currentStep) < stepNumber

                return (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isActive ? 'bg-blue-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {isCompleted ? <CheckCircle className="h-4 w-4" /> : stepNumber}
                    </div>
                    {index < 4 && (
                      <div className={`w-16 h-1 mx-2 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Upload</span>
              <span>Mapear</span>
              <span>Preview</span>
              <span>Importar</span>
              <span>Concluído</span>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {currentStep === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="mr-2 h-5 w-5" />
                Upload do Arquivo CSV
              </CardTitle>
              <CardDescription>
                Selecione um arquivo CSV com seus leads. Máximo 5MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <div className="text-lg font-medium text-gray-900">
                      Clique para selecionar ou arraste seu arquivo CSV
                    </div>
                    <div className="text-sm text-gray-500">
                      Formatos aceitos: .csv (máximo 5MB)
                    </div>
                  </Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {file && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-blue-500 mr-2" />
                    <div>
                      <div className="font-medium text-blue-900">{file.name}</div>
                      <div className="text-sm text-blue-600">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Template e Instruções</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Campos Obrigatórios</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• <strong>email</strong> - Email válido (obrigatório)</li>
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Campos Opcionais</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• <strong>name</strong> - Nome completo</li>
                        <li>• <strong>phone</strong> - Telefone</li>
                        <li>• <strong>company</strong> - Empresa</li>
                        <li>• <strong>position</strong> - Cargo</li>
                        <li>• <strong>source</strong> - Origem do lead</li>
                        <li>• <strong>tags</strong> - Tags separadas por vírgula</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Template CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'map' && parsedData && (
          <Card>
            <CardHeader>
              <CardTitle>Mapear Campos</CardTitle>
              <CardDescription>
                Mapeie os campos do seu CSV para os campos do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {fieldMappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <Label className="text-sm font-medium">{mapping.csvField}</Label>
                      <div className="text-xs text-gray-500">
                        Exemplo: {parsedData.rows[0]?.[mapping.csvField] || 'N/A'}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div className="w-1/3">
                      <Select
                        value={mapping.dbField}
                        onValueChange={(value) => updateFieldMapping(mapping.csvField, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar campo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Não mapear</SelectItem>
                          {allDbFields.map(field => (
                            <SelectItem key={field} value={field}>
                              {field} {requiredFields.includes(field) && '(obrigatório)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={handlePreview}>
                  Pré-visualizar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'preview' && parsedData && (
          <Card>
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription>
                Confira os dados antes da importação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {parsedData.validRows.length}
                    </div>
                    <div className="text-sm text-gray-600">Leads válidos</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {parsedData.invalidRows.length}
                    </div>
                    <div className="text-sm text-gray-600">Leads inválidos</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {parsedData.rows.length}
                    </div>
                    <div className="text-sm text-gray-600">Total de linhas</div>
                  </CardContent>
                </Card>
              </div>

              {parsedData.validRows.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Primeiras 5 linhas válidas:</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {fieldMappings
                            .filter(m => m.dbField)
                            .map(mapping => (
                              <TableHead key={mapping.dbField}>
                                {mapping.dbField}
                              </TableHead>
                            ))
                          }
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.validRows.slice(0, 5).map((row, index) => (
                          <TableRow key={index}>
                            {fieldMappings
                              .filter(m => m.dbField)
                              .map(mapping => (
                                <TableCell key={mapping.dbField}>
                                  {row[mapping.csvField] || '-'}
                                </TableCell>
                              ))
                            }
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {parsedData.invalidRows.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 text-red-600">
                    Linhas com erros ({parsedData.invalidRows.length}):
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {parsedData.invalidRows.slice(0, 10).map((item, index) => (
                      <div key={index} className="bg-red-50 p-2 rounded text-sm">
                        <div className="font-medium">
                          Linha {index + 2}: {item.row[Object.keys(item.row)[0]]}
                        </div>
                        <div className="text-red-600">
                          {item.errors.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep('map')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={parsedData.validRows.length === 0}
                >
                  Importar {parsedData.validRows.length} Leads
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'import' && (
          <Card>
            <CardHeader>
              <CardTitle>Importando...</CardTitle>
              <CardDescription>
                Aguarde enquanto importamos seus leads
              </CardDescription>
            </CardHeader>
            <CardContent className="py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Processando importação...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'complete' && importResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-green-600">
                <CheckCircle className="mr-2 h-5 w-5" />
                Importação Concluída
              </CardTitle>
              <CardDescription>
                Resumo da importação dos seus leads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {importResults.successful}
                    </div>
                    <div className="text-sm text-gray-600">Importados com sucesso</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">
                      {importResults.failed}
                    </div>
                    <div className="text-sm text-gray-600">Falharam na importação</div>
                  </CardContent>
                </Card>
              </div>

              {importResults.errors.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 text-red-600">
                    Erros encontrados:
                  </h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {importResults.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className="bg-red-50 p-2 rounded text-sm text-red-700">
                        {error}
                      </div>
                    ))}
                    {importResults.errors.length > 10 && (
                      <div className="text-sm text-gray-500">
                        ... e mais {importResults.errors.length - 10} erros
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={reset}>
                  Importar Mais Leads
                </Button>
                <Button onClick={() => router.push('/dashboard/leads')}>
                  Ver Leads Importados
                  <Users className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
