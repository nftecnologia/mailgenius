'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useSupabaseAuth } from '@/lib/hooks/useSupabaseAuth'
import { SignInForm } from './auth-form/SignInForm'
import { SignUpForm } from './auth-form/SignUpForm'
import { OAuthSection } from './auth-form/OAuthSection'

export default function AuthForm() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signIn, signUp, user, isAuthenticated } = useSupabaseAuth()

  // Check if Supabase is properly configured
  const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('User already authenticated, redirecting...')
      router.push('/dashboard')
    }
  }, [isAuthenticated, user, router])

  const handleSignIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      toast.error('Sistema em modo de demonstração. Configure o Supabase para usar autenticação real.')
      return
    }

    try {
      setLoading(true)
      await signIn(email, password)
      // The useSupabaseAuth hook will handle the redirect automatically
    } catch (error: any) {
      toast.error(`Erro no login: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (email: string, password: string, name: string, workspaceName: string) => {
    if (!isSupabaseConfigured) {
      toast.error('Sistema em modo de demonstração. Configure o Supabase para usar autenticação real.')
      return
    }

    try {
      setLoading(true)
      await signUp(email, password, name)
      toast.success('Conta criada com sucesso! Verifique seu email se necessário.')
      // The useSupabaseAuth hook will handle the redirect automatically
    } catch (error: any) {
      toast.error(`Erro no cadastro: ${error.message}`)
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
      // This would need to be implemented in the useSupabaseAuth hook
      toast.info('Autenticação Google em desenvolvimento')
    } catch (error: any) {
      toast.error(`Erro na autenticação: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Don't render if already authenticated
  if (isAuthenticated) {
    return null
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

            <TabsContent value="signin">
              <SignInForm onSignIn={handleSignIn} loading={loading} />
            </TabsContent>

            <TabsContent value="signup">
              <SignUpForm onSignUp={handleSignUp} loading={loading} />
            </TabsContent>
          </Tabs>

          <OAuthSection onGoogleAuth={handleGoogleAuth} loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}