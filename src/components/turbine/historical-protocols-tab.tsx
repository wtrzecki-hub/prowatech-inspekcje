'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  parseHistoricalProtocolFilename,
  type ParsedHistoricalFilename,
} from '@/lib/storage/historical-protocol-filename'

/**
 * Zakładka "Archiwum" w widoku turbiny — lista historycznych protokołów PIIB
 * (skany PDF sprzed wdrożenia aplikacji) + upload nowych.
 *
 * Workflow uploadu (Faza 15.B/15.F):
 *   1. Admin wybiera plik → parser nazw auto-wypełnia rok/typ/numer/datę/uwagi
 *   2. Admin sprawdza, ewentualnie edytuje, klika Zapisz
 *   3. POST /api/storage/presigned (context=historical-protocol)
 *      → zwraca { uploadUrl, publicUrl, key }
 *   4. PUT plik bezpośrednio do R2 przez uploadUrl (5 min TTL)
 *   5. INSERT do public.historical_protocols z meta + key + URL
 *   6. Refresh listy
 *
 * Kasowanie kasuje rekord DB (RLS pozwala admin/inspector). Plik na R2
 * pozostaje jako "sirota" — pełne usunięcie wymaga osobnego API endpointu
 * (TODO Faza 15.F.2 — `/api/storage/delete`).
 */

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

const MAX_FILE_SIZE_MB = 40
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

type InspectionType = 'annual' | 'five_year'

interface HistoricalProtocol {
  id: string
  turbine_id: string
  year: number
  inspection_type: InspectionType
  protocol_pdf_r2_key: string
  protocol_pdf_url: string
  file_size_bytes: number | null
  source_filename: string | null
  protocol_number: string | null
  inspection_date: string | null
  notes: string | null
  uploaded_at: string
  updated_at: string
}

interface HistoricalProtocolsTabProps {
  turbineId: string
  /** Czy bieżący user może uploadować/edytować (admin/inspector) */
  canEdit: boolean
}

interface UploadFormState {
  file: File | null
  year: string
  inspectionType: InspectionType
  protocolNumber: string
  inspectionDate: string
  notes: string
  parsed: ParsedHistoricalFilename | null
}

const EMPTY_UPLOAD_FORM: UploadFormState = {
  file: null,
  year: '',
  inspectionType: 'annual',
  protocolNumber: '',
  inspectionDate: '',
  notes: '',
  parsed: null,
}

