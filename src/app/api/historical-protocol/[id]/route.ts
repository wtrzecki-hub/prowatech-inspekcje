/**
 * Proxy download dla archiwalnych protokołów (`historical_protocols`).
 *
 * Endpoint streamuje plik PDF z R2 z ustawionym `Content-Disposition: attachment;
 * filename=…` zgodnym z konwencją z `buildProtocolFilename` (np.
 * `467_T_2025 Protokół_kontroli_rocznej WTG EW 1 Wójcice 18-12-2025.pdf`),
 * zamiast surowego R2 key (`2025_annual_{ts}_{rand}.pdf`).
 *
 * Auth + ACL identyczne jak w `/api/pdf/[id]`:
 *  - wymaga zalogowanego usera
 *  - client_user widzi tylko protokoły turbin należących do jego client_id
 *  - admin/inspector — pełny dostęp
 *
 * Używane przez:
 *  - panel admina (`components/turbine/historical-protocols-tab.tsx`)
 *  - portal klienta (`app/portal/(client)/protokoly/page.tsx`)
 */

export const runtime = 'nodejs'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import {
  buildProtocolFilename,
  contentDispositionAttachment,
} from '@/lib/protocol-filename'

const R2_ACCOUNT_ID = '587ba2347ed372341fe359b0ed2d632d'
const R2_BUCKET = 'prowatech-inspekcje'
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      'https://lhxhsprqoecepojrxepf.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const protocolId = params.id

    // ─── AUTH ──────────────────────────────────────────────────────────────
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile) return new Response('Forbidden', { status: 403 })

    // ─── FETCH HISTORICAL PROTOCOL + TURBINE ──────────────────────────────
    const { data: hp, error: hpError } = await supabase
      .from('historical_protocols')
      .select(
        `id, inspection_type, inspection_date, protocol_number,
         protocol_pdf_r2_key, source_filename,
         turbines!inner(
           turbine_code, ew_designation, location_address,
           wind_farms!inner(client_id)
         )`,
      )
      .eq('id', protocolId)
      .single()

    if (hpError || !hp) {
      return new Response('Protocol not found', { status: 404 })
    }

    // ─── ACL dla client_user ──────────────────────────────────────────────
    if (profile.role === 'client_user') {
      const { data: clientUser } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .single()
      if (!clientUser) return new Response('Forbidden', { status: 403 })

      const farmClientId = (
        hp.turbines as unknown as { wind_farms: { client_id: string } } | null
      )?.wind_farms?.client_id
      if (farmClientId !== clientUser.client_id) {
        return new Response('Forbidden', { status: 403 })
      }
    }

    if (!hp.protocol_pdf_r2_key) {
      return new Response('PDF nie został jeszcze wgrany dla tego protokołu', {
        status: 404,
      })
    }

    // ─── STREAM Z R2 ──────────────────────────────────────────────────────
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    if (!accessKeyId || !secretAccessKey) {
      console.error('[historical-protocol] Brak R2 credentials w env')
      return new Response('Server misconfigured', { status: 500 })
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId, secretAccessKey },
    })

    const obj = await s3.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: hp.protocol_pdf_r2_key,
      }),
    )
    if (!obj.Body) {
      return new Response('Empty body from R2', { status: 502 })
    }

    // ─── BUILD ŁADNA NAZWA PLIKU ──────────────────────────────────────────
    const turbine = hp.turbines as unknown as {
      turbine_code: string | null
      ew_designation: string | null
      location_address: string | null
    } | null

    const filename = buildProtocolFilename(
      {
        protocol_number: hp.protocol_number,
        inspection_type: hp.inspection_type,
        inspection_date: hp.inspection_date,
      },
      turbine
        ? {
            turbine_code: turbine.turbine_code,
            ew_designation: turbine.ew_designation,
            location_address: turbine.location_address,
          }
        : null,
      'pdf',
    )

    return new Response(obj.Body as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': obj.ContentType ?? 'application/pdf',
        'Content-Disposition': contentDispositionAttachment(filename),
        ...(obj.ContentLength
          ? { 'Content-Length': String(obj.ContentLength) }
          : {}),
        // Krótki cache — gdyby ktoś wielokrotnie pobierał, ale niech nie żyje
        // długo, bo metadane (nazwa) mogą się zmieniać po edycji protokołu.
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    console.error('[historical-protocol] error:', err)
    return new Response('Internal server error', { status: 500 })
  }
}
