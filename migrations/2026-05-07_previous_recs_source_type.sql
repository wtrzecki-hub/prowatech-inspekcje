-- =============================================================================
-- MIGRATION: previous_recommendations.source_inspection_type (2026-05-07)
-- Project:   lhxhsprqoecepojrxepf
--
-- ZAKRES:
--   Dodaje pole `source_inspection_type` do `previous_recommendations`,
--   pozwalajace rozdzielic zalecenia importowane z poprzedniej kontroli
--   5-letniej vs. rocznej. UI pokazuje 2 osobne sekcje "Sprawdzenie wykonania
--   zalecen z poprzedniej kontroli 5-letniej" i "...rocznej".
--
-- KONTEKST:
--   Audyt PIIB 2026-05-07 (Waldek, EW01 Zensko): w protokole inspekcja
--   sprawdza realizacje zalecen z OBU poprzednich kontroli (rocznej i
--   5-letniej). Auto-import dotad ciagnal tylko ostatnia inspekcje
--   (.limit(1)), niezaleznie od typu - przez co dla turbiny z ostatnia
--   inspekcja 5-letnia w bazie/archiwum, brakowalo zalecen z rocznej.
--
-- BACKWARD COMPAT:
--   Istniejace wiersze maja source_inspection_type = NULL. UI traktuje takie
--   wiersze jako "niesklasyfikowane" - pokazuje je w sekcji glownej dopoki
--   inspektor recznie nie przypisze zrodla (lub re-importu).
-- =============================================================================

ALTER TABLE public.previous_recommendations
  ADD COLUMN IF NOT EXISTS source_inspection_type TEXT
    CHECK (
      source_inspection_type IS NULL
      OR source_inspection_type IN ('annual', 'five_year')
    );

CREATE INDEX IF NOT EXISTS idx_prev_recs_inspection_source
  ON public.previous_recommendations (inspection_id, source_inspection_type);

COMMENT ON COLUMN public.previous_recommendations.source_inspection_type IS
  'Z jakiego typu poprzedniej kontroli pochodzi to zalecenie: annual / five_year. NULL = niesklasyfikowane (legacy / dodane recznie bez wskazania zrodla).';
