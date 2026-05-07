'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createBrowserClient } from '@supabase/ssr'

interface ElectricalMeasurement {
  id: string
  inspection_id: string
  measurement_point: string
  grounding_resistance: number | null
  grounding_result: string | null
  insulation_resistance: number | null
  insulation_result: string | null
  loop_impedance: number | null
  loop_result: string | null
  rcd_time: number | null
  rcd_result: string | null
  pe_continuity: number | null
  pe_result: string | null
  measurement_date: string | null
  measured_by: string | null
  instrument_info: string | null
}

/** Pola podsumowania pomiarów elektrycznych — kolumny w `inspections`. */
interface MeasurementSummary {
  electrical_measurement_date: string | null
  electrical_next_measurement_date: string | null
  electrical_measurement_protocol_number: string | null
  electrical_measurement_verdict:
    | 'dopuszcza'
    | 'warunkowo'
    | 'nie_dopuszcza'
    | null
  electrical_measurement_verdict_notes: string | null
  electrical_measurement_final_assessment: string | null
  electrical_measurement_notes: string | null
  electrical_measurement_protocol_url: string | null
  /** Wyniki oględzin (audyt 2026-05-07): instalacji elektrycznej i odgromowej. */
  electrical_visual_inspection_result: 'pozytywna' | 'negatywna' | null
  electrical_visual_inspection_notes: string | null
  lightning_visual_inspection_result: 'pozytywna' | 'negatywna' | null
  lightning_visual_inspection_notes: string | null
}

const EMPTY_SUMMARY: MeasurementSummary = {
  electrical_measurement_date: null,
  electrical_next_measurement_date: null,
  electrical_measurement_protocol_number: null,
  electrical_measurement_verdict: null,
  electrical_measurement_verdict_notes: null,
  electrical_measurement_final_assessment: null,
  electrical_measurement_notes: null,
  electrical_measurement_protocol_url: null,
  electrical_visual_inspection_result: null,
  electrical_visual_inspection_notes: null,
  lightning_visual_inspection_result: null,
  lightning_visual_inspection_notes: null,
}

const VERDICT_OPTIONS: { value: NonNullable<MeasurementSummary['electrical_measurement_verdict']>; label: string }[] = [
  { value: 'dopuszcza', label: 'Dopuszcza do dalszej eksploatacji' },
  { value: 'warunkowo', label: 'Warunkowo dopuszcza' },
  { value: 'nie_dopuszcza', label: 'Nie dopuszcza do dalszej eksploatacji' },
]

interface MeasurementDevice {
  id: string
  model: string
  serial_number: string
  manufacturer: string | null
}

interface MeasurementPerformer {
  id: string
  full_name: string
  license_number: string | null
  chamber_membership: string | null
}

