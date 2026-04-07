'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ClientFormProps {
  initialData?: {
    id: string
    name: string
    short_name: string
    contact_person: string
    contact_email: string
    contact_phone: string
    nip: string
  }
  onSuccess?: () => void
}

export function ClientForm({ initialData, onSuccess }: ClientFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const supabase = createClient()
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      short_name: formData.get('short_name'),
      contact_person: formData.get('contact_person'),
      contact_email: formData.get('contact_email'),
      contact_phone: formData.get('contact_phone'),
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
        <Label htmlFor="name">Nazwa</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={initialData?.name || ''}
          placeholder="Nazwa klienta"
        />
      </div>

      <div>
        <Label htmlFor="short_name">Nazwa skrócona</Label>
        <Input
          id="short_name"
          name="short_name"
          required
          defaultValue={initialData?.short_name || ''}
          placeholder="Np. ABC"
        />
      </div>

      <div>
        <Label htmlFor="contact_person">Osoba kontaktowa</Label>
        <Input
          id="contact_person"
          name="contact_person"
          defaultValue={initialData?.contact_person || ''}
          placeholder="Imię i nazwisko"
        />
      </div>

      <div>
        <Label htmlFor="contact_email">Email</Label>
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={initialData?.contact_email || ''}
          placeholder="email@example.com"
        />
      </div>

      <div>
        <Label htmlFor="contact_phone">Telefon</Label>
        <Input
          id="contact_phone"
          name="contact_phone"
          defaultValue={initialData?.contact_phone || ''}
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
