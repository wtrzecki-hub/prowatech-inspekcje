-- Wariant inspekcji rocznej: rozszerzony (z wjazdem na konstrukcję) vs
-- uproszczony (kontrola tylko z poziomu terenu + parteru wieży).
--
-- Bazuje na 2 manualnych szablonach Worda z `wzory_PIIB/`:
--   Protokol_Kontroli_Rocznej_EW_PIIB_R.docx — rocznik rozszerzony (z wjazdem)
--   Protokol_Kontroli_Rocznej_EW_PIIB_U.docx — rocznik uproszczony (bez wjazdu)
--
-- Analiza obu szablonów (2026-05-13): lista pozycji do oceny identyczna,
-- różnią się TYLKO bullet pointy w sekcji „Zakres roczny (oględziny)" dla
-- 8 z 13 DB-elementów. Wariant uproszczony pasuje do obiektów objętych pełną
-- umową serwisową producenta — czynności wymagające wjazdu robi serwis.

-- 1) Znacznik wariantu na inspekcji
ALTER TABLE inspections
  ADD COLUMN annual_variant TEXT NOT NULL DEFAULT 'extended'
  CHECK (annual_variant IN ('extended', 'simplified'));

COMMENT ON COLUMN inspections.annual_variant IS
  'Wariant rocznej inspekcji: extended (rozszerzony, z wjazdem na konstrukcję — domyślny) lub simplified (uproszczony, kontrola z poziomu terenu + parteru wieży; reszta przez serwis producenta). Stosowany TYLKO dla inspection_type=annual; ignorowany dla five_year.';

-- 2) Tekst „Zakres roczny" dla wariantu uproszczonego per DB-element
ALTER TABLE inspection_element_definitions
  ADD COLUMN scope_annual_simplified TEXT NULL;

COMMENT ON COLUMN inspection_element_definitions.scope_annual_simplified IS
  'Zakres roczny (oględziny) w wariancie uproszczonym (bez wjazdu na konstrukcję). NULL = wariant nie różni się od scope_annual — generator powraca do scope_annual. Wypełnione TYLKO dla 8 elementów, w których R vs U się różnią (3, 4, 6, 8, 9, 11, 13, 14).';

