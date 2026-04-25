-- =============================================================================
-- MIGRATION: Pola turbines wymagane przez generatory PIIB (2026-04-25)
-- Project:   lhxhsprqoecepojrxepf
--
-- ZAKRES:
--   Dodaje 2 brakujące kolumny w `turbines` używane przez generator DOCX/PDF
--   w sekcji "Podstawowe dane obiektu budowlanego" (PIIB metryczka):
--     - commissioning_year      (Rok zakończenia budowy)
--     - tower_construction_type (Rodzaj konstrukcji wieży)
--
-- KONTEKST:
--   Faza 11 (rewrite generatorów DOCX/PDF, commit c93c95d) oczekuje tych pól
--   w SELECT-cie. Audyt schema 2026-04-25 wykazał że istnieje 5 z 7 wymaganych
--   pól PIIB w `turbines` (są: tower_height_m, hub_height_m, rotor_diameter_m,
--   building_permit_number, building_permit_date). Tej migracji dopełnia braki.
--
-- WYMAGANIA:
--   * Brak żadnych — kolumny nullable, brak danych do mapowania.
--
-- ROLLBACK:
--   ALTER TABLE turbines DROP COLUMN commissioning_year, DROP COLUMN tower_construction_type;
-- =============================================================================

BEGIN;

ALTER TABLE turbines
  ADD COLUMN IF NOT EXISTS commissioning_year INTEGER
    CHECK (commissioning_year IS NULL OR commissioning_year BETWEEN 1980 AND 2099);

ALTER TABLE turbines
  ADD COLUMN IF NOT EXISTS tower_construction_type TEXT
    CHECK (
      tower_construction_type IS NULL
      OR tower_construction_type IN ('stalowa', 'zelbetowa', 'hybrydowa', 'inna')
    );

COMMENT ON COLUMN turbines.commissioning_year IS
  'Rok zakończenia budowy turbiny (PIIB metryczka). Np. 2018.';

COMMENT ON COLUMN turbines.tower_construction_type IS
  'Rodzaj konstrukcji wieży (PIIB metryczka): stalowa / zelbetowa / hybrydowa / inna.';

COMMIT;


-- =============================================================================
-- WERYFIKACJA POMIGRACYJNA
-- =============================================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'turbines'
  AND column_name IN (
    'tower_height_m', 'hub_height_m', 'rotor_diameter_m',
    'building_permit_number', 'building_permit_date',
    'commissioning_year', 'tower_construction_type'
  )
ORDER BY column_name;
-- Oczekiwane: 7 wierszy
