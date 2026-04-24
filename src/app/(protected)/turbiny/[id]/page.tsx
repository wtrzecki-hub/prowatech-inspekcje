'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MapPin,
  Wind,
  Calendar,
  FileText,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Camera,
  Loader2,
  Plus,
  ClipboardCheck,
  Download,
  TrendingUp,
  Clock,
  Wrench,
  CheckCircle2,
  Filter,
  ImageIcon,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'

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

// ───── Typy i mapowania dla wykresu oceny i kart KPI ─────────────────────────

type RatingKey = 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny'

// Skala Y: im wyżej, tym lepiej (Dobry=5, Awaryjny=1).
const RATING_Y: Record<RatingKey, number> = {
  dobry: 5,
  zadowalajacy: 4,
  sredni: 3,
  zly: 2,
  awaryjny: 1,
}

const RATING_LABEL: Record<RatingKey, string> = {
  dobry: 'Dobry',
  zadowalajacy: 'Zadowalający',
  sredni: 'Średni',
  zly: 'Zły',
  awaryjny: 'Awaryjny',
}

const RATING_LABEL_SHORT: Record<number, string> = {
  5: 'Dobry',
  4: 'Zadow.',
  3: 'Średni',
  2: 'Zły',
  1: 'Awaryj.',
}

interface InspectionHistoryRow {
  id: string
  protocol_number: string | null
  inspection_date: string | null
  inspection_type: 'annual' | 'five_year'
  overall_condition_rating: RatingKey | null
  next_annual_date: string | null
  next_five_year_date: string | null
  next_electrical_date: string | null
  inspection_inspectors?: {
    is_lead: boolean | null
    inspector: { full_name: string | null } | null
  }[]
}

// ───── Pilność zaleceń (enum urgency_level: I/II/III/IV) ─────────────────────

type UrgencyKey = 'I' | 'II' | 'III' | 'IV'

const URGENCY_UI: Record<UrgencyKey, { bg: string; text: string; label: string }> = {
  I: { bg: 'bg-danger-50', text: 'text-danger-800', label: 'I · Krytyczna' },
  II: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'II · Wysoka' },
  III: { bg: 'bg-info-50', text: 'text-info-700', label: 'III · Średnia' },
  IV: { bg: 'bg-graphite-100', text: 'text-graphite-700', label: 'IV · Niska' },
}

interface RepairRow {
  id: string
  urgency_level: UrgencyKey | null
  element_name: string | null
  scope_description: string | null
  repair_type: string | null
  deadline_date: string | null
  is_completed: boolean
  inspection_id: string
  inspections: {
    inspection_date: string | null
    protocol_number: string | null
  } | null
}

interface InspectionPhotoRow {
  id: string
  file_url: string | null
  thumbnail_url: string | null
  description: string | null
  photo_number: number | null
  taken_at: string | null
  inspection_id: string
  inspections: {
    protocol_number: string | null
    inspection_date: string | null
  } | null
}

interface HistoricalRow {
  id: string
  protocol_number: string | null
  inspection_date: string | null
  inspection_type: 'annual' | 'five_year' | null
  pdf_url: string | null
  summary_notes: string | null
}

interface CertInspectorRow {
  id: string
  full_name: string
  gwo_certificate_number: string | null
  gwo_expiry_date: string | null
  udt_certificate_number: string | null
  udt_expiry_date: string | null
  sep_certificate_number: string | null
  sep_expiry_date: string | null
  chamber_certificate_number: string | null
  chamber_expiry_date: string | null
  chamber_membership: string | null
}