-- 3) Wypełnienie scope_annual_simplified dla 8 elementów z różnicami
--    (Pozycje do oceny zostają identyczne — generator złoży je z scope_annual
--     + zamieni TYLKO bullety „Zakres roczny" na te z _simplified)

-- Element 3 — Wieża (konstrukcja stalowa / żelbetowa / hybrydowa)
UPDATE inspection_element_definitions
SET scope_annual_simplified = E'Pozycje do oceny:\n• Powłoki antykorozyjne – zarysowania, ubytki, łuszczenie\n• Korozja blach / spoin – ogniska rdzy, wżery\n• Stan wewnętrzny wieży (oświetlenie, wentylacja, drabiny)\n• Wpust kablowy (uszczelnienie, brak wilgoci)\n\nPołączenia kołnierzowe segmentów wieży (flansze):\n• Oznaczenia kontrolne (markery momentu dokręcenia)\n• Stan zabezpieczenia antykorozyjnego śrub i nakrętek\n• Wyciek smaru/oleju wokół flansz\n• Brak luzów, drgań, zarysowań stykających się płaszczyzn\n\nZakres roczny — wariant uproszczony (bez wjazdu na konstrukcję):\n• Wizualna kontrola zewnętrzna z poziomu terenu (lornetka, kilka punktów obserwacyjnych dookoła turbiny)\n• Ocena wewnętrzna pierwszego segmentu wieży (parter — drabina dolna, oświetlenie, wpust kablowy, uszczelnienia, wnęki)\n• Wizualna ocena flanszy dolnej fundament–segment 1 (z poziomu terenu)\n• Wizualna kontrola flanszy w obrębie pierwszego segmentu wieży (od wewnątrz, z parteru)\n• Ocena stanu powłok antykorozyjnych w dostępnym zakresie'
WHERE element_number = 3 AND section_code = 'wieza' AND is_active = TRUE;

-- Element 4 — Gondola + Połączenie z wieżą (yaw) + Połączenie z wirnikiem (piasta)
UPDATE inspection_element_definitions
SET scope_annual_simplified = E'Pozycje do oceny:\n• Stan obudowy GRP / kompozyt – pęknięcia, nieszczelności\n• Stan ramy nośnej (bedplate) – korozja, mocowania\n• Wyposażenie BHP wewnątrz gondoli\n• Klimatyzacja / wentylacja / oświetlenie\n\nPołączenie z wieżą (łożysko wieńcowe azymutu):\n• Stan łożyska wieńcowego (yaw bearing) i smarowania\n• Stan napędów azymutu (yaw drives)\n• Połączenia śrubowe flansza wieża–łożysko (oznaczenia, korozja)\n\nPołączenie z wirnikiem (piasta, łożysko główne, system pitch):\n• Połączenia śrubowe piasta–wał główny\n• Stan łożyska głównego wału (temperatura, drgania, dźwięk, wycieki)\n• Smarowanie i uszczelnienia\n• Stan połączenia piasta–łopaty\n\nZakres roczny — wariant uproszczony (bez wjazdu na konstrukcję):\n• Ocena wizualna gondoli z poziomu terenu (lornetka; w miarę możliwości obrót gondoli o 360° dla pełnego oglądu)\n• Brak widocznych wycieków, zacieków na zewnętrznej obudowie gondoli / pod gondolą\n• Nasłuch podczas obrotu gondoli (yaw test) — brak nietypowych dźwięków, drgań przekazywanych na konstrukcję\n• Analiza alarmów ze SCADA dot. systemu yaw (jeżeli udostępniono)\n• Analiza wskazań temperatury i drgań ze SCADA dla piasty / łożyska głównego (jeżeli udostępniono)'
WHERE element_number = 4 AND section_code = 'gondola' AND is_active = TRUE;

-- Element 6 — Wirnik / rotor z łopatami
UPDATE inspection_element_definitions
SET scope_annual_simplified = E'Pozycje do oceny:\n• Powierzchnia łopat – pęknięcia, delaminacja, erozja krawędzi natarcia\n• Receptory odgromowe na łopatach (ciągłość, mocowanie)\n• System pitch – łożyska łopat, kable\n• Stan wyważenia – wibracje (z systemu SCADA)\n\nZakres roczny — wariant uproszczony (bez wjazdu na konstrukcję):\n• Ocena wizualna wirnika i łopat z poziomu terenu (lornetka)\n• Wizualna ocena receptorów odgromowych z dołu w dostępnym zakresie\n• Analiza alarmów i ostrzeżeń ze SCADA dot. wirnika i pitch (jeżeli udostępniono)'
WHERE element_number = 6 AND section_code = 'wirnik_lopaty' AND is_active = TRUE;

-- Element 8 — Podesty, platformy, drabiny i komunikacja wewnętrzna
UPDATE inspection_element_definitions
SET scope_annual_simplified = E'Pozycje do oceny:\n• Podesty stałe – nośność, korozja, mocowania\n• Drabiny wewnątrz wieży\n• System asekuracji wzdłuż drabiny (rail / wire)\n• Oświetlenie ewakuacyjne\n\nZakres roczny — wariant uproszczony (bez wjazdu na konstrukcję):\n• Stan techniczny podestu wejściowego (parter wieży) — oględziny, mocowania, korozja\n• Stan dolnej części drabiny i jej mocowań do segmentu 1\n• Sprawdzenie sprawności oświetlenia awaryjnego w pierwszym segmencie'
WHERE element_number = 8 AND section_code = 'podesty_drabiny' AND is_active = TRUE;

-- Element 9 — Urządzenia ewakuacyjno-ratunkowe
UPDATE inspection_element_definitions
SET scope_annual_simplified = E'Pozycje do oceny:\n• Zestaw ewakuacyjny (np. PSA AG 10K) – stan, ważność\n• Apteczka pierwszej pomocy\n• Sprzęt do udzielania pierwszej pomocy / AED\n• Plan ewakuacji – widoczność, aktualność\n\nZakres roczny — wariant uproszczony (bez wjazdu na konstrukcję):\n• Kontrola sprzętu ewakuacyjno-ratunkowego znajdującego się na poziomie terenu / pierwszego segmentu (kompletność, daty ważności)\n• Apteczka pierwszej pomocy — stan, kompletność\n• Sprawdzenie aktualności planu ewakuacji'
WHERE element_number = 9 AND section_code = 'ewakuacja' AND is_active = TRUE;

-- Element 11 — Instalacja odgromowa / uziemiająca / połączenia wyrównawcze (LPS)
UPDATE inspection_element_definitions
SET scope_annual_simplified = E'Pozycje do oceny:\n• Zwody, przewody odprowadzające, receptory odgromowe\n• Złącza kontrolne, połączenia wyrównawcze\n• Uziemienie fundamentowe / dodatkowe\n• Ograniczniki przepięć (SPD)\n\nZakres roczny — wariant uproszczony (bez wjazdu na konstrukcję):\n• Wizualna kontrola dolnych elementów instalacji odgromowej (uziomy widoczne, złącza kontrolne na fundamencie / segmencie 1)\n• Sprawdzenie integralności złącz kontrolnych w dostępnym zakresie\n• Oględziny wskaźników stanu SPD na rozdzielnicy parteru'
WHERE element_number = 11 AND section_code = 'lps' AND is_active = TRUE;

-- Element 13 — Wyposażenie BHP i ochrony przeciwpożarowej
UPDATE inspection_element_definitions
SET scope_annual_simplified = E'Pozycje do oceny:\n• Gaśnice (CO₂, proszkowe) – ważność przeglądów\n• Czujki dymowe / system detekcji pożaru\n• Oznakowanie ewakuacyjne\n• Środki ochrony osobistej w wieży\n\nZakres roczny — wariant uproszczony (bez wjazdu na konstrukcję):\n• Termin ważności przeglądów gaśnic na parterze i w stacji rozdzielczej\n• Sprawdzenie sprawności czujek dymowych (jeżeli zainstalowane na parterze)\n• Oględziny oznakowania ewakuacyjnego dolnej części wieży'
WHERE element_number = 13 AND section_code = 'bhp_ppoz' AND is_active = TRUE;

-- Element 14 — Urządzenia podlegające UDT
UPDATE inspection_element_definitions
SET scope_annual_simplified = E'Pozycje do oceny:\n• Podest ruchomy (np. GLOBE) – aktualność badań\n• Wciągarki / żurawiki w gondoli\n• Urządzenia ciśnieniowe (jeżeli są)\n• Suwnice / wózki transportowe\n\nZakres roczny — wariant uproszczony (bez wjazdu na konstrukcję):\n• Aktualność badań UDT i protokołów odbiorów dostępnych urządzeń\n• Stan techniczny tabliczek znamionowych i znaków UDT (urządzenia dostępne z poziomu terenu / parteru)\n• Aktualność dokumentacji'
WHERE element_number = 14 AND section_code = 'udt' AND is_active = TRUE;

-- Elementy bez różnicy R vs U (zostają NULL, generator powraca do scope_annual):
--   1 (Fundament) — kontrola z poziomu terenu w obu wariantach
--   10 (Schody zewnętrzne, drzwi zewnętrzne) — dostępne z poziomu terenu
--   15 (Dojazdy, plac manewrowy) — z definicji z poziomu terenu
--   17 (Stacja kontenerowa pomiarowa) — aplikacja, nie w szablonie Worda
--   18 (Panele PV) — aplikacja, nie w szablonie Worda
