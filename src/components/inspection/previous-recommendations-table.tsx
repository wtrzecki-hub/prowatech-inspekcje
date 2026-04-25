'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { COMPLETION_STATUSES } from '@/lib/constants'

/**
 * PIIB sekcja II — Ocena realizacji zaleceń z poprzedniej kontroli.
 *
 * Tabela 4-kolumnowa: Lp / Zalecenie / Stopień wykonania (tak/nie/w_trakcie) / Uwagi.
 *
 * Opcjonalnie auto-fill: gdy turbinaId jest podane i tabela pusta, można
 * pobrać zalecenia z poprzedniej zakończonej inspekcji tej turbiny i
 * pre-populować jako "do oceny" — wtedy inspektor tylko zaznacza status.
 *
 * CRUD na tabeli `previous_recommendations`. Auto-save 800ms.
 */

interface PreviousRecommendation {
  id: string
  inspection_id: string
  item_number: number
  recommendation_text: string | null
  completion_status: 'tak' | 'nie' | 'w_trakcie' | null
  remarks: string | null
}

interface PreviousRecommendationsTableProps {
  inspectionId: string
  /** Opcjonalnie: ID turbiny — używane do auto-fill z poprzedniej inspekcji. */
  turbineId?: string
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

export function PreviousRecommendationsTable({
  inspectionId,
  turbineId,
}: PreviousRecommendationsTableProps) {
  const [items, setItems] = useState<PreviousRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
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
        .from('previous_recommendations')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Błąd ładowania zaleceń poprzedniej kontroli:', err)
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
        .from('previous_recommendations')
        .insert({
          inspection_id: inspectionId,
          item_number: nextNumber,
          recommendation_text: null,
          completion_status: null,
          remarks: null,
        })
        .select()
        .single()

      if (error) throw error
      if (data) setItems((prev) => [...prev, data as PreviousRecommendation])
    } catch (err) {
      console.error('Błąd dodawania zalecenia:', err)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Auto-fill: pobierz zalecenia z poprzedniej zakończonej inspekcji tej turbiny
   * i wstaw jako "do oceny" w bieżącej. Próbujemy 2 źródła w kolejności:
   * 1. repair_scope_items z poprzedniej inspekcji (PIIB)
   * 2. repair_recommendations.scope_description (legacy)
   */
  const handleImportPrevious = async () => {
    if (!turbineId) return
    setIsImporting(true)
    try {
      const sb = supabase()

      // Znajdź ostatnią zakończoną inspekcję tej turbiny (oprócz bieżącej)
      const { data: prevInspections, error: prevErr } = await sb
        .from('inspections')
        .select('id, inspection_date, status')
        .eq('turbine_id', turbineId)
        .neq('id', inspectionId)
        .in('status', ['completed', 'signed'])
        .not('is_deleted', 'is', true)
        .order('inspection_date', { ascending: false })
        .limit(1)

      if (prevErr) throw prevErr
      const prev = prevInspections?.[0]
      if (!prev) {
        alert('Brak poprzedniej zakończonej inspekcji dla tej turbiny.')
        return
      }

      // Spróbuj repair_scope_items (nowy PIIB)
      let recommendations: { text: string }[] = []
      const { data: scopeData } = await sb
        .from('repair_scope_items')
        .select('scope_description')
        .eq('inspection_id', prev.id)
        .order('item_number', { ascending: true })

      if (scopeData && scopeData.length > 0) {
        recommendations = scopeData.map((s) => ({
          text: s.scope_description as string,
        }))
      } else {
        // Fallback: legacy repair_recommendations
        const { data: legacyData } = await sb
          .from('repair_recommendations')
          .select('scope_description')
          .eq('inspection_id', prev.id)

        recommendations = (legacyData || []).map((r) => ({
          text: r.scope_description as string,
        }))
      }

      if (recommendations.length === 0) {
        alert('Poprzednia inspekcja nie zawierała zaleceń remontowych.')
        return
      }

      const baseNumber =
        items.length > 0 ? Math.max(...items.map((i) => i.item_number)) : 0

      const toInsert = recommendations.map((r, idx) => ({
        inspection_id: inspectionId,
        item_number: baseNumber + idx + 1,
        recommendation_text: r.text,
        completion_status: null,
        remarks: null,
      }))

      const { data: inserted, error: insertErr } = await sb
        .from('previous_recommendations')
        .insert(toInsert)
        .select()

      if (insertErr) throw insertErr
      if (inserted) {
        setItems((prev) => [...prev, ...(inserted as PreviousRecommendation[])])
      }
    } catch (err) {
      console.error('Błąd importu z poprzedniej inspekcji:', err)
      alert('Błąd podczas importu zaleceń. Sprawdź konsolę.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleUpdate = (
    id: string,
    field: 'recommendation_text' | 'completion_status' | 'remarks',
    value: string | null
  ) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              [field]:
                field === 'completion_status'
                  ? (value as 'tak' | 'nie' | 'w_trakcie' | null)
                  : value || null,
            }
          : i
      )
    )

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase()
          .from('previous_recommendations')
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
        .from('previous_recommendations')
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

