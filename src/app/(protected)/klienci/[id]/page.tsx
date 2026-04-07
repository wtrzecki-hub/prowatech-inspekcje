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
import { ClientForm } from '@/components/forms/client-form'
import { WindFarmForm } from '@/components/forms/wind-farm-form'
import { Skeleton } from '@/components/ui/skeleton'

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
        <p className="text-gray-500">Klient nie znaleziony</p>
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
        >
          Wróć
        </Button>
        <h1 className="text-3xl font-bold">{client.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dane klienta</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm initialData={client} onSuccess={handleClientUpdated} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Farmy wiatrowe</CardTitle>
          <Dialog open={isWindFarmDialogOpen} onOpenChange={setIsWindFarmDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Dodaj farmę</Button>
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
        <CardContent>
          {windFarms.length === 0 ? (
            <p className="text-gray-500">Brak farm wiatrowych</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {windFarms.map((farm) => (
                <Card
                  key={farm.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => router.push(`/farmy/${farm.id}`)}
                >
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">{farm.name}</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-gray-600">Lokalizacja:</span>{' '}
                        {farm.location_address}
                      </p>
                      <p>
                        <span className="text-gray-600">Moc łączna:</span>{' '}
                        {farm.total_capacity_mw} MW
                      </p>
                      <p>
                        <span className="text-gray-600">Turbiny:</span>{' '}
                        {farm.number_of_turbines}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ostatnie inspekcje</CardTitle>
        </CardHeader>
        <CardContent>
          {inspections.length === 0 ? (
            <p className="text-gray-500">Brak inspekcji</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr protokołu</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ocena</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.map((inspection) => (
                    <TableRow
                      key={inspection.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/inspekcje/${inspection.id}`)}
                    >
                      <TableCell>{inspection.protocol_number}</TableCell>
                      <TableCell>
                        {new Date(inspection.inspection_date).toLocaleDateString(
                          'pl-PL'
                        )}
                      </TableCell>
                      <TableCell>{inspection.inspection_type}</TableCell>
                      <TableCell>{inspection.status}</TableCell>
                      <TableCell>{inspection.overall_condition_rating}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
