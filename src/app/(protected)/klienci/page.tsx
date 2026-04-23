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
    <Suspense fallback={<div className="space-y-4"><div className="h-10 w-48 bg-graphite-100 animate-pulse rounded-xl" /><div className="h-64 w-full bg-graphite-100 animate-pulse rounded-xl" /></div>}>
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
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full max-w-sm rounded-xl" />
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
          <h1 className="text-2xl font-bold text-graphite-900">Klienci</h1>
          <p className="font-mono text-sm text-graphite-500 mt-0.5">{clients.length} zarejestrowanych klientów</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 gap-2 px-5">
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
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
        <Input
          placeholder="Szukaj po nazwie, email lub telefonie..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-10 rounded-lg border-graphite-200"
        />
      </div>

      {filteredClients.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-graphite-50 rounded-2xl mb-4">
            <Building2 className="h-10 w-10 text-graphite-200" />
          </div>
          <p className="text-sm font-semibold text-graphite-800 mb-1">
            {search ? 'Brak wyników wyszukiwania' : 'Brak klientów'}
          </p>
          <p className="text-xs text-graphite-500">
            {search ? `Nie znaleziono klientów dla "${search}"` : 'Dodaj pierwszego klienta, aby zacząć'}
          </p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-sm transition-shadow rounded-xl border border-graphite-200"
              onClick={() => router.push(`/klienci/${client.id}`)}
            >
              <CardContent className="p-4">
                <div className="space-y-1.5">
                  <p className="font-semibold text-graphite-900">{client.name}</p>
                  <p className="text-sm text-graphite-500">{client.short_name}</p>
                  <p className="text-sm text-graphite-500">
                    <span className="font-medium text-graphite-800">Osoba:</span>{' '}
                    {client.contact_person}
                  </p>
                  <p className="text-sm text-graphite-500">
                    <span className="font-medium text-graphite-800">Email:</span> {client.contact_email}
                  </p>
                  <p className="text-sm text-graphite-500">
                    <span className="font-medium text-graphite-800">Telefon:</span> {client.contact_phone}
                  </p>
                  <p className="font-mono text-sm text-graphite-500">
                    <span className="font-sans font-medium text-graphite-800">NIP:</span> {client.nip}
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
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 px-5">Nazwa</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Nazwa skrócona</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Osoba kontaktowa</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Email</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Telefon</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">NIP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-graphite-50/50 transition-colors border-b border-graphite-100 h-[52px]"
                  onClick={() => router.push(`/klienci/${client.id}`)}
                >
                  <TableCell className="font-semibold text-graphite-900 px-5 text-[13px]">{client.name}</TableCell>
                  <TableCell className="text-graphite-500 text-[13px]">{client.short_name}</TableCell>
                  <TableCell className="text-graphite-500 text-[13px]">{client.contact_person}</TableCell>
                  <TableCell className="text-graphite-500 text-[13px]">{client.contact_email}</TableCell>
                  <TableCell className="font-mono text-graphite-500 text-[13px]">{client.contact_phone}</TableCell>
                  <TableCell className="font-mono text-graphite-500 text-[13px]">{client.nip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