export default function TurbineDetailPage() {
  const router = useRouter()
  const params = useParams()
  const turbineId = params.id as string
  const [turbine, setTurbine] = useState<Turbine | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [inspectionsCount, setInspectionsCount] = useState(0)
  const [openRecsCount, setOpenRecsCount] = useState(0)
  const [inspectionsHistory, setInspectionsHistory] = useState<InspectionHistoryRow[]>([])
  const [repairs, setRepairs] = useState<RepairRow[]>([])
  const [showOnlyOpen, setShowOnlyOpen] = useState(true)
  const [photos, setPhotos] = useState<InspectionPhotoRow[]>([])
  const [certInspectors, setCertInspectors] = useState<CertInspectorRow[]>([])
  const [historical, setHistorical] = useState<HistoricalRow[]>([])

  useEffect(() => {
    fetchTurbineData()
    fetchUserRole()
    fetchCounters()
    fetchInspectionsHistory()
    fetchRepairs()
    fetchPhotos()
    fetchCertInspectors()
    fetchHistorical()
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
      setTurbine(data as unknown as Turbine)
    } catch (e) {
      console.error('Error fetching turbine:', e)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCounters() {
    const supabase = createClient()
    try {
      // Liczba inspekcji tej turbiny (bez skasowanych)
      const { count: insp } = await supabase
        .from('inspections')
        .select('*', { count: 'exact', head: true })
        .eq('turbine_id', turbineId)
        .not('is_deleted', 'is', true)
      setInspectionsCount(insp || 0)

      // Liczba otwartych zaleceń (inner join przez inspections.turbine_id)
      const { count: recs } = await supabase
        .from('repair_recommendations')
        .select('*, inspections!inner(turbine_id, is_deleted)', {
          count: 'exact',
          head: true,
        })
        .eq('is_completed', false)
        .eq('inspections.turbine_id', turbineId)
        .not('inspections.is_deleted', 'is', true)
      setOpenRecsCount(recs || 0)
    } catch (e) {
      console.error('Error fetching counters:', e)
    }
  }

  async function fetchInspectionsHistory() {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select(`
          id,
          protocol_number,
          inspection_date,
          inspection_type,
          overall_condition_rating,
          next_annual_date,
          next_five_year_date,
          next_electrical_date,
          inspection_inspectors(
            is_lead,
            inspector:inspectors(full_name)
          )
        `)
        .eq('turbine_id', turbineId)
        .not('is_deleted', 'is', true)
        .order('inspection_date', { ascending: false })
        .limit(50)
      if (error) throw error
      setInspectionsHistory((data || []) as unknown as InspectionHistoryRow[])
    } catch (e) {
      console.error('Error fetching inspections history:', e)
    }
  }

  async function fetchHistorical() {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('historical_protocols')
        .select('id, protocol_number, inspection_date, inspection_type, pdf_url, summary_notes')
        .eq('turbine_id', turbineId)
        .not('is_deleted', 'is', true)
        .order('inspection_date', { ascending: false, nullsFirst: false })
      if (error) throw error
      setHistorical((data || []) as HistoricalRow[])
    } catch (e) {
      console.error('Error fetching historical protocols:', e)
    }
  }

  async function fetchPhotos() {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('inspection_photos')
        .select(`
          id,
          file_url,
          thumbnail_url,
          description,
          photo_number,
          taken_at,
          inspection_id,
          inspections!inner(turbine_id, is_deleted, protocol_number, inspection_date)
        `)
        .eq('inspections.turbine_id', turbineId)
        .not('inspections.is_deleted', 'is', true)
        .order('photo_number', { ascending: true, nullsFirst: false })
      if (error) throw error
      setPhotos((data || []) as unknown as InspectionPhotoRow[])
    } catch (e) {
      console.error('Error fetching photos:', e)
    }
  }

  async function fetchCertInspectors() {
    // Certyfikaty zespołu ostatniej inspekcji tej turbiny.
    const supabase = createClient()
    try {
      const { data: lastInsp } = await supabase
        .from('inspections')
        .select(`
          id,
          inspection_inspectors(
            inspector_id,
            inspector:inspectors(
              id,
              full_name,
              gwo_certificate_number,
              gwo_expiry_date,
              udt_certificate_number,
              udt_expiry_date,
              sep_certificate_number,
              sep_expiry_date,
              chamber_certificate_number,
              chamber_expiry_date,
              chamber_membership
            )
          )
        `)
        .eq('turbine_id', turbineId)
        .not('is_deleted', 'is', true)
        .order('inspection_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const rels = (lastInsp?.inspection_inspectors ?? []) as unknown as {
        inspector: CertInspectorRow | null
      }[]
      const list = rels
        .map((r) => r.inspector)
        .filter((x): x is CertInspectorRow => x !== null)
      setCertInspectors(list)
    } catch (e) {
      console.error('Error fetching cert inspectors:', e)
    }
  }

  async function fetchRepairs() {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('repair_recommendations')
        .select(`
          id,
          urgency_level,
          element_name,
          scope_description,
          repair_type,
          deadline_date,
          is_completed,
          inspection_id,
          inspections!inner(turbine_id, is_deleted, inspection_date, protocol_number)
        `)
        .eq('inspections.turbine_id', turbineId)
        .not('inspections.is_deleted', 'is', true)
        .order('deadline_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      setRepairs((data || []) as unknown as RepairRow[])
    } catch (e) {
      console.error('Error fetching repairs:', e)
    }
  }

  const canUpload = userRole === 'admin' || userRole === 'inspector'
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 | 3) {
    const file = e.target.files?.[0]
    if (!file || !turbine) return
    setUploadingSlot(slot)
    try {
      const supabase = createClient()
      const safeName = turbine.serial_number.replace(/[^\w\-]/g, '_')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpeg'
      const fileName = `${safeName}_${slot}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('turbine-photos')
        .upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: publicUrlData } = supabase.storage
        .from('turbine-photos')
        .getPublicUrl(fileName)
      const field = slot === 1 ? 'photo_url' : slot === 2 ? 'photo_url_2' : 'photo_url_3'
      const { error: updErr } = await supabase
        .from('turbines')
        .update({ [field]: publicUrlData.publicUrl })
        .eq('id', turbineId)
      if (updErr) throw updErr
      await fetchTurbineData()
    } catch (err) {
      console.error('Photo upload failed:', err)
      alert('Nie udało się wgrać zdjęcia. Spróbuj ponownie.')
    } finally {
      setUploadingSlot(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!turbine) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-graphite-500">Nie znaleziono turbiny</p>
        <Button onClick={() => router.back()} variant="outline" className="border-graphite-200">
          <ArrowLeft className="h-4 w-4 mr-1" />
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
    <div className="space-y-6 max-w-6xl">
      <Button
        onClick={() => router.back()}
        variant="ghost"
        size="sm"
        className="text-graphite-500 hover:text-graphite-900 -ml-2 h-8 px-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Wróć
      </Button>

      {/* ───── HERO (dark graphite) ────────────────────────────────────── */}
      <TurbineHero
        turbine={turbine}
        openRecsCount={openRecsCount}
        daysUntilInspection={daysUntilInspection}
        isOverdue={isOverdue}
        canAddInspection={canUpload}
        onAddInspection={() => router.push(`/inspekcje/nowa?turbineId=${turbineId}`)}
      />

      {/* ───── TABS ─────────────────────────────────────────────────────── */}
      <Tabs defaultValue="przeglad" className="space-y-6">
        <TabsList className="h-auto bg-transparent p-0 border-b border-graphite-200 rounded-none w-full justify-start gap-1">
          <TabTrigger value="przeglad" label="Przegląd" />
          <TabTrigger value="historia" label="Historia inspekcji" count={inspectionsCount + historical.length} />
          <TabTrigger value="zalecenia" label="Zalecenia" count={openRecsCount} tone={openRecsCount > 0 ? 'warning' : 'muted'} />
          <TabTrigger value="zdjecia" label="Zdjęcia" />
          <TabTrigger value="certyfikaty" label="Certyfikaty" />
        </TabsList>

        {/* TAB: Przegląd — wykres, KPI + obecna zawartość */}
        <TabsContent value="przeglad" className="space-y-6 mt-0">
          {/* Wykres oceny w czasie (2/3) + sidebar z 2 kartami KPI (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <InspectionTrendChart rows={inspectionsHistory.slice(0, 6)} />
            </div>
            <div className="flex flex-col gap-5">
              <LastInspectionCard row={inspectionsHistory[0] ?? null} />
              <UpcomingInspectionsCard row={inspectionsHistory[0] ?? null} />
            </div>
          </div>

          {/* 3 zdjęcia referencyjne turbiny (wizytówka) */}
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

          {/* Alert inspekcji (przeterminowany / za 90 dni / OK) */}
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

          {/* Dane techniczne */}
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

          {/* Lokalizacja */}
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

          {/* Dane kontroli (stare, flat — docelowo zostanie rozszerzone o KPI karty w C2) */}
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

          {/* Ustalenia i zalecenia z ostatniej kontroli (legacy text, zachowane do migracji na repair_recommendations) */}
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

          {/* CTA farma/klient */}
          <div className="flex gap-3">
            <Button onClick={() => router.push(`/farmy/${turbine.wind_farm_id}`)}>
              Zobacz farmę
            </Button>
            <Button variant="outline" className="border-graphite-200" onClick={() => router.push(`/klienci/${turbine.wind_farms?.client_id}`)}>
              Zobacz klienta
            </Button>
          </div>
        </TabsContent>

        {/* TAB: Historia inspekcji */}
        <TabsContent value="historia" className="mt-0">
          <InspectionsHistoryTable rows={inspectionsHistory} historical={historical} />
        </TabsContent>

        {/* TAB: Zalecenia */}
        <TabsContent value="zalecenia" className="mt-0">
          <RepairsList
            rows={repairs}
            showOnlyOpen={showOnlyOpen}
            onToggleFilter={() => setShowOnlyOpen((v) => !v)}
          />
        </TabsContent>

        {/* TAB: Zdjęcia */}
        <TabsContent value="zdjecia" className="mt-0">
          <InspectionPhotosGrid photos={photos} />
        </TabsContent>

        {/* TAB: Certyfikaty */}
        <TabsContent value="certyfikaty" className="mt-0">
          <CertificatesList inspectors={certInspectors} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ───── Hero component ────────────────────────────────────────────────────────

function TurbineHero({
  turbine,
  openRecsCount,
  daysUntilInspection,
  isOverdue,
  canAddInspection,
  onAddInspection,
}: {
  turbine: Turbine
  openRecsCount: number
  daysUntilInspection: number | null
  isOverdue: boolean | null
  canAddInspection: boolean
  onAddInspection: () => void
}) {
  const clientName = turbine.wind_farms?.clients?.name
  const farmName = turbine.wind_farms?.name

  return (
    <div className="rounded-xl bg-graphite-900 text-white shadow-sm border border-graphite-800 p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Avatar ikona */}
          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-graphite-800 flex items-center justify-center">
            <Wind className="h-7 w-7 text-primary-500" />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[26px] font-bold tracking-tight leading-none text-white">
                {turbine.turbine_code}
              </h1>
              {openRecsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-warning-100 text-warning-800">
                  <AlertTriangle className="h-3 w-3" />
                  {openRecsCount === 1
                    ? 'Aktywne zalecenie · 1'
                    : `Aktywne zalecenia · ${openRecsCount}`}
                </span>
              )}
              {turbine.next_inspection_date && daysUntilInspection !== null && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold font-mono ${
                    isOverdue
                      ? 'bg-danger-100 text-danger-800'
                      : daysUntilInspection <= 90
                      ? 'bg-warning-100 text-warning-800'
                      : 'bg-graphite-800 text-graphite-200 border border-graphite-700'
                  }`}
                >
                  <Calendar className="h-3 w-3" />
                  {isOverdue
                    ? `Przeterminowano o ${Math.abs(daysUntilInspection)} d.`
                    : `Przegląd za ${daysUntilInspection} d.`}
                </span>
              )}
            </div>
            <p className="text-sm text-graphite-200">
              {turbine.manufacturer} {turbine.model}
              {farmName ? ` · ${farmName}` : ''}
              {clientName ? ` · ${clientName}` : ''}
            </p>
          </div>
        </div>

        {canAddInspection && (
          <Button
            onClick={onAddInspection}
            className="h-10 gap-2 bg-primary-600 hover:bg-primary-700 text-white shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nowa inspekcja
          </Button>
        )}
      </div>

      {/* Specs grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-5 gap-y-3 pt-4 border-t border-graphite-800">
        <HeroSpec label="Producent" value={turbine.manufacturer || '—'} />
        <HeroSpec label="Model" value={turbine.model || '—'} />
        <HeroSpec label="Moc nom." value={turbine.rated_power_mw ? `${turbine.rated_power_mw} MW` : '—'} mono />
        <HeroSpec label="H piasty" value={turbine.hub_height_m ? `${turbine.hub_height_m} m` : '—'} mono />
        <HeroSpec label="Nr seryjny" value={turbine.serial_number || '—'} mono />
        <HeroSpec
          label="Ostatnia kontrola"
          value={turbine.last_inspection_date
            ? new Date(turbine.last_inspection_date).toLocaleDateString('pl-PL')
            : '—'}
          mono
        />
      </div>
    </div>
  )
}

function HeroSpec({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-graphite-400">
        {label}
      </span>
      <span className={`text-[13px] font-semibold text-white ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

// ───── Tab trigger with optional count badge ─────────────────────────────────

function TabTrigger({
  value,
  label,
  count,
  tone = 'muted',
}: {
  value: string
  label: string
  count?: number
  tone?: 'muted' | 'warning'
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative h-10 px-4 rounded-none bg-transparent text-graphite-500 hover:text-graphite-900 data-[state=active]:text-primary-700 data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary-600 text-[13px] font-semibold gap-2"
    >
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={`font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
            tone === 'warning'
              ? 'bg-warning-100 text-warning-800'
              : 'bg-graphite-100 text-graphite-700'
          }`}
        >
          {count}
        </span>
      )}
    </TabsTrigger>
  )
}

// ───── Placeholder for tabs implemented in future steps ──────────────────────

function TabPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-xl border border-dashed border-graphite-200 shadow-none">
      <CardContent className="p-10 text-center space-y-2">
        <p className="text-sm font-semibold text-graphite-800">{title}</p>
        <p className="text-xs text-graphite-500 max-w-md mx-auto">{description}</p>
      </CardContent>
    </Card>
  )
}

// ───── Photo slot ─────────────────────────────────────────────────────────────

// ───── Wykres oceny w czasie (SVG line chart, 6 ostatnich inspekcji) ─────────

function InspectionTrendChart({ rows }: { rows: InspectionHistoryRow[] }) {
  // Chronologicznie od lewej do prawej (najstarsza → najnowsza).
  // Filtrujemy tylko te z uzupełnioną oceną, bo bez ratingu nie ma Y.
  const points = rows
    .filter((r) => r.overall_condition_rating && r.inspection_date)
    .reverse()
    .map((r) => ({
      id: r.id,
      date: new Date(r.inspection_date as string),
      rating: r.overall_condition_rating as RatingKey,
      y: RATING_Y[r.overall_condition_rating as RatingKey],
    }))

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="border-b border-graphite-100 pb-4">
        <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary-600" />
          Ocena techniczna w czasie
        </CardTitle>
        <p className="text-[12px] text-graphite-500 mt-0.5">
          Maksymalnie 6 ostatnich inspekcji
        </p>
      </CardHeader>
      <CardContent className="p-5">
        {points.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 bg-graphite-50 rounded-2xl mb-3">
              <TrendingUp className="h-8 w-8 text-graphite-200" />
            </div>
            <p className="text-sm font-semibold text-graphite-800">
              {points.length === 0
                ? 'Brak danych do wykresu'
                : 'Za mało danych do wykresu trendu'}
            </p>
            <p className="text-xs text-graphite-500 mt-1 max-w-sm">
              {points.length === 0
                ? 'Wykres pojawi się po pierwszej zatwierdzonej inspekcji z uzupełnioną oceną ogólną.'
                : `Pierwsza inspekcja: ${points[0].date.toLocaleDateString('pl-PL')}. Trend pojawi się po drugiej inspekcji.`}
            </p>
          </div>
        ) : (
          (() => {
            // SVG geometria
            const W = 600
            const H = 200
            const PAD_L = 54
            const PAD_R = 24
            const PAD_T = 20
            const PAD_B = 36
            const innerW = W - PAD_L - PAD_R
            const innerH = H - PAD_T - PAD_B

            const xAt = (i: number) =>
              PAD_L + (i * innerW) / Math.max(1, points.length - 1)
            // y=5 (dobry) na górze, y=1 (awaryjny) na dole.
            const yAt = (v: number) =>
              PAD_T + ((5 - v) / 4) * innerH

            const pathD = points
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.y).toFixed(1)}`)
              .join(' ')

            const areaD =
              `${pathD} L${xAt(points.length - 1).toFixed(1)},${PAD_T + innerH} ` +
              `L${xAt(0).toFixed(1)},${PAD_T + innerH} Z`

            return (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Ocena techniczna w czasie">
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E9F4A" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#2E9F4A" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Grid lines horizontal + Y labels */}
                {[1, 2, 3, 4, 5].map((v) => (
                  <g key={v}>
                    <line
                      x1={PAD_L}
                      x2={W - PAD_R}
                      y1={yAt(v)}
                      y2={yAt(v)}
                      stroke="#EEF1F5"
                      strokeWidth="1"
                    />
                    <text
                      x={PAD_L - 8}
                      y={yAt(v)}
                      dy="0.35em"
                      textAnchor="end"
                      className="fill-graphite-400"
                      style={{ fontSize: '10px', fontFamily: 'var(--font-inter)' }}
                    >
                      {RATING_LABEL_SHORT[v]}
                    </text>
                  </g>
                ))}

                {/* Area + line */}
                <path d={areaD} fill="url(#trendGradient)" />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#259648"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Points + X labels */}
                {points.map((p, i) => (
                  <g key={p.id}>
                    <circle
                      cx={xAt(i)}
                      cy={yAt(p.y)}
                      r={i === points.length - 1 ? 5 : 4}
                      fill={i === points.length - 1 ? '#F59E0B' : '#259648'}
                      stroke="white"
                      strokeWidth={i === points.length - 1 ? 2 : 1.5}
                    />
                    <text
                      x={xAt(i)}
                      y={H - 8}
                      textAnchor="middle"
                      className="fill-graphite-500"
                      style={{ fontSize: '10px', fontFamily: 'var(--font-jetbrains-mono)' }}
                    >
                      {p.date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </text>
                  </g>
                ))}
              </svg>
            )
          })()
        )}
      </CardContent>
    </Card>
  )
}

