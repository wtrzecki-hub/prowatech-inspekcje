'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ElementNameInput } from '@/components/inspection/element-name-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { COMPLETION_STATUSES } from '@/lib/constants'
import {
  uploadRecommendationPhoto,
  type UploadedRecommendationPhoto,
} from '@/lib/storage/upload-recommendation-photo'
import { computeDeadlineFromUrgency } from '@/lib/zalecenia/deadlines'

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
type WorkKind = 'K' | 'NB' | 'NG'
type UrgencyLevel = 'I' | 'II' | 'III' | 'IV'

interface PreviousRecommendation {
  id: string
  inspection_id: string
  item_number: number
  recommendation_text: string | null
  completion_status: 'tak' | 'nie' | 'w_trakcie' | null
  remarks: string | null
  source_inspection_type: SourceType | null
  /** Rodzaj robót (K/NB/NG) — z hpr lub poprzedniego repair_scope_items. */
  work_kind: WorkKind | null
  /** Stopień pilności (I-IV) — z hpr lub poprzedniego repair_scope_items. */
  urgency_level: UrgencyLevel | null
  /** Element / lokalizacja — wpisywany ręcznie lub z poprzedniego repair_scope_items. */
  element_name: string | null
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
  /** Data bieżącej inspekcji — używana do obliczenia deadline z urgency_level
   *  przy auto-carry do repair_scope_items. */
  inspectionDate?: string | null
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
  inspectionDate,
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

  /**
   * Normalizuje tekst zalecenia dla potrzeb dedupu cross-source:
   * - usuwa leading "N. " numerator (legacy scope ma "1. Wykonać…", prev_rec nie)
   * - usuwa trailing " (K|NB|NG)" suffix (legacy ma "(K)" na końcu, prev_rec nie)
   * - case-insensitive
   *
   * Bez tego dedup nie łapie matchy gdy prev_rec wstawiony bez prefiksu/sufiksu
   * trafia obok scope item z legacy-import format.
   */
  const normalizeForCarryDedup = (text: string | null | undefined): string => {
    if (!text) return ''
    return text
      .trim()
      .replace(/^\d+\.\s+/, '')
      .replace(/\s*\((?:K|NB|NG)\)\s*$/i, '')
      .trim()
      .toLowerCase()
  }

