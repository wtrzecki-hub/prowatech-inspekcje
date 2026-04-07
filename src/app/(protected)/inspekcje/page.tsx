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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight } from 'lucide-react'

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

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchClients()
  }, [])

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
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Inspekcje</h1>
          <Button asChild>
            <Link href="/inspekcje/nowa">Nowa inspekcja</Link>
          </Button>
        </div>

        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inspekcje</h1>
        <Button asChild>
          <Link href="/inspekcje/nowa">Nowa inspekcja</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-muted p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
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
            <SelectTrigger>
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
            <SelectTrigger>
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

          <Input
            placeholder="Szukaj..."
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value)
              setPage(1)
            }}
            className="lg:col-span-2"
          />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr protokołu</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Turbina</TableHead>
              <TableHead>Farma</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ocena ogólna</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inspections.map((inspection) => (
              <TableRow
                key={inspection.id}
                className="cursor-pointer hover:bg-muted"
                onClick={() => {
                  window.location.href = `/inspekcje/${inspection.id}`
                }}
              >
                <TableCell className="font-medium">
                  {inspection.protocol_number || '-'}
                </TableCell>
                <TableCell>
                  {inspection.inspection_date
                    ? format(new Date(inspection.inspection_date), 'dd.MM.yyyy', { locale: pl })
                    : '-'}
                </TableCell>
                <TableCell>{inspection.turbines?.turbine_code || '-'}</TableCell>
                <TableCell>{inspection.turbines?.wind_farms?.name || '-'}</TableCell>
                <TableCell>{inspection.turbines?.wind_farms?.clients?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline">
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
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {inspections.map((inspection) => (
          <Link key={inspection.id} href={`/inspekcje/${inspection.id}`}>
            <Card className="hover:bg-muted cursor-pointer transition-colors">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Nr protokołu</p>
                      <p className="font-semibold">
                        {inspection.protocol_number || '-'}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Data</p>
                      <p className="font-medium">
                        {inspection.inspection_date
                          ? format(new Date(inspection.inspection_date), 'dd.MM.yyyy', { locale: pl })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Turbina</p>
                      <p className="font-medium">{inspection.turbines?.turbine_code || '-'}</p>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted-foreground">Farma</p>
                    <p className="font-medium">{inspection.turbines?.wind_farms?.name || '-'}</p>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted-foreground">Klient</p>
                    <p className="font-medium">{inspection.turbines?.wind_farms?.clients?.name || '-'}</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Badge variant="outline">
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
                  </div>

                  {inspection.overall_condition_rating && (
                    <div className="pt-2">
                      <RatingBadge rating={inspection.overall_condition_rating} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Poprzednia
        </Button>
        <span className="text-sm text-muted-foreground">
          Strona {page} z {totalPages} ({totalCount} wyników)
        </span>
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Następna
        </Button>
      </div>
    </div>
  )
}
