'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, Check, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * PIIB sekcja IV (roczny) / VI (5-letni) — Określenie zakresu robót
 * remontowych i kolejności ich wykonywania.
 *
 * Zastępuje stary `RepairTable` (NG/NB/K + pilność I-IV) prostszym układem PIIB:
 * - Lp
 * - Zakres czynności (TEXT required)
 * - Termin wykonania (text dowolny lub data)
 * - Status wykonania (checkbox + completion_date)
 *
 * CRUD na tabeli `repair_scope_items`. Auto-save 800ms.
 */

interface RepairScopeItem {
  id: string
  inspection_id: string
  item_number: number
  scope_description: string
  deadline_text: string | null
  deadline_date: string | null
  is_completed: boolean
  completion_date: string | null
  completion_notes: string | null
}

interface RepairScopeTableProps {
  inspectionId: string
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

interface ImportInfo {
  /** Ile pozycji zaimportowano w ostatniej operacji. */
  count: number
  /** Skąd: 'elements' = z `inspection_elements.recommendations`,
   *  'legacy' = z `repair_recommendations.scope_description` (stary
   *  formularz nowej inspekcji). */
  source: 'elements' | 'legacy' | 'mixed'
}

export function RepairScopeTable({ inspectionId }: RepairScopeTableProps) {
  const [items, setItems] = useState<RepairScopeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importInfo, setImportInfo] = useState<ImportInfo | null>(null)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const autoImportTriedRef = useRef(false)

