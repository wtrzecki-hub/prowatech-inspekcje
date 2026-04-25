-- =============================================================================
-- MIGRATION: PIIB element definitions re-seed (2026-04-25) — V2 NAPRAWCZA
-- Project:   lhxhsprqoecepojrxepf
--
-- KONTEKST V2:
--   V1 zalozyla ze section_code mozna zrobic UNIQUE — w istniejacym seedzie
--   sa juz wiersze z duplikatami (np. 'A'), wiec ALTER TABLE ADD CONSTRAINT
--   sie wywalil z bledem 23505.
--
-- STRATEGIA V2:
--   1. Wyczysc niedoszly constraint (jesli powstal) i niedoszle nowe wiersze
--      (tych z section_code 'fundament', 'flansze', etc.) - jesli juz powstaly.
--   2. Dezaktywuj wszystkie obecne wiersze (is_active = FALSE).
--      Zachowuje referencje z inspection_elements.element_definition_id —
--      stare inspekcje nadal pokazuja nazwy elementow.
--   3. Stworz CZESCIOWY UNIQUE INDEX tylko na is_active=TRUE — pozwala na
--      duplikaty section_code w starych dezaktywowanych wierszach.
--   4. Wstaw 16 nowych elementow PIIB z is_active=TRUE.
-- =============================================================================

BEGIN;


-- ----------------------------------------------------------------------------
-- 0a. Cleanup: usun niedoszly UNIQUE constraint (jesli istnieje)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inspection_element_definitions_section_code_key'
  ) THEN
    ALTER TABLE inspection_element_definitions
      DROP CONSTRAINT inspection_element_definitions_section_code_key;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 0b. Cleanup: usun ewentualne niedoszle nowe wiersze (jesli V1 zdazyla
--     wstawic czesc przed bledem)
-- ----------------------------------------------------------------------------

DELETE FROM inspection_element_definitions
WHERE section_code IN (
  'fundament', 'flansze', 'wieza', 'gondola', 'lozysko_azymutu',
  'wirnik_lopaty', 'piasta_lozysko_glowne', 'podesty_drabiny', 'ewakuacja',
  'schody_drzwi', 'lps', 'instalacja_elektryczna', 'bhp_ppoz', 'udt',
  'dojazdy_plac', 'estetyka'
)
AND id NOT IN (
  SELECT element_definition_id FROM inspection_elements WHERE element_definition_id IS NOT NULL
);
-- Bezpiecznik: usuwa tylko te ktore NIE sa juz uzywane przez inspection_elements


-- ----------------------------------------------------------------------------
-- 1. Dezaktywuj wszystkie obecne wiersze
-- ----------------------------------------------------------------------------

UPDATE inspection_element_definitions
SET is_active = FALSE
WHERE is_active = TRUE;


-- ----------------------------------------------------------------------------
-- 2. Czesciowy UNIQUE INDEX — tylko na is_active=TRUE
-- ----------------------------------------------------------------------------

DROP INDEX IF EXISTS uniq_active_section_code;

CREATE UNIQUE INDEX uniq_active_section_code
  ON inspection_element_definitions (section_code)
  WHERE is_active = TRUE;


COMMIT;


-- =============================================================================
-- 3. Wstaw 16 nowych elementow PIIB
-- =============================================================================

BEGIN;


-- Element 1: FUNDAMENT
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('fundament', 1,
   'Fundament i posadowienie',
   'Fundament',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Stan betonu fundamentu (rysy, spękania, wykwity, korozja zbrojenia)\n• Stan styku fundament–wieża (uszczelnienie, brak zalewania wodą)\n• Stan kotew fundamentowych i nakrętek\n• Odwodnienie wokół fundamentu, brak zastoisk wody\n\nZakres roczny (oględziny):\n• Ocena wizualna stanu fundamentu (bez odkrywek)\n• Pomiar/oględziny szerokości rys\n• Sprawdzenie zabezpieczenia antykorozyjnego kotew widocznych\n• Sprawdzenie szczelności styku fundament–segment 0 wieży',
   E'Zakres DODATKOWY 5-letni:\n• Badania nieniszczące betonu (wg potrzeb): młotek Schmidta / pomiar otulenia / georadar\n• Pomiar osiadania fundamentu (reper geodezyjny – jeżeli jest)\n• Ocena stanu izolacji przeciwwilgociowej (oględziny / odkrywki kontrolne)\n• Pełna ocena stanu technicznego i przydatności do użytkowania',
   E'• art. 62 ust. 1 pkt 1 lit. a i pkt 2 PB\n• PN-EN 1992 (Eurokod 2) – konstrukcje betonowe\n• PN-EN 1997 (Eurokod 7) – geotechnika\n• Wytyczne producenta turbiny',
   1, TRUE);


