/**
 * Formatowanie certyfikatów branżowych inspektora (GWO, SEP, UDT) do
 * wyświetlenia w metryczce protokołu i sekcji podpisów.
 *
 * Decyzja Waldka 2026-05-13: pod każdym inspektorem (zarówno sygnariusze
 * PIIB jak i branżowi) wyświetlamy ich uprawnienia dodatkowe.
 *
 * Format: lista skrótów w nawiasie, np. `(GWO, SEP, UDT)`. Pomijamy
 * inspektora który nie ma żadnego.
 */

export interface InspectorWithCerts {
  sep_certificate_number?: string | null
  gwo_certificate_number?: string | null
  udt_certificate_number?: string | null
}

/**
 * Zwraca listę skrótów certyfikatów branżowych które ten inspektor posiada.
 * Pomija puste/null. Kolejność stała: GWO → SEP → UDT (kolejność uznana
 * jako naturalna — najczęściej wpisywana w protokołach).
 */
export function getExtraCerts(insp: InspectorWithCerts): string[] {
  const certs: string[] = []
  if (insp.gwo_certificate_number?.trim()) certs.push('GWO')
  if (insp.sep_certificate_number?.trim()) certs.push('SEP')
  if (insp.udt_certificate_number?.trim()) certs.push('UDT')
  return certs
}

/**
 * Sufiks „ (GWO, SEP, UDT)" do doklejenia po imieniu inspektora; pusty
 * string gdy brak certyfikatów (zamiast `()`).
 */
export function formatExtraCertsSuffix(insp: InspectorWithCerts): string {
  const certs = getExtraCerts(insp)
  return certs.length > 0 ? ` (${certs.join(', ')})` : ''
}
