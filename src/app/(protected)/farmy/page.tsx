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
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-64 rounded-xl" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Farmy wiatrowe</h1>
          <p className="text-sm text-gray-500 mt-0.5">{windFarms.length} zarejestrowanych farm</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 gap-2 px-5">
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
        <label className="text-sm font-medium text-gray-600">Filtruj po kliencie:</label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full md:w-72 h-12 rounded-xl border-gray-200">
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
          <div className="p-4 bg-gray-50 rounded-2xl mb-4">
            <Wind className="h-10 w-10 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Brak farm wiatrowych</p>
          <p className="text-xs text-gray-400">Dodaj pierwszą farmę, aby zacząć</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {filteredWindFarms.map((farm) => (
            <Card
              key={farm.id}
              className="cursor-pointer hover:shadow-md transition-shadow rounded-xl border border-gray-100"
              onClick={() => router.push(`/farmy/${farm.id}`)}
            >
              <CardContent className="p-4">
                <div className="space-y-1.5">
                  <p className="font-semibold text-gray-900">{farm.name}</p>
                  <p className="text-sm text-gray-500">{farm.clients.name}</p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Lokalizacja:</span>{' '}
                    {farm.location_address}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Moc łączna:</span>{' '}
                    {farm.total_capacity_mw} MW
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Turbiny:</span>{' '}
                    {farm.number_of_turbines}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Data uruchomienia:</span>{' '}
                    {farm.commissioning_date
                      ? new Date(farm.commissioning_date).toLocaleDateString('pl-PL')
                      : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-100">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3 px-4">Nazwa farmy</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Klient</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Lokalizacja</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Moc MW</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Turbiny</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Data uruchomienia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWindFarms.map((farm) => (
                <TableRow
                  key={farm.id}
                  className="cursor-pointer hover:bg-blue-50/50 transition-colors border-b border-gray-50 h-16"
                  onClick={() => router.push(`/farmy/${farm.id}`)}
                >
                  <TableCell className="font-semibold text-gray-900 px-4">{farm.name}</TableCell>
                  <TableCell className="text-gray-600">{farm.clients.name}</TableCell>
                  <TableCell className="text-gray-600">{farm.location_address}</TableCell>
                  <TableCell className="text-gray-600 font-medium">{farm.total_capacity_mw}</TableCell>
                  <TableCell className="text-gray-600 font-medium">{farm.number_of_turbines}</TableCell>
                  <TableCell className="text-gray-600">
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
