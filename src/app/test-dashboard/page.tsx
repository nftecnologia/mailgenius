export default function TestDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-green-800 mb-4">
          🎉 REDIRECIONAMENTO FUNCIONOU!
        </h1>
        <p className="text-green-600">
          Esta é uma página de teste para verificar se o roteamento está funcionando.
        </p>
        <div className="mt-4">
          <a
            href="/dashboard"
            className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Ir para Dashboard Real
          </a>
        </div>
      </div>
    </div>
  )
}
