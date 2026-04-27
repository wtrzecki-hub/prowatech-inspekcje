/**
 * Helper do uploadu pojedynczego zdjęcia inspekcji.
 *
 * Wyciągnięty z `photo-gallery.tsx` żeby był reuse'owalny — `ElementCard`
 * używa go z poziomu rozwiniętej karty elementu (1-klik upload bez dialogu),
 * `photo-gallery.tsx` używa go w batch flow z dialogu „Dodaj zdjęcia".
 *
 * Pipeline:
 *  1. Kompresja JPEG (canvas, max 1920×1920, q=0.85)
 *  2. POST /api/storage/presigned → pre-signed PUT URL
 *  3. PUT bezpośrednio na R2 (omija Vercel 4.5 MB body limit)
 *  4. INSERT inspection_photos {file_url, photo_number, element_id, ...}
 *
 * Zwraca utworzony rekord lub rzuca Error (callsite dostaje konkretny komunikat
 * + może wyświetlić w UI per-file status).
 */

import { compressImage } from './image-compress'
import { createClient } from '@/lib/supabase/client'

export type UploadStatus = 'compressing' | 'uploading' | 'saving'

export interface UploadInspectionPhotoOpts {
  file: File
  inspectionId: string
  photoNumber: number
  elementId?: string | null
  description?: string | null
  /** Callback do śledzenia postępu w UI (np. zmiana koloru badge'a). */
  onProgress?: (status: UploadStatus) => void
  /** Override max wymiaru kompresji. Domyślnie 1920. */
  maxDimension?: number
  /** Override jakości JPEG. Domyślnie 0.85. */
  quality?: number
}

export interface UploadedPhoto {
  id: string
  inspection_id: string
  photo_number: number | null
  file_url: string | null
  description: string | null
  element_id: string | null
}

export async function uploadInspectionPhoto(
  opts: UploadInspectionPhotoOpts,
): Promise<UploadedPhoto> {
  const {
    file,
    inspectionId,
    photoNumber,
    elementId = null,
    description = null,
    onProgress,
    maxDimension = 1920,
    quality = 0.85,
  } = opts

  // 1. Kompresja
  onProgress?.('compressing')
  const compressed = await compressImage(file, {
    maxDimension,
    quality,
    outputType: 'image/jpeg',
  })

  // 2. Pre-signed PUT URL
  onProgress?.('uploading')
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
  onProgress?.('saving')
  const supabase = createClient()
  const { data, error } = await supabase
    .from('inspection_photos')
    .insert({
      inspection_id: inspectionId,
      photo_number: photoNumber,
      file_url: publicUrl,
      description: description?.trim() || null,
      element_id: elementId || null,
    })
    .select(
      'id, inspection_id, photo_number, file_url, description, element_id',
    )
    .single()

  if (error) {
    throw new Error(`DB insert: ${error.message}`)
  }

  return data as UploadedPhoto
}

/**
 * Uploaduje wiele plików sekwencyjnie. Zatrzymuje się przy pierwszym błędzie
 * — zwraca już-wgrane + error w `failedAt`. Callsite może sam zdecydować czy
 * retryować czy pokazać komunikat.
 */
export async function uploadInspectionPhotos(
  files: File[],
  baseOpts: Omit<UploadInspectionPhotoOpts, 'file' | 'photoNumber'> & {
    startNumber: number
  },
  onItemProgress?: (
    index: number,
    total: number,
    status: UploadStatus | 'done' | 'error',
    photo?: UploadedPhoto,
    error?: string,
  ) => void,
): Promise<{
  uploaded: UploadedPhoto[]
  failedAt?: { index: number; error: string }
}> {
  const uploaded: UploadedPhoto[] = []

  for (let i = 0; i < files.length; i++) {
    try {
      const photo = await uploadInspectionPhoto({
        ...baseOpts,
        file: files[i],
        photoNumber: baseOpts.startNumber + i,
        onProgress: (status) =>
          onItemProgress?.(i, files.length, status),
      })
      uploaded.push(photo)
      onItemProgress?.(i, files.length, 'done', photo)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nieznany błąd'
      onItemProgress?.(i, files.length, 'error', undefined, message)
      return { uploaded, failedAt: { index: i, error: message } }
    }
  }

  return { uploaded }
}
