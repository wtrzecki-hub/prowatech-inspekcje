/**
 * Helper do uploadu zdjęcia przypiętego do pozycji zalecenia.
 *
 * Analog `upload-inspection-photo.ts` — kompresja + presigned PUT R2 + INSERT
 * do `recommendation_photos`. Różnica: zamiast `inspection_photos.photo_number`
 * używamy `parent_type` + `parent_id` żeby ten sam pipeline obsłużył obie strony
 * zalecenia (`previous_recommendation` i `repair_scope_item` po auto-carry).
 */

import { compressImage } from './image-compress'
import { createClient } from '@/lib/supabase/client'

export type UploadStatus = 'compressing' | 'uploading' | 'saving'

export type RecommendationPhotoParentType =
  | 'previous_recommendation'
  | 'repair_scope_item'

export interface UploadRecommendationPhotoOpts {
  file: File
  inspectionId: string
  parentType: RecommendationPhotoParentType
  parentId: string
  sortOrder?: number
  caption?: string | null
  onProgress?: (status: UploadStatus) => void
  maxDimension?: number
  quality?: number
}

export interface UploadedRecommendationPhoto {
  id: string
  parent_type: RecommendationPhotoParentType
  parent_id: string
  inspection_id: string
  file_url: string
  r2_key: string
  caption: string | null
  sort_order: number
}

export async function uploadRecommendationPhoto(
  opts: UploadRecommendationPhotoOpts,
): Promise<UploadedRecommendationPhoto> {
  const {
    file,
    inspectionId,
    parentType,
    parentId,
    sortOrder = 0,
    caption = null,
    onProgress,
    maxDimension = 1920,
    quality = 0.85,
  } = opts

  onProgress?.('compressing')
  const compressed = await compressImage(file, {
    maxDimension,
    quality,
    outputType: 'image/jpeg',
  })

  onProgress?.('uploading')
  const presignedRes = await fetch('/api/storage/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: compressed.file.name,
      contentType: compressed.file.type,
      context: 'recommendation-photo',
      inspectionId,
    }),
  })

  if (!presignedRes.ok) {
    const errText = await presignedRes.text().catch(() => 'unknown')
    throw new Error(`Pre-signed URL: ${presignedRes.status} ${errText}`)
  }

  const { uploadUrl, publicUrl, key } = (await presignedRes.json()) as {
    uploadUrl: string
    publicUrl: string
    key: string
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': compressed.file.type },
    body: compressed.file,
  })

  if (!putRes.ok) {
    throw new Error(`R2 PUT: ${putRes.status} ${putRes.statusText}`)
  }

  onProgress?.('saving')
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recommendation_photos')
    .insert({
      parent_type: parentType,
      parent_id: parentId,
      inspection_id: inspectionId,
      file_url: publicUrl,
      r2_key: key,
      caption: caption?.trim() || null,
      sort_order: sortOrder,
    })
    .select(
      'id, parent_type, parent_id, inspection_id, file_url, r2_key, caption, sort_order',
    )
    .single()

  if (error) {
    throw new Error(`DB insert: ${error.message}`)
  }

  return data as UploadedRecommendationPhoto
}
