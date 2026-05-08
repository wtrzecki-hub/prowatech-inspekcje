'use client'

/**
 * Sekcje zarządzania urządzeniami UDT i sprzętem ewakuacyjno-ratunkowym dla
 * turbiny (audyt 5L pkt 6, Waldek 2026-05-08).
 *
 * 2 niezależne komponenty:
 *  - UdtDevicesSection      → CRUD `turbine_udt_devices`
 *  - RescueEquipmentSection → CRUD `turbine_rescue_equipment`
 *
 * Obie używają inline-edit z debounce auto-save 600ms (tak samo jak
 * repair-scope-table.tsx). Lista + przycisk "Dodaj" + ikona kosza per wpis.
 */

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, ShieldCheck, LifeBuoy } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── UDT DEVICES ────────────────────────────────────────────────────────────

interface UdtDevice {
  id: string
  turbine_id: string
  device_type: string
  manufacturer: string | null
  model: string | null
  capacity_t: number | null
  is_udt_subject: boolean
  inspection_frequency: string | null
  certificate_number: string | null
  last_inspection_date: string | null
  next_inspection_date: string | null
  notes: string | null
  sort_order: number
}

export function UdtDevicesSection({ turbineId }: { turbineId: string }) {
  const [items, setItems] = useState<UdtDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    void load()
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turbineId])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase()
        .from('turbine_udt_devices')
        .select('*')
        .eq('turbine_id', turbineId)
        .eq('is_deleted', false)
        .order('sort_order', { ascending: true })
      if (error) throw error
      setItems((data || []) as UdtDevice[])
    } catch (err) {
      console.error('[UdtDevicesSection] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    setSaving(true)
    try {
      const nextOrder =
        items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1
      const { data, error } = await supabase()
        .from('turbine_udt_devices')
        .insert({
          turbine_id: turbineId,
          device_type: '',
          is_udt_subject: true,
          sort_order: nextOrder,
        })
        .select()
        .single()
      if (error) throw error
      if (data) setItems((prev) => [...prev, data as UdtDevice])
    } catch (err) {
      console.error('[UdtDevicesSection] add error:', err)
    } finally {
      setSaving(false)
    }
  }

  function handleUpdate(id: string, field: keyof UdtDevice, value: unknown) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id])
    debounceTimers.current[id] = setTimeout(async () => {
      setSaving(true)
      try {
        const { error } = await supabase()
          .from('turbine_udt_devices')
          .update({ [field]: value })
          .eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('[UdtDevicesSection] update error:', err)
      } finally {
        setSaving(false)
      }
    }, 600)
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const { error } = await supabase()
        .from('turbine_udt_devices')
        .update({ is_deleted: true })
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('[UdtDevicesSection] delete error:', err)
      void load()
    }
  }

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="border-b border-graphite-100 pb-4">
        <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary-600" />
          Urządzenia podlegające UDT
          {saving && (
            <span className="text-xs font-normal text-graphite-500">
              zapisywanie…
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loading ? (
          <div className="text-sm text-graphite-500">Ładowanie…</div>
        ) : items.length === 0 ? (
          <p className="text-sm text-graphite-500">
            Brak urządzeń. Dodaj urządzenia podlegające pod UDT (np. podest
            ruchomy, wciągarka serwisowa) lub pomiń jeśli turbina ich nie ma.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-graphite-200 p-3 space-y-2 hover:bg-graphite-50/40"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">
                      Typ urządzenia *
                    </Label>
                    <Input
                      value={item.device_type}
                      onChange={(e) =>
                        handleUpdate(item.id, 'device_type', e.target.value)
                      }
                      placeholder="np. Podest ruchomy"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">Producent</Label>
                    <Input
                      value={item.manufacturer || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'manufacturer',
                          e.target.value || null
                        )
                      }
                      placeholder="np. Hailo Wind System"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">Model / typ</Label>
                    <Input
                      value={item.model || ''}
                      onChange={(e) =>
                        handleUpdate(item.id, 'model', e.target.value || null)
                      }
                      placeholder="np. GLOBALLift R4 DE"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">Udźwig (t)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={item.capacity_t ?? ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'capacity_t',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="0.240"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">
                      Częstotliwość przeglądów
                    </Label>
                    <Input
                      value={item.inspection_frequency || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'inspection_frequency',
                          e.target.value || null
                        )
                      }
                      placeholder="np. co roku"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">
                      Ostatni przegląd
                    </Label>
                    <Input
                      type="date"
                      value={item.last_inspection_date || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'last_inspection_date',
                          e.target.value || null
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">
                      Następny przegląd
                    </Label>
                    <Input
                      type="date"
                      value={item.next_inspection_date || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'next_inspection_date',
                          e.target.value || null
                        )
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">
                      Nr decyzji / certyfikatu UDT
                    </Label>
                    <Input
                      value={item.certificate_number || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'certificate_number',
                          e.target.value || null
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox
                      id={`udt-subject-${item.id}`}
                      checked={item.is_udt_subject}
                      onCheckedChange={(checked) =>
                        handleUpdate(item.id, 'is_udt_subject', !!checked)
                      }
                    />
                    <Label
                      htmlFor={`udt-subject-${item.id}`}
                      className="text-sm cursor-pointer"
                    >
                      Podlega kontroli UDT
                    </Label>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-graphite-500">
                    Uwagi (sprawdzenia, instrukcje, dziennik konserwacji)
                  </Label>
                  <Textarea
                    value={item.notes || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'notes', e.target.value || null)
                    }
                    placeholder="Opcjonalne uwagi inspektora…"
                    rows={2}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-danger hover:bg-danger-50 hover:text-danger-800 h-8 px-2"
                  >
                    <Trash2 size={14} className="mr-1" /> Usuń
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={handleAdd} disabled={saving} size="sm">
          <Plus size={16} className="mr-1" /> Dodaj urządzenie UDT
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── RESCUE EQUIPMENT ───────────────────────────────────────────────────────

interface RescueItem {
  id: string
  turbine_id: string
  equipment_type: string
  manufacturer: string | null
  model: string | null
  inspection_frequency: string | null
  last_inspection_date: string | null
  next_inspection_date: string | null
  description: string | null
  notes: string | null
  sort_order: number
}

export function RescueEquipmentSection({ turbineId }: { turbineId: string }) {
  const [items, setItems] = useState<RescueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    void load()
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turbineId])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase()
        .from('turbine_rescue_equipment')
        .select('*')
        .eq('turbine_id', turbineId)
        .eq('is_deleted', false)
        .order('sort_order', { ascending: true })
      if (error) throw error
      setItems((data || []) as RescueItem[])
    } catch (err) {
      console.error('[RescueEquipmentSection] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    setSaving(true)
    try {
      const nextOrder =
        items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1
      const { data, error } = await supabase()
        .from('turbine_rescue_equipment')
        .insert({
          turbine_id: turbineId,
          equipment_type: '',
          sort_order: nextOrder,
        })
        .select()
        .single()
      if (error) throw error
      if (data) setItems((prev) => [...prev, data as RescueItem])
    } catch (err) {
      console.error('[RescueEquipmentSection] add error:', err)
    } finally {
      setSaving(false)
    }
  }

  function handleUpdate(id: string, field: keyof RescueItem, value: unknown) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id])
    debounceTimers.current[id] = setTimeout(async () => {
      setSaving(true)
      try {
        const { error } = await supabase()
          .from('turbine_rescue_equipment')
          .update({ [field]: value })
          .eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('[RescueEquipmentSection] update error:', err)
      } finally {
        setSaving(false)
      }
    }, 600)
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const { error } = await supabase()
        .from('turbine_rescue_equipment')
        .update({ is_deleted: true })
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('[RescueEquipmentSection] delete error:', err)
      void load()
    }
  }

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="border-b border-graphite-100 pb-4">
        <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-primary-600" />
          Sprzęt ewakuacyjno-ratunkowy
          {saving && (
            <span className="text-xs font-normal text-graphite-500">
              zapisywanie…
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loading ? (
          <div className="text-sm text-graphite-500">Ładowanie…</div>
        ) : items.length === 0 ? (
          <p className="text-sm text-graphite-500">
            Brak sprzętu. Dodaj sprzęt ewakuacyjno-ratunkowy turbiny (np. PSA AG
            10K, drabina z asekuracją, punkty zaczepienia).
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-graphite-200 p-3 space-y-2 hover:bg-graphite-50/40"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">Typ sprzętu *</Label>
                    <Input
                      value={item.equipment_type}
                      onChange={(e) =>
                        handleUpdate(item.id, 'equipment_type', e.target.value)
                      }
                      placeholder="np. PSA, Drabina z asekuracją"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">Producent</Label>
                    <Input
                      value={item.manufacturer || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'manufacturer',
                          e.target.value || null
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">Model / typ</Label>
                    <Input
                      value={item.model || ''}
                      onChange={(e) =>
                        handleUpdate(item.id, 'model', e.target.value || null)
                      }
                      placeholder="np. PSA AG 10K"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">
                      Częstotliwość przeglądów
                    </Label>
                    <Input
                      value={item.inspection_frequency || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'inspection_frequency',
                          e.target.value || null
                        )
                      }
                      placeholder="np. raz w roku"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">
                      Ostatni przegląd
                    </Label>
                    <Input
                      type="date"
                      value={item.last_inspection_date || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'last_inspection_date',
                          e.target.value || null
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-graphite-500">
                      Następny przegląd
                    </Label>
                    <Input
                      type="date"
                      value={item.next_inspection_date || ''}
                      onChange={(e) =>
                        handleUpdate(
                          item.id,
                          'next_inspection_date',
                          e.target.value || null
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-graphite-500">
                    Opis (parametry, lokalizacja)
                  </Label>
                  <Textarea
                    value={item.description || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'description', e.target.value || null)
                    }
                    placeholder="np. Pionowa lina asekuracyjna z mechanizmem samozaciskowym; punkty zaczepienia w gondoli"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-graphite-500">
                    Uwagi inspektora (oględziny, deformacje, korozja)
                  </Label>
                  <Textarea
                    value={item.notes || ''}
                    onChange={(e) =>
                      handleUpdate(item.id, 'notes', e.target.value || null)
                    }
                    rows={2}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-danger hover:bg-danger-50 hover:text-danger-800 h-8 px-2"
                  >
                    <Trash2 size={14} className="mr-1" /> Usuń
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={handleAdd} disabled={saving} size="sm">
          <Plus size={16} className="mr-1" /> Dodaj sprzęt ewakuacyjny
        </Button>
      </CardContent>
    </Card>
  )
}
