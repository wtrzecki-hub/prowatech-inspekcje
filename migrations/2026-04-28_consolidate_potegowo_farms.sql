-- ⚠️  CANCELLED 2026-04-28 — ta migracja została wykonana, ale niezwłocznie cofnięta
-- przez `2026-04-28_potegowo_areas.sql` (decyzja o modelu hierarchii zamiast konsolidacji).
-- Plik zostawiony dla audytu historii. Nie uruchamiać ponownie.
--
-- Migracja 2026-04-28: konsolidacja 8 farm POTEGOWO MASHAV → 3 farmy (Wschód / Zachód / Południe)
--
-- Tło: GDrive `04 Inspekcje/2024/POTEGOWO MASHAV.../` ma 3 subfoldery:
--   - Potęgowo wschód  → BĘCINO + GŁUSZYNKO + KARŻCINO + WRZEŚCIE
--   - Potęgowo zachód  → BARTOLINO + PRZYSTAWY + SULECHÓWKO
--   - Potęgowo Południe → 17 turbin EW 01..EW 17 (już mamy w bazie)
--
-- W bazie POTEGOWO MASHAV miało 8 osobnych wind_farms — niezgodne z grupowaniem operatora.
-- Konsolidacja: 7 farm składowych → 2 nowe farmy (Wschód, Zachód). Trzecia (Południe) już jest.
--
-- Idempotentność: skrypt rzuci konflikt unique gdy ponownie INSERT-uje farmy o tych samych nazwach.
-- Patrz `ROLLBACK` na końcu jeśli trzeba cofnąć.

BEGIN;

DO $$
DECLARE
  v_client_id     UUID := '074fc925-2cc4-4c52-b62a-9aabae587b30';  -- POTEGOWO MASHAV Sp. z o.o.
  v_wschod_id     UUID;
  v_zachod_id     UUID;
  v_count_wschod  INTEGER;
  v_count_zachod  INTEGER;
BEGIN
  -- 1. Utworzenie nowych wind_farms
  INSERT INTO wind_farms (client_id, name, notes)
  VALUES (v_client_id, 'FW Potęgowo Wschód',
          'Konsolidacja 2026-04-28: dawne FW Bęcino + FW Głuszynko + FW Karżcino + FW Wrzeście. Atrybuty (capacity / location) do uzupełnienia ręcznie.')
  RETURNING id INTO v_wschod_id;

  INSERT INTO wind_farms (client_id, name, notes)
  VALUES (v_client_id, 'FW Potęgowo Zachód',
          'Konsolidacja 2026-04-28: dawne FW Bartolino + FW Przystawy + FW Sulechówko. Atrybuty (capacity / location) do uzupełnienia ręcznie.')
  RETURNING id INTO v_zachod_id;

  RAISE NOTICE 'Utworzono FW Potęgowo Wschód: %', v_wschod_id;
  RAISE NOTICE 'Utworzono FW Potęgowo Zachód: %', v_zachod_id;

  -- 2. UPDATE turbines — Wschód (4 stare farmy)
  UPDATE turbines SET wind_farm_id = v_wschod_id
  WHERE wind_farm_id IN (
    'fca0c83d-78a3-4474-9c7f-a0b3f54fd7c1',  -- FW Bęcino (5 turbin)
    '3b290a6b-7fff-4cfa-837a-fc658389c7ed',  -- FW Głuszynko (20)
    '7e3cdee6-af3f-47dd-a124-36536e6d314a',  -- FW Karżcino (7)
    'ce4758ae-a7d3-4a8a-84f8-3e7374560f82'   -- FW Wrzeście (6)
  );
  GET DIAGNOSTICS v_count_wschod = ROW_COUNT;
  RAISE NOTICE 'Przeniesiono % turbin do FW Potęgowo Wschód (oczekiwane 38)', v_count_wschod;

  IF v_count_wschod != 38 THEN
    RAISE EXCEPTION 'Mismatch turbin Wschód: oczekiwano 38, jest %', v_count_wschod;
  END IF;

  -- 3. UPDATE turbines — Zachód (3 stare farmy)
  UPDATE turbines SET wind_farm_id = v_zachod_id
  WHERE wind_farm_id IN (
    '26fc0678-5e44-4f7a-b714-52bb70009063',  -- FW Bartolino (7)
    '4bf5b0f7-cbcd-40d6-9b6b-0db19add4d46',  -- FW Przystawy (7)
    'fd065c37-3d4c-474b-b531-7e4f4874f361'   -- FW Sulechówko (29)
  );
  GET DIAGNOSTICS v_count_zachod = ROW_COUNT;
  RAISE NOTICE 'Przeniesiono % turbin do FW Potęgowo Zachód (oczekiwane 43)', v_count_zachod;

  IF v_count_zachod != 43 THEN
    RAISE EXCEPTION 'Mismatch turbin Zachód: oczekiwano 43, jest %', v_count_zachod;
  END IF;

  -- 4. Soft-delete 7 starych farm
  UPDATE wind_farms
  SET is_deleted = true,
      updated_at = NOW(),
      notes = COALESCE(notes || ' | ', '') ||
              CASE
                WHEN name IN ('FW Bęcino', 'FW Głuszynko', 'FW Karżcino', 'FW Wrzeście')
                  THEN 'Skonsolidowana 2026-04-28 → FW Potęgowo Wschód (' || v_wschod_id::text || ')'
                WHEN name IN ('FW Bartolino', 'FW Przystawy', 'FW Sulechówko')
                  THEN 'Skonsolidowana 2026-04-28 → FW Potęgowo Zachód (' || v_zachod_id::text || ')'
                ELSE 'Skonsolidowana 2026-04-28'
              END
  WHERE id IN (
    '26fc0678-5e44-4f7a-b714-52bb70009063',  -- Bartolino
    'fca0c83d-78a3-4474-9c7f-a0b3f54fd7c1',  -- Bęcino
    '3b290a6b-7fff-4cfa-837a-fc658389c7ed',  -- Głuszynko
    '7e3cdee6-af3f-47dd-a124-36536e6d314a',  -- Karżcino
    '4bf5b0f7-cbcd-40d6-9b6b-0db19add4d46',  -- Przystawy
    'fd065c37-3d4c-474b-b531-7e4f4874f361',  -- Sulechówko
    'ce4758ae-a7d3-4a8a-84f8-3e7374560f82'   -- Wrzeście
  );

  RAISE NOTICE 'Soft-delete 7 farm OK';
END $$;

COMMIT;

-- Weryfikacja po migracji (uruchom jako osobne SELECT)
-- SELECT wf.name, COUNT(t.id) AS turbines
-- FROM wind_farms wf
-- LEFT JOIN turbines t ON t.wind_farm_id = wf.id AND t.is_deleted IS NOT TRUE
-- WHERE wf.client_id = '074fc925-2cc4-4c52-b62a-9aabae587b30'
--   AND wf.is_deleted = false
-- GROUP BY wf.id, wf.name
-- ORDER BY wf.name;
-- Oczekiwane: FW Potęgowo Wschód=38, FW Potęgowo Zachód=43, FW Potęgowo Południe=17.

-- ROLLBACK (jeśli trzeba cofnąć):
-- 1. UPDATE wind_farms SET is_deleted = false WHERE id IN (<7 starych ID>);
-- 2. UPDATE turbines SET wind_farm_id = '<oryginalny>' WHERE turbine_code LIKE 'T...' (per farma)
-- 3. DELETE FROM wind_farms WHERE name IN ('FW Potęgowo Wschód', 'FW Potęgowo Zachód') AND created_at::date = '2026-04-28';
