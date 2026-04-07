'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DiagnostykaPage() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runDiagnostics()
  }, [])

  async function runDiagnostics() {
    const supabase = createClient()
    const diag: any = {}

    // Test 1: Auth session
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      diag.auth = {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        role: session?.user?.role,
        error: error?.message,
      }
    } catch (e: any) {
      diag.auth = { error: e.message }
    }

    // Test 2: Simple clients query
    try {
      const { data, error, count } = await supabase
        .from('clients')
        .select('id, name', { count: 'exact' })
        .limit(3)
      diag.clients = {
        count: count,
        dataLength: data?.length,
        sample: data?.map(d => d.name),
        error: error?.message,
        errorDetails: error ? JSON.stringify(error) : null,
      }
    } catch (e: any) {
      diag.clients = { error: e.message }
    }

    // Test 3: Clients with is_deleted filter
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .not('is_deleted', 'is', true)
        .limit(3)
      diag.clientsFiltered = {
        dataLength: data?.length,
        sample: data?.map(d => d.name),
        error: error?.message,
        errorDetails: error ? JSON.stringify(error) : null,
      }
    } catch (e: any) {
      diag.clientsFiltered = { error: e.message }
    }

    // Test 4: Wind farms
    try {
      const { data, error } = await supabase
        .from('wind_farms')
        .select('id, name')
        .limit(3)
      diag.windFarms = {
        dataLength: data?.length,
        sample: data?.map(d => d.name),
        error: error?.message,
      }
    } catch (e: any) {
      diag.windFarms = { error: e.message }
    }

    // Test 5: Turbines
    try {
      const { data, error } = await supabase
        .from('turbines')
        .select('id, turbine_code, manufacturer')
        .limit(3)
      diag.turbines = {
        dataLength: data?.length,
        sample: data?.map(d => `${d.manufacturer} ${d.turbine_code}`),
        error: error?.message,
      }
    } catch (e: any) {
      diag.turbines = { error: e.message }
    }

    // Test 6: Profile
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
      diag.profiles = {
        dataLength: data?.length,
        data: data,
        error: error?.message,
      }
    } catch (e: any) {
      diag.profiles = { error: e.message }
    }

    setResults(diag)
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Diagnostyka Supabase</h1>
      {loading ? (
        <p>Sprawdzam połączenie z bazą danych...</p>
      ) : (
        <pre className="bg-gray-900 text-green-400 p-6 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
          {JSON.stringify(results, null, 2)}
        </pre>
      )}
    </div>
  )
}
