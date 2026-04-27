'use client'

/**
 * Galeria zdjęć dla inspekcji.
 *
 * Krok 2 (2026-04-27): refactor URL-input → file upload + camera + drag-drop.
 *  - Tablet/mobile: przycisk "Zrób zdjęcie" otwiera natywną kamerę przez
 *    <input capture="environment">.
 *  - Desktop: drag-drop area + multi-select file picker.
 *  - Kompresja JPEG przed uploadem przez `image-compress.ts` (typowy 5 MB → ~500 KB).
 *  - Upload bezpośredni do R2 przez pre-signed PUT (omija Vercel 4.5 MB limit).
 *  - Auto-numerowanie (max+1, max+2, ...) per inspekcja.
 *  - Auto-link do elementu jeśli filtr po elemencie aktywny w czasie dodawania.
 *
 * UWAGA: poprzednia wersja używała kolumn `photo_url` i `element_name` które
 * NIE istnieją w schemacie `inspection_photos` (są tylko `file_url` i `element_id`).
 * Dlatego w prod było tylko 1 zdjęcie w 23 inspekcjach — feature był silently
 * broken. Tutaj naprawione: SELECT używa `file_url`, nazwę elementu derive'ujemy
 * z propa `elements` przez `element_id`.
 *
 * URL-input zachowany jako fallback w sekcji "Zaawansowane" — dla migracji
 * starych danych (Google Drive linki itp.).
 */

import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  Edit2,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/storage/image-compress'

interface Photo {
  id: string
  inspection_id: string
  photo_number: number | null
  file_url: string | null
  description: string | null
  element_id: string | null
}

interface Element {
  id: string
  name: string
}

interface PhotoGalleryProps {
  inspectionId: string
  elements?: Element[]
}

type UploadStatus =
  | 'queued'
  | 'compressing'
  | 'uploading'
  | 'saving'
  | 'done'
  | 'error'

interface PendingUpload {
  /** Lokalne UUID dla key w liście React. */
  uid: string
  file: File
  previewUrl: string
  photoNumber: number
  elementId: string
  description: string
  status: UploadStatus
  error?: string
  originalSize: number
  compressedSize?: number
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB raw — po kompresji idzie ≤ ~2 MB
const MAX_BATCH = 20 // 20 zdjęć naraz wystarczy z głową

export function PhotoGallery({
  inspectionId,
  elements = [],
}: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterElement, setFilterElement] = useState<string>('all')

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [isBatchUploading, setIsBatchUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedUrl, setAdvancedUrl] = useState('')

