'use client'

import { Badge } from '@/components/ui/badge'
import { CONDITION_COLORS, CONDITION_RATINGS } from '@/lib/constants'

/**
 * Wartości oceny stanu technicznego.
 * Aktywne (PIIB): dobry / dostateczny / niedostateczny / awaryjny
 * Legacy (sprzed migracji 2026-04-25, zachowane dla starych rekordów):
 * zadowalajacy / sredni / zly
 */
export type RatingValue =
  | 'dobry'
  | 'dostateczny'
  | 'niedostateczny'
  | 'awaryjny'
  | 'zadowalajacy'
  | 'sredni'
  | 'zly'

interface RatingBadgeProps {
  rating: RatingValue | null | undefined
}

export function RatingBadge({ rating }: RatingBadgeProps) {
  if (!rating) {
    return (
      <Badge variant="outline" className="bg-graphite-100 text-graphite-800">
        Brak oceny
      </Badge>
    )
  }

  const colors = CONDITION_COLORS[rating] ?? { bg: 'bg-graphite-100', text: 'text-graphite-800' }
  const label = CONDITION_RATINGS[rating] ?? rating

  return (
    <Badge className={`${colors.bg} ${colors.text} border-0`}>
      {label}
    </Badge>
  )
}
