'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ExternalLink, ImageIcon, Plus, Trash2, Upload, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

/**
 * PIIB metryczka — kompozyt pól nagłówka protokołu wg Załącznika do uchwały
 * nr PIIB/KR/0051/2024 KR PIIB.
 *
 * Edycja wszystkich nowych kolumn metryczki w `inspections`:
 * - object_address, object_registry_number, object_name, object_photo_url
 * - owner_name, manager_name, contractor_info, additional_participants
 * - general_findings_intro, kob_entries_summary
 * - documents_reviewed (JSONB — 5 sub-pól: previous_annual, previous_5y,
 *   electrical_measurements, service, other)
 *
 * Self-contained: ładuje stan z DB, zapisuje 800ms na blur.
 */

/**
 * Status okazania dokumentu w sekcji „Dokumenty przedstawione do wglądu".
 * - `okazano`: dokument przedstawiony i ważny
 * - `nie_okazano`: dokument nie został przedstawiony / brak
 * - `null`: nie określono (default)
 */
type DocumentStatus = 'okazano' | 'nie_okazano' | null

/**
 * Wpis dla pojedynczego rodzaju dokumentu. `info` zawiera tekst dokumentu
 * (np. „Protokół nr 165/T/2025 z 14.05.2025") — auto-uzupełniany z bazy
 * jeśli istnieją dane z poprzedniej kontroli, edytowalny ręcznie.
 *
 * BACKWARD COMPAT: starsze inspekcje mogą mieć `documents_reviewed.X` jako
 * goły string. `asEntry()` normalizuje do tego kształtu.
 */
interface DocumentEntry {
  status: DocumentStatus
  info: string | null
}

type DocumentValue = DocumentEntry | string | null | undefined

interface DocumentsReviewed {
  previous_annual?: DocumentValue
  previous_5y?: DocumentValue
  electrical_measurements?: DocumentValue
  service?: DocumentValue
  other?: string
}

/** Normalizuje wartość do `DocumentEntry`. Stringi (legacy) → `info`. */
function asEntry(v: DocumentValue): DocumentEntry {
  if (!v) return { status: null, info: null }
  if (typeof v === 'string') return { status: null, info: v }
  return {
    status: v.status ?? null,
    info: v.info ?? null,
  }
}

/** Czy entry ma sens zapisywać (cokolwiek wypełnione). */
function entryIsEmpty(e: DocumentEntry): boolean {
  return e.status === null && (!e.info || !e.info.trim())
}

interface InspectionMetadata {
  object_address: string | null
  object_registry_number: string | null
  object_name: string | null
  object_photo_url: string | null
  owner_name: string | null
  manager_name: string | null
  contractor_info: string | null
  additional_participants: string | null
  general_findings_intro: string | null
  kob_entries_summary: string | null
  documents_reviewed: DocumentsReviewed | null
}

/** Inspektor z bazy (do multi-select „Wykonawca kontroli"). */
interface AvailableInspector {
  id: string
  full_name: string
  license_number: string | null
  specialty: 'konstrukcyjna' | 'elektryczna' | 'sanitarna' | 'inna' | null
  specialty_description: string | null
  chamber_membership: string | null
}

/** Przedstawiciel klienta (do multi-select „Przy udziale"). */
interface ClientRepresentative {
  id: string
  client_id: string
  full_name: string
  role: string | null
  phone: string | null
  email: string | null
  is_active: boolean
}

/** Etykiety branż dla widoku — krótkie. */
const SPECIALTY_LABEL: Record<NonNullable<AvailableInspector['specialty']>, string> = {
  konstrukcyjna: 'budowlana',
  elektryczna: 'elektryczna',
  sanitarna: 'sanitarna',
  inna: 'inna',
}

interface InspectionMetadataPiibProps {
  inspectionId: string
  /** Czy widoczna sekcja kob_entries_summary z opisem dla 5-letniej (5 lat) vs rocznej (12 mies.) */
  inspectionType?: 'annual' | 'five_year'
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

const EMPTY_METADATA: InspectionMetadata = {
  object_address: null,
  object_registry_number: null,
  object_name: null,
  object_photo_url: null,
  owner_name: null,
  manager_name: null,
  contractor_info: null,
  additional_participants: null,
  general_findings_intro: null,
  kob_entries_summary: null,
  documents_reviewed: null,
}

interface TurbinePhotos {
  turbineId: string | null
  photo_url: string | null
  photo_url_2: string | null
  photo_url_3: string | null
}

/**
 * Read-only podgląd zdjęcia turbiny w metryczce inspekcji.
 * Zdjęcia uzupełnia się w karcie turbiny — tu tylko render.
 */
function PhotoPreview({
  url,
  label,
  aspectClass,
}: {
  url: string | null
  label: string
  aspectClass: string
}) {
  return (
    <div className="space-y-1">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          className={`${aspectClass} w-full object-cover rounded-md border border-graphite-200 bg-graphite-50`}
        />
      ) : (
        <div
          className={`${aspectClass} w-full rounded-md border border-dashed border-graphite-300 bg-graphite-50 flex flex-col items-center justify-center text-graphite-400`}
        >
          <ImageIcon size={24} />
          <span className="text-[10px] mt-1 text-center px-1">brak zdjęcia</span>
        </div>
      )}
      <p className="text-[11px] text-graphite-500 text-center">{label}</p>
    </div>
  )
}

const EMPTY_TURBINE_PHOTOS: TurbinePhotos = {
  turbineId: null,
  photo_url: null,
  photo_url_2: null,
  photo_url_3: null,
}

/**
 * Kształt rzędu z `turbines` używany do auto-uzupełniania pól metryczki.
 * Supabase zwraca relacje `wind_farms` / `clients` pojedynczo (po `.single()`),
 * ale typy generyczne traktują je jako obiekt — typujemy tu wąsko.
 */
interface TurbineForDefaults {
  id: string
  photo_url: string | null
  photo_url_2: string | null
  photo_url_3: string | null
  turbine_code: string | null
  ew_designation: string | null
  manufacturer: string | null
  model: string | null
  location_address: string | null
  cadastral_parcel: string | null
  /** PIIB pola — edytowalne też w metryczce inspekcji (zapis do `turbines`). */
  tower_construction_type: 'stalowa' | 'zelbetowa' | 'hybrydowa' | 'inna' | null
  commissioning_year: number | null
  building_permit_number: string | null
  building_permit_date: string | null
  wind_farms: {
    location_gmina: string | null
    location_powiat: string | null
    location_voivodeship: string | null
    clients: { id: string; name: string | null } | null
  } | null
}

/** Stan edycji 4 pól turbiny widocznych w metryczce inspekcji. */
interface TurbinePiibFields {
  tower_construction_type: 'stalowa' | 'zelbetowa' | 'hybrydowa' | 'inna' | null
  commissioning_year: number | null
  building_permit_number: string | null
  building_permit_date: string | null
}

const EMPTY_TURBINE_PIIB: TurbinePiibFields = {
  tower_construction_type: null,
  commissioning_year: null,
  building_permit_number: null,
  building_permit_date: null,
}

const TOWER_CONSTRUCTION_LABELS: Record<
  NonNullable<TurbinePiibFields['tower_construction_type']>,
  string
> = {
  stalowa: 'Stalowa',
  zelbetowa: 'Żelbetowa',
  hybrydowa: 'Hybrydowa (stal+żelbet)',
  inna: 'Inna',
}

const trim = (v: string | null | undefined) => v?.trim() || null

