'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { WindFarmForm } from '@/components/forms/wind-farm-form'
import { TurbineForm } from '@/components/forms/turbine-form'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Plus, Wind } from 'lucide-react'
import { STATUS_COLORS, INSPECTION_STATUSES } from '@/lib/constants'
import { RatingBadge } from '@/components/inspection/rating-badge'

interface WindFarm {
  id: string
  name: string
  client_id: string
  location_address: string
  latitude: number
  longitude: number
  total_capacity_mw: number
  number_of_turbines: number
  commissioning_date: string
  clients: {
    name: string
  }
}

interface Turbine {
  id: string
  turbine_code: string
  ew_designation: string | null
  manufacturer: string
  model: string
  rated_power_mw: number
  tower_height_m: number
  serial_number: string
}

// Wpis na liście "Ostatnie inspekcje" karty farmy — union z `inspections`
// (nowy system) + `historical_protocols` (archiwum). Bez tego archiwum karta
// farmy dla 99% farm dziś pokazywałaby pustkę mimo że w bazie są protokoły
// 2020-2025.
type RecentEntrySource = 'inspection' | 'archive'

interface RecentEntry {
  source: RecentEntrySource
  id: string
  protocol_number: string | null
  inspection_date: string | null
  inspection_type: string | null
  status: string | null
  overall_condition_rating: string | null
  protocol_pdf_url: string | null
  turbine_id: string
  turbine_code: string | null
}

