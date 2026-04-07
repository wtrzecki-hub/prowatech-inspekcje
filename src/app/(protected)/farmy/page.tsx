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
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Farmy wiatrowe</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Dodaj farmę</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nowa farma wiatrowa</DialogTitle>
            </DialogHeader>
            <WindFarmForm onSuccess={handleFarmAdded} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <label className="text-sm font-medium">Filtruj po kliencie:</label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full md:w-64">
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

      {isMobile ? (
        <div className="space-y-4">
          {filteredWindFarms.map((farm) => (
            <Card
              key={farm.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/farmy/${farm.id}`)}
            >
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="font-semibold text-lg">{farm.name}</p>
                  <p className="text-sm text-gray-600">{farm.clients.name}</p>
                  <p className="text-sm">
                    <span className="font-semibold">Lokalizacja:</span>{' '}
                    {farm.location_address}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Moc łączna:</span>{' '}
                    {farm.total_capacity_mw} MW
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Turbiny:</span>{' '}
                    {farm.number_of_turbines}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Data uruchomienia:</span>{' '}
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
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa farmy</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Lokalizacja</TableHead>
                <TableHead>Moc łączna MW</TableHead>
                <TableHead>Liczba turbin</TableHead>
                <TableHead>Data uruchomienia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWindFarms.map((farm) => (
                <TableRow
                  key={farm.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/farmy/${farm.id}`)}
                >
                  <TableCell className="font-medium">{farm.name}</TableCell>
                  <TableCell>{farm.clients.name}</TableCell>
                  <TableCell>{farm.location_address}</TableCell>
                  <TableCell>{farm.total_capacity_mw}</TableCell>
                  <TableCell>{farm.number_of_turbines}</TableCell>
                  <TableCell>
                    {farm.commissioning_date
                      ? new Date(farm.commissioning_date).toLocaleDateString('pl-PL')
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
         