  useEffect(() => {
    void loadItemsAndMaybeAutoImport()
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const loadItemsAndMaybeAutoImport = async () => {
    try {
      const { data, error } = await supabase()
        .from('repair_scope_items')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      const loaded = (data || []) as RepairScopeItem[]
      setItems(loaded)

      // Auto-import: pierwszy mount, brak wpisów. Cisza — jeśli znajdzie,
      // wstawia + ustawia banner; jeśli nie znajdzie, zostawia listę pustą
      // bez alertu (user widzi placeholder „Brak pozycji").
      if (!autoImportTriedRef.current && loaded.length === 0) {
        autoImportTriedRef.current = true
        await runImport({ silent: true })
      }
    } catch (err) {
      console.error('Błąd ładowania zakresu robót:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadItems = async () => {
    try {
      const { data, error } = await supabase()
        .from('repair_scope_items')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      setItems((data || []) as RepairScopeItem[])
    } catch (err) {
      console.error('Błąd ładowania zakresu robót:', err)
    }
  }

  /**
   * Zbiera niepuste zalecenia z 2 źródeł i wstawia jako nowe pozycje:
   *   1. inspection_elements.recommendations — pole „Zalecenia" w karcie
   *      każdego elementu (sekcja Ocena).
   *   2. repair_recommendations.scope_description — legacy tabela ze
   *      starego formularza nowej inspekcji.
   *
   * Pomija duplikaty (ten sam tekst już istnieje w repair_scope_items).
   * Zwraca metadata; alert tylko jeśli `silent=false` i nic nie znaleziono.
   */
  const runImport = async (
    options: { silent?: boolean } = {},
  ): Promise<ImportInfo | null> => {
    setIsImporting(true)
    try {
      const sb = supabase()

      // 1. Z elementów inspekcji (sekcja „Zalecenia" w karcie elementu).
      const { data: elementsData } = await sb
        .from('inspection_elements')
        .select(
          `recommendations,
           definition:element_definition_id ( element_number, name_pl )`
        )
        .eq('inspection_id', inspectionId)

      type ElRow = {
        recommendations: string | null
        definition: { element_number: number | null; name_pl: string | null } | null
      }
      const fromElements: string[] = []
      for (const row of (elementsData || []) as unknown as ElRow[]) {
        const rec = row.recommendations?.trim()
        if (!rec) continue
        const num = row.definition?.element_number
        const namePl = row.definition?.name_pl
        const prefix =
          num != null && namePl
            ? `[${num}. ${namePl}] `
            : namePl
              ? `[${namePl}] `
              : ''
        // Każda linia w polu = osobna pozycja (jeśli user listuje punktami).
        const lines = rec
          .split(/\r?\n+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        for (const line of lines) {
          fromElements.push(prefix + line)
        }
      }

      // 2. Legacy repair_recommendations (stary formularz).
      const { data: legacyData } = await sb
        .from('repair_recommendations')
        .select('scope_description, element_name')
        .eq('inspection_id', inspectionId)

      const fromLegacy: string[] = []
      for (const row of (legacyData || []) as Array<{
        scope_description: string | null
        element_name: string | null
      }>) {
        const desc = row.scope_description?.trim()
        if (!desc) continue
        const prefix = row.element_name?.trim() ? `[${row.element_name.trim()}] ` : ''
        fromLegacy.push(prefix + desc)
      }

      // Łączymy + de-duplikat (po samym tekście).
      const seen = new Set<string>()
      const candidates: string[] = []
      for (const t of [...fromElements, ...fromLegacy]) {
        const norm = t.trim()
        if (!norm) continue
        if (seen.has(norm)) continue
        seen.add(norm)
        candidates.push(norm)
      }

      // Pomiń te które już są w repair_scope_items (po opisie).
      const { data: existing } = await sb
        .from('repair_scope_items')
        .select('scope_description')
        .eq('inspection_id', inspectionId)
      const existingSet = new Set(
        ((existing || []) as Array<{ scope_description: string }>).map((e) =>
          (e.scope_description || '').trim(),
        ),
      )
      const fresh = candidates.filter((c) => !existingSet.has(c))

      if (fresh.length === 0) {
        if (!options.silent) {
          alert(
            'Brak nowych zaleceń do zaimportowania. Sprawdź czy w sekcji Ocena (karty elementów) są wypełnione pola „Zalecenia".'
          )
        }
        return null
      }

      // INSERT
      const baseNumber =
        items.length > 0 ? Math.max(...items.map((i) => i.item_number)) : 0
      const toInsert = fresh.map((text, idx) => ({
        inspection_id: inspectionId,
        item_number: baseNumber + idx + 1,
        scope_description: text,
        deadline_text: null,
        deadline_date: null,
        is_completed: false,
      }))
      const { data: inserted, error: insErr } = await sb
        .from('repair_scope_items')
        .insert(toInsert)
        .select()
      if (insErr) throw insErr

      const newItems = (inserted || []) as RepairScopeItem[]
      setItems((prev) => [...prev, ...newItems])

      const source: ImportInfo['source'] =
        fromElements.length > 0 && fromLegacy.length > 0
          ? 'mixed'
          : fromElements.length > 0
            ? 'elements'
            : 'legacy'
      const info: ImportInfo = { count: newItems.length, source }
      setImportInfo(info)
      return info
    } catch (err) {
      console.error('Błąd importu zaleceń:', err)
      if (!options.silent) {
        alert('Nie udało się zaimportować zaleceń. Spróbuj ponownie.')
      }
      return null
    } finally {
      setIsImporting(false)
    }
  }

  const handleAdd = async () => {
    setIsSaving(true)
    try {
      const nextNumber =
        items.length > 0
          ? Math.max(...items.map((i) => i.item_number)) + 1
          : 1

      const { data, error } = await supabase()
        .from('repair_scope_items')
        .insert({
          inspection_id: inspectionId,
          item_number: nextNumber,
          scope_description: '',
          deadline_text: null,
          deadline_date: null,
          is_completed: false,
        })
        .select()
        .single()

      if (error) throw error
      if (data) setItems((prev) => [...prev, data as RepairScopeItem])
    } catch (err) {
      console.error('Błąd dodawania pozycji:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = (
    id: string,
    field: keyof RepairScopeItem,
    value: string | boolean | null
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const updateData: Record<string, unknown> = { [field]: value }

        // Auto-set completion_date gdy is_completed = true
        if (field === 'is_completed') {
          updateData.completion_date = value
            ? new Date().toISOString().slice(0, 10)
            : null
        }

        const { error } = await supabase()
          .from('repair_scope_items')
          .update(updateData)
          .eq('id', id)
        if (error) throw error

        // Sync state for completion_date
        if (field === 'is_completed') {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id
                ? {
                    ...it,
                    completion_date: (updateData.completion_date as string) || null,
                  }
                : it
            )
          )
        }
      } catch (err) {
        console.error('Błąd zapisu:', err)
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const sb = supabase()
      const { error } = await sb
        .from('repair_scope_items')
        .delete()
        .eq('id', id)
      if (error) throw error
      // Auto-renumber po usunięciu — zamknij dziurę po skasowanym wpisie.
      await renumberAll(sb)
    } catch (err) {
      console.error('Błąd usuwania:', err)
      void loadItems()
    }
  }

  /**
   * Renumberuje wszystkie wiersze tego inspection 1..N po rosnącym item_number.
   * `repair_scope_items` to osobna tabela bez source_inspection_type — czyli
   * jedna numeracja per inspekcja. Używane po delete (zamknij dziurę).
   */
  const renumberAll = async (
    sb: ReturnType<typeof createBrowserClient>
  ): Promise<void> => {
    const { data: rows, error } = await sb
      .from('repair_scope_items')
      .select('id, item_number')
      .eq('inspection_id', inspectionId)
      .order('item_number', { ascending: true })

    if (error) {
      console.error('Błąd pobierania do renumeracji:', error)
      return
    }
    if (!rows || rows.length === 0) return

    const list = rows as Array<{ id: string; item_number: number }>
    const updates: Array<{ id: string; to: number }> = []
    list.forEach((row, idx) => {
      const target = idx + 1
      if (row.item_number !== target) {
        updates.push({ id: row.id, to: target })
      }
    })
    if (updates.length === 0) return

    for (const u of updates) {
      const { error: upErr } = await sb
        .from('repair_scope_items')
        .update({ item_number: u.to })
        .eq('id', u.id)
      if (upErr) console.error('Błąd renumeracji wpisu', u.id, upErr)
    }

    setItems((prev) => {
      const map = new Map<string, number>()
      list.forEach((row, idx) => map.set(row.id, idx + 1))
      return prev.map((i) =>
        map.has(i.id) ? { ...i, item_number: map.get(i.id)! } : i
      )
    })
  }

  /** Manual override numeru pozycji — gdy auto-renumber nie zachowuje
   *  pożądanej kolejności. Bez auto-resort, użytkownik decyduje. */
  const handleNumberChange = (id: string, raw: string) => {
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) return
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, item_number: n } : i))
    )
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }
    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase()
          .from('repair_scope_items')
          .update({ item_number: n })
          .eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zmiany numeru:', err)
      } finally {
        setIsSaving(false)
      }
    }, 600)
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl border-graphite-200">
        <CardContent className="py-8 text-center text-graphite-500">
          Ładowanie…
        </CardContent>
      </Card>
    )
  }

  const completedCount = items.filter((i) => i.is_completed).length

  return (
    <Card className="rounded-xl border-graphite-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Zakres robót remontowych i kolejność wykonywania</span>
          {items.length > 0 && (
            <span className="text-sm font-normal text-graphite-500">
              {completedCount} / {items.length} wykonanych
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Banner informacyjny po auto-imporcie */}
        {importInfo && importInfo.count > 0 && (
          <div className="rounded-lg border border-info-100 bg-info-50/60 px-3 py-2 text-sm text-info-800 flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-info-700" />
            <div className="flex-1">
              Zaimportowano <strong>{importInfo.count}</strong>{' '}
              {importInfo.count === 1 ? 'pozycję' : 'pozycji'}
              {importInfo.source === 'elements' && ' z pól „Zalecenia" w kartach elementów'}
              {importInfo.source === 'legacy' && ' z legacy zaleceń (NG/NB/K)'}
              {importInfo.source === 'mixed' && ' z elementów inspekcji i legacy zaleceń'}
              . Możesz je teraz doedytować, dodać terminy lub usunąć.
            </div>
            <button
              type="button"
              onClick={() => setImportInfo(null)}
              className="text-info-600 hover:text-info-900 text-xs"
              title="Ukryj"
            >
              ×
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-graphite-500">
              Brak pozycji. Dodaj wymagane prace remontowe ręcznie albo
              zaimportuj z pól „Zalecenia" w kartach elementów / legacy zaleceń
              tej inspekcji.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {[...items]
              .sort((a, b) => a.item_number - b.item_number)
              .map((item) => (
              <li
                key={item.id}
                className={`grid grid-cols-12 gap-3 items-start rounded-xl border p-3 shadow-xs ${
                  item.is_completed
                    ? 'border-success-200 bg-success-50/40'
                    : 'border-graphite-200 hover:bg-graphite-50'
                }`}
              >
                <div className="col-span-1 flex items-start justify-center pt-2">
                  {/* Edytowalny numer pozycji — manual override gdy auto-renumber
                      nie zachowuje pożądanej kolejności. */}
                  <input
                    type="number"
                    min={1}
                    value={item.item_number}
                    onChange={(e) => handleNumberChange(item.id, e.target.value)}
                    className="w-12 h-8 rounded-md bg-graphite-50 text-center font-mono text-sm font-semibold text-graphite-700 border border-graphite-200 outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    title="Numer pozycji — kliknij aby edytować ręcznie"
                  />
                </div>
                <div className="col-span-6 space-y-1">
                  <Label
                    htmlFor={`scope-${item.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Zakres czynności
                  </Label>
                  <Textarea
                    id={`scope-${item.id}`}
                    value={item.scope_description}
                    onChange={(e) =>
                      handleUpdate(item.id, 'scope_description', e.target.value)
                    }
                    placeholder="Opis prac remontowych do wykonania…"
                    rows={2}
                    className={
                      item.is_completed ? 'line-through text-graphite-500' : ''
                    }
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs text-graphite-500">
                    Termin wykonania
                  </Label>
                  <Input
                    value={item.deadline_text || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'deadline_text', e.target.value)
                    }
                    placeholder='np. "do 30.06.2026" lub "natychmiast"'
                  />
                  <div className="flex items-center gap-1 mt-1">
                    <Calendar size={14} className="text-graphite-400" />
                    <Input
                      type="date"
                      value={item.deadline_date || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'deadline_date',
                          e.target.value || null
                        )
                      }
                      className="h-8 text-xs"
                      title="Data deadline (do sortowania / alertów)"
                    />
                  </div>
                </div>
                <div className="col-span-2 flex flex-col items-start gap-1 pt-5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`done-${item.id}`}
                      checked={item.is_completed}
                      onCheckedChange={(checked) =>
                        handleUpdate(item.id, 'is_completed', !!checked)
                      }
                    />
                    <Label
                      htmlFor={`done-${item.id}`}
                      className="text-sm cursor-pointer flex items-center gap-1"
                    >
                      {item.is_completed && (
                        <Check size={14} className="text-success" />
                      )}
                      Wykonane
                    </Label>
                  </div>
                  {item.is_completed && item.completion_date && (
                    <span className="text-xs text-graphite-500 font-mono">
                      {new Date(item.completion_date).toLocaleDateString('pl-PL')}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-danger hover:bg-danger-50 hover:text-danger-800 h-7 px-2 mt-1"
                    title="Usuń pozycję"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleAdd} disabled={isSaving} size="sm">
            <Plus size={16} className="mr-1" />
            Dodaj pozycję
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void runImport({ silent: false })}
            disabled={isImporting}
            title="Pobierz zalecenia z pól Zalecenia w kartach elementów oraz z legacy"
          >
            {isImporting ? (
              <>
                <RefreshCw size={16} className="mr-1 animate-spin" />
                Importowanie…
              </>
            ) : (
              <>
                <Sparkles size={16} className="mr-1" />
                {items.length === 0
                  ? 'Importuj zalecenia z elementów / legacy'
                  : 'Doimportuj nowe zalecenia'}
              </>
            )}
          </Button>
        </div>

        {isSaving && (
          <p className="text-xs text-graphite-400 text-right">Zapisywanie…</p>
        )}
      </CardContent>
    </Card>
  )
}

