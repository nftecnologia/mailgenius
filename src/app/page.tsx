import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedLogo } from '@/components/ui/animated-logo'
import {
  Mail,
  Users,
  Zap,
  BarChart3,
  Workflow,
  Shield,
  Sparkles,
  TrendingUp,
  Clock,
  Target,
  ArrowRight,
  Check,
  Brain,
  Rocket,
  Star,
  Globe,
  ChevronRight,
  Play,
  Building,
  Crown,
} from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      icon: Brain,
      title: 'IA Generativa Avançada',
      description: 'Inteligência artificial cria conteúdo, otimiza campanhas e prevê resultados automaticamente.',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: Rocket,
      title: 'Editor WYSIWYG Único',
      description: 'Primeiro editor visual drag-and-drop do mercado. Crie emails profissionais sem código.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Target,
      title: 'A/B Testing Inteligente',
      description: 'IA cria variantes automaticamente e otimiza em tempo real para máxima conversão.',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: Workflow,
      title: 'Automações Visuais',
      description: 'Builder drag-and-drop para fluxos complexos. IA sugere melhorias e otimizações.',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: BarChart3,
      title: 'Analytics Preditivo',
      description: 'IA analisa padrões e prevê performance. Insights acionáveis para melhorar ROI.',
      gradient: 'from-indigo-500 to-purple-500',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Segurança SOC 2, GDPR compliance e isolamento multi-tenant para grandes empresas.',
      gradient: 'from-teal-500 to-blue-500',
    },
  ]

  const stats = [
    { label: 'Entregabilidade', value: '99.9%', icon: TrendingUp },
    { label: 'Emails/Minuto', value: '50k+', icon: Zap },
    { label: 'IA Automações', value: '1,500+', icon: Brain },
    { label: 'Empresas Enterprise', value: '2,800+', icon: Building },
  ]

  const testimonials = [
    {
      name: 'Maria Silva',
      role: 'CMO, TechCorp',
      content: 'O MailGenius aumentou nossa conversão em 340%. A IA é impressionante!',
      avatar: '👩‍💼'
    },
    {
      name: 'João Santos',
      role: 'Founder, StartupXYZ',
      content: 'Migrei do Mailchimp. O editor visual economiza 5h por semana.',
      avatar: '👨‍💻'
    },
    {
      name: 'Ana Costa',
      role: 'Marketing Director',
      content: 'ROI de 850% no primeiro trimestre. Automações inteligentes funcionam!',
      avatar: '👩‍🚀'
    }
  ]

  const plans = [
    {
      name: 'Starter',
      price: 'R$ 29',
      period: '/mês',
      description: 'Perfeito para pequenas empresas',
      features: [
        '5,000 leads',
        '10,000 emails/mês',
        'CRM básico',
        'Templates de email',
        'Relatórios básicos',
        'Suporte por email',
      ],
      popular: false,
      gradient: 'from-gray-50 to-gray-100',
    },
    {
      name: 'Professional',
      price: 'R$ 99',
      period: '/mês',
      description: 'Para empresas em crescimento',
      features: [
        '25,000 leads',
        '100,000 emails/mês',
        'CRM avançado',
        'Editor WYSIWYG',
        'IA Automações',
        'A/B Testing IA',
        'Webhooks ilimitados',
        'Relatórios avançados',
        'Suporte prioritário',
      ],
      popular: true,
      gradient: 'from-blue-50 to-purple-50',
    },
    {
      name: 'Enterprise',
      price: 'Personalizado',
      period: '',
      description: 'Soluções corporativas',
      features: [
        'Leads ilimitados',
        'Emails ilimitados',
        'White-label',
        'Integrações customizadas',
        'SLA garantido',
        'Suporte dedicado',
        'Consultoria estratégica',
      ],
      popular: false,
      gradient: 'from-purple-50 to-pink-50',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3 group">
            <div className="transform transition-all duration-300 hover:scale-110">
              <AnimatedLogo size={48} animate={true} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 bg-clip-text text-transparent">
                MailGenius
              </h1>
              <p className="text-xs text-purple-600 -mt-1 font-medium">Intelligent Marketing</p>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-600 hover:text-purple-600 transition-colors duration-200 hover:scale-105 transform">
              Recursos
            </Link>
            <Link href="#pricing" className="text-gray-600 hover:text-purple-600 transition-colors duration-200 hover:scale-105 transform">
              Preços
            </Link>
            <Link href="#contact" className="text-gray-600 hover:text-purple-600 transition-colors duration-200 hover:scale-105 transform">
              Contato
            </Link>
            <Link href="/auth" className="text-gray-600 hover:text-purple-600 transition-colors duration-200 hover:scale-105 transform">
              Entrar
            </Link>
            <Button asChild className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1">
              <Link href="/auth">
                Começar Grátis
                <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-6 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-200 animate-pulse">
            <Sparkles className="mr-2 h-3 w-3" />
            Primeira Plataforma com IA Generativa
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight animate-fade-in">
            Email Marketing
            <br />
            <span className="bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 bg-clip-text text-transparent animate-gradient">
              Inteligente e Genial
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-delay">
            A única plataforma que combina <strong className="text-purple-600">Editor WYSIWYG</strong>, <strong className="text-purple-600">IA Generativa</strong> e
            <strong className="text-purple-600"> A/B Testing Inteligente</strong>. Aumente suas conversões em até 340% com automação total.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button size="lg" asChild className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 text-lg px-8 py-6 group">
              <Link href="/auth">
                <Brain className="mr-3 h-5 w-5 group-hover:animate-pulse" />
                Começar Gratuitamente
                <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-purple-300 hover:border-purple-400 hover:bg-purple-50 text-lg px-8 py-6 transition-all duration-300 transform hover:scale-105 group">
              <Play className="mr-3 h-5 w-5 group-hover:scale-110" />
              Ver Demo
            </Button>
          </div>

          {/* Trusted by */}
          <div className="mb-16 animate-fade-in-delay-2">
            <p className="text-sm text-gray-500 mb-6">Confiado por mais de 2.800 empresas</p>
            <div className="flex items-center justify-center space-x-8 opacity-60">
              <div className="text-2xl font-bold text-gray-400 hover:text-purple-400 transition-colors cursor-pointer">TechCorp</div>
              <div className="text-2xl font-bold text-gray-400 hover:text-purple-400 transition-colors cursor-pointer">StartupXYZ</div>
              <div className="text-2xl font-bold text-gray-400 hover:text-purple-400 transition-colors cursor-pointer">InnovaCo</div>
              <div className="text-2xl font-bold text-gray-400 hover:text-purple-400 transition-colors cursor-pointer">ScaleTech</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="text-center group cursor-pointer">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <Icon className="h-8 w-8 text-white group-hover:animate-pulse" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">{stat.value}</div>
                <div className="text-gray-600 font-medium group-hover:text-purple-500 transition-colors">{stat.label}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <Badge className="mb-6 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 border-blue-200">
            <Brain className="mr-2 h-3 w-3" />
            Tecnologia Exclusiva
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Tudo que você precisa para
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent block">
              vender mais
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A primeira plataforma que combina todas as ferramentas necessárias
            para sua estratégia de email marketing dar certo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="group hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm hover:bg-white hover:-translate-y-1 transform cursor-pointer">
                <CardHeader className="pb-4">
                  <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl shadow-lg mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                    <Icon className="h-7 w-7 text-white group-hover:animate-pulse" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* How it Works */}
      <section className="container mx-auto px-4 py-20 bg-gradient-to-r from-blue-50 to-purple-50 rounded-3xl mx-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Como funciona</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Em poucos passos, você já está enviando emails profissionais com IA
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="text-center group cursor-pointer">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Users className="h-10 w-10 text-white group-hover:animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">1. Importe seus leads</h3>
            <p className="text-gray-600">
              Adicione seus contatos via CSV ou conecte com CRMs existentes
            </p>
          </div>
          <div className="text-center group cursor-pointer">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Workflow className="h-10 w-10 text-white group-hover:animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-purple-600 transition-colors">2. Crie automações</h3>
            <p className="text-gray-600">
              Use nosso builder visual para criar fluxos personalizados
            </p>
          </div>
          <div className="text-center group cursor-pointer">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <TrendingUp className="h-10 w-10 text-white group-hover:animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-green-600 transition-colors">3. Acompanhe resultados</h3>
            <p className="text-gray-600">
              Veja métricas em tempo real e otimize suas campanhas
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Resultados <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">comprovados</span>
          </h2>
          <p className="text-xl text-gray-600">Veja o que nossos clientes estão dizendo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 transform group cursor-pointer">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  <div className="text-3xl mr-3">{testimonial.avatar}</div>
                  <div>
                    <div className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}</div>
                  </div>
                </div>
                <p className="text-gray-700 italic">"{testimonial.content}"</p>
                <div className="flex text-yellow-400 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <Badge className="mb-6 bg-gradient-to-r from-green-100 to-blue-100 text-green-700 border-green-200">
            <Target className="mr-2 h-3 w-3" />
            Planos Transparentes
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Planos para todos os tamanhos
          </h2>
          <p className="text-xl text-gray-600">
            Escolha o plano ideal para sua empresa
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <Card key={index} className={`relative border-2 transition-all hover:shadow-2xl hover:-translate-y-1 transform group cursor-pointer ${
              plan.popular
                ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 scale-105'
                : 'border-gray-200 bg-white hover:border-purple-200'
            }`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2">
                  <Star className="mr-1 h-3 w-3" />
                  Mais Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="text-gray-600">{plan.period}</span>}
                </div>
                <CardDescription className="text-lg mt-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className={`w-full py-6 text-lg font-semibold transition-all duration-300 transform group-hover:scale-105 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}>
                  {plan.name === 'Enterprise' ? 'Falar com Vendas' : 'Começar Agora'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 rounded-3xl p-12 text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Pronto para revolucionar seu email marketing?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Junte-se a mais de 2.800 empresas que já aumentaram suas vendas com MailGenius
          </p>
          <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 shadow-xl text-lg px-8 py-6 font-semibold transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 group">
            <Rocket className="mr-3 h-5 w-5 group-hover:animate-pulse" />
            Começar Gratuitamente
            <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 rounded-xl flex items-center justify-center">
                  <AnimatedLogo size={28} animate={false} />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-purple-500 to-pink-400 bg-clip-text text-transparent">
                    MailGenius
                  </h3>
                  <p className="text-xs text-purple-300">Intelligent Marketing</p>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed">
                A plataforma de email marketing mais inteligente do Brasil.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Produto</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">Recursos</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Integrações</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">API</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Segurança</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Empresa</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">Sobre</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Carreiras</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Contato</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Suporte</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">Central de Ajuda</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Documentação</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Status</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Termos</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 MailGenius. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
