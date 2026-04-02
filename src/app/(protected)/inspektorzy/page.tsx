'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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
  imie: string
  nazwisko: string
  numer_uprawnien: string
  specjalnosc: string
  izba: string
  telefon: string
  email: string
  aktywny: boolean
}

export default function InspektorzePage() {
  const [inspectors, setInspectors] = useState<Inspector[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('inspectors')
        .select('*')
        .eq('is_deleted', false)
        .order('nazwisko', { ascending: true })

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
    try {
      const { error } = await supabase
        .from('inspectors')
        .update({ aktywny: !currentStatus })
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
                        {inspector.imie} {inspector.nazwisko}
                      </p>
                      <p className="text-sm text-gray-600">
                        {inspector.specjalnosc}
                      </p>
                    </div>
                    <Badge variant={inspector.aktywny ? 'default' : 'secondary'}>
                      {inspector.aktywny ? 'Aktywny' : 'Nieaktywny'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-semibold">Nr uprawnień:</span>{' '}
                      {inspector.numer_uprawnien}
                    </p>
                    <p>
                      <span className="font-semibold">Izba:</span>{' '}
                      {inspector.izba}
                    </p>
                    <p>
                      <span className="font-semibold">Email:</span>{' '}
                      {inspector.email}
                    </p>
                    <p>
                      <span className="font-semibold">Telefon:</span>{' '}
                      {inspector.telefon}
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
                        handleToggleActive(inspector.id, inspector.aktywny)
                      }
                    >
                      {inspector.aktywny ? 'Dezaktywuj' : 'Aktywuj'}
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
                    {inspector.imie} {inspector.nazwisko}
                  </TableCell>
                  <TableCell>{inspector.numer_uprawnien}</TableCell>
                  <TableCell>{inspector.specjalnosc}</TableCell>
                  <TableCell>{inspector.izba}</TableCell>
                  <TableCell>{inspector.telefon}</TableCell>
                  <TableCell>{inspector.email}</TableCell>
                  <TableCell>
                    <Badge variant={inspector.aktywny ? 'default' : 'secondary'}>
                      {inspector.aktywny ? 'Aktywny' : 'Nieaktywny'}
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
                          handleToggleActive(inspector.id, inspector.aktywny)
                        }
                      >
                        {inspector.aktywny ? 'Dezaktywuj' : 'Aktywuj'}
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
