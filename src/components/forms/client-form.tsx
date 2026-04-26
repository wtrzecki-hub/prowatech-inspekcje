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
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const supabase = createClient()
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    // Wszystkie pola jako string — FormData.get() zwraca FormDataEntryValue | null,
    // ale dla <Input> zawsze otrzymujemy string. Trim + null-ify pustych stringów
    // żeby kolumny nullable dostały NULL zamiast "".
    const stringOrNull = (v: FormDataEntryValue | null) => {
      const s = typeof v === 'string' ? v.trim() : ''
      return s.length > 0 ? s : null
    }
    const data = {
      name: stringOrNull(formData.get('name')) ?? '',
      short_name: stringOrNull(formData.get('short_name')) ?? '',
      contact_person: stringOrNull(formData.get('contact_person')),
      contact_email: stringOrNull(formData.get('contact_email')),
      contact_phone: stringOrNull(formData.get('contact_phone')),
      nip: stringOrNull(formData.get('nip')),
    }

    try {
      if (initialData) {
        // Diagnostyka silent RLS fail: .select() po .update() zwraca array
        // zaktualizowanych wierszy. Pusty array = nic się nie zmieniło, mimo
        // że error: null (klasyczny RLS silent fail w Supabase).
        // eslint-disable-next-line no-console
        console.log('[ClientForm] UPDATE clients', { id: initialData.id, data })
        const { data: updated, error: updateError } = await supabase
          .from('clients')
          .update(data)
          .eq('id', initialData.id)
          .select()

        if (updateError) throw updateError
        // eslint-disable-next-line no-console
        console.log('[ClientForm] UPDATE result', { rows: updated?.length, updated })
        if (!updated || updated.length === 0) {
          throw new Error(
            'Aktualizacja nie zmieniła żadnego wiersza. Możliwe przyczyny: brak ' +
              'uprawnień (RLS), niewłaściwy ID klienta, lub klient został usunięty. ' +
              'Sprawdź konsolę przeglądarki (F12) i wklej Claude.'
          )
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('clients')
          .insert([data])
          .select()

        if (insertError) throw insertError
        if (!inserted || inserted.length === 0) {
          throw new Error(
            'Insert nie utworzył wiersza. Możliwe przyczyny: brak uprawnień (RLS) ' +
              'lub błąd unique constraint.'
          )
        }
      }

      setSuccess(true)
      // Po krótkim opóźnieniu chowamy banner sukcesu, żeby nie nakładał
      // się na ewentualny re-mount formularza po onSuccess()
      setTimeout(() => setSuccess(false), 3000)
      onSuccess?.()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ClientForm] Error', err)
      setError(err instanceof Error ? err.message : 'Błąd przy zapisywaniu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-danger-50 text-danger-800 border border-danger-100 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-success-50 text-success-800 border border-success-100 rounded-lg text-sm">
          Zapisano zmiany ✓
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