  /**
   * Auto-carry: zaznaczenie "nie wykonano" w previous_recommendations
   * przepisuje pozycję do `repair_scope_items` bieżącej inspekcji.
   *
   * Dedup po znormalizowanym tekście (patrz normalizeForCarryDedup):
   * - jeśli `source_previous_type` jest `NULL` (legacy import / element /
   *   manual) → upgrade na `forType` — wiedza "z której kontroli" jest
   *   wartościowa, NULL znaczy "nie wiemy", a teraz wiemy
   * - jeśli `source_previous_type` === forType → nic
   * - jeśli to inny typ i nie 'both' → upgrade na 'both'
   * - jeśli 'both' → nic
   *
   * Brak pozycji → INSERT z source_previous_type=forType, item_number=max+1.
   *
   * Reverse direction (zmiana 'nie' → coś innego) nie usuwa pozycji ze scope —
   * inspektor mógł już dopisać terminy/zdjęcia.
   */
  const ensureCarryToScope = async (
    rawText: string | null,
    forType: SourceType,
    extra: {
      work_kind?: WorkKind | null
      urgency_level?: UrgencyLevel | null
      element_name?: string | null
      /** ID wpisu prev_rec — używane do skopiowania wskaźników zdjęć na scope. */
      prevRecId?: string
    } = {}
  ): Promise<void> => {
    const text = rawText?.trim()
    if (!text) return
    const normText = normalizeForCarryDedup(text)
    if (!normText) return

    try {
      const sb = supabase()

      const { data: existing, error: selErr } = await sb
        .from('repair_scope_items')
        .select('id, scope_description, source_previous_type, work_kind, urgency_level, element_name, deadline_date')
        .eq('inspection_id', inspectionId)
      if (selErr) throw selErr

      const match = (
        (existing || []) as Array<{
          id: string
          scope_description: string | null
          source_previous_type: string | null
          work_kind: WorkKind | null
          urgency_level: UrgencyLevel | null
          element_name: string | null
          deadline_date: string | null
        }>
      ).find((r) => normalizeForCarryDedup(r.scope_description) === normText)

      if (match) {
        const cur = match.source_previous_type as
          | 'annual'
          | 'five_year'
          | 'both'
          | null
        // NULL → forType: backfill informacji o pochodzeniu (legacy/manual
        // do tej pory nie wiedziało skąd przyszło — teraz wiemy).
        // forType→forType lub 'both' → bez zmian.
        // Inny typ → 'both' (cross-section confirmation).
        let nextSource: 'annual' | 'five_year' | 'both' | null = cur
        if (cur === null) nextSource = forType
        else if (cur !== forType && cur !== 'both') nextSource = 'both'

        // Backfill work_kind/urgency_level/element_name/deadline_date dla
        // istniejących scope items (legacy lub manual) jeśli prev_rec ma te
        // wartości, a scope nie. Nie nadpisujemy świadomych edycji.
        const updates: Record<string, unknown> = {}
        if (nextSource !== cur) updates.source_previous_type = nextSource
        if (match.work_kind === null && extra.work_kind) {
          updates.work_kind = extra.work_kind
        }
        if (match.urgency_level === null && extra.urgency_level) {
          updates.urgency_level = extra.urgency_level
        }
        if (match.element_name === null && extra.element_name) {
          updates.element_name = extra.element_name
        }
        // Auto-fill deadline z urgency (tylko gdy puste — nie nadpisujemy).
        // Bierzemy nowy urgency (jeśli właśnie go ustawiamy) albo z existing.
        const effectiveUrgency =
          extra.urgency_level ?? match.urgency_level ?? null
        if (match.deadline_date === null && effectiveUrgency) {
          const computed = computeDeadlineFromUrgency(
            inspectionDate ?? null,
            effectiveUrgency,
          )
          if (computed) updates.deadline_date = computed
        }

        if (Object.keys(updates).length > 0) {
          const { error: upErr } = await sb
            .from('repair_scope_items')
            .update(updates)
            .eq('id', match.id)
          if (upErr) console.error('Błąd upgrade scope item:', upErr)
        }
        return
      }

      const { data: lastRow } = await sb
        .from('repair_scope_items')
        .select('item_number')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextNumber =
        ((lastRow?.item_number as number | undefined) ?? 0) + 1

      const computedDeadline = computeDeadlineFromUrgency(
        inspectionDate ?? null,
        extra.urgency_level ?? null,
      )
      const { data: insertedScope, error: insErr } = await sb
        .from('repair_scope_items')
        .insert({
          inspection_id: inspectionId,
          item_number: nextNumber,
          scope_description: text,
          source_previous_type: forType,
          work_kind: extra.work_kind ?? null,
          urgency_level: extra.urgency_level ?? null,
          element_name: extra.element_name ?? null,
          deadline_date: computedDeadline,
          is_completed: false,
        })
        .select('id')
        .single()
      if (insErr) throw insErr

      // Carry zdjęć: skopiuj wskaźniki (file_url + r2_key) z prev_rec na
      // nowo utworzony scope_item. To wskazania na ten sam plik R2 — bez
      // duplikacji binarnej. Render w PDF/DOCX zobaczy zdjęcia per scope_item.
      if (extra.prevRecId && insertedScope?.id) {
        const { data: srcPhotos } = await sb
          .from('recommendation_photos')
          .select('file_url, r2_key, caption, sort_order')
          .eq('parent_type', 'previous_recommendation')
          .eq('parent_id', extra.prevRecId)
        if (srcPhotos && srcPhotos.length > 0) {
          const toInsert = (
            srcPhotos as Array<{
              file_url: string
              r2_key: string
              caption: string | null
              sort_order: number
            }>
          ).map((p) => ({
            parent_type: 'repair_scope_item',
            parent_id: insertedScope.id as string,
            inspection_id: inspectionId,
            file_url: p.file_url,
            r2_key: p.r2_key,
            caption: p.caption,
            sort_order: p.sort_order,
          }))
          const { error: photoErr } = await sb
            .from('recommendation_photos')
            .insert(toInsert)
          if (photoErr) {
            console.error('Błąd carry zdjęć na scope item:', photoErr)
          }
        }
      }
    } catch (err) {
      console.error('Błąd auto-carry do repair_scope_items:', err)
    }
  }

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
        work_kind?: WorkKind | null
        urgency_level?: UrgencyLevel | null
        element_name?: string | null
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
          .select('scope_description, work_kind, urgency_level, element_name')
          .eq('inspection_id', prev.id)
          .order('item_number', { ascending: true })