interface ElectricalMeasurementsProps {
  inspectionId: string
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export function ElectricalMeasurements({
  inspectionId,
}: ElectricalMeasurementsProps) {
  // Podsumowanie (główna sekcja, kolumny w `inspections`).
  const [summary, setSummary] = useState<MeasurementSummary>(EMPTY_SUMMARY)
  const [summarySaving, setSummarySaving] = useState(false)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfDragOver, setPdfDragOver] = useState(false)
  const summaryDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)

  // Sprzęt użyty do pomiarów (Artur uwagi pkt 6) — multi-select z bazy.
  const [allDevices, setAllDevices] = useState<MeasurementDevice[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(
    new Set()
  )

  // Osoby wykonujące pomiary — inspektorzy elektryczni.
  const [allPerformers, setAllPerformers] = useState<MeasurementPerformer[]>([])
  const [selectedPerformerIds, setSelectedPerformerIds] = useState<Set<string>>(
    new Set()
  )

  // Legacy: punkty pomiarowe (tabela `electrical_measurements`). Schowane pod
  // expanderem — zostawione dla starych draftów + edge-case ręcznego wpisu.
  const [measurements, setMeasurements] = useState<ElectricalMeasurement[]>([])
  const [additionalFields, setAdditionalFields] = useState({
    measurement_date: '',
    measured_by: '',
    instrument_info: '',
  })
  const measurementsDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const loadAll = async () => {
    try {
      const sb = supabase()
      const [
        { data: insp, error: inspErr },
        { data: pts, error: ptsErr },
        { data: devices, error: devErr },
        { data: linkedDevices, error: linkErr },
        { data: performers, error: perfErr },
        { data: linkedPerformers, error: linkPerfErr },
      ] = await Promise.all([
        sb
          .from('inspections')
          .select(
            `electrical_measurement_date, electrical_next_measurement_date,
             electrical_measurement_protocol_number,
             electrical_measurement_verdict,
             electrical_measurement_verdict_notes,
             electrical_measurement_final_assessment,
             electrical_measurement_notes,
             electrical_measurement_protocol_url,
             electrical_visual_inspection_result,
             electrical_visual_inspection_notes,
             lightning_visual_inspection_result,
             lightning_visual_inspection_notes`
          )
          .eq('id', inspectionId)
          .single(),
        sb
          .from('electrical_measurements')
          .select('*')
          .eq('inspection_id', inspectionId)
          .order('created_at', { ascending: true }),
        sb
          .from('measurement_devices')
          .select('id, model, serial_number, manufacturer')
          .eq('is_active', true)
          .eq('is_deleted', false)
          .order('model', { ascending: true }),
        sb
          .from('inspection_measurement_devices')
          .select('device_id')
          .eq('inspection_id', inspectionId),
        sb
          .from('inspectors')
          .select('id, full_name, license_number, chamber_membership')
          .eq('specialty', 'elektryczna')
          .eq('is_active', true)
          .eq('is_deleted', false)
          .order('full_name', { ascending: true }),
        sb
          .from('inspection_measurement_performers')
          .select('inspector_id')
          .eq('inspection_id', inspectionId),
      ])

      if (inspErr) console.error('Błąd ładowania podsumowania pomiarów:', inspErr)
      if (insp) setSummary({ ...EMPTY_SUMMARY, ...insp })

      if (ptsErr) console.error('Błąd ładowania punktów pomiarowych:', ptsErr)
      if (pts && pts.length > 0) {
        setMeasurements(pts)
        setAdditionalFields({
          measurement_date: pts[0].measurement_date || '',
          measured_by: pts[0].measured_by || '',
          instrument_info: pts[0].instrument_info || '',
        })
      }

      if (devErr) console.error('Błąd ładowania sprzętu pomiarowego:', devErr)
      if (devices) setAllDevices(devices as MeasurementDevice[])

      if (linkErr) console.error('Błąd ładowania powiązanego sprzętu:', linkErr)
      if (linkedDevices) {
        setSelectedDeviceIds(
          new Set(linkedDevices.map((r) => r.device_id as string))
        )
      }

      if (perfErr) console.error('Błąd ładowania pomiarowców:', perfErr)
      if (performers) setAllPerformers(performers as MeasurementPerformer[])

      if (linkPerfErr)
        console.error('Błąd ładowania powiązanych pomiarowców:', linkPerfErr)
      if (linkedPerformers) {
        setSelectedPerformerIds(
          new Set(linkedPerformers.map((r) => r.inspector_id as string))
        )
      }
    } catch (err) {
      console.error('Błąd ładowania pomiarów elektrycznych:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleDevice = async (deviceId: string) => {
    const sb = supabase()
    const isSelected = selectedDeviceIds.has(deviceId)

    // Optimistic UI update
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev)
      if (isSelected) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })

    try {
      if (isSelected) {
        const { error } = await sb
          .from('inspection_measurement_devices')
          .delete()
          .eq('inspection_id', inspectionId)
          .eq('device_id', deviceId)
        if (error) throw error
      } else {
        const { error } = await sb
          .from('inspection_measurement_devices')
          .insert({ inspection_id: inspectionId, device_id: deviceId })
        if (error) throw error
      }
    } catch (err) {
      console.error('Błąd zapisu powiązania sprzętu:', err)
      // Revert on error
      setSelectedDeviceIds((prev) => {
        const next = new Set(prev)
        if (isSelected) next.add(deviceId)
        else next.delete(deviceId)
        return next
      })
    }
  }

  const togglePerformer = async (inspectorId: string) => {
    const sb = supabase()
    const isSelected = selectedPerformerIds.has(inspectorId)

    setSelectedPerformerIds((prev) => {
      const next = new Set(prev)
      if (isSelected) next.delete(inspectorId)
      else next.add(inspectorId)
      return next
    })

    try {
      if (isSelected) {
        const { error } = await sb
          .from('inspection_measurement_performers')
          .delete()
          .eq('inspection_id', inspectionId)
          .eq('inspector_id', inspectorId)
        if (error) throw error
      } else {
        const { error } = await sb
          .from('inspection_measurement_performers')
          .insert({ inspection_id: inspectionId, inspector_id: inspectorId })
        if (error) throw error
      }
    } catch (err) {
      console.error('Błąd zapisu powiązania pomiarowca:', err)
      setSelectedPerformerIds((prev) => {
        const next = new Set(prev)
        if (isSelected) next.add(inspectorId)
        else next.delete(inspectorId)
        return next
      })
    }
  }

  // ── Zapis podsumowania (debounce 800ms) ─────────────────────────────
  const updateSummary = (patch: Partial<MeasurementSummary>) => {
    setSummary((prev) => ({ ...prev, ...patch }))

    if (summaryDebounceRef.current) clearTimeout(summaryDebounceRef.current)
    summaryDebounceRef.current = setTimeout(async () => {
      setSummarySaving(true)
      try {
        const { error } = await supabase()
          .from('inspections')
          .update(patch)
          .eq('id', inspectionId)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zapisu podsumowania pomiarów:', err)
      } finally {
        setSummarySaving(false)
      }
    }, 800)
  }

  // ── Upload PDF protokołu (R2 via presigned URL) ──────────────────────
  const handlePdfFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Wybierz plik PDF.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('Plik za duży (max 50 MB).')
      return
    }

    setPdfUploading(true)
    try {
      // 1. Pre-signed PUT URL
      const presignedRes = await fetch('/api/storage/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: 'application/pdf',
          context: 'inspection-attachment',
          inspectionId,
        }),
      })

      if (!presignedRes.ok) {
        const errText = await presignedRes.text().catch(() => 'unknown')
        throw new Error(`Pre-signed: ${presignedRes.status} ${errText}`)
      }
      const { uploadUrl, publicUrl } = (await presignedRes.json()) as {
        uploadUrl: string
        publicUrl: string
      }

      // 2. PUT na R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })
      if (!putRes.ok) throw new Error(`R2 PUT ${putRes.status}`)

      // 3. Zapis URL do DB (przez updateSummary który robi też debouncowany zapis)
      updateSummary({ electrical_measurement_protocol_url: publicUrl })
    } catch (err) {
      console.error('Błąd uploadu PDF protokołu:', err)
      alert(
        err instanceof Error
          ? `Nie udało się wgrać pliku: ${err.message}`
          : 'Nie udało się wgrać pliku.'
      )
    } finally {
      setPdfUploading(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  const handlePdfRemove = () => {
    if (!confirm('Usunąć protokół pomiarów (PDF) z inspekcji?')) return
    updateSummary({ electrical_measurement_protocol_url: null })
  }

  // ── Legacy: tabela punktów pomiarowych ───────────────────────────────
  const handleMeasurementChange = (
    id: string,
    field: keyof ElectricalMeasurement,
    value: string | number | null
  ) => {
    setMeasurements((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    )

    if (measurementsDebounceRef.current)
      clearTimeout(measurementsDebounceRef.current)
    measurementsDebounceRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase()
          .from('electrical_measurements')
          .update({ [field]: value })
          .eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Błąd aktualizacji pomiaru:', err)
      }
    }, 800)
  }

  const handleAdditionalFieldChange = (
    field: 'measurement_date' | 'measured_by' | 'instrument_info',
    value: string
  ) => {
    setAdditionalFields((prev) => ({ ...prev, [field]: value }))

    if (measurementsDebounceRef.current)
      clearTimeout(measurementsDebounceRef.current)
    measurementsDebounceRef.current = setTimeout(async () => {
      try {
        for (const m of measurements) {
          await supabase()
            .from('electrical_measurements')
            .update({ [field]: value })
            .eq('id', m.id)
        }
      } catch (err) {
        console.error('Błąd zapisu nagłówka pomiarów (legacy):', err)
      }
    }, 800)
  }

  const addMeasurement = async () => {
    try {
      const { data, error } = await supabase()
        .from('electrical_measurements')
        .insert([
          {
            inspection_id: inspectionId,
            measurement_point: `Punkt ${measurements.length + 1}`,
            measurement_date: additionalFields.measurement_date || null,
            measured_by: additionalFields.measured_by || null,
            instrument_info: additionalFields.instrument_info || null,
          },
        ])
        .select()
        .single()
      if (error) throw error
      setMeasurements((prev) => [...prev, data as ElectricalMeasurement])
    } catch (err) {
      console.error('Błąd dodawania punktu pomiarowego:', err)
    }
  }

  const deleteMeasurement = async (id: string) => {
    try {
      const { error } = await supabase()
        .from('electrical_measurements')
        .delete()
        .eq('id', id)
      if (error) throw error
      setMeasurements((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      console.error('Błąd usuwania punktu pomiarowego:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-graphite-500">
        Ładowanie pomiarów elektrycznych…
      </div>
    )
  }

  const verdictNeedsNotes =
    summary.electrical_measurement_verdict === 'warunkowo' ||
    summary.electrical_measurement_verdict === 'nie_dopuszcza'

  return (
    <div className="space-y-6">
      {/* ── Sekcja podsumowania (PIIB sekcja IV — pomiary elektryczne) ── */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">
            Pomiary elektryczne — podsumowanie
          </CardTitle>
          <p className="text-sm text-graphite-500 font-normal">
            Wgraj protokół pomiarów (PDF z miernika) i wpisz najważniejsze dane.
            Treść protokołu PIIB wykorzystuje tylko te pola — pełny raport
            stanowi załącznik.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="em-date" className="font-medium">
                Data pomiaru
              </Label>
              <Input
                id="em-date"
                type="date"
                value={summary.electrical_measurement_date || ''}
                onChange={(e) =>
                  updateSummary({
                    electrical_measurement_date: e.target.value || null,
                  })
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="em-next-date" className="font-medium">
                Data kolejnego pomiaru
              </Label>
              <Input
                id="em-next-date"
                type="date"
                value={summary.electrical_next_measurement_date || ''}
                onChange={(e) =>
                  updateSummary({
                    electrical_next_measurement_date: e.target.value || null,
                  })
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="em-protocol-no" className="font-medium">
                Nr protokołu z pomiaru
              </Label>
              <Input
                id="em-protocol-no"
                placeholder="np. 165/T/2025"
                value={summary.electrical_measurement_protocol_number || ''}
                onChange={(e) =>
                  updateSummary({
                    electrical_measurement_protocol_number:
                      e.target.value || null,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="em-verdict" className="font-medium">
              Orzeczenie
            </Label>
            <Select
              value={summary.electrical_measurement_verdict || 'none'}
              onValueChange={(v) =>
                updateSummary({
                  electrical_measurement_verdict:
                    v === 'none'
                      ? null
                      : (v as MeasurementSummary['electrical_measurement_verdict']),
                  // Czyść notes gdy "Dopuszcza" — niepotrzebne.
                  electrical_measurement_verdict_notes:
                    v === 'dopuszcza'
                      ? null
                      : summary.electrical_measurement_verdict_notes,
                })
              }
            >
              <SelectTrigger id="em-verdict">
                <SelectValue placeholder="Wybierz orzeczenie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— nie określono —</SelectItem>
                {VERDICT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {verdictNeedsNotes && (
              <Textarea
                value={summary.electrical_measurement_verdict_notes || ''}
                onChange={(e) =>
                  updateSummary({
                    electrical_measurement_verdict_notes: e.target.value || null,
                  })
                }
                placeholder="Opis warunków / uzasadnienie odmowy dopuszczenia…"
                rows={2}
                className="mt-2"
              />
            )}
          </div>

          {/* ── Oględziny: instalacji elektrycznej + odgromowej (audyt 2026-05-07) ── */}
          {/* Kolejność (audyt korekta 2026-05-07): oględziny POPRZEDZAJĄ ocenę
              końcową — ocena końcowa jest zbiorczą konkluzją wynikającą z obu
              oględzin + orzeczenia. */}
          <VisualInspectionItem
            id="em-visual-electrical"
            label="Oględziny instalacji elektrycznej"
            result={summary.electrical_visual_inspection_result}
            notes={summary.electrical_visual_inspection_notes}
            onResultChange={(v) =>
              updateSummary({
                electrical_visual_inspection_result: v,
                // Czyść opis, jeśli wynik wraca do pozytywnej / null.
                electrical_visual_inspection_notes:
                  v === 'negatywna'
                    ? summary.electrical_visual_inspection_notes
                    : null,
              })
            }
            onNotesChange={(v) =>
              updateSummary({ electrical_visual_inspection_notes: v })
            }
          />

          <VisualInspectionItem
            id="em-visual-lightning"
            label="Oględziny instalacji odgromowej i uziomów"
            result={summary.lightning_visual_inspection_result}
            notes={summary.lightning_visual_inspection_notes}
            onResultChange={(v) =>
              updateSummary({
                lightning_visual_inspection_result: v,
                lightning_visual_inspection_notes:
                  v === 'negatywna'
                    ? summary.lightning_visual_inspection_notes
                    : null,
              })
            }
            onNotesChange={(v) =>
              updateSummary({ lightning_visual_inspection_notes: v })
            }
          />

          <div className="space-y-1">
            <Label htmlFor="em-final" className="font-medium">
              Ocena końcowa
            </Label>
            <Textarea
              id="em-final"
              value={summary.electrical_measurement_final_assessment || ''}
              onChange={(e) =>
                updateSummary({
                  electrical_measurement_final_assessment:
                    e.target.value || null,
                })
              }
              placeholder="Krótka ocena końcowa pomiarów elektrycznych…"
              rows={2}
            />
          </div>

          {/* ── Oględziny: instalacji elektrycznej + odgromowej (audyt 2026-05-07) ── */}
          <VisualInspectionItem
            id="em-visual-electrical"
            label="Oględziny instalacji elektrycznej"
            result={summary.electrical_visual_inspection_result}
            notes={summary.electrical_visual_inspection_notes}
            onResultChange={(v) =>
              updateSummary({
                electrical_visual_inspection_result: v,
                // Czyść opis, jeśli wynik wraca do pozytywnej / null.
                electrical_visual_inspection_notes:
                  v === 'negatywna'
                    ? summary.electrical_visual_inspection_notes
                    : null,
              })
            }
            onNotesChange={(v) =>
              updateSummary({ electrical_visual_inspection_notes: v })
            }
          />

          <VisualInspectionItem
            id="em-visual-lightning"
            label="Oględziny instalacji odgromowej i uziomów"
            result={summary.lightning_visual_inspection_result}
            notes={summary.lightning_visual_inspection_notes}
            onResultChange={(v) =>
              updateSummary({
                lightning_visual_inspection_result: v,
                lightning_visual_inspection_notes:
                  v === 'negatywna'
                    ? summary.lightning_visual_inspection_notes
                    : null,
              })
            }
            onNotesChange={(v) =>
              updateSummary({ lightning_visual_inspection_notes: v })
            }
          />

          <div className="space-y-1">
            <Label htmlFor="em-notes" className="font-medium">
              Uwagi do oględzin i oceny
            </Label>
            <Textarea
              id="em-notes"
              value={summary.electrical_measurement_notes || ''}
              onChange={(e) =>
                updateSummary({
                  electrical_measurement_notes: e.target.value || null,
                })
              }
              placeholder="Dodatkowe uwagi inspektora dotyczące oględzin instalacji elektrycznej…"
              rows={3}
            />
          </div>

          {/* ── Sprzęt użyty do pomiarów (Artur uwagi pkt 6) ── */}
          <div className="space-y-2 pt-2 border-t border-graphite-100">
            <Label className="font-medium">
              Sprzęt użyty do pomiarów
            </Label>
            {allDevices.length === 0 ? (
              <p className="text-xs text-graphite-500">
                Brak sprzętu w bazie. Skontaktuj się z administratorem żeby dodać urządzenie.
              </p>
            ) : (
              <div className="space-y-1 rounded-lg border border-graphite-200 bg-graphite-50/50 p-3">
                {allDevices.map((d) => {
                  const checked = selectedDeviceIds.has(d.id)
                  return (
                    <label
                      key={d.id}
                      className="flex items-start gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => void toggleDevice(d.id)}
                        className="mt-0.5"
                      />
                      <div className="text-sm leading-tight">
                        <span className="font-medium text-graphite-900">{d.model}</span>
                        <span className="text-graphite-500 font-mono ml-2">
                          s/n: {d.serial_number}
                        </span>
                        {d.manufacturer && (
                          <span className="block text-xs text-graphite-500">
                            {d.manufacturer}
                          </span>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            {selectedDeviceIds.size > 0 && (
              <p className="text-xs text-graphite-500">
                Wybrano: {selectedDeviceIds.size}{' '}
                {selectedDeviceIds.size === 1 ? 'urządzenie' : 'urządzeń'}.
                Zostanie wypisane w sekcji „Identyfikacja użytych przyrządów" protokołu.
              </p>
            )}
          </div>

          {/* ── Osoby wykonujące pomiary (Artur uwagi pkt 6 cd) ── */}
          <div className="space-y-2 pt-2 border-t border-graphite-100">
            <Label className="font-medium">Osoby wykonujące pomiary</Label>
            {allPerformers.length === 0 ? (
              <p className="text-xs text-graphite-500">
                Brak inspektorów elektrycznych w bazie. Dodaj ich na stronie{' '}
                <a href="/inspektorzy" className="text-primary-700 hover:underline">
                  /inspektorzy
                </a>
                .
              </p>
            ) : (
              <div className="space-y-1 rounded-lg border border-graphite-200 bg-graphite-50/50 p-3">
                {allPerformers.map((p) => {
                  const checked = selectedPerformerIds.has(p.id)
                  return (
                    <label
                      key={p.id}
                      className="flex items-start gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => void togglePerformer(p.id)}
                        className="mt-0.5"
                      />
                      <div className="text-sm leading-tight">
                        <span className="font-medium text-graphite-900">
                          {p.full_name}
                        </span>
                        {p.license_number && p.license_number !== '-' && (
                          <span className="text-graphite-500 font-mono ml-2">
                            {p.license_number}
                          </span>
                        )}
                        {p.chamber_membership && (
                          <span className="block text-xs text-graphite-500">
                            {p.chamber_membership}
                          </span>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            {selectedPerformerIds.size > 0 && (
              <p className="text-xs text-graphite-500">
                Wybrano: {selectedPerformerIds.size}{' '}
                {selectedPerformerIds.size === 1 ? 'osoba' : 'osób'}.
                Zostanie wypisane w sekcji „Osoby wykonujące pomiary" protokołu.
              </p>
            )}
          </div>

          {/* ── Załącznik: protokół Sonel PDF ── */}
          <div className="space-y-2 pt-2 border-t border-graphite-100">
            <div className="flex items-center justify-between">
              <Label className="font-medium">
                Protokół pomiarów (załącznik PDF)
              </Label>
              {summarySaving && (
                <span className="text-xs text-graphite-400">Zapisywanie…</span>
              )}
            </div>
            {summary.electrical_measurement_protocol_url ? (
              <div className="flex items-center gap-2 rounded-lg border border-graphite-200 bg-graphite-50 p-3">
                <a
                  href={summary.electrical_measurement_protocol_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
                >
                  <ExternalLink size={16} />
                  Otwórz protokół pomiarów
                </a>
                <span className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={pdfUploading}
                  >
                    {pdfUploading ? (
                      <>
                        <Loader2 size={14} className="mr-1 animate-spin" />
                        Wgrywanie…
                      </>
                    ) : (
                      <>
                        <Upload size={14} className="mr-1" />
                        Zmień
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePdfRemove}
                    className="text-danger hover:bg-danger-50 hover:text-danger-800"
                  >
                    <Trash2 size={14} />
                  </Button>
                </span>
              </div>
            ) : (
              <div
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPdfDragOver(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPdfDragOver(false)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPdfDragOver(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) void handlePdfFile(file)
                }}
                onClick={() => pdfInputRef.current?.click()}
                className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                  pdfDragOver
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-graphite-300 bg-graphite-50/50 hover:border-graphite-400 hover:bg-graphite-50'
                }`}
              >
                {pdfUploading ? (
                  <div className="flex flex-col items-center gap-2 text-graphite-600">
                    <Loader2 size={28} className="animate-spin" />
                    <span className="text-sm font-medium">Wgrywanie pliku…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-graphite-600">
                    <Upload size={28} />
                    <span className="text-sm font-medium">
                      Przeciągnij PDF protokołu Sonela lub kliknij, aby wybrać
                    </span>
                    <span className="text-xs text-graphite-400">
                      max 50 MB · trafia do załączników protokołu PIIB
                    </span>
                  </div>
                )}
              </div>
            )}
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handlePdfFile(file)
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Legacy: ręczna tabela punktów pomiarowych (schowana) ── */}
      <details className="rounded-xl border border-graphite-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-graphite-700 hover:bg-graphite-50">
          Ręczne wpisanie punktów pomiarowych (zaawansowane / legacy)
          {measurements.length > 0 && (
            <span className="ml-2 text-xs text-graphite-500">
              · {measurements.length}{' '}
              {measurements.length === 1 ? 'wpis' : 'wpisów'}
            </span>
          )}
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-4">
          <p className="text-xs text-graphite-500">
            Sekcja zachowana dla starych draftów. W większości przypadków
            wystarczy wgranie protokołu PDF powyżej — pełna tabela pomiarów
            znajduje się w nim.
          </p>

          {/* Nagłówek (data / wykonawca / urządzenie) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-graphite-50 rounded-lg border border-graphite-200">
            <div className="space-y-2">
              <Label htmlFor="legacy-date" className="font-medium text-sm">
                Data pomiaru
              </Label>
              <Input
                id="legacy-date"
                type="date"
                value={additionalFields.measurement_date}
                onChange={(e) =>
                  handleAdditionalFieldChange('measurement_date', e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legacy-by" className="font-medium text-sm">
                Pomiary przeprowadził
              </Label>
              <Input
                id="legacy-by"
                placeholder="Imię i nazwisko"
                value={additionalFields.measured_by}
                onChange={(e) =>
                  handleAdditionalFieldChange('measured_by', e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legacy-instr" className="font-medium text-sm">
                Informacje o urządzeniu
              </Label>
              <Input
                id="legacy-instr"
                placeholder="Model, seria, kalibracja"
                value={additionalFields.instrument_info}
                onChange={(e) =>
                  handleAdditionalFieldChange('instrument_info', e.target.value)
                }
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-graphite-50 hover:bg-graphite-50 border-b border-graphite-200">
                  <TableHead className="w-32">Punkt pomiarowy</TableHead>
                  <TableHead className="text-center">Rezystancja uziemienia (Ω)</TableHead>
                  <TableHead className="text-center">Wynik</TableHead>
                  <TableHead className="text-center">Rezystancja izolacji (MΩ)</TableHead>
                  <TableHead className="text-center">Wynik</TableHead>
                  <TableHead className="text-center">Impedancja pętli (Ω)</TableHead>
                  <TableHead className="text-center">Wynik</TableHead>
                  <TableHead className="text-center">Czas RCD (ms)</TableHead>
                  <TableHead className="text-center">Wynik</TableHead>
                  <TableHead className="text-center">Ciągłość PE (Ω)</TableHead>
                  <TableHead className="text-center">Wynik</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measurements.map((m) => (
                  <TableRow key={m.id} className="hover:bg-graphite-50/50 border-b border-graphite-100">
                    <TableCell>
                      <Input
                        value={m.measurement_point}
                        onChange={(e) =>
                          handleMeasurementChange(m.id, 'measurement_point', e.target.value)
                        }
                        className="w-28 text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        step="0.1"
                        value={m.grounding_resistance ?? ''}
                        onChange={(e) =>
                          handleMeasurementChange(
                            m.id,
                            'grounding_resistance',
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-24 text-xs text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        value={m.grounding_result || ''}
                        onChange={(e) =>
                          handleMeasurementChange(m.id, 'grounding_result', e.target.value)
                        }
                        className="w-20 text-xs text-center"
                        placeholder="OK/NOK"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        step="0.1"
                        value={m.insulation_resistance ?? ''}
                        onChange={(e) =>
                          handleMeasurementChange(
                            m.id,
                            'insulation_resistance',
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-24 text-xs text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        value={m.insulation_result || ''}
                        onChange={(e) =>
                          handleMeasurementChange(m.id, 'insulation_result', e.target.value)
                        }
                        className="w-20 text-xs text-center"
                        placeholder="OK/NOK"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        step="0.01"
                        value={m.loop_impedance ?? ''}
                        onChange={(e) =>
                          handleMeasurementChange(
                            m.id,
                            'loop_impedance',
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-24 text-xs text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        value={m.loop_result || ''}
                        onChange={(e) =>
                          handleMeasurementChange(m.id, 'loop_result', e.target.value)
                        }
                        className="w-20 text-xs text-center"
                        placeholder="OK/NOK"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        step="1"
                        value={m.rcd_time ?? ''}
                        onChange={(e) =>
                          handleMeasurementChange(
                            m.id,
                            'rcd_time',
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-20 text-xs text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        value={m.rcd_result || ''}
                        onChange={(e) =>
                          handleMeasurementChange(m.id, 'rcd_result', e.target.value)
                        }
                        className="w-20 text-xs text-center"
                        placeholder="OK/NOK"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        step="0.1"
                        value={m.pe_continuity ?? ''}
                        onChange={(e) =>
                          handleMeasurementChange(
                            m.id,
                            'pe_continuity',
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-20 text-xs text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        value={m.pe_result || ''}
                        onChange={(e) =>
                          handleMeasurementChange(m.id, 'pe_result', e.target.value)
                        }
                        className="w-20 text-xs text-center"
                        placeholder="OK/NOK"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMeasurement(m.id)}
                        className="text-danger hover:text-danger-800 hover:bg-danger-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button onClick={addMeasurement} className="w-full" variant="outline">
            <Plus size={18} className="mr-2" />
            Dodaj punkt pomiarowy
          </Button>
        </div>
      </details>
    </div>
  )
}

// ─── VisualInspectionItem ────────────────────────────────────────────────────
// Strukturalny wynik oględzin: pozytywna / negatywna + warunkowy opis przy
// negatywnej. Używany dla obu sekcji (instalacja elektryczna + odgromowa).

interface VisualInspectionItemProps {
  id: string
  label: string
  result: 'pozytywna' | 'negatywna' | null
  notes: string | null
  onResultChange: (v: 'pozytywna' | 'negatywna' | null) => void
  onNotesChange: (v: string | null) => void
}

function VisualInspectionItem({
  id,
  label,
  result,
  notes,
  onResultChange,
  onNotesChange,
}: VisualInspectionItemProps) {
  return (
    <div className="space-y-1 rounded-lg border border-graphite-200 bg-graphite-50/50 p-3">
      <Label htmlFor={id} className="font-medium">
        {label}
      </Label>
      <Select
        value={result ?? '__none__'}
        onValueChange={(v) =>
          onResultChange(
            v === '__none__' ? null : (v as 'pozytywna' | 'negatywna')
          )
        }
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="— wybierz ocenę —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— nie określono —</SelectItem>
          <SelectItem value="pozytywna">Pozytywna</SelectItem>
          <SelectItem value="negatywna">Negatywna</SelectItem>
        </SelectContent>
      </Select>
      {result === 'negatywna' && (
        <Textarea
          value={notes || ''}
          onChange={(e) => onNotesChange(e.target.value || null)}
          placeholder="Opis stwierdzonych nieprawidłowości / zakres koniecznych prac…"
          rows={2}
          className="mt-2"
        />
      )}
    </div>
  )
}