-- Element 2: FLANSZE
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('flansze', 2,
   'Połączenia śrubowe – segmenty wieży (flansze)',
   'Flansze',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Oznaczenia kontrolne (markery momentu dokręcenia)\n• Stan zabezpieczenia antykorozyjnego śrub i nakrętek\n• Wyciek smaru/oleju wokół flansz\n• Brak luzów, drgań, zarysowań stykających się płaszczyzn\n\nZakres roczny (oględziny):\n• Wizualna kontrola połączeń kołnierzowych (flanszowych)\n• Sprawdzenie kompletności i ciągłości oznaczeń kontrolnych\n• Ocena stanu powłok antykorozyjnych w obszarze połączenia',
   E'Zakres DODATKOWY 5-letni:\n• Pełna kontrola momentów dokręcenia (100% połączeń lub statystycznie wg producenta)\n• Wymiana / kontrola śrub o znamionach pęknięć / korozji wżerowej\n• Badania NDT spawów flansz (UT/MT) – wg wytycznych producenta',
   E'• PN-EN 1090-2 – konstrukcje stalowe (klasa EXC3/EXC4)\n• PN-EN 14399 – zestawy śrubowe sprężane\n• PN-EN 1993 (Eurokod 3) – konstrukcje stalowe\n• Instrukcja serwisowa producenta turbiny',
   2, TRUE);


-- Element 3: WIEŻA
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('wieza', 3,
   'Wieża (konstrukcja stalowa / żelbetowa / hybrydowa)',
   'Wieża',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Powłoki antykorozyjne – zarysowania, ubytki, łuszczenie\n• Korozja blach / spoin – ogniska rdzy, wżery\n• Stan wewnętrzny wieży (oświetlenie, wentylacja, drabiny)\n• Wpust kablowy (uszczelnienie, brak wilgoci)\n\nZakres roczny (oględziny):\n• Wizualna kontrola zewnętrzna (z dołu / lornetka / dron) i wewnętrzna wieży\n• Sprawdzenie szczelności wpustów kablowych\n• Ocena stanu drabin wewnętrznych i mocowań',
   E'Zakres DODATKOWY 5-letni:\n• Badania nieniszczące spawów (UT, MT) w razie potrzeby\n• Pełna kontrola powłok antykorozyjnych (grubość – pomiar grubościomierzem)\n• Kompleksowa ocena stanu i przydatności do użytkowania',
   E'• art. 62 ust. 1 pkt 1 lit. a i pkt 2 PB\n• PN-EN 1993 (Eurokod 3)\n• PN-EN ISO 12944 – ochrona powłokami malarskimi\n• PN-EN 50308 – eksploatacja i utrzymanie ruchu',
   3, TRUE);


-- Element 4: GONDOLA
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('gondola', 4,
   'Gondola (nacela) – obudowa i konstrukcja nośna',
   'Gondola',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Stan obudowy GRP / kompozyt – pęknięcia, nieszczelności\n• Stan ramy nośnej (bedplate) – korozja, mocowania\n• Wyposażenie BHP wewnątrz gondoli\n• Klimatyzacja / wentylacja / oświetlenie\n\nZakres roczny (oględziny):\n• Ocena wizualna gondoli (obrót 360°, zewnątrz i wewnątrz)\n• Sprawdzenie szczelności pokryw, włazów, uszczelek\n• Sprawdzenie kompletności wyposażenia BHP',
   E'Zakres DODATKOWY 5-letni:\n• Kompleksowa ocena stanu technicznego konstrukcji gondoli\n• Ocena spoin nośnej ramy (NDT wg potrzeb)\n• Ocena instalacji wewnątrz gondoli (oświetlenie, gniazda, wentylacja)',
   E'• art. 62 ust. 1 pkt 1 lit. a i pkt 2 PB\n• PN-EN 50308 – eksploatacja i utrzymanie ruchu\n• PN-EN IEC 61400-1 – wymagania projektowe\n• Wytyczne producenta turbiny',
   4, TRUE);


