// Status constants for inspections
export const INSPECTION_STATUS = {
  draft: { label: "Szkic", color: "bg-graphite-100 text-graphite-800" },
  in_progress: { label: "W toku", color: "bg-info-100 text-info-800" },
  completed: { label: "Zakończona", color: "bg-success-100 text-success-800" },
  archived: { label: "Zarchiwizowana", color: "bg-graphite-100 text-graphite-800" },
} as const;

// Urgency levels for repair recommendations
export const URGENCY_LEVEL = {
  low: { label: "Niska", color: "bg-info-100 text-info-800" },
  medium: { label: "Średnia", color: "bg-warning-100 text-warning-800" },
  high: { label: "Wysoka", color: "bg-danger-100 text-danger-800" },
  critical: { label: "Krytyczna", color: "bg-danger-100 text-danger-800 font-semibold" },
} as const;

// Inspection types array for selects
export const INSPECTION_TYPES = [
  { value: 'annual', label: 'Roczna' },
  { value: 'five_year', label: 'Pięcioletnia' },
] as const;

// Inspection statuses array for selects and display
export const INSPECTION_STATUSES = [
  { value: 'draft', label: 'Szkic' },
  { value: 'in_progress', label: 'W toku' },
  { value: 'review', label: 'Do przeglądu' },
  { value: 'completed', label: 'Zakończona' },
  { value: 'signed', label: 'Podpisana' },
] as const;

// Status badge CSS classes keyed by status value
export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-graphite-100 text-graphite-800',
  in_progress: 'bg-info-100 text-info-800',
  review: 'bg-warning-100 text-warning-800',
  completed: 'bg-success-100 text-success-800',
  signed: 'bg-primary-100 text-primary-700',
};

// ----------------------------------------------------------------------------
// Oceny stanu technicznego — wg PIIB (Załącznik do uchwały nr PIIB/KR/0051/2024)
//
// Po migracji 2026-04-25 skala zredukowana z 5 do 4 stopni:
//   dobry / dostateczny / niedostateczny / awaryjny
//
// Stare wartości (zadowalajacy/sredni/zly) zachowane w typie i mapowaniu dla
// kompatybilności wstecz — w bazie zostały już przemapowane (zadowalajacy→
// dobry, sredni→dostateczny, zly→niedostateczny). Jeśli jakaś stara inspekcja
// ma którąś z nich — UI ją renderuje, ale formularze do edycji oferują tylko
// 4 wartości aktywne.
// ----------------------------------------------------------------------------

/** Lista 4 aktywnych ocen do selektorów / przycisków toggle w UI. */
export const CONDITION_RATINGS_ACTIVE = [
  { value: 'dobry', label: 'Dobry', description: 'Element nie zagraża bezpieczeństwu życia i mienia przez okres najbliższych 5 lat, pod warunkiem wykonywania prac konserwacyjnych.' },
  { value: 'dostateczny', label: 'Dostateczny', description: 'Element przed upływem 5 lat może ulec technicznemu zużyciu; określono termin kolejnego przeglądu / opinii / robót.' },
  { value: 'niedostateczny', label: 'Niedostateczny', description: 'Konieczne podjęcie czynności remontowych i zabezpieczeniowych; określenie „awaryjny" byłoby nieodpowiednie.' },
  { value: 'awaryjny', label: 'Awaryjny', description: 'Wymaga natychmiastowego podjęcia czynności remontowych i zabezpieczających.' },
] as const;

/** Mapping wszystkich możliwych wartości (PIIB + legacy) na polskie etykiety. */
export const CONDITION_RATINGS: Record<string, string> = {
  // Aktywne (PIIB):
  dobry: 'Dobry',
  dostateczny: 'Dostateczny',
  niedostateczny: 'Niedostateczny',
  awaryjny: 'Awaryjny',
  // Legacy (rzadko, sprzed migracji 2026-04-25):
  zadowalajacy: 'Zadowalający',
  sredni: 'Średni',
  zly: 'Zły',
};

/**
 * Mapowanie wartości legacy → nowe PIIB (zgodne z migracją bazy 2026-04-25).
 * Używaj tej funkcji gdy chcesz pokazać stary rekord z PIIB-spójną semantyką.
 */
export const LEGACY_TO_PIIB_RATING: Record<string, string> = {
  zadowalajacy: 'dobry',
  sredni: 'dostateczny',
  zly: 'niedostateczny',
};

/** Czy dana wartość oceny jest aktywna (wybieralna w UI). */
export function isActiveRating(value: string | null | undefined): boolean {
  return value === 'dobry' || value === 'dostateczny' || value === 'niedostateczny' || value === 'awaryjny';
}

/** Klasy Tailwind dla badge-y oceny. Spójne z `protocol-tokens.ts`. */
export const CONDITION_COLORS: Record<string, { bg: string; text: string }> = {
  // Aktywne (PIIB):
  dobry: { bg: 'bg-success-100', text: 'text-success-800' },
  dostateczny: { bg: 'bg-info-100', text: 'text-info-800' },
  niedostateczny: { bg: 'bg-warning-100', text: 'text-warning-800' },
  awaryjny: { bg: 'bg-danger-100', text: 'text-danger-800' },
  // Legacy (zachowane oryginalne kolory):
  zadowalajacy: { bg: 'bg-info-100', text: 'text-info-800' },
  sredni: { bg: 'bg-warning-100', text: 'text-warning-800' },
  zly: { bg: 'bg-orange-100', text: 'text-orange-800' },
};

// ----------------------------------------------------------------------------
// Przydatność do użytkowania (PIIB sekcja III, tylko 5-letni)
// ----------------------------------------------------------------------------

export const USAGE_SUITABILITY = [
  { value: 'spelnia', label: 'Spełnia' },
  { value: 'nie_spelnia', label: 'Nie spełnia' },
] as const;

// ----------------------------------------------------------------------------
// Stopień wykonania zaleceń z poprzedniej kontroli (PIIB sekcja II)
// ----------------------------------------------------------------------------

export const COMPLETION_STATUSES = [
  { value: 'tak', label: 'Tak' },
  { value: 'nie', label: 'Nie' },
  { value: 'w_trakcie', label: 'W trakcie' },
] as const;

// ----------------------------------------------------------------------------
// Wymagania podstawowe wg art. 5 PB (PIIB sekcja VI, tylko 5-letni)
// 7 wymagań z protokołu 5-letniego PIIB — preset rows do basic_requirements_art5.
// ----------------------------------------------------------------------------

export const BASIC_REQUIREMENTS_ART5 = [
  { code: 'bezp_konstrukcji', label: 'Bezpieczeństwo konstrukcji' },
  { code: 'bezp_uzytkowania', label: 'Bezpieczeństwo użytkowania i dostępność' },
  { code: 'bezp_pozar', label: 'Bezpieczeństwo pożarowe' },
  { code: 'walory_uzytkowe', label: 'Walory użytkowe (przydatność do użytkowania)' },
  { code: 'ochr_srodowiska', label: 'Ochrona środowiska i oddziaływanie obiektu na otoczenie' },
  { code: 'higiena_zdrowie', label: 'Higiena, zdrowie i środowisko' },
  { code: 'estetyka', label: 'Estetyka obiektu i jego otoczenia' },
] as const;

export const REQUIREMENT_MET_OPTIONS = [
  { value: 'spelnia', label: 'Spełnione' },
  { value: 'nie_spelnia', label: 'Niespełnione' },
  { value: 'nie_dotyczy', label: 'Nie dotyczy' },
] as const;
