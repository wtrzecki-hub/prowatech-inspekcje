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
    nazwa: string
    client_id: string
    lokalizacja: string
    lokalizacja_szerokosc: number
    lokalizacja_dlugosc: number
    moc_laczna_mw: number
    liczba_turbin: number
    data_uruchomienia: string
  }
  onSuccess?: () => void
}

interface Client {
  id: string
  nazwa: string
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

  const supabase = createClient()

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nazwa')
        .eq('is_deleted', false)
        .order('nazwa')

      if (error) throw error
      setClients(data || [])
    } catch (err) {
      console.error('Błąd przy pobieraniu klientów:', err)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      nazwa: formData.get('nazwa'),
      client_id: selectedClient,
      lokalizacja: formData.get('lokalizacja'),
      lokalizacja_szerokosc: parseFloat(
        formData.get('lokalizacja_szerokosc') as string
      ),
      lokalizacja_dlugosc: parseFloat(
        formData.get('lokalizacja_dlugosc') as string
      ),
      moc_laczna_mw: parseFloat(formData.get('moc_laczna_mw') as string),
      liczba_turbin: parseInt(formData.get('liczba_turbin') as string),
      data_uruchomienia: formData.get('data_uruchomienia'),
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
                {client.nazwa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="nazwa">Nazwa farmy</Label>
        <Input
          id="nazwa"
          name="nazwa"
          required
          defaultValue={initialData?.nazwa || ''}
          placeholder="Nazwa farmy wiatrowej"
        />
      </div>

      <div>
        <Label htmlFor="lokalizacja">Lokalizacja</Label>
        <Input
          id="lokalizacja"
          name="lokalizacja"
          required
          defaultValue={initialData?.lokalizacja || ''}
          placeholder="Miejscowość"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lokalizacja_szerokosc">Szerokość (°N)</Label>
          <Input
            id="lokalizacja_szerokosc"
            name="lokalizacja_szerokosc"
            type="number"
            step="0.0001"
            defaultValue={initialData?.lokalizacja_szerokosc || ''}
            placeholder="52.1234"
          />
        </div>

        <div>
          <Label htmlFor="lokalizacja_dlugosc">Długość (°E)</Label>
          <Input
            id="lokalizacja_dlugosc"
            name="lokalizacja_dlugosc"
            type="number"
            step="0.0001"
            defaultValue={initialData?.lokalizacja_dlugosc || ''}
            placeholder="21.0123"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="moc_laczna_mw">Moc łączna (MW)</Label>
          <Input
            id="moc_laczna_mw"
            name="moc_laczna_mw"
            type="number"
            step="0.1"
            required
            defaultValue={initialData?.moc_laczna_mw || ''}
            placeholder="50.0"
          />
        </div>

        <div>
          <Label htmlFor="liczba_turbin">Liczba turbin</Label>
          <Input
            id="liczba_turbin"
            name="liczba_turbin"
            type="number"
            required
            defaultValue={initialData?.liczba_turbin || ''}
            placeholder="25"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="data_uruchomienia">Data uruchomienia</Label>
        <Input
          id="data_uruchomienia"
          name="data_uruchomienia"
          type="date"
          defaultValue={
            initialData?.data_uruchomienia
              ? new Date(initialData.data_uruchomienia).toISOString().split('T')[0]
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