        if (scopeData && scopeData.length > 0) {
          recommendations = scopeData.map((s) => ({
            text: s.scope_description as string,
            work_kind: (s.work_kind as WorkKind | null) ?? null,
            urgency_level: (s.urgency_level as UrgencyLevel | null) ?? null,
            element_name: (s.element_name as string | null) ?? null,
          }))
        } else {
          const { data: legacyData } = await sb
            .from('repair_recommendations')
            .select('scope_description, repair_type, urgency_level, element_name')
            .eq('inspection_id', prev.id)
          recommendations = (legacyData || []).map((r) => ({
            text: r.scope_description as string,
            work_kind: (r.repair_type as WorkKind | null) ?? null,
            urgency_level: (r.urgency_level as UrgencyLevel | null) ?? null,
            element_name: (r.element_name as string | null) ?? null,
          }))
        }

        if (recommendations.length > 0) {
          fromDate = prev.inspection_date as string
          fromProtocolNumber = (prev.protocol_number as string | null) ?? null
          source = 'previous_inspection'
        }
      }

      // -------------------------------------------------------------------
      // Warstwa 3: historical_protocols (archiwum) + historical_protocol_recommendations.
      // Po sesji 2026-05-10: 1346 strukturalnych zaleceń wyekstrahowanych z xlsx
      // dostępnych przez FK historical_protocol_recommendations -> historical_protocols.
      // Bierzemy najnowszy hp danego typu Z ZALECENIAMI (jeśli najnowszy hp
      // nie ma hpr, cofamy się do starszego). Gdy żaden hp tego typu nie ma
      // hpr — zostawiamy `historical_meta` (header z PDF, brak strukturalnych)
      // i fallback do legacy text (warstwa 4).
      // -------------------------------------------------------------------
      if (recommendations.length === 0) {
        const { data: histRows } = await sb
          .from('historical_protocols')
          .select(
            `id, inspection_date, year, protocol_number, protocol_pdf_url,
             historical_protocol_recommendations(id, item_number, recommendation_text, repair_type, urgency)`
          )
          .eq('turbine_id', turbineId)
          .eq('inspection_type', forType)
          .order('inspection_date', { ascending: false, nullsFirst: false })
          .order('year', { ascending: false })
          .limit(20)

        type HistRecRow = {
          id: string
          item_number: number
          recommendation_text: string
          repair_type: string | null
          urgency: string | null
        }
        type HistRow = {
          id: string
          inspection_date: string | null
          year: number | null
          protocol_number: string | null
          protocol_pdf_url: string | null
          historical_protocol_recommendations: HistRecRow[] | null
        }
        // Filtruj placeholder "BRAK ZALECEŃ" + dedup po tekście (chroni przed
        // bugiem 65 kolizji z sesji 2026-05-10 + 195 placeholder-rekordów).
        const cleanHistRecs = (recs: HistRecRow[] | null): HistRecRow[] => {
          const filtered = (recs || []).filter((r) => {
            const t = (r.recommendation_text || '').trim().toLowerCase()
            if (!t) return false
            if (t.startsWith('brak zalece') || t.startsWith('brak robót')) return false
            return true
          })
          const seen = new Set<string>()
          const out: HistRecRow[] = []
          for (const r of filtered) {
            const key = r.recommendation_text.trim().toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            out.push(r)
          }
          return out.sort((a, b) => a.item_number - b.item_number)
        }
        const hists = (histRows || []) as HistRow[]
        const histWithRecs = hists
          .map((h) => ({ row: h, cleaned: cleanHistRecs(h.historical_protocol_recommendations) }))
          .find((x) => x.cleaned.length > 0)
        const histAny = hists[0]

        if (histWithRecs) {
          // Mamy strukturalne zalecenia — używamy ich. Numer/data/PDF z TEGO
          // protokołu (nie z najnowszego), żeby zachować spójność źródła.
          fromDate = histWithRecs.row.inspection_date
          fromProtocolNumber = histWithRecs.row.protocol_number
          pdfUrl = histWithRecs.row.protocol_pdf_url
          source = 'previous_inspection'
          recommendations = histWithRecs.cleaned.map((r) => ({
            text: r.recommendation_text,
            work_kind: (r.repair_type as WorkKind | null) ?? null,
            urgency_level: (r.urgency as UrgencyLevel | null) ?? null,
          }))
        } else if (histAny) {
          // Jest najnowszy hp ale bez hpr — zostawiamy meta (header + PDF link),
          // strukturalnych zaleceń nie ekstrahujemy z PDF.
          fromDate = histAny.inspection_date
          fromProtocolNumber = histAny.protocol_number
          pdfUrl = histAny.protocol_pdf_url
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
        work_kind: r.work_kind ?? null,
        urgency_level: r.urgency_level ?? null,
        element_name: r.element_name ?? null,
      }))

      const { data: inserted, error: insertErr } = await sb
        .from('previous_recommendations')
        .insert(toInsert)
        .select()

      if (insertErr) throw insertErr
      const newItems = (inserted || []) as PreviousRecommendation[]
      setItems((prev) => [...prev, ...newItems])

      // Auto-carry: pozycje wstawione od razu ze statusem 'nie' (z legacy
      // turbine_findings) liczą się jako "pierwsze zaznaczenie Nie" i lecą
      // do repair_scope_items. Sekwencyjnie, bo ensureCarryToScope wewnątrz
      // robi SELECT+INSERT i każdy kolejny call musi widzieć stan po poprzednim.
      for (const it of newItems) {
        if (it.completion_status === 'nie' && it.recommendation_text) {
          await ensureCarryToScope(it.recommendation_text, forType, {
            work_kind: it.work_kind,
            urgency_level: it.urgency_level,
            element_name: it.element_name,
            prevRecId: it.id,
          })
        }
      }

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
    field:
      | 'recommendation_text'
      | 'completion_status'
      | 'remarks'
      | 'work_kind'
      | 'urgency_level'
      | 'element_name',
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
                  : field === 'work_kind'
                    ? (value as WorkKind | null)
                    : field === 'urgency_level'
                      ? (value as UrgencyLevel | null)
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

        // Auto-carry: zaznaczenie "nie wykonano" przepisuje pozycję do
        // repair_scope_items (z dedupem po tekście). Closure-captured `items`
        // ma aktualny tekst — wystarczy do tej operacji. Reverse (zmiana
        // statusu z 'nie' na inny) NIE usuwa pozycji ze scope.
        if (field === 'completion_status' && value === 'nie') {
          const row = items.find((i) => i.id === id)
          const sourceType = row?.source_inspection_type
          if (sourceType && row?.recommendation_text) {
            void ensureCarryToScope(row.recommendation_text, sourceType, {
              work_kind: row.work_kind,
              urgency_level: row.urgency_level,
              element_name: row.element_name,
              prevRecId: row.id,
            })
          }
        }

        // Propagacja do scope_item zmian element_name / work_kind /
        // urgency_level w już-carry'owanym prev_rec. Uwaga Artura 2026-05-12:
        // gdy inspektor uzupełnia "Element / lokalizacja" w prev_rec
        // (legacy hpr nie ma element_name), wartość ma się pojawiać w
        // scope_item z bieżącej kontroli. `ensureCarryToScope` ma logikę
        // backfill NULL-only — nie nadpisuje świadomych edycji w scope.
        if (
          (field === 'element_name' ||
            field === 'work_kind' ||
            field === 'urgency_level') &&
          value
        ) {
          const row = items.find((i) => i.id === id)
          if (
            row?.completion_status === 'nie' &&
            row.source_inspection_type &&
            row.recommendation_text
          ) {
            void ensureCarryToScope(
              row.recommendation_text,
              row.source_inspection_type,
              {
                work_kind: field === 'work_kind' ? (value as WorkKind) : row.work_kind,
                urgency_level:
                  field === 'urgency_level' ? (value as UrgencyLevel) : row.urgency_level,
                element_name: field === 'element_name' ? value : row.element_name,
                prevRecId: row.id,
              }
            )
          }
        }
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
        inspectionId={inspectionId}
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
        inspectionId={inspectionId}
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
              inspectionId={inspectionId}
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
  inspectionId: string
  meta: SourceMeta | undefined
  autoImportInfo: AutoImportInfo | undefined
  importing: boolean
  turbineId?: string
  isSaving: boolean
  onAdd: () => void
  onImport: () => void
  onUpdate: (
    id: string,
    field:
      | 'recommendation_text'
      | 'completion_status'
      | 'remarks'
      | 'work_kind'
      | 'urgency_level'
      | 'element_name',
    value: string | null
  ) => void
  onDelete: (id: string) => void
  onUpdateNumber: (id: string, raw: string) => void
  onDismissImportInfo: () => void
}