// ───── Karta KPI: Ostatnia kontrola ─────────────────────────────────────────

function LastInspectionCard({ row }: { row: InspectionHistoryRow | null }) {
  if (!row) {
    return (
      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardContent className="p-5 flex flex-col items-center text-center gap-2 py-8">
          <div className="p-2 bg-graphite-50 rounded-xl">
            <ClipboardCheck className="h-6 w-6 text-graphite-200" />
          </div>
          <p className="text-sm font-semibold text-graphite-800">Brak inspekcji</p>
          <p className="text-xs text-graphite-500">
            Pierwszy protokół pojawi się tutaj po zatwierdzeniu inspekcji.
          </p>
        </CardContent>
      </Card>
    )
  }

  const leadInspector = row.inspection_inspectors?.find((ii) => ii.is_lead)?.inspector?.full_name
    ?? row.inspection_inspectors?.[0]?.inspector?.full_name
    ?? null

  const typeLabel = row.inspection_type === 'annual' ? 'Kontrola roczna' : 'Kontrola 5-letnia'

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center gap-3">
        <div className="p-2 bg-primary-50 rounded-xl">
          <ClipboardCheck className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-[13px] font-bold text-graphite-900 leading-tight">
            Ostatnia kontrola
          </CardTitle>
          <p className="text-[11px] text-graphite-500 mt-0.5 uppercase tracking-wider">
            {typeLabel}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-5 pb-4 space-y-2.5">
        <div>
          <div className="font-mono text-[15px] font-bold text-graphite-900 leading-tight">
            {row.protocol_number ?? '—'}
          </div>
          <div className="font-mono text-[12px] text-graphite-500 mt-0.5">
            {row.inspection_date ? new Date(row.inspection_date).toLocaleDateString('pl-PL') : '—'}
          </div>
        </div>
        {leadInspector && (
          <div className="text-[12px] text-graphite-800">
            <span className="text-graphite-500">Inspektor: </span>
            {leadInspector}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-graphite-100">
          <Link
            href={`/api/pdf/${row.id}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:text-primary-800"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Link>
          <Link
            href={`/api/docx/${row.id}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:text-primary-800"
          >
            <Download className="h-3.5 w-3.5" />
            DOCX
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

// ───── Karta KPI: Najbliższe przeglądy ──────────────────────────────────────

function UpcomingInspectionsCard({ row }: { row: InspectionHistoryRow | null }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const items: { label: string; date: Date | null }[] = row
    ? [
        { label: 'Kontrola roczna', date: row.next_annual_date ? new Date(row.next_annual_date) : null },
        { label: 'Kontrola elektryczna', date: row.next_electrical_date ? new Date(row.next_electrical_date) : null },
        { label: 'Kontrola 5-letnia', date: row.next_five_year_date ? new Date(row.next_five_year_date) : null },
      ]
    : []

  const filtered = items
    .filter((i) => i.date !== null)
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()))

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center gap-3">
        <div className="p-2 bg-info-50 rounded-xl">
          <Calendar className="h-5 w-5 text-info-700" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-[13px] font-bold text-graphite-900 leading-tight">
            Najbliższe przeglądy
          </CardTitle>
          <p className="text-[11px] text-graphite-500 mt-0.5 uppercase tracking-wider">
            Wg ostatniego protokołu
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-5 pb-4">
        {filtered.length === 0 ? (
          <p className="text-xs text-graphite-500 py-2">
            Ostatni protokół nie ma uzupełnionych dat kolejnych kontroli (roczna / elektryczna / 5-letnia).
          </p>
        ) : (
          <ul className="divide-y divide-graphite-100">
            {filtered.map((item) => {
              const d = item.date!
              const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              const overdue = days < 0
              const soon = days >= 0 && days <= 90
              return (
                <li key={item.label} className="py-2.5 flex items-center justify-between gap-3 first:pt-1 last:pb-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-graphite-900 leading-tight">
                      {item.label}
                    </div>
                    <div className="font-mono text-[11px] text-graphite-500 mt-0.5">
                      {d.toLocaleDateString('pl-PL')}
                    </div>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold shrink-0 ${
                      overdue
                        ? 'bg-danger-50 text-danger-800'
                        : soon
                        ? 'bg-warning-50 text-warning-800'
                        : 'bg-graphite-100 text-graphite-700'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {overdue ? `${Math.abs(days)} d. po` : `za ${days} d.`}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ───── Tabela historii inspekcji ─────────────────────────────────────────────

type HistoryItem =
  | { source: 'system'; row: InspectionHistoryRow; date: Date | null }
  | { source: 'historical'; row: HistoricalRow; date: Date | null }

function InspectionsHistoryTable({
  rows,
  historical,
}: {
  rows: InspectionHistoryRow[]
  historical: HistoricalRow[]
}) {
  // Połączona lista inspekcji z systemu i historycznych protokołów,
  // sortowanie po `inspection_date` DESC, nulle na końcu.
  const merged: HistoryItem[] = [
    ...rows.map((r): HistoryItem => ({
      source: 'system',
      row: r,
      date: r.inspection_date ? new Date(r.inspection_date) : null,
    })),
    ...historical.map((h): HistoryItem => ({
      source: 'historical',
      row: h,
      date: h.inspection_date ? new Date(h.inspection_date) : null,
    })),
  ].sort((a, b) => {
    if (a.date && b.date) return b.date.getTime() - a.date.getTime()
    if (a.date && !b.date) return -1
    if (!a.date && b.date) return 1
    return 0
  })

  if (merged.length === 0) {
    return (
      <Card className="rounded-xl border border-dashed border-graphite-200 shadow-none">
        <CardContent className="p-10 text-center space-y-2">
          <div className="p-3 bg-graphite-50 rounded-2xl mb-3 inline-block">
            <ClipboardCheck className="h-8 w-8 text-graphite-200" />
          </div>
          <p className="text-sm font-semibold text-graphite-800">Brak inspekcji w systemie</p>
          <p className="text-xs text-graphite-500 max-w-md mx-auto">
            Historia pojawi się tutaj po wprowadzeniu pierwszego protokołu przez aplikację
            lub dodaniu historycznego protokołu z dysku współdzielonego Google Drive.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-graphite-50/50 border-b border-graphite-100">
            <tr>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 px-5 py-2.5">Data</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Nr protokołu</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Typ kontroli</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Inspektor</th>
              <th className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 pr-5 text-right">Protokół</th>
            </tr>
          </thead>
          <tbody>
            {merged.map((item) => {
              const dateStr = item.date ? item.date.toLocaleDateString('pl-PL') : '—'
              const protocolNumber = item.row.protocol_number ?? '—'

              if (item.source === 'system') {
                const r = item.row
                const typeLabel = r.inspection_type === 'annual' ? 'Roczna' : '5-letnia'
                const typeClass =
                  r.inspection_type === 'annual'
                    ? 'bg-info-50 text-info-700'
                    : 'bg-graphite-100 text-graphite-700'
                const leadInspector =
                  r.inspection_inspectors?.find((ii) => ii.is_lead)?.inspector?.full_name ??
                  r.inspection_inspectors?.[0]?.inspector?.full_name ??
                  null
                return (
                  <tr key={`system-${r.id}`} className="border-b border-graphite-100 h-[52px] hover:bg-graphite-50/50 transition-colors">
                    <td className="font-mono text-[13px] text-graphite-500 px-5">{dateStr}</td>
                    <td className="font-mono font-semibold text-[13px] text-graphite-900">{protocolNumber}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${typeClass}`}>
                        {typeLabel}
                      </span>
                    </td>
                    <td className="text-[13px] text-graphite-800">
                      {leadInspector ?? <span className="text-graphite-400">—</span>}
                    </td>
                    <td className="pr-5 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/api/pdf/${r.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:text-primary-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Link>
                        <Link
                          href={`/api/docx/${r.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:text-primary-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          DOCX
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              }

              // source === 'historical'
              const h = item.row
              const typeLabel =
                h.inspection_type === 'annual'
                  ? 'Roczna · archiw.'
                  : h.inspection_type === 'five_year'
                  ? '5-letnia · archiw.'
                  : 'Archiwalny'
              return (
                <tr key={`hist-${h.id}`} className="border-b border-graphite-100 h-[52px] hover:bg-graphite-50/50 transition-colors">
                  <td className="font-mono text-[13px] text-graphite-500 px-5">{dateStr}</td>
                  <td className="font-mono font-semibold text-[13px] text-graphite-900">{protocolNumber}</td>
                  <td>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-graphite-100 text-graphite-700">
                      {typeLabel}
                    </span>
                  </td>
                  <td className="text-[13px] text-graphite-400">
                    <span title={h.summary_notes ?? undefined}>—</span>
                  </td>
                  <td className="pr-5 text-right">
                    {h.pdf_url ? (
                      <Link
                        href={h.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:text-primary-800"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        GDrive
                      </Link>
                    ) : (
                      <span className="text-[12px] text-graphite-400">brak pliku</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ───── Lista zaleceń ─────────────────────────────────────────────────────────

function RepairsList({
  rows,
  showOnlyOpen,
  onToggleFilter,
}: {
  rows: RepairRow[]
  showOnlyOpen: boolean
  onToggleFilter: () => void
}) {
  const filtered = showOnlyOpen ? rows.filter((r) => !r.is_completed) : rows
  const openCount = rows.filter((r) => !r.is_completed).length
  const closedCount = rows.length - openCount

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[13px]">
          <Filter className="h-4 w-4 text-graphite-500" />
          <button
            onClick={onToggleFilter}
            className="text-graphite-800 hover:text-primary-700 font-semibold"
          >
            {showOnlyOpen ? 'Tylko otwarte' : 'Wszystkie'}
          </button>
          <span className="text-graphite-400">·</span>
          <span className="text-graphite-500 font-mono">
            <span className="text-graphite-900 font-semibold">{openCount}</span> otwartych,{' '}
            <span className="text-graphite-900 font-semibold">{closedCount}</span> zamkniętych
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-graphite-200 shadow-none">
          <CardContent className="p-10 text-center space-y-2">
            <div className="p-3 bg-success-50 rounded-2xl mb-3 inline-block">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <p className="text-sm font-semibold text-graphite-800">
              {showOnlyOpen ? 'Brak otwartych zaleceń' : 'Brak zaleceń'}
            </p>
            <p className="text-xs text-graphite-500 max-w-md mx-auto">
              {showOnlyOpen
                ? 'Wszystko w porządku — turbina nie ma aktualnie aktywnych zaleceń naprawczych.'
                : 'Dla tej turbiny nie zarejestrowano żadnych zaleceń naprawczych.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <RepairCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function RepairCard({ row }: { row: RepairRow }) {
  const urgency = row.urgency_level
  const ui = urgency ? URGENCY_UI[urgency] : null
  const deadline = row.deadline_date ? new Date(row.deadline_date) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = deadline && deadline < today && !row.is_completed
  const daysToDeadline = deadline
    ? Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Card
      className={`rounded-xl border shadow-xs ${
        row.is_completed
          ? 'border-graphite-200 bg-graphite-50/40'
          : overdue
          ? 'border-danger-100 bg-danger-50/30'
          : 'border-graphite-200'
      }`}
    >
      <CardContent className="p-4 flex gap-4 items-start">
        <div className="shrink-0">
          {ui ? (
            <span
              className={`inline-flex items-center justify-center min-w-[52px] px-2 py-1 rounded-full text-[11px] font-bold font-mono ${ui.bg} ${ui.text}`}
              title={ui.label}
            >
              {urgency}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center min-w-[52px] px-2 py-1 rounded-full text-[11px] font-bold bg-graphite-100 text-graphite-700">
              —
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-graphite-900 leading-tight">
                {row.element_name || 'Element niewskazany'}
              </p>
              {row.scope_description && (
                <p className="text-[13px] text-graphite-500 mt-1 line-clamp-3">
                  {row.scope_description}
                </p>
              )}
            </div>
            {row.is_completed && (
              <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success-50 text-success-800">
                <CheckCircle2 className="h-3 w-3" />
                Zakończone
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[12px]">
            {row.repair_type && (
              <span className="text-graphite-500">
                <span className="uppercase tracking-wider text-[10px] text-graphite-400 mr-1">Rodzaj:</span>
                <span className="font-medium text-graphite-800 font-mono">{row.repair_type}</span>
              </span>
            )}
            {deadline && (
              <span className={`font-mono font-semibold ${overdue ? 'text-danger' : 'text-graphite-800'}`}>
                Termin: {deadline.toLocaleDateString('pl-PL')}
                {daysToDeadline !== null && !row.is_completed && (
                  <span className={`ml-2 ${overdue ? 'text-danger' : 'text-graphite-500'}`}>
                    {overdue
                      ? `(${Math.abs(daysToDeadline)} d. po)`
                      : `(za ${daysToDeadline} d.)`}
                  </span>
                )}
              </span>
            )}
            {row.inspections?.protocol_number && (
              <span className="text-graphite-400">
                <span className="uppercase tracking-wider text-[10px] mr-1">z protokołu</span>
                <span className="font-mono text-graphite-700">{row.inspections.protocol_number}</span>
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ───── Tab Zdjęcia: grid ze zdjęć inspekcji ─────────────────────────────────

function InspectionPhotosGrid({ photos }: { photos: InspectionPhotoRow[] }) {
  if (photos.length === 0) {
    return (
      <Card className="rounded-xl border border-dashed border-graphite-200 shadow-none">
        <CardContent className="p-10 text-center space-y-2">
          <div className="p-3 bg-graphite-50 rounded-2xl mb-3 inline-block">
            <ImageIcon className="h-8 w-8 text-graphite-200" />
          </div>
          <p className="text-sm font-semibold text-graphite-800">Brak zdjęć</p>
          <p className="text-xs text-graphite-500 max-w-md mx-auto">
            Zdjęcia dodane podczas inspekcji przez aplikację pojawią się tutaj.
            Zdjęcia referencyjne turbiny znajdziesz w zakładce „Przegląd".
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((p) => (
        <a
          key={p.id}
          href={p.file_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <div className="aspect-square relative rounded-xl overflow-hidden border border-graphite-200 bg-graphite-50">
            {p.thumbnail_url || p.file_url ? (
              <img
                src={p.thumbnail_url || p.file_url || ''}
                alt={p.description ?? `Zdjęcie ${p.photo_number ?? ''}`.trim()}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-graphite-300" />
              </div>
            )}
            {p.photo_number !== null && p.photo_number !== undefined && (
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-black/60 text-white">
                FOT. {String(p.photo_number).padStart(2, '0')}
              </div>
            )}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {p.description && (
              <p className="text-[12px] text-graphite-800 line-clamp-2 leading-tight">
                {p.description}
              </p>
            )}
            {p.inspections?.protocol_number && (
              <p className="text-[11px] text-graphite-400 font-mono">
                {p.inspections.protocol_number}
                {p.inspections.inspection_date && (
                  <span className="ml-2">
                    {new Date(p.inspections.inspection_date).toLocaleDateString('pl-PL')}
                  </span>
                )}
              </p>
            )}
          </div>
        </a>
      ))}
    </div>
  )
}

// ───── Tab Certyfikaty: lista inspektorów zespołu + ich uprawnienia ─────────

function CertificatesList({ inspectors }: { inspectors: CertInspectorRow[] }) {
  if (inspectors.length === 0) {
    return (
      <Card className="rounded-xl border border-dashed border-graphite-200 shadow-none">
        <CardContent className="p-10 text-center space-y-2">
          <div className="p-3 bg-graphite-50 rounded-2xl mb-3 inline-block">
            <ShieldCheck className="h-8 w-8 text-graphite-200" />
          </div>
          <p className="text-sm font-semibold text-graphite-800">Brak przypisanych inspektorów</p>
          <p className="text-xs text-graphite-500 max-w-md mx-auto">
            Certyfikaty zespołu wyświetlą się po powiązaniu inspektorów z ostatnią inspekcją.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {inspectors.map((ins) => (
        <InspectorCertCard key={ins.id} inspector={ins} />
      ))}
    </div>
  )
}

function InspectorCertCard({ inspector }: { inspector: CertInspectorRow }) {
  const certs: { label: string; number: string | null; expiry: string | null }[] = [
    {
      label: 'UDT',
      number: inspector.udt_certificate_number,
      expiry: inspector.udt_expiry_date,
    },
    {
      label: 'SEP',
      number: inspector.sep_certificate_number,
      expiry: inspector.sep_expiry_date,
    },
    {
      label: 'GWO',
      number: inspector.gwo_certificate_number,
      expiry: inspector.gwo_expiry_date,
    },
    {
      label: inspector.chamber_membership ?? 'Izba',
      number: inspector.chamber_certificate_number,
      expiry: inspector.chamber_expiry_date,
    },
  ].filter((c) => c.number || c.expiry)

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="pt-5 px-5 pb-3 border-b border-graphite-100">
        <CardTitle className="text-[14px] font-bold text-graphite-900">
          {inspector.full_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {certs.length === 0 ? (
          <p className="text-xs text-graphite-500">
            Brak uzupełnionych danych uprawnień w profilu inspektora.
          </p>
        ) : (
          <ul className="divide-y divide-graphite-100">
            {certs.map((c, i) => (
              <CertRow key={`${c.label}-${i}`} cert={c} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function CertRow({
  cert,
}: {
  cert: { label: string; number: string | null; expiry: string | null }
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiryDate = cert.expiry ? new Date(cert.expiry) : null
  const daysToExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const expired = daysToExpiry !== null && daysToExpiry < 0
  const soon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 90

  const Icon = expired ? ShieldAlert : ShieldCheck
  const iconColor = expired
    ? 'text-danger'
    : soon
    ? 'text-warning'
    : expiryDate
    ? 'text-primary-600'
    : 'text-graphite-400'

  return (
    <li className="py-3 flex items-center gap-3 first:pt-1 last:pb-1">
      <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-graphite-900 leading-tight">
          {cert.label}
        </div>
        {cert.number && (
          <div className="font-mono text-[11px] text-graphite-500 mt-0.5">
            Nr: {cert.number}
          </div>
        )}
      </div>
      {expiryDate && (
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold shrink-0 ${
            expired
              ? 'bg-danger-50 text-danger-800'
              : soon
              ? 'bg-warning-50 text-warning-800'
              : 'bg-success-50 text-success-800'
          }`}
        >
          {expiryDate.toLocaleDateString('pl-PL')}
          <span className="text-graphite-400 font-normal">
            {expired
              ? `${Math.abs(daysToExpiry!)} d. po`
              : `za ${daysToExpiry} d.`}
          </span>
        </div>
      )}
    </li>
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
