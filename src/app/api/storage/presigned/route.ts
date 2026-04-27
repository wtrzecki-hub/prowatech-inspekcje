/**
 * POST /api/storage/presigned
 *
 * Zwraca pre-signed PUT URL do bezpośredniego uploadu z przeglądarki na R2.
 * Wymaga zalogowanego usera z rolą `admin` lub `inspektor` (portal client_user
 * jest read-only). TTL pre-signed URL = 5 min, wystarczy dla typowego uploadu.
 *
 * Request body (JSON):
 *   {
 *     filename: string,         // pełna nazwa z rozszerzeniem, np. "DSC_0123.jpg"
 *     contentType: string,      // MIME, np. "image/jpeg" / "application/pdf"
 *     context: "inspection-photo" | "turbine-photo" | "inspector-doc" | "historical-protocol",
 *
 *     // wymagane zależnie od context:
 *     inspectionId?: string,    // dla inspection-photo
 *     turbineId?: string,       // dla turbine-photo, historical-protocol
 *     inspectorId?: string,     // dla inspector-doc
 *     slot?: 1 | 2 | 3,         // dla turbine-photo
 *     docType?: string,         // dla inspector-doc, np. "udt" / "uprawnienia" / "gwo"
 *     year?: number,            // dla historical-protocol
 *     inspectionType?: "annual" | "five_year"  // dla historical-protocol
 *   }
 *
 * Response 200:
 *   {
 *     uploadUrl: string,        // pre-signed PUT URL (5 min)
 *     publicUrl: string,        // finalny public URL po uploadzie — zapisz w DB
 *     key: string               // klucz R2 (do delete'a / debugowania)
 *   }
 *
 * Klient po otrzymaniu odpowiedzi:
 *   await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
 *   // potem zapis publicUrl do file_url / photo_url w odpowiedniej tabeli Supabase
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildKey,
  getPresignedUploadUrl,
  getPublicUrl,
  type BuildKeyParams,
  type StorageContext,
} from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CONTEXTS: StorageContext[] = [
  "inspection-photo",
  "turbine-photo",
  "inspector-doc",
  "historical-protocol",
];

const MAX_FILENAME_LENGTH = 200;

interface PresignedRequestBody {
  filename?: string;
  contentType?: string;
  context?: string;
  inspectionId?: string;
  turbineId?: string;
  inspectorId?: string;
  slot?: number;
  docType?: string;
  year?: number;
  inspectionType?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth — zalogowany user
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Unauthorized — wymaga zalogowania" },
        { status: 401 }
      );
    }

    // 2. Role — tylko admin/inspektor mogą uploadować (portal client_user
    //    jest read-only, nie ma uploadu w obecnym scope)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // UWAGA: enum user_role w bazie używa wartości po angielsku (admin/inspector/
    // client_user/viewer). Wcześniej tu był typo 'inspektor' (po polsku) który
    // blokował wszystkie uploady robione przez inspektorów (403). Patrz PROGRESS.md
    // gotcha "enum user_role w bazie używa wartości po angielsku" (Faza 15.E).
    if (!profile || (profile.role !== "admin" && profile.role !== "inspector")) {
      return NextResponse.json(
        {
          error:
            "Forbidden — upload tylko dla admin/inspector. Profil nie znaleziony lub niewłaściwa rola.",
        },
        { status: 403 }
      );
    }

    // 3. Parse body
    let body: PresignedRequestBody;
    try {
      body = (await request.json()) as PresignedRequestBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // 4. Walidacja pól wspólnych
    const filename = (body.filename || "").trim();
    const contentType = (body.contentType || "").trim();
    const context = body.context as StorageContext | undefined;

    if (!filename) {
      return NextResponse.json(
        { error: "Missing filename" },
        { status: 400 }
      );
    }
    if (filename.length > MAX_FILENAME_LENGTH) {
      return NextResponse.json(
        { error: `Filename too long (max ${MAX_FILENAME_LENGTH} chars)` },
        { status: 400 }
      );
    }
    if (!contentType) {
      return NextResponse.json(
        { error: "Missing contentType" },
        { status: 400 }
      );
    }
    if (!context || !VALID_CONTEXTS.includes(context)) {
      return NextResponse.json(
        {
          error: `Invalid context — oczekiwane: ${VALID_CONTEXTS.join(" | ")}`,
        },
        { status: 400 }
      );
    }

    // 5. Walidacja pól per-context + budowa BuildKeyParams
    const buildParams: BuildKeyParams = { context, filename };

    if (context === "inspection-photo") {
      if (!body.inspectionId) {
        return NextResponse.json(
          { error: "inspectionId required for context=inspection-photo" },
          { status: 400 }
        );
      }
      buildParams.inspectionId = body.inspectionId;
    } else if (context === "turbine-photo") {
      if (!body.turbineId) {
        return NextResponse.json(
          { error: "turbineId required for context=turbine-photo" },
          { status: 400 }
        );
      }
      const slot = body.slot;
      if (slot !== 1 && slot !== 2 && slot !== 3) {
        return NextResponse.json(
          { error: "slot must be 1, 2 or 3 for context=turbine-photo" },
          { status: 400 }
        );
      }
      buildParams.turbineId = body.turbineId;
      buildParams.slot = slot;
    } else if (context === "inspector-doc") {
      if (!body.inspectorId) {
        return NextResponse.json(
          { error: "inspectorId required for context=inspector-doc" },
          { status: 400 }
        );
      }
      if (!body.docType) {
        return NextResponse.json(
          { error: "docType required for context=inspector-doc" },
          { status: 400 }
        );
      }
      buildParams.inspectorId = body.inspectorId;
      buildParams.docType = body.docType;
    } else if (context === "historical-protocol") {
      if (!body.turbineId || !body.year || !body.inspectionType) {
        return NextResponse.json(
          {
            error:
              "turbineId, year and inspectionType required for context=historical-protocol",
          },
          { status: 400 }
        );
      }
      if (body.inspectionType !== "annual" && body.inspectionType !== "five_year") {
        return NextResponse.json(
          { error: "inspectionType must be 'annual' or 'five_year'" },
          { status: 400 }
        );
      }
      const year = Number(body.year);
      if (!Number.isInteger(year) || year < 2010 || year > 2050) {
        return NextResponse.json(
          { error: "year must be an integer between 2010 and 2050" },
          { status: 400 }
        );
      }
      buildParams.turbineId = body.turbineId;
      buildParams.year = year;
      buildParams.inspectionType = body.inspectionType;
    }

    // 6. Build key + pre-signed URL
    const key = buildKey(buildParams);
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 300);
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error("[/api/storage/presigned] error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
