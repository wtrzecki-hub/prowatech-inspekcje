/**
 * Buduje nazwę pliku protokołu PDF/DOCX zgodną z konwencją archiwum
 * Prowatech, np.:
 *   `003_P_2026 Protokół_kontroli_5-letniej WTG EW03 Żeńsko 04-05-2026.pdf`
 *   `58_T_2025 Protokół_kontroli_rocznej WTG EW01 Bieganowo 16-04-2025.pdf`
 *
 * Komponenty:
 *   - numer protokołu (z `inspections.protocol_number`), `/` zamienione na `_`
 *   - „Protokół_kontroli_rocznej" lub „Protokół_kontroli_5-letniej"
 *   - „WTG " + `ew_designation` (preferowane) albo `turbine_code`
 *   - miejscowość (`turbines.location_address`)
 *   - data kontroli w formacie dd-mm-yyyy
 *
 * Brakujące komponenty są pomijane (np. inspekcja bez `protocol_number`).
 * Niedozwolone znaki w nazwach plików są zamieniane na `_`.
 */
export interface InspectionForFilename {
  protocol_number?: string | null
  inspection_type?: 'annual' | 'five_year' | string | null
  inspection_date?: string | null
}

export interface TurbineForFilename {
  turbine_code?: string | null
  ew_designation?: string | null
  location_address?: string | null
}

const trim = (v: string | null | undefined) => v?.trim() || ''

function formatDateDmy(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

/**
 * Sanityzuje fragment nazwy pliku — usuwa znaki niedozwolone na Windows/macOS/Linux,
 * zwija wielokrotne białe znaki. Diakrytyki polskie zachowane (kodowane w
 * `Content-Disposition` przez `filename*=UTF-8''`).
 */
function sanitizeSegment(s: string): string {
  return s
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildProtocolFilename(
  inspection: InspectionForFilename,
  turbine: TurbineForFilename | null | undefined,
  ext: 'pdf' | 'docx',
  /**
   * @deprecated Parametr ignorowany od 2026-05-12 — zamiast UUID dla drafta
   *   prefix `DRAFT` jest czytelniejszy. Trzymany w sygnaturze dla
   *   backward compat z istniejącymi call sites.
   */
  _fallbackId?: string,
): string {
  const parts: string[] = []

  // 1. Numer protokołu (z `/` → `_`) lub prefix "Szkic" dla inspekcji bez
  // nadanego numeru (status=draft). Wcześniej wstawialiśmy UUID inspekcji
  // jako fallback — to dawało brzydkie nazwy typu
  // `92a0d535-b278-4ee5-848e-624dec707105 Protokół_kontroli_rocznej...`
  // (uwaga Waldka 2026-05-12). Etykieta "Szkic" zgodna z UI listy inspekcji
  // (src/lib/constants.ts: STATUS_LABELS.draft).
  const protoNo = trim(inspection.protocol_number)
  if (protoNo) {
    parts.push(protoNo.replace(/\//g, '_'))
  } else {
    parts.push('Szkic')
  }

  // 2. Typ kontroli
  const typeLabel =
    inspection.inspection_type === 'five_year' ? '5-letniej' : 'rocznej'
  parts.push(`Protokół_kontroli_${typeLabel}`)

  // 3. WTG + identyfikator turbiny
  const turbineId = trim(turbine?.ew_designation) || trim(turbine?.turbine_code)
  if (turbineId) {
    parts.push(`WTG ${turbineId}`)
  }

  // 4. Miejscowość — pomijamy gdy nazwa jest już zawarta w `turbineId`
  // (np. turbina pojedyncza w farmie ma ew_designation="EW Kamlarki",
  // a location_address="Kamlarki" — bez tego strippa wychodziłoby
  // "WTG EW Kamlarki Kamlarki"). Match case-insensitive.
  const loc = trim(turbine?.location_address)
  if (loc && !turbineId.toLowerCase().includes(loc.toLowerCase())) {
    parts.push(loc)
  }

  // 5. Data
  const dateStr = formatDateDmy(inspection.inspection_date)
  if (dateStr) parts.push(dateStr)

  const name = sanitizeSegment(parts.filter(Boolean).join(' '))
  return `${name}.${ext}`
}

/**
 * Buduje nagłówek `Content-Disposition` bezpieczny dla diakrytyk PL.
 * RFC 5987 — fallback ASCII (zamieniony nie-ASCII na `_`) + `filename*=UTF-8''<urlencoded>`
 * dla nowoczesnych przeglądarek.
 */
export function contentDispositionAttachment(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_')
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