export default function FarmDetailPage() {
  const router = useRouter()
  const params = useParams()
  const farmId = params.id as string

  const [windFarm, setWindFarm] = useState<WindFarm | null>(null)
  const [turbines, setTurbines] = useState<Turbine[]>([])
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isTurbineDialogOpen, setIsTurbineDialogOpen] = useState(false)

  useEffect(() => {
    fetchWindFarmData()
  }, [farmId])

  async function fetchWindFarmData() {
    const supabase = createClient()
    try {
      setLoading(true)

      const { data: farmData, error: farmError } = await supabase
        .from('wind_farms')
        .select('*, clients(name)')
        .eq('id', farmId)
        .single()

      if (farmError) throw farmError
      setWindFarm(farmData)

      const { data: turbinesData, error: turbinesError } = await supabase
        .from('turbines')
        .select('*')
        .eq('wind_farm_id', farmId)
        .not('is_deleted', 'is', true)
        .order('turbine_code', { ascending: true })

      if (turbinesError) throw turbinesError
      setTurbines(turbinesData || [])

      const turbineIds = (turbinesData || []).map((t: { id: string }) => t.id)
      const turbineCodeMap = new Map<string, string>(
        (turbinesData || []).map((t: { id: string; turbine_code: string }) => [t.id, t.turbine_code])
      )

      // Łączymy nowe inspekcje + archiwum w jedną listę 5 ostatnich. Każde
      // źródło fetchowane osobno (różne kolumny) i mergowane po dacie.
      const safeIds = turbineIds.length ? turbineIds : ['00000000-0000-0000-0000-000000000000']
      const [inspectionsResult, historicalResult] = await Promise.all([
        supabase
          .from('inspections')
          .select('id, protocol_number, inspection_date, inspection_type, status, overall_condition_rating, turbine_id, is_deleted')
          .in('turbine_id', safeIds)
          .order('inspection_date', { ascending: false })
          .limit(10),
        supabase
          .from('historical_protocols')
          .select('id, protocol_number, inspection_date, inspection_type, protocol_pdf_url, turbine_id')
          .in('turbine_id', safeIds)
          .order('inspection_date', { ascending: false, nullsFirst: false })
          .limit(10),
      ])

      if (inspectionsResult.error) throw inspectionsResult.error
      if (historicalResult.error) throw historicalResult.error

      const fromInspections: RecentEntry[] = (inspectionsResult.data || [])
        .filter((r: { is_deleted?: boolean | null }) => !r.is_deleted)
        .map((r: {
          id: string
          protocol_number: string | null
          inspection_date: string | null
          inspection_type: string | null
          status: string | null
          overall_condition_rating: string | null
          turbine_id: string
        }) => ({
          source: 'inspection' as const,
          id: r.id,
          protocol_number: r.protocol_number,
          inspection_date: r.inspection_date,
          inspection_type: r.inspection_type,
          status: r.status,
          overall_condition_rating: r.overall_condition_rating,
          protocol_pdf_url: null,
          turbine_id: r.turbine_id,
          turbine_code: turbineCodeMap.get(r.turbine_id) || null,
        }))

      const fromHistorical: RecentEntry[] = (historicalResult.data || []).map((r: {
        id: string
        protocol_number: string | null
        inspection_date: string | null
        inspection_type: string | null
        protocol_pdf_url: string | null
        turbine_id: string
      }) => ({
        source: 'archive' as const,
        id: r.id,
        protocol_number: r.protocol_number,
        inspection_date: r.inspection_date,
        inspection_type: r.inspection_type,
        status: null,
        overall_condition_rating: null,
        protocol_pdf_url: r.protocol_pdf_url,
        turbine_id: r.turbine_id,
        turbine_code: turbineCodeMap.get(r.turbine_id) || null,
      }))

      const merged = [...fromInspections, ...fromHistorical]
        .sort((a, b) => {
          const da = a.inspection_date ? new Date(a.inspection_date).getTime() : 0
          const db = b.inspection_date ? new Date(b.inspection_date).getTime() : 0
          return db - da
        })
        .slice(0, 5)
      setRecentEntries(merged)
    } catch (error) {
      console.error('Błąd przy pobieraniu danych farmy:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTurbineAdded = () => {
    setIsTurbineDialogOpen(false)
    fetchWindFarmData()
  }

  const handleFarmUpdated = () => {
    fetchWindFarmData()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-8 w-56 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!windFarm) {
    return (
      <div className="text-center py-12">
        <p className="text-graphite-500">Farma nie znaleziona</p>
        <Button
          onClick={() => router.push('/farmy')}
          className="mt-4"
          variant="outline"
        >
          Wróć do listy
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => router.back()}
          variant="outline"
          size="sm"
          className="border-graphite-200"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Wróć
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-graphite-900">{windFarm.name}</h1>
          <p className="text-sm text-graphite-500">{windFarm.clients.name}</p>
        </div>
      </div>

      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900">Szczegóły farmy</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <WindFarmForm initialData={windFarm} onSuccess={handleFarmUpdated} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-graphite-200 shadow-xs overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-graphite-100 pb-4">
          <div>
            <CardTitle className="text-[15px] font-bold text-graphite-900">Turbiny w farmie</CardTitle>
            <p className="font-mono text-[12px] text-graphite-500 mt-0.5">{turbines.length} turbin</p>
          </div>
          <Dialog open={isTurbineDialogOpen} onOpenChange={setIsTurbineDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5">
                <Plus className="h-4 w-4" />
                Dodaj turbinę
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nowa turbina</DialogTitle>
              </DialogHeader>
              <TurbineForm
                windFarmId={farmId}
                onSuccess={handleTurbineAdded}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {turbines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 bg-graphite-50 rounded-2xl mb-3">
                <Wind className="h-8 w-8 text-graphite-200" />
              </div>
              <p className="text-sm font-semibold text-graphite-800">Brak turbin w tej farmie</p>
              <p className="text-xs text-graphite-500 mt-1">Dodaj pierwszą turbinę, aby zacząć</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-graphite-50/50 hover:bg-graphite-50/50 border-b border-graphite-100">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 px-5">Oznaczenie</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Producent</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Model</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Moc MW</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Wys. wieży</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Nr seryjny</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turbines.map((turbine) => (
                  <TableRow
                    key={turbine.id}
                    className="cursor-pointer hover:bg-graphite-50/50 transition-colors border-b border-graphite-100 h-[52px]"
                    onClick={() => router.push(`/turbiny/${turbine.id}`)}
                  >
                    <TableCell className="font-mono font-semibold text-graphite-900 px-5 text-[13px] whitespace-nowrap">
                      {/* Format zgodny z hero `/turbiny/[id]` — `EW 1 · Lokalizacja · T<code>`.
                          Parsing turbine_code wzorcem `T<digits>-<location>`; jeśli nie pasuje
                          → tylko `${ew_designation} · ${turbine_code}` lub goły `turbine_code`. */}
                      {(() => {
                        const codeMatch = /^([A-Z]?\s*\d+[A-Z]?)\s*[-–]\s*(.+)$/i.exec(
                          turbine.turbine_code,
                        )
                        const codeShort = codeMatch?.[1]?.trim() ?? null
                        const codeLocation = codeMatch?.[2]?.trim() ?? null

                        if (turbine.ew_designation && codeShort && codeLocation) {
                          return `${turbine.ew_designation} · ${codeLocation} · ${codeShort}`
                        }
                        if (turbine.ew_designation) {
                          return `${turbine.ew_designation} · ${turbine.turbine_code}`
                        }
                        return turbine.turbine_code
                      })()}
                    </TableCell>
                    <TableCell className="text-graphite-500 text-[13px]">{turbine.manufacturer}</TableCell>
                    <TableCell className="text-graphite-500 text-[13px]">{turbine.model}</TableCell>
                    <TableCell className="font-mono text-graphite-800 font-medium text-[13px]">{turbine.rated_power_mw}</TableCell>
                    <TableCell className="font-mono text-graphite-500 text-[13px]">{turbine.tower_height_m} m</TableCell>
                    <TableCell className="font-mono text-graphite-500 text-[13px]">{turbine.serial_number}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ostatnie inspekcje — union nowych `inspections` + `historical_protocols`
          dla wszystkich turbin tej farmy. Bez tego archiwum (1759 wpisów)
          karta farmy dla 99% farm pokazywałaby pustkę. */}
      <Card className="rounded-xl border border-graphite-200 shadow-xs overflow-hidden">
        <CardHeader className="border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900">Ostatnie inspekcje</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentEntries.length === 0 ? (
            <p className="text-graphite-500 text-sm px-5 py-6">Brak inspekcji dla tej farmy</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-graphite-50/50 hover:bg-graphite-50/50 border-b border-graphite-100">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 px-5">Nr protokołu</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Data</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Typ</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Turbina</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Źródło</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Status / Ocena</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.map((entry) => {
                  const handleClick = () => {
                    if (entry.source === 'inspection') {
                      router.push(`/inspekcje/${entry.id}`)
                    } else if (entry.protocol_pdf_url) {
                      window.open(entry.protocol_pdf_url, '_blank', 'noopener,noreferrer')
                    } else {
                      router.push(`/turbiny/${entry.turbine_id}`)
                    }
                  }
                  return (
                    <TableRow
                      key={`${entry.source}:${entry.id}`}
                      className="cursor-pointer hover:bg-graphite-50/50 transition-colors border-b border-graphite-100 h-[52px]"
                      onClick={handleClick}
                    >
                      <TableCell className="font-mono font-semibold text-graphite-900 px-5 text-[13px]">
                        {entry.protocol_number || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-graphite-500 text-[13px]">
                        {entry.inspection_date
                          ? new Date(entry.inspection_date).toLocaleDateString('pl-PL')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-graphite-500 text-[13px]">
                        {entry.inspection_type === 'annual'
                          ? 'Roczna'
                          : entry.inspection_type === 'five_year'
                          ? 'Pięcioletnia'
                          : entry.inspection_type === 'electrical_measurement'
                          ? 'Elektryczna'
                          : entry.inspection_type || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-graphite-700 text-[13px]">
                        {entry.turbine_code || '-'}
                      </TableCell>
                      <TableCell>
                        {entry.source === 'archive' ? (
                          <Badge className="bg-graphite-100 text-graphite-700 hover:bg-graphite-100">
                            {entry.protocol_pdf_url ? 'Archiwum' : 'Archiwum (bez PDF)'}
                          </Badge>
                        ) : (
                          <Badge className="bg-primary-50 text-primary-700 hover:bg-primary-50">
                            Inspekcja
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.source === 'inspection' && entry.status ? (
                          <div className="flex items-center gap-2">
                            <Badge className={STATUS_COLORS[entry.status] || 'bg-graphite-100 text-graphite-800'}>
                              {INSPECTION_STATUSES.find(s => s.value === entry.status)?.label || entry.status}
                            </Badge>
                            {entry.overall_condition_rating && (
                              <RatingBadge rating={entry.overall_condition_rating as 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny'} />
                            )}
                          </div>
                        ) : (
                          <span className="text-graphite-400 text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
