/**
 * Logika "zamrożonych" protokołów. Inspekcja w statusie `signed` jest
 * read-only — protokół został podpisany i przekazany klientowi (np. przez
 * c-kob), wszelkie nasze aktualizacje (auto-fill, carry-over, debounced
 * save) muszą respektować tę zasadę.
 *
 * Zasada przyjęta 2026-05-13 (Waldek). Patrz: docs/propozycje-sesji.md
 * temat „Freeze podpisanych protokołów".
 *
 * Status `completed` to etap „gotowe do podpisu, jeszcze edytowalne" —
 * NIE jest zablokowany. Lock zapada dopiero przy przejściu na `signed`.
 */

export type InspectionStatus =
  | 'draft'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'signed'

/**
 * Czy edycja danych inspekcji jest zablokowana?
 * Tylko `signed` (podpisana) — wszystkie inne statusy są edytowalne.
 */
export function isInspectionLocked(
  status: InspectionStatus | string | null | undefined
): boolean {
  return status === 'signed'
}

/**
 * Tekst banneru wyświetlanego na karcie zablokowanej inspekcji.
 * Wskazuje JAK odblokować — żeby user nie utknął.
 */
export const LOCKED_BANNER_TITLE = 'Protokół podpisany — edycja zablokowana'

export const LOCKED_BANNER_BODY =
  'Ten protokół ma status „Podpisany" i został przekazany klientowi. Edycja danych jest wyłączona, żeby nie ruszać wersji wysłanej. Aby cokolwiek zmienić, najpierw zmień status na „W trakcie" lub „Roboczy" w pasku statusu u góry.'
