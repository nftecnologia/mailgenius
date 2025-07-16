'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedLogo } from '@/components/ui/animated-logo'
import { useSupabaseAuth } from '@/lib/hooks/useSupabaseAuth'
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Sparkles, Brain } from 'lucide-react'
import Link from 'next/link'

export default function AuthPage() {
  const router = useRouter()
  const { signIn, signUp, loading: authLoading, error: authError, isAuthenticated } = useSupabaseAuth()

  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    setMounted(true)

    // Check if user is already authenticated
    if (isAuthenticated) {
      console.log('✅ User already authenticated, redirecting to dashboard...')
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mounted) return

    setStatusMessage('')

    try {
      // Basic validation
      if (!formData.email || !formData.password) {
        setStatusMessage('Por favor, preencha email e senha')
        return
      }

      if (!isLogin && !formData.name) {
        setStatusMessage('Por favor, preencha seu nome')
        return
      }

      if (!isLogin && formData.password !== formData.confirmPassword) {
        setStatusMessage('As senhas não coincidem')
        return
      }

      console.log('🔐 Starting Supabase authentication...')
      setStatusMessage(isLogin ? 'Entrando...' : 'Criando conta...')

      if (isLogin) {
        await signIn(formData.email, formData.password)
        setStatusMessage('✅ Login realizado! Redirecionando...')
      } else {
        await signUp(formData.email, formData.password, formData.name)
        setStatusMessage('✅ Conta criada! Verifique seu email para confirmar.')
      }

      // Redirect will happen automatically via useSupabaseAuth hook
      setTimeout(() => {
        router.push('/dashboard')
      }, 1000)

    } catch (error: any) {
      console.error('❌ Auth error:', error)
      setStatusMessage(`Erro: ${error.message || 'Falha na autenticação'}`)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
    setStatusMessage('')
  }

  // Show loading if not mounted or if already authenticated
  if (!mounted || isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back to Home */}
        <Link
          href="/"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
          Voltar para o início
        </Link>

        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl hover:shadow-3xl transition-all duration-300">
          <CardHeader className="text-center pb-6">
            {/* Animated Logo */}
            <div className="flex justify-center mb-6">
              <div className="transform transition-all duration-300 hover:scale-110">
                <AnimatedLogo size={64} animate={true} />
              </div>
            </div>

            {/* Brand Name */}
            <div className="mb-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 bg-clip-text text-transparent">
                MailGenius
              </h1>
              <p className="text-sm text-purple-600 font-medium">Intelligent Marketing</p>
            </div>

            <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Faça seu login' : 'Crie sua conta'}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {isLogin
                ? 'Acesse sua plataforma de email marketing inteligente'
                : 'Comece a usar IA para turbinar suas campanhas'
              }
            </CardDescription>

            {!isLogin && (
              <div className="mt-4 p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border border-purple-200">
                <div className="flex items-center text-purple-700 text-sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span className="font-medium">Grátis por 14 dias • Sem cartão necessário</span>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Status Message */}
            {(statusMessage || authError) && (
              <div
                className={`text-center text-sm px-4 py-2 rounded-lg mb-2 transition-all duration-200 ${
                  (statusMessage && statusMessage.toLowerCase().includes('erro')) || authError
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : statusMessage && statusMessage.toLowerCase().includes('sucesso')
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-purple-50 text-purple-700 border border-purple-100'
                }`}
                role="status"
                aria-live="polite"
              >
                {authError || statusMessage}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {/* Name Field (only for signup) */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Nome completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (only for signup) */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Forgot Password (only for login) */}
              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 group"
              >
                {authLoading ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Processando...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Brain className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                    {isLogin ? 'Entrar' : 'Criar conta'}
                  </div>
                )}
              </Button>
            </form>

            {/* Toggle Form */}
            <div className="text-center pt-4">
              <p className="text-sm text-gray-600">
                {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setStatusMessage('')
                  }}
                  className="ml-1 text-purple-600 hover:text-purple-700 font-semibold transition-colors"
                >
                  {isLogin ? 'Criar conta' : 'Fazer login'}
                </button>
              </p>
            </div>

            {/* Terms */}
            {!isLogin && (
              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  Ao criar uma conta, você concorda com nossos{' '}
                  <Link href="/terms" className="text-purple-600 hover:text-purple-700 transition-colors">
                    Termos de Uso
                  </Link>{' '}
                  e{' '}
                  <Link href="/privacy" className="text-purple-600 hover:text-purple-700 transition-colors">
                    Política de Privacidade
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Benefits */}
        {!isLogin && (
          <div className="mt-8 text-center">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 hover:bg-white/80 transition-all">
                <div className="text-purple-600 text-2xl mb-2">🚀</div>
                <h3 className="font-semibold text-gray-900 text-sm">Setup Rápido</h3>
                <p className="text-xs text-gray-600">Pronto em 5 minutos</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 hover:bg-white/80 transition-all">
                <div className="text-purple-600 text-2xl mb-2">🤖</div>
                <h3 className="font-semibold text-gray-900 text-sm">IA Integrada</h3>
                <p className="text-xs text-gray-600">Automação inteligente</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 hover:bg-white/80 transition-all">
                <div className="text-purple-600 text-2xl mb-2">📈</div>
                <h3 className="font-semibold text-gray-900 text-sm">Resultados</h3>
                <p className="text-xs text-gray-600">340% mais conversões</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
