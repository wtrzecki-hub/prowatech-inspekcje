-- =============================================================================
-- MIGRATION: Wyniki ogledzin instalacji elektrycznej i odgromowej (2026-05-07)
-- Project:   lhxhsprqoecepojrxepf
--
-- ZAKRES:
--   Dodaje 4 kolumny do `inspections` dla strukturyzowanego zapisu wynikow
--   ogledzin (zakladka Pomiary):
--     1. Ogledziny instalacji elektrycznej
--     2. Ogledziny instalacji odgromowej i uziomow
--   Kazda z 2 mozliwymi ocenami koncowymi: pozytywna / negatywna. Przy
--   ocenie negatywnej dodatkowo opis.
--
-- KONTEKST:
--   Audyt 2026-05-07 (Waldek): wczesniej uzytkownik wpisywal "Negatywna" w
--   wolnotekstowym `electrical_measurement_final_assessment`. Strukturyzacja
--   pozwoli renderer-owi PDF/DOCX zlozyc dwa wpisy z latwo czytelnym wynikiem.
--
-- BACKWARD COMPAT:
--   Stary `electrical_measurement_final_assessment` zostaje (TEXT) jako pole
--   uzupelniajace / legacy. Renderer wybiera strukturyzowane pola gdy obecne.
-- =============================================================================

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS electrical_visual_inspection_result TEXT
    CHECK (
      electrical_visual_inspection_result IS NULL
      OR electrical_visual_inspection_result IN ('pozytywna', 'negatywna')
    ),
  ADD COLUMN IF NOT EXISTS electrical_visual_inspection_notes TEXT,
  ADD COLUMN IF NOT EXISTS lightning_visual_inspection_result TEXT
    CHECK (
      lightning_visual_inspection_result IS NULL
      OR lightning_visual_inspection_result IN ('pozytywna', 'negatywna')
    ),
  ADD COLUMN IF NOT EXISTS lightning_visual_inspection_notes TEXT;

COMMENT ON COLUMN public.inspections.electrical_visual_inspection_result IS
  'Wynik ogledzin instalacji elektrycznej (zakladka Pomiary): pozytywna / negatywna.';
COMMENT ON COLUMN public.inspections.electrical_visual_inspection_notes IS
  'Opis przy negatywnym wyniku ogledzin instalacji elektrycznej.';
COMMENT ON COLUMN public.inspections.lightning_visual_inspection_result IS
  'Wynik ogledzin instalacji odgromowej i uziomow (zakladka Pomiary): pozytywna / negatywna.';
COMMENT ON COLUMN public.inspections.lightning_visual_inspection_notes IS
  'Opis przy negatywnym wyniku ogledzin instalacji odgromowej i uziomow.';
