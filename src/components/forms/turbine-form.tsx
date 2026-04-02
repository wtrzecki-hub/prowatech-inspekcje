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
    kod: string
    producent: string
    model: string
    moc_mw: number
    wysokosc_wiezy: number
    srednica_rotora: number
    numer_seryjny: string
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
      kod: formData.get('kod'),
      producent: formData.get('producent'),
      model: formData.get('model'),
      moc_mw: parseFloat(formData.get('moc_mw') as string),
      wysokosc_wiezy: parseInt(formData.get('wysokosc_wiezy') as string),
      srednica_rotora: parseInt(formData.get('srednica_rotora') as string),
      numer_seryjny: formData.get('numer_seryjny'),
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
        <Label htmlFor="kod">Kod turbiny</Label>
        <Input
          id="kod"
          name="kod"
          required
          defaultValue={initialData?.kod || ''}
          placeholder="T001"
        />
      </div>

      <div>
        <Label htmlFor="producent">Producent</Label>
        <Input
          id="producent"
          name="producent"
          required
          defaultValue={initialData?.producent || ''}
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
        <Label htmlFor="moc_mw">Moc (MW)</Label>
        <Input
          id="moc_mw"
          name="moc_mw"
          type="number"
          step="0.1"
          required
          defaultValue={initialData?.moc_mw || ''}
          placeholder="2.7"
        />
      </div>

      <div>
        <Label htmlFor="wysokosc_wiezy">Wysokość wieży (m)</Label>
        <Input
          id="wysokosc_wiezy"
          name="wysokosc_wiezy"
          type="number"
          required
          defaultValue={initialData?.wysokosc_wiezy || ''}
          placeholder="120"
        />
      </div>

      <div>
        <Label htmlFor="srednica_rotora">Średnica rotora (m)</Label>
        <Input
          id="srednica_rotora"
          name="srednica_rotora"
          type="number"
          required
          defaultValue={initialData?.srednica_rotora || ''}
          placeholder="100"
        />
      </div>

      <div>
        <Label htmlFor="numer_seryjny">Numer seryjny</Label>
        <Input
          id="numer_seryjny"
          name="numer_seryjny"
          required
          defaultValue={initialData?.numer_seryjny || ''}
          placeholder="SWW-123456789"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj'}
      </Button>
    </form>
  )
}
