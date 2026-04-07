'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { ClientForm } from '@/components/forms/client-form'
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

export default function KlienciPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  // const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetchClients()
    if (searchParams.get('nowy') === 'true') {
      setIsDialogOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    const filtered = clients.filter((client) =>
      client.name?.toLowerCase().includes(search.toLowerCase()) ||
      client.contact_email?.toLowerCase().includes(search.toLowerCase()) ||
      client.contact_phone?.includes(search)
    )
    setFilteredClients(filtered)
  }, [search, clients])

  async function fetchClients() {
    const supabase = createClient()
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .not('is_deleted', 'is', true)
        .order('name', { ascending: true })

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Błąd przy pobieraniu klientów:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClientAdded = () => {
    setIsDialogOpen(false)
    fetchClients()
  }

  if (loading && clients.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
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
        <h1 className="text-3xl font-bold">Klienci</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Dodaj klienta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nowy klient</DialogTitle>
            </DialogHeader>
            <ClientForm onSuccess={handleClientAdded} />
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Szukaj po nazwie, email lub telefonie..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isMobile ? (
        <div className="space-y-4">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/klienci/${client.id}`)}
            >
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="font-semibold text-lg">{client.name}</p>
                  <p className="text-sm text-gray-600">{client.short_name}</p>
                  <p className="text-sm">
                    <span className="font-semibold">Osoba kontaktowa:</span>{' '}
                    {client.contact_person}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Email:</span> {client.contact_email}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Telefon:</span> {client.contact_phone}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">NIP:</span> {client.nip}
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
                <TableHead>Nazwa</TableHead>
                <TableHead>Nazwa skrócona</TableHead>
                <TableHead>Osoba kontaktowa</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>NIP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/klienci/${client.id}`)}
                >
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.short_name}</TableCell>
                  <TableCell>{client.contact_person}</TableCell>
                  <TableCell>{client.contact_email}</TableCell>
                  <TableCell>{client.contact_phone}</TableCell>
                  <TableCell>{client.nip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
