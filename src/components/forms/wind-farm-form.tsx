'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
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

interface WindFarmFormProps {
  clientId?: string
  initialData?: {
    id: string
    name: string
    client_id: string
    location_address: string | null
    location_gmina?: string | null
    location_powiat?: string | null
    location_voivodeship?: string | null
    latitude: number | null
    longitude: number | null
    total_capacity_mw: number | null
    number_of_turbines: number | null
    commissioning_date: string | null
    area_label?: string | null
    notes?: string | null
    google_drive_folder_url?: string | null
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
  const [selectedClient, setSelectedClient] = useState(clientId || initialData?.client_id || '')

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
    const str = (k: string) => {
      const v = formData.get(k)
      const s = typeof v === 'string' ? v.trim() : ''
      return s === '' ? null : s
    }
    const num = (k: string) => {
      const v = str(k)
      if (v === null) return null
      const n = parseFloat(v)
      return Number.isFinite(n) ? n : null
    }
    const int = (k: string) => {
      const v = str(k)
      if (v === null) return null
      const n = parseInt(v)
      return Number.isFinite(n) ? n : null
    }
    const data = {
      name: str('name'),
      client_id: selectedClient,
      location_address: str('location_address'),
      location_gmina: str('location_gmina'),
      location_powiat: str('location_powiat'),
      location_voivodeship: str('location_voivodeship'),
      latitude: num('latitude'),
      longitude: num('longitude'),
      total_capacity_mw: num('total_capacity_mw'),
      number_of_turbines: int('number_of_turbines'),
      commissioning_date: str('commissioning_date'),
      area_label: str('area_label'),
      notes: str('notes'),
      google_drive_folder_url: str('google_drive_folder_url'),
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
            <SelectValue placeholder="Wybierz klienta">
              {selectedClient && clients.find((c) => c.id === selectedClient)?.name}
            </SelectValue>
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
        <Label htmlFor="location_address">Miejscowość</Label>
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
          <Label htmlFor="location_gmina">Gmina</Label>
          <Input
            id="location_gmina"
            name="location_gmina"
            defaultValue={initialData?.location_gmina || ''}
            placeholder="np. Skoki"
          />
        </div>
        <div>
          <Label htmlFor="location_powiat">Powiat</Label>
          <Input
            id="location_powiat"
            name="location_powiat"
            defaultValue={initialData?.location_powiat || ''}
            placeholder="np. wągrowiecki"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="location_voivodeship">Województwo</Label>
          <Input
            id="location_voivodeship"
            name="location_voivodeship"
            defaultValue={initialData?.location_voivodeship || ''}
            placeholder="np. wielkopolskie"
          />
        </div>
        <div>
          <Label htmlFor="area_label">Etykieta obszaru</Label>
          <Input
            id="area_label"
            name="area_label"
            defaultValue={initialData?.area_label || ''}
            placeholder="np. POTEGOWO obszar A"
          />
        </div>
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

      <div>
        <Label htmlFor="google_drive_folder_url">Folder Google Drive (URL)</Label>
        <Input
          id="google_drive_folder_url"
          name="google_drive_folder_url"
          type="url"
          defaultValue={initialData?.google_drive_folder_url || ''}
          placeholder="https://drive.google.com/..."
        />
      </div>

      <div>
        <Label htmlFor="notes">Notatki</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={initialData?.notes || ''}
          placeholder="Dodatkowe informacje o farmie"
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj'}
      </Button>
    </form>
  )
}