-- Element 5: ŁOŻYSKO AZYMUTU
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('lozysko_azymutu', 5,
   'Połączenie wieża–gondola (łożysko wieńcowe azymutu)',
   'Łożysko azymutu',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Stan łożyska wieńcowego (yaw bearing)\n• Stan smarowania – brak nadmiernych wycieków\n• Stan napędów azymutu (yaw drives)\n• Połączenia śrubowe flansza wieża–łożysko\n\nZakres roczny (oględziny):\n• Kontrola połączeń śrubowych flanszy wieża–łożysko wieńcowe (oznaczenia, korozja)\n• Oględziny stanu napędów azymutu i smarowania\n• Sprawdzenie kompletności i stanu zabezpieczeń przed obrotem',
   E'Zakres DODATKOWY 5-letni:\n• Pełna kontrola momentów dokręcenia wszystkich śrub w połączeniu\n• Pomiar luzu łożyska wieńcowego (wg instrukcji producenta)\n• Ocena stanu uzębienia wieńca, hamulców azymutu',
   E'• PN-EN 1090-2 – połączenia sprężane\n• PN-EN 14399 – zestawy śrubowe sprężane\n• PN-EN IEC 61400-4 – łożyska i przekładnie turbiny\n• Instrukcja serwisowa producenta turbiny',
   5, TRUE);


-- Element 6: WIRNIK / ŁOPATY
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('wirnik_lopaty', 6,
   'Wirnik / rotor z łopatami',
   'Wirnik / łopaty',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Powierzchnia łopat – pęknięcia, delaminacja, erozja krawędzi natarcia\n• Receptory odgromowe na łopatach (ciągłość, mocowanie)\n• System pitch – łożyska łopat, kable\n• Stan wyważenia – wibracje (z systemu SCADA)\n\nZakres roczny (oględziny):\n• Ocena wizualna wirnika i łopat (z dołu / lornetka / dron)\n• Oględziny receptorów odgromowych na łopatach\n• Analiza alarmów i ostrzeżeń ze SCADA z ostatnich 12 miesięcy',
   E'Zakres DODATKOWY 5-letni:\n• Szczegółowa inspekcja łopat (z bliska – drony, kamery, dostęp linowy)\n• Pomiar ciągłości obwodu odgromowego łopat\n• Pełna kontrola momentów dokręcenia połączeń łopata–piasta\n• Ocena stanu systemu pitch (łożyska, napędy, akumulatory awaryjne)',
   E'• art. 8b ustawy z 20.05.2016 r. o inwestycjach w zakresie elektrowni wiatrowych\n• PN-EN IEC 61400-1 – wymagania projektowe\n• PN-EN IEC 61400-23 – pełne badanie strukturalne łopat\n• PN-EN 62305-3 – ochrona odgromowa łopat',
   6, TRUE);


-- Element 7: PIASTA / ŁOŻYSKO GŁÓWNE
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('piasta_lozysko_glowne', 7,
   'Połączenie gondola–wirnik (piasta, łożysko główne, system pitch)',
   'Piasta / łożysko główne',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Połączenia śrubowe piasta–wał główny\n• Stan łożyska głównego wału – temperatura, drgania\n• Smarowanie i wycieki\n• Stan połączenia piasta–łopaty\n\nZakres roczny (oględziny):\n• Wizualna kontrola połączeń śrubowych piasta–wał\n• Oględziny łożyska głównego (wycieki, dźwięk, drgania)\n• Analiza wskazań temperatury i drgań ze SCADA',
   E'Zakres DODATKOWY 5-letni:\n• Pełna kontrola momentów dokręcenia wszystkich połączeń śrubowych\n• Diagnostyka wibracyjna łożyska głównego\n• Ocena stanu uszczelnień, smarowania centralnego',
   E'• PN-EN 1090-2 – połączenia sprężane\n• PN-EN 14399 – zestawy śrubowe sprężane\n• PN-EN IEC 61400-4 – łożyska i przekładnie\n• Instrukcja serwisowa producenta turbiny',
   7, TRUE);


