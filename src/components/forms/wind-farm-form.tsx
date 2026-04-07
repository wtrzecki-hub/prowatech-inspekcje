'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface WindFarmFormProps {
  clientId?: string
  initialData?: {
    id: string
    name: string
    client_id: string
    location_address: string
    latitude: number
    longitude: number
    total_capacity_mw: number
    number_of_turbines: number
    commissioning_date: string
  }
  onSuccess?: () => void
}

interface Client {
  id: string
  name: string
}

export function WindFarmForm({
  clientId,
  initialData,
  onSuccess,
}: WindFarmFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState(clientId || '')

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .not('is_deleted', 'is', true)
        .order('name')

      if (error) throw error
      setClients(data || [])
    } catch (err) {
      console.error('Błąd przy pobieraniu klientów:', err)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const supabase = createClient()
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      client_id: selectedClient,
      location_address: formData.get('location_address'),
      latitude: parseFloat(
        formData.get('latitude') as string
      ),
      longitude: parseFloat(
        formData.get('longitude') as string
      ),
      total_capacity_mw: parseFloat(formData.get('total_capacity_mw') as string),
      number_of_turbines: parseInt(formData.get('number_of_turbines') as string),
      commissioning_date: formData.get('commissioning_date'),
    }

    try {
      if (initialData) {
        const { error: updateError } = await supabase
          .from('wind_farms')
          .update(data)
          .eq('id', initialData.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('wind_farms')
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
        <Label htmlFor="client_id">Klient</Label>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="name">Nazwa farmy</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={initialData?.name || ''}
          placeholder="Nazwa farmy wiatrowej"
        />
      </div>

      <div>
        <Label htmlFor="location_address">Lokalizacja</Label>
        <Input
          id="location_address"
          name="location_address"
          required
          defaultValue={initialData?.location_address || ''}
          placeholder="Miejscowość"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="latitude">Szerokość (°N)</Label>
          <Input
            id="latitude"
            name="latitude"
            type="number"
            step="0.0001"
            defaultValue={initialData?.latitude || ''}
            placeholder="52.1234"
          />
        </div>

        <div>
          <Label htmlFor="longitude">Długość (°E)</Label>
          <Input
            id="longitude"
            name="longitude"
            type="number"
            step="0.0001"
            defaultValue={initialData?.longitude || ''}
            placeholder="21.0123"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="total_capacity_mw">Moc łączna (MW)</Label>
          <Input
            id="total_capacity_mw"
            name="total_capacity_mw"
            type="number"
            step="0.1"
            required
            defaultValue={initialData?.total_capacity_mw || ''}
            placeholder="50.0"
          />
        </div>

        <div>
          <Label htmlFor="number_of_turbines">Liczba turbin</Label>
          <Input
            id="number_of_turbines"
            name="number_of_turbines"
            type="number"
            required
            defaultValue={initialData?.number_of_turbines || ''}
            placeholder="25"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="commissioning_date">Data uruchomienia</Label>
        <Input
          id="commissioning_date"
          name="commissioning_date"
          type="date"
          defaultValue={
            initialData?.commissioning_date
              ? new Date(initialData.commissioning_date).toISOString().split('T')[0]
              : ''
          }
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj'}
      </Button>
    </form>
  )
}
