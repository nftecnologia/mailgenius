'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AnimatedLogo } from '@/components/ui/animated-logo'
import { Copy, Check, Palette, Type, Zap, Heart } from 'lucide-react'

export function BrandGuide() {
  const [copiedColor, setCopiedColor] = React.useState<string | null>(null)

  const copyToClipboard = (text: string, colorName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedColor(colorName)
    setTimeout(() => setCopiedColor(null), 2000)
  }

  const brandColors = {
    primary: {
      name: 'Purple Primary',
      hex: '#7c3aed',
      rgb: 'rgb(124, 58, 237)',
      hsl: 'hsl(263, 84%, 58%)',
      tailwind: 'purple-600',
      usage: 'Botões principais, links, elementos de destaque'
    },
    secondary: {
      name: 'Pink Secondary',
      hex: '#ec4899',
      rgb: 'rgb(236, 72, 153)',
      hsl: 'hsl(329, 81%, 60%)',
      tailwind: 'pink-500',
      usage: 'Acentos, gradientes, elementos secundários'
    },
    accent: {
      name: 'Violet Accent',
      hex: '#a855f7',
      rgb: 'rgb(168, 85, 247)',
      hsl: 'hsl(267, 90%, 65%)',
      tailwind: 'violet-500',
      usage: 'Highlights, badges, notificações'
    },
    neutral: {
      name: 'Gray Neutral',
      hex: '#374151',
      rgb: 'rgb(55, 65, 81)',
      hsl: 'hsl(220, 19%, 27%)',
      tailwind: 'gray-700',
      usage: 'Textos, bordas, elementos neutros'
    },
    success: {
      name: 'Emerald Success',
      hex: '#10b981',
      rgb: 'rgb(16, 185, 129)',
      hsl: 'hsl(160, 84%, 39%)',
      tailwind: 'emerald-500',
      usage: 'Confirmações, status positivos'
    },
    warning: {
      name: 'Amber Warning',
      hex: '#f59e0b',
      rgb: 'rgb(245, 158, 11)',
      hsl: 'hsl(43, 90%, 50%)',
      tailwind: 'amber-500',
      usage: 'Alertas, avisos importantes'
    }
  }

  const gradients = [
    {
      name: 'Primary Gradient',
      css: 'bg-gradient-to-r from-purple-600 to-pink-500',
      style: 'linear-gradient(to right, #7c3aed, #ec4899)',
      usage: 'Botões principais, headers, CTAs'
    },
    {
      name: 'Secondary Gradient',
      css: 'bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600',
      style: 'linear-gradient(to bottom right, #a855f7, #7c3aed, #ec4899)',
      usage: 'Backgrounds, cards especiais'
    },
    {
      name: 'Subtle Gradient',
      css: 'bg-gradient-to-r from-purple-50 to-pink-50',
      style: 'linear-gradient(to right, #faf5ff, #fdf2f8)',
      usage: 'Backgrounds sutis, cards secundários'
    }
  ]

  const typography = {
    headings: {
      font: 'Inter',
      weights: ['font-bold', 'font-semibold'],
      sizes: ['text-4xl', 'text-3xl', 'text-2xl', 'text-xl'],
      usage: 'Títulos principais, headings, CTAs importantes'
    },
    body: {
      font: 'Inter',
      weights: ['font-normal', 'font-medium'],
      sizes: ['text-base', 'text-lg'],
      usage: 'Texto do corpo, descrições, parágrafos'
    },
    small: {
      font: 'Inter',
      weights: ['font-normal', 'font-medium'],
      sizes: ['text-sm', 'text-xs'],
      usage: 'Labels, badges, textos auxiliares'
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-6">
          <AnimatedLogo size={80} animate={true} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          MailGenius Brand Guide
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Guia completo de identidade visual e diretrizes de marca para MailGenius - Intelligent Marketing Platform
        </p>
      </div>

      {/* Logo Variations */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
          <Zap className="mr-3 text-purple-600" />
          Logo & Variações
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Logo Animado</CardTitle>
              <CardDescription>Versão principal com animações</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="bg-gray-50 p-8 rounded-lg">
                <AnimatedLogo size={64} animate={true} />
              </div>
              <Badge variant="outline">Uso: Digital, Web, Animações</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo Estático</CardTitle>
              <CardDescription>Versão estática para impressão</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="bg-gray-50 p-8 rounded-lg">
                <AnimatedLogo size={64} animate={false} />
              </div>
              <Badge variant="outline">Uso: Print, Documentos, Favicon</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo Monocromático</CardTitle>
              <CardDescription>Versão em preto/branco</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="bg-gray-50 p-8 rounded-lg">
                <svg width="64" height="64" viewBox="0 0 80 80">
                  <circle cx="20" cy="25" r="4" fill="#374151"/>
                  <circle cx="40" cy="15" r="6" fill="#374151"/>
                  <circle cx="60" cy="25" r="4" fill="#374151"/>
                  <circle cx="15" cy="45" r="3" fill="#374151"/>
                  <circle cx="40" cy="40" r="8" fill="#374151"/>
                  <circle cx="65" cy="45" r="3" fill="#374151"/>
                  <circle cx="25" cy="65" r="4" fill="#374151"/>
                  <circle cx="55" cy="65" r="4" fill="#374151"/>
                </svg>
              </div>
              <Badge variant="outline">Uso: Marca d'água, Documentos B&W</Badge>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Color Palette */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
          <Palette className="mr-3 text-purple-600" />
          Paleta de Cores
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(brandColors).map(([key, color]) => (
            <Card key={key} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div
                  className="w-full h-24 rounded-lg mb-4 relative overflow-hidden group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: color.hex }}
                >
                  <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity"></div>
                </div>
                <CardTitle className="text-lg">{color.name}</CardTitle>
                <CardDescription>{color.usage}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">HEX</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(color.hex, `${key}-hex`)}
                      className="h-auto p-1"
                    >
                      {copiedColor === `${key}-hex` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <code className="block text-xs bg-gray-100 p-2 rounded">{color.hex}</code>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">RGB</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(color.rgb, `${key}-rgb`)}
                      className="h-auto p-1"
                    >
                      {copiedColor === `${key}-rgb` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <code className="block text-xs bg-gray-100 p-2 rounded">{color.rgb}</code>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">Tailwind</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(color.tailwind, `${key}-tailwind`)}
                      className="h-auto p-1"
                    >
                      {copiedColor === `${key}-tailwind` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <code className="block text-xs bg-gray-100 p-2 rounded">{color.tailwind}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Gradients */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Gradientes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {gradients.map((gradient, index) => (
            <Card key={index} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div
                  className={`w-full h-24 rounded-lg mb-4 ${gradient.css} group-hover:scale-105 transition-transform`}
                ></div>
                <CardTitle className="text-lg">{gradient.name}</CardTitle>
                <CardDescription>{gradient.usage}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">CSS</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(gradient.style, `gradient-${index}`)}
                      className="h-auto p-1"
                    >
                      {copiedColor === `gradient-${index}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <code className="block text-xs bg-gray-100 p-2 rounded break-all">{gradient.style}</code>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">Tailwind</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(gradient.css, `gradient-tw-${index}`)}
                      className="h-auto p-1"
                    >
                      {copiedColor === `gradient-tw-${index}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <code className="block text-xs bg-gray-100 p-2 rounded break-all">{gradient.css}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
          <Type className="mr-3 text-purple-600" />
          Tipografia
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(typography).map(([key, type]) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="capitalize">{key}</CardTitle>
                <CardDescription>{type.usage}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-gray-600 block mb-2">Font Family:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">{type.font}</code>
                </div>

                <div>
                  <span className="text-sm text-gray-600 block mb-2">Weights:</span>
                  <div className="flex flex-wrap gap-2">
                    {type.weights.map((weight, idx) => (
                      <Badge key={idx} variant="outline">{weight}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-600 block mb-2">Sizes:</span>
                  <div className="flex flex-wrap gap-2">
                    {type.sizes.map((size, idx) => (
                      <Badge key={idx} variant="outline">{size}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-600 block mb-2">Preview:</span>
                  <div className={`${type.sizes[0]} ${type.weights[0]}`}>
                    MailGenius Sample Text
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Usage Guidelines */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
          <Heart className="mr-3 text-purple-600" />
          Diretrizes de Uso
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800">✅ Fazer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-green-700">
              <p>• Use o logo animado em interfaces digitais</p>
              <p>• Mantenha espaçamento mínimo igual ao tamanho do logo</p>
              <p>• Use gradientes para CTAs e elementos importantes</p>
              <p>• Combine roxo primário com pink secundário</p>
              <p>• Use tipografia Inter em todos os contextos</p>
              <p>• Mantenha consistência nas animações (2-4s)</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800">❌ Não Fazer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-red-700">
              <p>• Não altere as cores do logo</p>
              <p>• Não use o logo em backgrounds complexos</p>
              <p>• Não misture com outras paletas de cores</p>
              <p>• Não use animações muito rápidas (&lt;1s)</p>
              <p>• Não comprima ou distorça o logo</p>
              <p>• Não use mais de 3 cores por elemento</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Brand Voice */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Tom de Voz</h2>
        <Card>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-purple-600 mb-4">Inteligente</h3>
                <p className="text-gray-600">Demonstramos expertise técnica sem intimidar. Explicamos conceitos complexos de forma acessível.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-purple-600 mb-4">Confiável</h3>
                <p className="text-gray-600">Transmitimos segurança e profissionalismo. Somos transparentes sobre capacidades e limitações.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-purple-600 mb-4">Inovador</h3>
                <p className="text-gray-600">Estamos sempre à frente das tendências. Mostramos como a IA pode transformar o email marketing.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
