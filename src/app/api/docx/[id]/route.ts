export const runtime = 'nodejs'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  PageNumber,
  ImageRun,
  HeadingLevel,
  PageOrientation,
  LevelFormat,
} from 'docx'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import fs from 'fs'
import path from 'path'
import {
  HEX,
  FONT_DXA,
  TRACKING_DXA,
  RATING_COLORS_HEX,
  RATING_LABELS,
  ART5_MET_COLORS_HEX,
  type RatingKey,
  type Art5MetKey,
} from '@/lib/design/protocol-tokens'
import {
  buildProtocolFilename,
  contentDispositionAttachment,
} from '@/lib/protocol-filename'
import { hasValidLicense } from '@/lib/inspectors/license'
import { formatExtraCertsSuffix } from '@/lib/inspectors/format-certs'
import { buildOwnerLine } from '@/lib/protocol-formatters'

// =============================================================================
// PROTOKÓŁ KONTROLI OKRESOWEJ — DOCX (układ PIIB)
//
// Wzór wg Załącznika do uchwały nr PIIB/KR/0051/2024 KR PIIB z 04.12.2024 r.
// dostosowany do specyfiki turbin wiatrowych.
//
// Struktura: Nagłówek firmowy → Tytuł PIIB → Metryczka obiektu → Podstawowe
// dane techniczne → [Skład komisji 5-letni] → Dokumenty do wglądu →
// Kryteria oceny → I. Zakres kontroli → II. Sprawdzenie wykonania zaleceń →
// III. Ustalenia (jedna tabela PIIB) → [IV. Pomiary elektryczne 5-letni] →
// V. Serwis techniczny → IV/VI. Zalecenia (Zakres / Termin) →
// [VI. Wymagania art. 5 PB 5-letni] → VII. Dokumentacja graficzna →
// VIII. Podpisy + Załączniki.
// =============================================================================

// A4 dimensions in DXA
const PAGE_WIDTH = 11906
const PAGE_HEIGHT = 16838
const MARGIN = 850 // 15mm
const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN // 10206

// ─── BORDER HELPERS ────────────────────────────────────────────────────────
const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: HEX.graphite200 },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: HEX.graphite200 },
  left: { style: BorderStyle.SINGLE, size: 1, color: HEX.graphite200 },
  right: { style: BorderStyle.SINGLE, size: 1, color: HEX.graphite200 },
}

// ─── CELL FACTORIES ────────────────────────────────────────────────────────
function boldCell(text: string, widthDxa: number, shaded = false): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: thinBorder,
    shading: shaded
      ? { type: ShadingType.CLEAR, color: 'auto', fill: HEX.graphite100 }
      : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            font: 'Arial',
            size: FONT_DXA.body,
            color: HEX.graphite900,
          }),
        ],
      }),
    ],
  })
}

function dataCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: thinBorder,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '—',
            font: 'Arial',
            size: FONT_DXA.body,
            color: HEX.graphite900,
          }),
        ],
      }),
    ],
  })
}

function multilineCell(
  lines: string[],
  widthDxa: number,
  opts: { bold?: boolean; small?: boolean; color?: string; fill?: string } = {}
): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: thinBorder,
    shading: opts.fill
      ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill }
      : undefined,
    children: lines.map(
      (line) =>
        new Paragraph({
          spacing: { before: 0, after: 30 },
          children: [
            new TextRun({
              text: line,
              bold: opts.bold,
              font: 'Arial',
              size: opts.small ? FONT_DXA.small : FONT_DXA.tableBody,
              color: opts.color ?? HEX.graphite900,
            }),
          ],
        })
    ),
  })
}

function headerCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: thinBorder,
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: HEX.graphite800 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: true,
            font: 'Arial',
            size: FONT_DXA.tableHeader,
            color: HEX.white,
            characterSpacing: TRACKING_DXA,
          }),
        ],
      }),
    ],
  })
}

// ─── SECTION HEADING (PIIB style) ───────────────────────────────────────────
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: HEX.graphite800 },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: 'Arial',
        size: FONT_DXA.sectionHeading,
        color: HEX.graphite900,
        characterSpacing: TRACKING_DXA,
      }),
    ],
  })
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        font: 'Arial',
        size: 22,
        color: HEX.graphite800,
      }),
    ],
  })
}

function bodyParagraph(text: string, opts: { italic?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: FONT_DXA.body,
        italics: opts.italic,
        color: HEX.graphite900,
      }),
    ],
  })
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd.MM.yyyy', { locale: pl })
  } catch {
    return date
  }
}

function ratingLabel(r: string | null | undefined): string {
  if (!r) return '—'
  return RATING_LABELS[r as RatingKey] || r
}

/**
 * Pobierz obraz z URL (np. Supabase Storage public URL) i zwróć
 * { buffer, format } gotowe do `ImageRun`.
 *
 * Zwraca null jeśli nie udało się pobrać. Generator DOCX nie powinien się
 * wywalić gdy zdjęcie jest niedostępne.
 */
