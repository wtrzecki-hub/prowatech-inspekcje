-- =============================================================================
-- MIGRATION: repair_scope_items — kolumny "stopien pilnosci" + "rodzaj robot"
--            + element/lokalizacja (2026-05-08)
-- Project:   lhxhsprqoecepojrxepf
--
-- ZAKRES (Waldek, audyt 5L pkt 4):
--   Sekcja "VI. Zalecenia" (Zakres robot remontowych) wymaga w protokole PIIB
--   kolumny "Stopien pilnosci" (I/II/III/IV) i oznaczenia rodzaju robot
--   K/NB/NG (konserwacja / naprawa biezaca / naprawa glowna). Dotad
--   `repair_scope_items` mial tylko opis i termin - przez co protokol nie
--   spelnial wzorca PIIB.
--
-- ZRODLO (research 2026-05-08):
--   - PIIB: Zalacznik do uchwaly nr PIIB/KR/0051/2024 (wzor protokolu)
--   - WACETOB 1998: tabela kryteriow oceny stanu technicznego (5 stanow)
--   - Rozp. MSWiA z 16.08.1999 § 3 pkt 3-4: definicje K/NB/NG
--   - Konwencja branzowa: I = najpilniejszy (zgodnie z protokolem 248/T/2025)
--
-- DODAWANE KOLUMNY:
--   1. element_name TEXT       - element/lokalizacja (np. "Fundament", "Wieza")
--   2. work_kind TEXT CHECK    - rodzaj robot: 'K', 'NB', 'NG'
--   3. urgency_level TEXT CHECK - stopien pilnosci: 'I', 'II', 'III', 'IV'
--
-- KONWENCJA STOPNI:
--   I   - natychmiast (zagrozenie bezpieczenstwa)
--   II  - do 3 miesiecy
--   III - do 12 miesiecy
--   IV  - do 5 lat
--
-- BACKWARD COMPAT:
--   Wszystkie kolumny NULLABLE - istniejace wiersze (10+ wpisow EW01) dostana
--   NULL i beda renderowane w PDF/DOCX z myslnikiem (—) w nowych kolumnach.
--   Inspektor moze uzupelnic recznie. Auto-import z elementow nie wypelnia
--   tych pol (rodzaj robot zalezy od ekspertyzy inspektora).
-- =============================================================================

BEGIN;

ALTER TABLE repair_scope_items
  ADD COLUMN IF NOT EXISTS element_name TEXT,
  ADD COLUMN IF NOT EXISTS work_kind TEXT
    CHECK (work_kind IS NULL OR work_kind IN ('K', 'NB', 'NG')),
  ADD COLUMN IF NOT EXISTS urgency_level TEXT
    CHECK (urgency_level IS NULL OR urgency_level IN ('I', 'II', 'III', 'IV'));

COMMENT ON COLUMN repair_scope_items.element_name IS
  'Element obiektu / lokalizacja roboty (np. "Fundament", "Wieza segment 2", "Instalacja elektryczna").';
COMMENT ON COLUMN repair_scope_items.work_kind IS
  'Rodzaj robot wg konwencji branzowej + rozp. MSWiA: K=konserwacja, NB=naprawa biezaca, NG=naprawa glowna.';
COMMENT ON COLUMN repair_scope_items.urgency_level IS
  'Stopien pilnosci wg WACETOB/PIIB (I=najpilniejszy do IV=do 5 lat). I=natychmiast, II=3msc, III=12msc, IV=5lat.';

CREATE INDEX IF NOT EXISTS idx_repair_scope_urgency
  ON repair_scope_items (inspection_id, urgency_level);

COMMIT;

-- WERYFIKACJA:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'repair_scope_items'
--   AND column_name IN ('element_name', 'work_kind', 'urgency_level');

-- ROLLBACK:
-- ALTER TABLE repair_scope_items
--   DROP COLUMN element_name, DROP COLUMN work_kind, DROP COLUMN urgency_level;
-- DROP INDEX IF EXISTS idx_repair_scope_urgency;
