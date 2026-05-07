'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { COMPLETION_STATUSES } from '@/lib/constants'

/**
 * PIIB sekcja II — Sprawdzenie wykonania zaleceń z poprzednich kontroli.
 *
 * Audyt 2026-05-07 (Waldek): protokół wymaga sprawdzenia zaleceń z OBU
 * poprzednich kontroli — rocznej i 5-letniej. Komponent renderuje 2 osobne
 * sekcje, każda z własnym auto-importem i listą edycyjną. Każdy wiersz
 * w `previous_recommendations` ma `source_inspection_type` (annual /
 * five_year / NULL = legacy).
 *
 * AUTO-IMPORT (per typ): pierwszy mount + brak wpisów dla danego typu →
 * próbuje pobrać zalecenia z ostatniej zakończonej inspekcji tego typu
 * (z `inspections`), z fallbackiem do `historical_protocols` (PDF-only,
 * tylko metadata) lub do `turbines.previous_findings` (legacy text).
 *
 * Toggle button group dla `completion_status` (Wykonano / Nie / W trakcie /
 * brak) — większe touch targety dla tabletu w terenie.
 *
 * CRUD na tabeli `previous_recommendations`. Auto-save 800ms.
 */

type SourceType = 'annual' | 'five_year'

interface PreviousRecommendation {
  id: string
  inspection_id: string
  item_number: number
  recommendation_text: string | null
  completion_status: 'tak' | 'nie' | 'w_trakcie' | null
  remarks: string | null
  source_inspection_type: SourceType | null
}

interface AutoImportInfo {
  count: number
  fromDate: string | null
  fromProtocolNumber: string | null
  /**
   * - 'previous_inspection': z `repair_scope_items` lub `repair_recommendations`
   * - 'historical_meta': z `historical_protocols` (tylko metadata, brak strukturalnych zaleceń)
   * - 'turbine_legacy': z `turbines.previous_findings`
   */
  source: 'previous_inspection' | 'historical_meta' | 'turbine_legacy'
}

/** Source-aware metadata: pochodzenie ostatniej kontroli danego typu. */
interface SourceMeta {
  date: string | null
  protocolNumber: string | null
  pdfUrl: string | null
  /** Czy znaleźliśmy strukturalne zalecenia (T/N decyduje czy auto-import insertował wiersze). */
  hasStructured: boolean
}

