-- Migracja 2026-04-28: rollback konsolidacji + model hierarchii (area_label) dla POTEGOWO MASHAV
--
-- Tło: poprzednia migracja `2026-04-28_consolidate_potegowo_farms.sql` zlikwidowała 7 farm
-- składowych Potęgowo (Bartolino/Bęcino/Głuszynko/Karżcino/Przystawy/Sulechówko/Wrzeście) konsolidując
-- je w 2 nowe farmy (FW Potęgowo Wschód, FW Potęgowo Zachód). Decyzja zmieniona — Waldek
-- woli zachować 7 podfarm i dodać nad nimi etykietę obszaru.
--
-- Plan tej migracji:
--   1. Cofnij konsolidację: przenieś 81 turbin z powrotem do 7 starych farm (po turbine_code numerze),
--      un-soft-delete 7 starych farm, hard-delete 2 nowe farmy (Wschód/Zachód jako odrębne wind_farms).
--   2. Schema: ALTER TABLE wind_farms ADD COLUMN area_label TEXT NULL.
--   3. Wypełnij area_label dla 8 farm POTEGOWO (7 podfarm + Południe).

BEGIN;

DO $$
DECLARE
  v_wschod_id UUID;
  v_zachod_id UUID;
  v_count_back INTEGER;
BEGIN
  -- Pobierz UUID nowo utworzonych farm (Wschód/Zachód) — szukaj po nazwie + client + is_deleted=false
  SELECT id INTO v_wschod_id
  FROM wind_farms
  WHERE name = 'FW Potęgowo Wschód'
    AND client_id = '074fc925-2cc4-4c52-b62a-9aabae587b30'
    AND is_deleted = false;

  SELECT id INTO v_zachod_id
  FROM wind_farms
  WHERE name = 'FW Potęgowo Zachód'
    AND client_id = '074fc925-2cc4-4c52-b62a-9aabae587b30'
    AND is_deleted = false;

  IF v_wschod_id IS NULL OR v_zachod_id IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono FW Potęgowo Wschód/Zachód — czy konsolidacja byla wykonana?';
  END IF;

  -- 1. Reverse-map turbines z 2 nowych farm do 7 oryginalnych po `turbine_code` numerze
  --    Konwencja: `T<NNN>-<location>` → numer N. Mapowanie ranges:
  --      62-66          → Bęcino
  --      67-85, 201     → Głuszynko
  --      86-92          → Karżcino
  --      93-98          → Wrzeście
  --      99-105         → Bartolino
  --      106-112        → Przystawy
  --      113-140, 202   → Sulechówko
  UPDATE turbines SET wind_farm_id =
    CASE
      WHEN regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int BETWEEN 62 AND 66
        THEN 'fca0c83d-78a3-4474-9c7f-a0b3f54fd7c1'::uuid  -- Bęcino
      WHEN regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int BETWEEN 67 AND 85
        OR regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int = 201
        THEN '3b290a6b-7fff-4cfa-837a-fc658389c7ed'::uuid  -- Głuszynko
      WHEN regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int BETWEEN 86 AND 92
        THEN '7e3cdee6-af3f-47dd-a124-36536e6d314a'::uuid  -- Karżcino
      WHEN regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int BETWEEN 93 AND 98
        THEN 'ce4758ae-a7d3-4a8a-84f8-3e7374560f82'::uuid  -- Wrzeście
      WHEN regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int BETWEEN 99 AND 105
        THEN '26fc0678-5e44-4f7a-b714-52bb70009063'::uuid  -- Bartolino
      WHEN regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int BETWEEN 106 AND 112
        THEN '4bf5b0f7-cbcd-40d6-9b6b-0db19add4d46'::uuid  -- Przystawy
      WHEN regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int BETWEEN 113 AND 140
        OR regexp_replace(turbine_code, '^T0*(\d+)-.*$', '\1')::int = 202
        THEN 'fd065c37-3d4c-474b-b531-7e4f4874f361'::uuid  -- Sulechówko
      ELSE wind_farm_id
    END
  WHERE wind_farm_id IN (v_wschod_id, v_zachod_id);

  GET DIAGNOSTICS v_count_back = ROW_COUNT;
  RAISE NOTICE 'Cofnięto % turbin do 7 oryginalnych farm (oczekiwane 81)', v_count_back;

  -- Walidacja
  IF EXISTS (SELECT 1 FROM turbines WHERE wind_farm_id IN (v_wschod_id, v_zachod_id)) THEN
    RAISE EXCEPTION 'Nie wszystkie turbiny zostaly przeniesione z nowych farm — pozostaly orphans';
  END IF;

  -- 2. Un-soft-delete 7 starych farm + odśmieć notatki z konsolidacji
  UPDATE wind_farms
  SET is_deleted = false,
      updated_at = NOW(),
      notes = NULLIF(regexp_replace(
                COALESCE(notes, ''),
                '( \| )?Skonsolidowana 2026-04-28 -> FW Potęgowo (Wschód|Zachód) \([^)]+\)',
                '',
                'g'
              ), '')
  WHERE id IN (
    '26fc0678-5e44-4f7a-b714-52bb70009063',  -- Bartolino
    'fca0c83d-78a3-4474-9c7f-a0b3f54fd7c1',  -- Bęcino
    '3b290a6b-7fff-4cfa-837a-fc658389c7ed',  -- Głuszynko
    '7e3cdee6-af3f-47dd-a124-36536e6d314a',  -- Karżcino
    '4bf5b0f7-cbcd-40d6-9b6b-0db19add4d46',  -- Przystawy
    'fd065c37-3d4c-474b-b531-7e4f4874f361',  -- Sulechówko
    'ce4758ae-a7d3-4a8a-84f8-3e7374560f82'   -- Wrzeście
  );

  -- 3. Hard-delete 2 nowe farmy (Wschód, Zachód) — już bez turbin
  DELETE FROM wind_farms WHERE id IN (v_wschod_id, v_zachod_id);

  RAISE NOTICE 'Cofnięcie konsolidacji OK';
