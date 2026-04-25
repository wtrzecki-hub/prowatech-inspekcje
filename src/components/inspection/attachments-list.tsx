'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * PIIB sekcja VII (roczny) / VIII (5-letni): Załączniki do protokołu.
 *
 * CRUD na tabeli `inspection_attachments`. Każdy wiersz to jeden załącznik:
 * - opis (np. "Protokół pomiarów rezystancji uziemienia z dnia 12.04.2026")
 * - opcjonalny URL pliku (PDF / skan)
 *
 * Auto-save 800ms na blur — spójne z resztą komponentów inspekcji.
 */

interface Attachment {
  id: string
  inspection_id: string
  item_number: number
  description: string
  file_url: string | null
  google_drive_file_id: string | null
}

interface AttachmentsListProps {
  inspectionId: string
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

export function AttachmentsList({ inspectionId }: AttachmentsListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    void loadAttachments()
    return () => {
      Object.values(debounceTimers.current).forEach((t) => clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const loadAttachments = async () => {
    try {
      const { data, error } = await supabase()
        .from('inspection_attachments')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('item_number', { ascending: true })

      if (error) throw error
      setAttachments(data || [])
    } catch (err) {
      console.error('Błąd ładowania załączników:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    const description = newDescription.trim()
    if (!description) return

    setIsSaving(true)
    try {
      const nextNumber =
        attachments.length > 0
          ? Math.max(...attachments.map((a) => a.item_number)) + 1
          : 1

      const { data, error } = await supabase()
        .from('inspection_attachments')
        .insert({
          inspection_id: inspectionId,
          item_number: nextNumber,
          description,
          file_url: newUrl.trim() || null,
        })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setAttachments((prev) => [...prev, data as Attachment])
        setNewDescription('')
        setNewUrl('')
      }
    } catch (err) {
      console.error('Błąd dodawania załącznika:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = (id: string, field: 'description' | 'file_url', value: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value || null } : a))
    )

    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id])
    }

    debounceTimers.current[id] = setTimeout(async () => {
      setIsSaving(true)
      try {
        const updateValue = field === 'file_url' ? value.trim() || null : value
        const { error } = await supabase()
          .from('inspection_attachments')
          .update({ [field]: updateValue })
          .eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zapisu załącznika:', err)
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  const handleDelete = async (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    try {
      const { error } = await supabase()
        .from('inspection_attachments')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('Błąd usuwania załącznika:', err)
      void loadAttachments() // przywróć stan jeśli delete się nie udał
    }
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl border-graphite-200">
        <CardContent className="py-8 text-center text-graphite-500">
          Ładowanie załączników…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border-graphite-200">
      <CardHeader>
        <CardTitle className="text-lg">Załączniki do protokołu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-graphite-500">
            Brak załączników. Dodaj pierwszy poniżej (np. protokoły pomiarowe,
            zdjęcia, dokumentację techniczną).
          </p>
        ) : (
          <ul className="space-y-3">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="grid grid-cols-12 gap-3 items-start rounded-xl border border-graphite-200 p-3 shadow-xs hover:bg-graphite-50"
              >
                <div className="col-span-1 flex items-center justify-center pt-2 font-mono text-sm font-semibold text-graphite-500">
                  {a.item_number}.
                </div>
                <div className="col-span-7 space-y-1">
                  <Label
                    htmlFor={`desc-${a.id}`}
                    className="text-xs text-graphite-500"
                  >
                    Opis załącznika
                  </Label>
                  <Input
                    id={`desc-${a.id}`}
                    value={a.description}
                    onChange={(e) =>
                      handleUpdate(a.id, 'description', e.target.value)
                    }
                    placeholder="np. Protokół pomiarów rezystancji uziemienia z 12.04.2026"
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label
                    htmlFor={`url-${a.id}`}
                    className="text-xs text-graphite-500"
                  >
                    URL pliku (opcjonalnie)
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      id={`url-${a.id}`}
                      value={a.file_url || ''}
                      onChange={(e) =>
                        handleUpdate(a.id, 'file_url', e.target.value)
                      }
                      placeholder="https://..."
                    />
                    {a.file_url && (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-graphite-500 hover:bg-graphite-100 hover:text-graphite-800"
                        title="Otwórz plik"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="col-span-1 flex items-center justify-center pt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(a.id)}
                    className="text-danger hover:bg-danger-50 hover:text-danger-800"
                    title="Usuń załącznik"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Add new attachment */}
        <div className="rounded-xl border border-dashed border-graphite-300 p-3 space-y-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-8 space-y-1">
              <Label
                htmlFor="new-attachment-desc"
                className="text-xs text-graphite-500"
              >
                Nowy załącznik — opis
              </Label>
              <Input
                id="new-attachment-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Opis nowego załącznika"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newDescription.trim()) {
                    void handleAdd()
                  }
                }}
              />
            </div>
            <div className="col-span-3 space-y-1">
              <Label
                htmlFor="new-attachment-url"
                className="text-xs text-graphite-500"
              >
                URL (opcjonalnie)
              </Label>
              <Input
                id="new-attachment-url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="col-span-1 flex items-end">
              <Button
                onClick={handleAdd}
                disabled={!newDescription.trim() || isSaving}
                size="sm"
                className="w-full"
                title="Dodaj załącznik"
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>
        </div>

        {isSaving && (
          <p className="text-xs text-graphite-400 text-right">Zapisywanie…</p>
        )}
      </CardContent>
    </Card>
  )
}
