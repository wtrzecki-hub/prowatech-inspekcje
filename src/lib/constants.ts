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

// Condition ratings as a record: key → Polish label
export const CONDITION_RATINGS: Record<string, string> = {
  dobry: 'Dobry',
  zadowalajacy: 'Zadowalający',
  sredni: 'Średni',
  zly: 'Zły',
  awaryjny: 'Awaryjny',
};

// Condition rating badge colours keyed by rating value
export const CONDITION_COLORS: Record<string, { bg: string; text: string }> = {
  dobry: { bg: 'bg-success-100', text: 'text-success-800' },
  zadowalajacy: { bg: 'bg-info-100', text: 'text-info-800' },
  sredni: { bg: 'bg-warning-100', text: 'text-warning-800' },
  zly: { bg: 'bg-orange-100', text: 'text-orange-800' },
  awaryjny: { bg: 'bg-danger-100', text: 'text-danger-800' },
};
