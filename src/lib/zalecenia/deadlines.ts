/**
 * Mapowanie stopnia pilności na termin wykonania zalecenia (zgodnie z
 * konwencją PIIB/WACETOB + legendą z generatora PDF/DOCX):
 *
 *   I  → natychmiast       → inspection_date + 7 dni
 *   II → do 3 miesięcy     → inspection_date + 3 mies.
 *   III → do 12 miesięcy   → inspection_date + 12 mies.
 *   IV  → do 5 lat         → inspection_date + 5 lat
 *
 * Używane przy auto-carry "Nie wykonano" (prev_rec → repair_scope_items)
 * i przy ręcznej zmianie urgency_level w UI repair-scope-table.
 *
 * Reguła: auto-fill TYLKO jeśli deadline_date jest pusty — nie nadpisujemy
 * świadomych edycji inspektora.
 *
 * Uwagi Artura 2026-05-12: "Termin wykonania zalecenia... ustawienie tej daty
 * dla wszystkich (z możliwością edycji)".
 */

export type UrgencyLevel = 'I' | 'II' | 'III' | 'IV'

/**
 * Oblicza deadline (YYYY-MM-DD) z `inspection_date` i `urgency_level`.
 *
 * Zwraca null gdy:
 * - urgency jest null
 * - inspection_date jest null lub niepoprawny
 */
export function computeDeadlineFromUrgency(
  inspectionDate: string | null | undefined,
  urgency: UrgencyLevel | null | undefined,
): string | null {
  if (!urgency || !inspectionDate) return null

  const base = parseIsoDate(inspectionDate)
  if (!base) return null

  const result = new Date(base.getTime())

  // setUTC* (nie set*) — parseIsoDate buduje Date przez Date.UTC, więc
  // musimy operować w UTC end-to-end. Inaczej w TZ z DST (CET/CEST) data
  // przesuwa się o dzień na granicach miesięcy/lat.
  switch (urgency) {
    case 'I':
      result.setUTCDate(result.getUTCDate() + 7)
      break
    case 'II':
      result.setUTCMonth(result.getUTCMonth() + 3)
      break
    case 'III':
      result.setUTCMonth(result.getUTCMonth() + 12)
      break
    case 'IV':
      result.setUTCFullYear(result.getUTCFullYear() + 5)
      break
  }

  return toIsoDate(result)
}

function parseIsoDate(iso: string): Date | null {
  // Akceptujemy "YYYY-MM-DD" lub "YYYY-MM-DDTHH:mm:ssZ" — bierzemy tylko datę.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  // Date.UTC żeby uniknąć efektów TZ przy setMonth/setFullYear na początku miesiąca.
  const ts = Date.UTC(year, month - 1, day)
  return Number.isFinite(ts) ? new Date(ts) : null
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