async function fetchImageAsBuffer(
  url: string | null | undefined
): Promise<{ buffer: Buffer; format: 'png' | 'jpg' | 'webp' } | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    let format: 'png' | 'jpg' | 'webp' = 'jpg'
    if (contentType.includes('png')) format = 'png'
    else if (contentType.includes('webp')) format = 'webp'
    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer, format }
  } catch (err) {
    console.error('Nie udało się pobrać obrazu (DOCX):', url, err)
    return null
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      'https://lhxhsprqoecepojrxepf.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(
            cookiesToSet: {
              name: string
              value: string
              options: Parameters<typeof cookieStore.set>[2]
            }[]
          ) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const inspectionId = params.id

    // ─── AUTH ─────────────────────────────────────────────────────────────
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) return new Response('Forbidden', { status: 403 })

    if (profile.role === 'client_user') {
      const { data: clientUser } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .single()

      if (!clientUser) return new Response('Forbidden', { status: 403 })

      const { data: inspCheck } = await supabase
        .from('inspections')
        .select('id, turbines!inner(wind_farms!inner(client_id))')
        .eq('id', inspectionId)
        .single()

      const farmClientId = (
        inspCheck?.turbines as unknown as { wind_farms: { client_id: string } } | null
      )?.wind_farms?.client_id

      if (farmClientId !== clientUser.client_id) {
        return new Response('Forbidden', { status: 403 })
      }
    }

    // ─── FETCH INSPECTION + RELATIONS ─────────────────────────────────────
    const { data: inspection, error: inspectionError } = await supabase
      .from('inspections')
      .select(
        `
        id,
        protocol_number,
        inspection_date,
        inspection_type,
        status,
        overall_condition_rating,
        overall_assessment,
        hazard_information,
        next_annual_date,
        next_five_year_date,
        next_electrical_date,
        previous_annual_date,
        previous_five_year_date,
        inspector_signature_location,
        inspector_signature_date,
        owner_representative_name,
        owner_signature_date,
        owner_signature_location,
        committee_members,
        notes,
        object_address,
        object_registry_number,
        object_name,
        object_photo_url,
        owner_name,
        manager_name,
        contractor_info,
        additional_participants,
        documents_reviewed,
        general_findings_intro,
        kob_entries_summary,
        electrical_measurement_date,
        electrical_next_measurement_date,
        electrical_measurement_protocol_number,
        electrical_measurement_verdict,
        electrical_measurement_verdict_notes,
        electrical_measurement_final_assessment,
        electrical_measurement_notes,
        electrical_visual_inspection_result,
        electrical_visual_inspection_notes,
        lightning_visual_inspection_result,
        lightning_visual_inspection_notes,
        electrical_measurement_protocol_url,
        environmental_protection_findings,
        documentation_verification_findings,
        weather_exposure_methods,
        turbines (
          id,
          turbine_code,
          ew_designation,
          model,
          manufacturer,
          rated_power_mw,
          serial_number,
          location_address,
          tower_height_m,
          hub_height_m,
          rotor_diameter_m,
          building_permit_number,
          building_permit_date,
          commissioning_year,
          tower_construction_type,
          tower_segments_count,
          foundation_diameter_m,
          foundation_depth_m,
          pedestal_height_m,
          service_crane_capacity_t,
          has_as_built_documentation,
          has_building_log_book,
          photo_url,
          photo_url_2,
          photo_url_3,
          wind_farms (
            id,
            name,
            location_address,
            clients (
              id,
              name,
              nip,
              address
            )
          )
        )
      `
      )
      .eq('id', inspectionId)
      .single()

    if (inspectionError || !inspection) {
      return new Response('Inspekcja nie znaleziona', { status: 404 })
    }

    const insp = inspection as any
    const turbine = insp.turbines
    const windFarm = turbine?.wind_farms
    const client = windFarm?.clients
    const isFiveYear = insp.inspection_type === 'five_year'

    // ─── FETCH ELEMENTS ────────────────────────────────────────────────────
    const { data: elementsData } = await supabase
      .from('inspection_elements')
      .select(
        `
        id,
        condition_rating,
        notes,
        recommendations,
        photo_numbers,
        recommendation_completion_date,
        usage_suitability,
        is_not_applicable,
        element_definition:element_definition_id (
          id,
          element_number,
          name_pl,
          scope_annual,
          scope_five_year_additional,
          applicable_standards,
          sort_order
        )
      `
      )
      .eq('inspection_id', inspectionId)

    const elements = (elementsData || []).sort((a: any, b: any) => {
      const aNum = a.element_definition?.element_number ?? 999
      const bNum = b.element_definition?.element_number ?? 999
      return aNum - bNum
    })

    // ─── FETCH INSPECTORS ──────────────────────────────────────────────────
    const { data: inspectorRels } = await supabase
      .from('inspection_inspectors')
      .select(
        `
        is_lead,
        specialty,
        inspector:inspector_id (
          id,
          full_name,
          license_number,
          specialty,
          chamber_membership,
          chamber_certificate_number,
          sep_certificate_number,
          gwo_certificate_number,
          udt_certificate_number
        )
      `
      )
      .eq('inspection_id', inspectionId)

    const inspectors =
      (inspectorRels || []).map((item: any) => ({
        ...item.inspector,
        is_lead: item.is_lead,
        rel_specialty: item.specialty,
      }))

    // Podział: inspektorzy z uprawnieniami budowlanymi (PIIB, `license_number`)
    // podpisują protokół; pozostali (np. uprawnienia tylko SEP/GWO) figurują
    // w protokole jako inspektorzy branżowi bez podpisu. Uwaga Waldka
    // 2026-05-12: typowy zespół to "PIIB + branżowy", co najmniej jeden
    // sygnariusz wymagany przez prawo budowlane.
    // Kolejność branż w metryczce „Wykonawca kontroli" (Waldek 2026-05-13):
    // konstrukcyjna PIIB zawsze pierwsza — kierownik komisji, sygnariusz.
    const SPECIALTY_ORDER: Record<string, number> = {
      konstrukcyjna: 0,
      elektryczna: 1,
      sanitarna: 2,
      inna: 3,
    }
    const inspectorSortKey = (i: any) =>
      SPECIALTY_ORDER[i.rel_specialty || i.specialty || ''] ?? 99

    const signingInspectors = inspectors
      .filter((i: any) => hasValidLicense(i.license_number))
      .sort((a: any, b: any) => inspectorSortKey(a) - inspectorSortKey(b))
    const assistingInspectors = inspectors
      .filter((i: any) => !hasValidLicense(i.license_number))
      .sort((a: any, b: any) => inspectorSortKey(a) - inspectorSortKey(b))

    // ─── FETCH PARTICIPANTS (Przy udziale — przedstawiciele klienta) ──────
    // Fallback do legacy `additional_participants` gdy brak rekordów.
    const { data: participantRels } = await supabase
      .from('inspection_participants')
      .select(
        `
        representative:representative_id (
          id,
          full_name,
          role
        )
      `
      )
      .eq('inspection_id', inspectionId)

    const participants = (participantRels || [])
      .map((item: any) => item.representative)
      .filter(Boolean) as Array<{
      id: string
      full_name: string
      role: string | null
    }>

    // ─── FETCH PIIB TABLES ─────────────────────────────────────────────────
    // Urzadzenia UDT i sprzet ewakuacyjny przypisany do turbiny (audyt 5L pkt 6)
    const turbineId = (insp.turbines as any)?.id as string | undefined
    const { data: udtDevices } = turbineId
      ? await supabase
          .from('turbine_udt_devices')
          .select(
            'device_type, manufacturer, model, capacity_t, is_udt_subject, inspection_frequency, certificate_number, last_inspection_date, next_inspection_date, notes, sort_order, data_status'
          )
          .eq('turbine_id', turbineId)
          .eq('is_deleted', false)
          .neq('data_status', 'nieaktualne')
          .order('sort_order', { ascending: true })
      : { data: null }
    const { data: rescueEquipment } = turbineId
      ? await supabase
          .from('turbine_rescue_equipment')
          .select(
            'equipment_type, manufacturer, model, inspection_frequency, last_inspection_date, next_inspection_date, description, notes, sort_order, data_status'
          )
          .eq('turbine_id', turbineId)
          .eq('is_deleted', false)
          .neq('data_status', 'nieaktualne')
          .order('sort_order', { ascending: true })
      : { data: null }

    const { data: prevRecs } = await supabase
      .from('previous_recommendations')
      .select(
        'item_number, recommendation_text, completion_status, remarks, source_inspection_type'
      )
      .eq('inspection_id', inspectionId)
      .order('item_number')

    const { data: emergencyItems } = await supabase
      .from('emergency_state_items')
      .select('item_number, element_name, urgent_repair_scope')
      .eq('inspection_id', inspectionId)
      .order('item_number')

    let { data: repairScope } = await supabase
      .from('repair_scope_items')
      .select(
        'id, item_number, scope_description, element_name, work_kind, urgency_level, deadline_text, deadline_date, is_completed, completion_date'
      )
      .eq('inspection_id', inspectionId)
      .order('item_number')

    // Fallback: gdy `repair_scope_items` puste, składamy zakres robót z legacy
    // `repair_recommendations` (stary formularz) + `inspection_elements.recommendations`
    // (pole „Zalecenia" w kartach elementów). Inaczej protokół wychodziłby
    // pusty mimo że dane są w innych miejscach.
    if (!repairScope || repairScope.length === 0) {
      const fallback: Array<{
        item_number: number
        scope_description: string
        element_name: string | null
        work_kind: string | null
        urgency_level: string | null
        deadline_text: string | null
        deadline_date: string | null
        is_completed: boolean
        completion_date: string | null
      }> = []
      const seen = new Set<string>()
      let nextNo = 1

      const { data: legacyRepairs } = await supabase
        .from('repair_recommendations')
        .select('scope_description, element_name')
        .eq('inspection_id', inspectionId)
      for (const r of (legacyRepairs || []) as Array<{
        scope_description: string | null
        element_name: string | null
      }>) {
        const desc = r.scope_description?.trim()
        if (!desc) continue
        if (seen.has(desc)) continue
        seen.add(desc)
        fallback.push({
          item_number: nextNo++,
          scope_description: desc,
          element_name: r.element_name?.trim() || null,
          work_kind: null,
          urgency_level: null,
          deadline_text: null,
          deadline_date: null,
          is_completed: false,
          completion_date: null,
        })
      }

      const { data: elementsRecs } = await supabase
        .from('inspection_elements')
        .select(
          `recommendations,
           definition:element_definition_id ( element_number, name_pl )`
        )
        .eq('inspection_id', inspectionId)
      for (const row of (elementsRecs || []) as unknown as Array<{
        recommendations: string | null
        definition: { element_number: number | null; name_pl: string | null } | null
      }>) {
        const rec = row.recommendations?.trim()
        if (!rec) continue
        const num = row.definition?.element_number
        const namePl = row.definition?.name_pl
        const elemLabel =
          num != null && namePl ? `${num}. ${namePl}` : namePl ?? null
        for (const line of rec
          .split(/\r?\n+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)) {
          if (seen.has(line)) continue
          seen.add(line)
          fallback.push({
            item_number: nextNo++,
            scope_description: line,
            element_name: elemLabel,
            work_kind: null,
            urgency_level: null,
            deadline_text: null,
            deadline_date: null,
            is_completed: false,
            completion_date: null,
          })
        }
      }

      if (fallback.length > 0) {
        repairScope = fallback
      }
    }

    const { data: art5Items } = await supabase
      .from('basic_requirements_art5')
      .select('requirement_code, requirement_label, is_met, remarks')
      .eq('inspection_id', inspectionId)

    const { data: attachments } = await supabase
      .from('inspection_attachments')
      .select('item_number, description, file_url')
      .eq('inspection_id', inspectionId)
      .order('item_number')

    const { data: emProtocols } = await supabase
      .from('electrical_measurement_protocols')
      .select(
        'item_number, protocol_name, protocol_number, measurement_date, measured_by'
      )
      .eq('inspection_id', inspectionId)
      .order('item_number')

    const { data: electricalMeasurements } = await supabase
      .from('electrical_measurements')
      .select('*')
      .eq('inspection_id', inspectionId)

    const { data: measurementDevicesRaw } = await supabase
      .from('inspection_measurement_devices')
      .select(
        'measurement_devices ( model, serial_number, manufacturer )'
      )
      .eq('inspection_id', inspectionId)
    const measurementDevices: {
      model: string
      serial_number: string
      manufacturer: string | null
    }[] = (measurementDevicesRaw || [])
      .map((row: { measurement_devices: unknown }) => {
        const dev = Array.isArray(row.measurement_devices)
          ? row.measurement_devices[0]
          : row.measurement_devices
        return dev as
          | { model: string; serial_number: string; manufacturer: string | null }
          | null
      })
      .filter((d): d is {
        model: string
        serial_number: string
        manufacturer: string | null
      } => !!d)

    const { data: measurementPerformersRaw } = await supabase
      .from('inspection_measurement_performers')
      .select(
        'inspectors ( full_name, license_number, chamber_membership )'
      )
      .eq('inspection_id', inspectionId)
    const measurementPerformers: {
      full_name: string
      license_number: string | null
      chamber_membership: string | null
    }[] = (measurementPerformersRaw || [])
      .map((row: { inspectors: unknown }) => {
        const p = Array.isArray(row.inspectors) ? row.inspectors[0] : row.inspectors
        return p as
          | {
              full_name: string
              license_number: string | null
              chamber_membership: string | null
            }
          | null
      })
      .filter((p): p is {
        full_name: string
        license_number: string | null
        chamber_membership: string | null
      } => !!p)

    const { data: serviceInfoData } = await supabase
      .from('service_info')
      .select('*')
      .eq('inspection_id', inspectionId)
      .maybeSingle()

    const { data: serviceChecklistData } = serviceInfoData
      ? await supabase
          .from('service_checklist')
          .select('item_name_pl, is_checked, notes')
          .eq('service_info_id', serviceInfoData.id)
          .order('sort_order')
      : { data: null }

    // Documents reviewed (JSONB)
    // Dokumenty przedstawione do wglądu — od 2026-05 wpisy strukturalne
     // (`{ status: 'okazano'|'nie_okazano'|null, info: string }`); dla starych
     // inspekcji zachowujemy backward compat ze stringiem.
    const rawDocs =
      (insp.documents_reviewed as Record<
        string,
        | string
        | { status?: 'okazano' | 'nie_okazano' | null; info?: string | null }
      > | null) || {}
    const docFmt = (
      key:
        | 'previous_annual'
        | 'previous_5y'
        | 'electrical_measurements'
        | 'service',
    ): string => {
      const v = rawDocs[key]
      if (!v) return ''
      if (typeof v === 'string') return v
      const status = v.status
      const info = v.info?.trim() || ''
      const statusLabel =
        status === 'okazano'
          ? 'Okazano'
          : status === 'nie_okazano'
            ? 'Nie okazano'
            : ''
      if (statusLabel && info) return `${statusLabel} — ${info}`
      return statusLabel || info
    }
    const docs: Record<string, string> = {
      previous_annual: docFmt('previous_annual'),
      previous_5y: docFmt('previous_5y'),
      electrical_measurements: docFmt('electrical_measurements'),
      service: docFmt('service'),
      other: typeof rawDocs.other === 'string' ? rawDocs.other : '',
    }

    // ─── METADATA ──────────────────────────────────────────────────────────
    // Brak protocol_number (status=draft) → "Szkic" w nagłówku zamiast UUID 8-char.
    // Etykieta spójna z listą inspekcji (STATUS_LABELS.draft) i nazwą pliku.
    const protocolNumber = insp.protocol_number || 'Szkic'
    const inspectionDate = formatDate(insp.inspection_date)
    const artPoint = isFiveYear ? '2' : '1'

    const titleSubLines = isFiveYear
      ? [
          'sprawdzenie stanu technicznego i przydatności do użytkowania obiektu budowlanego (turbiny wiatrowej)',
          'sprawdzenie estetyki obiektu budowlanego oraz jego otoczenia',
          'badanie instalacji elektrycznej i piorunochronnej oraz środków ochrony od porażeń',
        ]
      : [
          'sprawdzenie stanu technicznego elementów obiektu budowlanego (turbiny wiatrowej)',
          'sprawdzenie stanu technicznego instalacji i urządzeń służących ochronie środowiska',
          'sprawdzenie zaleceń z poprzednich kontroli oraz wpisów do KOB',
        ]

    const branzaLabel = isFiveYear
      ? 'BRANŻA KONSTRUKCYJNO-BUDOWLANA + ELEKTROENERGETYCZNA'
      : 'BRANŻA KONSTRUKCYJNO-BUDOWLANA / ELEKTROENERGETYCZNA'

    const periodLabel = isFiveYear
      ? 'KONTROLA OKRESOWA — CO NAJMNIEJ RAZ NA 5 LAT'
      : 'KONTROLA OKRESOWA — CO NAJMNIEJ RAZ W ROKU'

    // ─── COMPANY HEADER ────────────────────────────────────────────────────
    let logoBuffer: Buffer | null = null
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo-prowatech.png')
      logoBuffer = fs.readFileSync(logoPath)
    } catch {
      logoBuffer = null
    }

    const logoCol = (USABLE_WIDTH * 3500) / 10206
    const infoCol = USABLE_WIDTH - logoCol

    const logoCell = new TableCell({
      width: { size: logoCol, type: WidthType.DXA },
      borders: noBorder,
      children: logoBuffer
        ? [
            new Paragraph({
              children: [
                new ImageRun({
                  type: 'png',
                  data: logoBuffer,
                  transformation: { width: 120, height: 60 },
                  altText: {
                    title: 'ProWaTech Logo',
                    description: 'Logo firmy ProWaTech',
                    name: 'logo-prowatech',
                  },
                }),
              ],
            }),
          ]
        : [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'ProWaTech',
                  bold: true,
                  font: 'Arial',
                  size: 32,
                  color: HEX.brand600,
                }),
              ],
            }),
          ],
    })

    const companyInfoCell = new TableCell({
      width: { size: infoCol, type: WidthType.DXA },
      borders: noBorder,
      children: [
        'PROWATECH SPÓŁKA Z O.O.',
        'Posada ul. Reymonta 23',
        '62-530 Kazimierz Biskupi',
        'NIP: 6653045169',
        'Email: wtrzecki@prowatech.pl',
      ].map(
        (line, i) =>
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 0, after: 20 },
            children: [
              new TextRun({
                text: line,
                bold: i === 0,
                font: 'Arial',
                size: i === 0 ? 20 : 18,
              }),
            ],
          })
      ),
    })

    const headerTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideHorizontal: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
      },
      rows: [new TableRow({ children: [logoCell, companyInfoCell] })],
    })

    const separator = new Paragraph({
      spacing: { before: 120, after: 120 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 16, color: HEX.brand500 },
      },
      children: [],
    })

    // ─── PIIB INFO BAR ──────────────────────────────────────────────────────
    const piibInfo = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({
          text: 'Wzór wg układu Załącznika do uchwały nr PIIB/KR/0051/2024 KR PIIB z 04.12.2024 r.',
          italics: true,
          font: 'Arial',
          size: FONT_DXA.small,
          color: HEX.graphite500,
        }),
      ],
    })

    // ─── TITLE BLOCK ────────────────────────────────────────────────────────
    const titleParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({
            text: `PROTOKÓŁ NR ${protocolNumber}`,
            bold: true,
            font: 'Arial',
            size: 32,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: `z dnia ${inspectionDate}`,
            bold: true,
            font: 'Arial',
            size: 28,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({
            text: 'z okresowej kontroli obiektu budowlanego obejmującej:',
            font: 'Arial',
            size: 22,
          }),
        ],
      }),
      ...titleSubLines.map(
        (line) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: '• ' + line,
                font: 'Arial',
                size: 20,
              }),
            ],
          })
      ),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 40 },
        children: [
          new TextRun({
            text: branzaLabel,
            bold: true,
            font: 'Arial',
            size: 22,
            color: HEX.graphite800,
            characterSpacing: TRACKING_DXA,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
        children: [
          new TextRun({
            text: periodLabel,
            bold: true,
            font: 'Arial',
            size: 22,
            color: HEX.brand700,
            characterSpacing: TRACKING_DXA,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({
            text: 'PODSTAWA PRAWNA',
            bold: true,
            font: 'Arial',
            size: 20,
            color: HEX.graphite700,
            characterSpacing: TRACKING_DXA,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: `art. 62 ust. 1 pkt ${artPoint} ustawy z dnia 7 lipca 1994 r. — Prawo budowlane (t.j. Dz. U. z 2024 r. poz. 725 z późn. zm.)`,
            font: 'Arial',
            size: 18,
          }),
        ],
      }),
    ]

    if (isFiveYear) {
      titleParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 240 },
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: HEX.brand500 },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: HEX.brand500 },
            left: { style: BorderStyle.SINGLE, size: 4, color: HEX.brand500 },
            right: { style: BorderStyle.SINGLE, size: 4, color: HEX.brand500 },
          },
          children: [
            new TextRun({
              text:
                'UWAGA: Kontrola pięcioletnia obejmuje pełny zakres kontroli rocznej (art. 62 ust. 1 pkt 1 PB) ' +
                'oraz zakres rozszerzony wynikający z art. 62 ust. 1 pkt 2 PB.',
              bold: true,
              font: 'Arial',
              size: 18,
              color: HEX.graphite800,
            }),
          ],
        })
      )
    }

    // ─── METRYCZKA OBIEKTU ─────────────────────────────────────────────────
    const col1 = Math.floor(USABLE_WIDTH * 0.35)
    const col2 = USABLE_WIDTH - col1

    function metaRow(label: string, value: string): TableRow {
      return new TableRow({
        children: [boldCell(label, col1, true), dataCell(value, col2)],
      })
    }

    // Embed 3 zdjęć referencyjnych turbiny — pobranych z turbines.photo_url/_2/_3
    // (zdjęcia uzupełniane w karcie turbiny → tożsame z poprzednimi protokołami).
    // Layout 1+2: portret 227×340 px po lewej, 2 pejzaże 227×162 px w pionie po prawej.
    // Fallback: jeśli brak zdjęć z turbiny, próbujemy legacy `inspections.object_photo_url`.
    const [turbinePhoto1, turbinePhoto2, turbinePhoto3] = await Promise.all([
      fetchImageAsBuffer(turbine?.photo_url),
      fetchImageAsBuffer(turbine?.photo_url_2),
      fetchImageAsBuffer(turbine?.photo_url_3),
    ])
    const hasAnyTurbinePhoto = !!(turbinePhoto1 || turbinePhoto2 || turbinePhoto3)
    const legacyPhoto = !hasAnyTurbinePhoto
      ? await fetchImageAsBuffer(insp.object_photo_url)
      : null

    const objectPhotoBlocks: (Paragraph | Table)[] = []

    // Helper: pojedynczy paragraf z obrazkiem (lub pusty jeśli brak)
    const photoParagraph = (
      photo: { buffer: Buffer; format: 'png' | 'jpg' | 'webp' } | null,
      width: number,
      height: number,
      altName: string
    ): Paragraph => {
      if (!photo) {
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: '—',
              color: HEX.graphite500,
              font: 'Arial',
              size: FONT_DXA.small,
            }),
          ],
        })
      }
      // docx ImageRun akceptuje 'jpg' | 'png' | 'gif' | 'bmp' | 'svg' — webp
      // mapujemy na 'jpg' dla typu (buffer i tak idzie raw, biblioteka radzi sobie
      // z większością formatów rastrowych). Ten sam pattern jest w fallbacku poniżej.
      const imageType: 'jpg' | 'png' = photo.format === 'png' ? 'png' : 'jpg'
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: imageType,
            data: photo.buffer,
            transformation: { width, height },
            altText: {
              title: altName,
              description: altName,
              name: altName,
            },
          }),
        ],
      })
    }

    if (hasAnyTurbinePhoto) {
      try {
        const noBorder = {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        }
        // Tabela 1×2: portret w col 1, 2 pejzaże stack w col 2
        const photoTable = new Table({
          width: { size: USABLE_WIDTH, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: Math.floor(USABLE_WIDTH / 2), type: WidthType.DXA },
                  borders: noBorder,
                  children: [
                    photoParagraph(turbinePhoto1, 227, 340, 'turbine-photo-1'),
                  ],
                }),
                new TableCell({
                  width: { size: Math.floor(USABLE_WIDTH / 2), type: WidthType.DXA },
                  borders: noBorder,
                  children: [
                    photoParagraph(turbinePhoto2, 227, 162, 'turbine-photo-2'),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 80, after: 0 },
                      children: [new TextRun({ text: '' })],
                    }),
                    photoParagraph(turbinePhoto3, 227, 162, 'turbine-photo-3'),
                  ],
                }),
              ],
            }),
          ],
        })
        objectPhotoBlocks.push(photoTable)
        objectPhotoBlocks.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 120 },
            children: [
              new TextRun({
                text: 'Fotografie obiektu',
                italics: true,
                font: 'Arial',
                size: FONT_DXA.small,
                color: HEX.graphite500,
              }),
            ],
          })
        )
      } catch (err) {
        console.error('Nie udało się osadzić zdjęć turbiny w DOCX:', err)
      }
    } else if (legacyPhoto) {
      // Fallback dla starych inspekcji z wgranym pojedynczym object_photo_url
      try {
        const legacyImageType: 'jpg' | 'png' =
          legacyPhoto.format === 'png' ? 'png' : 'jpg'
        objectPhotoBlocks.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 60 },
            children: [
              new ImageRun({
                type: legacyImageType,
                data: legacyPhoto.buffer,
                transformation: { width: 240, height: 180 },
                altText: {
                  title: 'Fotografia obiektu',
                  description: 'Fotografia ogólna turbiny wiatrowej',
                  name: 'object-photo',
                },
              }),
            ],
          })
        )
        objectPhotoBlocks.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({
                text: 'Fotografia obiektu',
                italics: true,
                font: 'Arial',
                size: FONT_DXA.small,
                color: HEX.graphite500,
              }),
            ],
          })
        )
      } catch (err) {
        console.error('Nie udało się osadzić obrazu legacy w DOCX:', err)
      }
    }

    const metaTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
        // Krok 6: oznaczenie EW (np. "EW 1") z karty turbiny — wyświetlane
        // tylko gdy ustawione, żeby nie generować pustego wiersza w protokole.
        ...(turbine?.ew_designation
          ? [metaRow('Oznaczenie turbiny:', turbine.ew_designation as string)]
          : []),
        metaRow('Adres obiektu budowlanego:', insp.object_address || ''),
        metaRow('Numer ewidencyjny obiektu:', insp.object_registry_number || ''),
        metaRow(
          'Nazwa obiektu / funkcja:',
          insp.object_name || 'Elektrownia wiatrowa — turbina wiatrowa'
        ),
        metaRow('Data bieżącej kontroli:', inspectionDate),
        metaRow(
          'Data kolejnej kontroli:',
          formatDate(
            isFiveYear ? insp.next_five_year_date : insp.next_annual_date
          )
        ),
        metaRow('Właściciel obiektu:', buildOwnerLine(insp.owner_name, client)),
        metaRow('Zarządca obiektu budowlanego:', insp.manager_name || ''),
        metaRow(
          'Wykonawca KONTROLI:',
          // Priorytet: inspektorzy z uprawnieniami budowlanymi PIIB
          // (`license_number`) jako sygnariusze; fallback do legacy
          // `contractor_info` tylko dla starych inspekcji bez powiązanych
          // inspektorów. Inspektorzy branżowi (SEP/GWO) bez uprawnień
          // budowlanych są wymienieni w osobnym wierszu poniżej.
          // Uwagi Artura/Waldka 2026-05-12.
          (signingInspectors.length > 0
            ? signingInspectors
                .map(
                  (i: any) =>
                    `${i.full_name || ''}${i.license_number ? ' / ' + i.license_number : ''}${i.specialty ? ' / ' + i.specialty : ''}${formatExtraCertsSuffix(i)}`
                )
                .join('; ')
            : insp.contractor_info) || ''
        ),
        // Inspektor branżowy — uczestnik kontroli z uprawnieniami branżowymi
        // (GWO, SEP, UDT) ale bez uprawnień budowlanych PIIB. Nie podpisuje
        // protokołu. Renderowany tylko gdy taki istnieje.
        ...(assistingInspectors.length > 0
          ? [
              metaRow(
                'Inspektor branżowy:',
                assistingInspectors
                  .map(
                    (i: any) => `${i.full_name || ''}${formatExtraCertsSuffix(i)}`
                  )
                  .join('; '),
              ),
            ]
          : []),
        metaRow(
          'Przy udziale:',
          participants.length > 0
            ? participants
                .map((p) =>
                  p.role ? `${p.full_name} (${p.role})` : p.full_name
                )
                .join('; ')
            : insp.additional_participants || ''
        ),
      ],
    })

    // ─── PODSTAWOWE DANE OBIEKTU ───────────────────────────────────────────
    // Wiersze techniczne. Wymiary turbiny (wysokość wieży, hub, średnica rotora)
    // są celowo pominięte — nie wchodzą do protokołu kontroli.
    // Puste pola turbiny pomijamy całkowicie — nie chcemy wyświetlać "—" dla
    // niewypełnionych w karcie turbiny danych w wygenerowanym protokole.
    const techRowsData = [
      {
        label: 'Rodzaj konstrukcji wieży',
        value: turbine?.tower_construction_type || '',
      },
      {
        label: 'Producent / model turbiny',
        value:
          [turbine?.manufacturer, turbine?.model].filter(Boolean).join(' ') ||
          '',
      },
      {
        label: 'Moc znamionowa [MW]',
        value: turbine?.rated_power_mw ? `${turbine.rated_power_mw}` : '',
      },
      { label: 'Nr seryjny turbiny', value: turbine?.serial_number || '' },
      {
        label: 'Rok zakończenia budowy',
        value: turbine?.commissioning_year
          ? `${turbine.commissioning_year}`
          : '',
      },
      {
        label: 'Nr i data pozwolenia na budowę',
        value:
          [
            turbine?.building_permit_number,
            turbine?.building_permit_date
              ? formatDate(turbine.building_permit_date)
              : null,
          ]
            .filter(Boolean)
            .join(' z dnia ') || '',
      },
      { label: 'Farma wiatrowa', value: windFarm?.name || '' },
      {
        label: 'Adres farmy / dz. ewid.',
        value: windFarm?.location_address || turbine?.location_address || '',
      },
    ].filter((r) => r.value && r.value.trim())
    const techTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: techRowsData.map((r) => metaRow(r.label, r.value)),
    })

    // ─── SKŁAD KOMISJI (5-letni) ───────────────────────────────────────────
    const committeeRows: TableRow[] = []
    if (isFiveYear) {
      committeeRows.push(
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Branża', Math.floor(USABLE_WIDTH * 0.25)),
            headerCell(
              'Imię i nazwisko / Nr uprawnień',
              Math.floor(USABLE_WIDTH * 0.4)
            ),
            headerCell(
              'Przynależność do izby / kontakt',
              USABLE_WIDTH -
                Math.floor(USABLE_WIDTH * 0.25) -
                Math.floor(USABLE_WIDTH * 0.4)
            ),
          ],
        })
      )

      // Skład komisji = tylko sygnariusze (uprawnienia budowlane PIIB);
      // branżowi (SEP/GWO) nie są członkami komisji, są wymienieni w
      // metryczce jako "Inspektor branżowy".
      const konstrInsp = signingInspectors.find(
        (i: any) =>
          i.rel_specialty === 'konstrukcyjna' ||
          i.specialty === 'konstrukcyjna'
      )
      const elektrInsp = signingInspectors.find(
        (i: any) =>
          i.rel_specialty === 'elektryczna' || i.specialty === 'elektryczna'
      )

      function inspRow(label: string, insp: any): TableRow {
        return new TableRow({
          children: [
            dataCell(label, Math.floor(USABLE_WIDTH * 0.25)),
            dataCell(
              insp
                ? `${insp.full_name || ''}${insp.license_number ? ' / ' + insp.license_number : ''}`
                : '',
              Math.floor(USABLE_WIDTH * 0.4)
            ),
            dataCell(
              insp
                ? [insp.chamber_membership, insp.chamber_certificate_number]
                    .filter(Boolean)
                    .join(' / ')
                : '',
              USABLE_WIDTH -
                Math.floor(USABLE_WIDTH * 0.25) -
                Math.floor(USABLE_WIDTH * 0.4)
            ),
          ],
        })
      }

      committeeRows.push(inspRow('Konstrukcyjno-budowlana', konstrInsp))
      committeeRows.push(inspRow('Elektryczna', elektrInsp))
    }

    const committeeTable =
      committeeRows.length > 0
        ? new Table({
            width: { size: USABLE_WIDTH, type: WidthType.DXA },
            rows: committeeRows,
          })
        : null

    // ─── DOKUMENTY DO WGLĄDU ───────────────────────────────────────────────
    const docsTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
        metaRow(
          'Protokół z poprzedniej kontroli rocznej:',
          docs.previous_annual ||
            formatDate(insp.previous_annual_date)
        ),
        metaRow(
          'Protokół z poprzedniej kontroli pięcioletniej:',
          docs.previous_5y || formatDate(insp.previous_five_year_date)
        ),
        metaRow(
          'Protokoły pomiarów elektrycznych i instalacji odgromowej:',
          docs.electrical_measurements || ''
        ),
        metaRow(
          'Protokoły serwisowe:',
          docs.service ||
            (serviceInfoData?.service_company
              ? `${serviceInfoData.service_company}`
              : '')
        ),
        metaRow(
          'Inne dokumenty:',
          docs.other || ''
        ),
      ],
    })

    // ─── KRYTERIA OCEN (4 stopnie PIIB) ────────────────────────────────────
    const criteriaTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: (
        [
          ['dobry', RATING_COLORS_HEX.dobry.bg, RATING_COLORS_HEX.dobry.text],
          [
            'dostateczny',
            RATING_COLORS_HEX.dostateczny.bg,
            RATING_COLORS_HEX.dostateczny.text,
          ],
          [
            'niedostateczny',
            RATING_COLORS_HEX.niedostateczny.bg,
            RATING_COLORS_HEX.niedostateczny.text,
          ],
          [
            'awaryjny',
            RATING_COLORS_HEX.awaryjny.bg,
            RATING_COLORS_HEX.awaryjny.text,
          ],
        ] as const
      ).map(([key, bg, text]) => {
        const desc = {
          dobry:
            'element nie zagraża bezpieczeństwu życia i mienia przez okres najbliższych pięciu lat, pod warunkiem wykonywania prac konserwacyjnych',
          dostateczny:
            'element przed upływem pięciu lat może ulec technicznemu zużyciu; określono termin kolejnego przeglądu / opinii / robót',
          niedostateczny:
            'konieczne jest podjęcie czynności remontowych i zabezpieczeniowych, a określenie „awaryjny" byłoby nieodpowiednie',
          awaryjny:
            'wymaga natychmiastowego podjęcia czynności remontowych i zabezpieczających',
        }[key]
        return new TableRow({
          children: [
            new TableCell({
              width: { size: col1, type: WidthType.DXA },
              borders: thinBorder,
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: bg },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: ratingLabel(key),
                      bold: true,
                      font: 'Arial',
                      size: FONT_DXA.body,
                      color: text,
                    }),
                  ],
                }),
              ],
            }),
            dataCell(desc, col2),
          ],
        })
      }),
    })

    // ─── I. ZAKRES KONTROLI ─────────────────────────────────────────────────
    const zakresList = isFiveYear
      ? [
          'Sprawdzenie wykonania zaleceń z poprzedniej kontroli (rocznej, pięcioletniej i elektrycznej);',
          'Przegląd elementów obiektu budowlanego (turbiny wiatrowej) narażonych na szkodliwe wpływy atmosferyczne i niszczące działania czynników eksploatacyjnych;',
          'Sprawdzenie stanu technicznego i przydatności do użytkowania obiektu budowlanego;',
          'Sprawdzenie estetyki obiektu budowlanego oraz jego otoczenia;',
          'Badanie instalacji elektrycznej i piorunochronnej w zakresie stanu sprawności połączeń, osprzętu, zabezpieczeń i środków ochrony od porażeń, oporności izolacji przewodów i uziemień;',
          'Sprawdzenie stanu technicznego instalacji i urządzeń służących ochronie środowiska;',
          'Weryfikacja kompletności i aktualności dokumentów (KOB, protokoły serwisowe i pomiarowe, certyfikaty UDT).',
        ]
      : [
          'Sprawdzenie wykonania zaleceń z poprzedniej kontroli;',
          'Przegląd elementów obiektu budowlanego (turbiny wiatrowej) narażonych na szkodliwe wpływy atmosferyczne i niszczące działania czynników występujących podczas użytkowania;',
          'Oględziny elementów obiektu (fundamentu, wieży, gondoli, wirnika, łopat, podestów, instalacji);',
          'Przegląd stanu technicznego instalacji i urządzeń służących ochronie środowiska (instalacja odgromowa, oświetlenie nawigacyjne);',
          'Weryfikacja aktualności i kompletności dokumentów (KOB, protokoły serwisowe, protokoły pomiarów, certyfikaty UDT).',
        ]

    const zakresParagraphs = zakresList.map(
      (item, i) =>
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { left: 360 },
          children: [
            new TextRun({
              text: `${i + 1}) ${item}`,
              font: 'Arial',
              size: FONT_DXA.body,
            }),
          ],
        })
    )

    // ─── II. SPRAWDZENIE WYKONANIA ZALECEŃ ──────────────────────────────────
    const prevRecsCols = [
      Math.floor(USABLE_WIDTH * 0.06),
      Math.floor(USABLE_WIDTH * 0.4),
      Math.floor(USABLE_WIDTH * 0.2),
      USABLE_WIDTH -
        Math.floor(USABLE_WIDTH * 0.06) -
        Math.floor(USABLE_WIDTH * 0.4) -
        Math.floor(USABLE_WIDTH * 0.2),
    ]
    const completionLabel: Record<string, string> = {
      tak: 'tak',
      nie: 'nie',
      w_trakcie: 'w trakcie',
    }
    type PrevRec = {
      item_number: number
      recommendation_text: string | null
      completion_status: string | null
      remarks: string | null
      source_inspection_type: 'annual' | 'five_year' | null
    }
    const prevRecsAll = (prevRecs || []) as PrevRec[]
    const prevRecsBySource = {
      five_year: prevRecsAll.filter((r) => r.source_inspection_type === 'five_year'),
      annual: prevRecsAll.filter((r) => r.source_inspection_type === 'annual'),
      unsourced: prevRecsAll.filter((r) => !r.source_inspection_type),
    }
    const buildPrevRecsTable = (rows: PrevRec[], placeholderWhenEmpty: boolean) => {
      const dataRows: PrevRec[] =
        rows.length > 0
          ? rows
          : placeholderWhenEmpty
          ? [1, 2, 3, 4].map((n) => ({
              item_number: n,
              recommendation_text: '',
              completion_status: null,
              remarks: '',
              source_inspection_type: null,
            }))
          : []
      const tableRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Lp.', prevRecsCols[0]),
            headerCell('Zalecenia z poprzedniej kontroli', prevRecsCols[1]),
            headerCell('Stopień wykonania', prevRecsCols[2]),
            headerCell('Realizacja zaleceń — uwagi', prevRecsCols[3]),
          ],
        }),
        ...dataRows.map(
          (r) =>
            new TableRow({
              children: [
                dataCell(String(r.item_number), prevRecsCols[0]),
                dataCell(r.recommendation_text || '', prevRecsCols[1]),
                dataCell(
                  r.completion_status
                    ? completionLabel[r.completion_status] || r.completion_status
                    : '',
                  prevRecsCols[2]
                ),
                dataCell(r.remarks || '', prevRecsCols[3]),
              ],
            })
        ),
      ]
      return new Table({
        width: { size: USABLE_WIDTH, type: WidthType.DXA },
        rows: tableRows,
      })
    }
    // Nr + data poprzednich protokołów: bierzemy z documents_reviewed (info wpisuje
    // inspektor w metryczce, sekcja "Dokumenty obiektu okazane do wglądu").
    const prev5ySource = docs.previous_5y?.replace(/^Okazano[\s,—-]*/i, '').trim()
    const prevAnnualSource = docs.previous_annual?.replace(/^Okazano[\s,—-]*/i, '').trim()
    const headingWithSource = (label: string, source: string | undefined) =>
      source ? `${label} (${source})` : label
    const prevRecsBlocks: Array<Paragraph | Table> = []
    if (isFiveYear) {
      // Wyjątek: pierwsza kontrola 5-letnia (brak poprzedniej tego typu) —
      // odniesienie wyłącznie do kontroli rocznej, sekcja 5y pomijana.
      const isFirstFiveYear =
        !prev5ySource && prevRecsBySource.five_year.length === 0
      if (isFirstFiveYear) {
        prevRecsBlocks.push(
          subHeading(
            'Ocena realizacji zaleceń z poprzedniej kontroli 5-letniej'
          ),
          bodyParagraph(
            'Pierwsza kontrola pięcioletnia — brak poprzedniej kontroli tego typu, odniesienie wyłącznie do poprzedniej kontroli rocznej.',
            { italic: true }
          )
        )
      } else {
        prevRecsBlocks.push(
          subHeading(
            headingWithSource(
              'Ocena realizacji zaleceń z poprzedniej kontroli 5-letniej',
              prev5ySource
            )
          ),
          buildPrevRecsTable(prevRecsBySource.five_year, true)
        )
      }
      prevRecsBlocks.push(
        subHeading(
          headingWithSource(
            'Ocena realizacji zaleceń z poprzedniej kontroli rocznej',
            prevAnnualSource
          )
        ),
        buildPrevRecsTable(prevRecsBySource.annual, true)
      )
      if (prevRecsBySource.unsourced.length > 0) {
        prevRecsBlocks.push(
          subHeading('Inne zalecenia (bez przypisanego źródła)'),
          buildPrevRecsTable(prevRecsBySource.unsourced, false)
        )
      }
    } else {
      // Wyjątek: pierwsza kontrola roczna (nowa turbina, brak poprzedniej) —
      // sekcja pomijana, zostaje notka.
      const isFirstAnnual =
        !prevAnnualSource &&
        prevRecsBySource.annual.length === 0 &&
        prevRecsAll.length === 0
      if (isFirstAnnual) {
        prevRecsBlocks.push(
          subHeading('Ocena realizacji zaleceń z poprzedniej kontroli'),
          bodyParagraph(
            'Pierwsza kontrola roczna obiektu — brak poprzedniej kontroli, brak zaleceń do sprawdzenia.',
            { italic: true }
          )
        )
      } else {
        const annualRows =
          prevRecsBySource.annual.length > 0
            ? prevRecsBySource.annual
            : prevRecsAll
        prevRecsBlocks.push(
          subHeading(
            headingWithSource(
              'Ocena realizacji zaleceń z poprzedniej kontroli',
              prevAnnualSource
            )
          ),
          buildPrevRecsTable(annualRows, true)
        )
      }
    }

    // Stan awaryjny — render tabeli tylko gdy są wpisy
    const hasEmergency = !!(emergencyItems && emergencyItems.length > 0)
    const emergencyCols = [
      Math.floor(USABLE_WIDTH * 0.06),
      Math.floor(USABLE_WIDTH * 0.34),
      USABLE_WIDTH - Math.floor(USABLE_WIDTH * 0.06) - Math.floor(USABLE_WIDTH * 0.34),
    ]
    const emergencyTable = hasEmergency
      ? new Table({
          width: { size: USABLE_WIDTH, type: WidthType.DXA },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Lp.', emergencyCols[0]),
                headerCell('Element obiektu', emergencyCols[1]),
                headerCell(
                  'Zakres pilnego remontu, naprawy lub robót zabezpieczających',
                  emergencyCols[2]
                ),
              ],
            }),
            ...emergencyItems!.map(
              (e: any) =>
                new TableRow({
                  children: [
                    dataCell(String(e.item_number), emergencyCols[0]),
                    dataCell(e.element_name || '', emergencyCols[1]),
                    dataCell(e.urgent_repair_scope || '', emergencyCols[2]),
                  ],
                })
            ),
          ],
        })
      : null

    // ─── III. USTALENIA — JEDNA TABELA PIIB ─────────────────────────────────
    // Roczny: ELEMENT / OPIS / OCENA / ZALECENIA / NR FOT. / DATA WYK.
    // 5-letni: ELEMENT / ZAKRES ROCZNY / ZAKRES 5-LETNI / OCENA + PRZYDATNOŚĆ / ZALECENIA / NR FOT. / DATA
    const ustaleniaRows: TableRow[] = []

    if (isFiveYear) {
      const colsFY = [
        Math.floor(USABLE_WIDTH * 0.18), // Element
        Math.floor(USABLE_WIDTH * 0.18), // Zakres roczny
        Math.floor(USABLE_WIDTH * 0.18), // Zakres 5-letni
        Math.floor(USABLE_WIDTH * 0.13), // Ocena + Przydatność
        Math.floor(USABLE_WIDTH * 0.18), // Zalecenia
        Math.floor(USABLE_WIDTH * 0.07), // Nr fot.
        USABLE_WIDTH -
          Math.floor(USABLE_WIDTH * 0.18) * 3 -
          Math.floor(USABLE_WIDTH * 0.13) -
          Math.floor(USABLE_WIDTH * 0.07), // Data
      ]
      ustaleniaRows.push(
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('ELEMENT / MATERIAŁ', colsFY[0]),
            headerCell('ZAKRES ROCZNY', colsFY[1]),
            headerCell('ZAKRES DODATKOWY 5-LETNI', colsFY[2]),
            headerCell('OCENA + PRZYDATNOŚĆ', colsFY[3]),
            headerCell('ZALECENIA / UWAGI', colsFY[4]),
            headerCell('NR FOT.', colsFY[5]),
            headerCell('DATA WYK.', colsFY[6]),
          ],
        })
      )

      for (const el of elements as any[]) {
        const def = el.element_definition
        if (!def || el.is_not_applicable) continue
        const rating = el.condition_rating as RatingKey | null
        const colors = rating ? RATING_COLORS_HEX[rating] : null
        const fill = colors?.bg
        const textColor = colors?.text || HEX.graphite900
        const stripe = colors?.stripe || HEX.graphite200

        const ratingText = ratingLabel(rating)
        const usability = el.usage_suitability
          ? el.usage_suitability === 'spelnia'
            ? 'spełnia'
            : 'nie spełnia'
          : '—'

        ustaleniaRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: colsFY[0], type: WidthType.DXA },
                borders: {
                  ...thinBorder,
                  left: { style: BorderStyle.SINGLE, size: 18, color: stripe },
                },
                shading: fill
                  ? { type: ShadingType.CLEAR, color: 'auto', fill }
                  : undefined,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${def.element_number}. ${def.name_pl}`,
                        bold: true,
                        font: 'Arial',
                        size: FONT_DXA.tableBody,
                        color: textColor,
                      }),
                    ],
                  }),
                  ...(def.applicable_standards
                    ? [
                        new Paragraph({
                          spacing: { before: 60 },
                          children: [
                            new TextRun({
                              text: def.applicable_standards,
                              font: 'Arial',
                              size: FONT_DXA.small,
                              color: HEX.graphite500,
                            }),
                          ],
                        }),
                      ]
                    : []),
                ],
              }),
              multilineCell(
                (def.scope_annual || '').split('\n').filter(Boolean).slice(0, 12),
                colsFY[1],
                { fill, color: textColor }
              ),
              multilineCell(
                (def.scope_five_year_additional || '')
                  .split('\n')
                  .filter(Boolean)
                  .slice(0, 12),
                colsFY[2],
                { fill: HEX.brand50, color: HEX.graphite900 }
              ),
              new TableCell({
                width: { size: colsFY[3], type: WidthType.DXA },
                borders: thinBorder,
                shading: fill
                  ? { type: ShadingType.CLEAR, color: 'auto', fill }
                  : undefined,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: ratingText,
                        bold: true,
                        font: 'Arial',
                        size: FONT_DXA.tableBody,
                        color: textColor,
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60 },
                    children: [
                      new TextRun({
                        text: `Przydatność: ${usability}`,
                        font: 'Arial',
                        size: FONT_DXA.small,
                        color: textColor,
                      }),
                    ],
                  }),
                ],
              }),
              dataCell(
                [el.notes, el.recommendations].filter(Boolean).join(' • ') || '',
                colsFY[4]
              ),
              dataCell(el.photo_numbers || '', colsFY[5]),
              dataCell(formatDate(el.recommendation_completion_date), colsFY[6]),
            ],
          })
        )
      }
    } else {
      const colsAN = [
        Math.floor(USABLE_WIDTH * 0.22), // Element + przepisy
        Math.floor(USABLE_WIDTH * 0.27), // Opis stanu (zakres roczny)
        Math.floor(USABLE_WIDTH * 0.13), // Ocena
        Math.floor(USABLE_WIDTH * 0.22), // Zalecenia
        Math.floor(USABLE_WIDTH * 0.08), // Nr fot.
        USABLE_WIDTH -
          Math.floor(USABLE_WIDTH * 0.22) * 2 -
          Math.floor(USABLE_WIDTH * 0.27) -
          Math.floor(USABLE_WIDTH * 0.13) -
          Math.floor(USABLE_WIDTH * 0.08), // Data
      ]
      ustaleniaRows.push(
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('ELEMENT / MATERIAŁ', colsAN[0]),
            headerCell('OPIS I USTALENIA Z KONTROLI', colsAN[1]),
            headerCell('OCENA', colsAN[2]),
            headerCell('ZALECENIA / UWAGI', colsAN[3]),
            headerCell('NR FOT.', colsAN[4]),
            headerCell('DATA WYK.', colsAN[5]),
          ],
        })
      )

      for (const el of elements as any[]) {
        const def = el.element_definition
        if (!def || el.is_not_applicable) continue
        const rating = el.condition_rating as RatingKey | null
        const colors = rating ? RATING_COLORS_HEX[rating] : null
        const fill = colors?.bg
        const textColor = colors?.text || HEX.graphite900
        const stripe = colors?.stripe || HEX.graphite200

        ustaleniaRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: colsAN[0], type: WidthType.DXA },
                borders: {
                  ...thinBorder,
                  left: { style: BorderStyle.SINGLE, size: 18, color: stripe },
                },
                shading: fill
                  ? { type: ShadingType.CLEAR, color: 'auto', fill }
                  : undefined,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${def.element_number}. ${def.name_pl}`,
                        bold: true,
                        font: 'Arial',
                        size: FONT_DXA.tableBody,
                        color: textColor,
                      }),
                    ],
                  }),
                  ...(def.applicable_standards
                    ? [
                        new Paragraph({
                          spacing: { before: 60 },
                          children: [
                            new TextRun({
                              text: def.applicable_standards,
                              font: 'Arial',
                              size: FONT_DXA.small,
                              color: HEX.graphite500,
                            }),
                          ],
                        }),
                      ]
                    : []),
                ],
              }),
              multilineCell(
                [
                  ...(def.scope_annual || '')
                    .split('\n')
                    .filter(Boolean)
                    .slice(0, 8),
                  ...(el.notes ? ['', '— Opis: ' + el.notes] : []),
                ],
                colsAN[1],
                { fill, color: textColor }
              ),
              new TableCell({
                width: { size: colsAN[2], type: WidthType.DXA },
                borders: thinBorder,
                shading: fill
                  ? { type: ShadingType.CLEAR, color: 'auto', fill }
                  : undefined,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: ratingLabel(rating),
                        bold: true,
                        font: 'Arial',
                        size: FONT_DXA.tableBody,
                        color: textColor,
                      }),
                    ],
                  }),
                ],
              }),
              dataCell(el.recommendations || '', colsAN[3]),
              dataCell(el.photo_numbers || '', colsAN[4]),
              dataCell(formatDate(el.recommendation_completion_date), colsAN[5]),
            ],
          })
        )
      }
    }

    const ustaleniaTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: ustaleniaRows,
    })

    // ─── IV. WYNIKI POMIARÓW ELEKTRYCZNYCH (5-letni) ────────────────────────
    let electricalSection: (Paragraph | Table)[] = []
    if (isFiveYear) {
      const emCols = [
        Math.floor(USABLE_WIDTH * 0.4),
        Math.floor(USABLE_WIDTH * 0.2),
        Math.floor(USABLE_WIDTH * 0.15),
        USABLE_WIDTH -
          Math.floor(USABLE_WIDTH * 0.4) -
          Math.floor(USABLE_WIDTH * 0.2) -
          Math.floor(USABLE_WIDTH * 0.15),
      ]

      electricalSection.push(
        bodyParagraph(
          'Pomiary wykonano zgodnie z art. 62 ust. 1 pkt 2 PB oraz wymaganiami PN-HD 60364 i PN-EN 62305. ' +
            'Wyniki należy potwierdzić podpisem osoby uprawnionej (branża elektryczna).'
        )
      )

      // Podsumowanie pomiarów (Artur uwagi 5L pkt 3 — wariant B). Pojawia się
      // tylko gdy któreś z kluczowych pól jest wypełnione.
      const verdictLabelDocx: Record<string, string> = {
        dopuszcza: 'Dopuszcza do dalszej eksploatacji',
        warunkowo: 'Warunkowo dopuszcza',
        nie_dopuszcza: 'Nie dopuszcza do dalszej eksploatacji',
      }
      const hasSummary =
        insp.electrical_measurement_date ||
        insp.electrical_next_measurement_date ||
        insp.electrical_measurement_protocol_number ||
        insp.electrical_measurement_verdict ||
        insp.electrical_measurement_final_assessment ||
        insp.electrical_measurement_notes ||
        insp.electrical_measurement_protocol_url ||
        insp.electrical_visual_inspection_result ||
        insp.lightning_visual_inspection_result
      if (hasSummary) {
        electricalSection.push(subHeading('Podsumowanie pomiarów'))
        const summaryRows: TableRow[] = []
        if (insp.electrical_measurement_protocol_number) {
          summaryRows.push(
            metaRow(
              'Nr protokołu z pomiaru:',
              insp.electrical_measurement_protocol_number as string
            )
          )
        }
        if (insp.electrical_measurement_date) {
          summaryRows.push(
            metaRow('Data pomiaru:', formatDate(insp.electrical_measurement_date))
          )
        }
        if (insp.electrical_next_measurement_date) {
          summaryRows.push(
            metaRow(
              'Data kolejnego pomiaru:',
              formatDate(insp.electrical_next_measurement_date)
            )
          )
        }
        if (insp.electrical_measurement_verdict) {
          const verdict =
            verdictLabelDocx[insp.electrical_measurement_verdict as string] ||
            (insp.electrical_measurement_verdict as string)
          const withNotes = insp.electrical_measurement_verdict_notes
            ? `${verdict} — ${insp.electrical_measurement_verdict_notes as string}`
            : verdict
          summaryRows.push(metaRow('Orzeczenie:', withNotes))
        }
        if (insp.electrical_measurement_final_assessment) {
          // Format strukturalnych wartości z capitalize; legacy as-is.
          const raw = insp.electrical_measurement_final_assessment as string
          const lower = raw.toLowerCase().trim()
          const formatted =
            lower === 'pozytywna'
              ? 'Pozytywna'
              : lower === 'negatywna'
                ? 'Negatywna'
                : raw
          summaryRows.push(metaRow('Ocena końcowa:', formatted))
        }
        // Oględziny instalacji elektrycznej (audyt 2026-05-07)
        if (insp.electrical_visual_inspection_result) {
          const r = insp.electrical_visual_inspection_result as string
          const label = r === 'pozytywna' ? 'Pozytywna' : 'Negatywna'
          const withNotes =
            r === 'negatywna' && insp.electrical_visual_inspection_notes
              ? `${label} — ${insp.electrical_visual_inspection_notes as string}`
              : label
          summaryRows.push(
            metaRow('Oględziny instalacji elektrycznej:', withNotes)
          )
        }
        // Oględziny instalacji odgromowej i uziomów
        if (insp.lightning_visual_inspection_result) {
          const r = insp.lightning_visual_inspection_result as string
          const label = r === 'pozytywna' ? 'Pozytywna' : 'Negatywna'
          const withNotes =
            r === 'negatywna' && insp.lightning_visual_inspection_notes
              ? `${label} — ${insp.lightning_visual_inspection_notes as string}`
              : label
          summaryRows.push(
            metaRow('Oględziny instalacji odgromowej i uziomów:', withNotes)
          )
        }
        if (insp.electrical_measurement_notes) {
          summaryRows.push(
            metaRow(
              'Uwagi do oględzin i oceny:',
              insp.electrical_measurement_notes as string
            )
          )
        }
        if (summaryRows.length > 0) {
          electricalSection.push(
            new Table({
              width: { size: USABLE_WIDTH, type: WidthType.DXA },
              rows: summaryRows,
            })
          )
        }
        if (insp.electrical_measurement_protocol_url) {
          electricalSection.push(
            bodyParagraph(
              'Pełny protokół pomiarów stanowi załącznik do niniejszej kontroli (PDF).'
            )
          )
        }
      }

      // Identyfikacja użytych przyrządów (Artur uwagi pkt 6).
      if (measurementDevices.length > 0) {
        electricalSection.push(subHeading('Identyfikacja użytych przyrządów'))
        const deviceCols = [4500, 2500, 2400]
        const deviceRows: TableRow[] = [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Model', deviceCols[0]),
              headerCell('Numer seryjny', deviceCols[1]),
              headerCell('Producent', deviceCols[2]),
            ],
          }),
        ]
        for (const d of measurementDevices) {
          deviceRows.push(
            new TableRow({
              children: [
                dataCell(d.model, deviceCols[0]),
                dataCell(d.serial_number, deviceCols[1]),
                dataCell(d.manufacturer || '—', deviceCols[2]),
              ],
            })
          )
        }
        electricalSection.push(
          new Table({
            width: { size: USABLE_WIDTH, type: WidthType.DXA },
            rows: deviceRows,
          })
        )
      }

      // Osoby wykonujące pomiary (Artur uwagi pkt 6 cd).
      if (measurementPerformers.length > 0) {
        electricalSection.push(subHeading('Osoby wykonujące pomiary'))
        const perfCols = [4000, 2700, 2700]
        const perfRows: TableRow[] = [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Imię i nazwisko', perfCols[0]),
              headerCell('Numer uprawnień', perfCols[1]),
              headerCell('Izba', perfCols[2]),
            ],
          }),
        ]
        for (const p of measurementPerformers) {
          const license =
            p.license_number && p.license_number !== '-'
              ? p.license_number
              : '—'
          perfRows.push(
            new TableRow({
              children: [
                dataCell(p.full_name, perfCols[0]),
                dataCell(license, perfCols[1]),
                dataCell(p.chamber_membership || '—', perfCols[2]),
              ],
            })
          )
        }
        electricalSection.push(
          new Table({
            width: { size: USABLE_WIDTH, type: WidthType.DXA },
            rows: perfRows,
          })
        )
      }

      const measurements = electricalMeasurements || []
      if (measurements.length > 0) {
        electricalSection.push(subHeading('A. Pomiary punktów kontrolnych'))
        const emRows: TableRow[] = [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Punkt pomiarowy', emCols[0]),
              headerCell('Wartość', emCols[1]),
              headerCell('Ocena', emCols[2]),
              headerCell('Uwagi', emCols[3]),
            ],
          }),
        ]
        for (const m of measurements as any[]) {
          // Wybierz pierwszą niepustą wartość pomiaru
          const measure =
            m.grounding_resistance_ohm != null
              ? `${m.grounding_resistance_ohm} Ω (uziemienie)`
              : m.insulation_resistance_mohm != null
              ? `${m.insulation_resistance_mohm} MΩ (izolacja)`
              : m.loop_impedance_ohm != null
              ? `${m.loop_impedance_ohm} Ω (pętla)`
              : m.rcd_trip_time_ms != null
              ? `${m.rcd_trip_time_ms} ms (RCD)`
              : m.pe_continuity_ohm != null
              ? `${m.pe_continuity_ohm} Ω (PE)`
              : '—'
          const result =
            m.grounding_result ||
            m.insulation_result ||
            m.loop_impedance_result ||
            m.rcd_result ||
            m.pe_continuity_result ||
            ''
          emRows.push(
            new TableRow({
              children: [
                dataCell(m.measurement_point, emCols[0]),
                dataCell(measure, emCols[1]),
                dataCell(result, emCols[2]),
                dataCell(m.notes || '', emCols[3]),
              ],
            })
          )
        }
        electricalSection.push(
          new Table({
            width: { size: USABLE_WIDTH, type: WidthType.DXA },
            rows: emRows,
          })
        )
      }

      // Wykaz protokołów do KOB
      if (emProtocols && emProtocols.length > 0) {
        electricalSection.push(subHeading('C. Wykaz protokołów pomiarowych do KOB'))
        const protoCols = [
          Math.floor(USABLE_WIDTH * 0.06),
          Math.floor(USABLE_WIDTH * 0.45),
          Math.floor(USABLE_WIDTH * 0.2),
          USABLE_WIDTH -
            Math.floor(USABLE_WIDTH * 0.06) -
            Math.floor(USABLE_WIDTH * 0.45) -
            Math.floor(USABLE_WIDTH * 0.2),
        ]
        const protoRows: TableRow[] = [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Lp.', protoCols[0]),
              headerCell('Rodzaj protokołu', protoCols[1]),
              headerCell('Nr i data', protoCols[2]),
              headerCell('Wykonawca', protoCols[3]),
            ],
          }),
        ]
        for (const p of emProtocols as any[]) {
          protoRows.push(
            new TableRow({
              children: [
                dataCell(String(p.item_number), protoCols[0]),
                dataCell(p.protocol_name, protoCols[1]),
                dataCell(
                  [p.protocol_number, formatDate(p.measurement_date)]
                    .filter(Boolean)
                    .join(' / '),
                  protoCols[2]
                ),
                dataCell(p.measured_by || '', protoCols[3]),
              ],
            })
          )
        }
        electricalSection.push(
          new Table({
            width: { size: USABLE_WIDTH, type: WidthType.DXA },
            rows: protoRows,
          })
        )
      }
    }

    // ─── V. SERWIS TECHNICZNY ──────────────────────────────────────────────
    const serviceTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
        metaRow('Firma serwisowa', serviceInfoData?.service_company || ''),
        metaRow(
          'Nr certyfikatu UDT serwisanta',
          serviceInfoData?.udt_certificate_number || ''
        ),
        metaRow(
          'Data ostatniego przeglądu',
          formatDate(serviceInfoData?.last_service_date)
        ),
        metaRow(
          'Nr protokołu serwisowego',
          serviceInfoData?.last_service_protocol_number || ''
        ),
        metaRow(
          'Data następnego przeglądu',
          formatDate(serviceInfoData?.next_service_date)
        ),
        metaRow(
          'Protokoły serwisowe załączone do KOB?',
          serviceInfoData?.service_protocols_in_kob ? 'Tak' : 'Nie'
        ),
      ],
    })

    const checklistParas: Paragraph[] = (serviceChecklistData || []).map(
      (item: any) =>
        new Paragraph({
          spacing: { before: 30, after: 30 },
          indent: { left: 360 },
          children: [
            new TextRun({
              text: `${item.is_checked ? '☑' : '☐'} ${item.item_name_pl}${
                item.notes ? ' — ' + item.notes : ''
              }`,
              font: 'Arial',
              size: FONT_DXA.body,
              color: item.is_checked ? HEX.brand700 : HEX.graphite900,
            }),
          ],
        })
    )

    // ─── ZALECENIA (kolumny zgodnie z PIIB / WACETOB) ───────────────────────
    // Lp | Element | Zakres robot | Rodzaj (K/NB/NG) | Stopien (I-IV) | Termin
    const repairCols = [
      Math.floor(USABLE_WIDTH * 0.06), // Lp
      Math.floor(USABLE_WIDTH * 0.13), // Element
      Math.floor(USABLE_WIDTH * 0.42), // Zakres
      Math.floor(USABLE_WIDTH * 0.1), // Rodzaj
      Math.floor(USABLE_WIDTH * 0.1), // Pilność
      USABLE_WIDTH -
        Math.floor(USABLE_WIDTH * 0.06) -
        Math.floor(USABLE_WIDTH * 0.13) -
        Math.floor(USABLE_WIDTH * 0.42) -
        Math.floor(USABLE_WIDTH * 0.1) -
        Math.floor(USABLE_WIDTH * 0.1), // Termin
    ]
    const repairRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Lp.', repairCols[0]),
          headerCell('Element / lokalizacja', repairCols[1]),
          headerCell('Zakres robót remontowych', repairCols[2]),
          headerCell('Rodzaj', repairCols[3]),
          headerCell('Pilność', repairCols[4]),
          headerCell('Termin wykonania', repairCols[5]),
        ],
      }),
      ...((repairScope && repairScope.length > 0)
        ? repairScope
        : [1, 2, 3, 4, 5].map((n) => ({
            item_number: n,
            scope_description: '',
            element_name: null,
            work_kind: null,
            urgency_level: null,
            deadline_text: '',
            deadline_date: null,
            is_completed: false,
          }))
      ).map(
        (r: any) =>
          new TableRow({
            children: [
              dataCell(String(r.item_number ?? ''), repairCols[0]),
              dataCell(r.element_name || '', repairCols[1]),
              dataCell(r.scope_description || '', repairCols[2]),
              dataCell(r.work_kind || '', repairCols[3]),
              dataCell(r.urgency_level || '', repairCols[4]),
              dataCell(
                r.deadline_text ||
                  (r.deadline_date ? formatDate(r.deadline_date) : ''),
                repairCols[5]
              ),
            ],
          })
      ),
    ]
    const repairTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: repairRows,
    })

    // ─── 3 TABELE-LEGENDY (PIIB / WACETOB / MSWiA) ─────────────────────────
    const buildLegendTable = (
      headers: string[],
      rows: string[][],
      widths: number[]
    ): Table => {
      const total = widths.reduce((a, b) => a + b, 0)
      const cols = widths.map((w) => Math.floor((USABLE_WIDTH * w) / total))
      // Skoryguj ostatnia kolumne by sumowala sie do USABLE_WIDTH
      const sumWithoutLast = cols.slice(0, -1).reduce((a, b) => a + b, 0)
      cols[cols.length - 1] = USABLE_WIDTH - sumWithoutLast
      const tblRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: headers.map((h, i) => headerCell(h, cols[i])),
        }),
        ...rows.map(
          (r) =>
            new TableRow({
              children: r.map((cell, i) => dataCell(cell, cols[i])),
            })
        ),
      ]
      return new Table({
        width: { size: USABLE_WIDTH, type: WidthType.DXA },
        rows: tblRows,
      })
    }

    const workKindLegendTable = buildLegendTable(
      ['Symbol', 'Rodzaj robót', 'Definicja'],
      [
        [
          'K',
          'Konserwacja',
          'Roboty utrzymujące sprawność techniczną elementów obiektu (czyszczenie, smarowanie, dokręcanie, drobne uzupełnienia).',
        ],
        [
          'NB',
          'Naprawa bieżąca',
          'Okresowy remont elementów obiektu zapobiegający skutkom zużycia, utrzymujący właściwy stan techniczny.',
        ],
        [
          'NG',
          'Naprawa główna',
          'Remont polegający na wymianie co najmniej jednego elementu obiektu.',
        ],
      ],
      [10, 25, 65]
    )

    const urgencyLegendTable = buildLegendTable(
      ['Stopień', 'Zalecany termin', 'Opis'],
      [
        [
          'I',
          'natychmiast',
          'Remont w przypadku uszkodzeń zagrażających bezpieczeństwu użytkowania lub mogących stać się przyczyną zniszczenia/awarii. Wymaga natychmiastowego zabezpieczenia, naprawy głównej, wymiany lub rozbiórki.',
        ],
        [
          'II',
          'do 3 miesięcy',
          'Remont, który może być odłożony na okres do 3 miesięcy lub do okresu zimowego bez szkody dla użytkowników. Okres przesunięcia winien być wykorzystany na opracowanie dokumentacji oraz wybór wykonawcy.',
        ],
        [
          'III',
          'do 12 miesięcy',
          'Remont, który może być odłożony na okres do 1 roku bez specjalnej szkody dla użytkowników obiektu.',
        ],
        [
          'IV',
          'do 5 lat',
          'Remont, który może być odłożony na okres do 5 lat bez specjalnej szkody dla użytkowników obiektu.',
        ],
      ],
      [10, 22, 68]
    )

    const ratingCriteriaLegendTable = buildLegendTable(
      ['Klasa', 'Zużycie [%]', 'Kryterium oceny'],
      [
        [
          'dobry',
          '0–15',
          'Element dobrze utrzymany, bez widocznego zużycia. Cechy materiałów odpowiadają wymogom norm. Ewentualne drobne naprawy konserwacyjne.',
        ],
        [
          'zadowalający',
          '16–30',
          'Element utrzymywany należycie. Celowe wykonanie konserwacji lub napraw bieżących w niewielkim zakresie.',
        ],
        [
          'średni',
          '31–50',
          'Niewielkie uszkodzenia i ubytki, niezagrażające bezpieczeństwu. Wymagana naprawa bieżąca w większym zakresie lub naprawa główna.',
        ],
        [
          'zły',
          '51–70',
          'Znaczne ubytki mogące zagrażać bezpieczeństwu. Materiały utraciły pierwotne właściwości. Wymagany remont kapitalny — wymiana wielu elementów.',
        ],
        [
          'awaryjny',
          '> 71',
          'Tak duże zniszczenia/ubytki, że nie pozwalają na dalsze bezpieczne użytkowanie. Wymagany remont kapitalny w dużym rozmiarze lub rozbiórka.',
        ],
      ],
      [12, 12, 76]
    )

    // ─── VI. WYMAGANIA ART. 5 PB (5-letni) ──────────────────────────────────
    let art5Section: (Paragraph | Table)[] = []
    if (isFiveYear && art5Items && art5Items.length > 0) {
      const art5Cols = [
        Math.floor(USABLE_WIDTH * 0.4),
        Math.floor(USABLE_WIDTH * 0.2),
        USABLE_WIDTH - Math.floor(USABLE_WIDTH * 0.4) - Math.floor(USABLE_WIDTH * 0.2),
      ]
      const metLabel: Record<string, string> = {
        spelnia: 'spełnione',
        nie_spelnia: 'niespełnione',
        nie_dotyczy: 'nie dotyczy',
      }
      const art5Rows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Wymaganie podstawowe (art. 5 PB)', art5Cols[0]),
            headerCell('Ocena', art5Cols[1]),
            headerCell('Komentarz / uzasadnienie', art5Cols[2]),
          ],
        }),
      ]
      const art5MetCell = (
        key: Art5MetKey | null,
        widthDxa: number
      ): TableCell => {
        const colors = key ? ART5_MET_COLORS_HEX[key] : null
        return new TableCell({
          width: { size: widthDxa, type: WidthType.DXA },
          borders: thinBorder,
          shading: colors
            ? { type: ShadingType.CLEAR, color: 'auto', fill: colors.bg }
            : undefined,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: key ? metLabel[key] : '—',
                  font: 'Arial',
                  size: FONT_DXA.body,
                  bold: !!key,
                  color: colors ? colors.text : HEX.graphite900,
                }),
              ],
            }),
          ],
        })
      }
      for (const r of art5Items as any[]) {
        const metKey = (r.is_met as Art5MetKey) || null
        art5Rows.push(
          new TableRow({
            children: [
              dataCell(r.requirement_label, art5Cols[0]),
              art5MetCell(metKey, art5Cols[1]),
              dataCell(r.remarks || '', art5Cols[2]),
            ],
          })
        )
      }
      art5Section.push(
        new Table({
          width: { size: USABLE_WIDTH, type: WidthType.DXA },
          rows: art5Rows,
        })
      )
    }

    // ─── PODPISY ────────────────────────────────────────────────────────────
    const sigColW = Math.floor(USABLE_WIDTH / 2)

    function signatureCell(
      label: string,
      name: string,
      credentials?: { license_number?: string | null; chamber_membership?: string | null }
    ): TableCell {
      const paragraphs: Paragraph[] = [
        new Paragraph({
          // 2800 twipów ≈ 5cm pionowego miejsca przed linią podpisu —
          // wystarczy na pieczątkę inspektora (~4×2.5cm) + odręczny podpis.
          // Uwaga Artura 2026-05-12: poprzednio 800 twipów (~1.4cm) było
          // za mało, pieczątka się nie mieściła.
          spacing: { before: 2800 },
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
          },
          children: [new TextRun({ text: label, font: 'Arial', size: 18 })],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: name,
              font: 'Arial',
              size: 16,
              italics: true,
            }),
          ],
        }),
      ]

      // Uprawnienia budowlane PIIB pod imieniem — uwaga Artura 2026-05-13.
      // Renderujemy `Nr upr.` + izba tylko gdy są dane (sygnariusze mają;
      // branżowi i tak nie składają podpisu pod protokołem PIIB).
      if (credentials?.license_number && hasValidLicense(credentials.license_number)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Nr upr.: ${credentials.license_number}`,
                font: 'Arial',
                size: 14,
              }),
            ],
          })
        )
      }
      if (credentials?.chamber_membership && credentials.chamber_membership.trim()) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: credentials.chamber_membership.trim(),
                font: 'Arial',
                size: 14,
                color: HEX.graphite800,
              }),
            ],
          })
        )
      }

      return new TableCell({
        width: { size: sigColW, type: WidthType.DXA },
        borders: noBorder,
        children: paragraphs,
      })
    }

    const sigRows: TableRow[] = []
    if (isFiveYear) {
      // Podpisują tylko sygnariusze (uprawnienia budowlane PIIB) — branżowi
      // (SEP/GWO bez PIIB) nie składają podpisu pod protokołem PIIB.
      const konstr = signingInspectors.find(
        (i: any) =>
          i.rel_specialty === 'konstrukcyjna' || i.specialty === 'konstrukcyjna'
      )
      const elektr = signingInspectors.find(
        (i: any) =>
          i.rel_specialty === 'elektryczna' || i.specialty === 'elektryczna'
      )
      sigRows.push(
        new TableRow({
          children: [
            signatureCell(
              'Branża KONSTRUKCYJNO-BUDOWLANA',
              konstr?.full_name || '',
              konstr
                ? {
                    license_number: konstr.license_number,
                    chamber_membership: konstr.chamber_membership,
                  }
                : undefined
            ),
            signatureCell(
              'Branża ELEKTRYCZNA',
              elektr?.full_name || '',
              elektr
                ? {
                    license_number: elektr.license_number,
                    chamber_membership: elektr.chamber_membership,
                  }
                : undefined
            ),
          ],
        })
      )
    } else {
      // Roczna: jeden podpis dla wszystkich sygnariuszy. Pokazujemy uprawnienia
      // każdego z osobna pod nazwiskiem; gdy 2+ inspektorów, kolejne idą w
      // następnych liniach dzięki wielokrotnym akapitom.
      const annualSigningInspectors = signingInspectors as Array<{
        full_name: string
        license_number?: string | null
        chamber_membership?: string | null
      }>
      const namesJoined = annualSigningInspectors
        .map((i) => i.full_name)
        .filter(Boolean)
        .join(', ')
      // Jeśli tylko 1 sygnariusz, podajmy jego uprawnienia bezpośrednio.
      // Dla wielu — pomijamy uprawnienia w komórce (brak miejsca), inspektor
      // dopisze ręcznie pod pieczątką (każda pieczątka i tak zawiera numer).
      const lead = annualSigningInspectors.length === 1
        ? annualSigningInspectors[0]
        : null
      sigRows.push(
        new TableRow({
          children: [
            signatureCell(
              'Wykonawca KONTROLI',
              namesJoined,
              lead
                ? {
                    license_number: lead.license_number,
                    chamber_membership: lead.chamber_membership,
                  }
                : undefined
            ),
            signatureCell(
              'Właściciel / Zarządca obiektu',
              insp.owner_representative_name || ''
            ),
          ],
        })
      )
    }

    const signaturesTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
        insideHorizontal: { style: BorderStyle.NONE, size: 0 },
        insideVertical: { style: BorderStyle.NONE, size: 0 },
      },
      rows: sigRows,
    })

    // ─── ZAŁĄCZNIKI ─────────────────────────────────────────────────────────
    // Auto-dorzucamy protokół pomiarów PDF (z `inspections.electrical_measurement_protocol_url`)
    // jako pierwszy / kolejny załącznik, żeby user nie musiał go ręcznie wpisywać.
    const baseAttachments: Array<{ item_number: number; description: string }> =
      (attachments && attachments.length > 0)
        ? (attachments as Array<{ item_number: number; description: string }>).map(
            (a) => ({ item_number: a.item_number, description: a.description || '' })
          )
        : []
    if (insp.electrical_measurement_protocol_url) {
      const protoNo = insp.electrical_measurement_protocol_number
        ? ` nr ${insp.electrical_measurement_protocol_number as string}`
        : ''
      const protoDate = insp.electrical_measurement_date
        ? ` z dnia ${formatDate(insp.electrical_measurement_date)}`
        : ''
      baseAttachments.unshift({
        item_number: 0,
        description: `Protokół pomiarów elektrycznych${protoNo}${protoDate} (PDF)`,
      })
      // Renumeracja po dodaniu na początku.
      baseAttachments.forEach((a, i) => {
        a.item_number = i + 1
      })
    }
    // Brak załączników → pomijamy całą sekcję (sectionChildren.push warunkowo
    // poniżej). Polityka "lepiej puste niż placeholder" zgodnie z PR #19;
    // uwaga Artura 2026-05-12: stary fallback `[1..6]` generował 6 pustych
    // punktów w protokołach bez załączników.
    const attachmentsList = baseAttachments
    const hasAttachments = attachmentsList.length > 0
    const attachCols = [
      Math.floor(USABLE_WIDTH * 0.06),
      USABLE_WIDTH - Math.floor(USABLE_WIDTH * 0.06),
    ]
    const attachRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Lp.', attachCols[0]),
          headerCell('Załącznik do protokołu', attachCols[1]),
        ],
      }),
      ...attachmentsList.map(
        (a) =>
          new TableRow({
            children: [
              dataCell(String(a.item_number), attachCols[0]),
              dataCell(a.description || '', attachCols[1]),
            ],
          })
      ),
    ]
    const attachmentsTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: attachRows,
    })

    // ─── HEADER / FOOTER (pages 2+) ─────────────────────────────────────────
    const docHeader = new Header({
      children: [
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: HEX.graphite200 },
          },
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: `PROTOKÓŁ NR ${protocolNumber} z dnia ${inspectionDate} — ${periodLabel}`,
              font: 'Arial',
              size: FONT_DXA.small,
              color: HEX.graphite500,
            }),
          ],
        }),
      ],
    })

    const docFooter = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: HEX.graphite200 },
          },
          children: [
            new TextRun({
              children: [PageNumber.CURRENT],
              font: 'Arial',
              size: FONT_DXA.small,
              color: HEX.graphite500,
            }),
            new TextRun({
              text: ' | Strona',
              font: 'Arial',
              size: FONT_DXA.small,
              color: HEX.graphite500,
            }),
          ],
        }),
      ],
    })

    // ─── ASSEMBLE DOCUMENT ──────────────────────────────────────────────────
    const sectionChildren: (Paragraph | Table)[] = [
      headerTable,
      separator,
      piibInfo,
      ...titleParagraphs,

      // Metryczka obiektu
      sectionHeading('Metryczka obiektu'),
      ...objectPhotoBlocks,
      metaTable,

      // Podstawowe dane techniczne
      sectionHeading('Podstawowe dane obiektu budowlanego'),
      bodyParagraph(
        'Obiekt budowlany — elektrownia wiatrowa (turbina wiatrowa). Dane techniczne i eksploatacyjne urządzenia:'
      ),
      techTable,
    ]

    if (committeeTable) {
      sectionChildren.push(
        sectionHeading('Skład komisji kontrolującej'),
        bodyParagraph(
          'Niniejszy protokół sporządzono przy udziale osób posiadających uprawnienia w branży konstrukcyjno-budowlanej i elektrycznej (zgodnie z art. 62 ust. 5 PB).'
        ),
        committeeTable
      )
    }

    // ─── OPIS TECHNICZNY OBIEKTU + UDT + EWAKUACJA (audyt 5L pkt 6) ─────────
    const techDescBlocks: Array<Paragraph | Table> = []
    const turbineRow = (insp.turbines as any) ?? null
    const techRows: Array<{ label: string; value: string }> = []
    const fmtNum = (n: number | null | undefined, unit?: string) =>
      n != null && !Number.isNaN(Number(n))
        ? `${n}${unit ? ' ' + unit : ''}`
        : ''
    if (turbineRow?.tower_height_m)
      techRows.push({ label: 'Wysokość wieży', value: fmtNum(turbineRow.tower_height_m, 'm') })
    if (turbineRow?.hub_height_m)
      techRows.push({ label: 'Wysokość osi piasty', value: fmtNum(turbineRow.hub_height_m, 'm') })
    if (turbineRow?.rotor_diameter_m)
      techRows.push({ label: 'Średnica rotora', value: fmtNum(turbineRow.rotor_diameter_m, 'm') })
    if (turbineRow?.tower_segments_count)
      techRows.push({
        label: 'Liczba segmentów wieży',
        value: String(turbineRow.tower_segments_count),
      })
    if (turbineRow?.foundation_diameter_m)
      techRows.push({
        label: 'Średnica fundamentu',
        value: fmtNum(turbineRow.foundation_diameter_m, 'm'),
      })
    if (turbineRow?.foundation_depth_m)
      techRows.push({
        label: 'Głębokość posadowienia',
        value: fmtNum(turbineRow.foundation_depth_m, 'm'),
      })
    if (turbineRow?.pedestal_height_m)
      techRows.push({
        label: 'Wysokość cokołu',
        value: fmtNum(turbineRow.pedestal_height_m, 'm'),
      })
    if (turbineRow?.service_crane_capacity_t)
      techRows.push({
        label: 'Udźwig dźwigu/wciągarki serwisowej',
        value: fmtNum(turbineRow.service_crane_capacity_t, 't'),
      })
    if (techRows.length > 0) {
      const techCol1 = Math.floor(USABLE_WIDTH * 0.4)
      const techCol2 = USABLE_WIDTH - techCol1
      const techTable = new Table({
        width: { size: USABLE_WIDTH, type: WidthType.DXA },
        rows: techRows.map(
          (r) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: techCol1, type: WidthType.DXA },
                  borders: thinBorder,
                  shading: {
                    type: ShadingType.CLEAR,
                    color: 'auto',
                    fill: HEX.graphite50,
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: r.label,
                          font: 'Arial',
                          size: FONT_DXA.body,
                          bold: true,
                          color: HEX.graphite700,
                        }),
                      ],
                    }),
                  ],
                }),
                dataCell(r.value, techCol2),
              ],
            })
        ),
      })
      techDescBlocks.push(sectionHeading('Opis techniczny obiektu'), techTable)
    }

    if (udtDevices && udtDevices.length > 0) {
      const udtCols = [
        Math.floor(USABLE_WIDTH * 0.35),
        Math.floor(USABLE_WIDTH * 0.12),
        Math.floor(USABLE_WIDTH * 0.1),
        USABLE_WIDTH -
          Math.floor(USABLE_WIDTH * 0.35) -
          Math.floor(USABLE_WIDTH * 0.12) -
          Math.floor(USABLE_WIDTH * 0.1),
      ]
      const udtTblRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Urządzenie', udtCols[0]),
            headerCell('Udźwig', udtCols[1]),
            headerCell('UDT', udtCols[2]),
            headerCell('Cykl kontrolny / uwagi', udtCols[3]),
          ],
        }),
        ...(udtDevices as any[]).map(
          (d) =>
            new TableRow({
              children: [
                dataCell(
                  [d.device_type, d.manufacturer, d.model]
                    .filter(Boolean)
                    .join(' / '),
                  udtCols[0]
                ),
                dataCell(d.capacity_t != null ? `${d.capacity_t} t` : '', udtCols[1]),
                dataCell(d.is_udt_subject ? 'Tak' : 'Nie', udtCols[2]),
                dataCell(
                  [
                    d.inspection_frequency,
                    d.certificate_number ? `Nr cert.: ${d.certificate_number}` : null,
                    d.last_inspection_date
                      ? `ost. przegląd: ${formatDate(d.last_inspection_date)}`
                      : null,
                    d.next_inspection_date
                      ? `nast. przegląd: ${formatDate(d.next_inspection_date)}`
                      : null,
                    d.notes,
                  ]
                    .filter(Boolean)
                    .join('; '),
                  udtCols[3]
                ),
              ],
            })
        ),
      ]
      techDescBlocks.push(
        sectionHeading('Urządzenia podlegające pod UDT'),
        new Table({
          width: { size: USABLE_WIDTH, type: WidthType.DXA },
          rows: udtTblRows,
        })
      )
    }

    if (rescueEquipment && rescueEquipment.length > 0) {
      const rsCols = [
        Math.floor(USABLE_WIDTH * 0.3),
        Math.floor(USABLE_WIDTH * 0.4),
        USABLE_WIDTH -
          Math.floor(USABLE_WIDTH * 0.3) -
          Math.floor(USABLE_WIDTH * 0.4),
      ]
      const rsTblRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Sprzęt', rsCols[0]),
            headerCell('Opis', rsCols[1]),
            headerCell('Cykl kontrolny / uwagi', rsCols[2]),
          ],
        }),
        ...(rescueEquipment as any[]).map(
          (r) =>
            new TableRow({
              children: [
                dataCell(
                  [r.equipment_type, r.manufacturer, r.model]
                    .filter(Boolean)
                    .join(' / '),
                  rsCols[0]
                ),
                dataCell(
                  [
                    r.description,
                    r.inspection_frequency
                      ? `Częstotliwość: ${r.inspection_frequency}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join('. '),
                  rsCols[1]
                ),
                dataCell(
                  [
                    r.last_inspection_date
                      ? `ost. przegląd: ${formatDate(r.last_inspection_date)}`
                      : null,
                    r.next_inspection_date
                      ? `nast. przegląd: ${formatDate(r.next_inspection_date)}`
                      : null,
                    r.notes,
                  ]
                    .filter(Boolean)
                    .join('; '),
                  rsCols[2]
                ),
              ],
            })
        ),
      ]
      techDescBlocks.push(
        sectionHeading('Sprzęt ewakuacyjno-ratunkowy'),
        new Table({
          width: { size: USABLE_WIDTH, type: WidthType.DXA },
          rows: rsTblRows,
        })
      )
    }

    sectionChildren.push(
      ...techDescBlocks,
      sectionHeading('Dokumenty przedstawione do wglądu'),
      docsTable,

      sectionHeading('Przyjęte kryteria oceny stanu technicznego'),
      criteriaTable,

      sectionHeading('I. Zakres kontroli'),
      ...zakresParagraphs,

      sectionHeading('II. Sprawdzenie wykonania zaleceń z poprzednich kontroli'),
      ...(insp.general_findings_intro
        ? [bodyParagraph(insp.general_findings_intro)]
        : []),
      ...prevRecsBlocks,
      subHeading('Stan awaryjny stwierdzony w wyniku przeglądu'),
      bodyParagraph(
        hasEmergency
          ? 'W wyniku przeglądu technicznego stwierdzam stan awaryjny następujących elementów obiektu:'
          : 'W wyniku przeglądu technicznego nie stwierdzono stanu awaryjnego.'
      ),
      ...(emergencyTable ? [emergencyTable] : []),

      sectionHeading('III. Ustalenia oraz wnioski po sprawdzeniu stanu technicznego'),
      bodyParagraph('W trakcie kontroli ustalono:'),
      ustaleniaTable
    )

    if (isFiveYear) {
      sectionChildren.push(
        sectionHeading('IV. Wyniki pomiarów elektrycznych (obowiązkowe co 5 lat)'),
        ...electricalSection
      )
    }

    // Tomasz pkt 5 + Waldek 2026-05-08: sekcja V. Serwis renderowana tylko gdy
    // include_in_protocol === true ORAZ wpisano jakiekolwiek dane.
    const hasServiceData = !!(
      serviceInfoData?.service_company ||
      serviceInfoData?.udt_certificate_number ||
      serviceInfoData?.last_service_date ||
      serviceInfoData?.last_service_protocol_number ||
      serviceInfoData?.next_service_date ||
      serviceInfoData?.notes ||
      (serviceChecklistData && serviceChecklistData.length > 0)
    )
    if (serviceInfoData?.include_in_protocol === true && hasServiceData) {
      sectionChildren.push(
        sectionHeading('V. Informacje o serwisie technicznym turbiny'),
        bodyParagraph(
          'Kontrola połączeń śrubowych, docisku segmentów wieży i czynności techniczne są wykonywane ' +
            'przez certyfikowany serwis (art. 8b ustawy z dnia 20 maja 2016 r. o inwestycjach w zakresie elektrowni wiatrowych).'
        ),
        serviceTable,
        ...(checklistParas.length > 0
          ? [subHeading('Zakres czynności serwisowych'), ...checklistParas]
          : [])
      )
    }

    // ─── DOKUMENTACJA FOTOGRAFICZNA ZALECEŃ ─────────────────────────────────
    // Zdjęcia per pozycja zakresu robót (recommendation_photos z
    // parent_type='repair_scope_item'). Wskaźniki kopiowane przez auto-carry
    // z previous_recommendations przy zaznaczeniu "Nie wykonano".
    const recommendationPhotosSection: (Table | Paragraph)[] = []
    if (repairScope && repairScope.length > 0) {
      const scopeIds = (
        repairScope as Array<{ id?: string }>
      )
        .map((r) => r.id)
        .filter((id): id is string => Boolean(id))

      if (scopeIds.length > 0) {
        const { data: recPhotosData } = await supabase
          .from('recommendation_photos')
          .select('parent_id, file_url, caption, sort_order')
          .eq('inspection_id', inspectionId)
          .eq('parent_type', 'repair_scope_item')
          .in('parent_id', scopeIds)
          .order('sort_order', { ascending: true })

        const photosByScopeId = new Map<
          string,
          Array<{ file_url: string; caption: string | null }>
        >()
        for (const p of (recPhotosData || []) as Array<{
          parent_id: string
          file_url: string
          caption: string | null
        }>) {
          if (!photosByScopeId.has(p.parent_id)) {
            photosByScopeId.set(p.parent_id, [])
          }
          photosByScopeId.get(p.parent_id)!.push({
            file_url: p.file_url,
            caption: p.caption,
          })
        }

        const scopesWithPhotos = (
          repairScope as Array<{
            id?: string
            item_number: number
            scope_description: string | null
          }>
        ).filter((r) => r.id && (photosByScopeId.get(r.id)?.length ?? 0) > 0)

        if (scopesWithPhotos.length > 0) {
          recommendationPhotosSection.push(
            subHeading('Dokumentacja fotograficzna zaleceń'),
            bodyParagraph(
              '(stan zaleceń niewykonanych z poprzedniej kontroli, udokumentowany podczas niniejszej kontroli)',
              { italic: true }
            )
          )

          const cellWidth = Math.floor(USABLE_WIDTH / 2)
          for (const scope of scopesWithPhotos) {
            const photos = photosByScopeId.get(scope.id!)!
            const headerText = `Poz. ${scope.item_number}. ${
              (scope.scope_description || '').slice(0, 120)
            }${(scope.scope_description?.length || 0) > 120 ? '…' : ''}`
            recommendationPhotosSection.push(
              bodyParagraph(headerText, { bold: true })
            )

            const photoBuffers = await Promise.all(
              photos.map((p) => fetchImageAsBuffer(p.file_url))
            )

            const photoTableRows: TableRow[] = []
            for (let i = 0; i < photos.length; i += 2) {
              const cells: TableCell[] = []
              for (let j = 0; j < 2; j++) {
                const buf = i + j < photos.length ? photoBuffers[i + j] : null
                if (buf) {
                  const imageType: 'jpg' | 'png' =
                    buf.format === 'png' ? 'png' : 'jpg'
                  cells.push(
                    new TableCell({
                      width: { size: cellWidth, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new ImageRun({
                              type: imageType,
                              data: buf.buffer,
                              transformation: { width: 280, height: 187 },
                              altText: {
                                title: `Zalecenie poz. ${scope.item_number} zdjęcie ${i + j + 1}`,
                                description: photos[i + j].caption ?? '',
                                name: `rec-photo-${scope.id}-${i + j}`,
                              },
                            }),
                          ],
                        }),
                      ],
                    })
                  )
                } else {
                  // Pusta lub brakująca komórka
                  cells.push(
                    new TableCell({
                      width: { size: cellWidth, type: WidthType.DXA },
                      children: [new Paragraph({ children: [] })],
                    })
                  )
                }
              }
              photoTableRows.push(new TableRow({ children: cells }))
            }
            recommendationPhotosSection.push(
              new Table({
                width: { size: USABLE_WIDTH, type: WidthType.DXA },
                rows: photoTableRows,
              })
            )
          }
        }
      }
    }

    sectionChildren.push(
      sectionHeading(
        isFiveYear ? 'VI. Zalecenia' : 'IV. Zalecenia'
      ),
      bodyParagraph('Określenie zakresu robót remontowych i kolejności ich wykonywania:'),
      repairTable,
      ...recommendationPhotosSection,
      subHeading('Definicje rodzajów robót remontowych'),
      workKindLegendTable,
      subHeading('Zalecany czas wykonania robót remontowych — stopień pilności'),
      urgencyLegendTable,
      subHeading('Kryteria oceny i klasyfikacji stanu technicznego'),
      ratingCriteriaLegendTable
    )

    if (insp.overall_assessment) {
      sectionChildren.push(
        subHeading('Ogólna ocena stanu technicznego'),
        bodyParagraph(insp.overall_assessment)
      )
    }
    if (insp.hazard_information) {
      sectionChildren.push(
        subHeading('Informacja o zagrożeniach'),
        bodyParagraph(insp.hazard_information)
      )
    }

    // Pkt 6/7 zakresu kontroli + pkt 8.6 wzorca PIIB (Waldek 2026-05-08).
    const ENV_FALLBACK =
      'W trakcie kontroli dokonano przeglądu instalacji i urządzeń służących ochronie środowiska (instalacja odgromowa, oświetlenie nawigacyjne). Nie stwierdzono uchybień ani odstępstw od wymagań ochrony środowiska.'
    const DOC_FALLBACK =
      'Zweryfikowano kompletność i aktualność dokumentów obiektu: Książka Obiektu Budowlanego (KOB), protokoły serwisowe, protokoły pomiarów elektrycznych, certyfikaty UDT urządzeń podlegających kontroli. Dokumentacja kompletna i aktualna.'
    const WEATHER_FALLBACK = 'Nie dotyczy.'
    sectionChildren.push(
      subHeading('Stan techniczny instalacji ochrony środowiska'),
      bodyParagraph(insp.environmental_protection_findings || ENV_FALLBACK),
      subHeading('Weryfikacja kompletności i aktualności dokumentów'),
      bodyParagraph(insp.documentation_verification_findings || DOC_FALLBACK),
      subHeading(
        'Metody i środki użytkowania elementów narażonych na szkodliwe wpływy atmosferyczne i niszczące działanie innych czynników'
      ),
      bodyParagraph(insp.weather_exposure_methods || WEATHER_FALLBACK)
    )

    if (art5Section.length > 0) {
      sectionChildren.push(
        sectionHeading('Wymagania podstawowe (art. 5 PB)'),
        ...art5Section
      )
    }

    // ─── ZDJĘCIA INSPEKCJI ─────────────────────────────────────────────────
    // Pobieramy zdjęcia z `inspection_photos` posortowane po numerze i
    // budujemy tabelę 2-kolumnową: każde zdjęcie + caption "Zdjęcie nr X".
    const { data: photosData, error: photosErr } = await supabase
      .from('inspection_photos')
      .select('id, photo_number, file_url, description, sort_order')
      .eq('inspection_id', inspectionId)
      .order('photo_number', { ascending: true, nullsFirst: false })

    if (photosErr) {
      console.error('[DOCX] Błąd ładowania inspection_photos:', photosErr)
    }
    console.log(
      `[DOCX] inspection_photos dla ${inspectionId}: ${photosData?.length ?? 0} wierszy`
    )

    const photoRows = (photosData || []).filter(
      (p: any) => p.file_url
    ) as Array<{
      id: string
      photo_number: number | null
      file_url: string
      description: string | null
    }>

    console.log(`[DOCX] photoRows z file_url: ${photoRows.length}`)

    const photoSectionBlocks: (Table | Paragraph)[] = []
    if (photoRows.length > 0) {
      // Tytuł sekcji zdjęć w 2 liniach (DOCX zawija sam, ale dla spójności
      // z PDF rozdzielamy bold tytuł od wyjaśnienia italic).
      photoSectionBlocks.push(
        subHeading('Dokumentacja fotograficzna wykonana podczas kontroli'),
        bodyParagraph(
          '(elementy obiektu posiadające usterki lub wady, przewidziane do remontu)',
          { italic: true }
        )
      )

      // Pre-fetch wszystkich obrazów równolegle
      const photoBuffers = await Promise.all(
        photoRows.map((p) => fetchImageAsBuffer(p.file_url))
      )

      // Tabela: każda para zdjęć ma 2 wiersze — wiersz z obrazami + wiersz z captionami.
      // Obrazy w stałym rozmiarze 280x187 px (3:2 aspect, ~7cm szerokości).
      const cellWidth = Math.floor(USABLE_WIDTH / 2)
      const photoTableRows: TableRow[] = []

      for (let i = 0; i < photoRows.length; i += 2) {
        const imageCells: TableCell[] = []
        const captionCells: TableCell[] = []

        for (let j = 0; j < 2; j++) {
          const photo = photoRows[i + j]
          const buf = photo ? photoBuffers[i + j] : null

          if (photo && buf) {
            const imageType: 'jpg' | 'png' = buf.format === 'png' ? 'png' : 'jpg'
            imageCells.push(
              new TableCell({
                width: { size: cellWidth, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        type: imageType,
                        data: buf.buffer,
                        transformation: { width: 280, height: 187 },
                        altText: {
                          title: `Zdjęcie ${photo.photo_number ?? i + j + 1}`,
                          description: photo.description ?? '',
                          name: `inspection-photo-${i + j}`,
                        },
                      }),
                    ],
                  }),
                ],
              })
            )
          } else if (photo) {
            // Photo metadata jest, ale buffer się nie pobrał — placeholder
            imageCells.push(
              new TableCell({
                width: { size: cellWidth, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: '[zdjęcie niedostępne]',
                        italics: true,
                        color: HEX.graphite500,
                        font: 'Arial',
                        size: FONT_DXA.small,
                      }),
                    ],
                  }),
                ],
              })
            )
          } else {
            // Padding gdy nieparzysta liczba — pusta komórka
            imageCells.push(
              new TableCell({
                width: { size: cellWidth, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
              })
            )
          }

          if (photo) {
            captionCells.push(
              new TableCell({
                width: { size: cellWidth, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 200 },
                    children: [
                      new TextRun({
                        text: `Zdjęcie nr ${photo.photo_number ?? i + j + 1}`,
                        italics: true,
                        font: 'Arial',
                        size: FONT_DXA.small,
                        color: HEX.graphite800,
                      }),
                    ],
                  }),
                ],
              })
            )
          } else {
            captionCells.push(
              new TableCell({
                width: { size: cellWidth, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
              })
            )
          }
        }

        photoTableRows.push(new TableRow({ children: imageCells }))
        photoTableRows.push(new TableRow({ children: captionCells }))
      }

      photoSectionBlocks.push(
        new Table({
          width: { size: USABLE_WIDTH, type: WidthType.DXA },
          rows: photoTableRows,
        })
      )
    }

    sectionChildren.push(
      sectionHeading(
        isFiveYear
          ? 'VII. Dokumentacja graficzna / fotograficzna'
          : 'VI. Dokumentacja graficzna / fotograficzna'
      ),
      bodyParagraph(
        'Numerację fotografii zsynchronizowano z kolumną „NR FOT." w tabeli ustaleń (sekcja III).',
        { italic: true }
      ),
      ...photoSectionBlocks,

      sectionHeading(isFiveYear ? 'VIII. Podpisy' : 'VII. Podpisy'),
      bodyParagraph(
        'Oświadczam, iż ustalenia zawarte w protokole są zgodne ze stanem faktycznym.'
      ),
      signaturesTable,

      ...(hasAttachments
        ? [subHeading('Załączniki do protokołu'), attachmentsTable]
        : [])
    )

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'bullet-list',
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '•',
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: { indent: { left: 360, hanging: 360 } },
                  run: { font: 'Symbol', size: 20 },
                },
              },
            ],
          },
        ],
      },
      styles: {
        default: {
          document: {
            run: { font: 'Arial', size: 20 },
          },
        },
        paragraphStyles: [
          {
            id: 'Heading2',
            name: 'Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              bold: true,
              font: 'Arial',
              size: FONT_DXA.sectionHeading,
              color: HEX.graphite900,
            },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                orientation: PageOrientation.PORTRAIT,
              },
              margin: {
                top: MARGIN,
                bottom: MARGIN,
                left: MARGIN,
                right: MARGIN,
              },
            },
          },
          headers: { default: docHeader },
          footers: { default: docFooter },
          children: sectionChildren,
        },
      ],
    })

    const uint8 = await Packer.toBuffer(doc)
    const nodeBuffer = Buffer.from(uint8)

    const filename = buildProtocolFilename(
      {
        protocol_number: insp.protocol_number,
        inspection_type: insp.inspection_type,
        inspection_date: insp.inspection_date,
      },
      turbine
        ? {
            turbine_code: turbine.turbine_code,
            ew_designation: turbine.ew_designation,
            location_address: turbine.location_address,
          }
        : null,
      'docx',
      inspectionId,
    )

    return new Response(nodeBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': contentDispositionAttachment(filename),
        'Content-Length': nodeBuffer.length.toString(),
      },
    })
  } catch (error) {
    const err = error as Error
    console.error('Error generating DOCX:', {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    })
    const debugBody =
      process.env.NODE_ENV === 'production'
        ? `Blad podczas generowania DOCX: ${err?.message || 'unknown'}`
        : `Blad podczas generowania DOCX\n\n${err?.stack || err?.message || 'unknown'}`
    return new Response(debugBody, { status: 500 })
  }
}
