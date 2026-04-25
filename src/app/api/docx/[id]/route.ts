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
  type RatingKey,
} from '@/lib/design/protocol-tokens'

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
        turbines (
          id,
          turbine_code,
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
          chamber_certificate_number
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

    // ─── FETCH PIIB TABLES ─────────────────────────────────────────────────
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
    const docs = (insp.documents_reviewed as Record<string, string>) || {}

    // ─── METADATA ──────────────────────────────────────────────────────────
    const protocolNumber = insp.protocol_number || inspectionId.slice(0, 8)
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

    // Embed fotografii obiektu — paragraf przed metaTable (jeśli URL ustawiony i obraz pobrany)
    const objectPhoto = await fetchImageAsBuffer(insp.object_photo_url)
    const objectPhotoParagraphs: Paragraph[] = []
    if (objectPhoto) {
      try {
        objectPhotoParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 60 },
            children: [
              new ImageRun({
                type: objectPhoto.format,
                data: objectPhoto.buffer,
                // ~ 60×45 mm w EMU? docx używa pikseli przy 96 DPI;
                // 60mm ≈ 227px, 45mm ≈ 170px (ale 'Pixels' to nie EMU).
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
        objectPhotoParagraphs.push(
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
        console.error('Nie udało się osadzić obrazu w DOCX:', err)
      }
    }

    const metaTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
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
        metaRow('Właściciel obiektu:', insp.owner_name || client?.name || ''),
        metaRow('Zarządca obiektu budowlanego:', insp.manager_name || ''),
        metaRow(
          'Wykonawca KONTROLI:',
          insp.contractor_info ||
            inspectors
              .map(
                (i: any) =>
                  `${i.full_name || ''}${i.license_number ? ' / ' + i.license_number : ''}${i.specialty ? ' / ' + i.specialty : ''}`
              )
              .join('; ') ||
            ''
        ),
        metaRow('Przy udziale:', insp.additional_participants || ''),
      ],
    })

    // ─── PODSTAWOWE DANE OBIEKTU ───────────────────────────────────────────
    const techTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: [
        metaRow('Rodzaj konstrukcji wieży', turbine?.tower_construction_type || ''),
        metaRow(
          'Producent / model turbiny',
          [turbine?.manufacturer, turbine?.model].filter(Boolean).join(' ') || ''
        ),
        metaRow(
          'Moc znamionowa [MW]',
          turbine?.rated_power_mw ? `${turbine.rated_power_mw}` : ''
        ),
        metaRow(
          'Wysokość wieży H [m]',
          turbine?.tower_height_m ? `${turbine.tower_height_m}` : ''
        ),
        metaRow(
          'Wysokość do osi piasty [m]',
          turbine?.hub_height_m ? `${turbine.hub_height_m}` : ''
        ),
        metaRow(
          'Średnica rotora D [m]',
          turbine?.rotor_diameter_m ? `${turbine.rotor_diameter_m}` : ''
        ),
        metaRow('Nr seryjny turbiny', turbine?.serial_number || ''),
        metaRow(
          'Rok zakończenia budowy',
          turbine?.commissioning_year ? `${turbine.commissioning_year}` : ''
        ),
        metaRow(
          'Nr i data pozwolenia na budowę',
          [
            turbine?.building_permit_number,
            turbine?.building_permit_date
              ? formatDate(turbine.building_permit_date)
              : null,
          ]
            .filter(Boolean)
            .join(' z dnia ') || ''
        ),
        metaRow('Farma wiatrowa', windFarm?.name || ''),
        metaRow(
          'Adres farmy / dz. ewid.',
          windFarm?.location_address || turbine?.location_address || ''
        ),
      ],
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

      const konstrInsp = inspectors.find(
        (i: any) =>
          i.rel_specialty === 'konstrukcyjna' ||
          i.specialty === 'konstrukcyjna'
      )
      const elektrInsp = inspectors.find(
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
    const prevRecsRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Lp.', prevRecsCols[0]),
          headerCell('Zalecenia z poprzedniej kontroli', prevRecsCols[1]),
          headerCell('Stopień wykonania', prevRecsCols[2]),
          headerCell('Realizacja zaleceń — uwagi', prevRecsCols[3]),
        ],
      }),
      ...((prevRecs && prevRecs.length > 0)
        ? prevRecs
        : [1, 2, 3, 4].map((n) => ({
            item_number: n,
            recommendation_text: '',
            completion_status: null,
            remarks: '',
          }))
      ).map(
        (r: any) =>
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
    const prevRecsTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: prevRecsRows,
    })

    // Stan awaryjny
    const emergencyCols = [
      Math.floor(USABLE_WIDTH * 0.06),
      Math.floor(USABLE_WIDTH * 0.34),
      USABLE_WIDTH - Math.floor(USABLE_WIDTH * 0.06) - Math.floor(USABLE_WIDTH * 0.34),
    ]
    const emergencyRows: TableRow[] = [
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
      ...((emergencyItems && emergencyItems.length > 0)
        ? emergencyItems
        : [1, 2, 3, 4].map((n) => ({
            item_number: n,
            element_name: '',
            urgent_repair_scope: '',
          }))
      ).map(
        (e: any) =>
          new TableRow({
            children: [
              dataCell(String(e.item_number), emergencyCols[0]),
              dataCell(e.element_name || '', emergencyCols[1]),
              dataCell(e.urgent_repair_scope || '', emergencyCols[2]),
            ],
          })
      ),
    ]
    const emergencyTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: emergencyRows,
    })

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
            headerCell('OPIS STANU TECHNICZNEGO', colsAN[1]),
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

    // ─── ZALECENIA (Zakres czynności / Termin) ──────────────────────────────
    const repairCols = [
      Math.floor(USABLE_WIDTH * 0.7),
      USABLE_WIDTH - Math.floor(USABLE_WIDTH * 0.7),
    ]
    const repairRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Zakres czynności', repairCols[0]),
          headerCell('Termin wykonania', repairCols[1]),
        ],
      }),
      ...((repairScope && repairScope.length > 0)
        ? repairScope
        : [1, 2, 3, 4, 5].map(() => ({
            scope_description: '',
            deadline_text: '',
            deadline_date: null,
            is_completed: false,
          }))
      ).map(
        (r: any) =>
          new TableRow({
            children: [
              dataCell(r.scope_description || '', repairCols[0]),
              dataCell(
                r.deadline_text ||
                  (r.deadline_date ? formatDate(r.deadline_date) : ''),
                repairCols[1]
              ),
            ],
          })
      ),
    ]
    const repairTable = new Table({
      width: { size: USABLE_WIDTH, type: WidthType.DXA },
      rows: repairRows,
    })

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
      for (const r of art5Items as any[]) {
        art5Rows.push(
          new TableRow({
            children: [
              dataCell(r.requirement_label, art5Cols[0]),
              dataCell(r.is_met ? metLabel[r.is_met] : '', art5Cols[1]),
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

    function signatureCell(label: string, name: string): TableCell {
      return new TableCell({
        width: { size: sigColW, type: WidthType.DXA },
        borders: noBorder,
        children: [
          new Paragraph({
            spacing: { before: 800 },
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
        ],
      })
    }

    const sigRows: TableRow[] = []
    if (isFiveYear) {
      const konstr = inspectors.find(
        (i: any) =>
          i.rel_specialty === 'konstrukcyjna' || i.specialty === 'konstrukcyjna'
      )
      const elektr = inspectors.find(
        (i: any) =>
          i.rel_specialty === 'elektryczna' || i.specialty === 'elektryczna'
      )
      sigRows.push(
        new TableRow({
          children: [
            signatureCell(
              'Branża KONSTRUKCYJNO-BUDOWLANA',
              konstr?.full_name || ''
            ),
            signatureCell('Branża ELEKTRYCZNA', elektr?.full_name || ''),
          ],
        })
      )
    } else {
      sigRows.push(
        new TableRow({
          children: [
            signatureCell(
              'Wykonawca KONTROLI',
              inspectors.map((i: any) => i.full_name).filter(Boolean).join(', ')
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
      ...((attachments && attachments.length > 0)
        ? attachments
        : [1, 2, 3, 4, 5, 6].map((n) => ({ item_number: n, description: '' }))
      ).map(
        (a: any) =>
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
      ...objectPhotoParagraphs,
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

    sectionChildren.push(
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
      subHeading('Ocena realizacji zaleceń z poprzedniej kontroli'),
      prevRecsTable,
      subHeading('Stan awaryjny stwierdzony w wyniku przeglądu'),
      bodyParagraph(
        emergencyItems && emergencyItems.length > 0
          ? 'W wyniku przeglądu technicznego stwierdzam stan awaryjny następujących elementów obiektu:'
          : 'W wyniku przeglądu technicznego nie stwierdzono stanu awaryjnego.'
      ),
      emergencyTable,

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

    sectionChildren.push(
      sectionHeading('V. Informacje o serwisie technicznym turbiny'),
      bodyParagraph(
        'Kontrola połączeń śrubowych, docisku segmentów wieży i czynności techniczne są wykonywane ' +
          'przez certyfikowany serwis (art. 8b ustawy z dnia 20 maja 2016 r. o inwestycjach w zakresie elektrowni wiatrowych).'
      ),
      serviceTable,
      ...(checklistParas.length > 0
        ? [subHeading('Zakres czynności serwisowych'), ...checklistParas]
        : []),

      sectionHeading(
        isFiveYear ? 'VI. Zalecenia' : 'IV. Zalecenia'
      ),
      bodyParagraph('Określenie zakresu robót remontowych i kolejności ich wykonywania:'),
      repairTable
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

    if (art5Section.length > 0) {
      sectionChildren.push(
        sectionHeading('Wymagania podstawowe (art. 5 PB)'),
        ...art5Section
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

      sectionHeading(isFiveYear ? 'VIII. Podpisy' : 'VII. Podpisy'),
      bodyParagraph(
        'Oświadczam, iż ustalenia zawarte w protokole są zgodne ze stanem faktycznym.'
      ),
      signaturesTable,

      subHeading('Załączniki do protokołu'),
      attachmentsTable
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

    return new Response(nodeBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="protokol-PIIB-${(insp.protocol_number || inspectionId).replace(/[\/\\:*?"<>|]/g, '_')}.docx"`,
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