function SourceSection({
  type,
  items,
  inspectionId,
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
            inspectionId={inspectionId}
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
  inspectionId: string
  onUpdate: (
    id: string,
    field:
      | 'recommendation_text'
      | 'completion_status'
      | 'remarks'
      | 'work_kind'
      | 'urgency_level'
      | 'element_name',
    value: string | null
  ) => void
  onDelete: (id: string) => void
  onUpdateNumber: (id: string, raw: string) => void
}

function RecommendationList({
  items,
  inspectionId,
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label
                htmlFor={`element-${item.id}`}
                className="text-xs text-graphite-500"
              >
                Element / lokalizacja
              </Label>
              <ElementNameInput
                value={item.element_name || ''}
                onChange={(v) => onUpdate(item.id, 'element_name', v)}
                placeholder="np. Fundament, Wieża segment 2"
                className="text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor={`work-kind-${item.id}`}
                className="text-xs text-graphite-500"
              >
                Rodzaj robót
              </Label>
              <select
                id={`work-kind-${item.id}`}
                value={item.work_kind ?? ''}
                onChange={(e) =>
                  onUpdate(item.id, 'work_kind', e.target.value || null)
                }
                className="flex h-9 w-full rounded-md border border-graphite-200 bg-white px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value="">—</option>
                {WORK_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
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
                value={item.urgency_level ?? ''}
                onChange={(e) =>
                  onUpdate(item.id, 'urgency_level', e.target.value || null)
                }
                className="flex h-9 w-full rounded-md border border-graphite-200 bg-white px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value="">—</option>
                {URGENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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

          {/* Zdjęcia: widoczne dla każdego wpisu — ale szczególnie ważne gdy
              inspektor zaznacza "Nie wykonano" (dowód stanu). Przy carry-over
              do scope_items wskaźniki kopiują się automatycznie. */}
          <RecommendationPhotos
            inspectionId={inspectionId}
            parentType="previous_recommendation"
            parentId={item.id}
          />
        </li>
      ))}
    </ul>
  )
}

