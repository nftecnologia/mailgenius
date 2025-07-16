'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Mail, Lock, User, Building } from 'lucide-react'

export default function AuthForm() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Check if Supabase is properly configured
  const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

  // Check if user is already logged in on component mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('Sessão já existe, redirecionando...')
        window.location.replace('/dashboard')
      }
    }

    if (isSupabaseConfigured) {
      checkSession()
    }
  }, [supabase, isSupabaseConfigured])

  // Monitor auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session)

        if (event === 'SIGNED_IN' && session) {
          console.log('🎉 Usuário logado! Testando redirecionamento...')
          toast.success('Autenticação realizada com sucesso!')

          // Teste com página simples primeiro
          console.log('🧪 Redirecionamento de teste para /test-dashboard')
          setTimeout(() => {
            window.location.href = '/test-dashboard'
          }, 1000)
        }

        if (event === 'SIGNED_OUT') {
          console.log('Usuário deslogado')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, router])

  const handleSignIn = async () => {
    if (!isSupabaseConfigured) {
      toast.error('Sistema em modo de demonstração. Configure o Supabase para usar autenticação real.')
      return
    }

    try {
      setLoading(true)
      console.log('Tentando fazer login...')

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Resultado do login:', { data, error })

      if (error) {
        console.error('Erro no login:', error)
        toast.error('Erro no login: ' + error.message)
        return
      }

      if (data.session) {
        console.log('✅ Sessão criada! O listener vai redirecionar automaticamente')
      } else {
        console.log('Login sem sessão - pode precisar confirmar email')
        toast.info('Verifique seu email para confirmar o login')
      }
    } catch (error) {
      console.error('Erro inesperado no login:', error)
      toast.error('Erro inesperado no login')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!isSupabaseConfigured) {
      toast.error('Sistema em modo de demonstração. Configure o Supabase para usar autenticação real.')
      return
    }

    try {
      setLoading(true)

      if (!name || !workspaceName) {
        toast.error('Preencha todos os campos obrigatórios')
        return
      }

      console.log('Tentando criar conta...')

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            workspace_name: workspaceName,
          },
        },
      })

      console.log('Resultado do cadastro:', { data, error })

      if (error) {
        console.error('Erro no cadastro:', error)
        toast.error('Erro no cadastro: ' + error.message)
        return
      }

      if (data.user && !data.session) {
        console.log('Usuário criado, mas precisa confirmar email')
        toast.success('Verifique seu email para confirmar o cadastro!')
      } else if (data.session) {
        console.log('✅ Conta criada com sessão! O listener vai redirecionar automaticamente')
      } else {
        console.log('Situação inesperada no cadastro:', data)
        toast.info('Conta criada! Verifique seu email se necessário.')
      }
    } catch (error) {
      console.error('Error no cadastro:', error)
      toast.error('Erro inesperado no cadastro')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    if (!isSupabaseConfigured) {
      toast.error('Sistema em modo de demonstração. Configure o Supabase para usar autenticação real.')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast.error('Erro na autenticação: ' + error.message)
      }
    } catch (error) {
      toast.error('Erro inesperado na autenticação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EmailSend
          </CardTitle>
          <CardDescription>
            Plataforma inteligente de Email Marketing
          </CardDescription>
          {!isSupabaseConfigured && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                🚧 Sistema em modo de demonstração. Para usar autenticação real, configure o Supabase.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome"
                    className="pl-10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-name">Nome da empresa/workspace</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="workspace-name"
                    type="text"
                    placeholder="Nome da sua empresa"
                    className="pl-10"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="********"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={handleSignUp}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Cadastrando...' : 'Criar conta'}
              </Button>
            </TabsContent>
          </Tabs>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou continue com
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full mt-4"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
