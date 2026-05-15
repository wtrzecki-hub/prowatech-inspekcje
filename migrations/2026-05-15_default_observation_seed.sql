-- Dodaje kolumnę `default_observation` do `inspection_element_definitions`
-- + seeduje wartości per element po akceptacji Waldka (sesja 2026-05-15).
--
-- Kolumna trzyma domyślny „Opis stanu technicznego" wyświetlany w nowej
-- sekcji kolumny „Opis i ustalenia z kontroli" tabeli III protokołu PIIB.
-- Inspektor może nadpisać przez pole `inspection_elements.observation`;
-- gdy oba są NULL — sekcja w protokole pomijana.
--
-- Treści bazują na sekcji „USTALENIA PO SPRAWDZENIU STANU TECHNICZNEGO"
-- z archiwalnych protokołów rocznych 2025 (Wiśniewski; sample: 467, 473, 474).
-- Forma neutralna („wszystko OK"), bez opisów konstrukcji (są już w
-- `scope_annual`), bez referencji do konkretnego modelu turbiny.

BEGIN;

-- 1) Schema: nowa kolumna
ALTER TABLE inspection_element_definitions
  ADD COLUMN IF NOT EXISTS default_observation TEXT NULL;

COMMENT ON COLUMN inspection_element_definitions.default_observation IS
  'Domyślny „Opis stanu technicznego" wyświetlany w kolumnie „Opis i ustalenia z kontroli" tabeli III protokołu. Inspektor może nadpisać per inspekcja przez `inspection_elements.observation`. NULL = sekcja „Opis stanu technicznego" pomijana w protokole dla tego elementu.';

-- 2) Wartości default_observation per element_number
--    Każdy UPDATE wstawiany do skryptu po akceptacji Waldka w sesji 2026-05-15.
--    Kolejność: numeryczna po element_number (1, 2, 3, ..., 18).

-- Element #1 Fundament i posadowienie — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie kontroli dokonano oceny wizualnej fundamentu. W wyniku przeprowadzonych oględzin nie stwierdzono poważnych rys i pęknięć na powierzchni mogących być konsekwencją nierównomiernego osiadania obiektu i uszkodzenia fundamentu. Nie stwierdzono uszkodzeń mogących mieć wpływ na wartości użytkowe fundamentu.$$
WHERE element_number = 1 AND is_active = TRUE;

-- Element #2 Połączenia śrubowe – segmenty wieży (flansze) — akceptacja Waldek 2026-05-15
-- TYLKO kontrola 5-letnia (applies_to_annual = FALSE).
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli sprawdzono oznaczenia kontrolne (markery momentu dokręcenia) na śrubach kołnierzowych segmentów wieży. Brak oznak rdzy na śrubach i kołnierzach łączących poszczególne sekcje wieży. Stan zabezpieczeń antykorozyjnych połączeń kołnierzowych — prawidłowy. Nie stwierdzono wycieków smaru/oleju wokół flansz ani luzów stykających się płaszczyzn.$$
WHERE element_number = 2 AND is_active = TRUE;

-- Element #3 Wieża — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli nie stwierdzono śladów korozji na styku elementu kotwiącego z pierwszym elementem rurowym po stronie zewnętrznej oraz na kołnierzu sekcji kotwiącej wewnątrz obiektu. Brak oznak rdzy na śrubach i kołnierzach łączących poszczególne sekcje wieży. Kontrola docisku połączeń poszczególnych elementów wieży objęta jest w zakresie obsługi serwisowej.$$
WHERE element_number = 3 AND is_active = TRUE;

-- Element #4 Gondola (nacela) — akceptacja Waldek 2026-05-15
-- (uzupełnione zdanie o czynnościach serwisowych zgodne ze wzorcem z 5/6)
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie kontroli dokonano oceny wizualnej — poszczególne elementy nie wykazują nadmiernego zużycia, nie stwierdzono nieprawidłowości na łączeniu wieży z łożyskiem układu kierunkowania, brak wycieków i plam oleju wewnątrz gondoli. Stan poszycia gondoli — dobry. Stan wyposażenia gondoli podlega czynnościom serwisowym.$$
WHERE element_number = 4 AND is_active = TRUE;

