'use client'

/**
 * Bulk-status bar dla list elementów inspekcji.
 *
 * Wzorzec: nad listą elementów pojawia się pasek z przyciskami "Wszystkie = X".
 * Po kliknięciu przycisku ustawiamy daną wartość dla wszystkich elementów które
 * NIE są oznaczone jako "Nie dotyczy". Dla destrukcyjnych operacji (nadpisanie
 * istniejących ocen, wyczyszczenie) pojawia się confirm dialog.
 *
 * Komponent jest generyczny — używamy go zarówno dla `condition_rating` (4 wartości
 * PIIB + clear) jak i `usage_suitability` (Spełnia/Nie spełnia + clear, tylko 5-letnia).
 *
 * Użycie:
 * ```tsx
 * <BulkStatusBar
 *   title="Ustaw ocenę dla wszystkich"
 *   elements={elements}
 *   field="condition_rating"
 *   options={CONDITION_BULK_OPTIONS}
 *   onApplied={(updates) => setElements(prev => mergeUpdates(prev, updates))}
 * />
 * ```
 */

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export interface BulkOption {
  value: string
  label: string
  /** Tailwind klasy tła + tekstu. Zgodne z `CONDITION_COLORS`/`USAGE_COLORS` w `lib/constants.ts`. */
  bg: string
  hoverBg: string
  text: string
}

interface ElementStub {
  id: string
  /** Aktualna wartość pola (może być null = nieoznaczone). */
  value: string | null
  /** Czy element ma być pominięty w bulk update (Nie dotyczy). */
  not_applicable: boolean
}

interface BulkStatusBarProps {
  /** Etykieta nad rzędem przycisków, np. "Ustaw ocenę dla wszystkich". */
  title: string
  /** Krótkie wyjaśnienie pod paskiem (opcjonalne). */
  hint?: string
  /** Lista elementów do bulk-update — z aktualną wartością + flagą `not_applicable`. */
  elements: ElementStub[]
  /** Nazwa kolumny w `inspection_elements` którą aktualizujemy. */
  field: string
  /** Opcje wartości — przyciski do wyrenderowania. Kolejność = kolejność na pasku. */
  options: BulkOption[]
  /** Czy pokazać przycisk "Wyczyść" (ustawia wartość na NULL). Domyślnie true. */
  showClear?: boolean
  /** Callback wywoływany po udanym zapisie do DB — do aktualizacji lokalnego stanu. */
  onApplied: (updates: { id: string; value: string | null }[]) => void
}

type PendingAction = {
  value: string | null
  label: string
}

