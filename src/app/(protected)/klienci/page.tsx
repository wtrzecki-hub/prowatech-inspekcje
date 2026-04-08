'use client'

import { useEffect, useState, Suspense } from 'react'
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
import { Plus, Building2, Search } from 'lucide-react'

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
  return (
    <Suspense fallback={<div className="space-y-4"><div className="h-10 w-48 bg-gray-200 animate-pulse rounded-xl" /><div className="h-64 w-full bg-gray-200 animate-pulse rounded-xl" /></div>}>
      <KlienciContent />
    </Suspense>
  )
}

function KlienciContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full max-w-sm rounded-xl" />
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
          <h1 className="text-2xl font-bold text-gray-900">Klienci</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} zarejestrowanych klientów</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 gap-2 px-5">
              <Plus className="h-4 w-4" />
              Dodaj klienta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nowy klient</DialogTitle>
            </DialogHeader>
            <ClientForm onSuccess={handleClientAdded} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Szukaj po nazwie, email lub telefonie..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 pl-10 rounded-xl border-gray-200"
        />
      </div>

      {filteredClients.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-gray-50 rounded-2xl mb-4">
            <Building2 className="h-10 w-10 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {search ? 'Brak wyników wyszukiwania' : 'Brak klientów'}
          </p>
          <p className="text-xs text-gray-400">
            {search ? `Nie znaleziono klientów dla "${search}"` : 'Dodaj pierwszego klienta, aby zacząć'}
          </p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-md transition-shadow rounded-xl border border-gray-100"
              onClick={() => router.push(`/klienci/${client.id}`)}
            >
              <CardContent className="p-4">
                <div className="space-y-1.5">
                  <p className="font-semibold text-gray-900">{client.name}</p>
                  <p className="text-sm text-gray-500">{client.short_name}</p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Osoba:</span>{' '}
                    {client.contact_person}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {client.contact_email}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Telefon:</span> {client.contact_phone}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">NIP:</span> {client.nip}
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
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3 px-4">Nazwa</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Nazwa skrócona</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Osoba kontaktowa</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Email</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Telefon</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">NIP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-blue-50/50 transition-colors border-b border-gray-50 h-16"
                  onClick={() => router.push(`/klienci/${client.id}`)}
                >
                  <TableCell className="font-semibold text-gray-900 px-4">{client.name}</TableCell>
                  <TableCell className="text-gray-600">{client.short_name}</TableCell>
                  <TableCell className="text-gray-600">{client.contact_person}</TableCell>
                  <TableCell className="text-gray-600">{client.contact_email}</TableCell>
                  <TableCell className="text-gray-600">{client.contact_phone}</TableCell>
                  <TableCell className="text-gray-600">{client.nip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
