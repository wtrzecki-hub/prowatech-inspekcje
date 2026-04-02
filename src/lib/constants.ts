// Status constants for inspections
export const INSPECTION_STATUS = {
  draft: { label: "Szkic", color: "bg-gray-100 text-gray-800" },
  in_progress: { label: "W toku", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Zakończona", color: "bg-green-100 text-green-800" },
  archived: { label: "Zarchiwizowana", color: "bg-gray-200 text-gray-700" },
} as const;

// Urgency levels for repair recommendations
export const URGENCY_LEVEL = {
  low: { label: "Niska", color: "bg-blue-100 text-blue-800" },
  medium: { label: "Średnia", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "Wysoka", color: "bg-red-100 text-red-800" },
  critical: { label: "Krytyczna", color: "bg-red-200 text-red-900" },
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
  draft: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  signed: 'bg-emerald-100 text-emerald-800',
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
  dobry: { bg: 'bg-green-100', text: 'text-green-800' },
  zadowalajacy: { bg: 'bg-blue-100', text: 'text-blue-800' },
  sredni: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  zly: { bg: 'bg-orange-100', text: 'text-orange-800' },
  awaryjny: { bg: 'bg-red-100', text: 'text-red-800' },
};
