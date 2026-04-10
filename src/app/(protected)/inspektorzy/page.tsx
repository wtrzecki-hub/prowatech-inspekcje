'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { InspectorForm } from '@/components/forms/inspector-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Users, Pencil, Power } from 'lucide-react'

interface Inspector {
  id: string
  full_name: string
  license_number: string
  specialty: string
  chamber_membership: string
  chamber_certificate_number: string | null
  chamber_expiry_date: string | null
  phone: string
  email: string
  is_active: boolean
  gwo_certificate_number: string | null
  gwo_expiry_date: string | null
  gwo_scan_url: string | null
  udt_certificate_number: string | null
  udt_expiry_date: string | null
  udt_scan_url: string | null
  sep_certificate_number: string | null
  sep_expiry_date: string | null
  sep_scan_url: string | null
}

export default function InspektorzePage() {
  const [inspectors, setInspectors] = useState<Inspector[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetchInspectors()
  }, [])

  async function fetchInspectors() {
    const supabase = createClient()
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('inspectors')
        .select('*')
        .not('is_deleted', 'is', true)
        .order('full_name', { ascending: true })

      if (error) throw error
      setInspectors(data || [])
    } catch (error) {
      console.error('Błąd przy pobieraniu inspektorów:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInspectorAdded = () => {
    setIsDialogOpen(false)
    setEditingId(null)
    fetchInspectors()
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('inspectors')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error
      fetchInspectors()
    } catch (error) {
      console.error('Błąd przy zmianie statusu inspektora:', error)
    }
  }

  const editingInspector = editingId
    ? inspectors.find((i) => i.id === editingId)
    : null

  if (loading && inspectors.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-36 rounded-xl" />
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspektorzy</h1>
          <p className="text-sm text-gray-500 mt-0.5">{inspectors.length} zarejestrowanych inspektorów</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 gap-2 px-5"
              onClick={() => setEditingId(null)}
            >
              <Plus className="h-4 w-4" />
              Dodaj inspektora
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edytuj inspektora' : 'Nowy inspektor'}
              </DialogTitle>
            </DialogHeader>
            <InspectorForm
              initialData={editingInspector || undefined}
              onSuccess={handleInspectorAdded}
            />
          </DialogContent>
        </Dialog>
      </div>

      {inspectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-gray-50 rounded-2xl mb-4">
            <Users className="h-10 w-10 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Brak inspektorów</p>
          <p className="text-xs text-gray-400">Dodaj pierwszego inspektora, aby zacząć</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {inspectors.map((inspector) => (
            <Card key={inspector.id} className="rounded-xl border border-gray-100">
              <CardContent className="p-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {inspector.full_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {inspector.specialty}
                      </p>
                    </div>
                    <Badge
                      variant={inspector.is_active ? 'default' : 'secondary'}
                      className={inspector.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-500'
                      }
                    >
                      {inspector.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">Nr uprawnień:</span> {inspector.license_number}</p>
                    <p><span className="font-medium">Izba:</span> {inspector.chamber_membership}{inspector.chamber_certificate_number ? ` (${inspector.chamber_certificate_number})` : ''}</p>
                    <p><span className="font-medium">Email:</span> {inspector.email}</p>
                    <p><span className="font-medium">Telefon:</span> {inspector.phone}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inspector.gwo_certificate_number && (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">GWO ✓</Badge>
                    )}
                    {inspector.udt_certificate_number && (
                      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">UDT ✓</Badge>
                    )}
                    {inspector.sep_certificate_number && (
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">SEP ✓</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 rounded-xl border-gray-200 gap-1.5"
                      onClick={() => {
                        setEditingId(inspector.id)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edytuj
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 rounded-xl border-gray-200 gap-1.5"
                      onClick={() =>
                        handleToggleActive(inspector.id, inspector.is_active)
                      }
                    >
                      <Power className="h-3.5 w-3.5" />
                      {inspector.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                    </Button>
                  </div>
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
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3 px-4">Imię i nazwisko</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Nr uprawnień</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Specjalność</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Izba</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Telefon</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Email</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Uprawnienia</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 py-3">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspectors.map((inspector) => (
                <TableRow key={inspector.id} className="border-b border-gray-50 h-16 hover:bg-gray-50/50">
                  <TableCell className="font-semibold text-gray-900 px-4">
                    {inspector.full_name}
                  </TableCell>
                  <TableCell className="text-gray-600">{inspector.license_number}</TableCell>
                  <TableCell className="text-gray-600">{inspector.specialty}</TableCell>
                  <TableCell className="text-gray-600">{inspector.chamber_membership}{inspector.chamber_certificate_number ? ` (${inspector.chamber_certificate_number})` : ''}</TableCell>
                  <TableCell className="text-gray-600">{inspector.phone}</TableCell>
                  <TableCell className="text-gray-600">{inspector.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {inspector.gwo_certificate_number && (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">GWO ✓</Badge>
                      )}
                      {inspector.udt_certificate_number && (
                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">UDT ✓</Badge>
                      )}
                      {inspector.sep_certificate_number && (
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">SEP ✓</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={inspector.is_active ? 'default' : 'secondary'}
                      className={inspector.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-500'
                      }
                    >
                      {inspector.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 rounded-lg px-3 text-gray-600 hover:text-gray-900 gap-1"
                        onClick={() => {
                          setEditingId(inspector.id)
                          setIsDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edytuj
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 rounded-lg px-3 text-gray-600 hover:text-gray-900 gap-1"
                        onClick={() =>
                          handleToggleActive(inspector.id, inspector.is_active)
                        }
                      >
                        <Power className="h-3.5 w-3.5" />
                        {inspector.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                      </Button>
                    </div>
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
