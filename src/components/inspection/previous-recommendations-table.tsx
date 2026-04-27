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
  /** Data poprzedniej inspekcji (ISO string, np. '2025-04-15'). Null gdy
   *  source = 'turbine_legacy'. */
  fromDate: string | null
  /** Numer protokołu poprzedniej inspekcji jeśli jest. Null gdy source = 'turbine_legacy'. */
  fromProtocolNumber: string | null
  /**
   * Źródło importu:
   *  - 'previous_inspection' = znaleziono poprzednią zakończoną inspekcję
   *    z `repair_scope_items` lub `repair_recommendations`
   *  - 'turbine_legacy' = fallback na `turbines.previous_findings` (text field
   *    z migracji starych danych, split po `\n`)
   */
  source: 'previous_inspection' | 'turbine_legacy'
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
   * 3 warstwy fallbacku, w kolejności:
   *   1. repair_scope_items z ostatniej zakończonej inspekcji (PIIB Faza 10)
   *   2. repair_recommendations.scope_description (legacy stara struktura)
   *   3. turbines.previous_findings + previous_findings_status (legacy text
   *      z migracji starych danych, split po `\n`, parsowanie statusu jeśli
   *      kolumna `_status` ma odpowiadające linie)
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

      type ImportItem = {
        text: string
        status?: 'tak' | 'nie' | 'w_trakcie' | null
        remarks?: string | null
      }
      let recommendations: ImportItem[] = []
      let source: AutoImportInfo['source'] = 'previous_inspection'
      let fromDate: string | null = null
      let fromProtocolNumber: string | null = null

      // ---------------------------------------------------------------------
      // Warstwa 1+2: poprzednia zakończona inspekcja
      // ---------------------------------------------------------------------
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

      if (prev) {
        // Warstwa 1: repair_scope_items (PIIB)
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
          // Warstwa 2: legacy repair_recommendations
          const { data: legacyData } = await sb
            .from('repair_recommendations')
            .select('scope_description')
            .eq('inspection_id', prev.id)
          recommendations = (legacyData || []).map((r) => ({
            text: r.scope_description as string,
          }))
        }

        if (recommendations.length > 0) {
          fromDate = prev.inspection_date as string
          fromProtocolNumber = (prev.protocol_number as string | null) ?? null
        }
      }

      // ---------------------------------------------------------------------
      // Warstwa 3: turbines.previous_findings (legacy text, split \n)
      // Wpadamy tu gdy: brak poprzedniej inspekcji ALBO poprzednia bez
      // zaleceń. Większość bazy w 2026-04 jeszcze tu siedzi (1 inspekcja
      // per turbina w nowym appie), więc to ratujący fallback.
      // ---------------------------------------------------------------------
      if (recommendations.length === 0) {
        const { data: turbineData } = await sb
          .from('turbines')
          .select('previous_findings, previous_findings_status')
          .eq('id', turbineId)
          .maybeSingle()

        const rawFindings = (turbineData?.previous_findings as string | null) || ''
        const rawStatus =
          (turbineData?.previous_findings_status as string | null) || ''

        if (
          rawFindings &&
          rawFindings.trim() &&
          rawFindings.trim().toLowerCase() !== 'brak robót'
        ) {
          const findingLines = rawFindings
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && s.toLowerCase() !== 'brak robót')

          const statusLines = rawStatus.split('\n').map((s) => s.trim())

          recommendations = findingLines.map((text, idx) => {
            const st = (statusLines[idx] || '').toLowerCase()
            let status: 'tak' | 'nie' | 'w_trakcie' | null = null
            if (st.startsWith('nie wykonano') || st.startsWith('niewykonano')) {
              status = 'nie'
            } else if (st.startsWith('wykonano')) {
              status = 'tak'
            } else if (
              st.includes('trakcie') ||
              st.startsWith('częściowo') ||
              st.startsWith('w toku')
            ) {
              status = 'w_trakcie'
            }
            return {
              text,
              status,
              // Jeśli status text był nietypowy (nie matchuje regex) — zachowaj
              // go jako uwagi, żeby kontekst nie został zgubiony.
              remarks:
                status === null && statusLines[idx]?.length
                  ? statusLines[idx]
                  : null,
            }
          })

          if (recommendations.length > 0) {
            source = 'turbine_legacy'
          }
        }
      }

      // ---------------------------------------------------------------------
      // Nic z 3 warstw — koniec, info dla user-a (silent skip dla auto-mount)
      // ---------------------------------------------------------------------
      if (recommendations.length === 0) {
        if (!options.silent) {
          alert(
            'Brak danych o poprzednich zaleceniach: ani w nowych protokołach tej turbiny, ani w notatkach „previous_findings".',
          )
        }
        return null
      }

      // ---------------------------------------------------------------------
      // INSERT do previous_recommendations
      // ---------------------------------------------------------------------
      const baseNumber =
        items.length > 0 ? Math.max(...items.map((i) => i.item_number)) : 0

      const toInsert = recommendations.map((r, idx) => ({
        inspection_id: inspectionId,
        item_number: baseNumber + idx + 1,
        recommendation_text: r.text,
        completion_status: r.status ?? null,
        remarks: r.remarks ?? null,
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
        fromDate,
        fromProtocolNumber,
        source,
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
            do reload strony, nie persystowany).
            Tekst zależny od źródła: poprzednia inspekcja vs notatki na karcie
            turbiny (legacy migracja). */}
        {autoImportInfo && autoImportInfo.count > 0 && (
          <div className="rounded-xl border border-info-200 bg-info-50 p-3 flex items-start gap-3">
            <Sparkles size={18} className="text-info-700 shrink-0 mt-0.5" />
            <div className="text-sm text-info-900 flex-1">
              {autoImportInfo.source === 'previous_inspection' ? (
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
              ) : (
                <p className="font-semibold">
                  Zaczerpnięto {autoImportInfo.count}{' '}
                  {autoImportInfo.count === 1 ? 'zalecenie' : 'zaleceń'} z
                  notatek na karcie turbiny (legacy z migracji).
                </p>
              )}
              <p className="text-xs text-info-800 mt-1">
                {autoImportInfo.source === 'turbine_legacy' ? (
                  <>
                    Statusy „Wykonano"/„Nie wykonano" zostały{' '}
                    <strong>wstępnie odczytane</strong> z pola
                    {' '}<code className="text-[11px]">previous_findings_status</code>.
                    Sprawdź i ewentualnie popraw poniżej.
                  </>
                ) : (
                  <>
                    Dla każdego oznacz <strong>Wykonano</strong> /{' '}
                    <strong>Nie wykonano</strong> / <strong>W trakcie</strong>{' '}
                    poniżej.
                  </>
                )}
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
