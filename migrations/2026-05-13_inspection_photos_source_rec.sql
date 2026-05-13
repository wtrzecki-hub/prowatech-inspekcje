-- 2026-05-13 — Propagacja niewykonanych zaleceń prev_rec → element (Faza A).
--
-- Cel: gdy inspektor zaznacza „Nie wykonano" w `previous_recommendations`,
-- system kopiuje zdjęcia z `recommendation_photos` do `inspection_photos`
-- (galeria per element w sekcji III. USTALENIA). Wskaźnik R2 (`file_url`) jest
-- duplikowany — plik na R2 leży tylko raz, ale renderuje się w dwóch miejscach:
-- w sekcji VI (zalecenia z poprzedniej kontroli) i w sekcji III (przy elemencie).
--
-- `source_recommendation_id` śledzi pochodzenie. Pozwala:
--   - dedup przy ponownej propagacji (nie kopiuj jeśli już są)
--   - clean revert przy odznaczeniu „Nie wykonano" (DELETE WHERE source_recommendation_id = $)
--   - ręczne zdjęcia (uploadowane przez inspektora w karcie elementu) mają source = NULL
--     i nie są dotykane przy revert.
--
-- ON DELETE SET NULL: gdy prev_rec zostaje usunięty, jego zdjęcia w inspection_photos
-- nie znikają (mogły być świadomie zachowane przez inspektora), ale tracą tracking.

ALTER TABLE inspection_photos
  ADD COLUMN source_recommendation_id UUID NULL
  REFERENCES previous_recommendations(id) ON DELETE SET NULL;

-- Index partial — używany TYLKO przy revert i dedup, więc zwykle queries
-- omijają go. Partial index = mniejszy storage + szybkie lookupy gdy potrzebny.
CREATE INDEX inspection_photos_source_rec_idx
  ON inspection_photos(source_recommendation_id)
  WHERE source_recommendation_id IS NOT NULL;

COMMENT ON COLUMN inspection_photos.source_recommendation_id IS
  'FK do previous_recommendations.id gdy zdjęcie zostało skopiowane przez auto-carry „Nie wykonano". NULL dla zdjęć dodanych ręcznie przez inspektora.';
