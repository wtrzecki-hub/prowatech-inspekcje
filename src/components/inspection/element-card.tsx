'use client'

import { useRef, useState } from 'react'
import {
  Camera,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import {
  CONDITION_RATINGS,
  CONDITION_RATINGS_ACTIVE,
  USAGE_SUITABILITY,
  isActiveRating,
} from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import {
  uploadInspectionPhoto,
  type UploadStatus,
  type UploadedPhoto,
} from '@/lib/storage/upload-inspection-photo'
import { RatingBadge } from './rating-badge'

/**
 * Wartości oceny stanu technicznego.
 * Aktywne (PIIB): dobry / dostateczny / niedostateczny / awaryjny
 * Legacy (sprzed 2026-04-25): zadowalajacy / sredni / zly
 */
type ConditionRating =
  | 'dobry'
  | 'dostateczny'
  | 'niedostateczny'
  | 'awaryjny'
  | 'zadowalajacy'
  | 'sredni'
  | 'zly'

interface InspectionElement {
  id: string
  element_number: number
  condition_rating: ConditionRating | null
  wear_percentage: number
  notes: string | null
  recommendations: string | null
  photo_numbers: string | null
  detailed_description: string | null
  not_applicable: boolean
  // PIIB (od 2026-04-25):
  usage_suitability?: 'spelnia' | 'nie_spelnia' | null
  recommendation_completion_date?: string | null
}

interface ElementDefinition {
  id: string
  name_pl: string
  scope_annual: string | null
  scope_five_year_additional: string | null
  // PIIB (od 2026-04-25):
  applicable_standards?: string | null
}

/**
 * Zdjęcie inspekcji — taki sam kształt jak w `photo-gallery.tsx`.
 * ElementCard otrzymuje już-pofiltrowaną listę z parent-page.tsx.
 */
interface ElementPhoto {
  id: string
  photo_number: number | null
  file_url: string | null
  description: string | null
  element_id: string | null
}

interface ElementCardProps {
  element: InspectionElement & { definition: ElementDefinition }
  /**
   * Typ inspekcji — wpływa na widoczność pól tylko-5-letnich
   * (zakres dodatkowy, przydatność do użytkowania).
   * Domyślnie 'annual' dla kompatybilności wstecz.
   */
  inspectionType?: 'annual' | 'five_year'
  /**
   * Zdjęcia przypisane do tego elementu (`inspection_photos.element_id = element.id`).
   * Parent (page.tsx) ładuje wszystkie zdjęcia raz i pofiltruje per-element.
   */
  photos?: ElementPhoto[]
  /**
   * Identyfikator inspekcji — potrzebny do uploadu nowego zdjęcia
   * (build key R2 + INSERT do `inspection_photos`).
   */
  inspectionId?: string
  /**
   * Najwyższy obecnie istniejący numer zdjęcia w CAŁEJ inspekcji
   * (nie tylko per element). Nowo wgrane dostają max+1, max+2…
   */
  maxPhotoNumber?: number
  onUpdate: (data: Partial<InspectionElement>) => void
  /**
   * Wywoływane po udanym uploadzie / usunięciu zdjęcia. Parent powinien
   * przeładować listę zdjęć (pojedyncze SELECT z DB).
   */
  onPhotosChanged?: () => void
}

export function ElementCard({
  element,
  inspectionType = 'annual',
  photos = [],
  inspectionId,
  maxPhotoNumber = 0,
  onUpdate,
  onPhotosChanged,
}: ElementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isScopeExpanded, setIsScopeExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Upload state
  const [uploadingFiles, setUploadingFiles] = useState<
    { name: string; status: UploadStatus | 'done' | 'error'; error?: string }[]
  >([])
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Stable sort dla wyświetlania (po photo_number rosnąco, null na końcu)
  const sortedPhotos = [...photos].sort((a, b) => {
    const an = a.photo_number ?? Number.MAX_SAFE_INTEGER
    const bn = b.photo_number ?? Number.MAX_SAFE_INTEGER
    return an - bn
  })

  // Auto-derived list of photo numbers — pokazujemy zamiast manualnego pola
  const derivedPhotoNumbers = sortedPhotos
    .map((p) => p.photo_number)
    .filter((n): n is number => n != null)
    .join(', ')

  const handleFieldChange = (field: keyof InspectionElement, value: unknown) => {
    setIsLoading(true)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      onUpdate({ [field]: value } as Partial<InspectionElement>)
      setIsLoading(false)
    }, 800)
  }

  const handleNotApplicableChange = (checked: boolean) => {
    handleFieldChange('not_applicable', checked)
  }

  // =========================================================================
  // Upload zdjęć dla tego elementu
  // =========================================================================

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !inspectionId) return

    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (fileArr.length === 0) return

    // Inicjalny status — UI pokazuje od razu listę + spinnery
    setUploadingFiles(
      fileArr.map((f) => ({ name: f.name, status: 'compressing' })),
    )

    let nextNumber = maxPhotoNumber + 1
    const successfulUploads: UploadedPhoto[] = []

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i]
      try {
        const photo = await uploadInspectionPhoto({
          file,
          inspectionId,
          photoNumber: nextNumber,
          elementId: element.id,
          onProgress: (status) =>
            setUploadingFiles((prev) =>
              prev.map((u, idx) => (idx === i ? { ...u, status } : u)),
            ),
        })
        nextNumber += 1
        successfulUploads.push(photo)
        setUploadingFiles((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: 'done' } : u)),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Nieznany błąd'
        console.error('[ElementCard] upload failed:', err)
        setUploadingFiles((prev) =>
          prev.map((u, idx) =>
            idx === i ? { ...u, status: 'error', error: message } : u,
          ),
        )
      }
    }

    // Powiadom parent żeby przeładował listę zdjęć — odświeży `photos` prop
    if (successfulUploads.length > 0) {
      onPhotosChanged?.()
    }

    // Wyczyść status po 2.5s (zostaw błędy widoczne dopóki user nie zamknie ręcznie)
    const hasErrors = successfulUploads.length < fileArr.length
    if (!hasErrors) {
      setTimeout(() => setUploadingFiles([]), 2500)
    }
  }

  const dismissUploadStatus = () => setUploadingFiles([])

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Usunąć to zdjęcie? Plik na R2 zostanie sierotą do późniejszego cleanupu.'))
      return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('inspection_photos')
        .delete()
        .eq('id', photoId)
      if (error) throw error
      onPhotosChanged?.()
    } catch (err) {
      console.error('[ElementCard] delete photo failed:', err)
      alert('Nie udało się usunąć zdjęcia.')
    }
  }

  const isFiveYear = inspectionType === 'five_year'
  const hasScope =
    element.definition.scope_annual ||
    element.definition.scope_five_year_additional ||
    element.definition.applicable_standards

  // Wear% z legacy danych — ukryty dla 0/null (nowe inspekcje), pokazany jako
  // read-only gdy stara inspekcja ma > 0 (informacja historyczna).
  const hasLegacyWear =
    typeof element.wear_percentage === 'number' && element.wear_percentage > 0

  // Czy bieżąca ocena jest legacy — wtedy w selekcie pokażemy ostrzeżenie.
  const ratingIsLegacy = element.condition_rating !== null && !isActiveRating(element.condition_rating)

  return (
    <Card
      className={`transition-opacity rounded-xl border-graphite-200 ${
        element.not_applicable ? 'opacity-60 bg-graphite-50' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-sm font-semibold text-graphite-500">
                {element.element_number}.
              </span>
              <span>{element.definition.name_pl}</span>
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <RatingBadge rating={element.condition_rating} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-5">
          {/* Nie dotyczy Checkbox */}
          <div className="flex items-center gap-3 pb-4 border-b border-graphite-200">
            <Checkbox
              id={`not-applicable-${element.id}`}
              checked={element.not_applicable}
              onCheckedChange={handleNotApplicableChange}
              disabled={isLoading}
            />
            <Label
              htmlFor={`not-applicable-${element.id}`}
              className="text-sm font-medium cursor-pointer"
            >
              Nie dotyczy
            </Label>
          </div>

          {element.not_applicable ? (
            <div className="text-sm text-graphite-500 py-4">
              Element oznaczony jako nie dotyczący. Pozostałe pola są wyłączone.
            </div>
          ) : (
            <>
              {/* Zakres kontroli wg PIIB */}
              {hasScope && (
                <div className="border border-primary-100 rounded-xl p-3 bg-primary-50">
                  <button
                    type="button"
                    onClick={() => setIsScopeExpanded(!isScopeExpanded)}
                    className="flex items-center gap-2 w-full font-medium text-sm text-primary-900 hover:text-primary-700 transition"
                  >
                    {isScopeExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Zakres kontroli i przepisy
                  </button>
                  {isScopeExpanded && (
                    <div className="mt-3 space-y-3 text-sm text-primary-800">
                      {element.definition.scope_annual && (
                        <div>
                          <p className="font-medium mb-1">Zakres roczny (oględziny):</p>
                          <p className="text-primary-700 whitespace-pre-line">
                            {element.definition.scope_annual}
                          </p>
                        </div>
                      )}
                      {isFiveYear && element.definition.scope_five_year_additional && (
                        <div>
                          <p className="font-medium mb-1">Zakres dodatkowy 5-letni:</p>
                          <p className="text-primary-700 whitespace-pre-line">
                            {element.definition.scope_five_year_additional}
                          </p>
                        </div>
                      )}
                      {element.definition.applicable_standards && (
                        <div>
                          <p className="font-medium mb-1">Przepisy / normy / wytyczne:</p>
                          <p className="text-primary-700 whitespace-pre-line text-xs">
                            {element.definition.applicable_standards}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Ocena stanu technicznego (4 stopnie PIIB) */}
              <div className="space-y-2">
                <Label htmlFor={`condition-${element.id}`} className="font-medium">
                  Ocena stanu technicznego
                </Label>
                <Select
                  value={element.condition_rating || 'none'}
                  onValueChange={(val) =>
                    handleFieldChange(
                      'condition_rating',
                      val === 'none' ? null : (val as ConditionRating)
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id={`condition-${element.id}`}>
                    <SelectValue placeholder="Wybierz ocenę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— brak oceny —</SelectItem>
                    {CONDITION_RATINGS_ACTIVE.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                    {/* Pokaż obecną wartość legacy jako wybraną żeby Select nie pokazał pustego */}
                    {ratingIsLegacy && element.condition_rating && (
                      <SelectItem value={element.condition_rating}>
                        {CONDITION_RATINGS[element.condition_rating]} (legacy)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {ratingIsLegacy && (
                  <p className="text-xs text-warning-700">
                    Ocena z poprzedniego wzoru protokołu. Zalecana zmiana na PIIB
                    ({element.condition_rating === 'zadowalajacy' && 'Dobry'}
                    {element.condition_rating === 'sredni' && 'Dostateczny'}
                    {element.condition_rating === 'zly' && 'Niedostateczny'}).
                  </p>
                )}
              </div>

              {/* Przydatność do użytkowania — tylko 5-letni (PIIB sekcja III) */}
              {isFiveYear && (
                <div className="space-y-2">
                  <Label htmlFor={`usage-${element.id}`} className="font-medium">
                    Przydatność do użytkowania
                  </Label>
                  <Select
                    value={element.usage_suitability || 'none'}
                    onValueChange={(val) =>
                      handleFieldChange(
                        'usage_suitability',
                        val === 'none' ? null : (val as 'spelnia' | 'nie_spelnia')
                      )
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger id={`usage-${element.id}`}>
                      <SelectValue placeholder="Wybierz przydatność" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— nie określono —</SelectItem>
                      {USAGE_SUITABILITY.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Wear% — legacy, tylko view-only dla starych rekordów */}
              {hasLegacyWear && (
                <div className="space-y-2 rounded-xl border border-graphite-200 bg-graphite-50 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-graphite-700">
                      Zużycie (legacy)
                    </Label>
                    <span className="font-mono text-sm font-semibold text-graphite-800">
                      {element.wear_percentage}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[element.wear_percentage]}
                    disabled
                    className="w-full"
                  />
                  <p className="text-xs text-graphite-500">
                    Pole z poprzedniego wzoru. W nowych protokołach PIIB nie jest używane.
                  </p>
                </div>
              )}

              {/* Notatki / opis stanu technicznego */}
              <div className="space-y-2">
                <Label htmlFor={`notes-${element.id}`} className="font-medium">
                  Opis stanu technicznego
                </Label>
                <Textarea
                  id={`notes-${element.id}`}
                  placeholder="Opis stanu technicznego, wyniki oględzin, stwierdzone uszkodzenia..."
                  value={element.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              {/* Zalecenia */}
              <div className="space-y-2">
                <Label htmlFor={`recommendations-${element.id}`} className="font-medium">
                  Zalecenia / uwagi
                </Label>
                <Textarea
                  id={`recommendations-${element.id}`}
                  placeholder="Zalecenia dotyczące naprawy lub konserwacji..."
                  value={element.recommendations || ''}
                  onChange={(e) =>
                    handleFieldChange('recommendations', e.target.value)
                  }
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              {/* =====================================================
                   Zdjęcia tego elementu (Krok 3 z roadmapy uwag Artura).
                   Thumbnails + szybki upload (kamera / dysk) prosto z karty
                   elementu — nie trzeba przełączać się na zakładkę „Zdjęcia".
                   Numer zdjęcia auto-derived z listy. Pole „Nr fot." poniżej
                   zachowane jako edytowalne (user może nadpisać dla protokołu).
                   ===================================================== */}
              <div className="space-y-3 rounded-xl border border-graphite-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <Label className="font-medium">
                    Zdjęcia tego elementu
                    {sortedPhotos.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-graphite-500 tabular-nums">
                        ({sortedPhotos.length})
                      </span>
                    )}
                  </Label>
                  {inspectionId && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploadingFiles.length > 0}
                        className="min-h-[40px]"
                      >
                        <Camera size={14} className="mr-1.5" />
                        Aparat
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFiles.length > 0}
                        className="min-h-[40px]"
                      >
                        <FolderOpen size={14} className="mr-1.5" />
                        Z dysku
                      </Button>
                    </div>
                  )}
                </div>

                {/* Hidden inputs — kamera i dysk */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handleFilesSelected(e.target.files)
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
                    void handleFilesSelected(e.target.files)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                />

                {/* Grid thumbnaili */}
                {sortedPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {sortedPhotos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <a
                          href={photo.file_url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="block aspect-square rounded-md overflow-hidden bg-graphite-100 border border-graphite-200 hover:shadow-md transition"
                        >
                          {photo.file_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo.file_url}
                              alt={`Zdjęcie ${photo.photo_number ?? '?'}`}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </a>
                        <div className="absolute top-1 left-1 bg-graphite-900/85 text-white text-[11px] font-bold rounded px-1.5 py-0.5 tabular-nums">
                          {photo.photo_number ?? '?'}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="absolute top-1 right-1 bg-danger/90 hover:bg-danger text-white rounded p-1 opacity-0 group-hover:opacity-100 transition"
                          aria-label="Usuń zdjęcie"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : uploadingFiles.length === 0 ? (
                  <p className="text-xs text-graphite-500 italic py-2">
                    Brak zdjęć tego elementu. Kliknij „Aparat" (na tablecie =
                    natywna kamera) lub „Z dysku" żeby dodać.
                  </p>
                ) : null}

                {/* Upload progress / błędy */}
                {uploadingFiles.length > 0 && (
                  <div className="space-y-1.5 border-t border-graphite-100 pt-2">
                    {uploadingFiles.map((u, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs"
                      >
                        {u.status === 'compressing' && (
                          <Loader2
                            size={12}
                            className="animate-spin text-info-700"
                          />
                        )}
                        {u.status === 'uploading' && (
                          <Loader2
                            size={12}
                            className="animate-spin text-info-700"
                          />
                        )}
                        {u.status === 'saving' && (
                          <Loader2
                            size={12}
                            className="animate-spin text-info-700"
                          />
                        )}
                        {u.status === 'done' && (
                          <span className="text-success-700 font-bold">✓</span>
                        )}
                        {u.status === 'error' && (
                          <span className="text-danger-700 font-bold">✕</span>
                        )}
                        <span className="text-graphite-700 truncate flex-1">
                          {u.name}
                        </span>
                        <span
                          className={`tabular-nums shrink-0 ${
                            u.status === 'error'
                              ? 'text-danger-700'
                              : u.status === 'done'
                                ? 'text-success-700'
                                : 'text-info-700'
                          }`}
                        >
                          {u.status === 'compressing' && 'Kompresuję…'}
                          {u.status === 'uploading' && 'Wgrywam na R2…'}
                          {u.status === 'saving' && 'Zapisuję…'}
                          {u.status === 'done' && 'Wgrane'}
                          {u.status === 'error' && (u.error || 'Błąd')}
                        </span>
                      </div>
                    ))}
                    {uploadingFiles.some((u) => u.status === 'error') && (
                      <button
                        type="button"
                        onClick={dismissUploadStatus}
                        className="text-xs text-graphite-500 hover:text-graphite-700 underline"
                      >
                        Zamknij listę
                      </button>
                    )}
                  </div>
                )}

                {/* Auto-derived numbers + manualne pole "Nr fot." */}
                <div className="space-y-2 border-t border-graphite-100 pt-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label htmlFor={`photos-${element.id}`} className="text-xs text-graphite-700">
                      Nr fot. (do protokołu)
                    </Label>
                    {derivedPhotoNumbers &&
                      derivedPhotoNumbers !== (element.photo_numbers || '') && (
                        <button
                          type="button"
                          onClick={() =>
                            handleFieldChange('photo_numbers', derivedPhotoNumbers)
                          }
                          className="text-xs text-info-700 hover:text-info-800 underline"
                        >
                          Wstaw auto: {derivedPhotoNumbers}
                        </button>
                      )}
                  </div>
                  <Input
                    id={`photos-${element.id}`}
                    placeholder={
                      derivedPhotoNumbers
                        ? `Auto: ${derivedPhotoNumbers}`
                        : 'np. 5, 6, 7'
                    }
                    value={element.photo_numbers || ''}
                    onChange={(e) =>
                      handleFieldChange('photo_numbers', e.target.value)
                    }
                    disabled={isLoading}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Data wykonania zaleceń — osobno żeby nie mieszać z fotkami */}
              <div className="space-y-2">
                <Label htmlFor={`completion-${element.id}`} className="font-medium">
                  Data wykonania zaleceń
                </Label>
                <Input
                  id={`completion-${element.id}`}
                  type="date"
                  value={element.recommendation_completion_date || ''}
                  onChange={(e) =>
                    handleFieldChange(
                      'recommendation_completion_date',
                      e.target.value || null
                    )
                  }
                  disabled={isLoading}
                  className="md:max-w-xs"
                />
              </div>

              {/* Opis szczegółowy */}
              <div className="space-y-2">
                <Label htmlFor={`description-${element.id}`} className="font-medium">
                  Opis szczegółowy (dodatkowy)
                </Label>
                <Textarea
                  id={`description-${element.id}`}
                  placeholder="Szczegółowy opis stanu elementu, fotografie, wyniki pomiarów..."
                  value={element.detailed_description || ''}
                  onChange={(e) =>
                    handleFieldChange('detailed_description', e.target.value)
                  }
                  disabled={isLoading}
                  rows={4}
                />
              </div>
            </>
          )}

          {isLoading && (
            <div className="text-xs text-graphite-400 text-right">
              Zapisywanie...
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
