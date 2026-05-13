-- Per-turbinowy znacznik posiadania paneli fotowoltaicznych przy stacji
-- pomiarowej. Element 18 ("Panele fotowoltaiczne (instalacja PV przy stacji)",
-- section_code='panele_pv') dotyczy tylko 2 turbin na FW Działoszyn — bez
-- znacznika trafia do wszystkich inspekcji jako wypełniacz z oceną "dobry"
-- (uwaga Waldka 2026-05-13).
--
-- Wzorzec analogiczny do `has_measurement_station`/section_code='stacja_pomiarowa'
-- (patrz seeding w `src/app/(protected)/inspekcje/[id]/page.tsx`).

ALTER TABLE turbines
  ADD COLUMN has_pv_panels BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN turbines.has_pv_panels IS
  'Czy turbina posiada panele fotowoltaiczne przy stacji pomiarowej. Steruje widocznością elementu 18 ("Panele PV") w formularzu inspekcji i w generatorach PDF/DOCX. Domyślnie FALSE — element wprowadzany świadomie na poziomie turbiny.';

-- Aktywuj dla 2 turbin EW Działoszyn:
--   T001-Działoszyn / EW Bella Enterprise (Bella Enterprise Sp. z o.o.)
--   T002-Działoszyn / EW Flower Enterprise (Flower Enterprise Sp. z o.o.)
UPDATE turbines
SET has_pv_panels = TRUE
WHERE id IN (
  'b0d541d7-1046-4dc1-b821-aed57823eb50',
  'fe6d6731-b1a3-4bb8-a964-8564cadd50bd'
);

-- Cleanup istniejących wierszy `inspection_elements` dla pozycji 18 ze
-- wszystkich inspekcji POZA tymi 2 turbinami. Wszystkie 6 wierszy ma
-- condition_rating NULL lub 'dobry' (wypełniacz), bez notes/recommendations
-- i bez powiązanych zdjęć — bez utraty danych.
DELETE FROM inspection_elements ie
USING inspections i
WHERE ie.inspection_id = i.id
  AND ie.element_definition_id = 'f6fd1fff-1457-4123-8ee2-20a82974853d'
  AND i.turbine_id NOT IN (
    'b0d541d7-1046-4dc1-b821-aed57823eb50',
    'fe6d6731-b1a3-4bb8-a964-8564cadd50bd'
  );
