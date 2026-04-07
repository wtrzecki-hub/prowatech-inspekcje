'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Wind, Calendar, FileText, AlertTriangle, ArrowLeft, ExternalLink, Camera, Loader2 } from 'lucide-react'

interface Turbine {
  id: string
  turbine_code: string
  manufacturer: string
  model: string
  rated_power_mw: number
  tower_height_m: number
  rotor_diameter_m: number
  hub_height_m: number
  serial_number: string
  location_address: string
  cadastral_parcel: string
  latitude: number | null
  longitude: number | null
  location_gmina: string | null
  location_powiat: string | null
  location_voivodeship: string | null
  last_inspection_date: string | null
  last_inspection_protocol: string | null
  next_inspection_date: string | null
  inspection_notes: string | null
  previous_findings: string | null
  previous_findings_status: string | null
  photo_url: string | null
  photo_url_2: string | null
  photo_url_3: string | null
  wind_farm_id: string
  wind_farms: {
    name: string
    client_id: string
    clients: {
      name: string
    }
  }
}

export default function TurbineDetailPage() {
  const router = useRouter()
  const params = useParams()
  const turbineId = params.id as string
  const [turbine, setTurbine] = useState<Turbine | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetchTurbineData()
    fetchUserRole()
  }, [turbineId])

  async function fetchUserRole() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      if (data) setUserRole(data.role)
    }
  }

  async function fetchTurbineData() {
    const supabase = createClient()
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('turbines')
        .select('*, wind_farms(name, client_id, clients(name))')
        .eq('id', turbineId)
        .single()

      if (error) throw error
      setTurbine(data)
    } catch (error) {
      console.error('Błąd przy pobieraniu danych turbiny:', error)
    } finally {
      setLoading(false)
    }
  }

  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 | 3) {
    const file = e.target.files?.[0]
    if (!file || !turbine) return

    setUploadingSlot(slot)
    try {
      const supabase = createClient()
      const safeName = turbine.serial_number.replace(/[^\w\-]/g, '_')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpeg'
      const suffix = slot === 1 ? '' : `_${slot}`
      const path = `${safeName}${suffix}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('turbine-photos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('turbine-photos')
        .getPublicUrl(path)

      const column = slot === 1 ? 'photo_url' : slot === 2 ? 'photo_url_2' : 'photo_url_3'
      const { error: updateError } = await supabase
        .from('turbines')
        .update({ [column]: urlData.publicUrl })
        .eq('id', turbine.id)

      if (updateError) throw updateError

      setTurbine({ ...turbine, [column]: urlData.publicUrl })
    } catch (error) {
      console.error('Błąd przy uploadzie zdjęcia:', error)
      alert('Nie udało się dodać zdjęcia. Spróbuj ponownie.')
    } finally {
      setUploadingSlot(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const canUpload = userRole === 'admin' || userRole === 'inspector'

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!turbine) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Turbina nie znaleziona</p>
        <Button onClick={() => router.back()} className="mt-4" variant="outline">
          Wróć
        </Button>
      </div>
    )
  }

  const isOverdue = turbine.next_inspection_date && new Date(turbine.next_inspection_date) < new Date()
  const daysUntilInspection = turbine.next_inspection_date
    ? Math.ceil((new Date(turbine.next_inspection_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  const googleMapsUrl = turbine.latitude && turbine.longitude
    ? `https://www.google.com/maps?q=${turbine.latitude},${turbine.longitude}`
    : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => router.back()} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Wróć
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{turbine.manufacturer} {turbine.model}</h1>
          <p className="text-muted-foreground">
            {turbine.wind_farms?.clients?.name} / {turbine.wind_farms?.name}
          </p>
        </div>
      </div>

      {/* Turbine photos - portrait left + 2 landscape right */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3" style={{ height: '420px' }}>
            {/* Left: portrait photo */}
            <PhotoSlot
              url={turbine.photo_url}
              alt={`Turbina ${turbine.manufacturer} ${turbine.model}`}
              aspect="portrait"
              canUpload={canUpload}
              isUploading={uploadingSlot === 1}
              onUpload={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/jpeg,image/png,image/webp'
                input.onchange = (e) => handlePhotoUpload(e as any, 1)
                input.click()
              }}
            />
            {/* Right: 2 landscape photos stacked */}
            <div className="flex flex-col gap-3 h-full">
              <PhotoSlot
                url={turbine.photo_url_2}
                alt="Zdjęcie 2"
                aspect="landscape"
                canUpload={canUpload}
                isUploading={uploadingSlot === 2}
                onUpload={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/jpeg,image/png,image/webp'
                  input.onchange = (e) => handlePhotoUpload(e as any, 2)
                  input.click()
                }}
              />
              <PhotoSlot
                url={turbine.photo_url_3}
                alt="Zdjęcie 3"
                aspect="landscape"
                canUpload={canUpload}
                isUploading={uploadingSlot === 3}
                onUpload={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/jpeg,image/png,image/webp'
                  input.onchange = (e) => handlePhotoUpload(e as any, 3)
                  input.click()
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert: Next inspection */}
      {turbine.next_inspection_date && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          isOverdue
            ? 'bg-red-50 border-red-200 text-red-800'
            : daysUntilInspection !== null && daysUntilInspection <= 90
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">
              {isOverdue
                ? `Przegląd przeterminowany! Termin: ${new Date(turbine.next_inspection_date).toLocaleDateString('pl-PL')}`
                : `Następny przegląd: ${new Date(turbine.next_inspection_date).toLocaleDateString('pl-PL')} (za ${daysUntilInspection} dni)`
              }
            </p>
          </div>
        </div>
      )}

      {/* Main info card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            Dane techniczne
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoItem label="Producent" value={turbine.manufacturer} />
            <InfoItem label="Model / Typ" value={turbine.model} />
            <InfoItem label="Moc znamionowa" value={turbine.rated_power_mw ? `${turbine.rated_power_mw} MW` : '-'} />
            <InfoItem label="Numer seryjny" value={turbine.serial_number} />
            <InfoItem label="Kod turbiny" value={turbine.turbine_code} />
            <InfoItem label="Wysokość wieży" value={turbine.tower_height_m ? `${turbine.tower_height_m} m` : '-'} />
            <InfoItem label="Średnica wirnika" value={turbine.rotor_diameter_m ? `${turbine.rotor_diameter_m} m` : '-'} />
            <InfoItem label="Wysokość piasty" value={turbine.hub_height_m ? `${turbine.hub_height_m} m` : '-'} />
          </div>
        </CardContent>
      </Card>

      {/* Location card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Lokalizacja
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoItem label="Miejscowość" value={turbine.location_address} />
            <InfoItem label="Działka" value={turbine.cadastral_parcel} />
            <InfoItem label="Gmina" value={turbine.location_gmina} />
            <InfoItem label="Powiat" value={turbine.location_powiat} />
            <InfoItem label="Województwo" value={turbine.location_voivodeship} />
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Współrzędne</p>
              {turbine.latitude && turbine.longitude ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {turbine.latitude.toFixed(6)}°N, {turbine.longitude.toFixed(6)}°E
                  </p>
                  {googleMapsUrl && (
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm">-</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <InfoItem label="Farma wiatrowa" value={turbine.wind_farms?.name} />
          </div>
        </CardContent>
      </Card>

      {/* Previous inspections card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dane kontroli
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoItem
              label="Data ostatniego przeglądu"
              value={turbine.last_inspection_date
                ? new Date(turbine.last_inspection_date).toLocaleDateString('pl-PL')
                : 'Brak danych'}
            />
            <InfoItem
              label="Nr protokołu"
              value={turbine.last_inspection_protocol || 'Brak danych'}
            />
            <InfoItem
              label="Data następnego przeglądu"
              value={turbine.next_inspection_date
                ? new Date(turbine.next_inspection_date).toLocaleDateString('pl-PL')
                : 'Brak danych'}
              highlight={isOverdue ? 'red' : undefined}
            />
          </div>
          {turbine.inspection_notes && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Uwagi</p>
                  <p className="text-sm text-amber-700 mt-1">{turbine.inspection_notes}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Previous findings */}
      {turbine.previous_findings && turbine.previous_findings !== 'Brak robót' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ustalenia i zalecenia z ostatniej kontroli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {turbine.previous_findings.split('\n').map((finding, i) => {
                const statusLines = turbine.previous_findings_status?.split('\n') || []
                const status = statusLines[i]?.trim()
                const isCompleted = status?.toLowerCase().startsWith('wykonano')
                const isNotCompleted = status?.toLowerCase().startsWith('nie wykonano')

                return (
                  <div key={i} className="flex gap-3 items-start">
                    <span className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCompleted
                        ? 'bg-green-100 text-green-700'
                        : isNotCompleted
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{finding}</p>
                      {status && (
                        <p className={`text-xs mt-1 ${
                          isCompleted ? 'text-green-600' : isNotCompleted ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {status}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={() => router.push(`/farmy/${turbine.wind_farm_id}`)}>
          Zobacz farmę
        </Button>
        <Button variant="outline" onClick={() => router.push(`/klienci/${turbine.wind_farms?.client_id}`)}>
          Zobacz klienta
        </Button>
      </div>
    </div>
  )
}

function PhotoSlot({
  url,
  alt,
  aspect,
  canUpload,
  isUploading,
  onUpload,
}: {
  url: string | null
  alt: string
  aspect: 'portrait' | 'landscape'
  canUpload: boolean
  isUploading: boolean
  onUpload: () => void
}) {
  return (
    <div className={`relative group ${aspect === 'portrait' ? 'h-full' : 'flex-1'}`}>
      {url ? (
        <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
          <img src={url} alt={alt} className="w-full h-full object-cover" />
          {canUpload && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <button
                onClick={onUpload}
                disabled={isUploading}
                className="bg-white/90 hover:bg-white text-gray-800 text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1"
              >
                {isUploading ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Wgrywanie...</>
                ) : (
                  <><Camera className="h-3 w-3" /> Zmień</>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className="w-full h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-colors"
          onClick={canUpload ? onUpload : undefined}
        >
          <Camera className="h-8 w-8 text-gray-300" />
          {canUpload && (
            <p className="text-xs text-gray-400">
              {isUploading ? 'Wgrywanie...' : 'Dodaj zdjęcie'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function InfoItem({ label, value, highlight }: { label: string; value: string | number | null | undefined; highlight?: 'red' }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-medium ${
        highlight === 'red' ? 'text-red-600 font-semibold' : ''
      }`}>
        {value || '-'}
      </p>
    </div>
  )
}
