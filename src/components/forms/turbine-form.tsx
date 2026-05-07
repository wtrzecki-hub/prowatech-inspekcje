'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Pola z 2026-04-25_piib_turbine_fields.sql używane w nagłówku PIIB. */
type TowerConstructionType = 'stalowa' | 'zelbetowa' | 'hybrydowa' | 'inna'
const TOWER_TYPES: Array<{ value: TowerConstructionType; label: string }> = [
  { value: 'stalowa', label: 'Stalowa' },
  { value: 'zelbetowa', label: 'Żelbetowa' },
  { value: 'hybrydowa', label: 'Hybrydowa (stal+żelbet)' },
  { value: 'inna', label: 'Inna' },
]

interface TurbineFormProps {
  windFarmId: string
  initialData?: {
    id: string
    turbine_code: string
    ew_designation?: string | null
    manufacturer: string
    model: string
    rated_power_mw: number
    tower_height_m: number
    rotor_diameter_m: number
    serial_number: string
    has_measurement_station?: boolean
    tower_construction_type?: TowerConstructionType | null
    commissioning_year?: number | null
    building_permit_number?: string | null
    building_permit_date?: string | null
  }
  onSuccess?: () => void
}

export function TurbineForm({
  windFarmId,
  initialData,
  onSuccess,
}: TurbineFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const supabase = createClient()
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const ewRaw = (formData.get('ew_designation') as string | null)?.trim()
    const towerTypeRaw = (formData.get('tower_construction_type') as string | null)?.trim()
    const commYearRaw = (formData.get('commissioning_year') as string | null)?.trim()
    const permitNumRaw = (formData.get('building_permit_number') as string | null)?.trim()
    const permitDateRaw = (formData.get('building_permit_date') as string | null)?.trim()
    const data = {
      turbine_code: formData.get('turbine_code'),
      ew_designation: ewRaw || null,
      manufacturer: formData.get('manufacturer'),
      model: formData.get('model'),
      rated_power_mw: parseFloat(formData.get('rated_power_mw') as string),
      tower_height_m: parseInt(formData.get('tower_height_m') as string),
      rotor_diameter_m: parseInt(formData.get('rotor_diameter_m') as string),
      serial_number: formData.get('serial_number'),
      has_measurement_station: formData.get('has_measurement_station') === 'on',
      tower_construction_type: towerTypeRaw || null,
      commissioning_year: commYearRaw ? parseInt(commYearRaw, 10) : null,
      building_permit_number: permitNumRaw || null,
      building_permit_date: permitDateRaw || null,
      wind_farm_id: windFarmId,
    }

    try {
      if (initialData) {
        const { error: updateError } = await supabase
          .from('turbines')
          .update(data)
          .eq('id', initialData.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('turbines')
          .insert([data])

        if (insertError) throw insertError
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd przy zapisywaniu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="turbine_code">Kod turbiny</Label>
        <Input
          id="turbine_code"
          name="turbine_code"
          required
          defaultValue={initialData?.turbine_code || ''}
          placeholder="T001"
        />
      </div>

      <div>
        <Label htmlFor="ew_designation">Oznaczenie EW (opcjonalnie)</Label>
        <Input
          id="ew_designation"
          name="ew_designation"
          defaultValue={initialData?.ew_designation || ''}
          placeholder="EW 1"
        />
        <p className="text-xs text-graphite-500 mt-1">
          Identyfikator turbiny w obrębie farmy używany w nagłówku protokołów
          PIIB (np. „EW 1", „EW 12"). Free text — możesz pominąć jeśli farma
          nie używa tego oznaczenia.
        </p>
      </div>

      <div>
        <Label htmlFor="manufacturer">Producent</Label>
        <Input
          id="manufacturer"
          name="manufacturer"
          required
          defaultValue={initialData?.manufacturer || ''}
          placeholder="Siemens, Vestas, itp."
        />
      </div>

      <div>
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          name="model"
          required
          defaultValue={initialData?.model || ''}
          placeholder="SWT-2.7-120"
        />
      </div>

      <div>
        <Label htmlFor="rated_power_mw">Moc (MW)</Label>
        <Input
          id="rated_power_mw"
          name="rated_power_mw"
          type="number"
          step="0.1"
          required
          defaultValue={initialData?.rated_power_mw || ''}
          placeholder="2.7"
        />
      </div>

      <div>
        <Label htmlFor="tower_height_m">Wysokość wieży (m)</Label>
        <Input
          id="tower_height_m"
          name="tower_height_m"
          type="number"
          required
          defaultValue={initialData?.tower_height_m || ''}
          placeholder="120"
        />
      </div>

      <div>
        <Label htmlFor="rotor_diameter_m">Średnica rotora (m)</Label>
        <Input
          id="rotor_diameter_m"
          name="rotor_diameter_m"
          type="number"
          required
          defaultValue={initialData?.rotor_diameter_m || ''}
          placeholder="100"
        />
      </div>

      <div>
        <Label htmlFor="serial_number">Numer seryjny</Label>
        <Input
          id="serial_number"
          name="serial_number"
          required
          defaultValue={initialData?.serial_number || ''}
          placeholder="SWW-123456789"
        />
      </div>

      {/* ─── Pola PIIB (Podstawowe dane obiektu) ──────────────────────── */}
      <div>
        <Label htmlFor="tower_construction_type">Rodzaj konstrukcji wieży</Label>
        <select
          id="tower_construction_type"
          name="tower_construction_type"
          defaultValue={initialData?.tower_construction_type || ''}
          className="mt-1 flex h-10 w-full rounded-md border border-graphite-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        >
          <option value="">— nie określono —</option>
          {TOWER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="commissioning_year">Rok zakończenia budowy</Label>
        <Input
          id="commissioning_year"
          name="commissioning_year"
          type="number"
          min={1980}
          max={2099}
          defaultValue={initialData?.commissioning_year ?? ''}
          placeholder="2018"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="building_permit_number">Nr pozwolenia na budowę</Label>
          <Input
            id="building_permit_number"
            name="building_permit_number"
            defaultValue={initialData?.building_permit_number || ''}
            placeholder="np. 123/2017"
          />
        </div>
        <div>
          <Label htmlFor="building_permit_date">Data pozwolenia</Label>
          <Input
            id="building_permit_date"
            name="building_permit_date"
            type="date"
            defaultValue={initialData?.building_permit_date || ''}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 pt-2">
        <input
          id="has_measurement_station"
          name="has_measurement_station"
          type="checkbox"
          defaultChecked={initialData?.has_measurement_station ?? false}
          className="mt-1 h-4 w-4 rounded border-graphite-300 text-primary-600 focus:ring-primary-500"
        />
        <div className="flex-1">
          <Label htmlFor="has_measurement_station" className="cursor-pointer">
            Stacja kontenerowa pomiarowa (przyłącze SN)
          </Label>
          <p className="text-xs text-graphite-500 mt-1">
            Zaznacz, jeśli turbina jest przyłączona do sieci średniego napięcia
            (SN) i posiada własną stację kontenerową pomiarową. W protokole
            inspekcji pojawi się dodatkowa pozycja 17 (Stacja pomiarowa).
          </p>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj'}
      </Button>
    </form>
  )
}
