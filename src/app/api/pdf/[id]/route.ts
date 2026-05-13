import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import fs from 'fs'
import path from 'path'
import {
  RGB,
  FONT_PT,
  RATING_COLORS_RGB,
  RATING_LABELS,
  ART5_MET_COLORS_RGB,
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
// PROTOKÓŁ KONTROLI OKRESOWEJ - PDF (układ PIIB)
//
// Wzór wg Załącznika do uchwały nr PIIB/KR/0051/2024 KR PIIB z 04.12.2024 r.
// dostosowany do specyfiki turbin wiatrowych. Kolejność sekcji 1:1 z DOCX.
// =============================================================================

const robotoRegularBase64 = fs
  .readFileSync(path.join(process.cwd(), 'src/fonts/Roboto-Regular.ttf'))
  .toString('base64')
const robotoBoldBase64 = fs
  .readFileSync(path.join(process.cwd(), 'src/fonts/Roboto-Bold.ttf'))
  .toString('base64')

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  try {
    return format(new Date(date), 'dd.MM.yyyy', { locale: pl })
  } catch {
    return date
  }
}

function ratingLabel(r: string | null | undefined): string {
  if (!r) return '-'
  return RATING_LABELS[r as RatingKey] || r
}

/**
 * Pobierz obraz z URL (np. Supabase Storage public URL) i zwróć
 * { base64, format } gotowe do `pdf.addImage()`.
 *
 * Zwraca null jeśli nie udało się pobrać (404, network error, niewspierany format).
 * Generator PDF nie powinien się wywalić gdy zdjęcie jest niedostępne.
 */
