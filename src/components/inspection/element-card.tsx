'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { CONDITION_COLORS, CONDITION_RATINGS } from '@/lib/constants'
import { RatingBadge } from './rating-badge'

interface InspectionElement {
  id: string
  element_number: number
  condition_rating: 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny' | null
  wear_percentage: number
  notes: string | null
  recommendations: string | null
  photo_numbers: string | null
  detailed_description: string | null
  not_applicable: boolean
}

interface ElementDefinition {
  id: string
  name_pl: string
  scope_annual: string | null
  scope_five_year_additional: string | null
}

interface ElementCardProps {
  element: InspectionElement & { definition: ElementDefinition }
  onUpdate: (data: Partial<InspectionElement>) => void
}

export function ElementCard({ element, onUpdate }: ElementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isScopeExpanded, setIsScopeExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleFieldChange = (field: keyof InspectionElement, value: any) => {
    setIsLoading(true)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      onUpdate({ [field]: value })
      setIsLoading(false)
    }, 800)
  }

  const handleNotApplicableChange = (checked: boolean) => {
    handleFieldChange('not_applicable', checked)
  }

  const hasScope = element.definition.scope_annual || element.definition.scope_five_year_additional

  return (
    <Card
      className={`transition-opacity rounded-xl border-graphite-200 ${
        element.not_applicable ? 'opacity-60 bg-graphite-50' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-sm font-semibold text-graphite-500">
                {element.element_number}.
              </span>
              <span>{element.definition.name_pl}</span>
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <RatingBadge rating={element.condition_rating} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-5">
          {/* Nie dotyczy Checkbox */}
          <div className="flex items-center gap-3 pb-4 border-b">
            <Checkbox
              id={`not-applicable-${element.id}`}
              checked={element.not_applicable}
              onCheckedChange={handleNotApplicableChange}
              disabled={isLoading}
            />
            <Label
              htmlFor={`not-applicable-${element.id}`}
              className="text-sm font-medium cursor-pointer"
            >
              Nie dotyczy
            </Label>
          </div>

          {element.not_applicable ? (
            <div className="text-sm text-graphite-500 py-4">
              Element oznaczony jako nie dotyczący. Pozostałe pola są wyłączone.
            </div>
          ) : (
            <>
              {/* Scope Section */}
              {hasScope && (
                <div className="border border-primary-100 rounded-xl p-3 bg-primary-50">
                  <button
                    onClick={() => setIsScopeExpanded(!isScopeExpanded)}
                    className="flex items-center gap-2 w-full font-medium text-sm text-primary-900 hover:text-primary-700 transition"
                  >
                    {isScopeExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Zakres kontroli
                  </button>
                  {isScopeExpanded && (
                    <div className="mt-3 space-y-2 text-sm text-primary-800">
                      {element.definition.scope_annual && (
                        <div>
                          <p className="font-medium mb-1">Co roku:</p>
                          <p className="text-primary-700">
                            {element.definition.scope_annual}
                          </p>
                        </div>
                      )}
                      {element.definition.scope_five_year_additional && (
                        <div>
                          <p className="font-medium mb-1">Co 5 lat (dodatkowe):</p>
                          <p className="text-primary-700">
                            {element.definition.scope_five_year_additional}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Condition Rating */}
              <div className="space-y-2">
                <Label htmlFor={`condition-${element.id}`} className="font-medium">
                  Ocena stanu
                </Label>
                <Select
                  value={element.condition_rating || 'none'}
                  onValueChange={(val) =>
                    handleFieldChange(
                      'condition_rating',
                      val === 'none' ? null : (val as InspectionElement['condition_rating'])
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id={`condition-${element.id}`}>
                    <SelectValue placeholder="Wybierz ocenę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— brak oceny —</SelectItem>
                    {Object.entries(CONDITION_RATINGS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Wear Percentage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`wear-${element.id}`} className="font-medium">
                    Zużycie (%)
                  </Label>
                  <span className="font-mono text-sm font-semibold text-graphite-800">
                    {element.wear_percentage}%
                  </span>
                </div>
                <Slider
                  id={`wear-${element.id}`}
                  min={0}
                  max={100}
                  step={1}
                  value={[element.wear_percentage]}
                  onValueChange={(val) =>
                    handleFieldChange('wear_percentage', val[0])
                  }
                  disabled={isLoading}
                  className="w-full"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor={`notes-${element.id}`} className="font-medium">
                  Uwagi
                </Label>
                <Textarea
                  id={`notes-${element.id}`}
                  placeholder="Dodaj uwagi dotyczące tego elementu..."
                  value={element.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <Label htmlFor={`recommendations-${element.id}`} className="font-medium">
                  Zalecenia
                </Label>
                <Textarea
                  id={`recommendations-${element.id}`}
                  placeholder="Zalecenia dotyczące naprawy lub konserwacji..."
                  value={element.recommendations || ''}
                  onChange={(e) =>
                    handleFieldChange('recommendations', e.target.value)
                  }
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              {/* Photo Numbers */}
              <div className="space-y-2">
                <Label htmlFor={`photos-${element.id}`} className="font-medium">
                  Numery zdjęć
                </Label>
                <Input
                  id={`photos-${element.id}`}
                  placeholder="np. 5, 6, 7"
                  value={element.photo_numbers || ''}
                  onChange={(e) =>
                    handleFieldChange('photo_numbers', e.target.value)
                  }
                  disabled={isLoading}
                />
              </div>

              {/* Detailed Description */}
              <div className="space-y-2">
                <Label htmlFor={`description-${element.id}`} className="font-medium">
                  Opis szczegółowy
                </Label>
                <Textarea
                  id={`description-${element.id}`}
                  placeholder="Szczegółowy opis stanu elementu..."
                  value={element.detailed_description || ''}
                  onChange={(e) =>
                    handleFieldChange('detailed_description', e.target.value)
                  }
                  disabled={isLoading}
                  rows={4}
                />
              </div>
            </>
          )}

          {isLoading && (
            <div className="text-xs text-graphite-400 text-right">
              Zapisywanie...
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
