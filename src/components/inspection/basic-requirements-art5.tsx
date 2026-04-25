'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  BASIC_REQUIREMENTS_ART5,
  REQUIREMENT_MET_OPTIONS,
} from '@/lib/constants'

/**
 * PIIB sekcja VI (TYLKO 5-letni) — Wymagania podstawowe wg art. 5 ustawy
 * Prawo budowlane.
 *
 * 7 preset rows (BASIC_REQUIREMENTS_ART5) — auto-create przy pierwszym
 * otwarciu jeśli baza jest pusta dla tej inspekcji. Inspektor tylko zaznacza
 * Spełnia / Nie spełnia / Nie dotyczy + opcjonalnie uwagi.
 *
 * Komponent renderuje się TYLKO dla `inspection_type === 'five_year'` —
 * caller jest odpowiedzialny za warunek widoczności.
 *
 * CRUD na tabeli `basic_requirements_art5`. Auto-save 800ms na blur.
 */

interface Art5Row {
  id: string
  inspection_id: string
  requirement_code: string
  requirement_label: string
  is_met: 'spelnia' | 'nie_spelnia' | 'nie_dotyczy' | null
  remarks: string | null
}

interface BasicRequirementsArt5Props {
  inspectionId: string
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

export function BasicRequirementsArt5({
  inspectionId,
}: BasicRequirementsArt5Props) {
  const [rows, setRows] = useState<Art5Row[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    void loadRows()
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const loadRows = async () => {
    try {
      const sb = supabase()
      const { data, error } = await sb
        .from('basic_requirements_art5')
        .select('*')
        .eq('inspection_id', inspectionId)

      if (error) throw error

      if (!data || data.length === 0) {
        // Auto-create 7 preset rows
        const toInsert = BASIC_REQUIREMENTS_ART5.map((r) => ({
          inspection_id: inspectionId,
          requirement_code: r.code,
          requirement_label: r.label,
          is_met: null,
          remarks: null,
        }))

        const { data: inserted, error: insertErr } = await sb
          .from('basic_requirements_art5')
          .insert(toInsert)
          .select()

        if (insertErr) throw insertErr
        setRows(((inserted as Art5Row[]) || []).sort(sortByCode))
      } else {
        setRows((data as Art5Row[]).sort(sortByCode))
      }
    } catch (err) {
      console.error('Błąd ładowania wymagań art. 5 PB:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = (
    id: string,
    field: 'is_met' | 'remarks',
    value: string | null
  ) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              [field]:
                field === 'is_met'
                  ? (value as Art5Row['is_met'])
                  : value || null,
            }
          : r
      )
    )

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase()
          .from('basic_requirements_art5')
          .update({ [field]: value || null })
          .eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zapisu wymagania:', err)
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl border-graphite-200">
        <CardContent className="py-8 text-center text-graphite-500">
          Ładowanie wymagań art. 5 PB…
        </CardContent>
      </Card>
    )
  }

  const metBadgeClass: Record<string, string> = {
    spelnia: 'bg-success-100 text-success-800',
    nie_spelnia: 'bg-danger-100 text-danger-800',
    nie_dotyczy: 'bg-graphite-100 text-graphite-700',
  }

  return (
    <Card className="rounded-xl border-graphite-200">
      <CardHeader>
        <CardTitle className="text-lg">
          Wymagania podstawowe (art. 5 Prawa Budowlanego)
        </CardTitle>
        <p className="text-sm text-graphite-500 font-normal">
          Ocena spełnienia 7 wymagań podstawowych z art. 5 ustawy Prawo
          Budowlane. Sekcja obowiązkowa dla kontroli 5-letniej (art. 62 ust. 1
          pkt 2 PB).
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-12 gap-3 items-start rounded-xl border border-graphite-200 p-3 shadow-xs hover:bg-graphite-50"
            >
              <div className="col-span-5">
                <p className="font-medium text-sm text-graphite-800">
                  {row.requirement_label}
                </p>
                <p className="text-xs text-graphite-400 font-mono mt-0.5">
                  {row.requirement_code}
                </p>
              </div>
              <div className="col-span-3 space-y-1">
                <Label
                  htmlFor={`met-${row.id}`}
                  className="text-xs text-graphite-500"
                >
                  Ocena
                </Label>
                <Select
                  value={row.is_met || 'none'}
                  onValueChange={(val) =>
                    handleUpdate(row.id, 'is_met', val === 'none' ? null : val)
                  }
                >
                  <SelectTrigger id={`met-${row.id}`}>
                    <SelectValue placeholder="Wybierz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nie określono —</SelectItem>
                    {REQUIREMENT_MET_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {row.is_met && (
                  <Badge
                    className={`${metBadgeClass[row.is_met]} mt-1 border-0 text-xs`}
                  >
                    {
                      REQUIREMENT_MET_OPTIONS.find(
                        (o) => o.value === row.is_met
                      )?.label
                    }
                  </Badge>
                )}
              </div>
              <div className="col-span-4 space-y-1">
                <Label
                  htmlFor={`remarks-${row.id}`}
                  className="text-xs text-graphite-500"
                >
                  Komentarz / uzasadnienie
                </Label>
                <Input
                  id={`remarks-${row.id}`}
                  value={row.remarks || ''}
                  onChange={(e) =>
                    handleUpdate(row.id, 'remarks', e.target.value)
                  }
                  placeholder="Opcjonalne uzasadnienie oceny…"
                />
              </div>
            </li>
          ))}
        </ul>

        {isSaving && (
          <p className="mt-3 text-xs text-graphite-400 text-right">
            Zapisywanie…
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Sort wg kolejności w BASIC_REQUIREMENTS_ART5 (definicja w constants.ts). */
function sortByCode(a: Art5Row, b: Art5Row): number {
  const order = BASIC_REQUIREMENTS_ART5.map((r) => r.code)
  return order.indexOf(a.requirement_code) - order.indexOf(b.requirement_code)
}
