/**
 * Tokeny projektowe dla protokołów PDF / DOCX.
 *
 * Synchronizacja:
 * - `tailwind.config.ts` (Faza 1 redesignu, 2026-04-23)
 * - `design/prowatech-redesign.md` § 2.2 (paleta), § 3 (strony protokołu)
 * - `design/prowatech-prototype.html` (3 strony A4 z data-context="doc")
 *
 * UWAGA: Logo ProWaTech (`public/logo-prowatech.png`) zostaje bez zmian —
 * decyzja klienta udokumentowana w PROGRESS.md. Paleta i typografia dotyczą
 * tylko warstwy wokół logo (nagłówki, tabele, kodowanie ocen).
 *
 * Format kolorów:
 * - `HEX_*` — ciągi 6 znaków bez `#`, wymagane przez bibliotekę `docx`
 * - `RGB_*` — tuple [r, g, b] 0–255, wymagane przez `jspdf` / `jspdf-autotable`
 */

// ---------------------------------------------------------------------------
// Paleta bazowa — HEX (docx)
// ---------------------------------------------------------------------------

export const HEX = {
  // Brand — zielony ProWaTech
  brand50: 'F0F9F1',
  brand100: 'DCEFE0',
  brand500: '2E9F4A',
  brand600: '259648',
  brand700: '1F7F3A',
  brand800: '114B24',

  // Graphite — neutralna paleta narracyjna
  graphite50: 'F7F9FB',
  graphite100: 'EEF1F5',
  graphite200: 'DDE3EA',
  graphite400: '8D97A4',
  graphite500: '5F6B7A',
  graphite700: '2C3440',
  graphite800: '1B2230',
  graphite900: '0F1520',

  white: 'FFFFFF',
  black: '000000',
} as const

// ---------------------------------------------------------------------------
// Paleta bazowa — RGB (jspdf)
// ---------------------------------------------------------------------------

export const RGB = {
  brand500: [46, 159, 74] as const,
  brand600: [37, 150, 72] as const,
  brand700: [31, 127, 58] as const,
  brand800: [17, 75, 36] as const,

  graphite50: [247, 249, 251] as const,
  graphite100: [238, 241, 245] as const,
  graphite200: [221, 227, 234] as const,
  graphite500: [95, 107, 122] as const,
  graphite800: [27, 34, 48] as const,
  graphite900: [15, 21, 32] as const,

  white: [255, 255, 255] as const,
  black: [0, 0, 0] as const,
}

// ---------------------------------------------------------------------------
// Oceny elementów — color coding sev-1..5
// 1:1 z `design/prowatech-prototype.html` sev-1..sev-5 (§ 3, strona 2).
// ---------------------------------------------------------------------------

export type RatingKey = 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny'

export interface RatingColorHex {
  bg: string
  text: string
  stripe: string
}

export const RATING_COLORS_HEX: Record<RatingKey, RatingColorHex> = {
  dobry: { bg: 'F0F9F1', text: '0A321A', stripe: '2E9F4A' }, // zielony
  zadowalajacy: { bg: 'EFF6FF', text: '0B3A74', stripe: '3B82F6' }, // niebieski
  sredni: { bg: 'FFFBEB', text: '7C2D12', stripe: 'F59E0B' }, // bursztynowy
  zly: { bg: 'FFF4ED', text: '7B341E', stripe: 'EA580C' }, // pomarańczowy
  awaryjny: { bg: 'FEF2F2', text: '7F1D1D', stripe: 'DC2626' }, // czerwony
}

export interface RatingColorRgb {
  bg: readonly [number, number, number]
  text: readonly [number, number, number]
  stripe: readonly [number, number, number]
}

export const RATING_COLORS_RGB: Record<RatingKey, RatingColorRgb> = {
  dobry: { bg: [240, 249, 241], text: [10, 50, 26], stripe: [46, 159, 74] },
  zadowalajacy: { bg: [239, 246, 255], text: [11, 58, 116], stripe: [59, 130, 246] },
  sredni: { bg: [255, 251, 235], text: [124, 45, 18], stripe: [245, 158, 11] },
  zly: { bg: [255, 244, 237], text: [123, 52, 30], stripe: [234, 88, 12] },
  awaryjny: { bg: [254, 242, 242], text: [127, 29, 29], stripe: [220, 38, 38] },
}

// ---------------------------------------------------------------------------
// Pilność zaleceń — pill badges
// Mapowanie z `src/lib/constants.ts` URGENCY_LEVEL + prototyp.
// Klucze: I (krytyczna), II (wysoka), III (średnia), IV (niska).
// ---------------------------------------------------------------------------

export type UrgencyKey = 'I' | 'II' | 'III' | 'IV'

export interface UrgencyColorHex {
  bg: string
  text: string
}

export const URGENCY_COLORS_HEX: Record<UrgencyKey, UrgencyColorHex> = {
  I: { bg: 'FEF2F2', text: '991B1B' }, // danger-50 / danger-800
  II: { bg: 'FEF3C7', text: '92400E' }, // amber-100 / amber-800
  III: { bg: 'F0F9FF', text: '0369A1' }, // info-50 / info-700
  IV: { bg: 'EEF1F5', text: '2C3440' }, // graphite-100 / graphite-700
}

export interface UrgencyColorRgb {
  bg: readonly [number, number, number]
  text: readonly [number, number, number]
}

export const URGENCY_COLORS_RGB: Record<UrgencyKey, UrgencyColorRgb> = {
  I: { bg: [254, 242, 242], text: [153, 27, 27] },
  II: { bg: [254, 243, 199], text: [146, 64, 14] },
  III: { bg: [240, 249, 255], text: [3, 105, 161] },
  IV: { bg: [238, 241, 245], text: [44, 52, 64] },
}

// ---------------------------------------------------------------------------
// Typografia
// ---------------------------------------------------------------------------

/**
 * Rozmiary fontów w DXA (docx) — `size` w TextRun jest w half-points,
 * więc DXA = pt * 2. Np. 22 = 11pt, 18 = 9pt.
 */
export const FONT_DXA = {
  titleHero: 36, // 18pt — PROTOKÓŁ NR X
  title: 28, // 14pt — data, typ
  sectionHeading: 22, // 11pt — Część I / Część II (uppercase tracking)
  body: 20, // 10pt — paragraph body
  tableBody: 18, // 9pt
  tableHeader: 18, // 9pt (bold + uppercase tracking)
  small: 16, // 8pt — header/footer stron 2+
} as const

/**
 * Rozmiary fontów w pt (jspdf).
 */
export const FONT_PT = {
  titleHero: 18,
  title: 14,
  sectionHeading: 11,
  body: 10,
  tableBody: 9,
  tableHeader: 9,
  small: 8,
} as const

/**
 * Character spacing (kerning) dla nagłówków w stylu uppercase tracking-[0.12em].
 * W docx `characterSpacing` jest w 1/20 pt. 0.12em * 9pt ≈ 1.08pt ≈ 22 twips.
 */
export const TRACKING_DXA = 22

// ---------------------------------------------------------------------------
// Labele — re-export z lib/constants dla spójnego mapowania w protokołach
// ---------------------------------------------------------------------------

export const RATING_LABELS: Record<RatingKey, string> = {
  dobry: 'Dobry',
  zadowalajacy: 'Zadowalający',
  sredni: 'Średni',
  zly: 'Zły',
  awaryjny: 'Awaryjny',
}