  // Edit dialog state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    photo_number: '',
    description: '',
    element_id: '',
  })

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxPhotoNumber = photos.reduce(
    (max, p) => Math.max(max, p.photo_number ?? 0),
    0,
  )

  useEffect(() => {
    void loadPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  // Cleanup ObjectURLs przy unmount / zamknięciu dialogu
  useEffect(() => {
    return () => {
      pendingUploads.forEach((u) => URL.revokeObjectURL(u.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadPhotos = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('inspection_photos')
        .select('id, inspection_id, photo_number, file_url, description, element_id')
        .eq('inspection_id', inspectionId)
        .order('photo_number', { ascending: true, nullsFirst: false })

      if (error) throw error
      setPhotos((data || []) as Photo[])
    } catch (err) {
      console.error('[PhotoGallery] loadPhotos failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getElementName = (elementId: string | null): string | null => {
    if (!elementId) return null
    return elements.find((e) => e.id === elementId)?.name ?? null
  }

  // =========================================================================
  // ADD FLOW — file picker / camera / drag-drop
  // =========================================================================

  const openAddDialog = () => {
    setPendingUploads([])
    setShowAdvanced(false)
    setAdvancedUrl('')
    setAddDialogOpen(true)
  }

  const closeAddDialog = () => {
    if (isBatchUploading) return // nie zamykamy w trakcie uploadu
    pendingUploads.forEach((u) => URL.revokeObjectURL(u.previewUrl))
    setPendingUploads([])
    setAddDialogOpen(false)
  }

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArr = Array.from(files)
    const validFiles: File[] = []
    const errors: string[] = []

    for (const f of fileArr) {
      if (!f.type.startsWith('image/')) {
        errors.push(`${f.name}: nie jest obrazem (typ: ${f.type || 'nieznany'})`)
        continue
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(
          `${f.name}: za duży (${(f.size / 1024 / 1024).toFixed(1)} MB, max 25 MB)`,
        )
        continue
      }
      validFiles.push(f)
    }

    if (errors.length > 0) {
      alert('Nie wszystkie pliki zostały dodane:\n\n' + errors.join('\n'))
    }

    if (validFiles.length === 0) return

    const remaining = MAX_BATCH - pendingUploads.length
    if (validFiles.length > remaining) {
      alert(
        `Można dodać max ${MAX_BATCH} zdjęć w jednej partii. Wybrane ${validFiles.length}, miejsce na ${remaining}.`,
      )
      validFiles.splice(remaining)
    }

    // Auto-link do elementu z aktywnego filtra
    const presetElementId =
      filterElement && filterElement !== 'all' ? filterElement : ''

    const startNumber = maxPhotoNumber + 1 + pendingUploads.length

    const newPending: PendingUpload[] = validFiles.map((file, i) => ({
      uid: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      photoNumber: startNumber + i,
      elementId: presetElementId,
      description: '',
      status: 'queued',
      originalSize: file.size,
    }))

    setPendingUploads((prev) => [...prev, ...newPending])
  }

  const removePending = (uid: string) => {
    setPendingUploads((prev) => {
      const item = prev.find((p) => p.uid === uid)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((p) => p.uid !== uid)
    })
  }

  const updatePending = (uid: string, patch: Partial<PendingUpload>) => {
    setPendingUploads((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, ...patch } : p)),
    )
  }

  const processOneUpload = async (item: PendingUpload): Promise<Photo | null> => {
    try {
      // 1. Kompresja
      updatePending(item.uid, { status: 'compressing' })
      const compressed = await compressImage(item.file, {
        maxDimension: 1920,
        quality: 0.85,
        outputType: 'image/jpeg',
      })

      // 2. Pre-signed PUT URL
      updatePending(item.uid, {
        status: 'uploading',
        compressedSize: compressed.file.size,
      })

      const presignedRes = await fetch('/api/storage/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: compressed.file.name,
          contentType: compressed.file.type,
          context: 'inspection-photo',
          inspectionId,
        }),
      })

      if (!presignedRes.ok) {
        const errText = await presignedRes.text().catch(() => 'unknown')
        throw new Error(`Pre-signed URL: ${presignedRes.status} ${errText}`)
      }

      const { uploadUrl, publicUrl } = (await presignedRes.json()) as {
        uploadUrl: string
        publicUrl: string
        key: string
      }

      // 3. PUT bezpośrednio do R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.file.type },
        body: compressed.file,
      })

      if (!putRes.ok) {
        throw new Error(`R2 PUT: ${putRes.status} ${putRes.statusText}`)
      }

      // 4. Wpis do DB
      updatePending(item.uid, { status: 'saving' })
      const supabase = createClient()
      const { data, error } = await supabase
        .from('inspection_photos')
        .insert({
          inspection_id: inspectionId,
          photo_number: item.photoNumber,
          file_url: publicUrl,
          description: item.description.trim() || null,
          element_id: item.elementId || null,
        })
        .select('id, inspection_id, photo_number, file_url, description, element_id')
        .single()

      if (error) throw error

      updatePending(item.uid, { status: 'done' })
      return data as Photo
    } catch (err) {
      console.error('[PhotoGallery] upload failed for', item.file.name, err)
      updatePending(item.uid, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Nieznany błąd',
      })
      return null
    }
  }

  const startBatchUpload = async () => {
    if (pendingUploads.length === 0) return
    setIsBatchUploading(true)

    const newPhotos: Photo[] = []
    // Sekwencyjnie — kompresja + upload zżerają CPU/sieć, równoległość zatka tablet
    for (const item of pendingUploads) {
      if (item.status === 'done') continue // skip retry of already done
      const result = await processOneUpload(item)
      if (result) newPhotos.push(result)
    }

    // Dodaj nowo wgrane do galerii
    if (newPhotos.length > 0) {
      setPhotos((prev) =>
        [...prev, ...newPhotos].sort(
          (a, b) => (a.photo_number ?? 0) - (b.photo_number ?? 0),
        ),
      )
    }

    setIsBatchUploading(false)

    // Jeśli wszystko się udało — zamknij dialog. W przeciwnym razie zostaw,
    // user widzi które poszły a które nie i może retryować.
    const allDone = pendingUploads.every(
      (u) => u.status === 'done' || newPhotos.some((p) => true), // simplified
    )
    const anyErrors = pendingUploads.some((u) => u.status === 'error')
    if (newPhotos.length === pendingUploads.length && !anyErrors) {
      pendingUploads.forEach((u) => URL.revokeObjectURL(u.previewUrl))
      setPendingUploads([])
      setAddDialogOpen(false)
    }
    void allDone // suppress unused
  }

  // Drag-drop (desktop)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    handleFilesSelected(e.dataTransfer.files)
  }

  // URL fallback (Zaawansowane)
  const handleAdvancedUrlAdd = async () => {
    const url = advancedUrl.trim()
    if (!url) return
    try {
      const supabase = createClient()
      const presetElementId =
        filterElement && filterElement !== 'all' ? filterElement : null
      const { data, error } = await supabase
        .from('inspection_photos')
        .insert({
          inspection_id: inspectionId,
          photo_number: maxPhotoNumber + 1 + pendingUploads.length,
          file_url: url,
          description: null,
          element_id: presetElementId,
        })
        .select('id, inspection_id, photo_number, file_url, description, element_id')
        .single()
      if (error) throw error
      setPhotos((prev) =>
        [...prev, data as Photo].sort(
          (a, b) => (a.photo_number ?? 0) - (b.photo_number ?? 0),
        ),
      )
      setAdvancedUrl('')
    } catch (err) {
      console.error('[PhotoGallery] URL fallback insert failed:', err)
      alert('Nie udało się dodać linku. Sprawdź format URL.')
    }
  }

  // =========================================================================
  // EDIT FLOW — metadata only, file is read-only (delete + re-upload to replace)
  // =========================================================================

  const openEditDialog = (photo: Photo) => {
    setEditingId(photo.id)
    setEditForm({
      photo_number: (photo.photo_number ?? '').toString(),
      description: photo.description ?? '',
      element_id: photo.element_id ?? '',
    })
  }

  const handleEditSave = async () => {
    if (!editingId) return
    try {
      const supabase = createClient()
      const patch = {
        photo_number: editForm.photo_number
          ? parseInt(editForm.photo_number, 10)
          : null,
        description: editForm.description.trim() || null,
        element_id: editForm.element_id || null,
      }
      const { error } = await supabase
        .from('inspection_photos')
        .update(patch)
        .eq('id', editingId)
      if (error) throw error
      setPhotos((prev) =>
        prev
          .map((p) => (p.id === editingId ? { ...p, ...patch } : p))
          .sort((a, b) => (a.photo_number ?? 0) - (b.photo_number ?? 0)),
      )
      setEditingId(null)
    } catch (err) {
      console.error('[PhotoGallery] edit save failed:', err)
      alert('Nie udało się zapisać zmian.')
    }
  }

  const handleDeletePhoto = async (id: string) => {
    if (!confirm('Usunąć to zdjęcie? Plik na R2 zostanie sierotą do późniejszego cleanupu.'))
      return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('inspection_photos')
        .delete()
        .eq('id', id)
      if (error) throw error
      setPhotos((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('[PhotoGallery] delete failed:', err)
      alert('Nie udało się usunąć zdjęcia.')
    }
  }

  const filteredPhotos =
    filterElement && filterElement !== 'all'
      ? photos.filter((p) => p.element_id === filterElement)
      : photos

  // =========================================================================
  // RENDER
  // =========================================================================

  if (isLoading) {
    return (
      <div className="text-center py-8 text-graphite-500">
        Ładowanie galerii zdjęć…
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Galeria zdjęć</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button onClick={openAddDialog}>
              <Plus size={18} className="mr-2" />
              Dodaj zdjęcia
            </Button>

            {elements.length > 0 && (
              <Select value={filterElement} onValueChange={setFilterElement}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filtruj po elemencie…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie elementy</SelectItem>
                  {elements.map((el) => (
                    <SelectItem key={el.id} value={el.id}>
                      {el.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {filteredPhotos.length === 0 ? (
            <div className="text-center py-12 text-graphite-500">
              <ImageIcon size={48} className="mx-auto mb-3 opacity-50" />
              <p>
                {filterElement && filterElement !== 'all'
                  ? 'Brak zdjęć dla wybranego elementu'
                  : 'Brak zdjęć. Kliknij „Dodaj zdjęcia”, aby wgrać nowe.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPhotos.map((photo) => {
                const elementName = getElementName(photo.element_id)
                return (
                  <div
                    key={photo.id}
                    className="border border-graphite-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition shadow-xs"
                  >
                    <div className="aspect-square bg-graphite-100 flex items-center justify-center overflow-hidden">
                      {photo.file_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.file_url}
                          alt={`Zdjęcie ${photo.photo_number ?? '?'}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon
                          size={48}
                          className="text-graphite-500 opacity-50"
                        />
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="font-semibold text-sm">
                        Zdjęcie nr {photo.photo_number ?? '—'}
                      </div>
                      {photo.description && (
                        <p className="text-xs text-graphite-800 line-clamp-2">
                          {photo.description}
                        </p>
                      )}
                      {elementName && (
                        <div className="text-xs bg-info-50 text-info-800 rounded px-2 py-1">
                          {elementName}
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(photo)}
                          className="flex-1 text-graphite-500 hover:text-graphite-900 hover:bg-graphite-50"
                        >
                          <Edit2 size={14} className="mr-1" />
                          Edytuj
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="flex-1 text-danger hover:text-danger-800 hover:bg-danger-50"
                        >
                          <Trash2 size={14} className="mr-1" />
                          Usuń
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* ADD DIALOG */}
      {/* ================================================================== */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeAddDialog()
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodaj zdjęcia</DialogTitle>
            <DialogDescription>
              Zrób zdjęcie tabletem albo wybierz pliki z dysku. Zdjęcia są
              kompresowane lokalnie do 1920 px JPEG przed uploadem.
            </DialogDescription>
          </DialogHeader>

          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files)
              if (cameraInputRef.current) cameraInputRef.current.value = ''
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />

          {/* Drag-drop area + buttons */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-graphite-300 bg-graphite-50'
            }`}
          >
            <Upload
              size={32}
              className="mx-auto mb-2 text-graphite-500"
            />
            <p className="text-sm text-graphite-700 mb-3">
              <span className="hidden md:inline">
                Przeciągnij zdjęcia tutaj, albo
              </span>
              <span className="md:hidden">Wybierz źródło</span>
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isBatchUploading}
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[52px]"
              >
                <Camera size={18} className="mr-2" />
                Zrób zdjęcie
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isBatchUploading}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[52px]"
              >
                <FolderOpen size={18} className="mr-2" />
                Wybierz pliki
              </Button>
            </div>
            {filterElement && filterElement !== 'all' && (
              <p className="text-xs text-info-700 mt-3">
                Nowe zdjęcia zostaną automatycznie przypisane do:{' '}
                <strong>{getElementName(filterElement)}</strong>
              </p>
            )}
          </div>

          {/* Pending uploads list */}
          {pendingUploads.length > 0 && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-graphite-900">
                  Do wgrania: {pendingUploads.length}
                </h4>
                <span className="text-xs text-graphite-500">
                  {pendingUploads.filter((u) => u.status === 'done').length} /{' '}
                  {pendingUploads.length} gotowe
                </span>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {pendingUploads.map((item) => (
                  <PendingItemRow
                    key={item.uid}
                    item={item}
                    elements={elements}
                    isBatchUploading={isBatchUploading}
                    onUpdate={(patch) => updatePending(item.uid, patch)}
                    onRemove={() => removePending(item.uid)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Advanced URL fallback */}
          <details
            className="mt-4 border-t border-graphite-200 pt-4"
            open={showAdvanced}
            onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm text-graphite-500 hover:text-graphite-700">
              Zaawansowane: dodaj przez URL (np. Google Drive link)
            </summary>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="https://example.com/photo.jpg"
                value={advancedUrl}
                onChange={(e) => setAdvancedUrl(e.target.value)}
                disabled={isBatchUploading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAdvancedUrlAdd}
                disabled={isBatchUploading || !advancedUrl.trim()}
              >
                Dodaj URL
              </Button>
            </div>
          </details>

          <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={closeAddDialog}
              disabled={isBatchUploading}
            >
              {pendingUploads.length === 0 ? 'Zamknij' : 'Anuluj'}
            </Button>
            {pendingUploads.length > 0 && (
              <Button onClick={startBatchUpload} disabled={isBatchUploading}>
                {isBatchUploading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Wgrywanie…
                  </>
                ) : (
                  <>Wgraj {pendingUploads.length} zdjęć</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* EDIT DIALOG */}
      {/* ================================================================== */}
      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj zdjęcie</DialogTitle>
            <DialogDescription>
              Aby zmienić plik, usuń zdjęcie i wgraj ponownie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-photo-number" className="font-medium">
                  Numer zdjęcia
                </Label>
                <Input
                  id="edit-photo-number"
                  type="number"
                  min="1"
                  value={editForm.photo_number}
                  onChange={(e) =>
                    setEditForm({ ...editForm, photo_number: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-photo-element" className="font-medium">
                  Przypisz do elementu
                </Label>
                <Select
                  value={editForm.element_id || 'none'}
                  onValueChange={(val) =>
                    setEditForm({
                      ...editForm,
                      element_id: val === 'none' ? '' : val,
                    })
                  }
                >
                  <SelectTrigger id="edit-photo-element">
                    <SelectValue placeholder="Wybierz (opcjonalnie)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— brak —</SelectItem>
                    {elements.map((el) => (
                      <SelectItem key={el.id} value={el.id}>
                        {el.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-photo-desc" className="font-medium">
                Opis
              </Label>
              <Textarea
                id="edit-photo-desc"
                rows={3}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Anuluj
            </Button>
            <Button onClick={handleEditSave}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ===========================================================================
// PendingItemRow — wiersz na liście zdjęć do wgrania
// ===========================================================================

interface PendingItemRowProps {
  item: PendingUpload
  elements: Element[]
  isBatchUploading: boolean
  onUpdate: (patch: Partial<PendingUpload>) => void
  onRemove: () => void
}

function PendingItemRow({
  item,
  elements,
  isBatchUploading,
  onUpdate,
  onRemove,
}: PendingItemRowProps) {
  const isEditable = !isBatchUploading && item.status !== 'done'

  return (
    <div className="border border-graphite-200 rounded-lg p-3 bg-white">
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-20 h-20 shrink-0 rounded-md bg-graphite-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.previewUrl}
            alt="podgląd"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Fields */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs text-graphite-500 truncate flex-1">
              {item.file.name} ·{' '}
              <span className="tabular-nums">
                {(item.originalSize / 1024).toFixed(0)} KB
                {item.compressedSize !== undefined && (
                  <>
                    {' → '}
                    {(item.compressedSize / 1024).toFixed(0)} KB
                  </>
                )}
              </span>
            </div>
            {!isBatchUploading && item.status !== 'done' && (
              <button
                type="button"
                onClick={onRemove}
                className="text-graphite-400 hover:text-danger-700"
                aria-label="Usuń z listy"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              min="1"
              placeholder="Nr"
              value={item.photoNumber}
              disabled={!isEditable}
              onChange={(e) =>
                onUpdate({ photoNumber: parseInt(e.target.value, 10) || 0 })
              }
              className="text-sm"
            />
            <div className="col-span-2">
              <Select
                value={item.elementId || 'none'}
                onValueChange={(val) =>
                  onUpdate({ elementId: val === 'none' ? '' : val })
                }
                disabled={!isEditable}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder="Element (opcj.)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— brak —</SelectItem>
                  {elements.map((el) => (
                    <SelectItem key={el.id} value={el.id}>
                      {el.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Input
            placeholder="Opis (opcjonalnie)"
            value={item.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={!isEditable}
            className="text-sm"
          />

          {/* Status row */}
          <StatusBadge status={item.status} error={item.error} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  error,
}: {
  status: UploadStatus
  error?: string
}) {
  if (status === 'queued') return null
  const map: Record<
    UploadStatus,
    { label: string; classes: string; spin?: boolean }
  > = {
    queued: { label: 'Oczekuje', classes: 'bg-graphite-100 text-graphite-700' },
    compressing: {
      label: 'Kompresuję…',
      classes: 'bg-info-50 text-info-800',
      spin: true,
    },
    uploading: {
      label: 'Wgrywam na R2…',
      classes: 'bg-info-50 text-info-800',
      spin: true,
    },
    saving: {
      label: 'Zapisuję…',
      classes: 'bg-info-50 text-info-800',
      spin: true,
    },
    done: { label: '✓ Wgrane', classes: 'bg-success-100 text-success-800' },
    error: {
      label: error ? `✕ Błąd: ${error}` : '✕ Błąd',
      classes: 'bg-danger-50 text-danger-800',
    },
  }
  const cfg = map[status]
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${cfg.classes}`}
    >
      {cfg.spin && <Loader2 size={12} className="animate-spin" />}
      <span>{cfg.label}</span>
    </div>
  )
}
