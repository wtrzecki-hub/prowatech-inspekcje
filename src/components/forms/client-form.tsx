'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ClientFormProps {
  initialData?: {
    id: string
    nazwa: string
    nazwa_skrocona: string
    osoba_kontaktowa: string
    email: string
    telefon: string
    nip: string
  }
  onSuccess?: () => void
}

export function ClientForm({ initialData, onSuccess }: ClientFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      nazwa: formData.get('nazwa'),
      nazwa_skrocona: formData.get('nazwa_skrocona'),
      osoba_kontaktowa: formData.get('osoba_kontaktowa'),
      email: formData.get('email'),
      telefon: formData.get('telefon'),
      nip: formData.get('nip'),
    }

    try {
      if (initialData) {
        const { error: updateError } = await supabase
          .from('clients')
          .update(data)
          .eq('id', initialData.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('clients')
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
        <Label htmlFor="nazwa">Nazwa</Label>
        <Input
          id="nazwa"
          name="nazwa"
          required
          defaultValue={initialData?.nazwa || ''}
          placeholder="Nazwa klienta"
        />
      </div>

      <div>
        <Label htmlFor="nazwa_skrocona">Nazwa skrócona</Label>
        <Input
          id="nazwa_skrocona"
          name="nazwa_skrocona"
          required
          defaultValue={initialData?.nazwa_skrocona || ''}
          placeholder="Np. ABC"
        />
      </div>

      <div>
        <Label htmlFor="osoba_kontaktowa">Osoba kontaktowa</Label>
        <Input
          id="osoba_kontaktowa"
          name="osoba_kontaktowa"
          defaultValue={initialData?.osoba_kontaktowa || ''}
          placeholder="Imię i nazwisko"
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initialData?.email || ''}
          placeholder="email@example.com"
        />
      </div>

      <div>
        <Label htmlFor="telefon">Telefon</Label>
        <Input
          id="telefon"
          name="telefon"
          defaultValue={initialData?.telefon || ''}
          placeholder="+48 123 456 789"
        />
      </div>

      <div>
        <Label htmlFor="nip">NIP</Label>
        <Input
          id="nip"
          name="nip"
          defaultValue={initialData?.nip || ''}
          placeholder="NIP"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj'}
      </Button>
    </form>
  )
}
