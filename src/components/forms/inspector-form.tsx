'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface InspectorFormProps {
  initialData?: {
    id: string
    imie: string
    nazwisko: string
    numer_uprawnien: string
    specjalnosc: string
    izba: string
    telefon: string
    email: string
    aktywny: boolean
  }
  onSuccess?: () => void
}

export function InspectorForm({ initialData, onSuccess }: InspectorFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aktywny, setAktywny] = useState(initialData?.aktywny ?? true)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const supabase = createClient()
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      imie: formData.get('imie'),
      nazwisko: formData.get('nazwisko'),
      numer_uprawnien: formData.get('numer_uprawnien'),
      specjalnosc: formData.get('specjalnosc'),
      izba: formData.get('izba'),
      telefon: formData.get('telefon'),
      email: formData.get('email'),
      aktywny: aktywny,
    }

    try {
      if (initialData) {
        const { error: updateError } = await supabase
          .from('inspectors')
          .update(data)
          .eq('id', initialData.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('inspectors')
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="imie">Imię</Label>
          <Input
            id="imie"
            name="imie"
            required
            defaultValue={initialData?.imie || ''}
            placeholder="Jan"
          />
        </div>

        <div>
          <Label htmlFor="nazwisko">Nazwisko</Label>
          <Input
            id="nazwisko"
            name="nazwisko"
            required
            defaultValue={initialData?.nazwisko || ''}
            placeholder="Kowalski"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="numer_uprawnien">Numer uprawnień</Label>
        <Input
          id="numer_uprawnien"
          name="numer_uprawnien"
          required
          defaultValue={initialData?.numer_uprawnien || ''}
          placeholder="123/2024"
        />
      </div>

      <div>
        <Label htmlFor="specjalnosc">Specjalność</Label>
        <Input
          id="specjalnosc"
          name="specjalnosc"
          required
          defaultValue={initialData?.specjalnosc || ''}
          placeholder="Elektryk, Mechanik, itp."
        />
      </div>

      <div>
        <Label htmlFor="izba">Izba</Label>
        <Input
          id="izba"
          name="izba"
          defaultValue={initialData?.izba || ''}
          placeholder="Izba Inżynierów"
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={initialData?.email || ''}
          placeholder="jan@example.com"
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

      <div className="flex items-center space-x-2">
        <Checkbox
          id="aktywny"
          checked={aktywny}
          onCheckedChange={(checked) => setAktywny(checked === true)}
        />
        <Label htmlFor="aktywny" className="font-normal">
          Inspektor aktywny
        </Label>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj'}
      </Button>
    </form>
  )
}
