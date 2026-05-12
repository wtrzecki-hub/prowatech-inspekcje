/**
 * Hook ładuje listę aktywnych elementów PIIB z `inspection_element_definitions`
 * — używany w polu „Element / lokalizacja" w tabelach zaleceń jako podpowiedzi
 * datalist.
 *
 * Uwaga Artura 2026-05-12: legacy zalecenia z hpr nie mają wpisanego
 * `element_name`. Inspektor wpisuje sam — żeby ułatwić, podpowiadamy listą
 * wszystkich aktywnych elementów. Wartość pola pozostaje wolnym tekstem
 * (np. inspektor może wpisać „Wieża segment 2" które nie jest w liście).
 */

'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

/**
 * Cache na poziomie modułu — żeby przy wielu instancjach komponentów
 * (każdy wiersz zaleceń ma swoje pole) nie odpalać 5+ równoległych
 * fetchów do tej samej tabeli.
 */
let cachedOptions: string[] | null = null
let inflightFetch: Promise<string[]> | null = null

async function fetchElementOptions(): Promise<string[]> {
  if (cachedOptions) return cachedOptions
  if (inflightFetch) return inflightFetch

  const sb = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  inflightFetch = (async () => {
    const { data, error } = await sb
      .from('inspection_element_definitions')
      .select('name_pl, element_number')
      .eq('is_active', true)
      .order('element_number', { ascending: true })

    if (error) {
      console.error('Nie udało się załadować listy elementów:', error)
      inflightFetch = null
      return []
    }
    const rows = (data || []) as Array<{
      name_pl: string
      element_number: number
    }>
    const names = rows.map((r) => r.name_pl).filter(Boolean)
    cachedOptions = names
    return names
  })()
  return inflightFetch
}

export function useElementOptions(): {
  options: string[]
  isLoading: boolean
} {
  const [options, setOptions] = useState<string[]>(cachedOptions || [])
  const [isLoading, setIsLoading] = useState(!cachedOptions)

  useEffect(() => {
    if (cachedOptions) {
      setOptions(cachedOptions)
      setIsLoading(false)
      return
    }
    let cancelled = false
    void fetchElementOptions().then((opts) => {
      if (cancelled) return
      setOptions(opts)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { options, isLoading }
}