-- Element 8: PODESTY / DRABINY
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('podesty_drabiny', 8,
   'Podesty, platformy, drabiny i komunikacja wewnętrzna',
   'Podesty / drabiny',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Podesty stałe – nośność, korozja, mocowania\n• Drabiny wewnątrz wieży\n• System asekuracji wzdłuż drabiny (rail / wire)\n• Oświetlenie ewakuacyjne\n\nZakres roczny (oględziny):\n• Stan techniczny podestów stałych (oględziny)\n• Stan drabin wewnętrznych i ich mocowań\n• Sprawdzenie sprawności oświetlenia awaryjnego',
   E'Zakres DODATKOWY 5-letni:\n• Kompleksowa ocena nośności i przydatności podestów\n• Badanie nośności / mocowań kotwiczeń (próbkowo)\n• Pełen przegląd systemu asekuracji wzdłuż drabiny',
   E'• PN-EN 50308 – zabezpieczenia, eksploatacja\n• PN-EN ISO 14122 – stałe środki dostępu do maszyn\n• PN-EN 353-1 – urządzenia samohamowne (rail)\n• Wytyczne producenta',
   8, TRUE);


-- Element 9: EWAKUACJA
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('ewakuacja', 9,
   'Urządzenia ewakuacyjno-ratunkowe',
   'Ewakuacja / ratownictwo',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Zestaw ewakuacyjny (np. PSA AG 10K) – stan, ważność\n• Apteczka pierwszej pomocy\n• Sprzęt do udzielania pierwszej pomocy / AED\n• Plan ewakuacji – widoczność, aktualność\n\nZakres roczny (oględziny):\n• Kontrola urządzeń ewakuacyjno-ratunkowych (kompletność, daty ważności)\n• Sprawdzenie stanu apteczki i sprzętu pierwszej pomocy\n• Sprawdzenie czytelności i aktualności planu ewakuacji',
   E'Zakres DODATKOWY 5-letni:\n• Kompleksowy przegląd wszystkich elementów ewakuacyjnych\n• Próbne uruchomienie / próba zjazdu (zgodnie z instrukcją)\n• Aktualizacja planu ewakuacji wg najnowszych wytycznych',
   E'• PN-EN 50308 – wymagania dot. ewakuacji\n• PN-EN 341 – urządzenia do opuszczania\n• Rozp. MGiP w sprawie BHP w energetyce\n• Wytyczne producenta',
   9, TRUE);


-- Element 10: SCHODY / DRZWI
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('schody_drzwi', 10,
   'Schody zewnętrzne, drzwi zewnętrzne, balustrady i pochwyty',
   'Schody / drzwi',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Schody zewnętrzne (stalowe ze stopniami ażurowymi) – odkształcenia\n• Drzwi zewnętrzne wieży – uszczelnienia, zamknięcia\n• Balustrady i pochwyty – mocowania\n• Strefa wejściowa – odwodnienie, oświetlenie\n\nZakres roczny (oględziny):\n• Ocena schodów zewnętrznych (oględziny, korozja, ugięcia)\n• Sprawdzenie szczelności i mocowań drzwi zewnętrznych\n• Ocena stanu balustrad / pochwytów',
   E'Zakres DODATKOWY 5-letni:\n• Kompleksowa ocena stanu technicznego i przydatności do użytkowania\n• Sprawdzenie nośności mocowań kotwiczeń schodów\n• Pełen przegląd systemów zamknięć drzwi',
   E'• art. 62 ust. 1 pkt 1 lit. a i pkt 2 PB\n• PN-EN 50308\n• PN-EN ISO 14122 – stałe środki dostępu\n• Wytyczne producenta',
   10, TRUE);


