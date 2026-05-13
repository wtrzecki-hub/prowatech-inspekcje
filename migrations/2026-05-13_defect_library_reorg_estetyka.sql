-- Reorganizacja defect_library — element 16 (Estetyka) miał wpisy
-- semantycznie dotyczące konkretnych elementów konstrukcyjnych (fundament,
-- wieża, schody, stacja). To prowadziło do bałaganu w UI: inspektor otwierając
-- „Bibliotekę usterek" w karcie elementu „Estetyka" widział usterki izolacji
-- fundamentu (P22, P34, P41, P66), korozji powłoki wieży (P25), itd.
--
-- Po reorganizacji 12 wpisów trafia do właściwego elementu. Element 16
-- zachowuje tylko stricte estetyczne (P37 ogrodzenie, P38 roślinność,
-- P39 zabrudzenia wieży+fundamentu).
--
-- Bezpieczeństwo: defect_library to TEMPLATE-source — przy wyborze wpisu w
-- karcie elementu kopiuje się tekst (description_template, recommendation_template)
-- do `inspection_elements.notes`/`recommendations`. Reorganizacja element_number
-- NIE rusza tych skopiowanych wartości w istniejących inspekcjach.
--
-- Decyzja Waldka 2026-05-13. Patrz: docs/propozycje-sesji.md temat 8.

-- 1. Fundament — wpisy dotyczące izolacji/ubytków betonu fundamentu
UPDATE defect_library
SET element_number = 1,
    element_section_code = 'fundament',
    element_section = 'Konstrukcja fundamentu turbiny'
WHERE code IN ('P22', 'P34', 'P66');

UPDATE defect_library
SET element_number = 1,
    element_section_code = 'fundament',
    element_section = 'Cokół żelbetowy'
WHERE code = 'P41';

-- 3. Wieża — powłoka malarska + styk kotwy z wieżą
UPDATE defect_library
SET element_number = 3,
    element_section_code = 'wieza',
    element_section = 'Wieża EW'
WHERE code IN ('P25', 'P31');

-- 2. Flansze — ubytki uszczelniającej na łączeniach segmentów wieży
UPDATE defect_library
SET element_number = 2,
    element_section_code = 'flansze',
    element_section = 'Wieża EW'
WHERE code = 'P23';

-- 10. Schody zewnętrzne / drzwi — korozja schodów + drzwi
UPDATE defect_library
SET element_number = 10,
    element_section_code = 'schody_drzwi',
    element_section = 'Schody zewnętrzne'
WHERE code IN ('P26', 'P30');

-- 17. Stacja pomiarowa — dach, tynk stacji
UPDATE defect_library
SET element_number = 17,
    element_section_code = 'stacja_pomiarowa',
    element_section = 'Stacja transformatorowa / pomiarowa'
WHERE code IN ('P36', 'P71', 'P79');

-- Pozostają w 16 Estetyka (3 wpisy):
--   P37 — Korozja słupków ogrodzenia
--   P38 — Porośnięcie terenu wokół elektrowni i stacji
--   P39 — Zabrudzenia powierzchni wieży i fundamentu (mixed, czysta estetyka)
