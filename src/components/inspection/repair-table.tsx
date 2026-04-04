'use client'

import { useEffect, useRef, useState } from 'react'
import { Edit2, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { createBrowserClient } from '@supabase/ssr'

interface RepairRecommendation {
  id: string
  inspection_id: string
  element_id: string | null
  element_name: string | null
  scope_description: string
  repair_type: 'NG' | 'NB' | 'K'
  urgency_level: 'I' | 'II' | 'III' | 'IV'
  estimated_cost: number | null
  deadline_date: string | null
  is_completed: boolean
  completion_date: string | null
}

interface Element {
  id: string
  name: string
}

interface RepairTableProps {
  inspectionId: string
  elements?: Element[]
}

const urgencyColors: Record<string, { badge: string; bg: string }> = {
  I: { badge: 'bg-red-100 text-red-800', bg: 'bg-red-50' },
  II: { badge: 'bg-orange-100 text-orange-800', bg: 'bg-orange-50' },
  III: { badge: 'bg-yellow-100 text-yellow-800', bg: 'bg-yellow-50' },
  IV: { badge: 'bg-green-100 text-green-800', bg: 'bg-green-50' },
}

const typeColors: Record<string, string> = {
  NG: 'bg-red-100 text-red-800',
  NB: 'bg-orange-100 text-orange-800',
  K: 'bg-green-100 text-green-800',
}

const typeLabels: Record<string, string> = {
  NG: 'Naprawy główne',
  NB: 'Naprawy bieżące',
  K: 'Konserwacja',
}

export function RepairTable({ inspectionId, elements = [] }: RepairTableProps) {
  const [repairs, setRepairs] = useState<RepairRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    element_id: '',
    element_name: '',
    scope_description: '',
    repair_type: 'NB' as 'NG' | 'NB' | 'K',
    urgency_level: 'III' as 'I' | 'II' | 'III' | 'IV',
    estimated_cost: '',
    deadline_date: '',
  })
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadRepairs()
  }, [inspectionId])

  const loadRepairs = async () => {
    try {
      const supabase = createBrowserClient(
        'https://lhxhsprqoecepojrxepf.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
      )

      const { data, error } = await supabase
        .from('repair_recommendations')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setRepairs(data || [])
    } catch (error) {
      console.error('Błąd podczas ładowania zaleceń napraw:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (repair?: RepairRecommendation) => {
    if (repair) {
      setEditingId(repair.id)
      setFormData({
        element_id: repair.element_id || '',
        element_name: repair.element_name || '',
        scope_description: repair.scope_description,
        repair_type: repair.repair_type,
        urgency_level: repair.urgency_level,
        estimated_cost: repair.estimated_cost?.toString() || '',
        deadline_date: repair.deadline_date || '',
      })
    } else {
      setEditingId(null)
      setFormData({
        element_id: '',
        element_name: '',
        scope_description: '',
        repair_type: 'NB',
        urgency_level: 'III',
        estimated_cost: '',
        deadline_date: '',
      })
    }
    setDialogOpen(true)
  }

  const handleElementChange = (elementId: string) => {
    const selected = elements.find((e) => e.id === elementId)
    setFormData({
      ...formData,
      element_id: elementId,
      element_name: selected?.name || '',
    })
  }

  const handleSaveRepair = async () => {
    if (!formData.scope_description.trim()) {
      return
    }

    try {
      const supabase = createBrowserClient(
        'https://lhxhsprqoecepojrxepf.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
      )

      const repairData = {
        element_id: formData.element_id || null,
        element_name: formData.element_name || null,
        scope_description: formData.scope_description,
        repair_type: formData.repair_type,
        urgency_level: formData.urgency_level,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        deadline_date: formData.deadline_date || null,
      }

      if (editingId) {
        const { error } = await supabase
          .from('repair_recommendations')
          .update(repairData)
          .eq('id', editingId)

        if (error) throw error

        setRepairs(repairs.map((r) => (r.id === editingId ? { ...r, ...repairData } : r)))
      } else {
        const { data, error } = await supabase
          .from('repair_recommendations')
          .insert([{ inspection_id: inspectionId, ...repairData }])
          .select()
          .single()

        if (error) throw error
        setRepairs([...repairs, data])
      }

      setDialogOpen(false)
    } catch (error) {
      console.error('Błąd przy zapisywaniu zalecenia naprawy:', error)
    }
  }

  const handleDeleteRepair = async (id: string) => {
    try {
      const supabase = createBrowserClient(
        'https://lhxhsprqoecepojrxepf.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
      )

      const { error } = await supabase
        .from('repair_recommendations')
        .delete()
        .eq('id', id)

      if (error) throw error
      setRepairs(repairs.filter((r) => r.id !== id))
    } catch (error) {
      console.error('Błąd przy usuwaniu zalecenia naprawy:', error)
    }
  }

  const handleCompletionToggle = async (
    id: string,
    isCompleted: boolean
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createBrowserClient(
          'https://lhxhsprqoecepojrxepf.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
        )

        const { error } = await supabase
          .from('repair_recommendations')
          .update({
            is_completed: isCompleted,
            completion_date: isCompleted ? new Date().toISOString().split('T')[0] : null,
          })
          .eq('id', id)

        if (error) throw error

        setRepairs(
          repairs.map((r) =>
            r.id === id
              ? {
                  ...r,
                  is_completed: isCompleted,
                  completion_date: isCompleted
                    ? new Date().toISOString().split('T')[0]
                    : null,
                }
              : r
          )
        )
      } catch (error) {
        console.error('Błąd przy aktualizacji statusu zalecenia:', error)
      }
    }, 500)
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Ładowanie zaleceń napraw...
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Zalecenia napraw</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => handleOpenDialog()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus size={18} className="mr-2" />
            Dodaj zalecenie
          </Button>

          {repairs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Brak zaleceń napraw. Kliknij przycisk powyżej, aby dodać nowe.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="w-12">Lp.</TableHead>
                    <TableHead>Element</TableHead>
                    <TableHead>Zakres robót</TableHead>
                    <TableHead className="w-24">Rodzaj</TableHead>
                    <TableHead className="w-20">Pilność</TableHead>
                    <TableHead className="w-32">Termin</TableHead>
                    <TableHead className="w-32">Koszt szacunkowy</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repairs.map((repair, index) => (
                    <TableRow
                      key={repair.id}
                      className={urgencyColors[repair.urgency_level].bg}
                    >
                      <TableCell className="font-medium text-sm">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-sm">
                        {repair.element_name || '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">
                        <div className="truncate" title={repair.scope_description}>
                          {repair.scope_description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeColors[repair.repair_type]}>
                          {repair.repair_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={urgencyColors[repair.urgency_level].badge}
                        >
                          {repair.urgency_level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {repair.deadline_date || '—'}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {repair.estimated_cost
                          ? `${repair.estimated_cost.toFixed(2)} zł`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={repair.is_completed}
                            onCheckedChange={(checked) =>
                              handleCompletionToggle(repair.id, checked as boolean)
                            }
                          />
                          <span className="text-xs text-gray-600">
                            {repair.is_completed ? 'Zrobione' : 'Oczekuje'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(repair)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRepair(repair.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edytuj zalecenie' : 'Dodaj nowe zalecenie naprawy'}
            </DialogTitle>
            <DialogDescription>
              Uzupełnij szczegóły zalecenia naprawy dla inspeksji.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="element-select" className="font-medium">
                  Element
                </Label>
                <Select
                  value={formData.element_id}
                  onValueChange={handleElementChange}
                >
                  <SelectTrigger id="element-select">
                    <SelectValue placeholder="Wybierz element (opcjonalnie)" />
                  </SelectTrigger>
                  <SelectContent>
                    {elements.map((el) => (
                      <SelectItem key={el.id} value={el.id}>
                        {el.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repair-type" className="font-medium">
                  Rodzaj naprawy
                </Label>
                <Select
                  value={formData.repair_type}
                  onValueChange={(val) =>
                    setFormData({ ...formData, repair_type: val as 'NG' | 'NB' | 'K' })
                  }
                >
                  <SelectTrigger id="repair-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency" className="font-medium">
                  Pilność
                </Label>
                <Select
                  value={formData.urgency_level}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      urgency_level: val as 'I' | 'II' | 'III' | 'IV',
                    })
                  }
                >
                  <SelectTrigger id="urgency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">I - Pilna</SelectItem>
                    <SelectItem value="II">II - Ważna</SelectItem>
                    <SelectItem value="III">III - Normalna</SelectItem>
                    <SelectItem value="IV">IV - Nieznaczna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline" className="font-medium">
                  Termin wykonania
                </Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline_date}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost" className="font-medium">
                  Koszt szacunkowy (zł)
                </Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.estimated_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, estimated_cost: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope" className="font-medium">
                Zakres robót (wymagane)
              </Label>
              <Textarea
                id="scope"
                placeholder="Szczegółowy opis zakresu naprawy..."
                value={formData.scope_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    scope_description: e.target.value,
                  })
                }
                rows={4}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Anuluj
              </Button>
              <Button
                onClick={handleSaveRepair}
                disabled={!formData.scope_description.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {editingId ? 'Zaktualizuj' : 'Dodaj'} zalecenie
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