// ─── Photo gallery per recommendation ─────────────────────────────────────

interface RecommendationPhotosProps {
  inspectionId: string
  parentType: 'previous_recommendation' | 'repair_scope_item'
  parentId: string
}

interface PhotoRow {
  id: string
  file_url: string
  caption: string | null
  sort_order: number
}

/**
 * Wgrywanie i podgląd zdjęć dowodowych przypiętych do jednej pozycji
 * z `previous_recommendations` (a po carry-over także do `repair_scope_items`).
 *
 * Pipeline jak w PhotoGallery dla inspekcji: kompresja → presigned PUT R2 →
 * INSERT do `recommendation_photos`. Carry zdjęć na scope obsłuży
 * `ensureCarryToScope` (po INSERT scope_item kopiuje wskaźniki).
 */
function RecommendationPhotos({
  inspectionId,
  parentType,
  parentId,
}: RecommendationPhotosProps) {
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, parentType])

  const load = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase()
        .from('recommendation_photos')
        .select('id, file_url, caption, sort_order')
        .eq('parent_type', parentType)
        .eq('parent_id', parentId)
        .order('sort_order', { ascending: true })
        .order('uploaded_at', { ascending: true })
      if (error) throw error
      setPhotos((data || []) as PhotoRow[])
    } catch (err) {
      console.error('Błąd ładowania zdjęć zalecenia:', err)
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
        photos.length > 0
          ? Math.max(...photos.map((p) => p.sort_order))
          : 0
      const fresh: UploadedRecommendationPhoto[] = []
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const uploaded = await uploadRecommendationPhoto({
          file: f,
          inspectionId,
          parentType,
          parentId,
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
      console.error('Błąd uploadu zdjęcia zalecenia:', err)
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
      // Uwaga: nie usuwamy pliku z R2 — może być nadal użyty przez kopię
      // na scope_item (carry-over kopiuje wskaźnik, nie plik).
    } catch (err) {
      console.error('Błąd usuwania zdjęcia:', err)
      void load() // resync UI
    }
  }

  if (isLoading) {
    return (
      <div className="text-xs text-graphite-400">Ładowanie zdjęć…</div>
    )
  }

  return (
    <div className="space-y-2 pt-1">
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
