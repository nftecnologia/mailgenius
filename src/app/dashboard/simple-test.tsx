'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function SimpleDashboardTest() {
  const [authState, setAuthState] = useState('checking')
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    // Simple, single auth check
    console.log('🔍 Simple dashboard auth check...')

    const auth = localStorage.getItem('mailgenius_auth')
    const user = localStorage.getItem('mailgenius_user')

    console.log('Auth:', auth, 'User:', user)

    if (auth === 'true') {
      console.log('✅ Auth OK - showing dashboard')
      setAuthState('authenticated')
      setUserInfo(user ? JSON.parse(user) : null)
    } else {
      console.log('❌ No auth - redirecting')
      setAuthState('redirecting')
      window.location.href = '/auth'
    }
  }, [])

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Verificando autenticação...</p>
        </div>
      </div>
    )
  }

  if (authState === 'redirecting') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p>Redirecionando para login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">MailGenius Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Olá, {userInfo?.name || 'Usuário'}!
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem('mailgenius_auth')
                  localStorage.removeItem('mailgenius_user')
                  window.location.href = '/auth'
                }}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  🎉 Login Funcionando Perfeitamente!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Parabéns! O sistema de login está funcionando corretamente.</p>
                </div>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Informações do Usuário</h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nome</dt>
                <dd className="mt-1 text-sm text-gray-900">{userInfo?.name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{userInfo?.email || 'N/A'}</dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Ações Rápidas</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                Dashboard Completo
              </Link>
              <Link
                href="/auth"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Página de Auth
              </Link>
              <button
                onClick={() => {
                  console.log('Auth:', localStorage.getItem('mailgenius_auth'))
                  console.log('User:', localStorage.getItem('mailgenius_user'))
                  alert('Verifique o console para dados de auth')
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Debug Auth
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
