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
import { WindFarmForm } from '@/components/forms/wind-farm-form'
import { TurbineForm } from '@/components/forms/turbine-form'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Plus, Wind } from 'lucide-react'

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
  manufacturer: string
  model: string
  rated_power_mw: number
  tower_height_m: number
  serial_number: string
}

export default function FarmDetailPage() {
  const router = useRouter()
  const params = useParams()
  const farmId = params.id as string

  const [windFarm, setWindFarm] = useState<WindFarm | null>(null)
  const [turbines, setTurbines] = useState<Turbine[]>([])
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
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 px-5">Kod</TableHead>
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
                    <TableCell className="font-mono font-semibold text-graphite-900 px-5 text-[13px]">{turbine.turbine_code}</TableCell>
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
    </div>
  )
}
