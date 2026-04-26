/**
 * Cloudflare R2 storage adapter (S3-compatible).
 *
 * Konwencja:
 *  - Publiczne identyfikatory (Account ID, Endpoint, Bucket, Public URL)
 *    są hardkodowane jak credentialsy Supabase w `lib/supabase/client.ts`
 *    (PROGRESS.md, gotcha o NEXT_PUBLIC_ inliningu w buildzie Vercel).
 *  - Sekretne credentialsy (Access Key ID + Secret Access Key) idą z env.
 *
 * Środowiska:
 *  - Lokalnie: `.env.local` z `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`.
 *  - Vercel: Production + Preview env vars (Sensitive=on dla Secret).
 *
 * Wszystkie operacje wymagają runtime = 'nodejs' (AWS SDK + Buffer).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// === Publiczne identyfikatory R2 (hardkodowane wg konwencji projektu) ===
export const R2_ACCOUNT_ID = "587ba2347ed372341fe359b0ed2d632d";
export const R2_BUCKET = "prowatech-inspekcje";
export const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`;
export const R2_PUBLIC_URL = "https://pub-edbf124678454e819a88cd7054401694.r2.dev";

// === Lazy-initialized S3 client ===
let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured — brak R2_ACCESS_KEY_ID lub R2_SECRET_ACCESS_KEY w env. " +
        "Sprawdź .env.local (lokalnie) lub Vercel Environment Variables (deploy)."
    );
  }

  _client = new S3Client({
    region: "auto", // R2 nie używa regionów AWS; "auto" obowiązkowe
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _client;
}

// === Public URL helpers ===

/**
 * Zwraca publiczny URL (do bezpośredniego odczytu plików przez przeglądarkę
 * lub fetch w generatorach PDF/DOCX). Plik MUSI istnieć w buckecie i bucket
 * MUSI mieć włączony Public Development URL.
 */
export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${encodeR2Path(key)}`;
}

/**
 * Wyciąga klucz R2 z pełnego public URL. Zwraca null gdy URL nie pochodzi
 * z naszego bucketu (np. legacy Supabase Storage URL albo Google Drive).
 */
export function extractKeyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `${R2_PUBLIC_URL}/`;
  if (!url.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return null;
  }
}

// === Pre-signed URLs ===

/**
 * Generuje pre-signed PUT URL dla bezpośredniego uploadu z przeglądarki
 * do R2 (omija limit 4.5 MB request body w Vercel API routes).
 * Klient powinien zrobić: `fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } })`.
 *
 * @param expiresIn TTL w sekundach. Domyślnie 5 min (typowy upload ≤30 s).
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Generuje pre-signed GET URL — używane gdy chcesz dać dostęp do pliku
 * tylko zalogowanym użytkownikom (bez Public Development URL). Aktualnie
 * niewykorzystywane bo bucket jest publiczny, ale przyda się jeśli kiedyś
 * przejdziemy na private bucket (np. dla skanów uprawnień).
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 300
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn });
}

// === Server-side operacje ===

/**
 * Upload pliku z server-side (Node Buffer / Uint8Array). Używane np. w
 * API route migrującej pliki z Supabase Storage albo w skrypcie importu
 * archiwum. Klient (przeglądarka) powinien używać pre-signed URL, nie tego.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getPublicUrl(key);
}

/** Usunięcie pliku po kluczu. Idempotentne — brak pliku nie rzuca błędu. */
export async function deleteFile(key: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
  } catch (err: any) {
    // R2 zwraca 404 dla nieistniejącego klucza — to OK, traktujemy jako noop.
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey") {
      return;
    }
    throw err;
  }
}

/** Sprawdza czy plik istnieje (HEAD request — nie pobiera body). */
export async function fileExists(key: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
    return true;
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      return false;
    }
    throw err;
  }
}

// === Key building ===

export type StorageContext =
  | "inspection-photo"
  | "turbine-photo"
  | "inspector-doc"
  | "historical-protocol";

export interface BuildKeyParams {
  context: StorageContext;
  filename: string;
  inspectionId?: string;
  turbineId?: string;
  inspectorId?: string;
  /** Slot 1/2/3 dla zdjęć turbiny */
  slot?: 1 | 2 | 3;
  /** Typ dokumentu inspektora: udt | uprawnienia | gwo | sep | izba | winda */
  docType?: string;
  /** Rok protokołu historycznego */
  year?: number;
  /** Typ kontroli historycznej */
  inspectionType?: "annual" | "five_year";
}

/**
 * Buduje klucz R2 wg konwencji projektu:
 *  - inspections/{inspection_id}/photos/{ts}_{rand}.{ext}
 *  - turbines/{turbine_id}/photo_{slot}.{ext}              (slot 1/2/3)
 *  - inspectors/{inspector_id}/{docType}.{ext}
 *  - historical/{turbine_id}/{year}_{type}_{ts}_{rand}.pdf
 */
export function buildKey(params: BuildKeyParams): string {
  const ext = sanitizeExt(params.filename);
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);

  switch (params.context) {
    case "inspection-photo": {
      if (!params.inspectionId) {
        throw new Error("inspectionId required for context=inspection-photo");
      }
      return `inspections/${params.inspectionId}/photos/${ts}_${rand}.${ext}`;
    }

    case "turbine-photo": {
      if (!params.turbineId) {
        throw new Error("turbineId required for context=turbine-photo");
      }
      const slot = params.slot ?? 1;
      // Stała nazwa per slot — kolejny upload nadpisuje poprzednie zdjęcie.
      // Cache busting przez query string (?v=ts) po stronie UI.
      return `turbines/${params.turbineId}/photo_${slot}.${ext}`;
    }

    case "inspector-doc": {
      if (!params.inspectorId) {
        throw new Error("inspectorId required for context=inspector-doc");
      }
      const docType = sanitizeFilenameSegment(params.docType || "doc");
      // Stała nazwa per docType — re-upload nadpisuje poprzedni skan.
      return `inspectors/${params.inspectorId}/${docType}.${ext}`;
    }

    case "historical-protocol": {
      if (!params.turbineId || !params.year || !params.inspectionType) {
        throw new Error(
          "turbineId/year/inspectionType required for context=historical-protocol"
        );
      }
      return `historical/${params.turbineId}/${params.year}_${params.inspectionType}_${ts}_${rand}.${ext}`;
    }

    default: {
      const _exhaustive: never = params.context;
      throw new Error(`Unknown context: ${_exhaustive}`);
    }
  }
}

// === Internal helpers ===

function sanitizeExt(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const raw = dot >= 0 ? filename.slice(dot + 1) : "";
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  return cleaned || "bin";
}

function sanitizeFilenameSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "file";
}

/**
 * URL-encode segmentów klucza R2 (każdy segment osobno żeby zachować slashe).
 * Public URL R2 wymaga procentowanego kodowania białych znaków, polskich znaków itp.
 */
function encodeR2Path(key: string): string {
  return key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}
