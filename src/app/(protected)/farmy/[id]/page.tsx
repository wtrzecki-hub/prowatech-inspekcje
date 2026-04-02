'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
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
import { WindFarmForm } from '@/components/forms/wind-farm-form'
import { TurbineForm } from '@/components/forms/turbine-form'
import { Skeleton } from '@/components/ui/skeleton'

interface WindFarm {
  id: string
  nazwa: string
  client_id: string
  lokalizacja: string
  lokalizacja_szerokosc: number
  lokalizacja_dlugosc: number
  moc_laczna_mw: number
  liczba_turbin: number
  data_uruchomienia: string
  clients: {
    nazwa: string
  }
}

interface Turbine {
  id: string
  kod: string
  producent: string
  model: string
  moc_mw: number
  wysokosc_wiezy: number
  numer_seryjny: string
}

export default function FarmDetailPage() {
  const router = useRouter()
  const params = useParams()
  const farmId = params.id as string

  const [windFarm, setWindFarm] = useState<WindFarm | null>(null)
  const [turbines, setTurbines] = useState<Turbine[]>([])
  const [loading, setLoading] = useState(true)
  const [isTurbineDialogOpen, setIsTurbineDialogOpen] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchWindFarmData()
  }, [farmId])

  async function fetchWindFarmData() {
    try {
      setLoading(true)

      const { data: farmData, error: farmError } = await supabase
        .from('wind_farms')
        .select('*, clients(nazwa)')
        .eq('id', farmId)
        .single()

      if (farmError) throw farmError
      setWindFarm(farmData)

      const { data: turbinesData, error: turbinesError } = await supabase
        .from('turbines')
        .select('*')
        .eq('wind_farm_id', farmId)
        .eq('is_deleted', false)
        .order('kod', { ascending: true })

      if (turbinesError) throw turbinesError
      setTurbines(turbinesData || [])
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
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!windFarm) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Farma nie znaleziona</p>
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
        >
          Wróć
        </Button>
        <h1 className="text-3xl font-bold">{windFarm.nazwa}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Szczegóły farmy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Klient</label>
              <p className="text-lg">{windFarm.clients.nazwa}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Moc łączna</label>
              <p className="text-lg">{windFarm.moc_laczna_mw} MW</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Lokalizacja</label>
              <p className="text-lg">{windFarm.lokalizacja}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Liczba turbin</label>
              <p className="text-lg">{windFarm.liczba_turbin}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">
                Współrzędne geograficzne
              </label>
              <p className="text-sm">
                {windFarm.lokalizacja_szerokosc}, {windFarm.lokalizacja_dlugosc}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">
                Data uruchomienia
              </label>
              <p className="text-lg">
                {new Date(windFarm.data_uruchomienia).toLocaleDateString('pl-PL')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Turbiny w farmie</CardTitle>
          <Dialog open={isTurbineDialogOpen} onOpenChange={setIsTurbineDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Dodaj turbinę</Button>
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
        <CardContent>
          {turbines.length === 0 ? (
            <p className="text-gray-500">Brak turbin w tej farmie</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Producent</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Moc MW</TableHead>
                    <TableHead>Wysokość wieży</TableHead>
                    <TableHead>Nr seryjny</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turbines.map((turbine) => (
                    <TableRow
                      key={turbine.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/turbiny/${turbine.id}`)}
                    >
                      <TableCell className="font-medium">{turbine.kod}</TableCell>
                      <TableCell>{turbine.producent}</TableCell>
                      <TableCell>{turbine.model}</TableCell>
                      <TableCell>{turbine.moc_mw}</TableCell>
                      <TableCell>{turbine.wysokosc_wiezy} m</TableCell>
                      <TableCell>{turbine.numer_seryjny}</TableCell>
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
