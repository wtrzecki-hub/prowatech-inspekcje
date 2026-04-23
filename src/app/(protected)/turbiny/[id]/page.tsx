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
    }
  }

  const canUpload = userRole === 'admin' || userRole === 'inspector'

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-8 w-64 rounded-xl" />
        </div>
        <Skeleton className="h-[454px] w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    )
  }

  if (!turbine) {
    return (
      <div className="text-center py-12">
        <p className="text-graphite-500">Turbina nie znaleziona</p>
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
      <div className="flex items-center gap-4">
        <Button onClick={() => router.back()} variant="outline" size="sm" className="border-graphite-200">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Wróć
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-graphite-900">{turbine.manufacturer} {turbine.model}</h1>
          <p className="text-sm text-graphite-500">
            {turbine.wind_farms?.clients?.name} / {turbine.wind_farms?.name}
          </p>
        </div>
      </div>

      <Card className="rounded-xl border border-graphite-200 shadow-xs overflow-hidden">
        <CardContent className="p-5">
          <div style={{ display: 'flex', gap: '12px', height: '454px' }}>
            <div style={{ width: '265px', height: '454px', flexShrink: 0 }}>
              <PhotoSlot
                url={turbine.photo_url}
                alt={`Turbina ${turbine.manufacturer} ${turbine.model}`}
                canUpload={canUpload}
                isUploading={uploadingSlot === 1}
                onUpload={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/jpeg,image/png,image/webp'
                  input.onchange = (e) => handlePhotoUpload(e as React.ChangeEvent<HTMLInputElement>, 1)
                  input.click()
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '265px', flexShrink: 0 }}>
              <div style={{ width: '265px', height: '221px' }}>
                <PhotoSlot
                  url={turbine.photo_url_2}
                  alt="Zdjęcie 2"
                  canUpload={canUpload}
                  isUploading={uploadingSlot === 2}
                  onUpload={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/jpeg,image/png,image/webp'
                    input.onchange = (e) => handlePhotoUpload(e as React.ChangeEvent<HTMLInputElement>, 2)
                    input.click()
                  }}
                />
              </div>
              <div style={{ width: '265px', height: '221px' }}>
                <PhotoSlot
                  url={turbine.photo_url_3}
                  alt="Zdjęcie 3"
                  canUpload={canUpload}
                  isUploading={uploadingSlot === 3}
                  onUpload={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/jpeg,image/png,image/webp'
                    input.onchange = (e) => handlePhotoUpload(e as React.ChangeEvent<HTMLInputElement>, 3)
                    input.click()
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {turbine.next_inspection_date && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          isOverdue
            ? 'bg-danger-50 border-danger-100 text-danger-800'
            : daysUntilInspection !== null && daysUntilInspection <= 90
              ? 'bg-warning-50 border-warning-100 text-warning-800'
              : 'bg-success-50 border-success-100 text-success-800'
        }`}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {isOverdue
              ? `Przegląd przeterminowany! Termin: ${new Date(turbine.next_inspection_date).toLocaleDateString('pl-PL')}`
              : `Następny przegląd: ${new Date(turbine.next_inspection_date).toLocaleDateString('pl-PL')} (za ${daysUntilInspection} dni)`
            }
          </p>
        </div>
      )}

      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
            <Wind className="h-4 w-4 text-primary-600" />
            Dane techniczne
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <InfoItem label="Producent" value={turbine.manufacturer} />
            <InfoItem label="Model / Typ" value={turbine.model} />
            <InfoItem label="Moc znamionowa" value={turbine.rated_power_mw ? `${turbine.rated_power_mw} MW` : '-'} mono />
            <InfoItem label="Numer seryjny" value={turbine.serial_number} mono />
            <InfoItem label="Kod turbiny" value={turbine.turbine_code} mono />
            <InfoItem label="Wysokość wieży" value={turbine.tower_height_m ? `${turbine.tower_height_m} m` : '-'} mono />
            <InfoItem label="Średnica wirnika" value={turbine.rotor_diameter_m ? `${turbine.rotor_diameter_m} m` : '-'} mono />
            <InfoItem label="Wysokość piasty" value={turbine.hub_height_m ? `${turbine.hub_height_m} m` : '-'} mono />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary-600" />
            Lokalizacja
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <InfoItem label="Miejscowość" value={turbine.location_address} />
            <InfoItem label="Działka katastralna" value={turbine.cadastral_parcel} mono />
            <InfoItem label="Gmina" value={turbine.location_gmina} />
            <InfoItem label="Powiat" value={turbine.location_powiat} />
            <InfoItem label="Województwo" value={turbine.location_voivodeship} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400">Współrzędne</span>
              {turbine.latitude && turbine.longitude ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-medium text-graphite-900">
                    {turbine.latitude.toFixed(6)}°N, {turbine.longitude.toFixed(6)}°E
                  </span>
                  {googleMapsUrl && (
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-[13px] text-graphite-500">-</span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-graphite-100">
            <InfoItem label="Farma wiatrowa" value={turbine.wind_farms?.name} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary-600" />
            Dane kontroli
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <InfoItem
              label="Data ostatniego przeglądu"
              value={turbine.last_inspection_date
                ? new Date(turbine.last_inspection_date).toLocaleDateString('pl-PL')
                : 'Brak danych'}
              mono
            />
            <InfoItem
              label="Nr protokołu"
              value={turbine.last_inspection_protocol || 'Brak danych'}
              mono
            />
            <InfoItem
              label="Data następnego przeglądu"
              value={turbine.next_inspection_date
                ? new Date(turbine.next_inspection_date).toLocaleDateString('pl-PL')
                : 'Brak danych'}
              mono
              danger={!!isOverdue}
            />
          </div>
          {turbine.inspection_notes && (
            <div className="mt-4 p-3 bg-warning-50 border border-warning-100 rounded-xl">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-warning-800 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-warning-800">Uwagi</p>
                  <p className="text-sm text-warning-800 mt-1 opacity-80">{turbine.inspection_notes}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {turbine.previous_findings && turbine.previous_findings !== 'Brak robót' && (
        <Card className="rounded-xl border border-graphite-200 shadow-xs">
          <CardHeader className="border-b border-graphite-100 pb-4">
            <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-600" />
              Ustalenia i zalecenia z ostatniej kontroli
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
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
                        ? 'bg-success-50 text-success-800'
                        : isNotCompleted
                          ? 'bg-danger-50 text-danger-800'
                          : 'bg-graphite-100 text-graphite-500'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-graphite-800">{finding}</p>
                      {status && (
                        <p className={`text-xs mt-1 ${
                          isCompleted ? 'text-success-800' : isNotCompleted ? 'text-danger' : 'text-graphite-500'
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

      <div className="flex gap-3">
        <Button onClick={() => router.push(`/farmy/${turbine.wind_farm_id}`)}>
          Zobacz farmę
        </Button>
        <Button variant="outline" className="border-graphite-200" onClick={() => router.push(`/klienci/${turbine.wind_farms?.client_id}`)}>
          Zobacz klienta
        </Button>
      </div>
    </div>
  )
}

