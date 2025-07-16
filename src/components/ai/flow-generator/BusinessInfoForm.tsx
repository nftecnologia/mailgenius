import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRight } from 'lucide-react'
import { BusinessInfo } from '@/lib/types/flow-types'

interface BusinessInfoFormProps {
  businessInfo: BusinessInfo
  onBusinessInfoChange: (updates: Partial<BusinessInfo>) => void
  onSubmit: () => void
  onBack: () => void
}

export function BusinessInfoForm({ 
  businessInfo, 
  onBusinessInfoChange, 
  onSubmit, 
  onBack 
}: BusinessInfoFormProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
        Conte-nos sobre seu negócio
      </h2>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="companyName">Nome da Empresa</Label>
              <Input
                id="companyName"
                value={businessInfo.companyName}
                onChange={(e) => onBusinessInfoChange({ companyName: e.target.value })}
                placeholder="Ex: Minha Empresa Ltda"
              />
            </div>
            <div>
              <Label htmlFor="industry">Setor/Indústria *</Label>
              <Select 
                value={businessInfo.industry}
                onValueChange={(value) => onBusinessInfoChange({ industry: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione seu setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="saas">SaaS/Software</SelectItem>
                  <SelectItem value="consultoria">Consultoria</SelectItem>
                  <SelectItem value="educacao">Educação</SelectItem>
                  <SelectItem value="saude">Saúde</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="imobiliario">Imobiliário</SelectItem>
                  <SelectItem value="varejo">Varejo</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="productType">Tipo de Produto/Serviço</Label>
            <Input
              id="productType"
              value={businessInfo.productType}
              onChange={(e) => onBusinessInfoChange({ productType: e.target.value })}
              placeholder="Ex: Plataforma de marketing digital"
            />
          </div>

          <div>
            <Label htmlFor="targetAudience">Público-alvo *</Label>
            <Textarea
              id="targetAudience"
              value={businessInfo.targetAudience}
              onChange={(e) => onBusinessInfoChange({ targetAudience: e.target.value })}
              placeholder="Ex: Pequenos empreendedores que querem aumentar suas vendas online"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="businessGoal">Objetivo Principal</Label>
            <Input
              id="businessGoal"
              value={businessInfo.businessGoal}
              onChange={(e) => onBusinessInfoChange({ businessGoal: e.target.value })}
              placeholder="Ex: aumentar conversões, educar leads, recuperar vendas"
            />
          </div>

          <div>
            <Label htmlFor="tone">Tom de Comunicação</Label>
            <Select 
              value={businessInfo.tone}
              onValueChange={(value) => onBusinessInfoChange({ tone: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="amigável">Amigável</SelectItem>
                <SelectItem value="caloroso">Caloroso</SelectItem>
                <SelectItem value="educativo">Educativo</SelectItem>
                <SelectItem value="conversacional">Conversacional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Voltar
            </Button>
            <Button onClick={onSubmit} className="flex-1">
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}