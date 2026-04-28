-- Migracja 2026-04-28: korekta ew_designation dla 2 farm POTEGOWO MASHAV
--
-- Tło: po wgraniu archiwum 2024 Waldek zauważył błędne oznaczenia operatora:
--   FW Bęcino    — turbiny T063-T066 miały format "EW-NN" zamiast "WTG BNN"
--                  + T062 miało "WTG B-07" (myślnik) zamiast "WTG B07"
--   FW Głuszynko — wszystkie 20 turbin miały "WTG GG-NN" (podwójne G + myślnik)
--                  zamiast "WTG GNN"
--
-- Mapowanie (verified SQL):
--   FW Bęcino:
--     T062-Bęcino     WTG B-07 → WTG B07
--     T063-Karżniczka EW-12    → WTG B12
--     T064-Karżniczka EW-13    → WTG B13
--     T065-Karżniczka EW-11    → WTG B11
--     T066-Bęcino     EW-10    → WTG B10
--   FW Głuszynko (20 turbin):
--     WTG GG-NN → WTG GNN  (REPLACE 'WTG GG-' → 'WTG G')

BEGIN;

-- 1. FW Bęcino — eksplicitny mapping per turbina
UPDATE turbines SET ew_designation =
  CASE turbine_code
    WHEN 'T062-Bęcino'      THEN 'WTG B07'
    WHEN 'T063-Karżniczka'  THEN 'WTG B12'
    WHEN 'T064-Karżniczka'  THEN 'WTG B13'
    WHEN 'T065-Karżniczka'  THEN 'WTG B11'
    WHEN 'T066-Bęcino'      THEN 'WTG B10'
    ELSE ew_designation
  END
WHERE wind_farm_id = 'fca0c83d-78a3-4474-9c7f-a0b3f54fd7c1';  -- FW Bęcino

-- 2. FW Głuszynko — masowy REPLACE dla wszystkich 20 turbin
UPDATE turbines
SET ew_designation = REPLACE(ew_designation, 'WTG GG-', 'WTG G')
WHERE wind_farm_id = '3b290a6b-7fff-4cfa-837a-fc658389c7ed'  -- FW Głuszynko
  AND ew_designation LIKE 'WTG GG-%';

COMMIT;

-- Weryfikacja:
-- SELECT wf.name, t.turbine_code, t.ew_designation
-- FROM turbines t JOIN wind_farms wf ON wf.id = t.wind_farm_id
-- WHERE wf.name IN ('FW Bęcino', 'FW Głuszynko')
-- ORDER BY wf.name, t.turbine_code;
-- Oczekiwane:
--   FW Bęcino: WTG B07, WTG B12, WTG B13, WTG B11, WTG B10
--   FW Głuszynko: WTG G01..WTG G22 (z dziurami 9, 14)
