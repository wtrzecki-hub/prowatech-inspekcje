-- Migracja: dostosowanie zakresu kontroli rocznej do art. 62 ust. 1 PB
-- Data: 2026-04-30
-- Zgloszenie: inspektor Tomasz Wisniewski (UWAGI program.doc)
--
-- KONTEKST:
-- Art. 62 ust. 1 ustawy Prawo budowlane rozroznia dwa typy kontroli okresowych:
--  - pkt 1 (kontrola roczna): elementy budynku/obiektu narazone na szkodliwe
--    wplywy atmosferyczne i niszczace dzialania czynnikow wystepujacych podczas
--    uzytkowania
--  - pkt 2 (kontrola 5-letnia): kontrola stanu technicznego i przydatnosci do
--    uzytkowania, w tym kontrola **instalacji elektrycznej i piorunochronnej**
--    w zakresie stanu sprawnosci polaczen, osprzetu, zabezpieczen i srodkow
--    ochrony od porazen, opornosci izolacji przewodow oraz uziemien instalacji
--    i aparatow
--
-- Dotychczasowy stan w bazie:
--  - element 11 (Instalacja odgromowa i uziemieniowa - LPS): applies_to_annual=true
--  - element 12 (Instalacja elektryczna SN/nN): applies_to_annual=true
--  Niezgodne z PB art. 62 - to sa elementy 5-letnie, nie roczne.
--
-- Element 16 (Estetyka obiektu) juz jest poprawnie applies_to_annual=false.
--
-- ZMIANA:
--  Elementy 11 i 12 zostana wylaczone z zakresu rocznej kontroli (applies_to_annual=false).
--  W kontroli 5-letniej pozostaja widoczne (applies_to_five_year=true bez zmian).
--
-- WPLYW NA ISTNIEJACE DANE:
--  - inspection_element_definitions: 2 wiersze UPDATE
--  - inspection_elements (juz utworzone): bez zmian, historyczne dane zachowane
--  - Nowe inspekcje roczne nie beda mialy elementow 11 i 12 w liscie do oceny

BEGIN;

UPDATE inspection_element_definitions
SET applies_to_annual = false
WHERE element_number IN (11, 12)
  AND is_active = true;

-- Sanity check: dokladnie 2 wiersze powinny zostac zaktualizowane
DO $$
DECLARE
  affected_count INT;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM inspection_element_definitions
  WHERE element_number IN (11, 12)
    AND is_active = true
    AND applies_to_annual = false;

  IF affected_count <> 2 THEN
    RAISE EXCEPTION 'Migracja nie powiodla sie: oczekiwano 2 wierszy, faktycznie zaktualizowano %', affected_count;
  END IF;
END $$;

COMMIT;

-- WERYFIKACJA (uruchom po migracji):
-- SELECT element_number, name_pl, applies_to_annual, applies_to_five_year
-- FROM inspection_element_definitions
-- WHERE is_active = true
-- ORDER BY element_number;
--
-- Oczekiwany wynik:
--  - elementy 1-10, 13-15: applies_to_annual=true, applies_to_five_year=true
--  - element 11 (LPS): applies_to_annual=FALSE, applies_to_five_year=true
--  - element 12 (Inst. elektryczna): applies_to_annual=FALSE, applies_to_five_year=true
--  - element 16 (Estetyka): applies_to_annual=false, applies_to_five_year=true (bez zmian)

-- ROLLBACK (gdyby trzeba bylo cofnac):
-- BEGIN;
-- UPDATE inspection_element_definitions
-- SET applies_to_annual = true
-- WHERE element_number IN (11, 12) AND is_active = true;
-- COMMIT;