interface PreviousRecommendationsTableProps {
  inspectionId: string
  /** Opcjonalnie: ID turbiny — używane do auto-fill z poprzedniej inspekcji. */
  turbineId?: string
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

const SOURCE_LABELS: Record<SourceType, { title: string; short: string }> = {
  five_year: {
    title: 'Sprawdzenie wykonania zaleceń z poprzedniej kontroli 5-letniej',
    short: '5-letniej',
  },
  annual: {
    title: 'Sprawdzenie wykonania zaleceń z poprzedniej kontroli rocznej',
    short: 'rocznej',
  },
}

const formatDate = (iso: string | null): string => {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

export function PreviousRecommendationsTable({
  inspectionId,
  turbineId,
}: PreviousRecommendationsTableProps) {
  const [items, setItems] = useState<PreviousRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [importingType, setImportingType] = useState<SourceType | null>(null)
  const [autoImportInfo, setAutoImportInfo] = useState<
    Partial<Record<SourceType, AutoImportInfo>>
  >({})
  const [sourceMeta, setSourceMeta] = useState<
    Partial<Record<SourceType, SourceMeta>>
  >({})
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

      // Auto-import: pierwszy mount, mamy turbineId. Niezależnie dla każdego typu.
      if (!autoImportTriedRef.current && turbineId) {
        autoImportTriedRef.current = true
        const types: SourceType[] = ['five_year', 'annual']
        for (const t of types) {
          const hasItemsForType = loaded.some(
            (i) => i.source_inspection_type === t
          )
          if (!hasItemsForType) {
            await runAutoImport(t, { silent: true })
          }
        }
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

  /**
   * Dodaje pojedynczy wpis w sekcji danego typu (lub bez przypisania).
   * Numer = max-w-grupie + 1 (per-sekcję, niezależnie dla 5-letniej i rocznej).
   */
  const handleAdd = async (forType: SourceType | null) => {
    setIsSaving(true)
    try {
      const inGroup = items.filter((i) => i.source_inspection_type === forType)
      const nextNumber =
        inGroup.length > 0
          ? Math.max(...inGroup.map((i) => i.item_number)) + 1
          : 1

      const { data, error } = await supabase()
        .from('previous_recommendations')
        .insert({
          inspection_id: inspectionId,
          item_number: nextNumber,
          recommendation_text: null,
          completion_status: null,
          remarks: null,
          source_inspection_type: forType,
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
   * Renumberuje wpisy w danej sekcji (annual / five_year / null) sekwencyjnie
   * 1..N po rosnącym item_number. Używane po delete (zamknij dziurę) i po
   * imporcie (zacznij od 1). Aktualizuje state lokalny po zapisie.
   */
  const renumberSection = async (
    sb: ReturnType<typeof createBrowserClient>,
    forType: SourceType | null
  ): Promise<void> => {
    const query = sb
      .from('previous_recommendations')
      .select('id, item_number')
      .eq('inspection_id', inspectionId)
      .order('item_number', { ascending: true })

    const { data: rows, error } =
      forType === null
        ? await query.is('source_inspection_type', null)
        : await query.eq('source_inspection_type', forType)

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
        .from('previous_recommendations')
        .update({ item_number: u.to })
        .eq('id', u.id)
      if (upErr) console.error('Błąd renumeracji wpisu', u.id, upErr)
    }

    // Sync state lokalny
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
          .from('previous_recommendations')
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

  /**
   * Auto-import zaleceń dla konkretnego typu (annual / five_year).
   *
   * Warstwy fallbacku:
   *   1. inspections + repair_scope_items (PIIB Faza 10)
   *   2. inspections + repair_recommendations (legacy)
   *   3. historical_protocols — tylko metadata (PDF-only, brak strukturalnych
   *      zaleceń, ale pokazujemy header z datą + protokołem + linkiem do PDF)
   *   4. turbines.previous_findings (legacy text) — ostatnia deska ratunku,
   *      tylko gdy żaden z poprzednich nie zadziałał
   */
  const runAutoImport = async (
    forType: SourceType,
    options: { silent?: boolean } = {}
  ): Promise<AutoImportInfo | null> => {
    if (!turbineId) return null
    setImportingType(forType)
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
      let pdfUrl: string | null = null

      // -------------------------------------------------------------------
      // Warstwa 1+2: poprzednia zakończona inspekcja danego typu
      // -------------------------------------------------------------------
      const { data: prevInspections, error: prevErr } = await sb
        .from('inspections')
        .select('id, inspection_date, status, protocol_number, inspection_type')
        .eq('turbine_id', turbineId)
        .eq('inspection_type', forType)
        .neq('id', inspectionId)
        .in('status', ['completed', 'signed'])
        .not('is_deleted', 'is', true)
        .order('inspection_date', { ascending: false })
        .limit(1)

      if (prevErr) throw prevErr
      const prev = prevInspections?.[0]

      if (prev) {
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
          source = 'previous_inspection'
        }
      }

      // -------------------------------------------------------------------
      // Warstwa 3: historical_protocols (archiwum) — PDF-only metadata
      // Pokazujemy header z datą/protokołem + linkiem do PDF, ale strukturalnych
      // zaleceń nie wyciągamy (są tylko w PDF — inspektor uzupełnia ręcznie).
      // -------------------------------------------------------------------
      if (recommendations.length === 0) {
        const { data: histRows } = await sb
          .from('historical_protocols')
          .select(
            'id, inspection_date, year, protocol_number, protocol_pdf_url'
          )
          .eq('turbine_id', turbineId)
          .eq('inspection_type', forType)
          .order('inspection_date', { ascending: false, nullsFirst: false })
          .order('year', { ascending: false })
          .limit(1)

        const hist = histRows?.[0] as
          | {
              id: string
              inspection_date: string | null
              year: number | null
              protocol_number: string | null
              protocol_pdf_url: string | null
            }
          | undefined

        if (hist) {
          fromDate = hist.inspection_date
          fromProtocolNumber = hist.protocol_number
          pdfUrl = hist.protocol_pdf_url
          source = 'historical_meta'
        }
      }

      // -------------------------------------------------------------------
      // Warstwa 4: legacy text na karcie turbiny (split \n)
      // Tylko jeśli to 5-letnia (historyczne dane są zwykle z 5y) ALBO
      // jeśli to annual i nic nie znaleźliśmy. W obu przypadkach próbujemy.
      // -------------------------------------------------------------------
      if (recommendations.length === 0 && source !== 'historical_meta') {
        const { data: turbineData } = await sb
          .from('turbines')
          .select('previous_findings, previous_findings_status')
          .eq('id', turbineId)
          .maybeSingle()

        const rawFindings =
          (turbineData?.previous_findings as string | null) || ''
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

      // -------------------------------------------------------------------
      // Zachowaj metadata źródła (dla nagłówka sekcji), nawet gdy nic nie
      // wstawiamy (np. historical_meta).
      // -------------------------------------------------------------------
      setSourceMeta((prev) => ({
        ...prev,
        [forType]: {
          date: fromDate,
          protocolNumber: fromProtocolNumber,
          pdfUrl,
          hasStructured: recommendations.length > 0,
        },
      }))

      // -------------------------------------------------------------------
      // Brak czegokolwiek do wstawienia — koniec
      // -------------------------------------------------------------------
      if (recommendations.length === 0) {
        if (source === 'historical_meta') {
          // Mamy metadata z archiwum — info dla user-a (tylko ręczny re-import)
          if (!options.silent) {
            alert(
              `Znaleziono w archiwum protokół ${fromProtocolNumber || ''} z dn. ${formatDate(fromDate)}, ale strukturalne zalecenia są tylko w PDF — uzupełnij ręcznie z dokumentu.`
            )
          }
          return null
        }
        if (!options.silent) {
          alert(
            `Brak danych o poprzednich zaleceniach z kontroli ${SOURCE_LABELS[forType].short}: ani w nowych protokołach tej turbiny, ani w archiwum, ani w notatkach.`
          )
        }
        return null
      }

      // -------------------------------------------------------------------
      // INSERT do previous_recommendations z source_inspection_type.
      // Numerujemy w obrębie GRUPY (annual/five_year niezależnie).
      // -------------------------------------------------------------------
      const inGroup = items.filter((i) => i.source_inspection_type === forType)
      const baseNumber =
        inGroup.length > 0 ? Math.max(...inGroup.map((i) => i.item_number)) : 0

      const toInsert = recommendations.map((r, idx) => ({
        inspection_id: inspectionId,
        item_number: baseNumber + idx + 1,
        recommendation_text: r.text,
        completion_status: r.status ?? null,
        remarks: r.remarks ?? null,
        source_inspection_type: forType,
      }))

      const { data: inserted, error: insertErr } = await sb
        .from('previous_recommendations')
        .insert(toInsert)
        .select()

      if (insertErr) throw insertErr
      const newItems = (inserted || []) as PreviousRecommendation[]
      setItems((prev) => [...prev, ...newItems])

      // Renumber sekcji po imporcie — pewność że numeracja jest 1..N.
      await renumberSection(sb, forType)

      const info: AutoImportInfo = {
        count: newItems.length,
        fromDate,
        fromProtocolNumber,
        source,
      }
      setAutoImportInfo((prev) => ({ ...prev, [forType]: info }))
      return info
    } catch (err) {
      console.error('Błąd importu z poprzedniej inspekcji:', err)
      if (!options.silent) {
        alert('Błąd podczas importu zaleceń. Sprawdź konsolę.')
      }
      return null
    } finally {
      setImportingType(null)
    }
  }

  const handleManualImport = (forType: SourceType) =>
    runAutoImport(forType, { silent: false })

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
    const deleted = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const sb = supabase()
      const { error } = await sb
        .from('previous_recommendations')
        .delete()
        .eq('id', id)
      if (error) throw error
      // Auto-renumber grupy żeby zamknąć dziurę po usuniętym wpisie.
      if (deleted) {
        await renumberSection(sb, deleted.source_inspection_type)
      }
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

  // Grupowanie wpisów po source_inspection_type. NULL = legacy/ungrouped.
  // Sortujemy per-grupa po item_number — przy manual edit numerka wpis
  // przesuwa się w UI od razu zamiast czekać na fetch.
  const itemsByType: Record<SourceType, PreviousRecommendation[]> = {
    five_year: [],
    annual: [],
  }
  const itemsUngrouped: PreviousRecommendation[] = []
  const sortedItems = [...items].sort((a, b) => a.item_number - b.item_number)
  for (const item of sortedItems) {
    if (item.source_inspection_type === 'five_year') {
      itemsByType.five_year.push(item)
    } else if (item.source_inspection_type === 'annual') {
      itemsByType.annual.push(item)
    } else {
      itemsUngrouped.push(item)
    }
  }

  return (
    <div className="space-y-6">
      <SourceSection
        type="five_year"
        items={itemsByType.five_year}
        meta={sourceMeta.five_year}
        autoImportInfo={autoImportInfo.five_year}
        importing={importingType === 'five_year'}
        turbineId={turbineId}
        isSaving={isSaving}
        onAdd={() => handleAdd('five_year')}
        onImport={() => handleManualImport('five_year')}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onUpdateNumber={handleNumberChange}
        onDismissImportInfo={() =>
          setAutoImportInfo((prev) => ({ ...prev, five_year: undefined }))
        }
      />

      <SourceSection
        type="annual"
        items={itemsByType.annual}
        meta={sourceMeta.annual}
        autoImportInfo={autoImportInfo.annual}
        importing={importingType === 'annual'}
        turbineId={turbineId}
        isSaving={isSaving}
        onAdd={() => handleAdd('annual')}
        onImport={() => handleManualImport('annual')}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onUpdateNumber={handleNumberChange}
        onDismissImportInfo={() =>
          setAutoImportInfo((prev) => ({ ...prev, annual: undefined }))
        }
      />

      {itemsUngrouped.length > 0 && (
        <Card className="rounded-xl border-graphite-200">
          <CardHeader>
            <CardTitle className="text-lg">
              Inne zalecenia (bez przypisanego źródła)
            </CardTitle>
            <p className="text-xs text-graphite-500 font-normal">
              Wpisy dodane przed wprowadzeniem podziału na typ kontroli.
              Możesz je zostawić tak, jak są — albo usunąć i ponownie
              zaimportować w sekcjach powyżej.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <RecommendationList
              items={itemsUngrouped}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onUpdateNumber={handleNumberChange}
            />
            <Button onClick={() => handleAdd(null)} disabled={isSaving} size="sm">
              <Plus size={16} className="mr-1" />
              Dodaj zalecenie
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Subkomponenty ─────────────────────────────────────────────────────────

interface SourceSectionProps {
  type: SourceType
  items: PreviousRecommendation[]
  meta: SourceMeta | undefined
  autoImportInfo: AutoImportInfo | undefined
  importing: boolean
  turbineId?: string
  isSaving: boolean
  onAdd: () => void
  onImport: () => void
  onUpdate: (
    id: string,
    field: 'recommendation_text' | 'completion_status' | 'remarks',
    value: string | null
  ) => void
  onDelete: (id: string) => void
  onUpdateNumber: (id: string, raw: string) => void
  onDismissImportInfo: () => void
}

function SourceSection({
  type,
  items,
  meta,
  autoImportInfo,
  importing,
  turbineId,
  isSaving,
  onAdd,
  onImport,
  onUpdate,
  onDelete,
  onUpdateNumber,
  onDismissImportInfo,
}: SourceSectionProps) {
  const completedCount = items.filter((i) => i.completion_status === 'tak').length
  const totalCount = items.length

  return (
    <Card className="rounded-xl border-graphite-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">{SOURCE_LABELS[type].title}</CardTitle>
            {(meta?.date || meta?.protocolNumber) && (
              <p className="text-xs text-graphite-500 font-normal mt-1">
                Źródło:{' '}
                {meta.protocolNumber && (
                  <span className="font-mono">{meta.protocolNumber}</span>
                )}
                {meta.date && <> z dn. {formatDate(meta.date)}</>}
                {meta.pdfUrl && (
                  <>
                    {' '}
                    —{' '}
                    <a
                      href={meta.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-800 hover:underline"
                    >
                      <ExternalLink size={11} />
                      otwórz PDF z archiwum
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          {totalCount > 0 && (
            <span className="text-sm text-graphite-600 tabular-nums shrink-0">
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
        {/* Banner auto-importu */}
        {autoImportInfo && autoImportInfo.count > 0 && (
          <div className="rounded-xl border border-info-100 bg-info-50 p-3 flex items-start gap-3">
            <Sparkles size={18} className="text-info-800 shrink-0 mt-0.5" />
            <div className="text-sm text-info-900 flex-1">
              <p className="font-semibold">
                Zaczerpnięto {autoImportInfo.count}{' '}
                {autoImportInfo.count === 1 ? 'zalecenie' : 'zaleceń'} z{' '}
                {autoImportInfo.source === 'turbine_legacy'
                  ? 'notatek na karcie turbiny (legacy z migracji).'
                  : `kontroli ${SOURCE_LABELS[type].short}`}
                {autoImportInfo.source !== 'turbine_legacy' &&
                  autoImportInfo.fromDate && (
                    <> (z dn. {formatDate(autoImportInfo.fromDate)}</>
                  )}
                {autoImportInfo.source !== 'turbine_legacy' &&
                  autoImportInfo.fromProtocolNumber && (
                    <>, protokół {autoImportInfo.fromProtocolNumber}</>
                  )}
                {autoImportInfo.source !== 'turbine_legacy' &&
                  autoImportInfo.fromDate && <>)</>}
                .
              </p>
              <p className="text-xs text-info-800 mt-1">
                {autoImportInfo.source === 'turbine_legacy' ? (
                  <>
                    Statusy zostały wstępnie odczytane — sprawdź i ewentualnie
                    popraw poniżej.
                  </>
                ) : (
                  <>
                    Dla każdego oznacz <strong>Wykonano</strong> /{' '}
                    <strong>Nie wykonano</strong> / <strong>W trakcie</strong>.
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissImportInfo}
              className="text-info-800 hover:text-info-900 text-xs"
              aria-label="Zamknij komunikat"
            >
              ✕
            </button>
          </div>
        )}

        {/* Empty state — różny zależnie od czy mamy metadata źródła */}
        {items.length === 0 ? (
          meta && !meta.hasStructured ? (
            <p className="text-sm text-graphite-500">
              W archiwum znaleziono protokół{' '}
              {meta.protocolNumber && (
                <span className="font-mono">{meta.protocolNumber}</span>
              )}
              {meta.date && <> z dn. {formatDate(meta.date)}</>}, ale
              strukturalne zalecenia są tylko w PDF.{' '}
              {meta.pdfUrl && (
                <Link
                  href={meta.pdfUrl}
                  target="_blank"
                  className="text-primary-700 hover:text-primary-800 hover:underline"
                >
                  Otwórz PDF
                </Link>
              )}{' '}
              i uzupełnij poniżej ręcznie.
            </p>
          ) : (
            <p className="text-sm text-graphite-500">
              Brak zaleceń z kontroli {SOURCE_LABELS[type].short}.{' '}
              {turbineId
                ? 'Możesz spróbować zaimportować z poprzedniej inspekcji tej turbiny lub dodać ręcznie.'
                : 'Dodaj ręcznie poniżej.'}
            </p>
          )
        ) : (
          <RecommendationList
            items={items}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onUpdateNumber={onUpdateNumber}
          />
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={onAdd} disabled={isSaving} size="sm">
            <Plus size={16} className="mr-1" />
            Dodaj zalecenie
          </Button>
          {turbineId && (
            <Button
              onClick={onImport}
              disabled={importing}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                size={16}
                className={`mr-1 ${importing ? 'animate-spin' : ''}`}
              />
              {importing
                ? 'Importowanie…'
                : items.length === 0
                  ? `Importuj z poprzedniej kontroli ${SOURCE_LABELS[type].short}`
                  : `Doimportuj z kontroli ${SOURCE_LABELS[type].short}`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface RecommendationListProps {
  items: PreviousRecommendation[]
  onUpdate: (
    id: string,
    field: 'recommendation_text' | 'completion_status' | 'remarks',
    value: string | null
  ) => void
  onDelete: (id: string) => void
  onUpdateNumber: (id: string, raw: string) => void
}

function RecommendationList({
  items,
  onUpdate,
  onDelete,
  onUpdateNumber,
}: RecommendationListProps) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-graphite-200 p-3 shadow-xs space-y-3 bg-white"
        >
          <div className="flex items-start gap-3">
            {/* Edytowalny numer pozycji — manual override gdy auto-renumber
                nie zachowuje pożądanej kolejności. */}
            <input
              type="number"
              min={1}
              value={item.item_number}
              onChange={(e) => onUpdateNumber(item.id, e.target.value)}
              className="shrink-0 w-10 h-8 rounded-full bg-graphite-100 text-center font-mono text-sm font-semibold text-graphite-700 border-0 outline-none focus:ring-2 focus:ring-primary-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Numer pozycji — kliknij aby edytować ręcznie"
            />
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
                  onUpdate(item.id, 'recommendation_text', e.target.value)
                }
                placeholder="Treść zalecenia z poprzedniego protokołu…"
                rows={2}
                className="text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item.id)}
              className="text-danger hover:bg-danger-50 hover:text-danger-800 shrink-0"
              title="Usuń pozycję"
            >
              <Trash2 size={16} />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-graphite-500">Stopień wykonania</Label>
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
                      onUpdate(
                        item.id,
                        'completion_status',
                        active ? null : opt.value
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
                onClick={() => onUpdate(item.id, 'completion_status', null)}
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
              onChange={(e) => onUpdate(item.id, 'remarks', e.target.value)}
              placeholder="np. wykonano w lipcu, dokumentacja w archiwum, częściowo…"
              className="text-sm"
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