-- Element #5 Połączenie wieża–gondola (łożysko wieńcowe azymutu) — akceptacja Waldek 2026-05-15
-- TYLKO kontrola 5-letnia.
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli sprawdzono stan łożyska wieńcowego azymutu (yaw bearing) — brak nietypowych dźwięków i drgań przekazywanych na konstrukcję podczas obrotu gondoli. Nie stwierdzono wycieków smaru spod łożyska ani nieprawidłowości połączeń śrubowych flansza wieża–łożysko. Stan napędów azymutu (yaw drives) — bez uwag. Stan łożyska i jego smarowania podlega czynnościom serwisowym.$$
WHERE element_number = 5 AND is_active = TRUE;

-- Element #6 Wirnik / rotor z łopatami — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie kontroli dokonano oceny wizualnej — poszczególne elementy nie wykazują nadmiernego zużycia, nie stwierdzono rys, spękań, ubytków na łopatach a także nieprawidłowości na łączeniu łopat z piastą. Stan poszycia łopat — dobry. Stan łopat podlega czynnościom serwisowym.$$
WHERE element_number = 6 AND is_active = TRUE;

-- Element #7 Połączenie gondola–wirnik (piasta, łożysko główne, system pitch) — akceptacja Waldek 2026-05-15
-- TYLKO kontrola 5-letnia. SCADA wyrzucone z draftu (potwierdzona reguła: brak SCADA w default_observation).
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli sprawdzono stan połączenia piasta–wał główny — brak wycieków smaru i plam oleju w obszarze łożyska głównego. Nie stwierdzono nietypowych dźwięków, drgań ani podwyższonej temperatury przekazywanej na konstrukcję. Stan systemu pitch (łożyska łopat, kable) podlega czynnościom serwisowym.$$
WHERE element_number = 7 AND is_active = TRUE;

-- Element #8 Podesty, platformy, drabiny i komunikacja wewnętrzna — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli dokonano oceny wizualnej platform oraz podestów spoczynkowych. Kontrolowane obiekty nie wykazują nadmiernego zużycia. Montaż platform oraz podestów spoczynkowych — prawidłowy. Drabina wewnętrzna z systemem zabezpieczającym przed upadkiem z wysokości — bez deformacji, uszkodzeń i oznak korozji. Punkty zaczepienia i łączniki prawidłowe. Sprawdzono poprawność mocowania mechanizmu samozaciskowego — prawidłowy.$$
WHERE element_number = 8 AND is_active = TRUE;

-- Element #9 Urządzenia ewakuacyjno-ratunkowe — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli dokonano oceny wizualnej urządzeń ewakuacyjno-ratunkowych. Zestaw sprzętu ratowniczego do zjazdu awaryjnego — odpowiednio oznakowany. Data ważności przeglądu sprzętu ratowniczego — aktualna. Apteczka pierwszej pomocy — kompletna i w stanie używalności. Plan ewakuacji — czytelny i aktualny.$$
WHERE element_number = 9 AND is_active = TRUE;

-- Element #10 Schody zewnętrzne, drzwi zewnętrzne, balustrady i pochwyty — akceptacja Waldek 2026-05-15
-- (alternatywa z czystym opisem stanu, bez fragmentów konstrukcyjnych)
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie kontroli nie stwierdzono oznak nadmiernego zużycia schodów zewnętrznych, drzwi i balustrad. Uszczelnienia i zamknięcia drzwi zewnętrznych w stanie prawidłowym. Punkty mocowania balustrad i pochwytów — prawidłowe.$$
WHERE element_number = 10 AND is_active = TRUE;

-- Element #11 Instalacja odgromowa / uziemiająca / połączenia wyrównawcze — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli nie stwierdzono nadmiernego zużycia tego elementu. Poszczególne elementy połączeń wyrównawczych bez oznak korozji, prawidłowo zabezpieczone wazeliną techniczną bezkwasową. Złącza kontrolne na fundamencie / segmencie 1 — drożne i czytelne.$$
WHERE element_number = 11 AND is_active = TRUE;