export default function HistoricalProtocolsTab({
  turbineId,
  canEdit,
}: HistoricalProtocolsTabProps) {
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const [protocols, setProtocols] = useState<HistoricalProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HistoricalProtocol | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<HistoricalProtocol | null>(
    null
  )

  // Upload form
  const [form, setForm] = useState<UploadFormState>(EMPTY_UPLOAD_FORM)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  // ───────── Fetch ─────────────────────────────────────────────────────
  const refresh = async () => {
    setLoading(true)
    const { data, error: fetchErr } = await supabase
      .from('historical_protocols')
      .select('*')
      .eq('turbine_id', turbineId)
      .order('year', { ascending: false })
      .order('inspection_type', { ascending: true })

    if (fetchErr) {
      setError(fetchErr.message)
      setLoading(false)
      return
    }
    setProtocols((data ?? []) as HistoricalProtocol[])
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turbineId])

  // ───────── Upload form handlers ──────────────────────────────────────
  const handleFileSelected = (file: File | null) => {
    if (!file) return

    // Walidacja
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Tylko pliki PDF są akceptowane.')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      setUploadError(`Plik za duży (${mb} MB). Maksymalny rozmiar: ${MAX_FILE_SIZE_MB} MB.`)
      return
    }

    const parsed = parseHistoricalProtocolFilename(file.name)

    setForm({
      file,
      year: parsed.year ? String(parsed.year) : '',
      inspectionType: parsed.inspectionType ?? 'annual',
      protocolNumber: parsed.protocolNumber ?? '',
      inspectionDate: parsed.inspectionDate ?? '',
      notes: parsed.location ? `Z nazwy: ${parsed.location}` : '',
      parsed,
    })
    setUploadError(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0] ?? null
    handleFileSelected(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const resetUploadForm = () => {
    setForm(EMPTY_UPLOAD_FORM)
    setUploadError(null)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const closeUploadDialog = () => {
    if (uploading) return // nie zamykaj w trakcie uploadu
    setUploadDialogOpen(false)
    resetUploadForm()
  }

  const submitUpload = async () => {
    if (!form.file) {
      setUploadError('Wybierz plik PDF.')
      return
    }
    const yearNum = parseInt(form.year, 10)
    if (!Number.isInteger(yearNum) || yearNum < 2010 || yearNum > 2050) {
      setUploadError('Rok musi być liczbą między 2010 a 2050.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // Krok 1: pre-signed URL
      const presignedRes = await fetch('/api/storage/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: form.file.name,
          contentType: 'application/pdf',
          context: 'historical-protocol',
          turbineId,
          year: yearNum,
          inspectionType: form.inspectionType,
        }),
      })
      if (!presignedRes.ok) {
        const errBody = await presignedRes.json().catch(() => ({}))
        throw new Error(
          `Pre-signed URL: ${presignedRes.status} ${errBody.error ?? presignedRes.statusText}`
        )
      }
      const { uploadUrl, publicUrl, key } = (await presignedRes.json()) as {
        uploadUrl: string
        publicUrl: string
        key: string
      }

      // Krok 2: PUT plik do R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: form.file,
        headers: { 'Content-Type': 'application/pdf' },
      })
      if (!putRes.ok) {
        throw new Error(`Upload R2: ${putRes.status} ${putRes.statusText}`)
      }

      // Krok 3: INSERT do DB
      const { data: { user } } = await supabase.auth.getUser()
      const insertPayload = {
        turbine_id: turbineId,
        year: yearNum,
        inspection_type: form.inspectionType,
        protocol_pdf_r2_key: key,
        protocol_pdf_url: publicUrl,
        file_size_bytes: form.file.size,
        source_filename: form.file.name,
        protocol_number: form.protocolNumber.trim() || null,
        inspection_date: form.inspectionDate || null,
        notes: form.notes.trim() || null,
        uploaded_by: user?.id ?? null,
      }
      const { error: insertErr } = await supabase
        .from('historical_protocols')
        .insert(insertPayload)

      if (insertErr) {
        // Plik został wgrany na R2, ale INSERT się walnął — sirota
        // (np. duplicate UNIQUE(turbine_id, year, inspection_type))
        // TODO: cleanup R2 key — na razie informujemy admina
        if (insertErr.code === '23505') {
          throw new Error(
            `Protokół dla roku ${yearNum} (${
              form.inspectionType === 'annual' ? 'roczna' : '5-letnia'
            }) już istnieje dla tej turbiny. Edytuj istniejący wpis lub usuń go najpierw.`
          )
        }
        throw new Error(`Zapis do bazy: ${insertErr.message}`)
      }

      // Sukces
      await refresh()
      setUploadDialogOpen(false)
      resetUploadForm()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Nieznany błąd')
    } finally {
      setUploading(false)
    }
  }

  // ───────── Edit / Delete ─────────────────────────────────────────────
  const submitEdit = async () => {
    if (!editing) return
    const yearNum = parseInt(String(editing.year), 10)
    if (!Number.isInteger(yearNum) || yearNum < 2010 || yearNum > 2050) {
      alert('Rok musi być liczbą między 2010 a 2050.')
      return
    }
    const { error: updErr } = await supabase
      .from('historical_protocols')
      .update({
        year: yearNum,
        inspection_type: editing.inspection_type,
        protocol_number: editing.protocol_number?.trim() || null,
        inspection_date: editing.inspection_date || null,
        notes: editing.notes?.trim() || null,
      })
      .eq('id', editing.id)

    if (updErr) {
      alert(`Błąd zapisu: ${updErr.message}`)
      return
    }
    await refresh()
    setEditing(null)
  }

  const submitDelete = async () => {
    if (!deleteConfirm) return
    const { error: delErr } = await supabase
      .from('historical_protocols')
      .delete()
      .eq('id', deleteConfirm.id)

    if (delErr) {
      alert(`Błąd usunięcia: ${delErr.message}`)
      return
    }
    await refresh()
    setDeleteConfirm(null)
  }

  // ───────── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-graphite-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-graphite-100">
          <div>
            <CardTitle className="text-base font-semibold text-graphite-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-graphite-500" />
              Archiwum protokołów
            </CardTitle>
            <p className="text-xs text-graphite-500 mt-1">
              Skany protokołów kontroli sprzed wdrożenia aplikacji.
              {protocols.length > 0 && (
                <>
                  {' '}
                  <span className="font-mono">{protocols.length}</span>{' '}
                  {protocols.length === 1
                    ? 'pozycja'
                    : protocols.length < 5
                    ? 'pozycje'
                    : 'pozycji'}
                  .
                </>
              )}
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => setUploadDialogOpen(true)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Dodaj protokół
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-danger-800 bg-danger-50">
              Błąd ładowania: {error}
            </div>
          ) : protocols.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-graphite-50 rounded-2xl mb-4">
                <FileText className="h-10 w-10 text-graphite-200" />
              </div>
              <p className="text-sm font-semibold text-graphite-800">
                Brak archiwalnych protokołów
              </p>
              <p className="text-xs text-graphite-500 mt-1">
                {canEdit
                  ? 'Kliknij "Dodaj protokół" żeby wgrać skan PDF z folderu archiwum.'
                  : 'Archiwalne protokoły pojawią się tu po wgraniu przez administratora.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-graphite-100">
              {/* Header tabeli */}
              <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-graphite-50 text-[11px] uppercase tracking-wider text-graphite-500 font-semibold">
                <div className="col-span-1">Rok</div>
                <div className="col-span-2">Typ</div>
                <div className="col-span-3">Nr protokołu</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-2">Plik</div>
                <div className="col-span-2 text-right">Akcje</div>
              </div>
              {protocols.map((p) => (
                <ProtocolRow
                  key={p.id}
                  protocol={p}
                  canEdit={canEdit}
                  onEdit={() => setEditing({ ...p })}
                  onDelete={() => setDeleteConfirm(p)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ──────── DIALOG: Upload ──────── */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => !open && closeUploadDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dodaj historyczny protokół</DialogTitle>
            <DialogDescription>
              Wgraj skan PDF protokołu kontroli z archiwum. Pola poniżej zostaną
              auto-uzupełnione z nazwy pliku jeśli pasuje do wzorca ProWaTech
              (<span className="font-mono text-[11px]">NN_T_RRRR Protokol_kontroli_typ ...</span>).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag-drop area */}
            {!form.file ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-primary bg-primary-50'
                    : 'border-graphite-200 hover:border-graphite-400 bg-graphite-50'
                }`}
              >
                <Upload className="h-8 w-8 mx-auto text-graphite-400 mb-2" />
                <p className="text-sm font-medium text-graphite-800">
                  Upuść plik PDF lub kliknij, aby wybrać
                </p>
                <p className="text-xs text-graphite-500 mt-1">
                  Maksymalny rozmiar: {MAX_FILE_SIZE_MB} MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 border border-graphite-200 rounded-xl p-3 bg-graphite-50">
                <FileText className="h-8 w-8 text-graphite-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-graphite-900 truncate">
                    {form.file.name}
                  </p>
                  <p className="text-xs text-graphite-500 font-mono">
                    {(form.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = ''
                    setForm({ ...EMPTY_UPLOAD_FORM })
                  }}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {form.file && (
              <>
                {/* Auto-fill banner */}
                {form.parsed && form.parsed.protocolNumber && (
                  <div className="text-xs text-success-800 bg-success-50 border border-success-100 rounded-lg px-3 py-2">
                    Auto-uzupełniono z nazwy pliku: numer{' '}
                    <span className="font-mono">{form.parsed.protocolNumber}</span>, rok{' '}
                    <span className="font-mono">{form.parsed.year}</span>, typ{' '}
                    <span className="font-mono">
                      {form.parsed.inspectionType === 'annual' ? 'roczna' : '5-letnia'}
                    </span>
                    .
                  </div>
                )}

                {/* Year + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="year" className="text-xs">
                      Rok kontroli *
                    </Label>
                    <Input
                      id="year"
                      type="number"
                      min={2010}
                      max={2050}
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: e.target.value })}
                      className="font-mono"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Typ kontroli *</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Button
                        type="button"
                        variant={form.inspectionType === 'annual' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setForm({ ...form, inspectionType: 'annual' })}
                        disabled={uploading}
                        className="flex-1"
                      >
                        Roczna
                      </Button>
                      <Button
                        type="button"
                        variant={form.inspectionType === 'five_year' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setForm({ ...form, inspectionType: 'five_year' })}
                        disabled={uploading}
                        className="flex-1"
                      >
                        5-letnia
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Numer + Data */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="number" className="text-xs">
                      Nr protokołu (opcjonalnie)
                    </Label>
                    <Input
                      id="number"
                      value={form.protocolNumber}
                      onChange={(e) => setForm({ ...form, protocolNumber: e.target.value })}
                      placeholder="np. 92/T/2025"
                      className="font-mono"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date" className="text-xs">
                      Data kontroli (opcjonalnie)
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={form.inspectionDate}
                      onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
                      className="font-mono"
                      disabled={uploading}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes" className="text-xs">
                    Uwagi (opcjonalnie)
                  </Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="np. fragment z nazwy, źródło, jakość skanu"
                    rows={2}
                    disabled={uploading}
                  />
                </div>
              </>
            )}

            {uploadError && (
              <div className="text-xs text-danger-800 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
                {uploadError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeUploadDialog} disabled={uploading}>
              Anuluj
            </Button>
            <Button onClick={submitUpload} disabled={uploading || !form.file}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wgrywanie...
                </>
              ) : (
                'Zapisz'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────── DIALOG: Edit meta ──────── */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edytuj metadane protokołu</DialogTitle>
            <DialogDescription>
              Plik PDF pozostaje bez zmian — edytujesz tylko opis.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Rok kontroli *</Label>
                  <Input
                    type="number"
                    min={2010}
                    max={2050}
                    value={editing.year}
                    onChange={(e) =>
                      setEditing({ ...editing, year: parseInt(e.target.value, 10) || 0 })
                    }
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Typ *</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Button
                      type="button"
                      variant={editing.inspection_type === 'annual' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditing({ ...editing, inspection_type: 'annual' })}
                      className="flex-1"
                    >
                      Roczna
                    </Button>
                    <Button
                      type="button"
                      variant={editing.inspection_type === 'five_year' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditing({ ...editing, inspection_type: 'five_year' })}
                      className="flex-1"
                    >
                      5-letnia
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nr protokołu</Label>
                  <Input
                    value={editing.protocol_number ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, protocol_number: e.target.value })
                    }
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Data kontroli</Label>
                  <Input
                    type="date"
                    value={editing.inspection_date ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, inspection_date: e.target.value })
                    }
                    className="font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Uwagi</Label>
                <Textarea
                  value={editing.notes ?? ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Anuluj
            </Button>
            <Button onClick={submitEdit}>Zapisz zmiany</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────── DIALOG: Delete confirm ──────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Usunąć protokół?</DialogTitle>
            <DialogDescription>
              {deleteConfirm && (
                <>
                  Wpis zostanie usunięty z bazy. Sam plik PDF pozostanie na R2 jako sierota
                  (do uprzątnięcia osobnym narzędziem). Operacja jest nieodwracalna.
                  <div className="mt-3 p-3 bg-graphite-50 rounded-lg text-graphite-800 text-xs space-y-1">
                    <div>
                      <strong>Rok:</strong>{' '}
                      <span className="font-mono">{deleteConfirm.year}</span>
                    </div>
                    <div>
                      <strong>Typ:</strong>{' '}
                      {deleteConfirm.inspection_type === 'annual' ? 'Roczna' : '5-letnia'}
                    </div>
                    {deleteConfirm.protocol_number && (
                      <div>
                        <strong>Nr:</strong>{' '}
                        <span className="font-mono">{deleteConfirm.protocol_number}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Anuluj
            </Button>
            <Button variant="danger" onClick={submitDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─────────────── Sub-components ──────────────────────────────────────────

interface ProtocolRowProps {
  protocol: HistoricalProtocol
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}

function ProtocolRow({ protocol, canEdit, onEdit, onDelete }: ProtocolRowProps) {
  return (
    <div className="grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-graphite-50/50 transition-colors text-sm">
      <div className="col-span-1 font-mono font-semibold text-graphite-900">
        {protocol.year}
      </div>
      <div className="col-span-2">
        <Badge
          className={
            protocol.inspection_type === 'five_year'
              ? 'bg-info-100 text-info-800 hover:bg-info-100'
              : 'bg-graphite-100 text-graphite-800 hover:bg-graphite-100'
          }
        >
          {protocol.inspection_type === 'annual' ? 'Roczna' : '5-letnia'}
        </Badge>
      </div>
      <div className="col-span-3 font-mono text-xs text-graphite-700">
        {protocol.protocol_number ?? <span className="text-graphite-400">—</span>}
      </div>
      <div className="col-span-2 font-mono text-xs text-graphite-700">
        {protocol.inspection_date ? (
          new Date(protocol.inspection_date).toLocaleDateString('pl-PL')
        ) : (
          <span className="text-graphite-400">—</span>
        )}
      </div>
      <div className="col-span-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1 border-graphite-200"
          onClick={() => window.open(protocol.protocol_pdf_url, '_blank')}
        >
          <Download className="h-3 w-3" />
          PDF
          {protocol.file_size_bytes && (
            <span className="text-graphite-400 font-mono text-[10px] ml-1">
              {(protocol.file_size_bytes / 1024 / 1024).toFixed(1)} MB
            </span>
          )}
        </Button>
      </div>
      <div className="col-span-2 flex justify-end gap-1">
        {canEdit && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-graphite-500 hover:text-graphite-800"
              onClick={onEdit}
              title="Edytuj"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-danger hover:text-danger-800 hover:bg-danger-50"
              onClick={onDelete}
              title="Usuń"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