function buildDefaultObjectAddress(t: TurbineForDefaults): string | null {
  const parts: string[] = []
  const loc = trim(t.location_address)
  if (loc) parts.push(loc)

  const wf = t.wind_farms
  const adminParts: string[] = []
  if (trim(wf?.location_gmina)) adminParts.push(`gmina ${trim(wf!.location_gmina)}`)
  if (trim(wf?.location_powiat)) adminParts.push(`powiat ${trim(wf!.location_powiat)}`)
  if (trim(wf?.location_voivodeship)) adminParts.push(`woj. ${trim(wf!.location_voivodeship)}`)
  if (adminParts.length) parts.push(adminParts.join(', '))

  const cad = trim(t.cadastral_parcel)
  if (cad) parts.push(`dz. ewid. ${cad}`)

  return parts.length > 0 ? parts.join('; ') : null
}

function buildDefaultObjectRegistryNumber(t: TurbineForDefaults): string | null {
  return trim(t.ew_designation) || trim(t.turbine_code)
}

function buildDefaultObjectName(t: TurbineForDefaults): string | null {
  const manuf = trim(t.manufacturer)
  const model = trim(t.model)
  // Czasem `model` zaczyna się od nazwy producenta (np. „GE 2.5xl" przy
  // manufacturer „GE") — bez tego sklejka dawałaby „GE GE 2.5xl". Pomijamy
  // producenta jeśli model już zaczyna się od jego nazwy (case-insensitive,
  // tylko jako pełny token, żeby „Vestas V52" + „Vestas" działało, ale
  // „Enercon E66" + „En" nie strigerowało).
  const modelStartsWithManuf =
    manuf && model && new RegExp(`^${manuf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(model)
  const suffix = modelStartsWithManuf
    ? model
    : [manuf, model].filter(Boolean).join(' ')
  return suffix
    ? `Elektrownia wiatrowa — turbina wiatrowa ${suffix}`
    : 'Elektrownia wiatrowa — turbina wiatrowa'
}

function buildDefaultOwnerName(t: TurbineForDefaults): string | null {
  return trim(t.wind_farms?.clients?.name)
}

/**
 * Format daty ISO → `dd.mm.yyyy` (PL). Bez biblioteki `date-fns` żeby nie
 * powiększać bundla tej karty (i tak ładujemy ją w terenie).
 */
function fmtDatePL(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

/**
 * Składa propozycję `info` dla 4 typów dokumentów na podstawie zawartości bazy:
 *  - previous_annual: ostatnia zakończona/podpisana inspekcja roczna tej turbiny
 *  - previous_5y: ostatnia zakończona/podpisana inspekcja 5-letnia tej turbiny
 *  - electrical_measurements: pole electrical_measurement_protocol_number /
 *    electrical_measurement_date z bieżącej lub poprzedniej 5-letniej
 *  - service: service_info.last_service_protocol_number / last_service_date
 *    z bieżącej inspekcji (najczęściej user już to ma w sekcji Serwis)
 *
 * Zwraca tylko klucze, które udało się ustalić — nie nadpisuje pustych.
 */
async function loadDocumentsAutoFill(
  sb: ReturnType<typeof createBrowserClient>,
  turbineId: string,
  currentInspectionId: string,
): Promise<{
  previous_annual?: DocumentEntry
  previous_5y?: DocumentEntry
  electrical_measurements?: DocumentEntry
  service?: DocumentEntry
}> {
  // Zwracamy DocumentEntry z `status: 'okazano'` + `info` BEZ prefiksu
  // "Okazano, " — status jest renderowany w lewym Selecie, więc gdyby
  // został w info, byłby duplikowany (uwaga Artura 2026-05-12).
  const out: Partial<{
    previous_annual: DocumentEntry
    previous_5y: DocumentEntry
    electrical_measurements: DocumentEntry
    service: DocumentEntry
  }> = {}

  // Auto-status='okazano' tylko gdy plik PDF faktycznie istnieje w R2 —
  // inaczej `status=null` (inspektor sam zaznaczy po fizycznym sprawdzeniu).
  // Uwaga Artura 2026-05-12: "Automatyczny wybór okazano w przypadku istnienia
  // dokumentu w bazie R2".
  const autoEntry = (parts: string[], hasFile: boolean): DocumentEntry => ({
    status: hasFile ? 'okazano' : null,
    info: parts.length > 0 ? parts.join(', ') : null,
  })

  // Poprzednia roczna i 5-letnia inspekcja tej turbiny — najpierw nowe
  // inspekcje (status completed/signed), potem fallback do tabeli
  // `historical_protocols` z archiwum (zwykle pokrywa przed wdrożeniem appki).
  const { data: prevs } = await sb
    .from('inspections')
    .select(
      'id, inspection_date, inspection_type, protocol_number, status, generated_pdf_url'
    )
    .eq('turbine_id', turbineId)
    .neq('id', currentInspectionId)
    .in('status', ['completed', 'signed'])
    .not('is_deleted', 'is', true)
    .order('inspection_date', { ascending: false })

  type PrevRow = {
    id: string
    inspection_date: string | null
    inspection_type: 'annual' | 'five_year' | null
    protocol_number: string | null
    generated_pdf_url: string | null
  }
  const prevList = (prevs || []) as PrevRow[]
  let prevAnnual = prevList.find((p) => p.inspection_type === 'annual')
  let prevFiveYear = prevList.find((p) => p.inspection_type === 'five_year')

  // Fallback do archiwum: jeśli któreś (annual / five_year) nie znaleziono
  // w nowych inspekcjach, dociągamy z `historical_protocols`.
  const needHistoricalAnnual = !prevAnnual
  const needHistoricalFiveYear = !prevFiveYear
  if (needHistoricalAnnual || needHistoricalFiveYear) {
    const { data: histRows } = await sb
      .from('historical_protocols')
      .select(
        'id, inspection_date, inspection_type, protocol_number, year, protocol_pdf_url'
      )
      .eq('turbine_id', turbineId)
      .order('inspection_date', { ascending: false, nullsFirst: false })
      .order('year', { ascending: false })

    type HistRow = {
      id: string
      inspection_date: string | null
      inspection_type: string | null
      protocol_number: string | null
      protocol_pdf_url: string | null
    }
    const histList = (histRows || []) as HistRow[]
    if (needHistoricalAnnual) {
      const h = histList.find((r) => r.inspection_type === 'annual')
      if (h) {
        prevAnnual = {
          id: h.id,
          inspection_date: h.inspection_date,
          inspection_type: 'annual',
          protocol_number: h.protocol_number,
          generated_pdf_url: h.protocol_pdf_url,
        }
      }
    }
    if (needHistoricalFiveYear) {
      const h = histList.find((r) => r.inspection_type === 'five_year')
      if (h) {
        prevFiveYear = {
          id: h.id,
          inspection_date: h.inspection_date,
          inspection_type: 'five_year',
          protocol_number: h.protocol_number,
          generated_pdf_url: h.protocol_pdf_url,
        }
      }
    }
  }

  if (prevAnnual) {
    const parts: string[] = []
    if (prevAnnual.protocol_number)
      parts.push(`nr ${prevAnnual.protocol_number}`)
    const d = fmtDatePL(prevAnnual.inspection_date)
    if (d) parts.push(`z dnia ${d}`)
    out.previous_annual = autoEntry(parts, !!prevAnnual.generated_pdf_url)
  }

  if (prevFiveYear) {
    const parts: string[] = []
    if (prevFiveYear.protocol_number)
      parts.push(`nr ${prevFiveYear.protocol_number}`)
    const d = fmtDatePL(prevFiveYear.inspection_date)
    if (d) parts.push(`z dnia ${d}`)
    out.previous_5y = autoEntry(parts, !!prevFiveYear.generated_pdf_url)
  }

  // Pomiary elektryczne — najpierw bieżąca inspekcja (jeśli ma podsumowanie
  // pomiarów wpisane), potem poprzednia 5-letnia jako fallback.
  const { data: currentInsp } = await sb
    .from('inspections')
    .select(
      'electrical_measurement_protocol_number, electrical_measurement_date, electrical_measurement_protocol_url'
    )
    .eq('id', currentInspectionId)
    .maybeSingle()
  const cur = currentInsp as
    | {
        electrical_measurement_protocol_number: string | null
        electrical_measurement_date: string | null
        electrical_measurement_protocol_url: string | null
      }
    | null

  let emProto: string | null = null
  let emDate: string | null = null
  let emFileUrl: string | null = null
  if (cur?.electrical_measurement_protocol_number || cur?.electrical_measurement_date) {
    emProto = cur.electrical_measurement_protocol_number ?? null
    emDate = cur.electrical_measurement_date ?? null
    emFileUrl = cur.electrical_measurement_protocol_url ?? null
  } else if (prevFiveYear) {
    const { data: prevEm } = await sb
      .from('inspections')
      .select(
        'electrical_measurement_protocol_number, electrical_measurement_date, electrical_measurement_protocol_url'
      )
      .eq('id', prevFiveYear.id)
      .maybeSingle()
    const pem = prevEm as
      | {
          electrical_measurement_protocol_number: string | null
          electrical_measurement_date: string | null
          electrical_measurement_protocol_url: string | null
        }
      | null
    emProto = pem?.electrical_measurement_protocol_number ?? null
    emDate = pem?.electrical_measurement_date ?? null
    emFileUrl = pem?.electrical_measurement_protocol_url ?? null
  }

  // Fallback do archiwum: protokoły pomiarów elektrycznych zalegują w
  // `historical_protocols` z typem `electrical_measurement`.
  if (!emProto && !emDate) {
    const { data: histEm } = await sb
      .from('historical_protocols')
      .select('protocol_number, inspection_date, year, protocol_pdf_url')
      .eq('turbine_id', turbineId)
      .eq('inspection_type', 'electrical_measurement')
      .order('inspection_date', { ascending: false, nullsFirst: false })
      .order('year', { ascending: false })
      .limit(1)
    const h = (histEm || [])[0] as
      | {
          protocol_number: string | null
          inspection_date: string | null
          protocol_pdf_url: string | null
        }
      | undefined
    if (h) {
      emProto = h.protocol_number ?? null
      emDate = h.inspection_date ?? null
      emFileUrl = h.protocol_pdf_url ?? null
    }
  }

  if (emProto || emDate) {
    const parts: string[] = []
    if (emProto) parts.push(`nr ${emProto}`)
    const d = fmtDatePL(emDate)
    if (d) parts.push(`z dnia ${d}`)
    out.electrical_measurements = autoEntry(parts, !!emFileUrl)
  }

  // Serwis — z service_info bieżącej inspekcji (cykliczność + protokół).
  const { data: svc } = await sb
    .from('service_info')
    .select(
      'service_company, last_service_protocol_number, last_service_date, next_service_date'
    )
    .eq('inspection_id', currentInspectionId)
    .maybeSingle()
  const svcRow = svc as
    | {
        service_company: string | null
        last_service_protocol_number: string | null
        last_service_date: string | null
        next_service_date: string | null
      }
    | null
  if (
    svcRow &&
    (svcRow.service_company ||
      svcRow.last_service_protocol_number ||
      svcRow.last_service_date)
  ) {
    const parts: string[] = []
    if (svcRow.last_service_protocol_number)
      parts.push(`nr ${svcRow.last_service_protocol_number}`)
    const d = fmtDatePL(svcRow.last_service_date)
    if (d) parts.push(`z dnia ${d}`)
    if (svcRow.service_company) parts.push(svcRow.service_company)
    // Brak kolumny URL dla serwisu — inspektor sam zaznacza status po
    // fizycznym sprawdzeniu protokołu serwisowego.
    out.service = autoEntry(parts, false)
  }

  return out
}

const DOCUMENT_STATUS_OPTIONS: Array<{
  value: 'okazano' | 'nie_okazano' | 'none'
  label: string
}> = [
  { value: 'none', label: '— nie określono —' },
  { value: 'okazano', label: 'Okazano' },
  { value: 'nie_okazano', label: 'Nie okazano' },
]

export function InspectionMetadataPiib({
  inspectionId,
  inspectionType = 'annual',
}: InspectionMetadataPiibProps) {
  const [meta, setMeta] = useState<InspectionMetadata>(EMPTY_METADATA)
  const [turbinePhotos, setTurbinePhotos] =
    useState<TurbinePhotos>(EMPTY_TURBINE_PHOTOS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Pola turbiny (PIIB Podstawowe dane obiektu) — edytowalne tutaj, zapis
  // bezpośrednio do tabeli `turbines`. Te same pola są widoczne na karcie turbiny.
  const [turbinePiib, setTurbinePiib] = useState<TurbinePiibFields>(EMPTY_TURBINE_PIIB)
  const [turbineSaving, setTurbineSaving] = useState(false)
  const turbineDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Wykonawca kontroli — multi-select inspektorów (junction inspection_inspectors).
  const [allInspectors, setAllInspectors] = useState<AvailableInspector[]>([])
  const [selectedInspectorIds, setSelectedInspectorIds] = useState<Set<string>>(
    new Set()
  )

  // Przy udziale — przedstawiciele klienta (junction inspection_participants).
  const [clientId, setClientId] = useState<string | null>(null)
  const [allReps, setAllReps] = useState<ClientRepresentative[]>([])
  const [selectedRepIds, setSelectedRepIds] = useState<Set<string>>(new Set())

  // Dialog dodawania nowego przedstawiciela. Kontekst decyduje, gdzie nowy
  // wpis trafi po zapisie: 'participant' = auto-check w „Przy udziale",
  // 'manager' = ustawienie jako zarządca obiektu.
  const [repDialogOpen, setRepDialogOpen] = useState(false)
  const [repDialogContext, setRepDialogContext] = useState<'participant' | 'manager'>(
    'participant'
  )
  const [repForm, setRepForm] = useState({
    full_name: '',
    role: '',
    phone: '',
    email: '',
  })
  const [repSaving, setRepSaving] = useState(false)

  useEffect(() => {
    void loadMetadata()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const loadMetadata = async () => {
    try {
      const sb = supabase()
      const { data, error } = await sb
        .from('inspections')
        .select(
          `object_address, object_registry_number, object_name, object_photo_url,
           owner_name, manager_name, contractor_info, additional_participants,
           general_findings_intro, kob_entries_summary, documents_reviewed,
           turbine_id`
        )
        .eq('id', inspectionId)
        .single()

      if (error) throw error
      if (!data) return

      const loaded: InspectionMetadata = {
        ...EMPTY_METADATA,
        ...data,
        documents_reviewed:
          (data.documents_reviewed as DocumentsReviewed) || null,
      }

      // Auto-pull danych z karty turbiny (zdjęcia + adres/właściciel/itp.)
      const tId = (data as { turbine_id?: string | null }).turbine_id ?? null
      if (tId) {
        const { data: turbineData, error: tErr } = await sb
          .from('turbines')
          .select(
            `id, photo_url, photo_url_2, photo_url_3,
             turbine_code, ew_designation, manufacturer, model,
             location_address, cadastral_parcel,
             tower_construction_type, commissioning_year,
             building_permit_number, building_permit_date,
             wind_farms (
               location_gmina, location_powiat, location_voivodeship,
               clients ( id, name )
             )`
          )
          .eq('id', tId)
          .single()

        if (!tErr && turbineData) {
          // Supabase generuje typy, w których relacje (`wind_farms`, `clients`)
          // są tablicami nawet po `.single()`. Faktycznie mamy obiekt — castujemy.
          const t = turbineData as unknown as TurbineForDefaults
          setTurbinePhotos({
            turbineId: t.id,
            photo_url: t.photo_url,
            photo_url_2: t.photo_url_2,
            photo_url_3: t.photo_url_3,
          })

          // Pola PIIB turbiny — edytowalne w metryczce inspekcji.
          setTurbinePiib({
            tower_construction_type: t.tower_construction_type,
            commissioning_year: t.commissioning_year,
            building_permit_number: t.building_permit_number,
            building_permit_date: t.building_permit_date,
          })

          // ── Klient (do filtrowania przedstawicieli) ────────────────────
          const cId = t.wind_farms?.clients?.id ?? null
          setClientId(cId)

          // ── Wykonawcy + przedstawiciele (równolegle) ───────────────────
          const [
            { data: inspectorsRows, error: insErr },
            { data: linkedInspectors, error: linkInsErr },
            { data: repsRows, error: repsErr },
            { data: linkedReps, error: linkRepsErr },
          ] = await Promise.all([
            sb
              .from('inspectors')
              .select(
                'id, full_name, license_number, specialty, specialty_description, chamber_membership'
              )
              .eq('is_active', true)
              .eq('is_deleted', false)
              .order('full_name', { ascending: true }),
            sb
              .from('inspection_inspectors')
              .select('inspector_id')
              .eq('inspection_id', inspectionId),
            cId
              ? sb
                  .from('client_representatives')
                  .select('id, client_id, full_name, role, phone, email, is_active')
                  .eq('client_id', cId)
                  .eq('is_deleted', false)
                  .order('full_name', { ascending: true })
              : Promise.resolve({ data: [] as ClientRepresentative[], error: null }),
            sb
              .from('inspection_participants')
              .select('representative_id')
              .eq('inspection_id', inspectionId),
          ])

          if (insErr) console.error('Błąd ładowania inspektorów:', insErr)
          if (inspectorsRows) {
            setAllInspectors(inspectorsRows as AvailableInspector[])
          }
          if (linkInsErr)
            console.error('Błąd ładowania powiązanych wykonawców:', linkInsErr)
          if (linkedInspectors) {
            setSelectedInspectorIds(
              new Set(
                (linkedInspectors as Array<{ inspector_id: string }>).map(
                  (r) => r.inspector_id
                )
              )
            )
          }

          if (repsErr) console.error('Błąd ładowania przedstawicieli:', repsErr)
          if (repsRows) setAllReps(repsRows as ClientRepresentative[])

          if (linkRepsErr)
            console.error('Błąd ładowania powiązanych przedstawicieli:', linkRepsErr)
          if (linkedReps) {
            setSelectedRepIds(
              new Set(
                (linkedReps as Array<{ representative_id: string }>).map(
                  (r) => r.representative_id
                )
              )
            )
          }

          // Wylicz domyślne wartości pól obiektu z karty turbiny i podstaw je
          // dla pól, które aktualnie są puste (NULL / pusty string). Edycje
          // użytkownika nie są nadpisywane.
          const autoFill: Partial<InspectionMetadata> = {}
          const isEmpty = (v: string | null | undefined) => !v || !v.trim()

          if (isEmpty(loaded.object_address)) {
            const v = buildDefaultObjectAddress(t)
            if (v) autoFill.object_address = v
          }
          if (isEmpty(loaded.object_registry_number)) {
            const v = buildDefaultObjectRegistryNumber(t)
            if (v) autoFill.object_registry_number = v
          }
          if (isEmpty(loaded.object_name)) {
            const v = buildDefaultObjectName(t)
            if (v) autoFill.object_name = v
          }
          if (isEmpty(loaded.owner_name)) {
            const v = buildDefaultOwnerName(t)
            if (v) autoFill.owner_name = v
          }

          // Auto-fill `documents_reviewed.*.info` z poprzednich inspekcji tej
          // turbiny + service_info bieżącej. Nie nadpisujemy ręcznie wpisanych
          // wartości — tylko gdy `info` puste.
          const docsAutoFill = await loadDocumentsAutoFill(sb, tId, inspectionId)
          const currentDocs: DocumentsReviewed =
            (loaded.documents_reviewed as DocumentsReviewed) || {}
          const mergedDocs: DocumentsReviewed = { ...currentDocs }
          let docsChanged = false

          for (const key of [
            'previous_annual',
            'previous_5y',
            'electrical_measurements',
            'service',
          ] as const) {
            const proposed = docsAutoFill[key]
            if (!proposed) continue
            const existing = asEntry(currentDocs[key])
            if (existing.info && existing.info.trim()) continue
            // status: zachowaj świadomy wybór inspektora (np. "nie_okazano"),
            // inaczej weź z proposed ('okazano' z auto-fill).
            mergedDocs[key] = {
              status: existing.status ?? proposed.status,
              info: proposed.info,
            }
            docsChanged = true
          }

          if (docsChanged) {
            autoFill.documents_reviewed = mergedDocs
          }

          if (Object.keys(autoFill).length > 0) {
            Object.assign(loaded, autoFill)
            // Persist od razu, żeby nie trzeba było „ruszać" pól w UI.
            const { error: upErr } = await sb
              .from('inspections')
              .update(autoFill)
              .eq('id', inspectionId)
            if (upErr) console.error('Błąd auto-fillu metryczki:', upErr)
          }
        }
      }

      setMeta(loaded)
    } catch (err) {
      console.error('Błąd ładowania metryczki PIIB:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const queueSave = (updates: Partial<InspectionMetadata>) => {
    setMeta((prev) => ({ ...prev, ...updates }))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase()
          .from('inspections')
          .update(updates)
          .eq('id', inspectionId)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zapisu metryczki:', err)
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  const handleField = <K extends keyof InspectionMetadata>(
    field: K,
    value: InspectionMetadata[K]
  ) => {
    queueSave({ [field]: value } as Partial<InspectionMetadata>)
  }

  /**
   * Zapis pól PIIB turbiny (tower_construction_type, commissioning_year,
   * building_permit_*). Debounce 800ms — analogicznie do `queueSave`.
   * Pola należą do tabeli `turbines`, więc edycja tutaj zaktualizuje też
   * kartę turbiny i przyszłe inspekcje.
   */
  const handleTurbineField = <K extends keyof TurbinePiibFields>(
    field: K,
    value: TurbinePiibFields[K]
  ) => {
    setTurbinePiib((prev) => ({ ...prev, [field]: value }))

    if (!turbinePhotos.turbineId) return

    if (turbineDebounceRef.current) clearTimeout(turbineDebounceRef.current)
    turbineDebounceRef.current = setTimeout(async () => {
      setTurbineSaving(true)
      try {
        const { error } = await supabase()
          .from('turbines')
          .update({ [field]: value })
          .eq('id', turbinePhotos.turbineId!)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zapisu pól turbiny:', err)
      } finally {
        setTurbineSaving(false)
      }
    }, 800)
  }

  /**
   * Update jednego z 4 dokumentów strukturyzowanych (previous_annual,
   * previous_5y, electrical_measurements, service). Każdy ma `status` + `info`.
   */
  const handleDocEntry = (
    key: 'previous_annual' | 'previous_5y' | 'electrical_measurements' | 'service',
    patch: Partial<DocumentEntry>,
  ) => {
    const current = asEntry(meta.documents_reviewed?.[key] as DocumentValue)
    const next: DocumentEntry = {
      status: patch.status !== undefined ? patch.status : current.status,
      info: patch.info !== undefined ? patch.info : current.info,
    }
    const newDocs: DocumentsReviewed = {
      ...(meta.documents_reviewed || {}),
      [key]: entryIsEmpty(next) ? undefined : next,
    }
    saveDocs(newDocs)
  }

  /** Update pola wolnotekstowego „Inne dokumenty". */
  const handleDocOther = (value: string) => {
    const newDocs: DocumentsReviewed = {
      ...(meta.documents_reviewed || {}),
      other: value || undefined,
    }
    saveDocs(newDocs)
  }

  const saveDocs = (newDocs: DocumentsReviewed) => {
    const cleanDocs: DocumentsReviewed = {}
    for (const [k, v] of Object.entries(newDocs)) {
      if (v === undefined || v === null) continue
      if (typeof v === 'string' && !v.trim()) continue
      cleanDocs[k as keyof DocumentsReviewed] = v
    }
    queueSave({
      documents_reviewed:
        Object.keys(cleanDocs).length > 0 ? cleanDocs : null,
    })
  }

  /**
   * Upload zdjęcia obiektu do Supabase Storage (bucket: turbine-photos).
   * Po sukcesie ustawia object_photo_url na public URL.
   * Wzorzec analogiczny do turbiny/[id]/page.tsx (slot 1/2/3).
   */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Walidacja prosta: typ i rozmiar
    if (!file.type.startsWith('image/')) {
      alert('Wybierz plik graficzny (JPG, PNG, WebP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Plik za duży (max 10 MB).')
      return
    }

    setIsUploading(true)
    try {
      const sb = supabase()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `inspection-${inspectionId}-photo-${Date.now()}.${ext}`

      const { error: uploadError } = await sb.storage
        .from('turbine-photos')
        .upload(fileName, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = sb.storage
        .from('turbine-photos')
        .getPublicUrl(fileName)

      const url = publicUrlData.publicUrl
      // Save to DB and update local state via queueSave
      queueSave({ object_photo_url: url })

      // Reset input żeby ponowny wybór tego samego pliku zadziałał
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Błąd uploadu fotografii obiektu:', err)
      alert('Nie udało się wgrać zdjęcia. Spróbuj ponownie.')
    } finally {
      setIsUploading(false)
    }
  }

  const handlePhotoRemove = () => {
    if (!confirm('Usunąć fotografię obiektu z metryczki?')) return
    queueSave({ object_photo_url: null })
  }

  /**
   * Toggle inspektora w junction `inspection_inspectors`. Branża i is_lead
   * ustawiane automatycznie: specialty z karty inspektora (fallback `inna`),
   * is_lead = TRUE dla pierwszego dodanego, FALSE dla kolejnych.
   * Optymistyczna aktualizacja state + revert przy błędzie.
   */
  const toggleInspector = async (inspector: AvailableInspector) => {
    const sb = supabase()
    const isSelected = selectedInspectorIds.has(inspector.id)

    setSelectedInspectorIds((prev) => {
      const next = new Set(prev)
      if (isSelected) next.delete(inspector.id)
      else next.add(inspector.id)
      return next
    })

    try {
      if (isSelected) {
        const { error } = await sb
          .from('inspection_inspectors')
          .delete()
          .eq('inspection_id', inspectionId)
          .eq('inspector_id', inspector.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('inspection_inspectors').insert({
          inspection_id: inspectionId,
          inspector_id: inspector.id,
          specialty: inspector.specialty || 'inna',
          is_lead: selectedInspectorIds.size === 0,
        })
        if (error) throw error
      }
    } catch (err) {
      console.error('Błąd zapisu wykonawcy kontroli:', err)
      setSelectedInspectorIds((prev) => {
        const next = new Set(prev)
        if (isSelected) next.add(inspector.id)
        else next.delete(inspector.id)
        return next
      })
    }
  }

  /** Toggle przedstawiciela klienta w junction `inspection_participants`. */
  const toggleRepresentative = async (repId: string) => {
    const sb = supabase()
    const isSelected = selectedRepIds.has(repId)

    setSelectedRepIds((prev) => {
      const next = new Set(prev)
      if (isSelected) next.delete(repId)
      else next.add(repId)
      return next
    })

    try {
      if (isSelected) {
        const { error } = await sb
          .from('inspection_participants')
          .delete()
          .eq('inspection_id', inspectionId)
          .eq('representative_id', repId)
        if (error) throw error
      } else {
        const { error } = await sb
          .from('inspection_participants')
          .insert({ inspection_id: inspectionId, representative_id: repId })
        if (error) throw error
      }
    } catch (err) {
      console.error('Błąd zapisu uczestnika:', err)
      setSelectedRepIds((prev) => {
        const next = new Set(prev)
        if (isSelected) next.add(repId)
        else next.delete(repId)
        return next
      })
    }
  }

  /** Format pojedynczego przedstawiciela na potrzeby pól tekstowych (manager_name). */
  const formatRepDisplay = (rep: ClientRepresentative): string =>
    rep.role ? `${rep.full_name} (${rep.role})` : rep.full_name

  /**
   * Dodaje nowego przedstawiciela do `client_representatives`. W zależności
   * od `repDialogContext`:
   *   - 'participant' → przypina do bieżącej inspekcji (`inspection_participants`)
   *   - 'manager'     → ustawia jako zarządcę obiektu (`manager_name`)
   */
  const handleAddRep = async () => {
    if (!clientId) {
      alert('Brak klienta — sprawdź przypisanie turbiny do farmy/klienta.')
      return
    }
    if (!repForm.full_name.trim()) {
      alert('Imię i nazwisko jest wymagane.')
      return
    }
    setRepSaving(true)
    try {
      const sb = supabase()
      const { data, error } = await sb
        .from('client_representatives')
        .insert({
          client_id: clientId,
          full_name: repForm.full_name.trim(),
          role: repForm.role.trim() || null,
          phone: repForm.phone.trim() || null,
          email: repForm.email.trim() || null,
        })
        .select('id, client_id, full_name, role, phone, email, is_active')
        .single()
      if (error) throw error
      const newRep = data as ClientRepresentative
      setAllReps((prev) =>
        [...prev, newRep].sort((a, b) => a.full_name.localeCompare(b.full_name))
      )

      if (repDialogContext === 'manager') {
        // Zapis do inspections.manager_name
        handleField('manager_name', formatRepDisplay(newRep))
      } else {
        // Domyślnie: przypnij jako uczestnik bieżącej inspekcji
        const { error: linkErr } = await sb
          .from('inspection_participants')
          .insert({ inspection_id: inspectionId, representative_id: newRep.id })
        if (linkErr) throw linkErr
        setSelectedRepIds((prev) => {
          const next = new Set(prev)
          next.add(newRep.id)
          return next
        })
      }

      setRepForm({ full_name: '', role: '', phone: '', email: '' })
      setRepDialogOpen(false)
    } catch (err) {
      console.error('Błąd dodawania przedstawiciela:', err)
      alert('Nie udało się dodać przedstawiciela. Spróbuj ponownie.')
    } finally {
      setRepSaving(false)
    }
  }

  /** Otwiera dialog z odpowiednim kontekstem (zarządca vs uczestnik). */
  const openRepDialog = (context: 'participant' | 'manager') => {
    setRepDialogContext(context)
    setRepForm({ full_name: '', role: '', phone: '', email: '' })
    setRepDialogOpen(true)
  }

  /** Soft-delete przedstawiciela — wraca do bazy ale nie pojawia się w UI. */
  const handleDeleteRep = async (rep: ClientRepresentative) => {
    if (
      !confirm(
        `Usunąć przedstawiciela „${rep.full_name}" z listy klienta? Pozostanie zachowany w starszych inspekcjach, ale nie będzie już proponowany.`
      )
    )
      return
    try {
      const sb = supabase()
      const { error } = await sb
        .from('client_representatives')
        .update({ is_deleted: true })
        .eq('id', rep.id)
      if (error) throw error
      setAllReps((prev) => prev.filter((r) => r.id !== rep.id))
      // Odepnij od bieżącej inspekcji jeśli był wybrany
      if (selectedRepIds.has(rep.id)) {
        await sb
          .from('inspection_participants')
          .delete()
          .eq('inspection_id', inspectionId)
          .eq('representative_id', rep.id)
        setSelectedRepIds((prev) => {
          const next = new Set(prev)
          next.delete(rep.id)
          return next
        })
      }
    } catch (err) {
      console.error('Błąd usuwania przedstawiciela:', err)
      alert('Nie udało się usunąć. Spróbuj ponownie.')
    }
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl border-graphite-200">
        <CardContent className="py-8 text-center text-graphite-500">
          Ładowanie metryczki…
        </CardContent>
      </Card>
    )
  }

  const docs = meta.documents_reviewed || {}

  // Walidacja wykonawców kontroli — ostrzeżenie (nie blokada).
  const selectedInspectors = allInspectors.filter((i) =>
    selectedInspectorIds.has(i.id)
  )
  const inspectorWarnings: string[] = []
  if (selectedInspectors.length < 2) {
    inspectorWarnings.push(
      `Minimum 2 osoby wymagane (wybrano: ${selectedInspectors.length}). Wynika z zasad bezpieczeństwa pracy w terenie.`
    )
  }
  if (inspectionType === 'five_year') {
    const hasConstr = selectedInspectors.some(
      (i) => i.specialty === 'konstrukcyjna'
    )
    const hasElectr = selectedInspectors.some(
      (i) => i.specialty === 'elektryczna'
    )
    if (!hasConstr)
      inspectorWarnings.push(
        'Brak inspektora budowlanego (specjalność „konstrukcyjna") — wymagany dla kontroli 5-letniej.'
      )
    if (!hasElectr)
      inspectorWarnings.push(
        'Brak inspektora elektrycznego — wymagany dla kontroli 5-letniej.'
      )
  }

  return (
    <div className="space-y-6">
      {/* Sekcja 1: Metryczka obiektu */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">Metryczka obiektu (PIIB)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="object_address" className="font-medium">
                Adres obiektu budowlanego
              </Label>
              <Input
                id="object_address"
                value={meta.object_address || ''}
                onChange={(e) => handleField('object_address', e.target.value || null)}
                placeholder="miejscowość, gmina, powiat, województwo, dz. ewid."
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="object_registry_number" className="font-medium">
                Numer ewidencyjny obiektu
              </Label>
              <Input
                id="object_registry_number"
                value={meta.object_registry_number || ''}
                onChange={(e) =>
                  handleField('object_registry_number', e.target.value || null)
                }
                placeholder="nadawany przez właściciela / zarządcę"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="object_name" className="font-medium">
                Nazwa obiektu / funkcja
              </Label>
              <Input
                id="object_name"
                value={meta.object_name || ''}
                onChange={(e) => handleField('object_name', e.target.value || null)}
                placeholder="np. elektrownia wiatrowa – turbina wiatrowa"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="font-medium">
                  Zdjęcia turbiny (z karty turbiny)
                </Label>
                {turbinePhotos.turbineId && (
                  <Link
                    href={`/turbiny/${turbinePhotos.turbineId}`}
                    className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-800 hover:underline"
                    target="_blank"
                  >
                    <ExternalLink size={12} />
                    Edytuj zdjęcia w karcie turbiny
                  </Link>
                )}
              </div>
              <p className="text-xs text-graphite-500">
                Trzy zdjęcia referencyjne pobierane są z karty turbiny — te same trafiają do protokołu PDF/DOCX.
                Aby je dodać lub zmienić, otwórz kartę turbiny.
              </p>

              <div className="grid grid-cols-3 gap-3 mt-2">
                {/* Slot 1 — portret */}
                <PhotoPreview
                  url={turbinePhotos.photo_url}
                  label="Zdjęcie 1 (portret)"
                  aspectClass="aspect-[2/3]"
                />
                {/* Slot 2 — pejzaż */}
                <PhotoPreview
                  url={turbinePhotos.photo_url_2}
                  label="Zdjęcie 2 (pejzaż)"
                  aspectClass="aspect-[3/2]"
                />
                {/* Slot 3 — pejzaż */}
                <PhotoPreview
                  url={turbinePhotos.photo_url_3}
                  label="Zdjęcie 3 (pejzaż)"
                  aspectClass="aspect-[3/2]"
                />
              </div>

              {/* Legacy: pojedyncza fotografia object_photo_url — ukryte gdy są zdjęcia z turbiny */}
              {meta.object_photo_url && (
                <details className="mt-3 border border-graphite-200 rounded-md">
                  <summary className="cursor-pointer text-xs text-graphite-600 px-3 py-2 hover:bg-graphite-50">
                    Pole legacy: pojedyncze zdjęcie inspekcji (object_photo_url) —
                    kliknij, aby zobaczyć / usunąć
                  </summary>
                  <div className="p-3 space-y-2 border-t border-graphite-200">
                    <p className="text-xs text-graphite-500">
                      Wcześniejsze inspekcje używały jednego zdjęcia per inspekcja.
                      Teraz protokół korzysta z 3 zdjęć z karty turbiny — to pole
                      jest używane tylko jako fallback.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        id="object_photo_url"
                        type="url"
                        value={meta.object_photo_url || ''}
                        onChange={(e) =>
                          handleField('object_photo_url', e.target.value || null)
                        }
                        placeholder="https://…"
                        className="flex-1 min-w-[200px]"
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Upload size={14} className="mr-1" />
                        {isUploading ? 'Wgrywanie…' : 'Wybierz z dysku'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handlePhotoRemove}
                        className="text-danger hover:bg-danger-50 hover:text-danger-800"
                        title="Usuń fotografię legacy"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                    {meta.object_photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={meta.object_photo_url}
                        alt="Fotografia legacy"
                        className="rounded-md border border-graphite-200 max-h-32 object-cover"
                      />
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sekcja 1b: Dane techniczne obiektu (pola turbiny używane w PIIB) */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">Dane techniczne obiektu</CardTitle>
            {turbinePhotos.turbineId && (
              <Link
                href={`/turbiny/${turbinePhotos.turbineId}`}
                className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-800 hover:underline"
                target="_blank"
              >
                <ExternalLink size={12} />
                Otwórz kartę turbiny
              </Link>
            )}
          </div>
          <p className="text-sm text-graphite-500 font-normal">
            Edycja zapisuje się bezpośrednio do karty turbiny — zmiany
            zobaczysz przy kolejnych inspekcjach tej samej turbiny.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="tower_construction_type" className="font-medium">
                Rodzaj konstrukcji wieży
              </Label>
              <Select
                value={turbinePiib.tower_construction_type ?? '__none__'}
                onValueChange={(v) =>
                  handleTurbineField(
                    'tower_construction_type',
                    v === '__none__'
                      ? null
                      : (v as NonNullable<TurbinePiibFields['tower_construction_type']>)
                  )
                }
                disabled={!turbinePhotos.turbineId}
              >
                <SelectTrigger id="tower_construction_type">
                  <SelectValue placeholder="— wybierz —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nie określono —</SelectItem>
                  {Object.entries(TOWER_CONSTRUCTION_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="commissioning_year" className="font-medium">
                Rok zakończenia budowy
              </Label>
              <Input
                id="commissioning_year"
                type="number"
                min={1980}
                max={2099}
                value={turbinePiib.commissioning_year ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (!v) {
                    handleTurbineField('commissioning_year', null)
                    return
                  }
                  const n = parseInt(v, 10)
                  handleTurbineField(
                    'commissioning_year',
                    Number.isFinite(n) ? n : null
                  )
                }}
                placeholder="np. 2018"
                disabled={!turbinePhotos.turbineId}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="building_permit_number" className="font-medium">
                Nr pozwolenia na budowę
              </Label>
              <Input
                id="building_permit_number"
                value={turbinePiib.building_permit_number || ''}
                onChange={(e) =>
                  handleTurbineField(
                    'building_permit_number',
                    e.target.value || null
                  )
                }
                placeholder="np. 123/2017"
                disabled={!turbinePhotos.turbineId}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="building_permit_date" className="font-medium">
                Data pozwolenia na budowę
              </Label>
              <Input
                id="building_permit_date"
                type="date"
                value={turbinePiib.building_permit_date || ''}
                onChange={(e) =>
                  handleTurbineField('building_permit_date', e.target.value || null)
                }
                disabled={!turbinePhotos.turbineId}
              />
            </div>
          </div>
          {turbineSaving && (
            <p className="text-xs text-graphite-400 text-right">
              Zapisywanie do karty turbiny…
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sekcja 2: Strony protokołu */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">Strony protokołu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="owner_name" className="font-medium">
                Właściciel obiektu
              </Label>
              <Input
                id="owner_name"
                value={meta.owner_name || ''}
                onChange={(e) => handleField('owner_name', e.target.value || null)}
                placeholder="imię i nazwisko / nazwa właściciela"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="manager_name" className="font-medium">
                Zarządca obiektu
              </Label>
              {/* Select z bazy klienta + przycisk dodawania nowego rekordu.
                  Wybór z dropdownu wpisuje sformatowaną wartość do `manager_name`
                  (legacy TEXT) — dzięki temu generator PDF/DOCX nie wymaga zmian. */}
              <div className="flex gap-2">
                <Select
                  value={(() => {
                    if (!meta.manager_name) return '__none__'
                    const matched = allReps.find(
                      (r) =>
                        r.full_name === meta.manager_name ||
                        formatRepDisplay(r) === meta.manager_name
                    )
                    return matched?.id ?? '__custom__'
                  })()}
                  onValueChange={(v) => {
                    if (v === '__none__') {
                      handleField('manager_name', null)
                    } else if (v === '__custom__') {
                      // No-op — zostawiamy stary tekst, użytkownik edytuje w polu poniżej.
                    } else {
                      const rep = allReps.find((r) => r.id === v)
                      if (rep) handleField('manager_name', formatRepDisplay(rep))
                    }
                  }}
                  disabled={!clientId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="— wybierz z bazy klienta —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— brak —</SelectItem>
                    {allReps.length > 0 && (
                      <>
                        {allReps.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {formatRepDisplay(r)}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {/* Pseudo-opcja widoczna tylko jeśli aktualny manager_name
                        nie pasuje do żadnego rekordu w bazie (legacy / własny wpis). */}
                    {meta.manager_name &&
                      !allReps.some(
                        (r) =>
                          r.full_name === meta.manager_name ||
                          formatRepDisplay(r) === meta.manager_name
                      ) && (
                        <SelectItem value="__custom__">
                          {meta.manager_name} (własny wpis)
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => openRepDialog('manager')}
                  disabled={!clientId}
                  title={
                    clientId
                      ? 'Dodaj nowego zarządcę do bazy klienta'
                      : 'Brak klienta — przypisz turbinę do farmy/klienta najpierw'
                  }
                >
                  <Plus size={14} />
                </Button>
              </div>
              {/* Stary wolny tekst — zachowany jako edytowalny override */}
              <Input
                id="manager_name"
                value={meta.manager_name || ''}
                onChange={(e) => handleField('manager_name', e.target.value || null)}
                placeholder="lub wpisz ręcznie (zostanie użyte w protokole jak jest)"
                className="text-xs"
              />
              {!clientId && (
                <p className="text-xs text-warning-800">
                  Brak przypisanego klienta — wybór z bazy niedostępny.
                </p>
              )}
            </div>

            {/* ── Wykonawca kontroli — multi-select inspektorów ─────────── */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="font-medium">Wykonawca kontroli</Label>
                <Link
                  href="/inspektorzy"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-800 hover:underline"
                >
                  <ExternalLink size={12} />
                  Dodaj inspektora w bazie
                </Link>
              </div>
              <p className="text-xs text-graphite-500">
                Zaznacz inspektorów wykonujących tę kontrolę. Min. 2 osoby
                (bezpieczeństwo).
                {inspectionType === 'five_year' && (
                  <>
                    {' '}
                    Dla 5-letniej wymagany inspektor budowlany („konstrukcyjna")
                    i elektryczny.
                  </>
                )}
              </p>

              {allInspectors.length === 0 ? (
                <p className="text-xs text-graphite-500">
                  Brak inspektorów w bazie. Dodaj ich na stronie{' '}
                  <Link
                    href="/inspektorzy"
                    target="_blank"
                    className="text-primary-700 hover:underline"
                  >
                    /inspektorzy
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-1 rounded-lg border border-graphite-200 bg-graphite-50/50 p-3 max-h-72 overflow-y-auto">
                  {allInspectors.map((insp) => {
                    const checked = selectedInspectorIds.has(insp.id)
                    return (
                      <label
                        key={insp.id}
                        className="flex items-start gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => void toggleInspector(insp)}
                          className="mt-0.5"
                        />
                        <div className="text-sm leading-tight flex-1 min-w-0">
                          <span className="font-medium text-graphite-900">
                            {insp.full_name}
                          </span>
                          {insp.specialty && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-primary-50 text-primary-700 text-[10px] font-medium px-2 py-0.5 align-middle">
                              {SPECIALTY_LABEL[insp.specialty]}
                            </span>
                          )}
                          {insp.license_number && insp.license_number !== '-' && (
                            <span className="text-graphite-500 font-mono ml-2 text-xs">
                              {insp.license_number}
                            </span>
                          )}
                          {insp.chamber_membership && (
                            <span className="block text-xs text-graphite-500">
                              {insp.chamber_membership}
                            </span>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              {inspectorWarnings.length > 0 && (
                <div className="rounded-md border border-warning-100 bg-warning-50 p-2.5 text-xs text-warning-800 flex gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <ul className="list-disc list-inside space-y-0.5">
                    {inspectorWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Legacy: stary wolny tekst contractor_info — pokazujemy z opcją wyczyszczenia */}
              {meta.contractor_info && meta.contractor_info.trim() && (
                <div className="rounded-md border border-graphite-200 bg-graphite-50 p-2.5 text-xs flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-graphite-700">
                      Stary tekst (legacy):
                    </span>{' '}
                    <span className="text-graphite-600">
                      {meta.contractor_info}
                    </span>
                    <p className="text-[11px] text-graphite-500 mt-0.5">
                      Używany w protokole tylko gdy nikt nie jest zaznaczony powyżej.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-graphite-500 hover:text-danger h-6 px-2"
                    onClick={() => handleField('contractor_info', null)}
                    title="Wyczyść stary tekst"
                  >
                    <X size={12} />
                  </Button>
                </div>
              )}
            </div>

            {/* ── Przy udziale — multi-select przedstawicieli klienta ──── */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="font-medium">Przy udziale</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openRepDialog('participant')}
                  disabled={!clientId}
                  title={
                    clientId
                      ? 'Dodaj nowego przedstawiciela do bazy klienta'
                      : 'Brak klienta — przypisz turbinę do farmy/klienta najpierw'
                  }
                >
                  <Plus size={14} className="mr-1" />
                  Dodaj przedstawiciela
                </Button>
              </div>
              <p className="text-xs text-graphite-500">
                Przedstawiciele właściciela lub zarządcy. Odznacz osoby, które
                nie były obecne podczas tej kontroli — pozostają w bazie klienta
                do następnych inspekcji.
              </p>

              {!clientId ? (
                <p className="text-xs text-warning-800">
                  Brak przypisanego klienta — nie mogę pokazać przedstawicieli.
                </p>
              ) : allReps.length === 0 ? (
                <p className="text-xs text-graphite-500">
                  Brak przedstawicieli w bazie tego klienta. Kliknij „Dodaj
                  przedstawiciela" aby utworzyć pierwszego wpisu.
                </p>
              ) : (
                <div className="space-y-1 rounded-lg border border-graphite-200 bg-graphite-50/50 p-3 max-h-72 overflow-y-auto">
                  {allReps.map((rep) => {
                    const checked = selectedRepIds.has(rep.id)
                    return (
                      <div
                        key={rep.id}
                        className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white group"
                      >
                        <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              void toggleRepresentative(rep.id)
                            }
                            className="mt-0.5"
                          />
                          <div className="text-sm leading-tight flex-1 min-w-0">
                            <span className="font-medium text-graphite-900">
                              {rep.full_name}
                            </span>
                            {rep.role && (
                              <span className="text-graphite-500 ml-2 text-xs">
                                — {rep.role}
                              </span>
                            )}
                            {(rep.phone || rep.email) && (
                              <span className="block text-xs text-graphite-500">
                                {[rep.phone, rep.email].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRep(rep)}
                          className="opacity-0 group-hover:opacity-100 text-graphite-400 hover:text-danger transition-opacity p-1"
                          title="Usuń z bazy klienta"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Legacy: stary wolny tekst additional_participants */}
              {meta.additional_participants &&
                meta.additional_participants.trim() && (
                  <div className="rounded-md border border-graphite-200 bg-graphite-50 p-2.5 text-xs flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-graphite-700">
                        Stary tekst (legacy):
                      </span>{' '}
                      <span className="text-graphite-600">
                        {meta.additional_participants}
                      </span>
                      <p className="text-[11px] text-graphite-500 mt-0.5">
                        Używany w protokole tylko gdy nikt nie jest zaznaczony powyżej.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-graphite-500 hover:text-danger h-6 px-2"
                      onClick={() => handleField('additional_participants', null)}
                      title="Wyczyść stary tekst"
                    >
                      <X size={12} />
                    </Button>
                  </div>
                )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: dodaj nowego przedstawiciela klienta */}
      <Dialog open={repDialogOpen} onOpenChange={setRepDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {repDialogContext === 'manager'
                ? 'Dodaj zarządcę obiektu'
                : 'Dodaj przedstawiciela klienta'}
            </DialogTitle>
            <DialogDescription>
              {repDialogContext === 'manager'
                ? 'Osoba/firma zostanie dodana do bazy klienta i ustawiona jako zarządca obiektu w tej inspekcji. Pojawi się jako propozycja przy kolejnych inspekcjach turbin tego samego klienta.'
                : 'Osoba zostanie dodana do bazy klienta i automatycznie zaznaczona jako uczestnik tej kontroli. Pojawi się jako propozycja przy kolejnych inspekcjach turbin tego samego klienta.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rep_full_name" className="font-medium">
                Imię i nazwisko *
              </Label>
              <Input
                id="rep_full_name"
                value={repForm.full_name}
                onChange={(e) =>
                  setRepForm((prev) => ({ ...prev, full_name: e.target.value }))
                }
                placeholder="np. Jan Kowalski"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep_role" className="font-medium">
                Funkcja / rola
              </Label>
              <Input
                id="rep_role"
                value={repForm.role}
                onChange={(e) =>
                  setRepForm((prev) => ({ ...prev, role: e.target.value }))
                }
                placeholder="np. Przedstawiciel właściciela, Zarządca, Inspektor BHP"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rep_phone" className="font-medium">
                  Telefon
                </Label>
                <Input
                  id="rep_phone"
                  type="tel"
                  value={repForm.phone}
                  onChange={(e) =>
                    setRepForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="+48 …"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep_email" className="font-medium">
                  E-mail
                </Label>
                <Input
                  id="rep_email"
                  type="email"
                  value={repForm.email}
                  onChange={(e) =>
                    setRepForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="…@…"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRepDialogOpen(false)}
              disabled={repSaving}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              onClick={() => void handleAddRep()}
              disabled={repSaving || !repForm.full_name.trim()}
            >
              {repSaving ? 'Zapisywanie…' : 'Dodaj i zaznacz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sekcja 3: Dokumenty przedstawione do wglądu */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">
            Dokumenty przedstawione do wglądu
          </CardTitle>
          <p className="text-sm text-graphite-500 font-normal">
            Status (Okazano / Nie okazano) + informacja o dokumencie
            (auto-uzupełniana z poprzednich inspekcji tej turbiny).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {(
            [
              {
                key: 'previous_annual' as const,
                label: 'Protokół z poprzedniej kontroli rocznej',
                placeholder: 'np. nr 165/T/2025 z 14.05.2025',
              },
              {
                key: 'previous_5y' as const,
                label: 'Protokół z poprzedniej kontroli 5-letniej',
                placeholder: 'np. nr 84/T/2021 z 03.06.2021',
              },
              {
                key: 'electrical_measurements' as const,
                label: 'Protokoły pomiarów elektrycznych i odgromowych',
                placeholder: 'np. nr 165/T/2025 z 14.05.2025',
              },
              {
                key: 'service' as const,
                label: 'Protokoły serwisowe (producent / autoryzowany serwis)',
                placeholder: 'np. nr SVC-2026-12 z 04.05.2026, cykliczność roczna',
              },
            ] as const
          ).map(({ key, label, placeholder }) => {
            const entry = asEntry(docs[key] as DocumentValue)
            return (
              <div key={key} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <div className="md:col-span-5 space-y-1">
                  <Label className="font-medium">{label}</Label>
                  <Select
                    value={entry.status ?? 'none'}
                    onValueChange={(v) =>
                      handleDocEntry(key, {
                        status: v === 'none' ? null : (v as 'okazano' | 'nie_okazano'),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-7 space-y-1">
                  <Label className="text-xs text-graphite-500">
                    Numer protokołu / data / uwagi
                  </Label>
                  <Input
                    value={entry.info || ''}
                    onChange={(e) =>
                      handleDocEntry(key, { info: e.target.value || null })
                    }
                    placeholder={placeholder}
                  />
                </div>
              </div>
            )
          })}

          <div className="space-y-1 pt-2 border-t border-graphite-100">
            <Label htmlFor="doc_other" className="font-medium">
              Inne dokumenty
            </Label>
            <Textarea
              id="doc_other"
              value={(typeof docs.other === 'string' ? docs.other : '') || ''}
              onChange={(e) => handleDocOther(e.target.value)}
              placeholder="Inne dokumenty mające znaczenie dla oceny stanu technicznego…"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sekcja 4: Wprowadzenie do II + KOB */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">
            Sprawdzenie wykonania zaleceń (wprowadzenie)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="general_findings_intro" className="font-medium">
              Tekst wprowadzający do sekcji II
            </Label>
            <Textarea
              id="general_findings_intro"
              value={meta.general_findings_intro || ''}
              onChange={(e) =>
                handleField('general_findings_intro', e.target.value || null)
              }
              placeholder="Opcjonalny tekst wprowadzający przed tabelą realizacji zaleceń…"
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="kob_entries_summary" className="font-medium">
              Wpisy w Książce Obiektu Budowlanego (KOB) za ostatnie{' '}
              {inspectionType === 'five_year' ? '5 lat' : '12 miesięcy'}
            </Label>
            <Textarea
              id="kob_entries_summary"
              value={meta.kob_entries_summary || ''}
              onChange={(e) =>
                handleField('kob_entries_summary', e.target.value || null)
              }
              placeholder="Podsumowanie wpisów w KOB…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {isSaving && (
        <p className="text-xs text-graphite-400 text-right">Zapisywanie…</p>
      )}
    </div>
  )
}