function PhotoSlot({
  url,
  alt,
  canUpload,
  isUploading,
  onUpload,
}: {
  url: string | null
  alt: string
  canUpload: boolean
  isUploading: boolean
  onUpload: () => void
}) {
  return (
    <div className="relative group w-full h-full">
      {url ? (
        <>
          <div className="w-full h-full bg-graphite-50 overflow-hidden border border-graphite-200 rounded-lg">
            <img src={url} alt={alt} className="w-full h-full object-cover" />
          </div>
          {canUpload && (
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
              <button
                onClick={onUpload}
                disabled={isUploading}
                className="bg-white hover:bg-graphite-50 text-graphite-800 text-xs font-medium px-3 py-1.5 rounded shadow flex items-center gap-1"
              >
                {isUploading ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Wgrywanie...</>
                ) : (
                  <><Camera className="h-3 w-3" /> Zmień</>
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className={`w-full h-full bg-graphite-50 border border-graphite-200 rounded-lg flex flex-col items-center justify-center gap-2 ${canUpload ? 'cursor-pointer hover:bg-graphite-100' : ''} transition-colors`}
          onClick={canUpload ? onUpload : undefined}
        >
          <Camera className="h-6 w-6 text-graphite-300" />
          {canUpload && (
            <p className="text-xs text-graphite-400">
              {isUploading ? 'Wgrywanie...' : 'Dodaj zdjęcie'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function InfoItem({ label, value, mono, danger }: { label: string; value?: string | null; mono?: boolean; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400">{label}</span>
      <span className={`text-[13px] font-medium ${mono ? 'font-mono' : ''} ${danger ? 'text-danger' : 'text-graphite-900'}`}>
        {value || '-'}
      </span>
    </div>
  )
}
