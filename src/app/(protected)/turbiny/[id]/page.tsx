'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
import { TurbineForm } from '@/components/forms/turbine-form'
import { Skeleton } from '@/components/ui/skeleton'

interface Turbine {
  id: string
  kod: string
  producent: string
  model: string
  moc_mw: number
  wysokosc_wiezy: number
  srednica_rotora: number
  numer_seryjny: string
  wind_farm_id: string
  wind_farms: {
    nazwa: string
    client_id: string
    clients: {
      nazwa: string
    }
  }
}

interface Inspection {
  id: string
  numer_protokolu: string
  data_inspekcji: string
  typ_inspekcji: string
  status: string
  ocena_ogolna: string
}

export default function TurbineDetailPage() {
  const router = useRouter()
  const params = useParams()
  const turbineId = params.id as string

  const [turbine, setTurbine] = useState<Turbine | null>(null)
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTurbineData()
  }, [turbineId])

  async function fetchTurbineData() {
    const supabase = createClient()
    try {
      setLoading(true)

      const { data: turbineData, error: turbineError } = await supabase
        .from('turbines')
        .select('*, wind_farms(nazwa, client_id, clients(nazwa))')
        .eq('id', turbineId)
        .single()

      if (turbineError) throw turbineError
      setTurbine(turbineData)

      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from('inspections')
        .select('id, numer_protokolu, data_inspekcji, typ_inspekcji, status, ocena_ogolna')
        .eq('turbine_id', turbineId)
        .order('data_inspekcji', { ascending: false })

      if (inspectionsError) throw inspectionsError
      setInspections(inspectionsData || [])
    } catch (error) {
      console.error('Błąd przy pobieraniu danych turbiny:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTurbineUpdated = () => {
    fetchTurbineData()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!turbine) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Turbina nie znaleziona</p>
        <Button
          onClick={() => router.push('/turbiny')}
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
        <h1 className="text-3xl font-bold">{turbine.kod}</h1>
      </div>

      <div className="flex gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(
              `/klienci/${turbine.wind_farms.client_id}`
            )
          }
        >
          {turbine.wind_farms.clients.nazwa}
        </Button>
        <span className="text-gray-400">/</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(`/farmy/${turbine.wind_farm_id}`)
          }
        >
          {turbine.wind_farms.nazwa}
        </Button>
        <span className="text-gray-400">/</span>
        <span className="py-2">{turbine.kod}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dane turbiny</CardTitle>
        </CardHeader>
        <CardContent>
          <TurbineForm
            initialData={turbine}
            windFarmId={turbine.wind_farm_id}
            onSuccess={handleTurbineUpdated}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Historia inspekcji</CardTitle>
          <Button
            onClick={() =>
              router.push(
                `/inspekcje/nowa?turbine_id=${turbineId}`
              )
            }
            size="sm"
          >
            Nowa inspekcja
          </Button>
        </CardHeader>
        <CardContent>
          {inspections.length === 0 ? (
            <p className="text-gray-500">Brak inspekcji dla tej turbiny</p>
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
                      onClick={() =>
                        router.push(`/inspekcje/${inspection.id}`)
                      }
                    >
                      <TableCell>{inspection.numer_protokolu}</TableCell>
                      <TableCell>
                        {new Date(inspection.data_inspekcji).toLocaleDateString(
                          'pl-PL'
                        )}
                      </TableCell>
                      <TableCell>{inspection.typ_inspekcji}</TableCell>
                      <TableCell>{inspection.status}</TableCell>
                      <TableCell>{inspection.ocena_ogolna}</TableCell>
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
