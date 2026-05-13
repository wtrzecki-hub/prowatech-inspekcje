/**
 * Helper do wyliczenia kolejnego globalnego photo_number dla inspekcji.
 *
 * Zdjęcia w protokole mają wspólną numerację (decyzja Waldka 2026-05-13):
 * - `recommendation_photos.photo_number` (zaleceniowe, scope_item) FIRST
 * - `inspection_photos.photo_number` (usterki bieżące) kontynuują po RP
 *
 * Wszystkie renderują się w jednej sekcji „VI. DOKUMENTACJA GRAFICZNA /
 * FOTOGRAFICZNA" jako „Zdjęcie nr N".
 *
 * Race condition: dwóch userów uploadujących równocześnie do tej samej
 * inspekcji może dostać ten sam numer. W praktyce inspekcję wypełnia 1
 * inspektor — akceptujemy ryzyko.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export async function nextGlobalPhotoNumber(
  supabase: SupabaseClient,
  inspectionId: string,
): Promise<number> {
  const [{ data: ipRow }, { data: rpRow }] = await Promise.all([
    supabase
      .from('inspection_photos')
      .select('photo_number')
      .eq('inspection_id', inspectionId)
      .order('photo_number', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('recommendation_photos')
      .select('photo_number')
      .eq('inspection_id', inspectionId)
      .order('photo_number', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ])
  const ipMax = (ipRow?.photo_number as number | null) ?? 0
  const rpMax = (rpRow?.photo_number as number | null) ?? 0
  return Math.max(ipMax, rpMax) + 1
}
