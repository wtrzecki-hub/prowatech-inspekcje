/**
 * Client-side kompresja obrazów przed uploadem na R2.
 *
 * Zamiast wysyłać 5 MB zdjęcie z aparatu telefonu/aparatu DSLR, kompresujemy je
 * lokalnie przez canvas do max 1920×1920 px JPEG quality 0.85 → typowo ~500 KB.
 * Oszczędza ruch sieciowy w terenie (LTE/3G), zostaje w 10 GB R2 free tier.
 *
 * Cele:
 *  - Działa w przeglądarce (Chrome/Safari/Firefox), w tym tablet/mobile
 *  - Zachowuje proporcje obrazu, nie deformuje
 *  - Bezpieczne fallbacki dla przypadków granicznych (zbyt mały obraz, zły MIME)
 *  - Brak deps — natywne `Image` + `<canvas>` + `canvas.toBlob`
 *
 * Nie obsługuje:
 *  - HEIC/HEIF (iOS native) — Safari potrafi czasem wczytać do <img>, ale Chrome
 *    desktop nie. Zostawiamy: jeśli Image.onerror, zwracamy oryginał (R2 weźmie).
 *  - EXIF orientation — większość nowoczesnych przeglądarek autorotuje canvas
 *    zgodnie z EXIF (od ~2020). Jeśli kiedyś ktoś znajdzie obrócony obrazek,
 *    dorzucimy lib `blueimp-load-image` albo ręczny EXIF parser.
 *
 * Wzorzec użycia:
 * ```ts
 * import { compressImage } from '@/lib/storage/image-compress'
 *
 * const compressed = await compressImage(file, { maxDimension: 1920, quality: 0.85 })
 * // Następnie upload `compressed` przez pre-signed PUT na R2.
 * ```
 */

export interface CompressOptions {
  /** Maksymalna szerokość/wysokość po skalowaniu. Domyślnie 1920 (Full HD). */
  maxDimension?: number
  /** Jakość JPEG 0.0-1.0. Domyślnie 0.85 (dobry kompromis size/quality dla zdjęć dokumentacyjnych). */
  quality?: number
  /** Wynikowy MIME. Domyślnie 'image/jpeg'. */
  outputType?: 'image/jpeg' | 'image/webp' | 'image/png'
  /**
   * Pomiń kompresję jeśli plik jest mniejszy niż threshold (bytes).
   * Domyślnie 200 KB — taki plik najpewniej już jest zoptymalizowany.
   */
  skipIfSmallerThan?: number
}

export interface CompressResult {
  /** Skompresowany plik (lub oryginał jeśli kompresja pominięta/nieudana). */
  file: File
  /** Czy plik został faktycznie skompresowany. */
  compressed: boolean
  /** Rozmiar oryginału w bajtach. */
  originalSize: number
  /** Rozmiar po kompresji. */
  newSize: number
  /** Wymiary obrazu po skalowaniu (lub null gdy nie zdekodowano). */
  width: number | null
  height: number | null
  /** Powód pominięcia kompresji (jeśli compressed=false). */
  skipReason?: 'too-small' | 'not-image' | 'decode-failed' | 'encode-failed'
}

const DEFAULT_OPTS: Required<CompressOptions> = {
  maxDimension: 1920,
  quality: 0.85,
  outputType: 'image/jpeg',
  skipIfSmallerThan: 200 * 1024,
}