async function fetchImageAsBase64(
  url: string | null | undefined
): Promise<{ base64: string; format: 'PNG' | 'JPEG' | 'WEBP' } | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    let format: 'PNG' | 'JPEG' | 'WEBP' = 'JPEG'
    if (contentType.includes('png')) format = 'PNG'
    else if (contentType.includes('webp')) format = 'WEBP'
    else if (contentType.includes('jpeg') || contentType.includes('jpg'))
      format = 'JPEG'
    const buffer = Buffer.from(await res.arrayBuffer())
    const base64 = buffer.toString('base64')
    return { base64, format }
  } catch (err) {
    console.error('Nie udało się pobrać obrazu:', url, err)
    return null
  }
}

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
          setAll(cookiesToSet) {
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

    // ─── FETCH INSPECTION ──────────────────────────────────────────────────
    const { data: inspection, error: inspectionError } = await supabase
      .from('inspections')
      .select(
        `
        id, protocol_number, inspection_date, inspection_type, status,
        overall_condition_rating, overall_assessment, hazard_information,
        next_annual_date, next_five_year_date, next_electrical_date,
        previous_annual_date, previous_five_year_date,
        inspector_signature_location, inspector_signature_date,
        owner_representative_name, owner_signature_date, owner_signature_location,
        committee_members, notes,
        object_address, object_registry_number, object_name, object_photo_url,
        owner_name, manager_name, contractor_info, additional_participants,
        documents_reviewed, general_findings_intro, kob_entries_summary,
        electrical_measurement_date, electrical_next_measurement_date,
        electrical_measurement_protocol_number, electrical_measurement_verdict,
        electrical_measurement_verdict_notes, electrical_measurement_final_assessment,
        electrical_measurement_notes, electrical_measurement_protocol_url,
        electrical_visual_inspection_result, electrical_visual_inspection_notes,
        lightning_visual_inspection_result, lightning_visual_inspection_notes,
        environmental_protection_findings, documentation_verification_findings,
        weather_exposure_methods,
        turbines (
          id, turbine_code, ew_designation, model, manufacturer, rated_power_mw, serial_number,
          location_address, tower_height_m, hub_height_m, rotor_diameter_m,
          building_permit_number, building_permit_date, commissioning_year,
          tower_construction_type,
          tower_segments_count,
          foundation_diameter_m, foundation_depth_m,
          pedestal_height_m, service_crane_capacity_t,
          has_as_built_documentation, has_building_log_book,
          photo_url, photo_url_2, photo_url_3,
          wind_farms (
            id, name, location_address,
            clients ( id, name, nip, address )
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

    // ─── FETCH RELATED ─────────────────────────────────────────────────────
    const { data: elementsData } = await supabase
      .from('inspection_elements')
      .select(
        `
        id, condition_rating, notes, recommendations, photo_numbers,
        recommendation_completion_date, usage_suitability, is_not_applicable,
        element_definition:element_definition_id (
          id, element_number, name_pl, scope_annual,
          scope_five_year_additional, applicable_standards, sort_order
        )
        `
      )
      .eq('inspection_id', inspectionId)

    const elements = (elementsData || []).sort((a: any, b: any) => {
      const aNum = a.element_definition?.element_number ?? 999
      const bNum = b.element_definition?.element_number ?? 999
      return aNum - bNum
    }) as Array<{ id: string; [k: string]: unknown }>

    // ─── FETCH ZDJĘĆ PER ELEMENT ──────────────────────────────────────────
    // Mapa element_id → "1, 3, 5" — fallback dla kolumny "Nr fot." w tabeli III
    // gdy inspektor nie wpisał ręcznie `el.photo_numbers`. Zdjęcia carry'ed
    // z prev_rec (Faza A — PR #42) mają element_id i wpadają tu automatycznie.
    const { data: elemPhotosData } = await supabase
      .from('inspection_photos')
      .select('element_id, photo_number')
      .eq('inspection_id', inspectionId)
      .not('element_id', 'is', null)
      .order('photo_number', { ascending: true, nullsFirst: false })

    const photoNumbersByElement = new Map<string, string>()
    for (const p of (elemPhotosData || []) as Array<{
      element_id: string | null
      photo_number: number | null
    }>) {
      if (!p.element_id || p.photo_number == null) continue
      const cur = photoNumbersByElement.get(p.element_id) || ''
      photoNumbersByElement.set(
        p.element_id,
        cur ? `${cur}, ${p.photo_number}` : String(p.photo_number)
      )
    }

    const photoNumbersFor = (el: { id: string; photo_numbers?: string | null }) => {
      const manual = (el.photo_numbers || '').trim()
      if (manual) return manual
      return photoNumbersByElement.get(el.id) || ''
    }

    const { data: inspectorRels } = await supabase
      .from('inspection_inspectors')
      .select(
        `
        is_lead, specialty,
        inspector:inspector_id (
          id, full_name, license_number, specialty,
          chamber_membership, chamber_certificate_number,
          sep_certificate_number, gwo_certificate_number, udt_certificate_number
        )
        `
      )
      .eq('inspection_id', inspectionId)

    const inspectors = (inspectorRels || []).map((item: any) => ({
      ...item.inspector,
      is_lead: item.is_lead,
      rel_specialty: item.specialty,
    }))

    // Podział: inspektorzy z uprawnieniami budowlanymi (PIIB, `license_number`)
    // podpisują protokół; pozostali (np. uprawnienia tylko SEP/GWO) figurują
    // w protokole jako inspektorzy branżowi bez podpisu. Uwaga Waldka
    // 2026-05-12: typowy zespół to "PIIB + branżowy".
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

    // Przedstawiciele klienta uczestniczacy w kontroli ("Przy udziale").
    // Fallback do legacy `additional_participants` gdy brak.
    const { data: participantRels } = await supabase
      .from('inspection_participants')
      .select(
        `
        representative:representative_id (
          id, full_name, role
        )
        `
      )
      .eq('inspection_id', inspectionId)

    const participants = (participantRels || [])
      .map((item: any) => item.representative)
      .filter(Boolean) as Array<{ id: string; full_name: string; role: string | null }>

    // Urzadzenia UDT i sprzet ewakuacyjny przypisany do turbiny (audyt 5L pkt 6)
    const turbineId = turbine?.id as string | undefined
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
    // `repair_recommendations` + `inspection_elements.recommendations`. Patrz
    // analogiczna logika w api/docx/[id]/route.ts.
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
        const text = desc
        if (seen.has(text)) continue
        seen.add(text)
        fallback.push({
          item_number: nextNo++,
          scope_description: text,
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
          const text = line
          if (seen.has(text)) continue
          seen.add(text)
          fallback.push({
            item_number: nextNo++,
            scope_description: text,
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
      .select('item_number, description')
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

    // Dokumenty przedstawione do wglądu — backward compat: stary format =
    // string, nowy = `{ status, info }`. Patrz inspection-metadata-piib.tsx.
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

    // Brak protocol_number (status=draft) → "Szkic" w nagłówku zamiast UUID 8-char.
    // Etykieta spójna z listą inspekcji (STATUS_LABELS.draft) i nazwą pliku.
    const protocolNumber = insp.protocol_number || 'Szkic'
    const inspectionDate = formatDate(insp.inspection_date)
    const artPoint = isFiveYear ? '2' : '1'

    // ─── PDF SETUP ─────────────────────────────────────────────────────────
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    pdf.addFileToVFS('Roboto-Regular.ttf', robotoRegularBase64)
    pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    pdf.addFileToVFS('Roboto-Bold.ttf', robotoBoldBase64)
    pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
    pdf.setFont('Roboto')

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    let yPosition = margin

    // ─── HELPERS ───────────────────────────────────────────────────────────
    const ensureSpace = (mm: number) => {
      if (yPosition > pageHeight - mm) {
        pdf.addPage()
        yPosition = margin
      }
    }

    const addSection = (title: string) => {
      ensureSpace(30)
      pdf.setFontSize(FONT_PT.sectionHeading)
      pdf.setFont('Roboto', 'bold')
      pdf.setTextColor(...RGB.graphite900)
      pdf.setCharSpace(0.4)
      pdf.text(title.toUpperCase(), margin, yPosition)
      pdf.setCharSpace(0)
      yPosition += 7
      pdf.setDrawColor(...RGB.graphite800)
      pdf.setLineWidth(0.3)
      pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.2)
      yPosition += 4
      pdf.setFont('Roboto', 'normal')
      pdf.setFontSize(FONT_PT.body)
      pdf.setTextColor(0)
    }

    const addSubHeading = (title: string) => {
      pdf.setFontSize(11)
      pdf.setFont('Roboto', 'bold')
      pdf.setTextColor(...RGB.graphite800)
      const lines = pdf.splitTextToSize(title, pageWidth - 2 * margin)
      ensureSpace(14 + lines.length * 5)
      pdf.text(lines, margin, yPosition)
      yPosition += lines.length * 5 + 2
      pdf.setFont('Roboto', 'normal')
      pdf.setFontSize(FONT_PT.body)
      pdf.setTextColor(0)
    }

    const addBody = (text: string, opts: { italic?: boolean } = {}) => {
      ensureSpace(20)
      pdf.setFontSize(FONT_PT.body)
      pdf.setFont('Roboto', opts.italic ? 'normal' : 'normal')
      pdf.setTextColor(...RGB.graphite900)
      const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin)
      pdf.text(lines, margin, yPosition)
      yPosition += lines.length * 4.5 + 3
    }

    const addNumberedList = (items: string[]) => {
      pdf.setFontSize(FONT_PT.body)
      pdf.setFont('Roboto', 'normal')
      pdf.setTextColor(...RGB.graphite900)
      items.forEach((item, i) => {
        ensureSpace(15)
        const text = `${i + 1}) ${item}`
        const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin - 5)
        pdf.text(lines, margin + 2, yPosition)
        yPosition += lines.length * 4.5 + 1
      })
      yPosition += 2
    }

    const addKeyValueTable = (rows: { label: string; value: string }[]) => {
      // Pomijamy wiersze z pustym value — nie chcemy wyświetlać niewypełnionych
      // pól (zwłaszcza pól turbiny w sekcji "Dane techniczne") w protokole.
      const filledRows = rows.filter((r) => r.value && r.value.trim())
      if (filledRows.length === 0) return
      ensureSpace(40)
      ;(pdf as any).autoTable({
        startY: yPosition,
        margin: margin,
        body: filledRows.map((r) => [r.label, r.value]),
        styles: {
          font: 'Roboto',
          fontSize: 9,
          cellPadding: 2.5,
          lineColor: [...RGB.graphite200],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: {
            cellWidth: 65,
            fillColor: [...RGB.graphite100],
            fontStyle: 'bold',
            textColor: [...RGB.graphite900],
          },
          1: { textColor: [...RGB.graphite900] },
        },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 5
    }

    const addAutoTable = (
      head: string[],
      body: (string | number)[][],
      columnWidths?: number[]
    ) => {
      ensureSpace(40)
      const config: any = {
        head: [head],
        body,
        startY: yPosition,
        margin: margin,
        styles: {
          font: 'Roboto',
          fontSize: 8.5,
          cellPadding: 2.5,
          overflow: 'linebreak',
          lineColor: [...RGB.graphite200],
          lineWidth: 0.1,
        },
        headStyles: {
          font: 'Roboto',
          fontStyle: 'bold',
          fillColor: [...RGB.graphite800],
          textColor: [...RGB.white],
          cellPadding: 3,
          fontSize: 9,
        },
        bodyStyles: {
          textColor: [...RGB.graphite900],
        },
        alternateRowStyles: {
          fillColor: [...RGB.graphite50],
        },
      }
      if (columnWidths) {
        config.columnStyles = columnWidths.reduce(
          (acc: any, w, i) => {
            acc[i] = { cellWidth: w }
            return acc
          },
          {} as Record<number, { cellWidth: number }>
        )
      }
      ;(pdf as any).autoTable(config)
      yPosition = (pdf as any).lastAutoTable.finalY + 5
    }

    // ─── PAGE 1: COMPANY HEADER ─────────────────────────────────────────────
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo-prowatech.png')
      const logoData = fs.readFileSync(logoPath)
      const logoBase64 = logoData.toString('base64')
      pdf.addImage(logoBase64, 'PNG', margin, yPosition - 8, 30, 18)
    } catch {
      pdf.setFontSize(16)
      pdf.setFont('Roboto', 'bold')
      pdf.setTextColor(...RGB.brand600)
      pdf.text('ProWaTech', margin, yPosition)
      pdf.setTextColor(0)
    }

    const companyLines = [
      'PROWATECH SPÓŁKA Z O.O.',
      'Posada ul. Reymonta 23',
      '62-530 Kazimierz Biskupi',
      'NIP: 6653045169',
      'Email: wtrzecki@prowatech.pl',
    ]
    pdf.setFont('Roboto', 'normal')
    pdf.setFontSize(8)
    companyLines.forEach((line, i) => {
      pdf.text(line, pageWidth - margin, yPosition + i * 3.8, { align: 'right' })
    })
    yPosition += 22

    // Green separator
    pdf.setDrawColor(...RGB.brand500)
    pdf.setLineWidth(1.2)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.2)
    yPosition += 6

    // PIIB info
    pdf.setFontSize(7.5)
    pdf.setFont('Roboto', 'normal')
    pdf.setTextColor(...RGB.graphite500)
    pdf.text(
      'Wzór wg układu Załącznika do uchwały nr PIIB/KR/0051/2024 KR PIIB z 04.12.2024 r.',
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    )
    pdf.setTextColor(0)
    yPosition += 8

    // Title
    pdf.setFont('Roboto', 'bold')
    pdf.setFontSize(15)
    pdf.text(`PROTOKÓŁ NR ${protocolNumber}`, pageWidth / 2, yPosition, {
      align: 'center',
    })
    yPosition += 7
    pdf.setFontSize(13)
    pdf.text(`z dnia ${inspectionDate}`, pageWidth / 2, yPosition, {
      align: 'center',
    })
    yPosition += 8

    // Subtitle
    pdf.setFontSize(10)
    pdf.setFont('Roboto', 'normal')
    pdf.text(
      'z okresowej kontroli obiektu budowlanego obejmującej:',
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    )
    yPosition += 5

    const titleSubLines = isFiveYear
      ? [
          '- sprawdzenie stanu technicznego i przydatności do użytkowania obiektu (turbiny wiatrowej)',
          '- sprawdzenie estetyki obiektu budowlanego oraz jego otoczenia',
          '- badanie instalacji elektrycznej i piorunochronnej',
        ]
      : [
          '- sprawdzenie stanu technicznego elementów obiektu (turbiny wiatrowej)',
          '- sprawdzenie stanu technicznego instalacji służących ochronie środowiska',
          '- sprawdzenie zaleceń z poprzednich kontroli oraz wpisów do KOB',
        ]

    pdf.setFontSize(9)
    titleSubLines.forEach((line) => {
      pdf.text(line, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 4.5
    })
    yPosition += 3

    // Branża + okres
    pdf.setFont('Roboto', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...RGB.graphite800)
    const branzaLabel = isFiveYear
      ? 'BRANŻA KONSTRUKCYJNO-BUDOWLANA + ELEKTROENERGETYCZNA'
      : 'BRANŻA KONSTRUKCYJNO-BUDOWLANA / ELEKTROENERGETYCZNA'
    pdf.setCharSpace(0.4)
    pdf.text(branzaLabel, pageWidth / 2, yPosition, { align: 'center' })
    pdf.setCharSpace(0)
    yPosition += 5
    pdf.setTextColor(...RGB.brand700)
    const periodLabel = isFiveYear
      ? 'KONTROLA OKRESOWA - CO NAJMNIEJ RAZ NA 5 LAT'
      : 'KONTROLA OKRESOWA - CO NAJMNIEJ RAZ W ROKU'
    pdf.setCharSpace(0.4)
    pdf.text(periodLabel, pageWidth / 2, yPosition, { align: 'center' })
    pdf.setCharSpace(0)
    pdf.setTextColor(0)
    yPosition += 8

    // Podstawa prawna
    pdf.setFont('Roboto', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...RGB.graphite700)
    pdf.text('PODSTAWA PRAWNA', pageWidth / 2, yPosition, { align: 'center' })
    pdf.setTextColor(0)
    yPosition += 4
    pdf.setFont('Roboto', 'normal')
    pdf.setFontSize(8.5)
    const basis = `art. 62 ust. 1 pkt ${artPoint} ustawy z dnia 7 lipca 1994 r. - Prawo budowlane (t.j. Dz. U. z 2024 r. poz. 725 z późn. zm.)`
    const basisLines = pdf.splitTextToSize(basis, pageWidth - 2 * margin - 20)
    basisLines.forEach((line: string) => {
      pdf.text(line, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 4
    })
    yPosition += 4

    if (isFiveYear) {
      // Box with 5-year warning
      ensureSpace(15)
      pdf.setDrawColor(...RGB.brand500)
      pdf.setLineWidth(0.5)
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 12)
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.2)
      pdf.setFont('Roboto', 'bold')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...RGB.graphite800)
      const warning =
        'UWAGA: Kontrola pięcioletnia obejmuje pełny zakres kontroli rocznej (art. 62 ust. 1 pkt 1 PB) oraz zakres rozszerzony wynikający z art. 62 ust. 1 pkt 2 PB.'
      const wLines = pdf.splitTextToSize(warning, pageWidth - 2 * margin - 6)
      let wy = yPosition
      wLines.forEach((line: string) => {
        pdf.text(line, pageWidth / 2, wy, { align: 'center' })
        wy += 3.8
      })
      pdf.setTextColor(0)
      pdf.setFont('Roboto', 'normal')
      yPosition = wy + 4
    }

    // ─── METRYCZKA OBIEKTU ─────────────────────────────────────────────────
    addSection('Metryczka obiektu')

    // Embed 3 zdjęć referencyjnych turbiny — pobranych z turbines.photo_url/_2/_3
    // (zdjęcia uzupełniane w karcie turbiny → tożsame z poprzednimi protokołami).
    // Layout 1+2: portret 60×90 mm po lewej, 2 pejzaże 60×40 mm w pionie po prawej
    // (ten sam wzorzec co karta turbiny i poprzednie wersje protokołu).
    // Fallback: jeśli brak zdjęć z turbiny, próbujemy legacy `inspections.object_photo_url`.
    const [turbinePhoto1, turbinePhoto2, turbinePhoto3] = await Promise.all([
      fetchImageAsBase64(turbine?.photo_url),
      fetchImageAsBase64(turbine?.photo_url_2),
      fetchImageAsBase64(turbine?.photo_url_3),
    ])
    const hasAnyTurbinePhoto = !!(turbinePhoto1 || turbinePhoto2 || turbinePhoto3)
    const legacyPhoto = !hasAnyTurbinePhoto
      ? await fetchImageAsBase64(insp.object_photo_url)
      : null

    if (hasAnyTurbinePhoto) {
      // 60×90 mm portret + 2× (60×40 mm pejzaż) = ~92 mm wysokości + label
      ensureSpace(98)
      try {
        const portraitW = 60
        const portraitH = 90
        const landscapeW = 60
        const landscapeH = 43
        const gap = 4
        const totalW = portraitW + gap + landscapeW
        const startX = (pageWidth - totalW) / 2

        // Slot 1 — portret po lewej
        if (turbinePhoto1) {
          pdf.addImage(
            `data:image/${turbinePhoto1.format.toLowerCase()};base64,${turbinePhoto1.base64}`,
            turbinePhoto1.format,
            startX,
            yPosition,
            portraitW,
            portraitH,
            undefined,
            'FAST'
          )
        } else {
          // pusty placeholder ramka
          pdf.setDrawColor(...RGB.graphite500)
          pdf.setLineWidth(0.2)
          pdf.rect(startX, yPosition, portraitW, portraitH)
          pdf.setDrawColor(0)
        }

        // Slot 2 — pejzaż górny po prawej
        const rightX = startX + portraitW + gap
        if (turbinePhoto2) {
          pdf.addImage(
            `data:image/${turbinePhoto2.format.toLowerCase()};base64,${turbinePhoto2.base64}`,
            turbinePhoto2.format,
            rightX,
            yPosition,
            landscapeW,
            landscapeH,
            undefined,
            'FAST'
          )
        } else {
          pdf.setDrawColor(...RGB.graphite500)
          pdf.setLineWidth(0.2)
          pdf.rect(rightX, yPosition, landscapeW, landscapeH)
          pdf.setDrawColor(0)
        }

        // Slot 3 — pejzaż dolny po prawej
        const bottomY = yPosition + landscapeH + gap
        if (turbinePhoto3) {
          pdf.addImage(
            `data:image/${turbinePhoto3.format.toLowerCase()};base64,${turbinePhoto3.base64}`,
            turbinePhoto3.format,
            rightX,
            bottomY,
            landscapeW,
            landscapeH,
            undefined,
            'FAST'
          )
        } else {
          pdf.setDrawColor(...RGB.graphite500)
          pdf.setLineWidth(0.2)
          pdf.rect(rightX, bottomY, landscapeW, landscapeH)
          pdf.setDrawColor(0)
        }

        yPosition += portraitH + 4
        pdf.setFontSize(8)
        pdf.setTextColor(...RGB.graphite500)
        pdf.text('Fotografie obiektu', pageWidth / 2, yPosition, {
          align: 'center',
        })
        pdf.setTextColor(0)
        yPosition += 6
      } catch (err) {
        console.error('Nie udało się osadzić zdjęć turbiny w PDF:', err)
        // Cicho ignorujemy — PDF dalej generuje się bez zdjęć
      }
    } else if (legacyPhoto) {
      // Fallback dla starych inspekcji z wgranym pojedynczym object_photo_url
      ensureSpace(60)
      try {
        const imgW = 60
        const imgH = 45
        const imgX = (pageWidth - imgW) / 2
        pdf.addImage(
          `data:image/${legacyPhoto.format.toLowerCase()};base64,${legacyPhoto.base64}`,
          legacyPhoto.format,
          imgX,
          yPosition,
          imgW,
          imgH,
          undefined,
          'FAST'
        )
        yPosition += imgH + 4
        pdf.setFontSize(8)
        pdf.setTextColor(...RGB.graphite500)
        pdf.text('Fotografia obiektu', pageWidth / 2, yPosition, {
          align: 'center',
        })
        pdf.setTextColor(0)
        yPosition += 6
      } catch (err) {
        console.error('Nie udało się osadzić obrazu legacy w PDF:', err)
      }
    }

    addKeyValueTable([
      // Krok 6: oznaczenie EW (np. "EW 1") z karty turbiny — wyświetlane
      // tylko gdy ustawione, żeby nie generować pustego wiersza w protokole.
      ...(turbine?.ew_designation
        ? [
            {
              label: 'Oznaczenie turbiny',
              value: turbine.ew_designation as string,
            },
          ]
        : []),
      { label: 'Adres obiektu budowlanego', value: insp.object_address || '' },
      {
        label: 'Numer ewidencyjny obiektu',
        value: insp.object_registry_number || '',
      },
      {
        label: 'Nazwa obiektu / funkcja',
        value:
          insp.object_name || 'Elektrownia wiatrowa - turbina wiatrowa',
      },
      { label: 'Data bieżącej kontroli', value: inspectionDate },
      {
        label: 'Data kolejnej kontroli',
        value: formatDate(
          isFiveYear ? insp.next_five_year_date : insp.next_annual_date
        ),
      },
      {
        label: 'Właściciel obiektu',
        value: buildOwnerLine(insp.owner_name, client),
      },
      { label: 'Zarządca obiektu', value: insp.manager_name || '' },
      {
        label: 'Wykonawca KONTROLI',
        // Priorytet: inspektorzy z uprawnieniami budowlanymi PIIB
        // (`license_number`) jako sygnariusze; fallback do legacy
        // `contractor_info` tylko dla starych inspekcji. Inspektorzy
        // branżowi (SEP/GWO) bez PIIB w osobnym wierszu poniżej.
        // Uwagi Artura/Waldka 2026-05-12.
        value:
          (signingInspectors.length > 0
            ? signingInspectors
                .map(
                  (i: any) =>
                    `${i.full_name || ''}${i.license_number ? ' / ' + i.license_number : ''}${i.specialty ? ' / ' + i.specialty : ''}${formatExtraCertsSuffix(i)}`
                )
                .join('; ')
            : insp.contractor_info) || '',
      },
      // Inspektor branżowy — uczestnik z uprawnieniami branżowymi (GWO/SEP/UDT)
      // ale bez uprawnień budowlanych PIIB. Nie podpisuje protokołu.
      ...(assistingInspectors.length > 0
        ? [
            {
              label: 'Inspektor branżowy',
              value: assistingInspectors
                .map(
                  (i: any) => `${i.full_name || ''}${formatExtraCertsSuffix(i)}`
                )
                .join('; '),
            },
          ]
        : []),
      {
        label: 'Przy udziale',
        value:
          participants.length > 0
            ? participants
                .map((p) =>
                  p.role ? `${p.full_name} (${p.role})` : p.full_name
                )
                .join('; ')
            : insp.additional_participants || '',
      },
    ])

    // ─── PODSTAWOWE DANE OBIEKTU ───────────────────────────────────────────
    addSection('Podstawowe dane obiektu budowlanego')
    addBody(
      'Obiekt budowlany - elektrownia wiatrowa (turbina wiatrowa). Dane techniczne i eksploatacyjne urządzenia:'
    )
    addKeyValueTable([
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
      // Wymiary turbiny (wysokość wieży, hub, średnica rotora) celowo pominięte —
      // nie wchodzą do protokołu kontroli.
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
    ])

    // ─── SKŁAD KOMISJI (5-letni) ───────────────────────────────────────────
    if (isFiveYear) {
      addSection('Skład komisji kontrolującej')
      addBody(
        'Niniejszy protokół sporządzono przy udziale osób posiadających uprawnienia w branży konstrukcyjno-budowlanej i elektrycznej (zgodnie z art. 62 ust. 5 PB).'
      )
      // Skład komisji = tylko sygnariusze (uprawnienia budowlane PIIB).
      const konstrInsp = signingInspectors.find(
        (i: any) =>
          i.rel_specialty === 'konstrukcyjna' ||
          i.specialty === 'konstrukcyjna'
      )
      const elektrInsp = signingInspectors.find(
        (i: any) =>
          i.rel_specialty === 'elektryczna' || i.specialty === 'elektryczna'
      )
      addAutoTable(
        ['Branża', 'Imię i nazwisko / Nr uprawnień', 'Izba / kontakt'],
        [
          [
            'Konstrukcyjno-budowlana',
            konstrInsp
              ? `${konstrInsp.full_name || ''}${konstrInsp.license_number ? ' / ' + konstrInsp.license_number : ''}`
              : '',
            konstrInsp
              ? [
                  konstrInsp.chamber_membership,
                  konstrInsp.chamber_certificate_number,
                ]
                  .filter(Boolean)
                  .join(' / ')
              : '',
          ],
          [
            'Elektryczna',
            elektrInsp
              ? `${elektrInsp.full_name || ''}${elektrInsp.license_number ? ' / ' + elektrInsp.license_number : ''}`
              : '',
            elektrInsp
              ? [
                  elektrInsp.chamber_membership,
                  elektrInsp.chamber_certificate_number,
                ]
                  .filter(Boolean)
                  .join(' / ')
              : '',
          ],
        ]
      )
    }

    // ─── OPIS TECHNICZNY OBIEKTU (audyt 5L pkt 6) ───────────────────────────
    // Format wzorowany na archiwalnych protokolach Prowatech - dane techniczne
    // turbiny i instalacji zaczerpniete z karty turbiny.
    {
      const techRows: { label: string; value: string }[] = []
      const fmtNum = (n: number | null | undefined, unit?: string) =>
        n != null && !Number.isNaN(Number(n))
          ? `${n}${unit ? ' ' + unit : ''}`
          : ''
      if (turbine?.tower_height_m)
        techRows.push({
          label: 'Wysokość wieży',
          value: fmtNum(turbine.tower_height_m, 'm'),
        })
      if (turbine?.hub_height_m)
        techRows.push({
          label: 'Wysokość osi piasty',
          value: fmtNum(turbine.hub_height_m, 'm'),
        })
      if (turbine?.rotor_diameter_m)
        techRows.push({
          label: 'Średnica rotora',
          value: fmtNum(turbine.rotor_diameter_m, 'm'),
        })
      if (turbine?.tower_segments_count)
        techRows.push({
          label: 'Liczba segmentów wieży',
          value: String(turbine.tower_segments_count),
        })
      if (turbine?.foundation_diameter_m)
        techRows.push({
          label: 'Średnica fundamentu',
          value: fmtNum(turbine.foundation_diameter_m, 'm'),
        })
      if (turbine?.foundation_depth_m)
        techRows.push({
          label: 'Głębokość posadowienia',
          value: fmtNum(turbine.foundation_depth_m, 'm'),
        })
      if (turbine?.pedestal_height_m)
        techRows.push({
          label: 'Wysokość cokołu',
          value: fmtNum(turbine.pedestal_height_m, 'm'),
        })
      if (turbine?.service_crane_capacity_t)
        techRows.push({
          label: 'Udźwig dźwigu/wciągarki serwisowej',
          value: fmtNum(turbine.service_crane_capacity_t, 't'),
        })
      if (techRows.length > 0) {
        addSection('Opis techniczny obiektu')
        addKeyValueTable(techRows)
      }
    }

    // ─── URZĄDZENIA PODLEGAJĄCE UDT ─────────────────────────────────────────
    if (udtDevices && udtDevices.length > 0) {
      addSection('Urządzenia podlegające pod UDT')
      const udtBody = (udtDevices as any[]).map((d) => [
        [d.device_type, d.manufacturer, d.model].filter(Boolean).join(' / '),
        d.capacity_t != null ? `${d.capacity_t} t` : '',
        d.is_udt_subject ? 'Tak' : 'Nie',
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
      ])
      addAutoTable(
        ['Urządzenie', 'Udźwig', 'UDT', 'Cykl kontrolny / uwagi'],
        udtBody,
        [70, 20, 15, 75]
      )
    }

    // ─── SPRZĘT EWAKUACYJNO-RATUNKOWY ───────────────────────────────────────
    if (rescueEquipment && rescueEquipment.length > 0) {
      addSection('Sprzęt ewakuacyjno-ratunkowy')
      const rescueBody = (rescueEquipment as any[]).map((r) => [
        [r.equipment_type, r.manufacturer, r.model].filter(Boolean).join(' / '),
        [
          r.description,
          r.inspection_frequency
            ? `Częstotliwość: ${r.inspection_frequency}`
            : null,
        ]
          .filter(Boolean)
          .join('. '),
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
      ])
      addAutoTable(
        ['Sprzęt', 'Opis', 'Cykl kontrolny / uwagi'],
        rescueBody,
        [60, 70, 50]
      )
    }

    // ─── DOKUMENTY DO WGLĄDU ───────────────────────────────────────────────
    addSection('Dokumenty przedstawione do wglądu')
    addKeyValueTable([
      {
        label: 'Protokół z poprzedniej kontroli rocznej',
        value: docs.previous_annual || formatDate(insp.previous_annual_date),
      },
      {
        label: 'Protokół z poprzedniej kontroli pięcioletniej',
        value: docs.previous_5y || formatDate(insp.previous_five_year_date),
      },
      {
        label: 'Protokoły pomiarów elektrycznych i odgromowych',
        value: docs.electrical_measurements || '',
      },
      {
        label: 'Protokoły serwisowe',
        value:
          docs.service ||
          (serviceInfoData?.service_company
            ? `${serviceInfoData.service_company}`
            : ''),
      },
      { label: 'Inne dokumenty', value: docs.other || '' },
    ])

    // ─── KRYTERIA OCEN (4 stopnie PIIB) ────────────────────────────────────
    addSection('Przyjęte kryteria oceny stanu technicznego')
    const criteriaRows: (string | number)[][] = [
      [
        'Dobry',
        'element nie zagraża bezpieczeństwu życia i mienia przez okres najbliższych 5 lat, pod warunkiem wykonywania prac konserwacyjnych',
      ],
      [
        'Dostateczny',
        'element przed upływem 5 lat może ulec technicznemu zużyciu; określono termin kolejnego przeglądu / opinii / robót',
      ],
      [
        'Niedostateczny',
        'konieczne jest podjęcie czynności remontowych i zabezpieczeniowych, a określenie "awaryjny" byłoby nieodpowiednie',
      ],
      [
        'Awaryjny',
        'wymaga natychmiastowego podjęcia czynności remontowych i zabezpieczających',
      ],
    ]
    const criteriaKeys: RatingKey[] = [
      'dobry',
      'dostateczny',
      'niedostateczny',
      'awaryjny',
    ]
    ;(pdf as any).autoTable({
      startY: yPosition,
      margin: margin,
      body: criteriaRows,
      styles: {
        font: 'Roboto',
        fontSize: 9,
        cellPadding: 3,
        lineColor: [...RGB.graphite200],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const key = criteriaKeys[data.row.index]
          if (key) {
            const c = RATING_COLORS_RGB[key]
            data.cell.styles.fillColor = [...c.bg]
            if (data.column.index === 0) {
              data.cell.styles.textColor = [...c.text]
            } else {
              data.cell.styles.textColor = [...RGB.graphite900]
            }
          }
        }
      },
    })
    yPosition = (pdf as any).lastAutoTable.finalY + 5

    // ─── I. ZAKRES KONTROLI ─────────────────────────────────────────────────
    addSection('I. Zakres kontroli')
    const zakresList = isFiveYear
      ? [
          'Sprawdzenie wykonania zaleceń z poprzedniej kontroli (rocznej, pięcioletniej i elektrycznej);',
          'Przegląd elementów obiektu budowlanego (turbiny wiatrowej) narażonych na szkodliwe wpływy atmosferyczne i niszczące działania czynników eksploatacyjnych;',
          'Sprawdzenie stanu technicznego i przydatności do użytkowania obiektu budowlanego;',
          'Sprawdzenie estetyki obiektu budowlanego oraz jego otoczenia;',
          'Badanie instalacji elektrycznej i piorunochronnej w zakresie stanu sprawności połączeń, osprzętu, zabezpieczeń i środków ochrony od porażeń, oporności izolacji przewodów i uziemień;',
          'Sprawdzenie stanu technicznego instalacji i urządzeń służących ochronie środowiska;',
          'Weryfikacja kompletności i aktualności dokumentów (KOB, protokoły serwisowe, certyfikaty UDT).',
        ]
      : [
          'Sprawdzenie wykonania zaleceń z poprzedniej kontroli;',
          'Przegląd elementów obiektu budowlanego (turbiny wiatrowej) narażonych na szkodliwe wpływy atmosferyczne i niszczące działania czynników występujących podczas użytkowania;',
          'Oględziny elementów obiektu (fundamentu, wieży, gondoli, wirnika, łopat, podestów, instalacji);',
          'Przegląd stanu technicznego instalacji i urządzeń służących ochronie środowiska (instalacja odgromowa, oświetlenie nawigacyjne);',
          'Weryfikacja aktualności i kompletności dokumentów (KOB, protokoły serwisowe, protokoły pomiarów, certyfikaty UDT).',
        ]
    addNumberedList(zakresList)

    // ─── II. SPRAWDZENIE WYKONANIA ZALECEŃ ──────────────────────────────────
    addSection('II. Sprawdzenie wykonania zaleceń z poprzednich kontroli')
    if (insp.general_findings_intro) {
      addBody(insp.general_findings_intro)
    }
    const completionLabel: Record<string, string> = {
      tak: 'tak',
      nie: 'nie',
      w_trakcie: 'w trakcie',
    }
    const prevRecsAll = (prevRecs || []) as Array<{
      item_number: number
      recommendation_text: string | null
      completion_status: string | null
      remarks: string | null
      source_inspection_type: 'annual' | 'five_year' | null
    }>
    const prevRecsBySource: Record<'five_year' | 'annual' | 'unsourced', typeof prevRecsAll> = {
      five_year: prevRecsAll.filter((r) => r.source_inspection_type === 'five_year'),
      annual: prevRecsAll.filter((r) => r.source_inspection_type === 'annual'),
      unsourced: prevRecsAll.filter((r) => !r.source_inspection_type),
    }
    const renderPrevRecsTable = (
      heading: string,
      rows: typeof prevRecsAll,
      placeholderWhenEmpty: boolean
    ) => {
      addSubHeading(heading)
      const body =
        rows.length > 0
          ? rows.map((r) => [
              String(r.item_number),
              r.recommendation_text || '',
              r.completion_status
                ? completionLabel[r.completion_status] || r.completion_status
                : '',
              r.remarks || '',
            ])
          : placeholderWhenEmpty
          ? [1, 2, 3, 4].map((n) => [String(n), '', '', ''])
          : null
      if (!body) {
        addBody('Nie zaimportowano ani nie wpisano zaleceń dla tej sekcji.')
        return
      }
      addAutoTable(
        ['Lp.', 'Zalecenia z poprzedniej kontroli', 'Wykonanie', 'Uwagi'],
        body,
        [12, 80, 25, 63]
      )
    }
    // Nr + data poprzednich protokołów: bierzemy z documents_reviewed (info wpisuje
    // inspektor w metryczce, sekcja "Dokumenty obiektu okazane do wglądu").
    const prev5ySource = docs.previous_5y?.replace(/^Okazano[\s,—-]*/i, '').trim()
    const prevAnnualSource = docs.previous_annual?.replace(/^Okazano[\s,—-]*/i, '').trim()
    const headingWithSource = (label: string, source: string | undefined) =>
      source ? `${label} (${source})` : label
    if (isFiveYear) {
      // 5-letnia inspekcja sprawdza zalecenia z OBU poprzednich kontroli.
      // Wyjątek: pierwsza kontrola 5-letnia (brak poprzedniej tego typu) —
      // odniesienie wyłącznie do kontroli rocznej, sekcja 5y pomijana.
      const isFirstFiveYear =
        !prev5ySource && prevRecsBySource.five_year.length === 0
      if (isFirstFiveYear) {
        addSubHeading(
          'Ocena realizacji zaleceń z poprzedniej kontroli 5-letniej'
        )
        addBody(
          'Pierwsza kontrola pięcioletnia — brak poprzedniej kontroli tego typu, odniesienie wyłącznie do poprzedniej kontroli rocznej.',
          { italic: true }
        )
      } else {
        renderPrevRecsTable(
          headingWithSource(
            'Ocena realizacji zaleceń z poprzedniej kontroli 5-letniej',
            prev5ySource
          ),
          prevRecsBySource.five_year,
          true
        )
      }
      renderPrevRecsTable(
        headingWithSource(
          'Ocena realizacji zaleceń z poprzedniej kontroli rocznej',
          prevAnnualSource
        ),
        prevRecsBySource.annual,
        true
      )
    } else {
      // Roczna inspekcja sprawdza tylko zalecenia z poprzedniej rocznej.
      // Wyjątek: pierwsza kontrola roczna (nowa turbina, brak poprzedniej) —
      // sekcja pomijana, zostaje notka.
      const isFirstAnnual =
        !prevAnnualSource &&
        prevRecsBySource.annual.length === 0 &&
        prevRecsAll.length === 0
      if (isFirstAnnual) {
        addSubHeading('Ocena realizacji zaleceń z poprzedniej kontroli')
        addBody(
          'Pierwsza kontrola roczna obiektu — brak poprzedniej kontroli, brak zaleceń do sprawdzenia.',
          { italic: true }
        )
      } else {
        renderPrevRecsTable(
          headingWithSource(
            'Ocena realizacji zaleceń z poprzedniej kontroli',
            prevAnnualSource
          ),
          prevRecsBySource.annual.length > 0
            ? prevRecsBySource.annual
            : prevRecsAll,
          true
        )
      }
    }
    if (prevRecsBySource.unsourced.length > 0 && isFiveYear) {
      renderPrevRecsTable(
        'Inne zalecenia (bez przypisanego źródła)',
        prevRecsBySource.unsourced,
        false
      )
    }

    addSubHeading('Stan awaryjny stwierdzony w wyniku przeglądu')
    const hasEmergency = !!(emergencyItems && emergencyItems.length > 0)
    if (hasEmergency) {
      addBody(
        'W wyniku przeglądu technicznego stwierdzam stan awaryjny następujących elementów obiektu:'
      )
      addAutoTable(
        ['Lp.', 'Element obiektu', 'Zakres pilnego remontu / zabezpieczeń'],
        emergencyItems!.map((e: any) => [
          String(e.item_number),
          e.element_name || '',
          e.urgent_repair_scope || '',
        ]),
        [10, 50, 120]
      )
    } else {
      addBody(
        'W wyniku przeglądu technicznego nie stwierdzono stanu awaryjnego.'
      )
    }

    // ─── III. USTALENIA - JEDNA TABELA PIIB ─────────────────────────────────
    addSection('III. Ustalenia oraz wnioski po sprawdzeniu stanu technicznego')
    addBody('W trakcie kontroli ustalono:')

    const usablePdfWidth = pageWidth - 2 * margin
    if (isFiveYear) {
      const cols = [
        usablePdfWidth * 0.18, // Element
        usablePdfWidth * 0.18, // Zakres roczny
        usablePdfWidth * 0.18, // Zakres 5-letni
        usablePdfWidth * 0.13, // Ocena+Przyd
        usablePdfWidth * 0.18, // Zalecenia
        usablePdfWidth * 0.07, // Nr fot.
        usablePdfWidth * 0.08, // Data
      ]
      const body: (string | number)[][] = []
      const rowKeys: (RatingKey | null)[] = []
      for (const el of elements as any[]) {
        const def = el.element_definition
        if (!def || el.is_not_applicable) continue
        const usability = el.usage_suitability
          ? el.usage_suitability === 'spelnia'
            ? 'spełnia'
            : 'nie spełnia'
          : '-'
        body.push([
          `${def.element_number}. ${def.name_pl}`,
          def.scope_annual || '',
          def.scope_five_year_additional || '',
          `${ratingLabel(el.condition_rating)}\nPrzydatność: ${usability}`,
          [el.notes, el.recommendations].filter(Boolean).join(' / '),
          photoNumbersFor(el),
          formatDate(el.recommendation_completion_date),
        ])
        rowKeys.push((el.condition_rating as RatingKey) ?? null)
      }
      ;(pdf as any).autoTable({
        head: [
          [
            'Element',
            'Zakres roczny',
            'Zakres dodatkowy 5-letni',
            'Ocena + przydatność',
            'Zalecenia',
            'Nr fot.',
            'Data wyk.',
          ],
        ],
        body,
        startY: yPosition,
        margin: margin,
        styles: {
          font: 'Roboto',
          fontSize: 7.5,
          cellPadding: 2,
          overflow: 'linebreak',
          lineColor: [...RGB.graphite200],
          lineWidth: 0.1,
        },
        headStyles: {
          font: 'Roboto',
          fontStyle: 'bold',
          fillColor: [...RGB.graphite800],
          textColor: [...RGB.white],
          cellPadding: 2.5,
          fontSize: 8,
        },
        columnStyles: cols.reduce(
          (acc: any, w, i) => {
            acc[i] = { cellWidth: w }
            return acc
          },
          {} as Record<number, { cellWidth: number }>
        ),
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const key = rowKeys[data.row.index]
            if (key) {
              const c = RATING_COLORS_RGB[key]
              if (data.column.index === 0 || data.column.index === 3) {
                data.cell.styles.fillColor = [...c.bg]
                data.cell.styles.textColor = [...c.text]
                if (data.column.index === 0) {
                  data.cell.styles.fontStyle = 'bold'
                }
              }
            }
          }
        },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 5
    } else {
      const cols = [
        usablePdfWidth * 0.22,
        usablePdfWidth * 0.3,
        usablePdfWidth * 0.13,
        usablePdfWidth * 0.22,
        usablePdfWidth * 0.06,
        usablePdfWidth * 0.07,
      ]
      const body: (string | number)[][] = []
      const rowKeys: (RatingKey | null)[] = []
      for (const el of elements as any[]) {
        const def = el.element_definition
        if (!def || el.is_not_applicable) continue
        body.push([
          `${def.element_number}. ${def.name_pl}`,
          [
            (def.scope_annual || '').slice(0, 300),
            el.notes ? '- ' + el.notes : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          ratingLabel(el.condition_rating),
          el.recommendations || '',
          photoNumbersFor(el),
          formatDate(el.recommendation_completion_date),
        ])
        rowKeys.push((el.condition_rating as RatingKey) ?? null)
      }
      ;(pdf as any).autoTable({
        head: [
          [
            'Element',
            'Opis i ustalenia z kontroli',
            'Ocena',
            'Zalecenia',
            'Nr fot.',
            'Data',
          ],
        ],
        body,
        startY: yPosition,
        margin: margin,
        styles: {
          font: 'Roboto',
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          lineColor: [...RGB.graphite200],
          lineWidth: 0.1,
        },
        headStyles: {
          font: 'Roboto',
          fontStyle: 'bold',
          fillColor: [...RGB.graphite800],
          textColor: [...RGB.white],
          cellPadding: 2.5,
          fontSize: 8.5,
        },
        columnStyles: cols.reduce(
          (acc: any, w, i) => {
            acc[i] = { cellWidth: w }
            return acc
          },
          {} as Record<number, { cellWidth: number }>
        ),
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const key = rowKeys[data.row.index]
            if (key) {
              const c = RATING_COLORS_RGB[key]
              if (data.column.index === 0 || data.column.index === 2) {
                data.cell.styles.fillColor = [...c.bg]
                data.cell.styles.textColor = [...c.text]
                if (data.column.index === 0) {
                  data.cell.styles.fontStyle = 'bold'
                }
              }
            }
          }
        },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 5
    }

    // ─── IV. POMIARY ELEKTRYCZNE (5-letni) ──────────────────────────────────
    if (isFiveYear) {
      addSection('IV. Wyniki pomiarów elektrycznych (obowiązkowe co 5 lat)')
      addBody(
        'Pomiary wykonano zgodnie z art. 62 ust. 1 pkt 2 PB oraz wymaganiami PN-HD 60364 i PN-EN 62305.'
      )

      // Podsumowanie pomiarów (Artur uwagi 5L pkt 3 — wariant B). Pojawia się
      // tylko gdy któreś z kluczowych pól jest wypełnione.
      const verdictLabelPdf: Record<string, string> = {
        dopuszcza: 'Dopuszcza do dalszej eksploatacji',
        warunkowo: 'Warunkowo dopuszcza',
        nie_dopuszcza: 'Nie dopuszcza do dalszej eksploatacji',
      }
      const summaryRows: Array<[string, string]> = []
      if (insp.electrical_measurement_protocol_number) {
        summaryRows.push([
          'Nr protokołu z pomiaru',
          insp.electrical_measurement_protocol_number,
        ])
      }
      if (insp.electrical_measurement_date) {
        summaryRows.push([
          'Data pomiaru',
          formatDate(insp.electrical_measurement_date),
        ])
      }
      if (insp.electrical_next_measurement_date) {
        summaryRows.push([
          'Data kolejnego pomiaru',
          formatDate(insp.electrical_next_measurement_date),
        ])
      }
      if (insp.electrical_measurement_verdict) {
        const verdict =
          verdictLabelPdf[insp.electrical_measurement_verdict] ||
          insp.electrical_measurement_verdict
        const withNotes = insp.electrical_measurement_verdict_notes
          ? `${verdict} — ${insp.electrical_measurement_verdict_notes}`
          : verdict
        summaryRows.push(['Orzeczenie', withNotes])
      }
      if (insp.electrical_measurement_final_assessment) {
        // Format strukturalnych wartości (pozytywna/negatywna) z capitalize;
        // legacy / własny tekst pokazujemy as-is.
        const raw = insp.electrical_measurement_final_assessment as string
        const lower = raw.toLowerCase().trim()
        const formatted =
          lower === 'pozytywna'
            ? 'Pozytywna'
            : lower === 'negatywna'
              ? 'Negatywna'
              : raw
        summaryRows.push(['Ocena końcowa', formatted])
      }
      // Oględziny instalacji elektrycznej (audyt 2026-05-07)
      if (insp.electrical_visual_inspection_result) {
        const r = insp.electrical_visual_inspection_result as string
        const label = r === 'pozytywna' ? 'Pozytywna' : 'Negatywna'
        const withNotes =
          r === 'negatywna' && insp.electrical_visual_inspection_notes
            ? `${label} — ${insp.electrical_visual_inspection_notes}`
            : label
        summaryRows.push(['Oględziny instalacji elektrycznej', withNotes])
      }
      // Oględziny instalacji odgromowej i uziomów
      if (insp.lightning_visual_inspection_result) {
        const r = insp.lightning_visual_inspection_result as string
        const label = r === 'pozytywna' ? 'Pozytywna' : 'Negatywna'
        const withNotes =
          r === 'negatywna' && insp.lightning_visual_inspection_notes
            ? `${label} — ${insp.lightning_visual_inspection_notes}`
            : label
        summaryRows.push([
          'Oględziny instalacji odgromowej i uziomów',
          withNotes,
        ])
      }
      // Legacy: `electrical_measurement_notes` zostało usunięte z UI metryczki
      // (cleanup 2026-05-07). Stare inspekcje wciąż mogą mieć tu wartość —
      // renderujemy ją, żeby protokół z archiwum nie zgubił treści.
      if (insp.electrical_measurement_notes) {
        summaryRows.push([
          'Uwagi do oględzin i oceny',
          insp.electrical_measurement_notes,
        ])
      }
      if (summaryRows.length > 0) {
        addSubHeading('Podsumowanie pomiarów')
        addKeyValueTable(
          summaryRows.map(([label, value]) => ({ label, value }))
        )
      }
      if (insp.electrical_measurement_protocol_url) {
        addBody(
          'Pełny protokół pomiarów stanowi załącznik do niniejszej kontroli (PDF).'
        )
      }

      // Identyfikacja użytych przyrządów (Artur uwagi pkt 6).
      if (measurementDevices.length > 0) {
        addSubHeading('Identyfikacja użytych przyrządów')
        addAutoTable(
          ['Model', 'Numer seryjny', 'Producent'],
          measurementDevices.map((d) => [
            d.model,
            d.serial_number,
            d.manufacturer || '—',
          ]),
          [70, 50, 60]
        )
      }

      // Osoby wykonujące pomiary (Artur uwagi pkt 6 cd).
      if (measurementPerformers.length > 0) {
        addSubHeading('Osoby wykonujące pomiary')
        addAutoTable(
          ['Imię i nazwisko', 'Numer uprawnień', 'Izba'],
          measurementPerformers.map((p) => [
            p.full_name,
            p.license_number && p.license_number !== '-'
              ? p.license_number
              : '—',
            p.chamber_membership || '—',
          ]),
          [60, 60, 60]
        )
      }

      if (electricalMeasurements && electricalMeasurements.length > 0) {
        addSubHeading('A. Pomiary punktów kontrolnych')
        const emBody = (electricalMeasurements as any[]).map((m: any) => {
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
              : '-'
          const result =
            m.grounding_result ||
            m.insulation_result ||
            m.loop_impedance_result ||
            m.rcd_result ||
            m.pe_continuity_result ||
            ''
          return [m.measurement_point, measure, result, m.notes || '']
        })
        addAutoTable(
          ['Punkt pomiarowy', 'Wartość', 'Ocena', 'Uwagi'],
          emBody,
          [60, 50, 30, 40]
        )
      }

      if (emProtocols && emProtocols.length > 0) {
        addSubHeading('C. Wykaz protokołów pomiarowych do KOB')
        addAutoTable(
          ['Lp.', 'Rodzaj protokołu', 'Nr i data', 'Wykonawca'],
          (emProtocols as any[]).map((p: any) => [
            String(p.item_number),
            p.protocol_name,
            [p.protocol_number, formatDate(p.measurement_date)]
              .filter(Boolean)
              .join(' / '),
            p.measured_by || '',
          ]),
          [10, 80, 40, 50]
        )
      }
    }

    // ─── V. SERWIS TECHNICZNY ──────────────────────────────────────────────
    // Tomasz pkt 5 + Waldek 2026-05-08: sekcja renderowana tylko gdy:
    //   1) include_in_protocol === true (świadome zaznaczenie inspektora)
    //   2) wpisano jakiekolwiek dane (nie ma sensu renderować pustej tabeli)
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
      addSection('V. Informacje o serwisie technicznym turbiny')
      addBody(
        'Kontrola połączeń śrubowych, docisku segmentów wieży i czynności techniczne są wykonywane przez certyfikowany serwis (art. 8b ustawy z dnia 20 maja 2016 r. o inwestycjach w zakresie elektrowni wiatrowych).'
      )
      addKeyValueTable([
        {
          label: 'Firma serwisowa',
          value: serviceInfoData?.service_company || '',
        },
        {
          label: 'Nr certyfikatu UDT serwisanta',
          value: serviceInfoData?.udt_certificate_number || '',
        },
        {
          label: 'Data ostatniego przeglądu',
          value: formatDate(serviceInfoData?.last_service_date),
        },
        {
          label: 'Nr protokołu serwisowego',
          value: serviceInfoData?.last_service_protocol_number || '',
        },
        {
          label: 'Data następnego przeglądu',
          value: formatDate(serviceInfoData?.next_service_date),
        },
        {
          label: 'Protokoły serwisowe załączone do KOB?',
          value: serviceInfoData?.service_protocols_in_kob ? 'Tak' : 'Nie',
        },
      ])

      if (serviceChecklistData && serviceChecklistData.length > 0) {
        addSubHeading('Zakres czynności serwisowych')
        pdf.setFontSize(FONT_PT.body)
        pdf.setFont('Roboto', 'normal')
        for (const item of serviceChecklistData as any[]) {
          ensureSpace(10)
          const text = `${item.is_checked ? '[X]' : '[ ]'} ${item.item_name_pl}${
            item.notes ? ' - ' + item.notes : ''
          }`
          const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin - 5)
          if (item.is_checked) pdf.setTextColor(...RGB.brand700)
          pdf.text(lines, margin + 2, yPosition)
          if (item.is_checked) pdf.setTextColor(0)
          yPosition += lines.length * 4.5 + 1
        }
        yPosition += 3
      }
    }

    // ─── ZALECENIA (PIIB / WACETOB) ─────────────────────────────────────────
    // Kolumny zgodnie z konwencja branzowa (research GUNB/PIIB 2026-05-08):
    //   Lp | Element | Zakres robot | Rodzaj (K/NB/NG) | Stopien (I-IV) | Termin
    // Plus 3 tabele-legendy: K/NB/NG, stopnie pilnosci, kryteria oceny stanu.
    addSection(isFiveYear ? 'VI. Zalecenia' : 'IV. Zalecenia')
    addBody('Określenie zakresu robót remontowych i kolejności ich wykonywania:')

    const repairBody =
      repairScope && repairScope.length > 0
        ? repairScope.map((r: any) => [
            String(r.item_number),
            r.element_name || '',
            r.scope_description || '',
            r.work_kind || '',
            r.urgency_level || '',
            r.deadline_text ||
              (r.deadline_date ? formatDate(r.deadline_date) : ''),
          ])
        : [1, 2, 3, 4, 5].map((n) => [String(n), '', '', '', '', ''])
    addAutoTable(
      [
        'Lp.',
        'Element / lokalizacja',
        'Zakres robót remontowych',
        'Rodzaj',
        'Pilność',
        'Termin wykonania',
      ],
      repairBody,
      [12, 22, 75, 18, 18, 35]
    )

    // Sekcja „Dokumentacja fotograficzna zaleceń" usunięta 2026-05-13 — wszystkie
    // zdjęcia (zaleceniowe + bieżące usterki) renderują się w sekcji „VI/VII.
    // Dokumentacja graficzna / fotograficzna" z globalną numeracją („Zdjęcie nr N").
    // Decyzja Waldka.

    // ─── 3 TABELE-LEGENDY ───────────────────────────────────────────────────
    addSubHeading('Definicje rodzajów robót remontowych')
    addAutoTable(
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
      [20, 40, 120]
    )

    addSubHeading('Zalecany czas wykonania robót remontowych — stopień pilności')
    addAutoTable(
      ['Stopień', 'Zalecany termin', 'Opis'],
      [
        [
          'I',
          'natychmiast',
          'Remont w przypadku uszkodzeń zagrażających bezpieczeństwu użytkowania lub mogących stać się przyczyną zniszczenia/awarii obiektu. Wymaga natychmiastowego zabezpieczenia, naprawy głównej, wymiany lub rozbiórki.',
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
      [20, 35, 125]
    )

    addSubHeading('Kryteria oceny i klasyfikacji stanu technicznego')
    addAutoTable(
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
      [25, 20, 135]
    )

    if (insp.overall_assessment) {
      addSubHeading('Ogólna ocena stanu technicznego')
      addBody(insp.overall_assessment)
    }
    if (insp.hazard_information) {
      addSubHeading('Informacja o zagrożeniach')
      addBody(insp.hazard_information)
    }

    // ─── ZAKRES KONTROLI — PUNKTY 6 i 7 + METODY I ŚRODKI ────────────────────
    // Wzorzec PIIB wymaga aby protokol odzwierciedlal kazdy punkt deklarowany
    // w "Zakresie kontroli". Dla turbin pkt 6 (ochrona srodowiska), pkt 7
    // (weryfikacja dokumentow) i pkt 8.6 (metody i srodki - turbiny: zawsze
    // "nie dotyczy") dotad nie mialy odpowiedzi w tresci. Audit Waldka 2026-05-08.
    const ENV_FALLBACK =
      'W trakcie kontroli dokonano przeglądu instalacji i urządzeń służących ochronie środowiska (instalacja odgromowa, oświetlenie nawigacyjne). Nie stwierdzono uchybień ani odstępstw od wymagań ochrony środowiska.'
    const DOC_FALLBACK =
      'Zweryfikowano kompletność i aktualność dokumentów obiektu: Książka Obiektu Budowlanego (KOB), protokoły serwisowe, protokoły pomiarów elektrycznych, certyfikaty UDT urządzeń podlegających kontroli. Dokumentacja kompletna i aktualna.'
    const WEATHER_FALLBACK = 'Nie dotyczy.'

    addSubHeading('Stan techniczny instalacji ochrony środowiska')
    addBody(insp.environmental_protection_findings || ENV_FALLBACK)

    addSubHeading('Weryfikacja kompletności i aktualności dokumentów')
    addBody(insp.documentation_verification_findings || DOC_FALLBACK)

    addSubHeading(
      'Metody i środki użytkowania elementów narażonych na szkodliwe wpływy atmosferyczne i niszczące działanie innych czynników'
    )
    addBody(insp.weather_exposure_methods || WEATHER_FALLBACK)

    // ─── VI. WYMAGANIA ART. 5 PB (5-letni) ──────────────────────────────────
    if (isFiveYear && art5Items && art5Items.length > 0) {
      addSection('Wymagania podstawowe (art. 5 PB)')
      const metLabel: Record<string, string> = {
        spelnia: 'spełnione',
        nie_spelnia: 'niespełnione',
        nie_dotyczy: 'nie dotyczy',
      }
      const art5Body = (art5Items as any[]).map((r: any) => [
        r.requirement_label,
        r.is_met ? metLabel[r.is_met] : '',
        r.remarks || '',
      ])
      const art5RowKeys: (Art5MetKey | null)[] = (art5Items as any[]).map(
        (r: any) => (r.is_met as Art5MetKey) ?? null
      )
      const art5Cols = [80, 30, 70]
      ensureSpace(40)
      ;(pdf as any).autoTable({
        head: [['Wymaganie podstawowe', 'Ocena', 'Komentarz / uzasadnienie']],
        body: art5Body,
        startY: yPosition,
        margin: margin,
        styles: {
          font: 'Roboto',
          fontSize: 8.5,
          cellPadding: 2.5,
          overflow: 'linebreak',
          lineColor: [...RGB.graphite200],
          lineWidth: 0.1,
        },
        headStyles: {
          font: 'Roboto',
          fontStyle: 'bold',
          fillColor: [...RGB.graphite800],
          textColor: [...RGB.white],
          cellPadding: 3,
          fontSize: 9,
        },
        bodyStyles: {
          textColor: [...RGB.graphite900],
        },
        columnStyles: art5Cols.reduce(
          (acc: any, w, i) => {
            acc[i] = { cellWidth: w }
            return acc
          },
          {} as Record<number, { cellWidth: number }>
        ),
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 1) {
            const key = art5RowKeys[data.row.index]
            if (key) {
              const c = ART5_MET_COLORS_RGB[key]
              data.cell.styles.fillColor = [...c.bg]
              data.cell.styles.textColor = [...c.text]
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.halign = 'center'
            }
          }
        },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 5
    }

    // ─── DOKUMENTACJA GRAFICZNA + PODPISY + ZAŁĄCZNIKI ─────────────────────
    addSection(
      isFiveYear
        ? 'VII. Dokumentacja graficzna / fotograficzna'
        : 'VI. Dokumentacja graficzna / fotograficzna'
    )
    addBody(
      'Numerację fotografii zsynchronizowano z kolumną "Nr fot." w tabeli ustaleń (sekcja III).',
      { italic: true }
    )

    // Pobieramy zdjęcia z OBU tabel — globalna numeracja od 2026-05-13:
    // zaleceniowe (recommendation_photos, parent_type='repair_scope_item') idą
    // pierwsze (1..N), potem usterki bieżącej kontroli (inspection_photos).
    // Renderujemy jako siatkę 2 x N z podpisami "Zdjęcie nr X".
    const [{ data: ipData, error: ipErr }, { data: rpData, error: rpErr }] =
      await Promise.all([
        supabase
          .from('inspection_photos')
          .select('id, photo_number, file_url, description')
          .eq('inspection_id', inspectionId),
        supabase
          .from('recommendation_photos')
          .select('id, photo_number, file_url, caption')
          .eq('inspection_id', inspectionId)
          .eq('parent_type', 'repair_scope_item'),
      ])

    if (ipErr) console.error('[PDF] Błąd ładowania inspection_photos:', ipErr)
    if (rpErr) console.error('[PDF] Błąd ładowania recommendation_photos:', rpErr)

    const allPhotos: Array<{
      photo_number: number | null
      file_url: string
      description: string | null
    }> = [
      ...((ipData || []) as Array<{
        photo_number: number | null
        file_url: string | null
        description: string | null
      }>)
        .filter((p) => p.file_url)
        .map((p) => ({
          photo_number: p.photo_number,
          file_url: p.file_url as string,
          description: p.description,
        })),
      ...((rpData || []) as Array<{
        photo_number: number | null
        file_url: string | null
        caption: string | null
      }>)
        .filter((p) => p.file_url)
        .map((p) => ({
          photo_number: p.photo_number,
          file_url: p.file_url as string,
          description: p.caption,
        })),
    ]

    const photoRows = allPhotos.sort((a, b) => {
      const an = a.photo_number ?? Number.MAX_SAFE_INTEGER
      const bn = b.photo_number ?? Number.MAX_SAFE_INTEGER
      return an - bn
    })

    console.log(`[PDF] zdjęć (IP + RP) dla ${inspectionId}: ${photoRows.length}`)

    if (photoRows.length > 0) {
      // Podtytuł sekcji zdjęć — analogicznie do legacy protokołów.
      // Tytuł i wyjaśnienie w 2 liniach (nie zmieszczą się w 1 wierszu na A4).
      addSubHeading('Dokumentacja fotograficzna wykonana podczas kontroli')
      addBody(
        '(elementy obiektu posiadające usterki lub wady, przewidziane do remontu)',
        { italic: true }
      )

      // Pre-fetch wszystkich obrazów równolegle
      const photoImages = await Promise.all(
        photoRows.map((p) => fetchImageAsBase64(p.file_url))
      )

      // Layout: 2 zdjęcia w wierszu, każde ~85mm szerokości, 3:2 aspect
      const gap = 4
      const photoWidth = (pageWidth - 2 * margin - gap) / 2
      const photoHeight = (photoWidth * 2) / 3 // 3:2 landscape

      for (let i = 0; i < photoRows.length; i += 2) {
        // Margines na 1 wiersz: zdjęcie + caption + odstęp
        ensureSpace(photoHeight + 12)
        const yStart = yPosition

        for (let j = 0; j < 2 && i + j < photoRows.length; j++) {
          const photo = photoRows[i + j]
          const img = photoImages[i + j]
          const x = margin + j * (photoWidth + gap)

          if (img) {
            // jsPDF nie wspiera natywnie WEBP — fallback na JPEG (nadal działa
            // bo nasz convert pipeline robi z webp jpeg przy uploadzie).
            const fmt = img.format === 'WEBP' ? 'JPEG' : img.format
            try {
              pdf.addImage(img.base64, fmt, x, yStart, photoWidth, photoHeight)
            } catch (e) {
              console.error('Nie udało się wstawić zdjęcia do PDF:', e)
              // Placeholder jako prostokąt
              pdf.setDrawColor(...RGB.graphite200)
              pdf.rect(x, yStart, photoWidth, photoHeight)
              pdf.setFontSize(8)
              pdf.setTextColor(...RGB.graphite500)
              pdf.text('[brak]', x + photoWidth / 2, yStart + photoHeight / 2, {
                align: 'center',
              })
            }
          } else {
            // Placeholder gdy fetch zwrócił null
            pdf.setDrawColor(...RGB.graphite200)
            pdf.rect(x, yStart, photoWidth, photoHeight)
            pdf.setFontSize(8)
            pdf.setTextColor(...RGB.graphite500)
            pdf.text('[brak]', x + photoWidth / 2, yStart + photoHeight / 2, {
              align: 'center',
            })
          }
        }

        // Captions pod zdjęciami
        yPosition = yStart + photoHeight + 4
        pdf.setFontSize(9)
        pdf.setFont('Roboto', 'italic')
        pdf.setTextColor(...RGB.graphite800)
        for (let j = 0; j < 2 && i + j < photoRows.length; j++) {
          const photo = photoRows[i + j]
          const x = margin + j * (photoWidth + gap)
          const num = photo.photo_number ?? i + j + 1
          pdf.text(`Zdjęcie nr ${num}`, x + photoWidth / 2, yPosition, {
            align: 'center',
          })
        }
        pdf.setFont('Roboto', 'normal')
        pdf.setTextColor(0)
        yPosition += 8
      }
    }

    addSection(isFiveYear ? 'VIII. Podpisy' : 'VII. Podpisy')
    addBody(
      'Oświadczam, iż ustalenia zawarte w protokole są zgodne ze stanem faktycznym.'
    )

    // Pieczątka inspektora (~4×2.5cm) + odręczny podpis wymagają minimum
    // ~40mm pionowego miejsca PRZED linią podpisu. Uwaga Artura 2026-05-12:
    // "trochę mało miejsca na pieczątkę inspektora i podpis".
    ensureSpace(80)
    yPosition += 40
    const sigW = (pageWidth - 2 * margin) / 2
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
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, margin + sigW - 10, yPosition)
      pdf.line(
        margin + sigW + 5,
        yPosition,
        pageWidth - margin,
        yPosition
      )
      pdf.setLineWidth(0.2)
      yPosition += 4
      pdf.setFontSize(9)
      pdf.text('Branża KONSTRUKCYJNO-BUDOWLANA', margin, yPosition)
      pdf.text('Branża ELEKTRYCZNA', margin + sigW + 5, yPosition)
      yPosition += 5
      pdf.setFontSize(8)
      pdf.setFont('Roboto', 'normal')
      if (konstr?.full_name) pdf.text(konstr.full_name, margin, yPosition)
      if (elektr?.full_name)
        pdf.text(elektr.full_name, margin + sigW + 5, yPosition)
      yPosition += 4

      // Uprawnienia budowlane PIIB pod imieniem (uwaga Artura 2026-05-13).
      pdf.setFontSize(7)
      pdf.setTextColor(60)
      if (konstr?.license_number && hasValidLicense(konstr.license_number)) {
        pdf.text(`Nr upr.: ${konstr.license_number}`, margin, yPosition)
      }
      if (elektr?.license_number && hasValidLicense(elektr.license_number)) {
        pdf.text(`Nr upr.: ${elektr.license_number}`, margin + sigW + 5, yPosition)
      }
      yPosition += 3.5
      if (konstr?.chamber_membership && konstr.chamber_membership.trim()) {
        pdf.text(konstr.chamber_membership.trim(), margin, yPosition, {
          maxWidth: sigW - 10,
        })
      }
      if (elektr?.chamber_membership && elektr.chamber_membership.trim()) {
        pdf.text(elektr.chamber_membership.trim(), margin + sigW + 5, yPosition, {
          maxWidth: sigW - 10,
        })
      }
      pdf.setTextColor(0)
      yPosition += 8
    } else {
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, margin + sigW - 10, yPosition)
      pdf.line(margin + sigW + 5, yPosition, pageWidth - margin, yPosition)
      pdf.setLineWidth(0.2)
      yPosition += 4
      pdf.setFontSize(9)
      pdf.text('Wykonawca KONTROLI', margin, yPosition)
      pdf.text('Właściciel / Zarządca obiektu', margin + sigW + 5, yPosition)
      yPosition += 5
      pdf.setFontSize(8)
      // Tylko sygnariusze, branżowi nie składają podpisu.
      const inspNames = signingInspectors
        .map((i: any) => i.full_name)
        .filter(Boolean)
        .join(', ')
      if (inspNames) pdf.text(inspNames, margin, yPosition)
      if (insp.owner_representative_name) {
        pdf.text(
          insp.owner_representative_name,
          margin + sigW + 5,
          yPosition
        )
      }
      yPosition += 4

      // Uprawnienia budowlane PIIB. Dla rocznej gdy jest jeden sygnariusz —
      // podajmy jego uprawnienia. Przy 2+ sygnariuszach pomijamy (brak miejsca),
      // pieczątka i tak zawiera numer.
      pdf.setFontSize(7)
      pdf.setTextColor(60)
      if (signingInspectors.length === 1) {
        const lead = signingInspectors[0] as any
        if (lead?.license_number && hasValidLicense(lead.license_number)) {
          pdf.text(`Nr upr.: ${lead.license_number}`, margin, yPosition)
          yPosition += 3.5
        }
        if (lead?.chamber_membership && lead.chamber_membership.trim()) {
          pdf.text(lead.chamber_membership.trim(), margin, yPosition, {
            maxWidth: sigW - 10,
          })
          yPosition += 3.5
        }
      }
      pdf.setTextColor(0)
      yPosition += 8
    }

    // Auto-dorzucamy protokół pomiarów PDF (z `inspections.electrical_measurement_protocol_url`)
    // jako kolejny załącznik, żeby user nie musiał go ręcznie wpisywać.
    const attachItems: Array<{ item_number: number; description: string }> =
      attachments && attachments.length > 0
        ? attachments.map((a: any) => ({
            item_number: a.item_number,
            description: a.description || '',
          }))
        : []
    if (insp.electrical_measurement_protocol_url) {
      const protoNo = insp.electrical_measurement_protocol_number
        ? ` nr ${insp.electrical_measurement_protocol_number}`
        : ''
      const protoDate = insp.electrical_measurement_date
        ? ` z dnia ${formatDate(insp.electrical_measurement_date)}`
        : ''
      attachItems.unshift({
        item_number: 0,
        description: `Protokół pomiarów elektrycznych${protoNo}${protoDate} (PDF)`,
      })
      attachItems.forEach((a, i) => {
        a.item_number = i + 1
      })
    }
    // Brak załączników → pomijamy całą sekcję (heading + table). Polityka
    // "lepiej puste niż placeholder" zgodnie z PR #19; uwaga Artura 2026-05-12:
    // stary fallback `[1..6]` generował 6 pustych punktów w protokołach
    // bez załączników.
    if (attachItems.length > 0) {
      addSubHeading('Załączniki do protokołu')
      const attachBody = attachItems.map((a) => [
        String(a.item_number),
        a.description,
      ])
      addAutoTable(['Lp.', 'Załącznik do protokołu'], attachBody, [10, 170])
    }

    // ─── PAGE FOOTERS ──────────────────────────────────────────────────────
    const pageCount = (pdf as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.setFontSize(7)
      pdf.setFont('Roboto', 'normal')
      pdf.setTextColor(...RGB.graphite500)
      pdf.text(
        `Strona ${i} z ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      )
      if (i > 1) {
        pdf.setFontSize(7)
        pdf.text(
          `PROTOKÓŁ NR ${protocolNumber} z dnia ${inspectionDate}`,
          margin,
          10
        )
      }
      pdf.setTextColor(0)
    }

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

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
      'pdf',
      inspectionId,
    )

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionAttachment(filename),
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    const err = error as Error
    console.error('Error generating PDF:', {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    })
    // Zwracamy treść błędu w body (tylko gdy NODE_ENV !== production lub debug header).
    // Vercel Runtime Logs zawsze widzą console.error.
    const debugBody =
      process.env.NODE_ENV === 'production'
        ? `Blad podczas generowania PDF: ${err?.message || 'unknown'}`
        : `Blad podczas generowania PDF\n\n${err?.stack || err?.message || 'unknown'}`
    return new Response(debugBody, { status: 500 })
  }
}
