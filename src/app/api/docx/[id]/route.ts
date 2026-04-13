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

// A4 dimensions in DXA (twentieths of a point)
const PAGE_WIDTH = 11906
const PAGE_HEIGHT = 16838
const MARGIN = 850 // 15mm

// Column widths in DXA (total usable = 11906 - 2*850 = 10206)
const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN // 10206

// Border helpers
const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
}

const headerBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '2563EB' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '2563EB' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '2563EB' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '2563EB' },
}

function boldCell(text: string, widthDxa: number, shaded = false): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: thinBorder,
    shading: shaded ? { type: ShadingType.CLEAR, color: 'auto', fill: 'D6E4F7' } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, font: 'Arial', size: 20 })],
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
        children: [new TextRun({ text, font: 'Arial', size: 20 })],
      }),
    ],
  })
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563EB' },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        font: 'Arial',
        size: 24,
        color: '1E3A5F',
      }),
    ],
  })
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
          setAll(cookiesToSet: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const inspectionId = params.id

    // Fetch inspection with all relations
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

    // Fetch inspection elements
    const { data: elements } = await supabase
      .from('inspection_elements')
      .select(
        `
        id,
        condition_rating,
        wear_percentage,
        notes,
        element_definition:element_definition_id (
          id,
          name_pl,
          section_code
        )
      `
      )
      .eq('inspection_id', inspectionId)
      .order('id')

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

    const inspectors =
      inspectorRels?.map((item: any) => item.inspector).filter(Boolean) || []

    // Fetch repair recommendations
    const { data: repairs } = await supabase
      .from('repair_recommendations')
      .select('id, scope_description, repair_type, urgency_level, deadline_date, is_completed, element_name')
      .eq('inspection_id', inspectionId)

    // Protocol metadata
    const protocolNumber = inspection.protocol_number || inspectionId
    const inspectionDate = format(
      new Date(inspection.inspection_date),
      'dd.MM.yyyy',
      { locale: pl }
    )
    const typeLabel =
      inspection.inspection_type === 'annual'
        ? 'kontroli okresowej wykonywanej co najmniej raz w roku'
        : 'kontroli okresowej wykonywanej raz na pięć lat'
    const artPoint = inspection.inspection_type === 'annual' ? '1' : '2'

    // Load logo
    let logoBuffer: Buffer | null = null
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo-prowatech.png')
      logoBuffer = fs.readFileSync(logoPath)
    } catch {
      logoBuffer = null
    }

    // ─── COMPANY HEADER TABLE ────────────────────────────────────────────────
    const logoCol = USABLE_WIDTH * 3500 / 10206 // ~3500 DXA for logo side
    const infoCol = USABLE_WIDTH - logoCol       // rest for company info

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
                  altText: { title: 'ProWaTech Logo', description: 'Logo firmy ProWaTech', name: 'logo-prowatech' },
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
                  color: '2563EB',
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

    // ─── SEPARATOR ───────────────────────────────────────────────────────────
    const separator = new Paragraph({
      spacing: { before: 120, after: 120 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: '2563EB' },
      },
      children: [],
    })

    // ─── TITLE BLOCK ─────────────────────────────────────────────────────────
    const titleParagraphs = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({
            text: `PROTOKÓŁ NR ${protocolNumber}`,
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
            text: `z dnia ${inspectionDate}`,
            bold: true,
            font: 'Arial',
            size: 28,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 40 },
        children: [
          new TextRun({
            text: typeLabel,
            bold: true,
            font: 'Arial',
            size: 22,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: `na podstawie art. 62 ust. 1 pkt ${artPoint}`,
            font: 'Arial',
            size: 20,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: 'ustawy Prawo budowlane z dnia 7 lipca 1994 r.',
            font: 'Arial',
            size: 20,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: '(t.j. Dz. U. z 2024 r., poz. 725 z późn. zm.)',
            font: 'Arial',
            size: 18,
          }),
        ],
      }),
    ]

    // ─── SECTION I — DANE OBIEKTU ─────────────────────────────────────────────
    const col1 = Math.floor(USABLE_WIDTH * 0.35)
    const col2 = USABLE_WIDTH - col1

    function dataRow(label: string, value: string): TableRow {
      return new TableRow({
        children: [
          boldCell(label, col1, true),
          dataCell(value || '—', col2),
        ],
      })
    }

    const objectDataTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
        dataRow(
          'Właściciel/Zarządca',
          client?.name || '—'
        ),
        dataRow(
          'Rodzaj obiektu',
          'Turbina wiatrowa'
        ),
        dataRow(
          'Producent i model',
          `${turbine?.manufacturer || ''} ${turbine?.model || ''}`.trim() || '—'
        ),
        dataRow(
          'Moc nominalna',
          turbine?.rated_power_mw ? `${turbine.rated_power_mw} MW` : '—'
        ),
        dataRow(
          'Numer seryjny',
          turbine?.serial_number || '—'
        ),
        dataRow(
          'Kod turbiny',
          turbine?.turbine_code || '—'
        ),
        dataRow(
          'Farma wiatrowa',
          windFarm?.name || '—'
        ),
        dataRow(
          'Adres farmy',
          windFarm?.location_address || turbine?.location_address || '—'
        ),
        dataRow(
          'NIP właściciela',
          client?.nip || '—'
        ),
        dataRow(
          'Adres właściciela',
          client?.address || '—'
        ),
      ],
    })

    // ─── INSPECTORS ──────────────────────────────────────────────────────────
    const inspectorRows: TableRow[] = inspectors.length > 0
      ? inspectors.map((insp: any) =>
          new TableRow({
            children: [
              boldCell(insp.full_name || '—', col1, true),
              dataCell(
                [
                  insp.license_number ? `Nr licencji: ${insp.license_number}` : '',
                  insp.specialty || '',
                ]
                  .filter(Boolean)
                  .join(' | ') || '—',
                col2
              ),
            ],
          })
        )
      : [
          new TableRow({
            children: [
              boldCell('Inspektor', col1, true),
              dataCell('Brak danych', col2),
            ],
          }),
        ]

    const inspectorTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: inspectorRows,
    })

    // ─── PREVIOUS INSPECTION ─────────────────────────────────────────────────
    const prevInspectionTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
        dataRow('Ustalenia poprzedniej kontroli', inspection.notes || '—'),
        dataRow(
          'Stan realizacji zaleceń',
          (repairs || []).filter((r: any) => r.is_completed).length > 0
            ? `Zrealizowano ${(repairs || []).filter((r: any) => r.is_completed).length} z ${(repairs || []).length} zaleceń`
            : (repairs || []).length === 0
            ? 'Brak zaleceń'
            : 'W trakcie realizacji'
        ),
      ],
    })

    // Next inspection date row
    const nextInspDate =
      inspection.inspection_type === 'annual'
        ? inspection.next_annual_date
        : inspection.next_five_year_date
    const nextInspDateTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
        dataRow(
          'Data następnej kontroli',
          nextInspDate
            ? format(new Date(nextInspDate), 'dd.MM.yyyy', { locale: pl })
            : '—'
        ),
      ],
    })

    // ─── SECTION II — ELEMENTS TABLE ─────────────────────────────────────────
    const elColWidths = [
      600,                           // Lp.
      Math.floor(USABLE_WIDTH * 0.42), // Nazwa
      Math.floor(USABLE_WIDTH * 0.25), // Ocena
      USABLE_WIDTH - 600 - Math.floor(USABLE_WIDTH * 0.42) - Math.floor(USABLE_WIDTH * 0.25), // % zużycia
    ]

    const ratingLabels: Record<string, string> = {
      '1': 'Bardzo dobry',
      '2': 'Dobry',
      '3': 'Dostateczny',
      '4': 'Słaby',
      '5': 'Niedostateczny',
    }

    function elHeaderCell(text: string, widthDxa: number): TableCell {
      return new TableCell({
        width: { size: widthDxa, type: WidthType.DXA },
        borders: thinBorder,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: '2563EB' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text, bold: true, font: 'Arial', size: 18, color: 'FFFFFF' }),
            ],
          }),
        ],
      })
    }

    const elementsTableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          elHeaderCell('Lp.', elColWidths[0]),
          elHeaderCell('Nazwa elementu', elColWidths[1]),
          elHeaderCell('Ocena', elColWidths[2]),
          elHeaderCell('% zużycia', elColWidths[3]),
        ],
      }),
      ...((elements || []).map((el: any, idx: number) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: elColWidths[0], type: WidthType.DXA },
              borders: thinBorder,
              shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(idx + 1), font: 'Arial', size: 18 })] })],
            }),
            new TableCell({
              width: { size: elColWidths[1], type: WidthType.DXA },
              borders: thinBorder,
              shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
              children: [new Paragraph({ children: [new TextRun({ text: el.element_definition?.name_pl || '—', font: 'Arial', size: 18 })] })],
            }),
            new TableCell({
              width: { size: elColWidths[2], type: WidthType.DXA },
              borders: thinBorder,
              shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: el.condition_rating ? (ratingLabels[String(el.condition_rating)] || String(el.condition_rating)) : '—', font: 'Arial', size: 18 })] })],
            }),
            new TableCell({
              width: { size: elColWidths[3], type: WidthType.DXA },
              borders: thinBorder,
              shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: el.wear_percentage != null ? `${el.wear_percentage}%` : '—', font: 'Arial', size: 18 })] })],
            }),
          ],
        })
      )),
    ]

    const elementsTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: elementsTableRows,
    })

    // ─── REPAIR RECOMMENDATIONS ───────────────────────────────────────────────
    const repColWidths = [
      500,                            // Lp.
      Math.floor(USABLE_WIDTH * 0.38), // Zakres
      Math.floor(USABLE_WIDTH * 0.18), // Rodzaj
      Math.floor(USABLE_WIDTH * 0.18), // Pilność
      USABLE_WIDTH - 500 - Math.floor(USABLE_WIDTH * 0.38) - Math.floor(USABLE_WIDTH * 0.18) - Math.floor(USABLE_WIDTH * 0.18), // Element
    ]

    let repairsContent: (Table | Paragraph)[]
    if (!repairs || repairs.length === 0) {
      repairsContent = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: 'BRAK ROBÓT REMONTOWYCH',
              bold: true,
              font: 'Arial',
              size: 20,
              color: '16A34A',
            }),
          ],
        }),
      ]
    } else {
      function repHeaderCell(text: string, widthDxa: number): TableCell {
        return new TableCell({
          width: { size: widthDxa, type: WidthType.DXA },
          borders: thinBorder,
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: '2563EB' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text, bold: true, font: 'Arial', size: 18, color: 'FFFFFF' }),
              ],
            }),
          ],
        })
      }

      const repairTableRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            repHeaderCell('Lp.', repColWidths[0]),
            repHeaderCell('Zakres prac', repColWidths[1]),
            repHeaderCell('Rodzaj', repColWidths[2]),
            repHeaderCell('Pilność', repColWidths[3]),
            repHeaderCell('Element', repColWidths[4]),
          ],
        }),
        ...repairs.map((r: any, idx: number) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: repColWidths[0], type: WidthType.DXA },
                borders: thinBorder,
                shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(idx + 1), font: 'Arial', size: 18 })] })],
              }),
              new TableCell({
                width: { size: repColWidths[1], type: WidthType.DXA },
                borders: thinBorder,
                shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text: r.scope_description || '—', font: 'Arial', size: 18 })] })],
              }),
              new TableCell({
                width: { size: repColWidths[2], type: WidthType.DXA },
                borders: thinBorder,
                shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.repair_type || '—', font: 'Arial', size: 18 })] })],
              }),
              new TableCell({
                width: { size: repColWidths[3], type: WidthType.DXA },
                borders: thinBorder,
                shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.urgency_level || '—', font: 'Arial', size: 18 })] })],
              }),
              new TableCell({
                width: { size: repColWidths[4], type: WidthType.DXA },
                borders: thinBorder,
                shading: idx % 2 === 1 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4FB' } : undefined,
                children: [new Paragraph({ children: [new TextRun({ text: r.element_name || '—', font: 'Arial', size: 18 })] })],
              }),
            ],
          })
        ),
      ]

      repairsContent = [
        new Table({
          width: { size: USABLE_WIDTH, type: WidthType.DXA },
          rows: repairTableRows,
        }),
      ]
    }

    // ─── OVERALL ASSESSMENT ───────────────────────────────────────────────────
    const overallRatingLabels: Record<string, string> = {
      dobry: 'Dobry',
      zadowalajacy: 'Zadowalający',
      sredni: 'Średni',
      zly: 'Zły',
      awaryjny: 'Awaryjny',
    }

    const assessmentTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
        dataRow(
          'Ocena ogólna stanu',
          inspection.overall_condition_rating
            ? overallRatingLabels[inspection.overall_condition_rating] || inspection.overall_condition_rating
            : '—'
        ),
        dataRow('Ocena techniczna', inspection.overall_assessment || '—'),
        dataRow(
          'Informacja o zagrożeniach',
          inspection.hazard_information || 'Brak zagrożeń'
        ),
      ],
    })

    // ─── SIGNATURES ───────────────────────────────────────────────────────────
    const sigColW = Math.floor(USABLE_WIDTH / 2)

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
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: sigColW, type: WidthType.DXA },
              borders: noBorder,
              children: [
                new Paragraph({
                  spacing: { before: 800 },
                  border: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                  },
                  children: [
                    new TextRun({ text: 'Inspektor', font: 'Arial', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: inspectors.map((i: any) => i.full_name).join(', ') || '',
                      font: 'Arial',
                      size: 16,
                      italics: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: sigColW, type: WidthType.DXA },
              borders: noBorder,
              children: [
                new Paragraph({
                  spacing: { before: 800 },
                  border: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                  },
                  children: [
                    new TextRun({
                      text: 'Reprezentant właściciela',
                      font: 'Arial',
                      size: 18,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: inspection.owner_representative_name || '',
                      font: 'Arial',
                      size: 16,
                      italics: true,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })

    // ─── HEADER (pages 2+) ────────────────────────────────────────────────────
    const docHeader = new Header({
      children: [
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
          },
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: `PROTOKÓŁ NR ${protocolNumber} z dnia ${inspectionDate} — ${typeLabel}`,
              font: 'Arial',
              size: 16,
              color: '555555',
            }),
          ],
        }),
      ],
    })

    // ─── FOOTER ───────────────────────────────────────────────────────────────
    const docFooter = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
          },
          children: [
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '555555' }),
            new TextRun({ text: ' | Strona', font: 'Arial', size: 16, color: '555555' }),
          ],
        }),
      ],
    })

    // ─── ASSEMBLE DOCUMENT ───────────────────────────────────────────────────
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'bullet-list',
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '\u2022',
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
            run: { bold: true, font: 'Arial', size: 24, color: '1E3A5F' },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: PAGE_WIDTH, height: PAGE_HEIGHT, orientation: PageOrientation.PORTRAIT },
              margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
            },
          },
          headers: { default: docHeader },
          footers: { default: docFooter },
          children: [
            // ── Page 1 ──────────────────────────────────────────────────────
            headerTable,
            separator,
            ...titleParagraphs,

            // CZĘŚĆ I
            sectionHeading('CZĘŚĆ I — DANE OBIEKTU I INSPEKTORA'),
            objectDataTable,

            new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: 'Dane inspektora:', bold: true, font: 'Arial', size: 20 })] }),
            inspectorTable,

            new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: 'Dane dot. ostatniej kontroli:', bold: true, font: 'Arial', size: 20 })] }),
            prevInspectionTable,

            new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: 'Data następnej kontroli:', bold: true, font: 'Arial', size: 20 })] }),
            nextInspDateTable,

            // CZĘŚĆ II
            sectionHeading('CZĘŚĆ II — OCENA ELEMENTÓW BUDOWLANYCH'),
            ...(elements && elements.length > 0
              ? [elementsTable]
              : [new Paragraph({ children: [new TextRun({ text: 'Brak elementów do oceny.', font: 'Arial', size: 20, italics: true })] })]),

            // ZALECENIA
            sectionHeading('ZALECENIA NAPRAWCZE'),
            ...repairsContent,

            // WNIOSKI
            sectionHeading('WNIOSKI I OCENA OGÓLNA'),
            assessmentTable,

            // PODPISY
            sectionHeading('PODPISY'),
            signaturesTable,
          ],
        },
      ],
    })

    const uint8 = await Packer.toBuffer(doc)
    const nodeBuffer = Buffer.from(uint8)

    return new Response(nodeBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="protokol-${inspection.protocol_number || inspectionId}.docx"`,
        'Content-Length': nodeBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating DOCX:', error)
    return new Response('Blad podczas generowania DOCX', { status: 500 })
  }
}
