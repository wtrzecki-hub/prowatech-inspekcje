'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { WindFarmForm } from '@/components/forms/wind-farm-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Wind } from 'lucide-react'

interface WindFarm {
  id: string
  name: string
  client_id: string
  location_address: string
  total_capacity_mw: number
  number_of_turbines: number
  commissioning_date: string
  clients: {
    name: string
  }
}

interface Client {
  id: string
  name: string
}

export default function FarmyPage() {
  const router = useRouter()
  const [windFarms, setWindFarms] = useState<WindFarm[]>([])
  const [filteredWindFarms, setFilteredWindFarms] = useState<WindFarm[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const filtered =
      selectedClientId === 'all'
        ? windFarms
        : windFarms.filter((farm) => farm.client_id === selectedClientId)
    setFilteredWindFarms(filtered)
  }, [selectedClientId, windFarms])

  async function fetchData() {
    const supabase = createClient()
    try {
      setLoading(true)

      const { data: farmsData, error: farmsError } = await supabase
        .from('wind_farms')
        .select(
          'id, name, client_id, location_address, total_capacity_mw, number_of_turbines, commissioning_date, clients(name)'
        )
        .not('is_deleted', 'is', true)
        .order('name', { ascending: true })

      if (farmsError) throw farmsError
      setWindFarms(farmsData || [])

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .not('is_deleted', 'is', true)
        .order('name', { ascending: true })

      if (clientsError) throw clientsError
      setClients(clientsData || [])
    } catch (error) {
      console.error('Błąd przy pobieraniu farm:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFarmAdded = () => {
    setIsDialogOpen(false)
    fetchData()
  }

  if (loading && windFarms.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite-900">Farmy wiatrowe</h1>
          <p className="font-mono text-sm text-graphite-500 mt-0.5">{windFarms.length} zarejestrowanych farm</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 gap-2 px-5">
              <Plus className="h-4 w-4" />
              Dodaj farmę
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nowa farma wiatrowa</DialogTitle>
            </DialogHeader>
            <WindFarmForm onSuccess={handleFarmAdded} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <label className="text-sm font-medium text-graphite-500">Filtruj po kliencie:</label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full md:w-72 h-10 rounded-lg border-graphite-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy klienci</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredWindFarms.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-graphite-50 rounded-2xl mb-4">
            <Wind className="h-10 w-10 text-graphite-200" />
          </div>
          <p className="text-sm font-semibold text-graphite-800 mb-1">Brak farm wiatrowych</p>
          <p className="text-xs text-graphite-500">Dodaj pierwszą farmę, aby zacząć</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {filteredWindFarms.map((farm) => (
            <Card
              key={farm.id}
              className="cursor-pointer hover:shadow-sm transition-shadow rounded-xl border border-graphite-200"
              onClick={() => router.push(`/farmy/${farm.id}`)}
            >
              <CardContent className="p-4">
                <div className="space-y-1.5">
                  <p className="font-semibold text-graphite-900">{farm.name}</p>
                  <p className="text-sm text-graphite-500">{farm.clients.name}</p>
                  <p className="text-sm text-graphite-500">
                    <span className="font-medium text-graphite-800">Lokalizacja:</span>{' '}
                    {farm.location_address}
                  </p>
                  <p className="text-sm text-graphite-500">
                    <span className="font-medium text-graphite-800">Moc łączna:</span>{' '}
                    <span className="font-mono">{farm.total_capacity_mw} MW</span>
                  </p>
                  <p className="text-sm text-graphite-500">
                    <span className="font-medium text-graphite-800">Turbiny:</span>{' '}
                    <span className="font-mono">{farm.number_of_turbines}</span>
                  </p>
                  <p className="text-sm text-graphite-500">
                    <span className="font-medium text-graphite-800">Data uruchomienia:</span>{' '}
                    <span className="font-mono">
                      {farm.commissioning_date
                        ? new Date(farm.commissioning_date).toLocaleDateString('pl-PL')
                        : '-'}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-xl border border-graphite-200 shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-graphite-50/50 hover:bg-graphite-50/50 border-b border-graphite-100">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 px-5">Nazwa farmy</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Klient</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Lokalizacja</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Moc MW</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Turbiny</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Data uruchomienia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWindFarms.map((farm) => (
                <TableRow
                  key={farm.id}
                  className="cursor-pointer hover:bg-graphite-50/50 transition-colors border-b border-graphite-100 h-[52px]"
                  onClick={() => router.push(`/farmy/${farm.id}`)}
                >
                  <TableCell className="font-semibold text-graphite-900 px-5 text-[13px]">{farm.name}</TableCell>
                  <TableCell className="text-graphite-500 text-[13px]">{farm.clients.name}</TableCell>
                  <TableCell className="text-graphite-500 text-[13px]">{farm.location_address}</TableCell>
                  <TableCell className="font-mono text-graphite-800 font-medium text-[13px]">{farm.total_capacity_mw}</TableCell>
                  <TableCell className="font-mono text-graphite-800 font-medium text-[13px]">{farm.number_of_turbines}</TableCell>
                  <TableCell className="font-mono text-graphite-500 text-[13px]">
                    {farm.commissioning_date
                      ? new Date(farm.commissioning_date).toLocaleDateString('pl-PL')
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
