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
