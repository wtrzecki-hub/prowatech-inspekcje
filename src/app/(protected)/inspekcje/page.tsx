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
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('inspection_type', typeFilter)
    }

    if (searchFilter) {
      query = query.or(
        `protocol_number.ilike.%${searchFilter}%`
      )
    }

    const { data, count, error } = await query

    if (!error && data) {
      setInspections(data)
      setTotalCount(count || 0)
    }

    setLoading(false)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (loading && page === 1) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
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
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspekcje</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalCount} inspekcji łącznie</p>
        </div>
        <Button asChild className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 gap-2 px-5">
          <Link href="/inspekcje/nowa">
            <Plus className="h-4 w-4" />
            Nowa inspekcja
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-xl border border-gray-100 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-12 rounded-xl border-gray-200">
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
              <SelectTrigger className="h-12 rounded-xl border-gray-200">
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
              <SelectTrigger className="h-12 rounded-xl border-gray-200">
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Szukaj po numerze protokołu..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value)
                  setPage(1)
                }}
                className="h-12 pl-10 rounded-xl border-gray-200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {inspections.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-gray-50 rounded-2xl mb-4">
            <ClipboardList className="h-10 w-10 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Brak inspekcji</p>
          <p className="text-xs text-gray-400 mb-4">Nie znaleziono inspekcji spełniających kryteria</p>
          <Button asChild className="h-10 rounded-xl">
            <Link href="/inspekcje/nowa">Dodaj inspekcję</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-100">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3 px-4">Nr protokołu</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Data</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Turbina</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Farma</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Klient</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Typ</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Ocena</TableHead>
                  {userRole === 'admin' && (
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3 w-16"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((inspection) => (
                  <TableRow
                    key={inspection.id}
                    className="cursor-pointer hover:bg-blue-50/50 transition-colors border-b border-gray-50 h-16"
                    onClick={() => {
                      window.location.href = `/inspekcje/${inspection.id}`
                    }}
                  >
                    <TableCell className="font-semibold text-gray-900 px-4">
                      {inspection.protocol_number || '-'}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {inspection.inspection_date
                        ? format(new Date(inspection.inspection_date), 'dd.MM.yyyy', { locale: pl })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-gray-600">{inspection.turbines?.turbine_code || '-'}</TableCell>
                    <TableCell className="text-gray-600">{inspection.turbines?.wind_farms?.name || '-'}</TableCell>
                    <TableCell className="text-gray-600">{inspection.turbines?.wind_farms?.clients?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-medium">
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
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        <button
                          onClick={(e) => handleDelete(e, inspection.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
                <Card className="hover:shadow-md cursor-pointer transition-all rounded-xl border border-gray-100">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs text-gray-400">Nr protokołu</p>
                          <p className="font-semibold text-gray-900">
                            {inspection.protocol_number || '-'}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-400">Data</p>
                          <p className="font-medium text-gray-700">
                            {inspection.inspection_date
                              ? format(new Date(inspection.inspection_date), 'dd.MM.yyyy', { locale: pl })
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Turbina</p>
                          <p className="font-medium text-gray-700">{inspection.turbines?.turbine_code || '-'}</p>
                        </div>
                      </div>

                      <div className="text-sm">
                        <p className="text-xs text-gray-400">Farma</p>
                        <p className="font-medium text-gray-700">{inspection.turbines?.wind_farms?.name || '-'}</p>
                      </div>

                      <div className="text-sm">
                        <p className="text-xs text-gray-400">Klient</p>
                        <p className="font-medium text-gray-700">{inspection.turbines?.wind_farms?.clients?.name || '-'}</p>
                      </div>

                      <div className="flex gap-2 flex-wrap pt-1">
                        <Badge variant="outline" className="text-xs">
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
            className="h-10 rounded-xl border-gray-200"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Poprzednia
          </Button>
          <span className="text-sm text-gray-500 font-medium">
            {page} / {totalPages} ({totalCount})
          </span>
          <Button
            variant="outline"
            className="h-10 rounded-xl border-gray-200"
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
