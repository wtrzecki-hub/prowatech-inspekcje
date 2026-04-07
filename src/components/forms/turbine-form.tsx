'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TurbineFormProps {
  windFarmId: string
  initialData?: {
    id: string
    turbine_code: string
    manufacturer: string
    model: string
    rated_power_mw: number
    tower_height_m: number
    rotor_diameter_m: number
    serial_number: string
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
    const data = {
      turbine_code: formData.get('turbine_code'),
      manufacturer: formData.get('manufacturer'),
      model: formData.get('model'),
      rated_power_mw: parseFloat(formData.get('rated_power_mw') as string),
      tower_height_m: parseInt(formData.get('tower_height_m') as string),
      rotor_diameter_m: parseInt(formData.get('rotor_diameter_m') as string),
      serial_number: formData.get('serial_number'),
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

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj'}
      </Button>
    </form>
  )
}
