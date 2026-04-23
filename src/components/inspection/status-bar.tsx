'use client'

import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { INSPECTION_STATUSES } from '@/lib/constants'
import { createBrowserClient } from '@supabase/ssr'

interface StatusBarProps {
  status: 'draft' | 'in_progress' | 'review' | 'completed' | 'signed'
  onStatusChange: (status: string) => void
  inspectionId: string
}

const statusOrder: ('draft' | 'in_progress' | 'review' | 'completed' | 'signed')[] = [
  'draft',
  'in_progress',
  'review',
  'completed',
  'signed',
]

const statusColors: Record<string, string> = {
  draft: 'bg-graphite-100',
  in_progress: 'bg-info-100',
  review: 'bg-warning-100',
  completed: 'bg-success-100',
  signed: 'bg-success-100',
}

const statusTextColors: Record<string, string> = {
  draft: 'text-graphite-800',
  in_progress: 'text-info-800',
  review: 'text-warning-800',
  completed: 'text-success-800',
  signed: 'text-success-800',
}

export function StatusBar({ status, onStatusChange, inspectionId }: StatusBarProps) {
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [nextStatus, setNextStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const currentIndex = statusOrder.indexOf(status)

  const handleStatusAdvance = (newStatus: string) => {
    setNextStatus(newStatus)
    setConfirmDialog(true)
  }

  const confirmStatusChange = async () => {
    if (!nextStatus) return

    setIsLoading(true)
    try {
      const supabase = createBrowserClient(
        'https://lhxhsprqoecepojrxepf.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
      )

      const { error } = await supabase
        .from('inspections')
        .update({ status: nextStatus })
        .eq('id', inspectionId)

      if (error) throw error

      onStatusChange(nextStatus)
      setConfirmDialog(false)
      setNextStatus(null)
    } catch (error) {
      console.error('Błąd podczas aktualizacji statusu:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="w-full">
        <div className="flex items-center gap-2">
          {statusOrder.map((s, index) => {
            const isCompleted = index < currentIndex
            const isCurrent = s === status
            const label = INSPECTION_STATUSES.find((item) => item.value === s)?.label || s

            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    isCompleted
                      ? 'bg-success text-white'
                      : isCurrent
                        ? `${statusColors[s]} ${statusTextColors[s]}`
                        : 'bg-graphite-100 text-graphite-500'
                  }`}
                >
                  {isCompleted ? <Check size={20} /> : index + 1}
                </div>
                <div className="text-sm font-medium">{label}</div>
                {index < statusOrder.length - 1 && <ChevronRight size={16} className="text-graphite-400" />}
              </div>
            )
          })}
        </div>

        {currentIndex < statusOrder.length - 1 && (
          <div className="mt-4">
            <Button
              onClick={() => handleStatusAdvance(statusOrder[currentIndex + 1])}
              disabled={isLoading}
              className=""
            >
              Przejdź do: {INSPECTION_STATUSES.find((item) => item.value === statusOrder[currentIndex + 1])?.label}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potwierdzenie zmiany statusu</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz zmienić status inspeksji na "{INSPECTION_STATUSES.find((item) => item.value === nextStatus)?.label}"?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={confirmStatusChange} disabled={isLoading}>
              {isLoading ? 'Aktualizowanie...' : 'Potwierdź'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
