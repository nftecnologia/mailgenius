'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestLoginPage() {
  const [authStatus, setAuthStatus] = useState<string>('Verificando...')

  useEffect(() => {
    // Verificar estado atual
    const checkCurrentState = () => {
      const auth = localStorage.getItem('mailgenius_auth')
      const user = localStorage.getItem('mailgenius_user')
      setAuthStatus(`Auth: ${auth || 'null'} | User: ${user ? 'definido' : 'null'}`)
    }

    checkCurrentState()

    // Limpar qualquer estado de login existente
    localStorage.removeItem('mailgenius_auth')
    localStorage.removeItem('mailgenius_user')

    setTimeout(checkCurrentState, 100)
  }, [])

  const simulateLogin = () => {
    console.log('🔄 Simulando login...')

    try {
      // Simular login bem-sucedido
      localStorage.setItem('mailgenius_auth', 'true')
      localStorage.setItem('mailgenius_user', JSON.stringify({
        name: 'Usuário Teste',
        email: 'teste@email.com'
      }))

      // Verificar se foi definido
      const authCheck = localStorage.getItem('mailgenius_auth')
      console.log('✅ Auth definido:', authCheck)

      if (authCheck === 'true') {
        console.log('🔄 Redirecionando para dashboard...')

        // Usar location.replace para evitar problemas de histórico
        window.location.replace('/dashboard')
      } else {
        console.error('❌ Falha ao definir localStorage')
        alert('Erro: localStorage não foi definido corretamente')
      }
    } catch (error) {
      console.error('❌ Erro no localStorage:', error)
      alert('Erro: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const clearLogin = () => {
    localStorage.removeItem('mailgenius_auth')
    localStorage.removeItem('mailgenius_user')
    window.location.href = '/auth'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Teste de Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Esta página permite testar o fluxo de login sem precisar preencher formulários.
          </p>

          {/* Status atual */}
          <div className="p-3 bg-gray-100 rounded-lg">
            <p className="text-xs font-mono">{authStatus}</p>
          </div>

          <div className="space-y-3">
            <Button onClick={simulateLogin} className="w-full bg-green-600 hover:bg-green-700">
              🟢 Simular Login Sucesso ✓
            </Button>

            <Button onClick={clearLogin} variant="outline" className="w-full">
              🔄 Limpar Login e ir para Auth
            </Button>

            <Button
              onClick={() => {
                console.log('🔄 Navegando para /auth...')
                window.location.href = '/auth'
              }}
              variant="outline"
              className="w-full"
            >
              🔗 Ir para página de Auth
            </Button>

            <Button
              onClick={() => {
                console.log('🔄 Tentando acessar /dashboard...')
                window.location.href = '/dashboard'
              }}
              variant="outline"
              className="w-full"
            >
              🎯 Tentar acessar Dashboard
            </Button>

            <Button
              onClick={() => {
                const auth = localStorage.getItem('mailgenius_auth')
                const user = localStorage.getItem('mailgenius_user')
                console.log('📊 Estado atual:', { auth, user })
                alert(`Auth: ${auth}\nUser: ${user}`)
              }}
              variant="outline"
              className="w-full"
            >
              📊 Verificar Estado Atual
            </Button>

            <Button
              onClick={() => {
                localStorage.setItem('mailgenius_auth', 'true')
                localStorage.setItem('mailgenius_user', '{"name":"Test","email":"test@test.com"}')
                const newAuth = localStorage.getItem('mailgenius_auth')
                console.log('✅ localStorage definido, verificando:', newAuth)
                setAuthStatus(`NOVO: Auth: ${newAuth} | User: definido`)
              }}
              variant="outline"
              className="w-full"
            >
              💾 Definir localStorage (sem redirect)
            </Button>
          </div>

          <div className="text-xs text-gray-500 mt-4">
            <p><strong>Como testar:</strong></p>
            <p>1. Clique em "Simular Login Sucesso" para ser redirecionado ao dashboard</p>
            <p>2. Clique em "Limpar Login" para ser redirecionado à página de auth</p>
            <p>3. Tente acessar o dashboard sem login para ver o redirecionamento</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
