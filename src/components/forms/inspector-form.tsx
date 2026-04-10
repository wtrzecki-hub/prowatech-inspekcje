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
    full_name: string
    license_number: string
    specialty: string
    chamber_membership: string
    phone: string
    email: string
    is_active: boolean
    gwo_certificate_number?: string | null
    gwo_expiry_date?: string | null
    gwo_scan_url?: string | null
    udt_certificate_number?: string | null
    udt_expiry_date?: string | null
    udt_scan_url?: string | null
    sep_certificate_number?: string | null
    sep_expiry_date?: string | null
    sep_scan_url?: string | null
  }
  onSuccess?: () => void
}

interface CertSection {
  key: 'gwo' | 'udt' | 'sep'
  label: string
}

const CERT_SECTIONS: CertSection[] = [
  { key: 'gwo', label: 'GWO' },
  { key: 'udt', label: 'UDT' },
  { key: 'sep', label: 'SEP' },
]

export function InspectorForm({ initialData, onSuccess }: InspectorFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aktywny, setAktywny] = useState(initialData?.is_active ?? true)

  // Certificate scan files
  const [gwoFile, setGwoFile] = useState<File | null>(null)
  const [udtFile, setUdtFile] = useState<File | null>(null)
  const [sepFile, setSepFile] = useState<File | null>(null)

  async function uploadScan(inspectorId: string, certKey: CertSection['key'], file: File): Promise<string | null> {
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'pdf'
    const path = `inspectors/${inspectorId}/${certKey}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('inspector-docs')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (uploadError) {
      console.error(`Upload ${certKey} error:`, uploadError)
      return null
    }
    const { data } = supabase.storage.from('inspector-docs').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const supabase = createClient()
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const data: Record<string, unknown> = {
      full_name: `${formData.get('imie')} ${formData.get('nazwisko')}`.trim(),
      license_number: formData.get('numer_uprawnien'),
      specialty: formData.get('specjalnosc'),
      chamber_membership: formData.get('izba'),
      phone: formData.get('telefon'),
      email: formData.get('email'),
      is_active: aktywny,
      gwo_certificate_number: (formData.get('gwo_number') as string) || null,
      gwo_expiry_date: (formData.get('gwo_expiry') as string) || null,
      udt_certificate_number: (formData.get('udt_number') as string) || null,
      udt_expiry_date: (formData.get('udt_expiry') as string) || null,
      sep_certificate_number: (formData.get('sep_number') as string) || null,
      sep_expiry_date: (formData.get('sep_expiry') as string) || null,
    }

    try {
      let inspectorId = initialData?.id

      if (initialData) {
        const { error: updateError } = await supabase
          .from('inspectors')
          .update(data)
          .eq('id', initialData.id)
        if (updateError) throw updateError
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('inspectors')
          .insert([data])
          .select('id')
          .single()
        if (insertError) throw insertError
        inspectorId = inserted.id
      }

      // Upload scans if provided
      if (inspectorId) {
        const scanUpdates: Record<string, string | null> = {}
        if (gwoFile) {
          const url = await uploadScan(inspectorId, 'gwo', gwoFile)
          if (url) scanUpdates.gwo_scan_url = url
        }
        if (udtFile) {
          const url = await uploadScan(inspectorId, 'udt', udtFile)
          if (url) scanUpdates.udt_scan_url = url
        }
        if (sepFile) {
          const url = await uploadScan(inspectorId, 'sep', sepFile)
          if (url) scanUpdates.sep_scan_url = url
        }
        if (Object.keys(scanUpdates).length > 0) {
          await supabase.from('inspectors').update(scanUpdates).eq('id', inspectorId)
        }
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd przy zapisywaniu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
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
            className="h-12"
            defaultValue={initialData?.full_name?.split(' ')[0] || ''}
            placeholder="Jan"
          />
        </div>

        <div>
          <Label htmlFor="nazwisko">Nazwisko</Label>
          <Input
            id="nazwisko"
            name="nazwisko"
            required
            className="h-12"
            defaultValue={initialData?.full_name?.split(' ').slice(1).join(' ') || ''}
            placeholder="Kowalski"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="numer_uprawnien">Numer uprawnień budowlanych</Label>
        <Input
          id="numer_uprawnien"
          name="numer_uprawnien"
          required
          className="h-12"
          defaultValue={initialData?.license_number || ''}
          placeholder="123/2024"
        />
      </div>

      <div>
        <Label htmlFor="specjalnosc">Specjalność</Label>
        <Input
          id="specjalnosc"
          name="specjalnosc"
          required
          className="h-12"
          defaultValue={initialData?.specialty || ''}
          placeholder="Elektryk, Mechanik, itp."
        />
      </div>

      <div>
        <Label htmlFor="izba">Izba</Label>
        <Input
          id="izba"
          name="izba"
          className="h-12"
          defaultValue={initialData?.chamber_membership || ''}
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
          className="h-12"
          defaultValue={initialData?.email || ''}
          placeholder="jan@example.com"
        />
      </div>

      <div>
        <Label htmlFor="telefon">Telefon</Label>
        <Input
          id="telefon"
          name="telefon"
          className="h-12"
          defaultValue={initialData?.phone || ''}
          placeholder="+48 123 456 789"
        />
      </div>

      {/* ── Uprawnienia GWO / UDT / SEP ─────────────────────── */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Uprawnienia branżowe</p>
        <div className="space-y-4">
          {CERT_SECTIONS.map(({ key, label }) => {
            const numberField = `${key}_number`
            const expiryField = `${key}_expiry`
            const defaultNumber = initialData?.[`${key}_certificate_number` as keyof typeof initialData] as string | null
            const defaultExpiry = initialData?.[`${key}_expiry_date` as keyof typeof initialData] as string | null
            const existingScan = initialData?.[`${key}_scan_url` as keyof typeof initialData] as string | null
            const setFile = key === 'gwo' ? setGwoFile : key === 'udt' ? setUdtFile : setSepFile

            return (
              <div key={key} className="p-3 border rounded-lg space-y-2 bg-gray-50/50">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={numberField} className="text-xs">Nr certyfikatu</Label>
                    <Input
                      id={numberField}
                      name={numberField}
                      className="h-10 text-sm"
                      defaultValue={defaultNumber || ''}
                      placeholder={`${label}-2024-001`}
                    />
                  </div>
                  <div>
                    <Label htmlFor={expiryField} className="text-xs">Data ważności</Label>
                    <Input
                      id={expiryField}
                      name={expiryField}
                      type="date"
                      className="h-10 text-sm"
                      defaultValue={defaultExpiry || ''}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Skan certyfikatu (PDF/JPG)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="h-10 text-sm file:mr-2 file:text-xs"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {existingScan && (
                    <a
                      href={existingScan}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Aktualny skan →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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

      <Button type="submit" disabled={loading} className="w-full h-12">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj'}
      </Button>
    </form>
  )
}
