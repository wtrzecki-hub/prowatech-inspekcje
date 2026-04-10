'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ExternalLink } from 'lucide-react'

interface InspectorFormProps {
  initialData?: {
    id: string
    full_name: string
    license_number: string
    specialty: string
    specialty_description: string | null
    chamber_membership: string
    chamber_certificate_number?: string | null
    chamber_expiry_date?: string | null
    chamber_scan_url?: string | null
    license_scan_url?: string | null
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

const SPECIALTIES = [
  { value: 'konstrukcyjna', label: 'Konstrukcyjno-budowlana' },
  { value: 'elektryczna', label: 'Elektryczna' },
  { value: 'sanitarna', label: 'Sanitarna' },
  { value: 'inna', label: 'Inna' },
]

export function InspectorForm({ initialData, onSuccess }: InspectorFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aktywny, setAktywny] = useState(initialData?.is_active ?? true)
  const [specialty, setSpecialty] = useState(initialData?.specialty || 'konstrukcyjna')

  // File uploads
  const [licenseScanFile, setLicenseScanFile] = useState<File | null>(null)
  const [chamberScanFile, setChamberScanFile] = useState<File | null>(null)
  const [gwoFile, setGwoFile] = useState<File | null>(null)
  const [udtFile, setUdtFile] = useState<File | null>(null)
  const [sepFile, setSepFile] = useState<File | null>(null)

  async function uploadScan(inspectorId: string, name: string, file: File): Promise<string | null> {
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'pdf'
    const path = `inspectors/${inspectorId}/${name}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('inspector-docs')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (uploadError) {
      console.error(`Upload ${name} error:`, uploadError)
      return null
    }
    const { data } = supabase.storage.from('inspector-docs').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const formData = new FormData(e.currentTarget)

    const data: Record<string, unknown> = {
      full_name: `${formData.get('imie')} ${formData.get('nazwisko')}`.trim(),
      license_number: formData.get('numer_uprawnien'),
      specialty: specialty,
      specialty_description: (formData.get('specjalnosc_opis') as string) || null,
      chamber_membership: formData.get('izba'),
      chamber_certificate_number: (formData.get('izba_numer') as string) || null,
      chamber_expiry_date: (formData.get('izba_waznosc') as string) || null,
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

      // Upload scans
      if (inspectorId) {
        const scanUpdates: Record<string, string | null> = {}
        if (licenseScanFile) {
          const url = await uploadScan(inspectorId, 'uprawnienia', licenseScanFile)
          if (url) scanUpdates.license_scan_url = url
        }
        if (chamberScanFile) {
          const url = await uploadScan(inspectorId, 'izba', chamberScanFile)
          if (url) scanUpdates.chamber_scan_url = url
        }
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

  function ScanLink({ url, label }: { url?: string | null; label: string }) {
    if (!url) return null
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
        <ExternalLink className="h-3 w-3" /> {label}
      </a>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
      )}

      {/* Dane osobowe */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="imie">Imię</Label>
          <Input id="imie" name="imie" required className="h-12"
            defaultValue={initialData?.full_name?.split(' ')[0] || ''} placeholder="Jan" />
        </div>
        <div>
          <Label htmlFor="nazwisko">Nazwisko</Label>
          <Input id="nazwisko" name="nazwisko" required className="h-12"
            defaultValue={initialData?.full_name?.split(' ').slice(1).join(' ') || ''} placeholder="Kowalski" />
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required className="h-12"
          defaultValue={initialData?.email || ''} placeholder="jan@example.com" />
      </div>

      <div>
        <Label htmlFor="telefon">Telefon</Label>
        <Input id="telefon" name="telefon" className="h-12"
          defaultValue={initialData?.phone || ''} placeholder="+48 123 456 789" />
      </div>

      {/* Uprawnienia budowlane */}
      <div className="p-3 border rounded-lg space-y-3 bg-blue-50/50">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Uprawnienia budowlane</p>
        <div>
          <Label htmlFor="numer_uprawnien">Numer ewidencyjny uprawnień</Label>
          <Input id="numer_uprawnien" name="numer_uprawnien" required className="h-12"
            defaultValue={initialData?.license_number || ''} placeholder="np. KUP/0113/OWOK/05" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Specjalność</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="specjalnosc_opis">Opis specjalności</Label>
            <Input id="specjalnosc_opis" name="specjalnosc_opis" className="h-12"
              defaultValue={initialData?.specialty_description || ''}
              placeholder="np. bez ograniczeń" />
          </div>
        </div>
        <div>
          <Label>Skan uprawnień (PDF/JPG)</Label>
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="h-10 text-sm"
            onChange={(e) => setLicenseScanFile(e.target.files?.[0] || null)} />
          <ScanLink url={initialData?.license_scan_url} label="Aktualny skan uprawnień" />
        </div>
      </div>

      {/* Izba Inżynierów */}
      <div className="p-3 border rounded-lg space-y-3 bg-green-50/50">
        <p className="text-xs font-bold uppercase tracking-wider text-green-700">Izba Inżynierów</p>
        <div>
          <Label htmlFor="izba">Nazwa izby</Label>
          <Input id="izba" name="izba" className="h-12"
            defaultValue={initialData?.chamber_membership || ''}
            placeholder="np. Kujawsko-Pomorska OIIB" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="izba_numer">Nr zaświadczenia</Label>
            <Input id="izba_numer" name="izba_numer" className="h-12"
              defaultValue={initialData?.chamber_certificate_number || ''}
              placeholder="np. KUP/BO/0189/06" />
          </div>
          <div>
            <Label htmlFor="izba_waznosc">Ważne do</Label>
            <Input id="izba_waznosc" name="izba_waznosc" type="date" className="h-12"
              defaultValue={initialData?.chamber_expiry_date || ''} />
          </div>
        </div>
        <div>
          <Label>Skan zaświadczenia (PDF/JPG)</Label>
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="h-10 text-sm"
            onChange={(e) => setChamberScanFile(e.target.files?.[0] || null)} />
          <ScanLink url={initialData?.chamber_scan_url} label="Aktualny skan zaświadczenia" />
        </div>
      </div>

      {/* GWO */}
      <div className="p-3 border rounded-lg space-y-3 bg-cyan-50/50">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">GWO (Global Wind Organisation)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="gwo_number">WINDA ID</Label>
            <Input id="gwo_number" name="gwo_number" className="h-12"
              defaultValue={initialData?.gwo_certificate_number || ''}
              placeholder="np. WT335238PL" />
          </div>
          <div>
            <Label htmlFor="gwo_expiry">Data ważności</Label>
            <Input id="gwo_expiry" name="gwo_expiry" type="date" className="h-12"
              defaultValue={initialData?.gwo_expiry_date || ''} />
          </div>
        </div>
        <div>
          <Label>Skan certyfikatu GWO (PDF/JPG)</Label>
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="h-10 text-sm"
            onChange={(e) => setGwoFile(e.target.files?.[0] || null)} />
          <ScanLink url={initialData?.gwo_scan_url} label="Aktualny skan GWO" />
        </div>
      </div>

      {/* UDT */}
      <div className="p-3 border rounded-lg space-y-3 bg-orange-50/50">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-700">UDT</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="udt_number">Nr certyfikatu</Label>
            <Input id="udt_number" name="udt_number" className="h-12"
              defaultValue={initialData?.udt_certificate_number || ''}
              placeholder="np. UDT-2024-001" />
          </div>
          <div>
            <Label htmlFor="udt_expiry">Data ważności</Label>
            <Input id="udt_expiry" name="udt_expiry" type="date" className="h-12"
              defaultValue={initialData?.udt_expiry_date || ''} />
          </div>
        </div>
        <div>
          <Label>Skan certyfikatu UDT (PDF/JPG)</Label>
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="h-10 text-sm"
            onChange={(e) => setUdtFile(e.target.files?.[0] || null)} />
          <ScanLink url={initialData?.udt_scan_url} label="Aktualny skan UDT" />
        </div>
      </div>

      {/* SEP */}
      <div className="p-3 border rounded-lg space-y-3 bg-purple-50/50">
        <p className="text-xs font-bold uppercase tracking-wider text-purple-700">SEP</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sep_number">Nr certyfikatu</Label>
            <Input id="sep_number" name="sep_number" className="h-12"
              defaultValue={initialData?.sep_certificate_number || ''}
              placeholder="np. SEP-E-1/2024" />
          </div>
          <div>
            <Label htmlFor="sep_expiry">Data ważności</Label>
            <Input id="sep_expiry" name="sep_expiry" type="date" className="h-12"
              defaultValue={initialData?.sep_expiry_date || ''} />
          </div>
        </div>
        <div>
          <Label>Skan certyfikatu SEP (PDF/JPG)</Label>
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="h-10 text-sm"
            onChange={(e) => setSepFile(e.target.files?.[0] || null)} />
          <ScanLink url={initialData?.sep_scan_url} label="Aktualny skan SEP" />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="aktywny" checked={aktywny}
          onCheckedChange={(checked) => setAktywny(checked === true)} />
        <Label htmlFor="aktywny" className="font-normal">Inspektor aktywny</Label>
      </div>

      <Button type="submit" disabled={loading} className="w-full h-12">
        {loading ? 'Zapisywanie...' : initialData ? 'Zaktualizuj' : 'Dodaj inspektora'}
      </Button>
    </form>
  )
}
