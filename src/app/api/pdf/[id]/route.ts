import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

// jsPDF (helvetica) nie obsługuje polskich znaków — transliteracja jako fallback
const normPl = (text: string): string =>
  (text || '')
    .replace(/ą/g, 'a').replace(/Ą/g, 'A')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/ę/g, 'e').replace(/Ę/g, 'E')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ń/g, 'n').replace(/Ń/g, 'N')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ś/g, 's').replace(/Ś/g, 'S')
    .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
    .replace(/ż/g, 'z').replace(/Ż/g, 'Z')

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

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    let yPosition = margin

    // Helper functions
    const addSection = (title: string) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text(normPl(title), margin, yPosition)
      yPosition += 8
      pdf.setDrawColor(100)
      pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
      yPosition += 4
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
    }

    const addRow = (label: string, value: string, lineHeight = 5) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.setFont('helvetica', 'bold')
      pdf.text(normPl(label) + ':', margin, yPosition)
      pdf.setFont('helvetica', 'normal')
      const textWidth = pageWidth - margin * 2 - 60
      const lines = pdf.splitTextToSize(normPl(value), textWidth)
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
        head: [headers.map(normPl)],
        body: rows.map((row) =>
          row.map((cell) => (typeof cell === 'string' ? normPl(cell) : cell))
        ),
        startY: yPosition,
        margin: margin,
        columnStyles: {},
        styles: {
          fontSize: 9,
          cellPadding: 3,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [66, 133, 244],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [242, 242, 242],
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

    // Title
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    const inspectionTypeLabel =
      inspection.inspection_type === 'annual' ? 'ROCZNEJ' : 'PIECIОLETNIEJ'
    pdf.text(`PROTOKOL Z KONTROLI ${inspectionTypeLabel}`, margin, yPosition)
    yPosition += 10

    // Inspection info section
    addSection('Dane inspekcji')
    addRow('Nr protokolu', inspection.protocol_number || 'Brak')
    addRow(
      'Data kontroli',
      format(new Date(inspection.inspection_date), 'dd MMMM yyyy', {
        locale: pl,
      })
    )
    addRow(
      'Typ kontroli',
      inspection.inspection_type === 'annual' ? 'Roczna' : 'Pieciоletnia'
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
      addSection('Dane wlasciciela/zarzadcy')
      addRow('Nazwa podmiotu', client.name || '-')
      if (client.nip) {
        addRow('NIP', client.nip)
      }
      if (client.address) {
        addRow('Adres', client.address)
      }
    }

    // Inspectors info
    addSection('Dane inspektora/inspektorow')
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

    // Elements assessment
    if (elements && elements.length > 0) {
      addSection('Ocena elementow turbiny')
      const ratingLabels: { [key: string]: string } = {
        '1': 'Bdb',
        '2': 'Db',
        '3': 'Dostateczna',
        '4': 'Slaba',
        '5': 'Niedostateczna',
      }

      const elementRows = elements.map((el: any) => [
        el.element_definition?.name_pl || '-',
        el.condition_rating ? (ratingLabels[String(el.condition_rating)] || String(el.condition_rating)) : '-',
        el.notes || '-',
      ])

      addTable(['Element', 'Ocena', 'Uwagi'], elementRows, [80, 30, 50])
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
      addTable(['Parametr', 'Wartosc', 'Jednostka', 'Status'], measurementRows)
    }

    // Repair recommendations
    if (repairs && repairs.length > 0) {
      addSection('Zalecenia naprawcze')
      const repairRows = repairs.map((r: any) => [
        r.urgency_level || '-',
        r.scope_description || '-',
        r.deadline_date
          ? format(new Date(r.deadline_date), 'dd.MM.yyyy', { locale: pl })
          : '-',
      ])
      addTable(['Priorytet', 'Opis naprawy', 'Termin'], repairRows)
    }

    // Overall assessment
    addSection('Wnioski')
    if (inspection.overall_condition_rating) {
      const ratingLabels: { [key: string]: string } = {
        dobry: 'Dobry',
        zadowalajacy: 'Zadowalajacy',
        sredni: 'Sredni',
        zly: 'Zly',
        awaryjny: 'Awaryjny',
      }
      addRow(
        'Ocena ogolna stanu',
        ratingLabels[inspection.overall_condition_rating] ||
          inspection.overall_condition_rating
      )
    }

    if (inspection.overall_assessment) {
      if (yPosition > pageHeight - 30) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.setFont('helvetica', 'bold')
      pdf.text('Ocena techniczna:', margin, yPosition)
      yPosition += 5
      pdf.setFont('helvetica', 'normal')
      const lines = pdf.splitTextToSize(
        normPl(inspection.overall_assessment),
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
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(220, 53, 69)
      pdf.text('Informacja o zagrozeniach:', margin, yPosition)
      yPosition += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0)
      const lines = pdf.splitTextToSize(
        normPl(inspection.hazard_information),
        pageWidth - margin * 2
      )
      pdf.text(lines, margin, yPosition)
      yPosition += lines.length * 4 + 3
    }

    // Next inspection dates
    addSection('Zalecane terminy nastepnych kontroli')
    if (inspection.next_annual_date) {
      addRow(
        'Nastepna kontrola roczna',
        format(new Date(inspection.next_annual_date), 'dd MMMM yyyy', {
          locale: pl,
        })
      )
    }
    if (inspection.next_five_year_date) {
      addRow(
        'Nastepna kontrola pieciоletnia',
        format(new Date(inspection.next_five_year_date), 'dd MMMM yyyy', {
          locale: pl,
        })
      )
    }
    if (inspection.next_electrical_date) {
      addRow(
        'Nastepna kontrola instalacji elektrycznej',
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
    pdf.setFont('helvetica', 'normal')
    pdf.text('Podpis inspektora', margin, yPosition)
    yPosition += 12

    pdf.line(margin + 70, yPosition - 12, margin + 120, yPosition - 12)
    pdf.text('Podpis reprezentanta wlasciciela', margin + 70, yPosition)

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
      pdf.text(normPl(sigInfo.join(', ')), margin, yPosition)
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