/**
 * Skompresuj plik obrazu. Zwraca nowy File z `image/jpeg` jako contentType
 * (lub oryginał gdy kompresja niemożliwa).
 *
 * Implementacja:
 *  1. Walidacja typu (image/*) i rozmiaru
 *  2. Wczytanie do `<img>` przez ObjectURL
 *  3. Skalowanie do canvas zachowując proporcje
 *  4. canvas.toBlob() z docelowym MIME + quality
 *  5. Zwinięcie do new File z nową nazwą (zmiana ext na docelowy MIME)
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<CompressResult> {
  const o = { ...DEFAULT_OPTS, ...opts }
  const originalSize = file.size

  // Plik nie jest obrazem — nic nie robimy
  if (!file.type.startsWith('image/')) {
    return {
      file,
      compressed: false,
      originalSize,
      newSize: originalSize,
      width: null,
      height: null,
      skipReason: 'not-image',
    }
  }

  // Plik już mały — pomijamy
  if (file.size < o.skipIfSmallerThan) {
    return {
      file,
      compressed: false,
      originalSize,
      newSize: originalSize,
      width: null,
      height: null,
      skipReason: 'too-small',
    }
  }

  // Wczytaj jako Image
  let img: HTMLImageElement
  let url: string
  try {
    url = URL.createObjectURL(file)
    img = await loadImage(url)
  } catch {
    return {
      file,
      compressed: false,
      originalSize,
      newSize: originalSize,
      width: null,
      height: null,
      skipReason: 'decode-failed',
    }
  }

  try {
    // Oblicz docelowe wymiary zachowując proporcje
    const { width, height } = scaleToFit(
      img.naturalWidth,
      img.naturalHeight,
      o.maxDimension,
    )

    // Jeśli oryginał jest mniejszy niż maxDimension w obu wymiarach,
    // możemy zachować oryginalne wymiary i tylko re-encode do JPEG.
    const targetW = Math.min(img.naturalWidth, width)
    const targetH = Math.min(img.naturalHeight, height)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return {
        file,
        compressed: false,
        originalSize,
        newSize: originalSize,
        width: null,
        height: null,
        skipReason: 'encode-failed',
      }
    }

    // Białe tło dla JPEG (bez przezroczystości — JPEG nie ma alpha kanału)
    if (o.outputType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetW, targetH)
    }
    ctx.drawImage(img, 0, 0, targetW, targetH)

    const blob = await canvasToBlob(canvas, o.outputType, o.quality)
    if (!blob) {
      return {
        file,
        compressed: false,
        originalSize,
        newSize: originalSize,
        width: targetW,
        height: targetH,
        skipReason: 'encode-failed',
      }
    }

    // Jeśli kompresja zwiększyła rozmiar (rzadkie ale możliwe dla małych PNG),
    // zwracamy oryginał — bez sensu pakować coś gorzej.
    if (blob.size >= originalSize) {
      return {
        file,
        compressed: false,
        originalSize,
        newSize: originalSize,
        width: targetW,
        height: targetH,
      }
    }

    const newFilename = renameExtension(file.name, o.outputType)
    const compressedFile = new File([blob], newFilename, {
      type: o.outputType,
      lastModified: Date.now(),
    })

    return {
      file: compressedFile,
      compressed: true,
      originalSize,
      newSize: compressedFile.size,
      width: targetW,
      height: targetH,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ===========================================================================
// Internal helpers
// ===========================================================================

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

function scaleToFit(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width, height }
  }
  const ratio = Math.min(maxDim / width, maxDim / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

function renameExtension(filename: string, mimeType: string): string {
  const ext =
    mimeType === 'image/jpeg'
      ? 'jpg'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/png'
          ? 'png'
          : 'bin'
  const dot = filename.lastIndexOf('.')
  const base = dot >= 0 ? filename.slice(0, dot) : filename
  return `${base}.${ext}`
}

// ===========================================================================
// Batch helper
// ===========================================================================

/**
 * Skompresuj wiele plików sekwencyjnie. Sekwencyjnie, nie równolegle —
 * każda kompresja zżera CPU + ~50 MB RAM, równoległość zapchałaby tablet.
 *
 * @param onProgress callback (i, total, result) wywoływany po każdym pliku.
 */
export async function compressImages(
  files: File[],
  opts: CompressOptions = {},
  onProgress?: (
    index: number,
    total: number,
    result: CompressResult,
  ) => void,
): Promise<CompressResult[]> {
  const results: CompressResult[] = []
  for (let i = 0; i < files.length; i++) {
    const result = await compressImage(files[i], opts)
    results.push(result)
    onProgress?.(i + 1, files.length, result)
  }
  return results
}