  const statusBadgeClasses: Record<string, string> = {
    tak: 'bg-success-100 text-success-800',
    nie: 'bg-danger-100 text-danger-800',
    w_trakcie: 'bg-warning-100 text-warning-800',
  }

  return (
    <Card className="rounded-xl border-graphite-200">
      <CardHeader>
        <CardTitle className="text-lg">
          Ocena realizacji zaleceń z poprzedniej kontroli
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-graphite-500">
            Brak zaleceń z poprzedniej kontroli.{' '}
            {turbineId
              ? 'Dodaj ręcznie lub zaimportuj z poprzedniej zakończonej inspekcji tej turbiny.'
              : 'Dodaj ręcznie poniżej.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-12 gap-3 items-start rounded-xl border border-graphite-200 p-3 shadow-xs hover:bg-graphite-50"
              >
                <div className="col-span-1 flex items-center justify-center pt-2 font-mono text-sm font-semibold text-graphite-500">
                  {item.item_number}.
                </div>
                <div className="col-span-5 space-y-1">
                  <Label
                    htmlFor={`rec-${item.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Zalecenie z poprzedniej kontroli
                  </Label>
                  <Textarea
                    id={`rec-${item.id}`}
                    value={item.recommendation_text || ''}
                    onChange={(e) =>
                      handleUpdate(
                        item.id,
                        'recommendation_text',
                        e.target.value
                      )
                    }
                    placeholder="Treść zalecenia z poprzedniego protokołu…"
                    rows={2}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label
                    htmlFor={`status-${item.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Stopień wykonania
                  </Label>
                  <Select
                    value={item.completion_status || 'none'}
                    onValueChange={(val) =>
                      handleUpdate(
                        item.id,
                        'completion_status',
                        val === 'none' ? null : val
                      )
                    }
                  >
                    <SelectTrigger id={`status-${item.id}`}>
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— nie określono —</SelectItem>
                      {COMPLETION_STATUSES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {item.completion_status && (
                    <Badge
                      className={`${statusBadgeClasses[item.completion_status]} mt-1 border-0 text-xs`}
                    >
                      {
                        COMPLETION_STATUSES.find(
                          (s) => s.value === item.completion_status
                        )?.label
                      }
                    </Badge>
                  )}
                </div>
                <div className="col-span-3 space-y-1">
                  <Label
                    htmlFor={`remarks-${item.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Uwagi
                  </Label>
                  <Input
                    id={`remarks-${item.id}`}
                    value={item.remarks || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'remarks', e.target.value)
                    }
                    placeholder="Dodatkowe komentarze…"
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

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleAdd} disabled={isSaving} size="sm">
            <Plus size={16} className="mr-1" />
            Dodaj zalecenie
          </Button>
          {turbineId && (
            <Button
              onClick={handleImportPrevious}
              disabled={isImporting}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                size={16}
                className={`mr-1 ${isImporting ? 'animate-spin' : ''}`}
              />
              {isImporting
                ? 'Importowanie…'
                : 'Importuj z poprzedniej inspekcji'}
            </Button>
          )}
        </div>

        {isSaving && (
          <p className="text-xs text-graphite-400 text-right">Zapisywanie…</p>
        )}
      </CardContent>
    </Card>
  )
}
