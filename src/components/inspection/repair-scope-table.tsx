'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  Camera,
  Check,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  uploadRecommendationPhoto,
  type UploadedRecommendationPhoto,
} from '@/lib/storage/upload-recommendation-photo'
import { computeDeadlineFromUrgency } from '@/lib/zalecenia/deadlines'

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

type WorkKind = 'K' | 'NB' | 'NG'
type UrgencyLevel = 'I' | 'II' | 'III' | 'IV'
/**
 * Source-of-truth dla badge'a "skąd pochodzi pozycja":
 * - 'annual' / 'five_year' = pozycja powstała przez auto-carry po zaznaczeniu
 *   "Nie wykonano" w previous_recommendations odpowiedniego typu
 * - 'both' = upgrade gdy ten sam tekst zaznaczono Nie w obu sekcjach
 * - null = manual / legacy / z elementów (brak badge'a)
 */
type SourcePreviousType = 'annual' | 'five_year' | 'both'

interface RepairScopeItem {
  id: string
  inspection_id: string
  item_number: number
  scope_description: string
  element_name: string | null
  work_kind: WorkKind | null
  urgency_level: UrgencyLevel | null
  deadline_text: string | null
  deadline_date: string | null
  is_completed: boolean
  completion_date: string | null
  completion_notes: string | null
  source_previous_type: SourcePreviousType | null
}

const SOURCE_PREVIOUS_LABELS: Record<SourcePreviousType, string> = {
  annual: '↪ z kontroli rocznej',
  five_year: '↪ z kontroli 5-letniej',
  both: '↪ z obu poprzednich kontroli',
}

const WORK_KIND_OPTIONS: Array<{ value: WorkKind; label: string }> = [
  { value: 'K', label: 'K — konserwacja' },
  { value: 'NB', label: 'NB — naprawa bieżąca' },
  { value: 'NG', label: 'NG — naprawa główna' },
]

const URGENCY_OPTIONS: Array<{ value: UrgencyLevel; label: string }> = [
  { value: 'I', label: 'I — natychmiast' },
  { value: 'II', label: 'II — do 3 mies.' },
  { value: 'III', label: 'III — do 12 mies.' },
  { value: 'IV', label: 'IV — do 5 lat' },
]

interface RepairScopeTableProps {
  inspectionId: string
  /** Data bieżącej inspekcji — używana do auto-fill `deadline_date` z urgency_level. */
  inspectionDate?: string | null
}

/**
 * Strip legacy artifacts from `repair_recommendations.scope_description`
 * przed wstawieniem do `repair_scope_items.scope_description`:
 * - prefiks `^N. ` — stary format trzymał numer pozycji w tekście, teraz
 *   numer jest w osobnej kolumnie `item_number` (renumber per-section)
 * - sufiks ` (K|NB|NG)` — stary format trzymał rodzaj robót jako sufiks
 *   w opisie, teraz w osobnej kolumnie `work_kind`
 *
 * Audyt EW Kamlarki 2026-05-12: bez tego strippa items 2-5 lecą do scope
 * jako "2. Wykonać... (K)" — podwójna numeracja w UI (kółko z item_number
 * obok prefiksu w tekście) i wizualny śmieć.
 *
 * Zwraca `{ text, workKindFromSuffix }`: jeśli wyłapaliśmy "(K|NB|NG)" jako
 * sufiks, zwracamy też kod żeby caller mógł fallback'iem wypełnić work_kind
 * gdy legacy `repair_type` jest NULL ale sufiks w tekście był.
 */
