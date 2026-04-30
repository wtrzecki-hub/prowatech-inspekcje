-- Migracja: dorzucenie wpisow do defect_library dla brakow aktualnych przegladow okresowych
-- Data: 2026-04-30
-- Zgloszenie: inspektor Tomasz Wisniewski (UWAGI program.doc, pkt 6)
--
-- KONTEKST:
-- Tomasz zauwazyl ze w obecnej bibliotece defektow brak wpisow dla sytuacji gdy
-- ELEMENT JEST W STANIE DOBRYM ale przekroczono termin obowiazkowego przegladu
-- okresowego (np. gasnice w dobrym stanie ale przeglad od 2 lat nie zrobiony).
-- Bez takich wpisow inspektor nie ma latwego sposobu odnotowac tej uwagi w
-- protokole.
--
-- WPLYW NA ISTNIEJACE DANE:
--  - 5 nowych wierszy w defect_library z kodami REC-245..REC-249
--  - Bez wplywu na istniejace inspekcje

BEGIN;

INSERT INTO defect_library (code, category, name_pl, recommendation_template, typical_urgency, is_active)
VALUES
  ('REC-245', 'Inne',
   'Wykonać aktualny przegląd okresowy gaśnic (NB)',
   'NB', 'II', true),
  ('REC-246', 'Inne',
   'Wykonać aktualny przegląd okresowy sprzętu asekuracyjnego i pasów bezpieczeństwa (NB)',
   'NB', 'II', true),
  ('REC-247', 'Inne',
   'Wykonać aktualny przegląd okresowy urządzeń ewakuacyjno-ratunkowych (NB)',
   'NB', 'II', true),
  ('REC-248', 'Inne',
   'Przeprowadzić aktualne badania okresowe UDT urządzeń dźwigowych (NB)',
   'NB', 'I', true),
  ('REC-249', 'Inne',
   'Wykonać aktualny przegląd okresowy zgodnie z wymaganiami przepisów (NB)',
   'NB', 'III', true);

-- Sanity check: dokladnie 5 nowych wierszy
DO $$
DECLARE
  inserted_count INT;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM defect_library
  WHERE code IN ('REC-245', 'REC-246', 'REC-247', 'REC-248', 'REC-249')
    AND is_active = true;

  IF inserted_count <> 5 THEN
    RAISE EXCEPTION 'Migracja nie powiodla sie: oczekiwano 5 wierszy, faktycznie %', inserted_count;
  END IF;
END $$;

COMMIT;

-- WERYFIKACJA:
-- SELECT code, name_pl, typical_urgency
-- FROM defect_library
-- WHERE code BETWEEN 'REC-245' AND 'REC-249'
-- ORDER BY code;

-- ROLLBACK:
-- DELETE FROM defect_library WHERE code IN ('REC-245', 'REC-246', 'REC-247', 'REC-248', 'REC-249');