-- Element #12 Instalacja elektryczna SN/nN, kable, rozdzielnia, stacja — akceptacja Waldek 2026-05-15
-- TYLKO kontrola 5-letnia.
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli sprawdzono stan instalacji elektrycznej SN/nN — kabli, rozdzielnicy SN-15kV oraz stacji pomiarowej. Nie stwierdzono uszkodzeń izolacji, śladów przegrzewania ani nieprawidłowości oznakowania. Aktualne pomiary elektryczne i protokoły badań dołączone są do dokumentacji obiektu. Czynności serwisowe (pomiary, oględziny) wykonywane są przez wyspecjalizowaną firmę elektroenergetyczną.$$
WHERE element_number = 12 AND is_active = TRUE;

-- Element #13 Wyposażenie BHP i ochrony przeciwpożarowej — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie kontroli dokonano oceny wizualnej prawidłowości rozmieszczenia oznakowania BHP i P-POŻ oraz sprawdzono lokalizację sprzętu p-poż i daty ważności przeglądów gaśnic. Oznakowanie — prawidłowe. Rozmieszczenie sprzętu p-poż — prawidłowe. Daty ważności przeglądów gaśnic — aktualne.$$
WHERE element_number = 13 AND is_active = TRUE;

-- Element #14 Urządzenia podlegające Urzędowi Dozoru Technicznego (UDT) — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie kontroli sprawdzono aktualność badań i protokoły odbiorów urządzeń podlegających kontroli Urzędu Dozoru Technicznego. Wszystkie urządzenia posiadają aktualne badania i decyzje dopuszczające do użytkowania podpisane przez inspektora dozoru technicznego. Urządzenia posiadają aktualne dzienniki konserwacji. Na podeście ruchomym oraz przy wciągarce wywieszone instrukcje obsługi.$$
WHERE element_number = 14 AND is_active = TRUE;

-- Element #15 Dojścia, dojazdy, plac manewrowy i infrastruktura towarzysząca — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie kontroli nie stwierdzono oznak nadmiernego zużycia dróg dojazdowych i placu manewrowego. Nawierzchnia — bez znaczących ubytków, zagłębień i kolein. Odwodnienia drożne.$$
WHERE element_number = 15 AND is_active = TRUE;

-- Element #16 Estetyka obiektu i jego otoczenia — akceptacja Waldek 2026-05-15
-- TYLKO kontrola 5-letnia.
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie kontroli dokonano oceny wizualnej estetyki obiektu i jego otoczenia. Powłoki malarskie wieży i stacji — utrzymane w stanie zadowalającym. Roślinność wokół fundamentu turbiny i stacji kontenerowej — kontrolowana. Otoczenie obiektu uporządkowane.$$
WHERE element_number = 16 AND is_active = TRUE;

-- Element #17 Stacja kontenerowa pomiarowa — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$Stan techniczny stacji kontenerowo-pomiarowej — dobry. W trakcie kontroli nie zaobserwowano uszkodzeń mogących świadczyć o nieprawidłowym montażu bądź użytkowaniu obiektu. Wyposażenie stacji pomiarowej podlega czynnościom serwisowym. W ramach okresowych przeglądów przeprowadzane są oględziny wszystkich elementów wyposażenia elektroenergetycznego oraz dokonywane pomiary uziomów.$$
WHERE element_number = 17 AND is_active = TRUE;

-- Element #18 Panele fotowoltaiczne — akceptacja Waldek 2026-05-15
UPDATE inspection_element_definitions
SET default_observation = $$W trakcie przeprowadzonej kontroli dokonano oceny wizualnej instalacji fotowoltaicznej. Panele fotowoltaiczne — bez widocznych pęknięć, zarysowań ani zacienień przez roślinność. Konstrukcja wsporcza — bez śladów korozji, mocowania pewne. Falownik i okablowanie DC — bez sygnalizacji błędów. Pomiary elektryczne instalacji PV objęte odrębnym protokołem.$$
WHERE element_number = 18 AND is_active = TRUE;

-- Sanity check: każdy aktywny element musi mieć default_observation po tej migracji.
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*)
    INTO cnt
    FROM inspection_element_definitions
    WHERE is_active = TRUE
      AND default_observation IS NULL;
  IF cnt > 0 THEN
    RAISE NOTICE 'UWAGA: pozostało % aktywnych element_definitions bez default_observation.', cnt;
  END IF;
END
$$;

COMMIT;