-- Element 11: LPS
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('lps', 11,
   'Instalacja odgromowa i uziemieniowa (LPS)',
   'LPS / uziemienie',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Zwody, przewody odprowadzające, receptory odgromowe\n• Złącza kontrolne, połączenia wyrównawcze\n• Uziemienie fundamentowe / dodatkowe\n• Ograniczniki przepięć (SPD)\n\nZakres roczny (oględziny):\n• Wizualna kontrola instalacji odgromowej (zwody, połączenia)\n• Sprawdzenie integralności złącz kontrolnych\n• Oględziny wskaźników stanu SPD',
   E'Zakres DODATKOWY 5-letni:\n• Pomiar rezystancji uziemienia wszystkich uziomów (OBOWIĄZKOWO)\n• Pomiar ciągłości rezystancji LPS\n• Sprawdzenie sprawności ograniczników przepięć\n• Sporządzenie protokołu pomiarów (osoba z uprawnieniami)',
   E'• art. 62 ust. 1 pkt 2 PB (obowiązkowo co 5 lat)\n• PN-EN 62305 (seria) – ochrona odgromowa\n• PN-EN 62305-3 – ochrona obiektów (LPS)\n• PN-HD 60364-5-54 – uziemienie',
   11, TRUE);


-- Element 12: INSTALACJA ELEKTRYCZNA
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('instalacja_elektryczna', 12,
   'Instalacja elektryczna (SN/nN, kable, rozdzielnia, stacja)',
   'Instalacja elektryczna',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Wewnętrzne linie kablowe (gondola–transformator)\n• Rozdzielnice nN – stan, oznaczenia, zabezpieczenia\n• Transformator (oględziny, wycieki, hałas)\n• Kable SN, mufy, głowice kablowe\n\nZakres roczny (oględziny):\n• Oględziny instalacji energetycznej, oświetleniowej i odgromowej\n• Stan rozdzielnic – oznaczenia, dostępność, kompletność osłon\n• Oględziny transformatora (poziom oleju, brak wycieków, brak nietypowych dźwięków)',
   E'Zakres DODATKOWY 5-letni:\n• Pomiar rezystancji izolacji obwodów (OBOWIĄZKOWO)\n• Pomiar pętli zwarcia obwodów gniazd 230 V\n• Sprawdzenie ciągłości przewodów ochronnych\n• Sprawdzenie sprawności RCD\n• Termowizja rozdzielnic i połączeń kablowych',
   E'• art. 62 ust. 1 pkt 2 PB (obowiązkowo co 5 lat)\n• Ustawa Prawo energetyczne\n• Rozp. ME – BHP przy urządzeniach energetycznych\n• PN-HD 60364 – instalacje elektryczne niskiego napięcia',
   12, TRUE);


-- Element 13: BHP / PPOŻ
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('bhp_ppoz', 13,
   'Wyposażenie BHP i ochrony przeciwpożarowej',
   'BHP / ppoż.',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Gaśnice (CO₂, proszkowe) – ważność przeglądów\n• Czujki dymowe / system detekcji pożaru\n• Oznakowanie ewakuacyjne\n• Środki ochrony osobistej w wieży\n\nZakres roczny (oględziny):\n• Termin ważności przeglądów gaśnic\n• Sprawdzenie sprawności czujek (jeżeli są)\n• Oględziny oznakowania ewakuacyjnego',
   E'Zakres DODATKOWY 5-letni:\n• Kompleksowy przegląd wszystkich elementów ppoż.\n• Wymiana środków ppoż. zgodnie z cyklem życia\n• Aktualizacja instrukcji bezpieczeństwa pożarowego',
   E'• Rozp. MSWiA – ochrona ppoż. budynków\n• PN-EN 3 (seria) – gaśnice przenośne\n• PN-EN 54 – systemy sygnalizacji pożarowej\n• Ustawa o ochronie ppoż.',
   13, TRUE);


-- Element 14: UDT
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('udt', 14,
   'Urządzenia podlegające Urzędowi Dozoru Technicznego (UDT)',
   'UDT',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Podest ruchomy (np. GLOBE) – aktualność badań\n• Wciągarki / żurawiki w gondoli\n• Urządzenia ciśnieniowe (jeżeli są)\n• Suwnice / wózki transportowe\n\nZakres roczny (oględziny):\n• Aktualność badań UDT i protokołów odbiorów\n• Stan techniczny tabliczek znamionowych i znaków UDT\n• Aktualność szkoleń operatorów',
   E'Zakres DODATKOWY 5-letni:\n• Przegląd resursu urządzeń UDT\n• Ocena przydatności do dalszej eksploatacji\n• Weryfikacja kompletności dokumentacji DTR / instrukcji',
   E'• Ustawa o dozorze technicznym\n• Rozp. RM w sprawie rodzajów urządzeń technicznych podlegających dozorowi\n• Rozp. MR w sprawie warunków technicznych UDT\n• DTR producenta',
   14, TRUE);


