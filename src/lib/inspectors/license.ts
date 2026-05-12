/**
 * Helpery rozpoznawania czy inspektor ma realne uprawnienia budowlane PIIB.
 *
 * Tabela `inspectors.license_number` w praktyce zawiera trzy rodzaje wartości:
 *   1. Realny numer uprawnień, np. "KUP/0244/PWBKb/21", "WKP/0225/OWOE/23"
 *   2. NULL — brak uprawnień (Andrzej dawniej tak był)
 *   3. Placeholder typu "-" / "—" / "n/a" wpisany przy edycji rekordu
 *      gdy inspektor branżowy (SEP/GWO) nie ma PIIB
 *
 * Rozdział sygnariusze (PIIB) vs branżowi (SEP/GWO) — generator protokołów
 * filtruje `signingInspectors` po `hasValidLicense`. Bez rejekcji placeholdera
 * Andrzej Wlazło (`license_number = "-"`, GWO set) trafiał do pola
 * "Wykonawca KONTROLI" w protokole (audyt 2026-05-12, EW Kamlarki).
 *
 * Patrz `project_inspector_signatories.md` w memory.
 */

const PLACEHOLDERS = new Set(['', '-', '—', '–', 'n/a', 'n.d.', 'brak'])

export function hasValidLicense(
  licenseNumber: string | null | undefined,
): boolean {
  if (!licenseNumber) return false
  const trimmed = licenseNumber.trim().toLowerCase()
  return !PLACEHOLDERS.has(trimmed)
}
