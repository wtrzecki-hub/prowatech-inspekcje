'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ExternalLink, ImageIcon, Upload, X } from 'lucide-react'
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
  wind_farms: {
    location_gmina: string | null
    location_powiat: string | null
    location_voivodeship: string | null
    clients: { name: string | null } | null
  } | null
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
  previous_annual?: string
  previous_5y?: string
  electrical_measurements?: string
  service?: string
}> {
  const out: Record<string, string> = {}

  // Poprzednia roczna i 5-letnia inspekcja tej turbiny.
  const { data: prevs } = await sb
    .from('inspections')
    .select('id, inspection_date, inspection_type, protocol_number, status')
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
  }
  const prevList = (prevs || []) as PrevRow[]
  const prevAnnual = prevList.find((p) => p.inspection_type === 'annual')
  const prevFiveYear = prevList.find((p) => p.inspection_type === 'five_year')

  if (prevAnnual) {
    const parts: string[] = ['Okazano']
    if (prevAnnual.protocol_number)
      parts.push(`nr ${prevAnnual.protocol_number}`)
    const d = fmtDatePL(prevAnnual.inspection_date)
    if (d) parts.push(`z dnia ${d}`)
    out.previous_annual = parts.join(', ')
  }

  if (prevFiveYear) {
    const parts: string[] = ['Okazano']
    if (prevFiveYear.protocol_number)
      parts.push(`nr ${prevFiveYear.protocol_number}`)
    const d = fmtDatePL(prevFiveYear.inspection_date)
    if (d) parts.push(`z dnia ${d}`)
    out.previous_5y = parts.join(', ')
  }

  // Pomiary elektryczne — najpierw bieżąca inspekcja (jeśli ma podsumowanie
  // pomiarów wpisane), potem poprzednia 5-letnia jako fallback.
  const { data: currentInsp } = await sb
    .from('inspections')
    .select(
      'electrical_measurement_protocol_number, electrical_measurement_date'
    )
    .eq('id', currentInspectionId)
    .maybeSingle()
  const cur = currentInsp as
    | {
        electrical_measurement_protocol_number: string | null
        electrical_measurement_date: string | null
      }
    | null

  let emProto: string | null = null
  let emDate: string | null = null
  if (cur?.electrical_measurement_protocol_number || cur?.electrical_measurement_date) {
    emProto = cur.electrical_measurement_protocol_number ?? null
    emDate = cur.electrical_measurement_date ?? null
  } else if (prevFiveYear) {
    const { data: prevEm } = await sb
      .from('inspections')
      .select(
        'electrical_measurement_protocol_number, electrical_measurement_date'
      )
      .eq('id', prevFiveYear.id)
      .maybeSingle()
    const pem = prevEm as
      | {
          electrical_measurement_protocol_number: string | null
          electrical_measurement_date: string | null
        }
      | null
    emProto = pem?.electrical_measurement_protocol_number ?? null
    emDate = pem?.electrical_measurement_date ?? null
  }

  if (emProto || emDate) {
    const parts: string[] = ['Okazano']
    if (emProto) parts.push(`nr ${emProto}`)
    const d = fmtDatePL(emDate)
    if (d) parts.push(`z dnia ${d}`)
    out.electrical_measurements = parts.join(', ')
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
    const parts: string[] = ['Okazano']
    if (svcRow.last_service_protocol_number)
      parts.push(`nr ${svcRow.last_service_protocol_number}`)
    const d = fmtDatePL(svcRow.last_service_date)
    if (d) parts.push(`z dnia ${d}`)
    if (svcRow.service_company) parts.push(svcRow.service_company)
    out.service = parts.join(', ')
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
             wind_farms (
               location_gmina, location_powiat, location_voivodeship,
               clients ( name )
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
            const proposedInfo = docsAutoFill[key]
            if (!proposedInfo) continue
            const existing = asEntry(currentDocs[key])
            if (existing.info && existing.info.trim()) continue
            mergedDocs[key] = { status: existing.status, info: proposedInfo }
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
              <Input
                id="manager_name"
                value={meta.manager_name || ''}
                onChange={(e) => handleField('manager_name', e.target.value || null)}
                placeholder="imię i nazwisko / nazwa zarządcy"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="contractor_info" className="font-medium">
                Wykonawca kontroli
              </Label>
              <Input
                id="contractor_info"
                value={meta.contractor_info || ''}
                onChange={(e) =>
                  handleField('contractor_info', e.target.value || null)
                }
                placeholder="imię i nazwisko / nr uprawnień / specjalność"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="additional_participants" className="font-medium">
                Przy udziale
              </Label>
              <Input
                id="additional_participants"
                value={meta.additional_participants || ''}
                onChange={(e) =>
                  handleField('additional_participants', e.target.value || null)
                }
                placeholder="przedstawiciel właściciela lub zarządcy"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
