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
import { ClientForm } from '@/components/forms/client-form'
import { WindFarmForm } from '@/components/forms/wind-farm-form'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Plus, Wind } from 'lucide-react'
import { STATUS_COLORS, INSPECTION_STATUSES } from '@/lib/constants'
import { RatingBadge } from '@/components/inspection/rating-badge'

interface Client {
  id: string
  name: string
  short_name: string
  contact_person: string
  contact_email: string
  contact_phone: string
  nip: string
}

interface WindFarm {
  id: string
  name: string
  location_address: string
  total_capacity_mw: number
  number_of_turbines: number
  turbines?: { id: string }[]
}

interface Inspection {
  id: string
  protocol_number: string
  inspection_date: string
  inspection_type: string
  status: string
  overall_condition_rating: string
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [windFarms, setWindFarms] = useState<WindFarm[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [isWindFarmDialogOpen, setIsWindFarmDialogOpen] = useState(false)

  useEffect(() => {
    fetchClientData()
  }, [clientId])

  async function fetchClientData() {
    const supabase = createClient()
    try {
      setLoading(true)

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (clientError) throw clientError
      setClient(clientData)

      const { data: farmsData, error: farmsError } = await supabase
        .from('wind_farms')
        .select('*, turbines(id)')
        .eq('client_id', clientId)
        .not('is_deleted', 'is', true)
        .order('name', { ascending: true })

      if (farmsError) throw farmsError
      setWindFarms(farmsData || [])

      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from('inspections')
        .select(
          'id, protocol_number, inspection_date, inspection_type, status, overall_condition_rating'
        )
        .in('turbine_id', farmsData?.flatMap(f => (f.turbines || []).map((t: { id: string }) => t.id)) || [])
        .order('inspection_date', { ascending: false })
        .limit(5)

      if (inspectionsError) throw inspectionsError
      setInspections(inspectionsData || [])
    } catch (error) {
      console.error('Błąd przy pobieraniu danych klienta:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWindFarmAdded = () => {
    setIsWindFarmDialogOpen(false)
    fetchClientData()
  }

  const handleClientUpdated = () => {
    fetchClientData()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-graphite-500">Klient nie znaleziony</p>
        <Button
          onClick={() => router.push('/klienci')}
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
          <h1 className="text-2xl font-bold text-graphite-900">{client.name}</h1>
          {client.short_name && (
            <p className="text-sm text-graphite-500">{client.short_name}</p>
          )}
        </div>
      </div>

      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900">Dane klienta</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ClientForm initialData={client} onSuccess={handleClientUpdated} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between border-b border-graphite-100 pb-4">
          <div>
            <CardTitle className="text-[15px] font-bold text-graphite-900">Farmy wiatrowe</CardTitle>
            <p className="font-mono text-[12px] text-graphite-500 mt-0.5">{windFarms.length} farm</p>
          </div>
          <Dialog open={isWindFarmDialogOpen} onOpenChange={setIsWindFarmDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5">
                <Plus className="h-4 w-4" />
                Dodaj farmę
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nowa farma wiatrowa</DialogTitle>
              </DialogHeader>
              <WindFarmForm
                clientId={clientId}
                onSuccess={handleWindFarmAdded}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="pt-4">
          {windFarms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-3 bg-graphite-50 rounded-2xl mb-3">
                <Wind className="h-8 w-8 text-graphite-200" />
              </div>
              <p className="text-sm font-semibold text-graphite-800">Brak farm wiatrowych</p>
              <p className="text-xs text-graphite-500 mt-1">Dodaj pierwszą farmę dla tego klienta</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {windFarms.map((farm) => (
                <Card
                  key={farm.id}
                  className="cursor-pointer hover:shadow-sm transition-shadow rounded-xl border border-graphite-200"
                  onClick={() => router.push(`/farmy/${farm.id}`)}
                >
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-graphite-900 mb-2">{farm.name}</h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-graphite-500">
                        <span className="text-graphite-800 font-medium">Lokalizacja:</span>{' '}
                        {farm.location_address}
                      </p>
                      <p className="text-graphite-500">
                        <span className="text-graphite-800 font-medium">Moc łączna:</span>{' '}
                        <span className="font-mono">{farm.total_capacity_mw} MW</span>
                      </p>
                      <p className="text-graphite-500">
                        <span className="text-graphite-800 font-medium">Turbiny:</span>{' '}
                        <span className="font-mono">{farm.turbines?.length ?? farm.number_of_turbines}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-graphite-200 shadow-xs overflow-hidden">
        <CardHeader className="border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900">Ostatnie inspekcje</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {inspections.length === 0 ? (
            <p className="text-graphite-500 text-sm px-5 py-6">Brak inspekcji dla tego klienta</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-graphite-50/50 hover:bg-graphite-50/50 border-b border-graphite-100">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 px-5">Nr protokołu</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Data</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Typ</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Ocena</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((inspection) => (
                  <TableRow
                    key={inspection.id}
                    className="cursor-pointer hover:bg-graphite-50/50 transition-colors border-b border-graphite-100 h-[52px]"
                    onClick={() => router.push(`/inspekcje/${inspection.id}`)}
                  >
                    <TableCell className="font-mono font-semibold text-graphite-900 px-5 text-[13px]">
                      {inspection.protocol_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-graphite-500 text-[13px]">
                      {new Date(inspection.inspection_date).toLocaleDateString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-graphite-500 text-[13px]">
                      {inspection.inspection_type === 'annual' ? 'Roczna' : 'Pięcioletnia'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[inspection.status] || 'bg-graphite-100 text-graphite-800'}>
                        {INSPECTION_STATUSES.find(s => s.value === inspection.status)?.label || inspection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inspection.overall_condition_rating ? (
                        <RatingBadge rating={inspection.overall_condition_rating as 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny'} />
                      ) : (
                        <span className="text-graphite-400 text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