END $$;

-- 4. Schema: dodaj kolumnę area_label
ALTER TABLE wind_farms ADD COLUMN IF NOT EXISTS area_label TEXT NULL;

COMMENT ON COLUMN wind_farms.area_label IS
  'Optional area / region label dla farm które są częścią większego operatora (np. Potegowo: Wschód/Zachód/Południe). UI grupuje farmy klienta po tej kolumnie. NULL = brak grupowania.';

-- 5. Wypełnij area_label dla 8 farm POTEGOWO MASHAV
UPDATE wind_farms SET area_label = 'Wschód' WHERE id IN (
  'fca0c83d-78a3-4474-9c7f-a0b3f54fd7c1',  -- Bęcino
  '3b290a6b-7fff-4cfa-837a-fc658389c7ed',  -- Głuszynko
  '7e3cdee6-af3f-47dd-a124-36536e6d314a',  -- Karżcino
  'ce4758ae-a7d3-4a8a-84f8-3e7374560f82'   -- Wrzeście
);

UPDATE wind_farms SET area_label = 'Zachód' WHERE id IN (
  '26fc0678-5e44-4f7a-b714-52bb70009063',  -- Bartolino
  '4bf5b0f7-cbcd-40d6-9b6b-0db19add4d46',  -- Przystawy
  'fd065c37-3d4c-474b-b531-7e4f4874f361'   -- Sulechówko
);

UPDATE wind_farms SET area_label = 'Południe'
WHERE id = 'c8f4110c-3211-4c03-bbee-1692c52455a9';  -- FW Potęgowo Południe

COMMIT;

-- Weryfikacja po migracji:
-- SELECT name, area_label, COUNT(t.id) AS turbines
-- FROM wind_farms wf
-- LEFT JOIN turbines t ON t.wind_farm_id = wf.id AND t.is_deleted IS NOT TRUE
-- WHERE wf.client_id = '074fc925-2cc4-4c52-b62a-9aabae587b30'
--   AND wf.is_deleted = false
-- GROUP BY wf.id, wf.name, wf.area_label
-- ORDER BY wf.area_label NULLS LAST, wf.name;
-- Oczekiwane:
--   Wschód   FW Bęcino       5
--   Wschód   FW Głuszynko   20
--   Wschód   FW Karżcino     7
--   Wschód   FW Wrzeście     6
--   Zachód   FW Bartolino    7
--   Zachód   FW Przystawy    7
--   Zachód   FW Sulechówko  29
--   Południe FW Potęgowo Południe 17
