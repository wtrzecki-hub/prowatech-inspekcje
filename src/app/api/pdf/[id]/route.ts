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
  type RatingKey,
} from '@/lib/design/protocol-tokens'

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
        turbines (
          id, turbine_code, model, manufacturer, rated_power_mw, serial_number,
          location_address, tower_height_m, hub_height_m, rotor_diameter_m,
          building_permit_number, building_permit_date, commissioning_year,
          tower_construction_type,
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
    })

    const { data: inspectorRels } = await supabase
      .from('inspection_inspectors')
      .select(
        `
        is_lead, specialty,
        inspector:inspector_id (
          id, full_name, license_number, specialty,
          chamber_membership, chamber_certificate_number
        )
        `
      )
      .eq('inspection_id', inspectionId)

    const inspectors = (inspectorRels || []).map((item: any) => ({
      ...item.inspector,
      is_lead: item.is_lead,
      rel_specialty: item.specialty,
    }))

    const { data: prevRecs } = await supabase
      .from('previous_recommendations')
      .select('item_number, recommendation_text, completion_status, remarks')
      .eq('inspection_id', inspectionId)
      .order('item_number')

    const { data: emergencyItems } = await supabase
      .from('emergency_state_items')
      .select('item_number, element_name, urgent_repair_scope')
      .eq('inspection_id', inspectionId)
      .order('item_number')

    const { data: repairScope } = await supabase
      .from('repair_scope_items')
      .select(
        'item_number, scope_description, deadline_text, deadline_date, is_completed, completion_date'
      )
      .eq('inspection_id', inspectionId)
      .order('item_number')

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

    const docs = (insp.documents_reviewed as Record<string, string>) || {}

    const protocolNumber = insp.protocol_number || inspectionId.slice(0, 8)
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
      ensureSpace(20)
      pdf.setFontSize(11)
      pdf.setFont('Roboto', 'bold')
      pdf.setTextColor(...RGB.graphite800)
      pdf.text(title, margin, yPosition)
      yPosition += 6
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
      ensureSpace(40)
      ;(pdf as any).autoTable({
        startY: yPosition,
        margin: margin,
        body: rows.map((r) => [r.label, r.value || '-']),
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
        value: insp.owner_name || client?.name || '',
      },
      { label: 'Zarządca obiektu', value: insp.manager_name || '' },
      {
        label: 'Wykonawca KONTROLI',
        value:
          insp.contractor_info ||
          inspectors
            .map(
              (i: any) =>
                `${i.full_name || ''}${i.license_number ? ' / ' + i.license_number : ''}${i.specialty ? ' / ' + i.specialty : ''}`
            )
            .join('; '),
      },
      { label: 'Przy udziale', value: insp.additional_participants || '' },
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
      {
        label: 'Wysokość wieży H [m]',
        value: turbine?.tower_height_m ? `${turbine.tower_height_m}` : '',
      },
      {
        label: 'Wysokość do osi piasty [m]',
        value: turbine?.hub_height_m ? `${turbine.hub_height_m}` : '',
      },
      {
        label: 'Średnica rotora D [m]',
        value: turbine?.rotor_diameter_m ? `${turbine.rotor_diameter_m}` : '',
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
    ])

    // ─── SKŁAD KOMISJI (5-letni) ───────────────────────────────────────────
    if (isFiveYear) {
      addSection('Skład komisji kontrolującej')
      addBody(
        'Niniejszy protokół sporządzono przy udziale osób posiadających uprawnienia w branży konstrukcyjno-budowlanej i elektrycznej (zgodnie z art. 62 ust. 5 PB).'
      )
      const konstrInsp = inspectors.find(
        (i: any) =>
          i.rel_specialty === 'konstrukcyjna' ||
          i.specialty === 'konstrukcyjna'
      )
      const elektrInsp = inspectors.find(
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
    addSubHeading('Ocena realizacji zaleceń z poprzedniej kontroli')
    const completionLabel: Record<string, string> = {
      tak: 'tak',
      nie: 'nie',
      w_trakcie: 'w trakcie',
    }
    const prevRecsBody =
      prevRecs && prevRecs.length > 0
        ? prevRecs.map((r: any) => [
            String(r.item_number),
            r.recommendation_text || '',
            r.completion_status
              ? completionLabel[r.completion_status] || r.completion_status
              : '',
            r.remarks || '',
          ])
        : [1, 2, 3, 4].map((n) => [String(n), '', '', ''])
    addAutoTable(
      ['Lp.', 'Zalecenia z poprzedniej kontroli', 'Wykonanie', 'Uwagi'],
      prevRecsBody,
      [10, 80, 25, 65]
    )

    addSubHeading('Stan awaryjny stwierdzony w wyniku przeglądu')
    if (emergencyItems && emergencyItems.length > 0) {
      addBody(
        'W wyniku przeglądu technicznego stwierdzam stan awaryjny następujących elementów obiektu:'
      )
    } else {
      addBody(
        'W wyniku przeglądu technicznego nie stwierdzono stanu awaryjnego.'
      )
    }
    const emergencyBody =
      emergencyItems && emergencyItems.length > 0
        ? emergencyItems.map((e: any) => [
            String(e.item_number),
            e.element_name || '',
            e.urgent_repair_scope || '',
          ])
        : [1, 2, 3, 4].map((n) => [String(n), '', ''])
    addAutoTable(
      ['Lp.', 'Element obiektu', 'Zakres pilnego remontu / zabezpieczeń'],
      emergencyBody,
      [10, 50, 120]
    )

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
          el.photo_numbers || '',
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
          el.photo_numbers || '',
          formatDate(el.recommendation_completion_date),
        ])
        rowKeys.push((el.condition_rating as RatingKey) ?? null)
      }
      ;(pdf as any).autoTable({
        head: [
          [
            'Element',
            'Opis stanu technicznego',
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

    // ─── ZALECENIA (Zakres czynności / Termin) ──────────────────────────────
    addSection(isFiveYear ? 'VI. Zalecenia' : 'IV. Zalecenia')
    addBody('Określenie zakresu robót remontowych i kolejności ich wykonywania:')

    const repairBody =
      repairScope && repairScope.length > 0
        ? repairScope.map((r: any) => [
            r.scope_description || '',
            r.deadline_text ||
              (r.deadline_date ? formatDate(r.deadline_date) : ''),
          ])
        : [1, 2, 3, 4, 5].map(() => ['', ''])
    addAutoTable(['Zakres czynności', 'Termin wykonania'], repairBody, [
      130,
      50,
    ])

    if (insp.overall_assessment) {
      addSubHeading('Ogólna ocena stanu technicznego')
      addBody(insp.overall_assessment)
    }
    if (insp.hazard_information) {
      addSubHeading('Informacja o zagrożeniach')
      addBody(insp.hazard_information)
    }

    // ─── VI. WYMAGANIA ART. 5 PB (5-letni) ──────────────────────────────────
    if (isFiveYear && art5Items && art5Items.length > 0) {
      addSection('Wymagania podstawowe (art. 5 PB)')
      const metLabel: Record<string, string> = {
        spelnia: 'spełnione',
        nie_spelnia: 'niespełnione',
        nie_dotyczy: 'nie dotyczy',
      }
      addAutoTable(
        ['Wymaganie podstawowe', 'Ocena', 'Komentarz'],
        (art5Items as any[]).map((r: any) => [
          r.requirement_label,
          r.is_met ? metLabel[r.is_met] : '',
          r.remarks || '',
        ]),
        [80, 30, 70]
      )
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

    addSection(isFiveYear ? 'VIII. Podpisy' : 'VII. Podpisy')
    addBody(
      'Oświadczam, iż ustalenia zawarte w protokole są zgodne ze stanem faktycznym.'
    )

    ensureSpace(50)
    yPosition += 15
    const sigW = (pageWidth - 2 * margin) / 2
    if (isFiveYear) {
      const konstr = inspectors.find(
        (i: any) =>
          i.rel_specialty === 'konstrukcyjna' || i.specialty === 'konstrukcyjna'
      )
      const elektr = inspectors.find(
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
      const inspNames = inspectors
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
      yPosition += 8
    }

    addSubHeading('Załączniki do protokołu')
    const attachBody =
      attachments && attachments.length > 0
        ? attachments.map((a: any) => [String(a.item_number), a.description])
        : [1, 2, 3, 4, 5, 6].map((n) => [String(n), ''])
    addAutoTable(['Lp.', 'Załącznik do protokołu'], attachBody, [10, 170])

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

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="protokol-PIIB-${(insp.protocol_number || inspectionId).replace(/[\/\\:*?"<>|]/g, '_')}.pdf"`,
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
