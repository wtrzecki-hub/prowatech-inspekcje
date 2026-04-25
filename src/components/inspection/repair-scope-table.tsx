'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, Check, Plus, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * PIIB sekcja IV (roczny) / VI (5-letni) — Określenie zakresu robót
 * remontowych i kolejności ich wykonywania.
 *
 * Zastępuje stary `RepairTable` (NG/NB/K + pilność I-IV) prostszym układem PIIB:
 * - Lp
 * - Zakres czynności (TEXT required)
 * - Termin wykonania (text dowolny lub data)
 * - Status wykonania (checkbox + completion_date)
 *
 * CRUD na tabeli `repair_scope_items`. Auto-save 800ms.
 */

interface RepairScopeItem {
  id: string
  inspection_id: string
  item_number: number
  scope_description: string
  deadline_text: string | null
  deadline_date: string | null
  is_completed: boolean
  completion_date: string | null
  completion_notes: string | null
}

interface RepairScopeTableProps {
  inspectionId: string
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

export function RepairScopeTable({ inspectionId }: RepairScopeTableProps) {
  const [items, setItems] = useState<RepairScopeItem[]>([])
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
        .from('repair_scope_items')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Błąd ładowania zakresu robót:', err)
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
        .from('repair_scope_items')
        .insert({
          inspection_id: inspectionId,
          item_number: nextNumber,
          scope_description: '',
          deadline_text: null,
          deadline_date: null,
          is_completed: false,
        })
        .select()
        .single()

      if (error) throw error
      if (data) setItems((prev) => [...prev, data as RepairScopeItem])
    } catch (err) {
      console.error('Błąd dodawania pozycji:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = (
    id: string,
    field: keyof RepairScopeItem,
    value: string | boolean | null
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const updateData: Record<string, unknown> = { [field]: value }

        // Auto-set completion_date gdy is_completed = true
        if (field === 'is_completed') {
          updateData.completion_date = value
            ? new Date().toISOString().slice(0, 10)
            : null
        }

        const { error } = await supabase()
          .from('repair_scope_items')
          .update(updateData)
          .eq('id', id)
        if (error) throw error

        // Sync state for completion_date
        if (field === 'is_completed') {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id
                ? {
                    ...it,
                    completion_date: (updateData.completion_date as string) || null,
                  }
                : it
            )
          )
        }
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
        .from('repair_scope_items')
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

  const completedCount = items.filter((i) => i.is_completed).length

  return (
    <Card className="rounded-xl border-graphite-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Zakres robót remontowych i kolejność wykonywania</span>
          {items.length > 0 && (
            <span className="text-sm font-normal text-graphite-500">
              {completedCount} / {items.length} wykonanych
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-graphite-500">
            Brak pozycji. Dodaj wymagane prace remontowe wynikające z kontroli
            (kolejność wg priorytetu).
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={`grid grid-cols-12 gap-3 items-start rounded-xl border p-3 shadow-xs ${
                  item.is_completed
                    ? 'border-success-200 bg-success-50/40'
                    : 'border-graphite-200 hover:bg-graphite-50'
                }`}
              >
                <div className="col-span-1 flex items-center justify-center pt-2 font-mono text-sm font-semibold text-graphite-500">
                  {item.item_number}.
                </div>
                <div className="col-span-6 space-y-1">
                  <Label
                    htmlFor={`scope-${item.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Zakres czynności
                  </Label>
                  <Textarea
                    id={`scope-${item.id}`}
                    value={item.scope_description}
                    onChange={(e) =>
                      handleUpdate(item.id, 'scope_description', e.target.value)
                    }
                    placeholder="Opis prac remontowych do wykonania…"
                    rows={2}
                    className={
                      item.is_completed ? 'line-through text-graphite-500' : ''
                    }
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs text-graphite-500">
                    Termin wykonania
                  </Label>
                  <Input
                    value={item.deadline_text || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'deadline_text', e.target.value)
                    }
                    placeholder='np. "do 30.06.2026" lub "natychmiast"'
                  />
                  <div className="flex items-center gap-1 mt-1">
                    <Calendar size={14} className="text-graphite-400" />
                    <Input
                      type="date"
                      value={item.deadline_date || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'deadline_date',
                          e.target.value || null
                        )
                      }
                      className="h-8 text-xs"
                      title="Data deadline (do sortowania / alertów)"
                    />
                  </div>
                </div>
                <div className="col-span-2 flex flex-col items-start gap-1 pt-5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`done-${item.id}`}
                      checked={item.is_completed}
                      onCheckedChange={(checked) =>
                        handleUpdate(item.id, 'is_completed', !!checked)
                      }
                    />
                    <Label
                      htmlFor={`done-${item.id}`}
                      className="text-sm cursor-pointer flex items-center gap-1"
                    >
                      {item.is_completed && (
                        <Check size={14} className="text-success" />
                      )}
                      Wykonane
                    </Label>
                  </div>
                  {item.is_completed && item.completion_date && (
                    <span className="text-xs text-graphite-500 font-mono">
                      {new Date(item.completion_date).toLocaleDateString('pl-PL')}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-danger hover:bg-danger-50 hover:text-danger-800 h-7 px-2 mt-1"
                    title="Usuń pozycję"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button onClick={handleAdd} disabled={isSaving} size="sm">
          <Plus size={16} className="mr-1" />
          Dodaj pozycję
        </Button>

        {isSaving && (
          <p className="text-xs text-graphite-400 text-right">Zapisywanie…</p>
        )}
      </CardContent>
    </Card>
  )
}
