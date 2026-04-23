'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { RatingBadge } from '@/components/inspection/rating-badge'
import {
  INSPECTION_TYPES,
  INSPECTION_STATUSES,
  STATUS_COLORS,
} from '@/lib/constants'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight, Plus, ClipboardList, Search, Trash2 } from 'lucide-react'

interface Inspection {
  id: string
  protocol_number: string | null
  inspection_date: string
  inspection_type: 'annual' | 'five_year'
  status: string
  overall_condition_rating: 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny' | null
  turbines: {
    turbine_code: string
    wind_farms: {
      name: string
      clients: {
        name: string
      }
    }
  } | null
}

const STATUSES_SELECT = [
  { value: 'all', label: 'Wszystkie statusy' },
  ...INSPECTION_STATUSES,
]

const TYPES_SELECT = [
  { value: 'all', label: 'Wszystkie rodzaje' },
  ...INSPECTION_TYPES,
]

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 25

  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetchClients()
    fetchUserRole()
  }, [])

  const fetchUserRole = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (data) setUserRole(data.role)
    }
  }

  const handleDelete = async (e: React.MouseEvent, inspectionId: string) => {
    e.stopPropagation()
    if (!confirm('Czy na pewno chcesz usunąć tę inspekcję?')) return
    const supabase = createClient()
    const { error } = await supabase.from('inspections').update({ is_deleted: true }).eq('id', inspectionId)
    if (error) {
      alert('Błąd usuwania: ' + error.message)
    } else {
      setInspections(inspections.filter(i => i.id !== inspectionId))
    }
  }

  useEffect(() => {
    fetchInspections()
  }, [page, statusFilter, typeFilter, clientFilter, searchFilter])

  const fetchClients = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true })

    if (data) {
      setClients(data)
    }
  }

  const fetchInspections = async () => {
    const supabase = createClient()
    setLoading(true)
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('inspections')
      .select(
        `
        id,
        protocol_number,
        inspection_date,
        inspection_type,
        status,
        overall_condition_rating,
        turbines(turbine_code, wind_farms(name, clients(name)))
      `,
        { count: 'exact' }
      )
      .not('is_deleted', 'is', true)
      .range(offset, offset + ((clientFilter !== 'all' || searchFilter) ? 250 : pageSize) - 1)
      .order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('inspection_type', typeFilter)
    }

    const { data, count, error } = await query

    if (!error && data) {
      let filtered = data as Inspection[]
      if (clientFilter && clientFilter !== 'all') {
        const selectedClient = clients.find(c => c.id === clientFilter)
        if (selectedClient) {
          filtered = filtered.filter(i =>
            i.turbines?.wind_farms?.clients?.name === selectedClient.name
          )
        }
      }
      if (searchFilter) {
        const s = searchFilter.toLowerCase()
        filtered = filtered.filter(i =>
          i.protocol_number?.toLowerCase().includes(s) ||
          i.turbines?.turbine_code?.toLowerCase().includes(s) ||
          i.turbines?.wind_farms?.name?.toLowerCase().includes(s) ||
          i.turbines?.wind_farms?.clients?.name?.toLowerCase().includes(s)
        )
      }
      setInspections(filtered)
      setTotalCount(clientFilter !== 'all' || searchFilter ? filtered.length : (count || 0))
    }

    setLoading(false)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (loading && page === 1) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
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
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite-900">Inspekcje</h1>
          <p className="font-mono text-sm text-graphite-500 mt-0.5">{totalCount} inspekcji łącznie</p>
        </div>
        <Button asChild className="h-10 gap-2 px-5">
          <Link href="/inspekcje/nowa">
            <Plus className="h-4 w-4" />
            Nowa inspekcja
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-lg border-graphite-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES_SELECT.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 rounded-lg border-graphite-200">
                <SelectValue placeholder="Typ kontroli" />
              </SelectTrigger>
              <SelectContent>
                {TYPES_SELECT.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-10 rounded-lg border-graphite-200">
                <SelectValue placeholder="Klient" />
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

            <div className="relative lg:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
              <Input
                placeholder="Szukaj po numerze protokołu..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value)
                  setPage(1)
                }}
                className="h-10 pl-10 rounded-lg border-graphite-200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {inspections.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-graphite-50 rounded-2xl mb-4">
            <ClipboardList className="h-10 w-10 text-graphite-200" />
          </div>
          <p className="text-sm font-semibold text-graphite-800 mb-1">Brak inspekcji</p>
          <p className="text-xs text-graphite-500 mb-4">Nie znaleziono inspekcji spełniających kryteria</p>
          <Button asChild className="h-10 rounded-xl">
            <Link href="/inspekcje/nowa">Dodaj inspekcję</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block rounded-xl border border-graphite-200 shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-graphite-50/50 hover:bg-graphite-50/50 border-b border-graphite-100">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 px-5">Nr protokołu</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Data</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Turbina</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Farma</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Klient</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Typ</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Ocena</TableHead>
                  {userRole === 'admin' && (
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5 w-16"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((inspection) => (
                  <TableRow
                    key={inspection.id}
                    className="cursor-pointer hover:bg-graphite-50/50 transition-colors border-b border-graphite-100 h-[52px]"
                    onClick={() => {
                      window.location.href = `/inspekcje/${inspection.id}`
                    }}
                  >
                    <TableCell className="font-mono font-semibold text-graphite-900 px-5 text-[13px]">
                      {inspection.protocol_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-graphite-500 text-[13px]">
                      {inspection.inspection_date
                        ? format(new Date(inspection.inspection_date), 'dd.MM.yyyy', { locale: pl })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      <span className="font-mono font-medium text-graphite-800">
                        {inspection.turbines?.turbine_code || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-graphite-500 text-[13px]">{inspection.turbines?.wind_farms?.name || '-'}</TableCell>
                    <TableCell className="text-graphite-500 text-[13px]">{inspection.turbines?.wind_farms?.clients?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-medium border-graphite-200 text-graphite-600">
                        {inspection.inspection_type === 'annual'
                          ? 'Roczna'
                          : 'Pięcioletnia'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={STATUS_COLORS[inspection.status]}
                      >
                        {INSPECTION_STATUSES.find((s) => s.value === inspection.status)
                          ?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inspection.overall_condition_rating ? (
                        <RatingBadge rating={inspection.overall_condition_rating} />
                      ) : (
                        <span className="text-graphite-400 text-sm">-</span>
                      )}
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        <button
                          onClick={(e) => handleDelete(e, inspection.id)}
                          className="p-2 rounded-lg text-graphite-400 hover:text-danger hover:bg-danger-50 transition-colors"
                          title="Usuń inspekcję"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {inspections.map((inspection) => (
              <Link key={inspection.id} href={`/inspekcje/${inspection.id}`}>
                <Card className="hover:shadow-sm cursor-pointer transition-all rounded-xl border border-graphite-200">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs text-graphite-500">Nr protokołu</p>
                          <p className="font-mono font-semibold text-graphite-900">
                            {inspection.protocol_number || '-'}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-graphite-400 flex-shrink-0 mt-1" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-graphite-500">Data</p>
                          <p className="font-mono font-medium text-graphite-800">
                            {inspection.inspection_date
                              ? format(new Date(inspection.inspection_date), 'dd.MM.yyyy', { locale: pl })
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-graphite-500">Turbina</p>
                          <p className="font-mono font-medium text-graphite-800">{inspection.turbines?.turbine_code || '-'}</p>
                        </div>
                      </div>

                      <div className="text-sm">
                        <p className="text-xs text-graphite-500">Farma</p>
                        <p className="font-medium text-graphite-800">{inspection.turbines?.wind_farms?.name || '-'}</p>
                      </div>

                      <div className="text-sm">
                        <p className="text-xs text-graphite-500">Klient</p>
                        <p className="font-medium text-graphite-800">{inspection.turbines?.wind_farms?.clients?.name || '-'}</p>
                      </div>

                      <div className="flex gap-2 flex-wrap pt-1">
                        <Badge variant="outline" className="text-xs border-graphite-200 text-graphite-600">
                          {inspection.inspection_type === 'annual'
                            ? 'Roczna'
                            : 'Pięcioletnia'}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[inspection.status]}
                        >
                          {INSPECTION_STATUSES.find((s) => s.value === inspection.status)
                            ?.label}
                        </Badge>
                        {inspection.overall_condition_rating && (
                          <RatingBadge rating={inspection.overall_condition_rating} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <Button
            variant="outline"
            className="h-9 rounded-lg border-graphite-200 text-graphite-700"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Poprzednia
          </Button>
          <span className="font-mono text-sm text-graphite-500 font-medium">
            {page} / {totalPages} ({totalCount})
          </span>
          <Button
            variant="outline"
            className="h-9 rounded-lg border-graphite-200 text-graphite-700"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Następna
          </Button>
        </div>
      )}
    </div>
  )
}
