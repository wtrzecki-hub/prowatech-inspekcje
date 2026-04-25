'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * PIIB sekcja II — Stan awaryjny stwierdzony w wyniku przeglądu.
 *
 * Tabela 3-kolumnowa: Lp / Element obiektu / Zakres pilnego remontu.
 * W większości protokołów ta sekcja jest pusta (brak stanu awaryjnego).
 * Jeśli inspektor coś tu wpisze, jest to silny sygnał — zalecane też
 * niezwłoczne pisemne poinformowanie PINB zgodnie z art. 70 ust. 1 PB.
 *
 * CRUD na tabeli `emergency_state_items`. Auto-save 800ms.
 */

interface EmergencyItem {
  id: string
  inspection_id: string
  item_number: number
  element_name: string | null
  urgent_repair_scope: string | null
}

interface EmergencyStateTableProps {
  inspectionId: string
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

export function EmergencyStateTable({ inspectionId }: EmergencyStateTableProps) {
  const [items, setItems] = useState<EmergencyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    void loadItems()
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const loadItems = async () => {
    try {
      const { data, error } = await supabase()
        .from('emergency_state_items')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Błąd ładowania stanu awaryjnego:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    setIsSaving(true)
    try {
      const nextNumber =
        items.length > 0
          ? Math.max(...items.map((i) => i.item_number)) + 1
          : 1

      const { data, error } = await supabase()
        .from('emergency_state_items')
        .insert({
          inspection_id: inspectionId,
          item_number: nextNumber,
          element_name: null,
          urgent_repair_scope: null,
        })
        .select()
        .single()

      if (error) throw error
      if (data) setItems((prev) => [...prev, data as EmergencyItem])
    } catch (err) {
      console.error('Błąd dodawania pozycji stanu awaryjnego:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = (
    id: string,
    field: 'element_name' | 'urgent_repair_scope',
    value: string
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value || null } : i))
    )

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase()
          .from('emergency_state_items')
          .update({ [field]: value || null })
          .eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zapisu:', err)
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const { error } = await supabase()
        .from('emergency_state_items')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('Błąd usuwania:', err)
      void loadItems()
    }
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl border-graphite-200">
        <CardContent className="py-8 text-center text-graphite-500">
          Ładowanie…
        </CardContent>
      </Card>
    )
  }

  const hasItems = items.length > 0

  return (
    <Card
      className={`rounded-xl ${
        hasItems
          ? 'border-danger-200 bg-danger-50/40'
          : 'border-graphite-200'
      }`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {hasItems && <AlertTriangle size={20} className="text-danger" />}
          Stan awaryjny stwierdzony w wyniku przeglądu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasItems && (
          <p className="text-sm text-graphite-500">
            Nie stwierdzono stanu awaryjnego. Jeśli podczas kontroli zauważysz
            element wymagający natychmiastowego remontu / zabezpieczenia —
            dodaj wiersz poniżej.
          </p>
        )}

        {hasItems && (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-12 gap-3 items-start rounded-xl border border-danger-200 bg-white p-3 shadow-xs"
              >
                <div className="col-span-1 flex items-center justify-center pt-2 font-mono text-sm font-semibold text-danger-800">
                  {item.item_number}.
                </div>
                <div className="col-span-4 space-y-1">
                  <Label
                    htmlFor={`elem-${item.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Element obiektu
                  </Label>
                  <Input
                    id={`elem-${item.id}`}
                    value={item.element_name || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'element_name', e.target.value)
                    }
                    placeholder="np. Drabina wewnętrzna sekcji 2"
                  />
                </div>
                <div className="col-span-6 space-y-1">
                  <Label
                    htmlFor={`scope-${item.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Zakres pilnego remontu, naprawy lub robót zabezpieczających
                  </Label>
                  <Textarea
                    id={`scope-${item.id}`}
                    value={item.urgent_repair_scope || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'urgent_repair_scope', e.target.value)
                    }
                    placeholder="Opis wymaganych robót pilnych…"
                    rows={2}
                  />
                </div>
                <div className="col-span-1 flex items-center justify-center pt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-danger hover:bg-danger-50 hover:text-danger-800"
                    title="Usuń pozycję"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button
          onClick={handleAdd}
          disabled={isSaving}
          variant={hasItems ? 'outline' : 'default'}
          size="sm"
        >
          <Plus size={16} className="mr-1" />
          {hasItems ? 'Dodaj kolejną pozycję' : 'Dodaj pozycję stanu awaryjnego'}
        </Button>

        {hasItems && (
          <p className="text-xs text-danger-800 bg-danger-50 rounded p-2">
            ⚠ Zalecane: niezwłoczne pisemne poinformowanie właściwego miejscowo
            powiatowego inspektoratu nadzoru budowlanego (PINB) zgodnie z
            art. 70 ust. 1 ustawy Prawo budowlane.
          </p>
        )}

        {isSaving && (
          <p className="text-xs text-graphite-400 text-right">Zapisywanie…</p>
        )}
      </CardContent>
    </Card>
  )
}
