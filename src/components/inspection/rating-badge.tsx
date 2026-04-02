'use client'

import { Badge } from '@/components/ui/badge'
import { CONDITION_COLORS, CONDITION_RATINGS } from '@/lib/constants'

interface RatingBadgeProps {
  rating: 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny' | null
}

export function RatingBadge({ rating }: RatingBadgeProps) {
  if (!rating) {
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-800">
        Brak oceny
      </Badge>
    )
  }

  const colors = CONDITION_COLORS[rating as keyof typeof CONDITION_COLORS]
  const label = CONDITION_RATINGS[rating as keyof typeof CONDITION_RATINGS]

  return (
    <Badge
      className={`${colors.bg} ${colors.text} border-0`}
    >
      {label}
    </Badge>
  )
}
