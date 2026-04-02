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
  draft: 'bg-gray-200',
  in_progress: 'bg-blue-200',
  review: 'bg-yellow-200',
  completed: 'bg-green-200',
  signed: 'bg-emerald-200',
}

const statusTextColors: Record<string, string> = {
  draft: 'text-gray-800',
  in_progress: 'text-blue-800',
  review: 'text-yellow-800',
  completed: 'text-green-800',
  signed: 'text-emerald-800',
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
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
            const label = INSPECTION_STATUSES[s as keyof typeof INSPECTION_STATUSES] || s

            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? `${statusColors[s]} ${statusTextColors[s]}`
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isCompleted ? <Check size={20} /> : index + 1}
                </div>
                <div className="text-sm font-medium">{label}</div>
                {index < statusOrder.length - 1 && <ChevronRight size={16} className="text-gray-400" />}
              </div>
            )
          })}
        </div>

        {currentIndex < statusOrder.length - 1 && (
          <div className="mt-4">
            <Button
              onClick={() => handleStatusAdvance(statusOrder[currentIndex + 1])}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Przejdź do: {INSPECTION_STATUSES[statusOrder[currentIndex + 1] as keyof typeof INSPECTION_STATUSES]}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potwierdzenie zmiany statusu</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz zmienić status inspeksji na "{INSPECTION_STATUSES[nextStatus as keyof typeof INSPECTION_STATUSES]}"?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={confirmStatusChange} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? 'Aktualizowanie...' : 'Potwierdź'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