const normalizeScopeText = (
  raw: string
): { text: string; workKindFromSuffix: WorkKind | null } => {
  const suffixMatch = raw.match(/\s*\((K|NB|NG)\)\s*$/)
  const workKindFromSuffix = (suffixMatch?.[1] as WorkKind | undefined) ?? null
  return {
    text: raw
      .replace(/\s*\((K|NB|NG)\)\s*$/, '')
      .replace(/^\d+\.\s+/, '')
      .trim(),
    workKindFromSuffix,
  }
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

interface ImportInfo {
  /** Ile pozycji zaimportowano w ostatniej operacji. */
  count: number
  /** Skąd: 'elements' = z `inspection_elements.recommendations`,
   *  'legacy' = z `repair_recommendations.scope_description` (stary
   *  formularz nowej inspekcji). */
  source: 'elements' | 'legacy' | 'mixed'
}

export function RepairScopeTable({
  inspectionId,
  inspectionDate,
}: RepairScopeTableProps) {
  const [items, setItems] = useState<RepairScopeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importInfo, setImportInfo] = useState<ImportInfo | null>(null)
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

  /**
   * Jednorazowy backfill `deadline_date` dla wierszy ładowanych z bazy.
   * Cel: naprawić wiersze sprzed PR #32 (i te wstawione przez runImport
   * z `deadline_date: null`) tak, żeby Termin wykonania nie był pusty
   * gdy urgency_level jest ustawione.
   *
   * Strzela tylko gdy mamy `inspectionDate`. Dla każdego wiersza:
   * - jeśli `urgency_level` set i `deadline_date` puste — obliczamy i UPDATE
   * - w przeciwnym razie zostawiamy bez zmian
   *
   * Zwraca listę wierszy z naniesionymi zmianami (do setItems).
   */
  const backfillDeadlines = async (
    rows: RepairScopeItem[],
  ): Promise<RepairScopeItem[]> => {
    if (!inspectionDate || rows.length === 0) return rows

    const updates: Array<{ id: string; deadline_date: string }> = []
    const patched = rows.map((row) => {
      if (row.urgency_level && !row.deadline_date) {
        const computed = computeDeadlineFromUrgency(
          inspectionDate,
          row.urgency_level,
        )
        if (computed) {
          updates.push({ id: row.id, deadline_date: computed })
          return { ...row, deadline_date: computed }
        }
      }
      return row
    })

    if (updates.length === 0) return rows

    const sb = supabase()
    await Promise.all(
      updates.map((u) =>
        sb
          .from('repair_scope_items')
          .update({ deadline_date: u.deadline_date })
          .eq('id', u.id),
      ),
    )

    return patched
  }

  const loadItemsAndMaybeAutoImport = async () => {
    try {
      const { data, error } = await supabase()
        .from('repair_scope_items')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      const loaded = (data || []) as RepairScopeItem[]

      // Backfill: wiersze sprzed PR #32 (i wstawione przez runImport bez
      // deadline_date) mają urgency_level ustawione ale deadline_date=NULL.
      // Jeśli mamy inspectionDate, dolicz deadline i zapisz w bazie. Działa
      // tylko gdy deadline_date jest puste — nie nadpisujemy świadomych
      // edycji inspektora.
      const backfilled = await backfillDeadlines(loaded)
      setItems(backfilled)

      // Auto-import: pierwszy mount, brak wpisów. Cisza — jeśli znajdzie,
      // wstawia + ustawia banner; jeśli nie znajdzie, zostawia listę pustą
      // bez alertu (user widzi placeholder „Brak pozycji").
      if (!autoImportTriedRef.current && backfilled.length === 0) {
        autoImportTriedRef.current = true
        await runImport({ silent: true })
      }
    } catch (err) {
      console.error('Błąd ładowania zakresu robót:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadItems = async () => {
    try {
      const { data, error } = await supabase()
        .from('repair_scope_items')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      setItems((data || []) as RepairScopeItem[])
    } catch (err) {
      console.error('Błąd ładowania zakresu robót:', err)
    }
  }

  /**
   * Zbiera niepuste zalecenia z 2 źródeł i wstawia jako nowe pozycje:
   *   1. inspection_elements.recommendations — pole „Zalecenia" w karcie
   *      każdego elementu (sekcja Ocena).
   *   2. repair_recommendations.scope_description — legacy tabela ze
   *      starego formularza nowej inspekcji.
   *
   * Pomija duplikaty (ten sam tekst już istnieje w repair_scope_items).
   * Zwraca metadata; alert tylko jeśli `silent=false` i nic nie znaleziono.
   */
  const runImport = async (
    options: { silent?: boolean } = {},
  ): Promise<ImportInfo | null> => {
    setIsImporting(true)
    try {
      const sb = supabase()

      type ImportCandidate = {
        text: string
        element_name: string | null
        work_kind: WorkKind | null
        urgency_level: UrgencyLevel | null
      }

      // 1. Z elementów inspekcji (sekcja „Zalecenia" w karcie elementu).
      // Element name z definicji idzie do KOLUMNY `element_name` (osobny input
      // w UI), a nie jako prefiks w opisie — żeby po imporcie inspektor od
      // razu widział wypełnione pole „Element / lokalizacja".
      const { data: elementsData } = await sb
        .from('inspection_elements')
        .select(
          `recommendations,
           definition:element_definition_id ( element_number, name_pl )`
        )
        .eq('inspection_id', inspectionId)

      type ElRow = {
        recommendations: string | null
        definition: { element_number: number | null; name_pl: string | null } | null
      }
      const fromElements: ImportCandidate[] = []
      for (const row of (elementsData || []) as unknown as ElRow[]) {
        const rec = row.recommendations?.trim()
        if (!rec) continue
        const num = row.definition?.element_number
        const namePl = row.definition?.name_pl
        const elementLabel =
          num != null && namePl
            ? `${num}. ${namePl}`
            : namePl
              ? namePl
              : null
        // Każda linia w polu = osobna pozycja (jeśli user listuje punktami).
        const lines = rec
          .split(/\r?\n+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        for (const line of lines) {
          fromElements.push({
            text: line,
            element_name: elementLabel,
            work_kind: null,
            urgency_level: null,
          })
        }
      }

      // 2. Legacy repair_recommendations (stary formularz). Przenosimy też
      //    `repair_type` (K/NB/NG) i `urgency_level` (I-IV) — kolumny w tabeli
      //    docelowej istnieją (work_kind, urgency_level), więc inspektor nie
      //    musi ich klikać ręcznie po imporcie.
      const { data: legacyData } = await sb
        .from('repair_recommendations')
        .select('scope_description, element_name, repair_type, urgency_level')
        .eq('inspection_id', inspectionId)

      const fromLegacy: ImportCandidate[] = []
      for (const row of (legacyData || []) as Array<{
        scope_description: string | null
        element_name: string | null
        repair_type: WorkKind | null
        urgency_level: UrgencyLevel | null
      }>) {
        const desc = row.scope_description?.trim()
        if (!desc) continue
        const { text: cleanText, workKindFromSuffix } = normalizeScopeText(desc)
        if (!cleanText) continue
        fromLegacy.push({
          text: cleanText,
          element_name: row.element_name?.trim() || null,
          // Preferuj kolumnę repair_type; fallback do sufiksu "(K|NB|NG)"
          // wyłapanego z opisu (legacy dane bywały niespójne — sufiks w
          // tekście, kolumna NULL lub odwrotnie).
          work_kind: row.repair_type ?? workKindFromSuffix,
          urgency_level: row.urgency_level ?? null,
        })
      }

      // Łączymy + de-duplikat (po samym tekście). Przy konflikcie pierwsze
      // wystąpienie wygrywa — elements (z definicji) przed legacy.
      const seen = new Set<string>()
      const candidates: ImportCandidate[] = []
      for (const c of [...fromElements, ...fromLegacy]) {
        const norm = c.text.trim()
        if (!norm) continue
        if (seen.has(norm)) continue
        seen.add(norm)
        candidates.push({ ...c, text: norm })
      }

      // Pomiń te które już są w repair_scope_items (po opisie).
      const { data: existing } = await sb
        .from('repair_scope_items')
        .select('scope_description')
        .eq('inspection_id', inspectionId)
      const existingSet = new Set(
        ((existing || []) as Array<{ scope_description: string }>).map((e) =>
          (e.scope_description || '').trim(),
        ),
      )
      const fresh = candidates.filter((c) => !existingSet.has(c.text))

      if (fresh.length === 0) {
        if (!options.silent) {
          alert(
            'Brak nowych zaleceń do zaimportowania. Sprawdź czy w sekcji Ocena (karty elementów) są wypełnione pola „Zalecenia".'
          )
        }
        return null
      }

      // INSERT
      const baseNumber =
        items.length > 0 ? Math.max(...items.map((i) => i.item_number)) : 0
      const toInsert = fresh.map((c, idx) => ({
        inspection_id: inspectionId,
        item_number: baseNumber + idx + 1,
        scope_description: c.text,
        element_name: c.element_name,
        work_kind: c.work_kind,
        urgency_level: c.urgency_level,
        deadline_text: null,
        deadline_date: computeDeadlineFromUrgency(
          inspectionDate ?? null,
          c.urgency_level,
        ),
        is_completed: false,
      }))
      const { data: inserted, error: insErr } = await sb
        .from('repair_scope_items')
        .insert(toInsert)
        .select()
      if (insErr) throw insErr

      const newItems = (inserted || []) as RepairScopeItem[]
      setItems((prev) => [...prev, ...newItems])

      const source: ImportInfo['source'] =
        fromElements.length > 0 && fromLegacy.length > 0
          ? 'mixed'
          : fromElements.length > 0
            ? 'elements'
            : 'legacy'
      const info: ImportInfo = { count: newItems.length, source }
      setImportInfo(info)
      return info
    } catch (err) {
      console.error('Błąd importu zaleceń:', err)
      if (!options.silent) {
        alert('Nie udało się zaimportować zaleceń. Spróbuj ponownie.')
      }
      return null
    } finally {
      setIsImporting(false)
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
    // Auto-fill deadline_date przy zmianie urgency_level — tylko gdy
    // deadline_date jest pusty (nie nadpisuje świadomych edycji inspektora).
    let autoDeadline: string | null = null
    if (field === 'urgency_level' && value && inspectionDate) {
      const current = items.find((i) => i.id === id)
      if (current && !current.deadline_date) {
        autoDeadline = computeDeadlineFromUrgency(
          inspectionDate,
          value as UrgencyLevel,
        )
      }
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              [field]: value,
              ...(autoDeadline ? { deadline_date: autoDeadline } : {}),
            }
          : i,
      )
    )

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const updateData: Record<string, unknown> = { [field]: value }
        if (autoDeadline) updateData.deadline_date = autoDeadline

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
      const sb = supabase()
      const { error } = await sb
        .from('repair_scope_items')
        .delete()
        .eq('id', id)
      if (error) throw error
      // Auto-renumber po usunięciu — zamknij dziurę po skasowanym wpisie.
      await renumberAll(sb)
    } catch (err) {
      console.error('Błąd usuwania:', err)
      void loadItems()
    }
  }

  /**
   * Renumberuje wszystkie wiersze tego inspection 1..N po rosnącym item_number.
   * `repair_scope_items` to osobna tabela bez source_inspection_type — czyli
   * jedna numeracja per inspekcja. Używane po delete (zamknij dziurę).
   */
  const renumberAll = async (
    sb: ReturnType<typeof createBrowserClient>
  ): Promise<void> => {
    const { data: rows, error } = await sb
      .from('repair_scope_items')
      .select('id, item_number')
      .eq('inspection_id', inspectionId)
      .order('item_number', { ascending: true })

    if (error) {
      console.error('Błąd pobierania do renumeracji:', error)
      return
    }
    if (!rows || rows.length === 0) return

    const list = rows as Array<{ id: string; item_number: number }>
    const updates: Array<{ id: string; to: number }> = []
    list.forEach((row, idx) => {
      const target = idx + 1
      if (row.item_number !== target) {
        updates.push({ id: row.id, to: target })
      }
    })
    if (updates.length === 0) return

    for (const u of updates) {
      const { error: upErr } = await sb
        .from('repair_scope_items')
        .update({ item_number: u.to })
        .eq('id', u.id)
      if (upErr) console.error('Błąd renumeracji wpisu', u.id, upErr)
    }

    setItems((prev) => {
      const map = new Map<string, number>()
      list.forEach((row, idx) => map.set(row.id, idx + 1))
      return prev.map((i) =>
        map.has(i.id) ? { ...i, item_number: map.get(i.id)! } : i
      )
    })
  }

  /** Manual override numeru pozycji — gdy auto-renumber nie zachowuje
   *  pożądanej kolejności. Bez auto-resort, użytkownik decyduje. */
  const handleNumberChange = (id: string, raw: string) => {
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) return
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, item_number: n } : i))
    )
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }
    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase()
          .from('repair_scope_items')
          .update({ item_number: n })
          .eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zmiany numeru:', err)
      } finally {
        setIsSaving(false)
      }
    }, 600)
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
        {/* Banner informacyjny po auto-imporcie */}
        {importInfo && importInfo.count > 0 && (
          <div className="rounded-lg border border-info-100 bg-info-50/60 px-3 py-2 text-sm text-info-800 flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-info-700" />
            <div className="flex-1">
              Zaimportowano <strong>{importInfo.count}</strong>{' '}
              {importInfo.count === 1 ? 'pozycję' : 'pozycji'}
              {importInfo.source === 'elements' && ' z pól „Zalecenia" w kartach elementów'}
              {importInfo.source === 'legacy' && ' z legacy zaleceń (NG/NB/K)'}
              {importInfo.source === 'mixed' && ' z elementów inspekcji i legacy zaleceń'}
              . Możesz je teraz doedytować, dodać terminy lub usunąć.
            </div>
            <button
              type="button"
              onClick={() => setImportInfo(null)}
              className="text-info-600 hover:text-info-900 text-xs"
              title="Ukryj"
            >
              ×
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-graphite-500">
              Brak pozycji. Dodaj wymagane prace remontowe ręcznie albo
              zaimportuj z pól „Zalecenia" w kartach elementów / legacy zaleceń
              tej inspekcji.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {[...items]
              .sort((a, b) => a.item_number - b.item_number)
              .map((item) => (
              <li
                key={item.id}
                className={`grid grid-cols-12 gap-3 items-start rounded-xl border p-3 shadow-xs ${
                  item.is_completed
                    ? 'border-success-200 bg-success-50/40'
                    : 'border-graphite-200 hover:bg-graphite-50'
                }`}
              >
                <div className="col-span-1 flex items-start justify-center pt-2">
                  {/* Edytowalny numer pozycji — manual override gdy auto-renumber
                      nie zachowuje pożądanej kolejności. */}
                  <input
                    type="number"
                    min={1}
                    value={item.item_number}
                    onChange={(e) => handleNumberChange(item.id, e.target.value)}
                    className="w-12 h-8 rounded-md bg-graphite-50 text-center font-mono text-sm font-semibold text-graphite-700 border border-graphite-200 outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    title="Numer pozycji — kliknij aby edytować ręcznie"
                  />
                </div>
                <div className="col-span-6 space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Label
                        htmlFor={`scope-${item.id}`}
                        className="text-xs text-graphite-500"
                      >
                        Zakres czynności
                      </Label>
                      {item.source_previous_type && (
                        <span
                          className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded bg-info-50 text-info-800 border border-info-100"
                          title="Pozycja przeniesiona automatycznie po zaznaczeniu Nie wykonano w zaleceniach z poprzedniej kontroli"
                        >
                          {SOURCE_PREVIOUS_LABELS[item.source_previous_type]}
                        </span>
                      )}
                    </div>
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
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`element-${item.id}`}
                        className="text-xs text-graphite-500"
                      >
                        Element / lokalizacja
                      </Label>
                      <Input
                        id={`element-${item.id}`}
                        value={item.element_name || ''}
                        onChange={(e) =>
                          handleUpdate(item.id, 'element_name', e.target.value || null)
                        }
                        placeholder="np. Fundament, Wieża"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`kind-${item.id}`}
                        className="text-xs text-graphite-500"
                      >
                        Rodzaj robót
                      </Label>
                      <select
                        id={`kind-${item.id}`}
                        value={item.work_kind || ''}
                        onChange={(e) =>
                          handleUpdate(
                            item.id,
                            'work_kind',
                            (e.target.value as WorkKind) || null
                          )
                        }
                        className="h-8 w-full rounded-md border border-graphite-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                      >
                        <option value="">—</option>
                        {WORK_KIND_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`urgency-${item.id}`}
                        className="text-xs text-graphite-500"
                      >
                        Stopień pilności
                      </Label>
                      <select
                        id={`urgency-${item.id}`}
                        value={item.urgency_level || ''}
                        onChange={(e) =>
                          handleUpdate(
                            item.id,
                            'urgency_level',
                            (e.target.value as UrgencyLevel) || null
                          )
                        }
                        className="h-8 w-full rounded-md border border-graphite-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                      >
                        <option value="">—</option>
                        {URGENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
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
                {/* Zdjęcia per pozycja zakresu robót. Carry-over z prev_rec
                    "Nie wykonano" wpisuje tu kopię wskaźników (parent_type
                    'repair_scope_item'). Inspektor może też wgrywać nowe. */}
                <div className="col-span-12 border-t border-graphite-100 pt-2 mt-1">
                  <ScopeItemPhotos
                    inspectionId={inspectionId}
                    scopeItemId={item.id}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleAdd} disabled={isSaving} size="sm">
            <Plus size={16} className="mr-1" />
            Dodaj pozycję
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void runImport({ silent: false })}
            disabled={isImporting}
            title="Pobierz zalecenia z pól Zalecenia w kartach elementów oraz z legacy"
          >
            {isImporting ? (
              <>
                <RefreshCw size={16} className="mr-1 animate-spin" />
                Importowanie…
              </>
            ) : (
              <>
                <Sparkles size={16} className="mr-1" />
                {items.length === 0
                  ? 'Importuj zalecenia z elementów / legacy'
                  : 'Doimportuj nowe zalecenia'}
              </>
            )}
          </Button>
        </div>

        {isSaving && (
          <p className="text-xs text-graphite-400 text-right">Zapisywanie…</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Photo gallery per scope item ────────────────────────────────────────

interface ScopeItemPhotosProps {
  inspectionId: string
  scopeItemId: string
}

interface PhotoRow {
  id: string
  file_url: string
  caption: string | null
  sort_order: number
}

/**
 * Galeria zdjęć przypiętych do pozycji zakresu robót (parent_type='repair_scope_item').
 * Wskaźniki kopiowane przez auto-carry z previous_recommendations przy zaznaczeniu
 * "Nie wykonano" w prev_rec; inspektor może też wgrywać nowe zdjęcia bezpośrednio
 * w tej sekcji (np. dokumentujące nowe usterki niezwiązane z poprzednią kontrolą).
 *
 * Render w PDF/DOCX: sekcja "Dokumentacja fotograficzna zaleceń" pod tabelą VI/IV.
 */
function ScopeItemPhotos({ inspectionId, scopeItemId }: ScopeItemPhotosProps) {
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeItemId])

  const load = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase()
        .from('recommendation_photos')
        .select('id, file_url, caption, sort_order')
        .eq('parent_type', 'repair_scope_item')
        .eq('parent_id', scopeItemId)
        .order('sort_order', { ascending: true })
        .order('uploaded_at', { ascending: true })
      if (error) throw error
      setPhotos((data || []) as PhotoRow[])
    } catch (err) {
      console.error('Błąd ładowania zdjęć scope:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const baseSort =
        photos.length > 0 ? Math.max(...photos.map((p) => p.sort_order)) : 0
      const fresh: UploadedRecommendationPhoto[] = []
      for (let i = 0; i < files.length; i++) {
        const uploaded = await uploadRecommendationPhoto({
          file: files[i],
          inspectionId,
          parentType: 'repair_scope_item',
          parentId: scopeItemId,
          sortOrder: baseSort + i + 1,
        })
        fresh.push(uploaded)
      }
      setPhotos((prev) => [
        ...prev,
        ...fresh.map((f) => ({
          id: f.id,
          file_url: f.file_url,
          caption: f.caption,
          sort_order: f.sort_order,
        })),
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd uploadu'
      setUploadError(msg)
      console.error('Błąd uploadu zdjęcia scope:', err)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
    try {
      const { error } = await supabase()
        .from('recommendation_photos')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('Błąd usuwania zdjęcia:', err)
      void load()
    }
  }

  if (isLoading) {
    return (
      <div className="text-xs text-graphite-400">Ładowanie zdjęć…</div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-graphite-500 flex items-center gap-1.5">
          <Camera size={13} />
          Zdjęcia ({photos.length})
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-7 text-xs"
        >
          {isUploading ? 'Wgrywanie…' : '+ Dodaj zdjęcie'}
        </Button>
      </div>

      {uploadError && (
        <p className="text-xs text-danger-700">{uploadError}</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square rounded-md overflow-hidden border border-graphite-200 group bg-graphite-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.file_url}
                alt={p.caption || ''}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-danger-600 text-white text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow"
                title="Usuń zdjęcie"
                aria-label="Usuń zdjęcie"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

