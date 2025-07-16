import { ShoppingCart, Users, Mail, TrendingUp } from 'lucide-react'

export interface FlowTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: any
  color: string
  estimatedEmails: number
  duration: string
  useCase: string
  steps: FlowStepTemplate[]
}

export interface FlowStepTemplate {
  type: 'trigger' | 'delay' | 'email' | 'condition'
  name: string
  delay?: {
    amount: number
    unit: string
  }
  emailTemplate?: {
    subject: string
    tone: string
    keyPoints: string[]
  }
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'cart-abandonment',
    name: 'Recuperação de Carrinho Abandonado',
    description: 'Reconquiste clientes que abandonaram compras',
    category: 'E-commerce',
    icon: ShoppingCart,
    color: 'bg-orange-500',
    estimatedEmails: 3,
    duration: '7 dias',
    useCase: 'Aumentar conversões de carrinho abandonado em até 30%',
    steps: [
      { type: 'trigger', name: 'Carrinho abandonado' },
      { type: 'delay', name: 'Aguardar 1 hora', delay: { amount: 1, unit: 'hours' } },
      {
        type: 'email',
        name: 'Lembrete gentil',
        emailTemplate: {
          subject: 'Você esqueceu algo no seu carrinho 🛒',
          tone: 'amigável e útil',
          keyPoints: ['Lembrar produtos', 'Mostrar benefícios', 'Criar senso de urgência suave']
        }
      },
      { type: 'delay', name: 'Aguardar 24 horas', delay: { amount: 24, unit: 'hours' } },
      {
        type: 'email',
        name: 'Oferta especial',
        emailTemplate: {
          subject: 'Oferta especial: 10% OFF no seu carrinho',
          tone: 'persuasivo mas respeitoso',
          keyPoints: ['Oferecer desconto', 'Destacar escassez', 'Facilitar compra']
        }
      },
      { type: 'delay', name: 'Aguardar 3 dias', delay: { amount: 3, unit: 'days' } },
      {
        type: 'email',
        name: 'Última chance',
        emailTemplate: {
          subject: 'Última chance: seus itens podem esgotar',
          tone: 'urgente mas não agressivo',
          keyPoints: ['Criar urgência', 'Mostrar escassez', 'Oferecer ajuda']
        }
      }
    ]
  },
  {
    id: 'welcome-sequence',
    name: 'Sequência de Boas-vindas',
    description: 'Eduque e engaje novos leads automaticamente',
    category: 'Onboarding',
    icon: Users,
    color: 'bg-blue-500',
    estimatedEmails: 5,
    duration: '14 dias',
    useCase: 'Aumentar engajamento de novos leads em 60%',
    steps: [
      { type: 'trigger', name: 'Novo lead cadastrado' },
      {
        type: 'email',
        name: 'Boas-vindas',
        emailTemplate: {
          subject: 'Bem-vindo(a)! Aqui está seu primeiro passo',
          tone: 'caloroso e acolhedor',
          keyPoints: ['Dar boas-vindas', 'Explicar o que esperar', 'Primeiro valor']
        }
      },
      { type: 'delay', name: 'Aguardar 2 dias', delay: { amount: 2, unit: 'days' } },
      {
        type: 'email',
        name: 'Conteúdo educativo #1',
        emailTemplate: {
          subject: 'Dica valiosa: Como começar da forma certa',
          tone: 'educativo e útil',
          keyPoints: ['Compartilhar conhecimento', 'Estabelecer autoridade', 'Dar valor']
        }
      },
      { type: 'delay', name: 'Aguardar 3 dias', delay: { amount: 3, unit: 'days' } },
      {
        type: 'email',
        name: 'Caso de sucesso',
        emailTemplate: {
          subject: 'História inspiradora: Como [Cliente] conseguiu [resultado]',
          tone: 'inspirador e motivacional',
          keyPoints: ['Contar história de sucesso', 'Mostrar resultados possíveis', 'Inspirar ação']
        }
      },
      { type: 'delay', name: 'Aguardar 4 dias', delay: { amount: 4, unit: 'days' } },
      {
        type: 'email',
        name: 'Conteúdo educativo #2',
        emailTemplate: {
          subject: 'Erro comum que você deve evitar',
          tone: 'consultivo e preventivo',
          keyPoints: ['Alertar sobre erros', 'Posicionar como especialista', 'Prevenir problemas']
        }
      },
      { type: 'delay', name: 'Aguardar 5 dias', delay: { amount: 5, unit: 'days' } },
      {
        type: 'email',
        name: 'Chamada para ação',
        emailTemplate: {
          subject: 'Pronto para dar o próximo passo?',
          tone: 'convidativo e motivador',
          keyPoints: ['Fazer convite claro', 'Mostrar próximos passos', 'Facilitar conversão']
        }
      }
    ]
  },
  {
    id: 'newsletter-engagement',
    name: 'Newsletter de Engajamento',
    description: 'Mantenha sua audiência engajada com conteúdo regular',
    category: 'Newsletter',
    icon: Mail,
    color: 'bg-purple-500',
    estimatedEmails: 4,
    duration: '1 mês',
    useCase: 'Aumentar abertura de emails em 40% e cliques em 25%',
    steps: [
      { type: 'trigger', name: 'Inscrição em newsletter' },
      {
        type: 'email',
        name: 'Newsletter semanal #1',
        emailTemplate: {
          subject: '📰 Resumo da semana + novidade exclusiva',
          tone: 'informativo e amigável',
          keyPoints: ['Resumir novidades', 'Compartilhar insights', 'Dar exclusividade']
        }
      },
      { type: 'delay', name: 'Aguardar 1 semana', delay: { amount: 1, unit: 'weeks' } },
      {
        type: 'email',
        name: 'Conteúdo de valor',
        emailTemplate: {
          subject: '💡 Dica que pode mudar seus resultados',
          tone: 'educativo e impactante',
          keyPoints: ['Compartilhar dica valiosa', 'Demonstrar expertise', 'Gerar valor real']
        }
      },
      { type: 'delay', name: 'Aguardar 1 semana', delay: { amount: 1, unit: 'weeks' } },
      {
        type: 'email',
        name: 'Pergunta engajante',
        emailTemplate: {
          subject: 'Pergunta rápida: qual seu maior desafio?',
          tone: 'conversacional e curioso',
          keyPoints: ['Fazer pergunta interessante', 'Incentivar resposta', 'Criar interação']
        }
      },
      { type: 'delay', name: 'Aguardar 1 semana', delay: { amount: 1, unit: 'weeks' } },
      {
        type: 'email',
        name: 'Conteúdo premium',
        emailTemplate: {
          subject: '🎁 Conteúdo exclusivo só para você',
          tone: 'exclusivo e especial',
          keyPoints: ['Oferecer conteúdo premium', 'Fazer sentir especial', 'Recompensar fidelidade']
        }
      }
    ]
  },
  {
    id: 'sales-followup',
    name: 'Follow-up de Vendas',
    description: 'Nutra leads qualificados até a conversão',
    category: 'Vendas',
    icon: TrendingUp,
    color: 'bg-green-500',
    estimatedEmails: 6,
    duration: '21 dias',
    useCase: 'Converter 15-25% dos leads em clientes',
    steps: [
      { type: 'trigger', name: 'Lead qualificado' },
      {
        type: 'email',
        name: 'Apresentação da solução',
        emailTemplate: {
          subject: 'Como resolver [problema específico] em [tempo]',
          tone: 'profissional e solucionador',
          keyPoints: ['Apresentar solução', 'Focar no problema', 'Demonstrar competência']
        }
      },
      { type: 'delay', name: 'Aguardar 3 dias', delay: { amount: 3, unit: 'days' } },
      {
        type: 'email',
        name: 'Prova social',
        emailTemplate: {
          subject: 'Veja como [Empresa Similar] aumentou [resultado] em [%]',
          tone: 'convincente e baseado em dados',
          keyPoints: ['Mostrar caso de sucesso', 'Usar dados concretos', 'Criar confiança']
        }
      },
      { type: 'delay', name: 'Aguardar 4 dias', delay: { amount: 4, unit: 'days' } },
      {
        type: 'email',
        name: 'Objeções comuns',
        emailTemplate: {
          subject: '"Mas isso funciona para meu tipo de negócio?"',
          tone: 'empático e esclarecedor',
          keyPoints: ['Antecipar objeções', 'Fornecer esclarecimentos', 'Remover barreiras']
        }
      },
      { type: 'delay', name: 'Aguardar 5 dias', delay: { amount: 5, unit: 'days' } },
      {
        type: 'email',
        name: 'Demonstração/Trial',
        emailTemplate: {
          subject: 'Que tal ver funcionando? Demonstração gratuita',
          tone: 'convidativo e sem pressão',
          keyPoints: ['Oferecer demonstração', 'Reduzir risco', 'Facilitar experimentação']
        }
      },
      { type: 'delay', name: 'Aguardar 4 dias', delay: { amount: 4, unit: 'days' } },
      {
        type: 'email',
        name: 'Oferta limitada',
        emailTemplate: {
          subject: 'Oferta especial válida por 48h (só para você)',
          tone: 'urgente mas respeitoso',
          keyPoints: ['Criar senso de urgência', 'Oferecer incentivo', 'Facilitar decisão']
        }
      },
      { type: 'delay', name: 'Aguardar 5 dias', delay: { amount: 5, unit: 'days' } },
      {
        type: 'email',
        name: 'Última oportunidade',
        emailTemplate: {
          subject: 'Última chance - posso ajudar de outra forma?',
          tone: 'útil e sem pressão',
          keyPoints: ['Fazer última tentativa', 'Oferecer ajuda alternativa', 'Manter relacionamento']
        }
      }
    ]
  }
]