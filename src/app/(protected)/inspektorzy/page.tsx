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

interface Inspector {
  id: string
  full_name: string
  license_number: string
  specialty: string
  chamber_membership: string
  phone: string
  email: string
  is_active: boolean
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
        <h1 className="text-3xl font-bold">Inspektorzy</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingId(null)}>
              Dodaj inspektora
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
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

      {isMobile ? (
        <div className="space-y-4">
          {inspectors.map((inspector) => (
            <Card key={inspector.id}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-lg">
                        {inspector.full_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {inspector.specialty}
                      </p>
                    </div>
                    <Badge variant={inspector.is_active ? 'default' : 'secondary'}>
                      {inspector.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-semibold">Nr uprawnień:</span>{' '}
                      {inspector.license_number}
                    </p>
                    <p>
                      <span className="font-semibold">Izba:</span>{' '}
                      {inspector.chamber_membership}
                    </p>
                    <p>
                      <span className="font-semibold">Email:</span>{' '}
                      {inspector.email}
                    </p>
                    <p>
                      <span className="font-semibold">Telefon:</span>{' '}
                      {inspector.phone}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(inspector.id)
                        setIsDialogOpen(true)
                      }}
                    >
                      Edytuj
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleToggleActive(inspector.id, inspector.is_active)
                      }
                    >
                      {inspector.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                    </Button>
                  </div>
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
                <TableHead>Imię i nazwisko</TableHead>
                <TableHead>Nr uprawnień</TableHead>
                <TableHead>Specjalność</TableHead>
                <TableHead>Izba</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspectors.map((inspector) => (
                <TableRow key={inspector.id}>
                  <TableCell className="font-medium">
                    {inspector.full_name}
                  </TableCell>
                  <TableCell>{inspector.license_number}</TableCell>
                  <TableCell>{inspector.specialty}</TableCell>
                  <TableCell>{inspector.chamber_membership}</TableCell>
                  <TableCell>{inspector.phone}</TableCell>
                  <TableCell>{inspector.email}</TableCell>
                  <TableCell>
                    <Badge variant={inspector.is_active ? 'default' : 'secondary'}>
                      {inspector.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(inspector.id)
                          setIsDialogOpen(true)
                        }}
                      >
                        Edytuj
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleToggleActive(inspector.id, inspector.is_active)
                        }
                      >
                        {inspector.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {inspectors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Brak inspektorów</p>
        </div>
      )}
    </div>
  )
}
