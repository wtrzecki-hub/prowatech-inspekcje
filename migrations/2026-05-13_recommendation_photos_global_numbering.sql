-- Globalna numeracja zdjęć w protokole — Bug E+F Artura 2026-05-13.
--
-- Stan przed: `inspection_photos.photo_number` (zdjęcia inspekcji) i
-- `recommendation_photos.sort_order` (zdjęcia zaleceń, per scope_item).
-- Dwie osobne sekcje w protokole: „VI. Dokumentacja graficzna" (numer global)
-- i „Dokumentacja fotograficzna zaleceń" (per-scope numeracja bez podpisu).
--
-- Stan po: jedna sekcja „VI. DOKUMENTACJA GRAFICZNA / FOTOGRAFICZNA" z
-- globalną numeracją. Zaleceniowe FIRST (od 1), potem usterki bieżącej.
-- Inspektor widzi „Zdjęcie nr 5" w protokole = jeden i ten sam plik R2 w
-- całym dokumencie.
--
-- Decyzja Waldka 2026-05-13. Patrz: docs/propozycje-sesji.md temat 8.

ALTER TABLE recommendation_photos
  ADD COLUMN photo_number INTEGER NULL;

CREATE INDEX IF NOT EXISTS recommendation_photos_inspection_photo_num_idx
  ON recommendation_photos(inspection_id, photo_number);

COMMENT ON COLUMN recommendation_photos.photo_number IS
  'Globalna numeracja zdjęcia w obrębie inspekcji — wspólna przestrzeń z inspection_photos.photo_number. Renderowane w protokole jako „Zdjęcie nr N". Nullable dopóki backfill nie uzupełni; nowe uploady mają wartość.';

-- Backfill istniejących zdjęć (zaleceniowe FIRST, potem bieżące) wykonywany
-- osobno żeby logika ROW_NUMBER OVER była łatwa do testowania per inspekcja.
-- Nadaje globalne photo_number dla `status != 'signed'`. Patrz:
-- `scripts/backfill_global_photo_numbers.sql` lub bezpośrednie wywołanie MCP.
