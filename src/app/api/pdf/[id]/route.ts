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
  URGENCY_COLORS_RGB,
  type RatingKey,
  type UrgencyKey,
} from '@/lib/design/protocol-tokens'

const robotoRegularBase64 = fs.readFileSync(
  path.join(process.cwd(), 'src/fonts/Roboto-Regular.ttf')
).toString('base64')
const robotoBoldBase64 = fs.readFileSync(
  path.join(process.cwd(), 'src/fonts/Roboto-Bold.ttf')
).toString('base64')

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

    // Auth: require session; client_user may only access their own inspections
    const { data: { user } } = await supabase.auth.getUser()
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

    // Fetch inspection with all relations through turbines → wind_farms → clients
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
        inspector_signature_location,
        inspector_signature_date,
        owner_representative_name,
        committee_members,
        notes,
        turbines (
          id,
          turbine_code,
          model,
          manufacturer,
          rated_power_mw,
          serial_number,
          location_address,
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

    const turbine = (inspection as any).turbines
    const windFarm = turbine?.wind_farms
    const client = windFarm?.clients

    // Fetch inspection elements with definitions
    const { data: elements } = await supabase
      .from('inspection_elements')
      .select(
        `
        id,
        condition_rating,
        notes,
        element_definition:element_definition_id (
          id,
          name_pl,
          section_code
        )
      `
      )
      .eq('inspection_id', inspectionId)

    // Fetch inspectors
    const { data: inspectorRels } = await supabase
      .from('inspection_inspectors')
      .select(
        `
        inspector:inspector_id (
          id,
          full_name,
          license_number,
          specialty
        )
      `
      )
      .eq('inspection_id', inspectionId)

    const inspectors = inspectorRels
      ?.map((item: any) => item.inspector)
      .filter(Boolean) || []

    // Fetch repair recommendations
    const { data: repairs } = await supabase
      .from('repair_recommendations')
      .select('id, scope_description, urgency_level, deadline_date, is_completed')
      .eq('inspection_id', inspectionId)

    // Fetch electrical measurements if five-year inspection
    let measurements: any[] = []
    if (inspection.inspection_type === 'five_year') {
      const { data: measurementsData } = await supabase
        .from('electrical_measurements')
        .select('*')
        .eq('inspection_id', inspectionId)
      measurements = measurementsData || []
    }

    // Generate PDF
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

    // Helper functions
    // Nagłówek sekcji w stylu „Część I / Część II" — 11pt bold uppercase z delikatnym
    // trackingiem (0.4 pt ≈ tracking-0.12em) i cienką kreską graphite-800 pod spodem.
    const addSection = (title: string) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage()
        yPosition = margin
      }
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

    const addRow = (label: string, value: string, lineHeight = 5) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.setFont('Roboto', 'bold')
      pdf.text(label + ':', margin, yPosition)
      pdf.setFont('Roboto', 'normal')
      const textWidth = pageWidth - margin * 2 - 60
      const lines = pdf.splitTextToSize(value, textWidth)
      pdf.text(lines, margin + 60, yPosition)
      yPosition += Math.max(lineHeight, lines.length * 4) + 2
    }

    const addTable = (
      headers: string[],
      rows: (string | number)[][],
      columnWidths: number[] = []
    ) => {
      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = margin
      }

      const tableConfig: any = {
        head: [headers],
        body: rows,
        startY: yPosition,
        margin: margin,
        columnStyles: {},
        styles: {
          font: 'Roboto',
          fontSize: 9,
          cellPadding: 3,
          overflow: 'linebreak',
        },
        headStyles: {
          font: 'Roboto',
          fontStyle: 'bold',
          fillColor: [...RGB.graphite800],
          textColor: [...RGB.white],
          cellPadding: 3.5,
        },
        bodyStyles: {
          textColor: [...RGB.graphite900],
          lineColor: [...RGB.graphite200],
          lineWidth: 0.1,
        },
        alternateRowStyles: {
          fillColor: [...RGB.graphite50],
        },
      }

      if (columnWidths.length > 0) {
        tableConfig.columnStyles = columnWidths.reduce(
          (acc: any, width: number, idx: number) => {
            acc[idx] = { cellWidth: width }
            return acc
          },
          {}
        )
      }

      pdf.autoTable(tableConfig)
      yPosition = (pdf as any).lastAutoTable.finalY + 5
    }

    // Reusable protocol metadata
    const protocolNumber = inspection.protocol_number || inspectionId
    const inspectionDate = format(new Date(inspection.inspection_date), 'dd.MM.yyyy', { locale: pl })
    const typeLabel =
      inspection.inspection_type === 'annual'
        ? 'kontroli okresowej wykonywanej co najmniej raz w roku'
        : 'kontroli okresowej wykonywanej raz na pięć lat'
    const artPoint = inspection.inspection_type === 'annual' ? '1' : '2'

    // --- Company header (page 1) ---
    // Try to load logo image
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo-prowatech.png')
      const logoData = fs.readFileSync(logoPath)
      const logoBase64 = logoData.toString('base64')
      pdf.addImage(logoBase64, 'PNG', margin, yPosition - 8, 30, 18)
    } catch {
      // Fallback to text if logo not found
      pdf.setFontSize(16)
      pdf.setFont('Roboto', 'bold')
      pdf.setTextColor(...RGB.brand600)
      pdf.text('ProWaTech', margin, yPosition)
      pdf.setTextColor(0)
    }

    // Right side: company details (8pt, normal, right-aligned)
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

    // Separator line — zielony pasek brand-500 (§ 3 prototypu).
    pdf.setDrawColor(...RGB.brand500)
    pdf.setLineWidth(1.2)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    pdf.setDrawColor(0)
    pdf.setLineWidth(0.2)
    yPosition += 10

    // --- Protocol title (centered, bold) ---
    pdf.setFont('Roboto', 'bold')
    pdf.setFontSize(14)
    pdf.text(`PROTOKÓŁ NR ${protocolNumber}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 7
    pdf.text(`z dnia ${inspectionDate}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 7
    pdf.setFontSize(11)
    pdf.text(typeLabel, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 6
    pdf.text(`na podstawie art. 62 ust. 1 pkt ${artPoint}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 6
    pdf.text('ustawy Prawo budowlane z dnia 7 lipca 1994 r.', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 6
    pdf.setFontSize(10)
    pdf.text('(t.j. Dz. U. z 2024 r., poz. 725 z późn. zm.)', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 14
    pdf.setFont('Roboto', 'normal')

    // Inspection info section
    addSection('Dane inspekcji')
    addRow('Nr protokołu', inspection.protocol_number || 'Brak')
    addRow('Data kontroli', format(new Date(inspection.inspection_date), 'dd MMMM yyyy', { locale: pl }))
    addRow(
      'Typ kontroli',
      inspection.inspection_type === 'annual' ? 'Roczna' : 'Pięcioletnia'
    )
    addRow('Status', (inspection.status || '').toUpperCase())

    // Turbine info
    addSection('Dane turbiny wiatrowej')
    addRow('Kod turbiny', turbine?.turbine_code || '-')
    addRow(
      'Producent i model',
      `${turbine?.manufacturer || ''} ${turbine?.model || ''}`.trim() || '-'
    )
    addRow('Moc nominalna', turbine?.rated_power_mw ? `${turbine.rated_power_mw} MW` : '-')
    if (turbine?.serial_number) {
      addRow('Nr seryjny', turbine.serial_number)
    }
    if (turbine?.location_address) {
      addRow('Lokalizacja turbiny', turbine.location_address)
    }


    // Farm info
    if (windFarm) {
      addSection('Lokalizacja farmy wiatrowej')
      addRow('Nazwa farmy', windFarm.name || '-')
      if (windFarm.location_address) {
        addRow('Adres', windFarm.location_address)
      }
    }

    // Client info
    if (client) {
      addSection('Dane właściciela/zarządcy')
      addRow('Nazwa podmiotu', client.name || '-')
      if (client.nip) {
        addRow('NIP', client.nip)
      }
      if (client.address) {
        addRow('Adres', client.address)
      }
    }

    // Inspectors info
    addSection('Dane inspektora/inspektorów')
    if (inspectors.length > 0) {
      inspectors.forEach((inspector: any, idx: number) => {
        addRow(
          `Inspektor ${idx + 1}`,
          `${inspector.full_name}${inspector.license_number ? ` (Nr licencji: ${inspector.license_number})` : ''}`
        )
        if (inspector.specialty) {
          addRow('Specjalizacja', inspector.specialty)
        }
      })
    } else {
      addRow('Inspektor', 'Brak danych')
    }

    // Elements assessment — z color-codingiem ocen (sev-1..5)
    // Paleta 1:1 z design/prowatech-prototype.html § 3 i z docx A2.
    if (elements && elements.length > 0) {
      addSection('Ocena elementów turbiny')

      // Metadane wierszy — RatingKey per index, wykorzystywane w hookach.
      const rows = elements.map((el: any) => ({
        rating: ((el?.condition_rating ?? null) as RatingKey | null),
        name: el.element_definition?.name_pl || '-',
        label: el.condition_rating
          ? (RATING_LABELS[el.condition_rating as RatingKey] || String(el.condition_rating))
          : '-',
        notes: el.notes || '-',
      }))

      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = margin
      }

      pdf.autoTable({
        head: [['Element', 'Ocena', 'Uwagi']],
        body: rows.map((r) => [r.name, r.label, r.notes]),
        startY: yPosition,
        margin: margin,
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 30 },
          2: { cellWidth: 'auto' },
        },
        styles: {
          font: 'Roboto',
          fontSize: FONT_PT.tableBody,
          cellPadding: 3.5,
          overflow: 'linebreak',
          textColor: [...RGB.graphite900],
          lineColor: [...RGB.graphite200],
          lineWidth: 0.1,
        },
        headStyles: {
          font: 'Roboto',
          fontStyle: 'bold',
          fillColor: [...RGB.graphite800],
          textColor: [...RGB.white],
          cellPadding: 3.5,
        },
        // Per-row tło + kolor tekstu wg RATING_COLORS_RGB. Ocena (col 1) bold.
        didParseCell: (data: any) => {
          if (data.section !== 'body') return
          const rating = rows[data.row.index]?.rating
          if (!rating) return
          const colors = RATING_COLORS_RGB[rating]
          data.cell.styles.fillColor = [...colors.bg]
          data.cell.styles.textColor = [...colors.text]
          if (data.column.index === 1) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
        // Pasek 1.5mm z lewej strony pierwszej kolumny w kolorze stripe oceny.
        didDrawCell: (data: any) => {
          if (data.section !== 'body' || data.column.index !== 0) return
          const rating = rows[data.row.index]?.rating
          if (!rating) return
          const stripe = RATING_COLORS_RGB[rating].stripe
          pdf.setFillColor(...stripe)
          pdf.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, 'F')
        },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 5
    }

    // Electrical measurements (for five-year inspections)
    if (inspection.inspection_type === 'five_year' && measurements.length > 0) {
      addSection('Pomiary instalacji elektrycznej')
      const measurementRows = measurements.map((m: any) => [
        m.parameter || '-',
        m.value?.toString() || '-',
        m.unit || '-',
        m.status || '-',
      ])
      addTable(['Parametr', 'Wartość', 'Jednostka', 'Status'], measurementRows)
    }

    // Repair recommendations — z color-codingiem pilności (I-IV)
    // Paleta z URGENCY_COLORS_RGB (protocol-tokens.ts), 1:1 z docx A3.
    if (repairs && repairs.length > 0) {
      addSection('Zalecenia naprawcze')

      const repRows = repairs.map((r: any) => ({
        level: ((r?.urgency_level ?? null) as UrgencyKey | null),
        scope: r.scope_description || '-',
        deadline: r.deadline_date
          ? format(new Date(r.deadline_date), 'dd.MM.yyyy', { locale: pl })
          : '-',
      }))

      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = margin
      }

      pdf.autoTable({
        head: [['Priorytet', 'Opis naprawy', 'Termin']],
        body: repRows.map((r) => [r.level ?? '-', r.scope, r.deadline]),
        startY: yPosition,
        margin: margin,
        styles: {
          font: 'Roboto',
          fontSize: FONT_PT.tableBody,
          cellPadding: 3.5,
          overflow: 'linebreak',
          textColor: [...RGB.graphite900],
          lineColor: [...RGB.graphite200],
          lineWidth: 0.1,
        },
        headStyles: {
          font: 'Roboto',
          fontStyle: 'bold',
          fillColor: [...RGB.graphite800],
          textColor: [...RGB.white],
          cellPadding: 3.5,
        },
        alternateRowStyles: {
          fillColor: [...RGB.graphite50],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 25 },
        },
        // Tylko kolumna 0 (Priorytet) koloruje się wg URGENCY_COLORS_RGB.
        didParseCell: (data: any) => {
          if (data.section !== 'body' || data.column.index !== 0) return
          const level = repRows[data.row.index]?.level
          if (!level) return
          const colors = URGENCY_COLORS_RGB[level]
          data.cell.styles.fillColor = [...colors.bg]
          data.cell.styles.textColor = [...colors.text]
          data.cell.styles.fontStyle = 'bold'
        },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 5
    }

    // Overall assessment
    addSection('Wnioski')
    if (inspection.overall_condition_rating) {
      const ratingLabels: { [key: string]: string } = {
        dobry: 'Dobry',
        zadowalajacy: 'Zadowalający',
        sredni: 'Średni',
        zly: 'Zły',
        awaryjny: 'Awaryjny',
      }
      addRow(
        'Ocena ogólna stanu',
        ratingLabels[inspection.overall_condition_rating] ||
          inspection.overall_condition_rating
      )
    }

    if (inspection.overall_assessment) {
      if (yPosition > pageHeight - 30) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.setFont('Roboto', 'bold')
      pdf.text('Ocena techniczna:', margin, yPosition)
      yPosition += 5
      pdf.setFont('Roboto', 'normal')
      const lines = pdf.splitTextToSize(
        inspection.overall_assessment,
        pageWidth - margin * 2
      )
      pdf.text(lines, margin, yPosition)
      yPosition += lines.length * 4 + 3
    }

    // Hazard information
    if (inspection.hazard_information) {
      if (yPosition > pageHeight - 30) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.setFont('Roboto', 'bold')
      pdf.setTextColor(220, 53, 69)
      pdf.text('Informacja o zagrożeniach:', margin, yPosition)
      yPosition += 5
      pdf.setFont('Roboto', 'normal')
      pdf.setTextColor(0)
      const lines = pdf.splitTextToSize(
        inspection.hazard_information,
        pageWidth - margin * 2
      )
      pdf.text(lines, margin, yPosition)
      yPosition += lines.length * 4 + 3
    }

    // Next inspection dates
    addSection('Zalecane terminy następnych kontroli')
    if (inspection.next_annual_date) {
      addRow(
        'Następna kontrola roczna',
        format(new Date(inspection.next_annual_date), 'dd MMMM yyyy', {
          locale: pl,
        })
      )
    }
    if (inspection.next_five_year_date) {
      addRow(
        'Następna kontrola pięcioletnia',
        format(new Date(inspection.next_five_year_date), 'dd MMMM yyyy', {
          locale: pl,
        })
      )
    }
    if (inspection.next_electrical_date) {
      addRow(
        'Następna kontrola instalacji elektrycznej',
        format(new Date(inspection.next_electrical_date), 'dd MMMM yyyy', {
          locale: pl,
        })
      )
    }

    // Signatures
    addSection('Podpisy')
    if (yPosition > pageHeight - 50) {
      pdf.addPage()
      yPosition = margin
    }

    yPosition += 10
    pdf.line(margin, yPosition, margin + 50, yPosition)
    yPosition += 2
    pdf.setFont('Roboto', 'normal')
    pdf.text('Podpis inspektora', margin, yPosition)
    yPosition += 12

    pdf.line(margin + 70, yPosition - 12, margin + 120, yPosition - 12)
    pdf.text('Podpis reprezentanta właściciela', margin + 70, yPosition)

    if (
      (inspection as any).inspector_signature_location ||
      (inspection as any).inspector_signature_date
    ) {
      yPosition += 15
      const sigInfo = []
      if ((inspection as any).inspector_signature_location) {
        sigInfo.push((inspection as any).inspector_signature_location)
      }
      if ((inspection as any).inspector_signature_date) {
        sigInfo.push(
          format(
            new Date((inspection as any).inspector_signature_date),
            'dd.MM.yyyy',
            { locale: pl }
          )
        )
      }
      pdf.setFontSize(9)
      pdf.text(sigInfo.join(', '), margin, yPosition)
    }

    // Add header to pages 2+
    const totalPages = pdf.getNumberOfPages()
    for (let i = 2; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFont('Roboto', 'normal')
      pdf.setFontSize(FONT_PT.small)
      pdf.setTextColor(...RGB.graphite500)
      const headerLeft = `PROTOKÓŁ NR ${protocolNumber} z dnia ${inspectionDate} — ${typeLabel}`
      pdf.text(headerLeft, margin, 8)
      pdf.text(`Strona ${i} z ${totalPages}`, pageWidth - margin, 8, { align: 'right' })
      pdf.setDrawColor(...RGB.graphite200)
      pdf.setLineWidth(0.3)
      pdf.line(margin, 10, pageWidth - margin, 10)
      pdf.setTextColor(0)
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.2)
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=protokol-${inspection.protocol_number || inspectionId}.pdf`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response('Blad podczas generowania PDF', { status: 500 })
  }
}