-- Element 15: DOJAZDY / PLAC
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('dojazdy_plac', 15,
   'Dojścia, dojazdy, plac manewrowy i infrastruktura towarzysząca',
   'Dojazdy / plac',
   TRUE, TRUE,
   E'Pozycje do oceny:\n• Nawierzchnia drogi dojazdowej i placu manewrowego\n• Odwodnienia, przepusty\n• Oznakowanie i zabezpieczenia\n• Stacja rozdzielczo-pomiarowa (kontener / budynek)\n\nZakres roczny (oględziny):\n• Ocena nawierzchni drogi i placu (ubytki, zagłębienia, koleiny)\n• Sprawdzenie drożności odwodnień\n• Oględziny ogrodzenia / oznakowania',
   E'Zakres DODATKOWY 5-letni:\n• Kompleksowa ocena stanu technicznego i przydatności\n• Pomiar nośności nawierzchni (jeżeli wskazane)\n• Aktualizacja oznakowania ostrzegawczego',
   E'• art. 62 ust. 1 pkt 1 lit. a i b oraz pkt 2 PB\n• Rozp. MTBiGM – warunki techniczne dróg\n• PN-EN 13242 – kruszywa drogowe\n• Wytyczne producenta',
   15, TRUE);


-- Element 16: ESTETYKA (TYLKO 5-LETNI)
INSERT INTO inspection_element_definitions
  (section_code, element_number, name_pl, name_short,
   applies_to_annual, applies_to_five_year,
   scope_annual, scope_five_year_additional, applicable_standards,
   sort_order, is_active)
VALUES
  ('estetyka', 16,
   'Estetyka obiektu i jego otoczenia',
   'Estetyka',
   FALSE, TRUE,
   E'Pozycje do oceny:\n• Ogólny wygląd turbiny i otoczenia\n• Czystość powłok, brak graffiti / uszkodzeń\n• Stan oznakowania nawigacyjnego (lampy, malowanie)\n• Porządek na placu manewrowym\n\nZakres roczny (oględziny):\n• (zakres roczny ograniczony – ocena estetyki obowiązkowa co 5 lat)\n• Bieżące spostrzeżenia eksploatacyjne',
   E'Zakres DODATKOWY 5-letni:\n• Ocena estetyki obiektu na podstawie wizji lokalnej (OBOWIĄZKOWO)\n• Ocena estetyki otoczenia obiektu (drogi, plac, ogrodzenie, zieleń)\n• Ocena oznakowania ostrzegawczego (lampy nocne, pasy malowania)\n• Ujęcie potrzebnych prac estetycznych w planie remontów',
   E'• art. 62 ust. 1 pkt 2 PB – ocena estetyki obowiązkowa co 5 lat\n• PN-EN ISO 12944 – powłoki malarskie ochronne\n• PN-EN 50308 – eksploatacja i utrzymanie\n• Decyzja środowiskowa / pozwolenie na budowę',
   16, TRUE);


COMMIT;


-- =============================================================================
-- WERYFIKACJA POMIGRACYJNA
-- =============================================================================

-- (a) Liczba aktywnych elementow per typ
SELECT
  COUNT(*) FILTER (WHERE applies_to_annual)        AS dla_rocznej,
  COUNT(*) FILTER (WHERE applies_to_five_year)     AS dla_5_letniej,
  COUNT(*)                                         AS razem_aktywnych
FROM inspection_element_definitions
WHERE is_active = TRUE;
-- Oczekiwane: dla_rocznej=15, dla_5_letniej=16, razem_aktywnych=16

-- (b) Lista wszystkich aktywnych elementow
SELECT element_number, section_code, name_short, applies_to_annual, applies_to_five_year
FROM inspection_element_definitions
WHERE is_active = TRUE
ORDER BY element_number;

-- (c) Liczba dezaktywowanych (legacy) — informacyjnie
SELECT COUNT(*) AS legacy_dezaktywowane
FROM inspection_element_definitions
WHERE is_active = FALSE;

-- =============================================================================
-- KONIEC migracji V2
-- =============================================================================
