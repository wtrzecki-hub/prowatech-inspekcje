'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { COMPLETION_STATUSES } from '@/lib/constants'

/**
 * PIIB sekcja II — Ocena realizacji zaleceń z poprzedniej kontroli.
 *
 * Tabela 4-kolumnowa: Lp / Zalecenie / Stopień wykonania (tak/nie/w_trakcie) / Uwagi.
 *
 * AUTO-IMPORT (Krok 5 z roadmapy uwag Artura, 2026-04-27): gdy `turbineId`
 * jest podane i tabela pusta, automatycznie na pierwszym mount-cie ciągniemy
 * zalecenia z ostatniej zakończonej inspekcji tej turbiny. Bez button-clicka.
 * Banner pokazuje datę + ilość zaimportowanych. User może doedytować.
 *
 * Opcjonalnie ręczny re-import też dostępny — przycisk „Importuj ponownie"
 * dla przypadków gdy auto-import nie zadziałał (brak poprzedniej inspekcji,
 * itp.).
 *
 * Toggle button group dla `completion_status` (Wykonano / Nie / W trakcie /
 * —) zamiast Selectu — większe touch targety dla tabletu w terenie.
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

interface AutoImportInfo {
  /** Ile zaleceń zaimportowano w tej sesji. */
  count: number
  /** Data poprzedniej inspekcji (ISO string, np. '2025-04-15'). */
  fromDate: string | null
  /** Numer protokołu poprzedniej inspekcji jeśli jest. */
  fromProtocolNumber: string | null
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
  const [autoImportInfo, setAutoImportInfo] = useState<AutoImportInfo | null>(
    null,
  )
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const autoImportTriedRef = useRef(false)

  useEffect(() => {
    void loadItemsAndMaybeAutoImport()
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const loadItemsAndMaybeAutoImport = async () => {
    try {
      const { data, error } = await supabase()
        .from('previous_recommendations')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      const loaded = (data || []) as PreviousRecommendation[]
      setItems(loaded)

      // Auto-import: pierwszy mount, brak wpisów, mamy turbineId. Cisza, bez
      // przycisku — inspektor po prostu widzi listę gotową do uzupełnienia.
      if (
        !autoImportTriedRef.current &&
        loaded.length === 0 &&
        turbineId
      ) {
        autoImportTriedRef.current = true
        await runAutoImport()
      }
    } catch (err) {
      console.error('Błąd ładowania zaleceń poprzedniej kontroli:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadItems = async () => {
    try {
      const { data, error } = await supabase()
        .from('previous_recommendations')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })
      if (error) throw error
      setItems((data || []) as PreviousRecommendation[])
    } catch (err) {
      console.error('Błąd ładowania zaleceń poprzedniej kontroli:', err)
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
   * Wewnętrzna logika importu — używana przez auto-import na mount oraz
   * przez ręczny przycisk „Importuj ponownie".
   *
   * Próbuje 2 źródeł w kolejności:
   *   1. repair_scope_items z poprzedniej inspekcji (PIIB Faza 10)
   *   2. repair_recommendations.scope_description (legacy)
   *
   * Zwraca metadata o tym co zostało zaimportowane, lub null jeśli nic.
   */
  const runAutoImport = async (
    options: { silent?: boolean } = {},
  ): Promise<AutoImportInfo | null> => {
    if (!turbineId) return null
    setIsImporting(true)
    try {
      const sb = supabase()

      // Znajdź ostatnią zakończoną inspekcję tej turbiny (oprócz bieżącej)
      const { data: prevInspections, error: prevErr } = await sb
        .from('inspections')
        .select('id, inspection_date, status, protocol_number')
        .eq('turbine_id', turbineId)
        .neq('id', inspectionId)
        .in('status', ['completed', 'signed'])
        .not('is_deleted', 'is', true)
        .order('inspection_date', { ascending: false })
        .limit(1)

      if (prevErr) throw prevErr
      const prev = prevInspections?.[0]
      if (!prev) {
        if (!options.silent) {
          alert('Brak poprzedniej zakończonej inspekcji dla tej turbiny.')
        }
        return null
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
        if (!options.silent) {
          alert('Poprzednia inspekcja nie zawierała zaleceń remontowych.')
        }
        return null
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
      const newItems = (inserted || []) as PreviousRecommendation[]
      setItems((prev) => [...prev, ...newItems])

      const info: AutoImportInfo = {
        count: newItems.length,
        fromDate: prev.inspection_date as string,
        fromProtocolNumber: (prev.protocol_number as string | null) ?? null,
      }
      setAutoImportInfo(info)
      return info
    } catch (err) {
      console.error('Błąd importu z poprzedniej inspekcji:', err)
      if (!options.silent) {
        alert('Błąd podczas importu zaleceń. Sprawdź konsolę.')
      }
      return null
    } finally {
      setIsImporting(false)
    }
  }

  /** Ręczny re-import (button click). */
  const handleManualImport = () => runAutoImport({ silent: false })

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

  const completedCount = items.filter(
    (i) => i.completion_status === 'tak',
  ).length
  const totalCount = items.length

  // Format daty PL z ISO bez time component
  const formatDate = (iso: string | null): string => {
    if (!iso) return ''
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
    if (!m) return iso
    return `${m[3]}.${m[2]}.${m[1]}`
  }

  return (
    <Card className="rounded-xl border-graphite-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="text-lg">
            Ocena realizacji zaleceń z poprzedniej kontroli
          </CardTitle>
          {totalCount > 0 && (
            <span className="text-sm text-graphite-600 tabular-nums">
              <span
                className={
                  completedCount === totalCount
                    ? 'text-success-700 font-semibold'
                    : ''
                }
              >
                {completedCount}/{totalCount}
              </span>{' '}
              wykonanych
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Banner auto-importu (sesja-only — pokazany od momentu importu
            do reload strony, nie persystowany). */}
        {autoImportInfo && autoImportInfo.count > 0 && (
          <div className="rounded-xl border border-info-200 bg-info-50 p-3 flex items-start gap-3">
            <Sparkles size={18} className="text-info-700 shrink-0 mt-0.5" />
            <div className="text-sm text-info-900 flex-1">
              <p className="font-semibold">
                Zaczerpnięto {autoImportInfo.count}{' '}
                {autoImportInfo.count === 1 ? 'zalecenie' : 'zaleceń'} z
                poprzedniej kontroli
                {autoImportInfo.fromDate && (
                  <> (z dn. {formatDate(autoImportInfo.fromDate)}</>
                )}
                {autoImportInfo.fromProtocolNumber && (
                  <>, protokół {autoImportInfo.fromProtocolNumber}</>
                )}
                {autoImportInfo.fromDate && <>)</>}.
              </p>
              <p className="text-xs text-info-800 mt-1">
                Dla każdego oznacz <strong>Wykonano</strong> /{' '}
                <strong>Nie wykonano</strong> / <strong>W trakcie</strong>{' '}
                poniżej.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoImportInfo(null)}
              className="text-info-700 hover:text-info-900 text-xs"
              aria-label="Zamknij komunikat"
            >
              ✕
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-graphite-500">
            Brak zaleceń z poprzedniej kontroli.{' '}
            {turbineId
              ? 'Możesz zaimportować z poprzedniej zakończonej inspekcji tej turbiny lub dodać ręcznie.'
              : 'Dodaj ręcznie poniżej.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-graphite-200 p-3 shadow-xs space-y-3 bg-white"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-graphite-100 flex items-center justify-center font-mono text-sm font-semibold text-graphite-700">
                    {item.item_number}
                  </div>
                  <div className="flex-1 space-y-1">
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
                          e.target.value,
                        )
                      }
                      placeholder="Treść zalecenia z poprzedniego protokołu…"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-danger hover:bg-danger-50 hover:text-danger-800 shrink-0"
                    title="Usuń pozycję"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                {/* Toggle buttons stopnia wykonania — większe touch targety
                    dla tabletu. Spójne kolorystycznie z bulk-status barem
                    (success/danger/warning + neutral). */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-graphite-500">
                    Stopień wykonania
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COMPLETION_STATUSES.map((opt) => {
                      const active = item.completion_status === opt.value
                      const palette =
                        opt.value === 'tak'
                          ? {
                              activeBg: 'bg-success-100',
                              activeText: 'text-success-800',
                              activeBorder: 'border-success-300',
                            }
                          : opt.value === 'nie'
                            ? {
                                activeBg: 'bg-danger-100',
                                activeText: 'text-danger-800',
                                activeBorder: 'border-danger-300',
                              }
                            : {
                                activeBg: 'bg-warning-100',
                                activeText: 'text-warning-800',
                                activeBorder: 'border-warning-300',
                              }
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            handleUpdate(
                              item.id,
                              'completion_status',
                              active ? null : opt.value,
                            )
                          }
                          className={`min-h-[44px] rounded-lg border-2 px-3 text-sm font-semibold transition active:scale-[0.98] ${
                            active
                              ? `${palette.activeBg} ${palette.activeText} ${palette.activeBorder}`
                              : 'bg-white text-graphite-700 border-graphite-200 hover:border-graphite-300'
                          }`}
                        >
                          {opt.value === 'tak' && '✓ '}
                          {opt.value === 'nie' && '✕ '}
                          {opt.value === 'w_trakcie' && '◐ '}
                          {opt.label}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(item.id, 'completion_status', null)
                      }
                      className={`min-h-[44px] rounded-lg border-2 px-3 text-sm font-medium transition active:scale-[0.98] ${
                        item.completion_status === null
                          ? 'bg-graphite-100 text-graphite-700 border-graphite-300'
                          : 'bg-white text-graphite-500 border-graphite-200 hover:border-graphite-300'
                      }`}
                    >
                      — brak —
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor={`remarks-${item.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Uwagi do realizacji (opcjonalnie)
                  </Label>
                  <Input
                    id={`remarks-${item.id}`}
                    value={item.remarks || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'remarks', e.target.value)
                    }
                    placeholder="np. wykonano w lipcu, dokumentacja w archiwum, częściowo…"
                    className="text-sm"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={handleAdd} disabled={isSaving} size="sm">
            <Plus size={16} className="mr-1" />
            Dodaj zalecenie
          </Button>
          {turbineId && (
            <Button
              onClick={handleManualImport}
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
                : items.length === 0
                  ? 'Importuj z poprzedniej inspekcji'
                  : 'Doimportuj z poprzedniej inspekcji'}
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
