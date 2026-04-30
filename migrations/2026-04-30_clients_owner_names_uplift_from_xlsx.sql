-- 2026-04-30: Uplift nazw spolek wlascicieli FW z xlsx (Zestawienie 2026)
-- 4 zmiany potwierdzone przez Artura/Tomka:
--   1) Eurowind Polska III: dopisanie "Sp. z o.o." (xlsx ma pelna nazwe)
--   2) Eurowind PolskaVI: poprawa "PolskaVI" -> "Polska VI Sp. z o.o."
--   3) EW Bieganowo: zmiana wlasciciela PRASMET -> EW GRADOWO Sp. z o.o.
--   4) Farma "FW Brzezno" (WS Wind Park VI, T149-Bronislaw) -> "FW Bronislaw"
--      (druga "FW Brzezno" Trasko Energia z T162-Brzezno zostaje)

BEGIN;

-- === STAN PRZED ===
SELECT 'before' AS phase,
  (SELECT name FROM clients WHERE id = '6835f2d6-dce6-4d34-810f-4d62422905f4') AS eurowind_iii,
  (SELECT name FROM clients WHERE id = 'dcd543b4-4040-4883-b919-ec9895fd2648') AS eurowind_vi,
  (SELECT c.name FROM wind_farms wf JOIN clients c ON c.id = wf.client_id
   WHERE wf.id = 'e8799280-4a42-4333-b4a1-ee00047ea35e') AS bieganowo_klient,
  (SELECT name FROM wind_farms WHERE id = '3a8c9252-ac60-46f2-a4a1-a2fec753f39b') AS farma_t149;

-- === ZMIANY ===

-- 1) Eurowind Polska III + Sp. z o.o.
UPDATE clients
SET name = 'Eurowind Polska III Sp. z o.o.', updated_at = NOW()
WHERE id = '6835f2d6-dce6-4d34-810f-4d62422905f4'
  AND name = 'Eurowind Polska III';

-- 2) Eurowind PolskaVI -> Polska VI Sp. z o.o. (spacja + sufiks)
UPDATE clients
SET name = 'Eurowind Polska VI Sp. z o.o.', updated_at = NOW()
WHERE id = 'dcd543b4-4040-4883-b919-ec9895fd2648'
  AND name = 'Eurowind PolskaVI';

-- 3) EW Bieganowo: PRASMET -> EW GRADOWO Sp. z o.o.
UPDATE wind_farms
SET client_id = '16a1af2f-165d-4140-a2b0-7608490667ff', updated_at = NOW()
WHERE id = 'e8799280-4a42-4333-b4a1-ee00047ea35e'
  AND client_id = 'a3e05f4d-55b3-43f7-b31e-a3669b374c8b';

-- 4) FW Brzezno (WS Wind Park VI) -> FW Bronislaw
UPDATE wind_farms
SET name = 'FW Bronisław', updated_at = NOW()
WHERE id = '3a8c9252-ac60-46f2-a4a1-a2fec753f39b'
  AND name = 'FW Brzeźno'
  AND client_id = '5f980003-f4a6-4803-8f1e-141709d57d53'; -- WS Wind Park VI

-- === STAN PO ===
SELECT 'after' AS phase,
  (SELECT name FROM clients WHERE id = '6835f2d6-dce6-4d34-810f-4d62422905f4') AS eurowind_iii,
  (SELECT name FROM clients WHERE id = 'dcd543b4-4040-4883-b919-ec9895fd2648') AS eurowind_vi,
  (SELECT c.name FROM wind_farms wf JOIN clients c ON c.id = wf.client_id
   WHERE wf.id = 'e8799280-4a42-4333-b4a1-ee00047ea35e') AS bieganowo_klient,
  (SELECT name FROM wind_farms WHERE id = '3a8c9252-ac60-46f2-a4a1-a2fec753f39b') AS farma_t149;

COMMIT;

-- ============================================================
-- ROLLBACK (do uzycia recznie w razie problemow):
-- BEGIN;
-- UPDATE clients SET name = 'Eurowind Polska III' WHERE id = '6835f2d6-dce6-4d34-810f-4d62422905f4';
-- UPDATE clients SET name = 'Eurowind PolskaVI' WHERE id = 'dcd543b4-4040-4883-b919-ec9895fd2648';
-- UPDATE wind_farms SET client_id = 'a3e05f4d-55b3-43f7-b31e-a3669b374c8b' WHERE id = 'e8799280-4a42-4333-b4a1-ee00047ea35e';
-- UPDATE wind_farms SET name = 'FW Brzeźno' WHERE id = '3a8c9252-ac60-46f2-a4a1-a2fec753f39b';
-- COMMIT;
