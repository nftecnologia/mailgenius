'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function FixRLSNowPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const fixRLS = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/fix-rls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to fix RLS',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Fix RLS Issues</h1>

          <p className="mb-4">
            Click the button below to apply all necessary RLS (Row Level Security) policies to your Supabase database.
          </p>

          <Button
            onClick={fixRLS}
            disabled={loading}
            className="mb-4"
          >
            {loading ? 'Fixing...' : 'Fix RLS Now'}
          </Button>

          {result && (
            <div className={`p-4 rounded ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
              <p className={`font-bold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.message}
              </p>

              {result.results && (
                <div className="mt-4 space-y-2">
                  {result.results.map((r: any, i: number) => (
                    <div key={i} className={`text-sm ${r.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                      {r.sql.substring(0, 50)}... - {r.status}
                    </div>
                  ))}
                </div>
              )}

              {result.error && (
                <p className="text-sm text-red-700 mt-2">
                  Error: {result.error}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