export function BulkStatusBar({
  title,
  hint,
  elements,
  field,
  options,
  showClear = true,
  onApplied,
}: BulkStatusBarProps) {
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Elementy uwzględniane w bulk update — bez "Nie dotyczy".
  const eligible = elements.filter((el) => !el.not_applicable)
  const rated = eligible.filter((el) => el.value !== null && el.value !== '').length
  const unrated = eligible.length - rated

  // Ukryj pasek jeśli wszystkie elementy są N/D albo lista pusta.
  if (eligible.length === 0) return null

  const requestAction = (value: string | null, label: string) => {
    setError(null)
    // Auto-apply bez dialogu jeśli operacja nie jest destrukcyjna:
    // - rating != null + 0 ocen = wypełnienie pustych pól
    if (value !== null && rated === 0) {
      void apply(value, label, 'overwrite')
      return
    }
    // Reset przy 0 ocenionych = nic do zrobienia
    if (value === null && rated === 0) return
    setPending({ value, label })
  }

  const apply = async (
    value: string | null,
    label: string,
    mode: 'fill' | 'overwrite',
  ) => {
    const targets = eligible.filter((el) =>
      mode === 'overwrite' ? true : el.value === null || el.value === '',
    )
    if (targets.length === 0) {
      setPending(null)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: dbError } = await supabase
        .from('inspection_elements')
        .update({ [field]: value })
        .in(
          'id',
          targets.map((t) => t.id),
        )
      if (dbError) throw dbError
      onApplied(targets.map((t) => ({ id: t.id, value })))
      setPending(null)
    } catch (err) {
      console.error(`[BulkStatusBar] update ${field} failed:`, err)
      setError(
        err instanceof Error
          ? err.message
          : 'Nie udało się zapisać. Spróbuj ponownie.',
      )
    } finally {
      setSaving(false)
    }
    // suppress unused-var warning (label used in dialog header before apply)
    void label
  }

  const isClear = pending?.value === null

  return (
    <>
      <div className="rounded-xl border border-graphite-200 bg-white shadow-xs p-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-graphite-500 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide text-graphite-700">
            {title}
          </span>
          <span className="ml-auto text-xs text-graphite-500 tabular-nums">
            {rated}/{eligible.length} ocenionych
            {unrated > 0 && (
              <>
                {' '}
                · <span className="text-warning-700">{unrated} bez oceny</span>
              </>
            )}
          </span>
        </div>

        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={saving}
              onClick={() => requestAction(opt.value, opt.label)}
              className={`min-h-[52px] rounded-lg ${opt.bg} ${opt.hoverBg} ${opt.text} font-semibold text-sm border border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] px-3`}
            >
              {opt.label}
            </button>
          ))}
          {showClear && (
            <button
              type="button"
              disabled={saving || rated === 0}
              onClick={() => requestAction(null, 'wyczyść')}
              className="min-h-[52px] rounded-lg bg-graphite-100 hover:bg-graphite-200 text-graphite-700 font-semibold text-sm border border-transparent transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-1.5 px-3"
            >
              <X className="h-4 w-4" />
              Wyczyść
            </button>
          )}
        </div>

        {hint && (
          <p className="text-[11px] text-graphite-500 mt-2 leading-snug">
            {hint}
          </p>
        )}
      </div>

      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setPending(null)
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isClear
                ? 'Wyczyścić oceny wszystkich elementów?'
                : `Ustawić "${pending?.label}" dla elementów?`}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                {!isClear && rated > 0 && unrated > 0 && (
                  <p>
                    Masz już <strong>{rated}</strong>{' '}
                    {rated === 1 ? 'oceniony element' : 'ocenionych elementów'} i{' '}
                    <strong>{unrated}</strong> bez oceny. Wybierz, czy zachować
                    dotychczasowe wartości.
                  </p>
                )}
                {!isClear && rated > 0 && unrated === 0 && (
                  <p>
                    Wszystkie <strong>{rated}</strong> elementy są już
                    ocenione. Operacja nadpisze istniejące oceny.
                  </p>
                )}
                {isClear && (
                  <p>
                    Zostanie skasowanych <strong>{rated}</strong>{' '}
                    {rated === 1 ? 'ocena' : 'ocen'}. Tej operacji nie można
                    cofnąć jednym przyciskiem.
                  </p>
                )}
                <p className="text-graphite-500 text-xs">
                  Elementy oznaczone jako „Nie dotyczy” są pomijane.
                </p>
                {error && (
                  <p className="text-danger-700 text-xs font-semibold">
                    {error}
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setPending(null)
                setError(null)
              }}
              disabled={saving}
              className="sm:order-1"
            >
              Anuluj
            </Button>

            {!isClear && rated > 0 && unrated > 0 && (
              <Button
                onClick={() => apply(pending!.value, pending!.label, 'fill')}
                disabled={saving}
                className="sm:order-2"
              >
                {saving ? 'Zapisuję…' : `Wypełnij tylko ${unrated} nieoznaczonych`}
              </Button>
            )}

            <Button
              variant={isClear ? 'danger' : 'default'}
              onClick={() => apply(pending!.value, pending!.label, 'overwrite')}
              disabled={saving}
              className="sm:order-3"
            >
              {saving
                ? 'Zapisuję…'
                : isClear
                  ? `Wyczyść wszystkie (${rated})`
                  : `Nadpisz wszystkie (${eligible.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Predefiniowane opcje
// ---------------------------------------------------------------------------

/** Opcje dla pola `condition_rating` (4 wartości PIIB). */
export const CONDITION_BULK_OPTIONS: BulkOption[] = [
  {
    value: 'dobry',
    label: 'Dobry',
    bg: 'bg-success-100',
    hoverBg: 'hover:bg-success-200',
    text: 'text-success-800',
  },
  {
    value: 'dostateczny',
    label: 'Dostateczny',
    bg: 'bg-info-100',
    hoverBg: 'hover:bg-info-200',
    text: 'text-info-800',
  },
  {
    value: 'niedostateczny',
    label: 'Niedostateczny',
    bg: 'bg-warning-100',
    hoverBg: 'hover:bg-warning-200',
    text: 'text-warning-800',
  },
  {
    value: 'awaryjny',
    label: 'Awaryjny',
    bg: 'bg-danger-100',
    hoverBg: 'hover:bg-danger-200',
    text: 'text-danger-800',
  },
]

/** Opcje dla pola `usage_suitability` (Spełnia/Nie spełnia — tylko 5-letnia). */
export const USAGE_BULK_OPTIONS: BulkOption[] = [
  {
    value: 'spelnia',
    label: 'Spełnia',
    bg: 'bg-success-100',
    hoverBg: 'hover:bg-success-200',
    text: 'text-success-800',
  },
  {
    value: 'nie_spelnia',
    label: 'Nie spełnia',
    bg: 'bg-danger-100',
    hoverBg: 'hover:bg-danger-200',
    text: 'text-danger-800',
  },
]
