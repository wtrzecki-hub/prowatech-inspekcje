-- 2026-04-30: Zastapienie defect_library nowa baza_usterek_dostosowana.xlsx (135 wpisow)
-- Stare 250 wpisow zachowane w defect_library_backup_2026-04-30.xlsx (untracked w repo)
-- Brak FK do defect_library => bezpieczne DELETE

BEGIN;

-- STAN PRZED
SELECT 'before' AS phase, COUNT(*) AS total FROM defect_library;

DELETE FROM defect_library;

INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F01', 'Fundament', '1. Fundament i posadowienie', 'Uszkodzenie poziomej warstwy izolacji zewnętrznej fundamentu (K)', 'Punktowe pęknięcia i odspojenia zewnętrznej warstwy izolacji przeciwwilgociowej – brak jednolitości powłoki.

Podstawa prawna: PN-EN 1504-2; PN-EN 1504-3', 'Naprawić uszkodzone fragmenty poziomej warstwy izolacyjnej zewnętrznej sekcji fundamentowej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F02', 'Fundament', '1. Fundament i posadowienie', 'Drobne spękania powłoki wodoszczelnej zewnętrznej części fundamentu (NB)', 'Drobne spękania i zarysowania powłoki wodoszczelnej bez wpływu na nośność; widoczne odspojenia.

Podstawa prawna: PN-EN 1504-2; PN-EN 1504-3', 'Naprawić izolację wodoszczelną zewnętrznej odkrytej części fundamentu.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F03', 'Fundament', '1. Fundament i posadowienie', 'Skażenia biologiczne i spękania na zewnętrznej części fundamentu (K)', 'Naloty biologiczne (mchy, glony) oraz spękania powłoki wodoszczelnej.

Podstawa prawna: PN-EN 1504-2; PN-EN 1504-3', 'Oczyścić ze skażeń biologicznych; wykonać konserwację izolacji poziomej zewnętrznej części fundamentu.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F04', 'Fundament', '1. Fundament i posadowienie', 'Drobne rysy skurczowe i termiczne wewnątrz fundamentu – nieskuteczna izolacja zewnętrzna (NB)', 'Drobne rysy skurczowe/termiczne na betonie; nieskuteczność zastosowanej izolacji zewnętrznej.

Podstawa prawna: PN-EN 1504-3; PN-EN ISO 12944-5', 'Wykonać nową izolację przeciwwodną zewnętrznej odkrytej części fundamentu (grunt. + membrana UV + uszczelnienie elastyczne stalowa wieża–beton + zabezpieczenie flanszy).', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F05', 'Fundament', '1. Fundament i posadowienie', 'Drobne rysy i ubytki powierzchni betonowej zewnętrznej części fundamentu (K)', 'Widoczne rysy i ubytki na betonie fundamentu; brak równej powierzchni.

Podstawa prawna: PN-EN 1504-3', 'Naprawić spękania i rysy na odkrytej zewnętrznej części fundamentu.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F06', 'Fundament', '1. Fundament i posadowienie', 'Odspojenia i uszkodzenia izolacji pionowej na styku wieży z fundamentem (NB)', 'Odspojenia i uszkodzenia powłoki izolacyjnej na styku metalowej wieży z podłożem/fundamentem.

Podstawa prawna: PN-EN 1504-2', 'Naprawić uszczelnienie izolacji pionowej w pasie przyziemia wieży elektrowni.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F07', 'Fundament', '1. Fundament i posadowienie', 'Pęknięcia i ubytki wylewki betonowej na styku fundamentu z elementem stalowym wieży (NB)', 'Pęknięcia i ubytki strukturalne betonu cokołu oraz wylewki na styku fundamentu z pierścieniem stalowym wieży.

Podstawa prawna: PN-EN 1504-3', 'Naprawić wylewkę betonową na styku łączenia fundamentu z elementem stalowym wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F08', 'Fundament', '1. Fundament i posadowienie', 'Zabrudzenia i pozostałości po insektach na powierzchni fundamentu wewnątrz wieży (K)', 'Widoczne zabrudzenia (w tym odchody insektów) na powierzchni betonowej posadzki.

Podstawa prawna: PN-EN 1504-9', 'Oczyścić powierzchnię fundamentu wewnątrz wieży z zabrudzeń i owadów.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F09', 'Fundament', '1. Fundament i posadowienie', 'Braki warstwy uszczelniającej na zewnętrznym styku fundamentu z pierścieniem stalowej wieży (K)', 'Braki warstwy uszczelniającej pomiędzy poziomym fundamentem betonowym a stalową wieżą.

Podstawa prawna: PN-EN 1504-9', 'Uzupełnić warstwę uszczelniającą na zewnętrznym styku fundamentu z pierścieniem stalowej wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F10', 'Fundament', '1. Fundament i posadowienie', 'Zaśniedziałe złącza i przewody uziemiające w sekcji fundamentowej (K)', 'Zaśniedziałe złącza i przewody odprowadzające uziemiające – charakterystyczne przebarwienia.

Podstawa prawna: PN-EN 1504-3; PN-EN 62305-3', 'Wyczyścić i zakonserwować zaśniedziałe złącza i przewody uziemiające w sekcji fundamentowej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F11', 'Fundament', '1. Fundament i posadowienie', 'Korozja śrub i uchwytów mocujących w dolnej sekcji fundamentowej (K)', 'Korozja na śrubach i uchwytach mocujących wystających ponad powierzchnię fundamentu.

Podstawa prawna: PN-EN 1504-9', 'Wykonać konserwację antykorozyjną śrub i uchwytów mocujących w dolnej sekcji fundamentowej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F12', 'Fundament', '1. Fundament i posadowienie', 'Wytarta izolacja pionowa pasa przyziemia fundamentu (K)', 'Łuszczenie, pęcherzenie lub ubytki płatowe ciemnej powłoki ochronnej na pionowej powierzchni cokołu fundamentu.

Podstawa prawna: PN-EN 1504-2; PN-EN 1504-3', 'Wykonać poprawki wytartej izolacji pionowej w pasie przyziemia fundamentu elektrowni.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F13', 'Fundament', '1. Fundament i posadowienie', 'Rozległe ubytki powłoki izolacyjnej w pasie skrajnym zewnętrznej części fundamentu (K)', 'Rozległe łuszczenie się i ubytki płatowe ciemnej powłoki ochronnej na ścianie cokołu, odsłaniające strukturę betonu.

Podstawa prawna: PN-EN 1504-3', 'Wykonać nową powłokę izolacyjną w pasie skrajnym na zewnętrznej odkrytej części fundamentu.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F14', 'Fundament', '1. Fundament i posadowienie', 'Zawilgocenie fundamentu w rejonie połączenia z dolną sekcją wieży (K)', 'Zacieki, ślady spływu wody i przebarwienia przy pierścieniu kotwiącym – podejrzenie nieszczelności styku.

Podstawa prawna: PN-EN 1504-9', 'Zlokalizować źródło zawilgoceń; odtworzyć elastyczne uszczelnienie pierścienia stalowego; sprawdzić odwodnienie; prowadzić obserwację.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F15', 'Fundament', '1. Fundament i posadowienie', 'Uprawy rolne w zbyt bliskiej odległości od fundamentu (K)', 'Uprawy rolne bezpośrednio przy krawędzi fundamentu – ryzyko uszkodzeń i podmywania.

Podstawa prawna: PN-EN 1504-9', 'Odsunąć uprawy od fundamentu elektrowni (zachować wymagany pas techniczny).', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F16', 'Fundament', '1. Fundament i posadowienie', 'Krzewy i roślinność zarastające schody zewnętrzne prowadzące do turbiny (K)', 'Gęsta roślinność przerastająca przez konstrukcję schodów zewnętrznych i podest wejściowy.

Podstawa prawna: PN-EN 1504-9', 'Usunąć krzewy i roślinność spod schodów prowadzących do turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F17', 'Fundament', '1. Fundament i posadowienie', 'Nadmierna roślinność przy fundamencie elektrowni (K)', 'Drzewa i wysoka roślinność wyrastająca bezpośrednio przy opasce fundamentowej.

Podstawa prawna: PN-EN 1504-9', 'Przyciąć i usunąć roślinność wokół fundamentu elektrowni.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F18', 'Fundament', '1. Fundament i posadowienie', 'Ślady wycieku oleju i zabrudzenia na powierzchni fundamentu wewnątrz wieży (K)', 'Ogniska korozji na śrubach kotwiących; osady i ślady wycieku oleju na posadzce.

Podstawa prawna: PN-EN 1504-9', 'Oczyścić dolną sekcję fundamentową z pozostałości po wycieku oleju; wykonać konserwację połączeń śrubowych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F19', 'Fundament', '1. Fundament i posadowienie', 'Uszkodzenie nadlewek betonowych pod pierwszą flanszą wieży (NB)', 'Zaawansowana degradacja krawędziowa podlewki przy podstawie wieży; ubytki masy uszczelniającej, odsłonięte skorodowane zbrojenie.

Podstawa prawna: PN-EN 1504-3; PN-EN ISO 12944-5', 'Naprawić nadlewki betonowe pod pierwszą flanszą wieży z prawidłową dylatacją, spadkiem i nową powłoką izolacyjną.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F20', 'Fundament', '1. Fundament i posadowienie', 'Drobne rysy i pęknięcia na posadzce w rejonie połączenia fundamentu z wieżą (K)', 'Siatka drobnych pęknięć włoskowatych (skurczowych) oraz ubytki na krawędziach połączenia fundamentu z wieżą.

Podstawa prawna: PN-EN 1504-3', 'Prowadzić obserwacje istniejących rys; wykonać naprawę przy ich powiększeniu.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F21', 'Fundament', '1. Fundament i posadowienie', 'Spękania skurczowe fundamentu z koniecznością monitorowania i uszczelnienia styku z wieżą (NB)', 'Podłużne pęknięcia i spękania skurczowe; zmierzona szerokość rozwarcia 0,15 mm – konieczność monitorowania.

Podstawa prawna: PN-EN 1504-3', 'Monitorować spękania; wypełnić masami naprawczymi; uszczelnić styk fundamentu z wieżą wewnątrz i zewnątrz.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('F22', 'Fundament', '1. Fundament i posadowienie', 'Niesprawne oświetlenie w piwnicy kablowej turbiny (K)', 'Bardzo słabe lub brak oświetlenia w piwnicy kablowej; wyeksploatowane świetlówki.

Podstawa prawna: PN-EN 1504-9', 'Wymienić świetlówki / źródła światła w piwnicy kablowej turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W01', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Uszkodzone plastikowe osłony śrub na zewnętrznym pierścieniu kotwiącym (K)', 'Pęknięte i odłamane plastikowe kapturki ochronne na śrubach fundamentowych; odsłonięte łby śrub.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5; PN-EN 1090-2', 'Wymienić uszkodzone osłony śrub na zewnętrznym pierścieniu kotwiącym wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W02', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Uszkodzone oświetlenie zewnętrzne i luźne przewody nad wejściem do turbiny (NB)', 'Luźne, nieprzymocowane przewody elektryczne; nieszczelna obudowa oprawy; wypięty przewód z dławnicy.

Podstawa prawna: PN-EN 62305-3', 'Naprawić oświetlenie zewnętrzne nad wejściem; przymocować i uszczelnić przewody.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W03', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Przetarcia powłok malarskich i ślady korozji wokół śrub dolnego kołnierza wieży (K)', 'Intensywna korozja powierzchniowa na kołnierzu wzdłuż śrub; rdzawe wykwity na znacznej części powierzchni.

Podstawa prawna: PN-EN ISO 12944-5; PN-EN 1090-2', 'Wykonać zaprawki malarskie na krawędzi kołnierza w dolnej sekcji I segmentu wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W04', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Zaawansowana korozja krawędziowa podkładek i gniazd śrubowych na dolnym kołnierzu wieży (K)', 'Rdzawe wykwity i łuszczenie powłoki malarskiej bezpośrednio przy nakrętkach kołnierza.

Podstawa prawna: PN-EN ISO 12944-5; PN-EN 1090-2', 'Oczyścić połączenia śrubowe i zabezpieczyć antykorozyjnie wazeliną techniczną bezkwasową.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W05', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Odpryski powłoki malarskiej z korozją punktową i degradacja masy uszczelniającej na styku wieży z cokołem (K)', 'Odpryski powłoki malarskiej na płaszczu wieży; głęboka degradacja masy uszczelniającej grout na styku z betonem.

Podstawa prawna: PN-EN 1504-3; PN-EN ISO 12944-5', 'Wykonać konserwację antykorozyjną na łączeniach flanszy fundamentowej i zaprawki antykorozyjne odprysków.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W06', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Ogniska korozji punktowej na kołnierzach łączących sekcje wieży (K)', 'Dwa wyraźne ogniska korozji punktowej (pitting) z pionowymi rdzawymi zaciekami na płaszczu wieży.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację punktowych ubytków powłoki malarskiej zewnętrznej wieży z zabezpieczeniem antykorozyjnym.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W08', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Zabrudzenia i zacieki na zewnętrznej powierzchni wieży (K)', 'Zewnętrzna powierzchnia wieży z widocznymi zaciekami.

Podstawa prawna: —', 'Oczyścić zewnętrzną powierzchnię wieży z zacieków.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W09', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Brak osłony gumowej na jednej śrubie zewnętrznego pierścienia kotwiącego (K)', 'Brak czarnej gumowej osłony na jednej śrubie zewnętrznego pierścienia fundamentowego.

Podstawa prawna: PN-EN 1504-9; PN-EN 1090-2', 'Uzupełnić brakującą osłonę śruby na zewnętrznym pierścieniu kotwiącym wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W10', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Zabrudzenia i degradacja uszczelki dolnej drzwi wejściowych powodujące gromadzenie wody (K)', 'Silne zanieczyszczenie dolnego fragmentu uszczelki drzwi; martwe owady, piasek w rowku gumowym.

Podstawa prawna: —', 'Wyczyścić i przeczyszczonować przecięcie uszczelki w dolnej części drzwi – zapobieganie gromadzeniu się wody.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W11', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Korozja wżerowa ościeżnicy drzwi wejściowych i drzwi (K)', 'Zaawansowana korozja na krawędzi ościeżnicy przy styku z uszczelką; pęcherzenie i odspojenie powłoki malarskiej.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację antykorozyjną ościeżnicy i skrzydła drzwi wejściowych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W12', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Brakujące śruby konstrukcyjne w wewnętrznym kołnierzu pierwszego pierścienia wieży (NG)', 'Krytyczny brak kilku sąsiadujących śrub w wewnętrznym połączeniu kołnierzowym; luźne elementy na kołnierzu.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5; PN-EN 1090-2', 'Niezwłocznie uzupełnić brakujące śruby pierwszego pierścienia wewnątrz wieży; sprawdzić momenty dokręcenia.', 'I');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W13', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Korozja elementów instalacji uziemiającej w sekcji fundamentowej wieży (K)', 'Zaawansowana korozja płaskowników szyny wyrównawczej przy wprowadzeniu do posadzki betonowej.

Podstawa prawna: PN-EN 1504-3; PN-EN ISO 12944-5; PN-EN 62305-3', 'Zabezpieczyć antykorozyjnie skorodowane elementy instalacji uziemiającej w sekcji fundamentowej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W14', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Zaciśnięcie (zagięcie) przewodu odprowadzającego od osuszacza wewnątrz wieży (K)', 'Niebieski wąż odprowadzający kondensatu wyraźnie zagięty w dolnej części – ryzyko blokady przepływu i awarii.

Podstawa prawna: PN-EN 62305-3', 'Wykonać prawidłowy montaż przewodów od osuszacza – bez zagięć blokujących przepływ.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W15', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Mechaniczne uszkodzenie powłoki lakierniczej wieży z korozją powierzchniową (K)', 'Głębokie zarysowanie lub wgniecenie płaszcza z przerwaniem ciągłości powłoki; postępująca korozja.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację antykorozyjną uszkodzonej powłoki lakierniczej na powierzchni wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W16', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Ubytki masy uszczelniającej na poziomych łączeniach segmentów wieży z korozją (K)', 'Ubytki masy uszczelniającej na łączeniach poziomych; intensywne rdzawe zacieki z pod styku segmentów.

Podstawa prawna: PN-EN ISO 12944-5', 'Poprawić uszczelnienie poziomych łączeń segmentów wieży z konserwacją antykorozyjną.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W17', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Uszkodzona uszczelka krawędziowa drzwi wejściowych do turbiny (K)', 'Uszkodzona i odspojona gumowa uszczelka krawędziowa otworu wejściowego.

Podstawa prawna: —', 'Wymienić uszkodzoną uszczelkę krawędziową drzwi wejściowych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W18', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Uszkodzenie siatki ochronnej kratki wentylacyjnej drzwi wejściowych (K)', 'Mechaniczne odkształcenie i pęknięcie siatki ochronnej kratki; penetracja owadów i zanieczyszczeń.

Podstawa prawna: —', 'Naprawić uszkodzoną siatkę ochronną kratki wentylacyjnej drzwi zewnętrznych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W19', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Uszkodzona pokrywa włazu na pierwszym podeście nad wejściem do turbiny (K)', 'Korozja na wsporniku podestu; brak elementu gumowego/zaślepki amortyzującej – wibracje i hałas.

Podstawa prawna: PN-EN ISO 12944-5', 'Naprawić pokrywę włazu na pierwszym podeście nad wejściem do turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W20', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Braki w przewodach uziemiających na skutek włamania do turbiny (NB)', 'Przewód uziemiający ucięty; prowizoryczne zabezpieczenie taśmą izolacyjną.

Podstawa prawna: PN-EN 62305-3', 'Odtworzyć instalację uziemiającą i wykonać niezbędne pomiary elektryczne po naprawie.', 'I');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W21', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Uszkodzona i zardzewiała kratka wentylacyjna drzwi wejściowych do turbiny (K)', 'Kratka wentylacyjna drzwi wejściowych uszkodzona, zabrudzona i pokryta rdzą.

Podstawa prawna: PN-EN ISO 12944-5', 'Naprawić / wymienić kratkę wentylacyjną drzwi wejściowych do turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W22', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Nieuporządkowana przestrzeń wewnątrz wieży w rejonie styku żelbetowej i stalowej części (K)', 'Luźne przewody, porozrzucane kratki i odpady poremontowe; brak właściwego zabezpieczenia dostępu do cokołu.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5', 'Uporządkować przestrzeń wewnątrz wieży; prawidłowo zabezpieczyć dostęp do wnętrza cokołu żelbetowego.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W23', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Ubytki masy uszczelniającej i korozja podpowłokowa na poziomych łączeniach segmentów (K)', 'Pęknięcia, odspojenia i pęcherzenie powłoki wzdłuż styku segmentów; rdzawe zacieki wskazujące na korozję podpowłokową.

Podstawa prawna: PN-EN ISO 12944-5', 'Uzupełnić masę uszczelniającą na poziomych łączeniach segmentów wieży z konserwacją antykorozyjną i czyszczeniem zacieków.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W24', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Brakująca śruba mocująca w płycie podestu wewnętrznego przy wejściu (K)', 'Brak śruby mocującej w ryflowanej płycie podestu wewnętrznego; pusty otwór montażowy.

Podstawa prawna: PN-EN 1090-2', 'Uzupełnić brakującą śrubę na platformie przy wejściu do wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W25', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Niezabezpieczone otwory przelotowe w poszyciu wieży (wiercone na wylot) (K)', 'Otwory przelotowe w poszyciu wieży z prowizorycznym podpięciem przewodu; ryzyko penetracji wody.

Podstawa prawna: —', 'Zabezpieczyć (uszczelnić) otwory wywiercone na wylot w poszyciu wieży turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W26', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Korozja nakrętek i podkładek połączenia kołnierzowego w górnej części wkładu fundamentowego (K)', 'Korozja na krawędziach nakrętek i podkładek kołnierza; zacieki wilgoci na ścianie segmentu.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5; PN-EN 1090-2', 'Zabezpieczyć antykorozyjnie górną część kołnierza wkładu fundamentowego i styk ze śrubami.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W27', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Spękania i ubytki wierzchniej warstwy wylewki betonowej wewnątrz wieży (NB)', 'Silne zanieczyszczenie posadzki betonowej wewnątrz wieży; spękania i skruszenia wierzchniej warstwy.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5', 'Naprawić wierzchnią warstwę wylewki betonowej wewnątrz wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W28', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Uszkodzona gumowa osłona wkładki bębenkowej zamka drzwi wejściowych (K)', 'Sparciała lub rozerwana gumowa osłona wkładki bębenkowej; brak ochrony mechanizmu przed wilgocią.

Podstawa prawna: —', 'Wymienić gumową osłonę zamka po zewnętrznej stronie drzwi wejściowych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W29', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Brak jednej śruby w pierścieniu kotwiącym sekcję fundamentową z wieżą (NB)', 'Luźna śruba na posadzce; brak śruby w pierścieniu kołnierzowym; intensywne zacieki korozyjne.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5; PN-EN 1090-2', 'Uzupełnić brakującą śrubę w pierścieniu łączącym sekcję fundamentową z elementem wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W30', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Obce przedmioty składowane wewnątrz wieży pod szafą sterowniczą (K)', 'Kartony i luźne elementy składowane bezpośrednio pod szafą sterowniczą; blokada dostępu do urządzeń.

Podstawa prawna: —', 'Uprzątnąć wnętrze elektrowni z przedmiotów niezwiązanych z pracą turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W31', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Brak stalowego elementu umożliwiającego otwieranie drzwi od wewnątrz (NB)', 'Uszkodzone i poluzowane obudowa mechanizmu zamykającego od wewnątrz; brak śrub montażowych.

Podstawa prawna: PN-EN ISO 12944-5; PN-EN 1090-2', 'Uzupełnić zamek o stalową listwę (element otwierający drzwi od wewnątrz).', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W32', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Uszkodzenie zakotwienia drabiny w części fundamentowej wieży (NB)', 'Korozja powierzchniowa i wżerowa elementu mocującego stopę drabiny; pęknięcia betonu wokół zakotwienia.

Podstawa prawna: PN-EN 1504-3; PN-EN ISO 12944-5; PN-EN 353-1', 'Naprawić zakotwienie drabiny w części fundamentowej wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W33', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Zabrudzenie i korozja śrub oraz nakrętek pierwszego kołnierza wieży (NB)', 'Korozja nalotowa i zabrudzenia (pajęczyny, pył, osady) śrub i nakrętek kotwiących na dolnym kołnierzu.

Podstawa prawna: PN-EN ISO 12944-5; PN-EN 1090-2', 'Oczyścić pierwszy kołnierz wieży z połączeniami śrubowymi i wykonać konserwację.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W34', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Brak wkładki bębenkowej w głównym gnieździe zamka drzwi – obiekt zabezpieczony tylko kłódką (NB)', 'Puste gniazdo zamka; obiekt utrzymywany zamkniętym wyłącznie przez silnie zardzewiałą kłódkę pomocniczą.

Podstawa prawna: PN-EN ISO 12944-5', 'Zamontować nową wkładkę bębenkową zamka drzwi wejściowych do turbiny.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W35', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Korozja metalowego wspornika mocującego siłownik drzwiowy (K)', 'Ślady korozji na metalowym uchwycie mocującym siłownika drzwiowego.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację antykorozyjną wspornika i siłownika drzwi zewnętrznych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W36', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Urwana gałka (klamka) drzwi zewnętrznych wejściowych do wieży (NB)', 'Brak zewnętrznej części pochwytu (urwana gałka drzwi); utrudnione lub niemożliwe prawidłowe otwarcie.

Podstawa prawna: —', 'Wymienić uszkodzoną gałkę (klamkę) drzwi zewnętrznych wejściowych do wieży.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('W37', 'Wieża', '2/3. Wieża – konstrukcja stalowa', 'Korozja metalowej blokady drzwi zewnętrznych wejściowych do turbiny (K)', 'Intensywna korozja powierzchniowa (rudy nalot) pokrywająca niemal całą powierzchnię giętego elementu blokady.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację antykorozyjną uchwytów blokady drzwi zewnętrznych; oczyścić do St2 wg PN-EN ISO 8501-1.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P01', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Uszkodzenie elementu stabilizującego linę podestu ruchomego w miejscu przejścia przez podest (K)', 'Lina systemu asekuracji pionowej nie przebiega przez dedykowane przelotki – ryzyko uszkodzenia liny.

Podstawa prawna: PN-EN 353-1', 'Zabezpieczyć miejsce przejścia stalowej liny podestu ruchomego przez platformę wewnątrz wieży.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P02', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Uszkodzony kluczyk wewnątrz podestu ruchomego (K)', 'Kluczyk podestu ruchomego uszkodzony.

Podstawa prawna: —', 'Wymienić uszkodzony kluczyk wewnątrz podestu ruchomego.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P03', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Korozja śrub i łączników kotwiących schodów zewnętrznych do fundamentu (K)', 'Zaawansowana korozja nakrętki i podkładki jednej z kotew stalowej konstrukcji schodów.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5; PN-EN 1090-2', 'Wykonać konserwację antykorozyjną śrub i łączników kotwiących schodów zewnętrznych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P04', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Luźne lub brakujące nakrętki śrub mocujących schody zewnętrzne wewnątrz wieży (NB)', 'Śruby mocujące schody do wieży od wewnątrz posiadają luzy lub brakuje nakrętek.

Podstawa prawna: —', 'Wymienić, dokręcić lub uzupełnić luźne/brakujące śruby mocujące schody zewnętrzne.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P05', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Pęknięcie profilu poręczy balustrady schodowej zewnętrznej (K)', 'Wzdłużne, głębokie pęknięcie (rozerwanie) stalowej rury pochwytu barierki schodów zewnętrznych.

Podstawa prawna: —', 'Naprawić pękniętą poręcz balustrady schodów zewnętrznych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P06', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Brak jednego stopnia na schodach wejściowych do turbiny (K)', 'Brakujący stopień na schodach wejściowych – ryzyko upadku.

Podstawa prawna: —', 'Uzupełnić brakujący stopień na schodach wejściowych do turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P07', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Korozja łączników śrubowych mocujących stopnie schodów zewnętrznych (K)', 'Postępująca korozja powierzchniowa łbów śrub mocujących stopnie do ramy bocznej.

Podstawa prawna: —', 'Wykonać konserwację antykorozyjną łączników śrubowych schodów zewnętrznych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P08', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Skażenia biologiczne (glony, mech) na powierzchni stopni schodów zewnętrznych (K)', 'Nagromadzenie zanieczyszczeń biologicznych (glony/mech) na stopniach antypoślizgowych – ryzyko poślizgnięcia.

Podstawa prawna: —', 'Oczyścić schody zewnętrzne ze skażeń biologicznych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P09', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Korozja wżerowa słupka i krawędzi drzwi wejściowych w rejonie kratek wentylacyjnych (K)', 'Głęboki ubytek korozyjny na krawędzi pionowej słupka drzwi; złuszczona powłoka, ciemnobrązowe wżery.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację antykorozyjną drzwi wejściowych do turbiny (rejon kratek i słupek).', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P10', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Ogniska korozji i ubytki powłok malarskich na konstrukcji schodów zewnętrznych (K)', 'Ogniska korozji i ubytki powłok malarskich na konstrukcji schodów.

Podstawa prawna: —', 'Wykonać konserwację powłok malarskich na zewnętrznej konstrukcji schodów.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P11', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Brak pełnego zakotwienia stopy schodów zewnętrznych do betonowego podłoża (NB)', 'Puste otwory montażowe w stopie stalowej schodów – brak kotew.

Podstawa prawna: PN-EN 1504-9', 'Zakotwić schody zewnętrzne wejściowe do turbiny do podłoża betonowego.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P12', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Spękania i rysy na pionowej części cokołu fundamentowego (K)', 'Pionowe i ukośne pęknięcia na powierzchni pionowej cokołu fundamentowego.

Podstawa prawna: PN-EN 1504-3', 'Naprawić spękania i rysy na pionowej części cokołu fundamentowego.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P13', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Nalot biologiczny na izolacji poziomej i pionowej cokołu fundamentowego (K)', 'Gęsty nalot biologiczny (mchy, algi, porosty) na poziomej i pionowej powierzchni cokołu.

Podstawa prawna: PN-EN 1504-2', 'Wykonać konserwację izolacji poziomej i pionowej cokołu; oczyścić ze skażeń biologicznych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P14', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Degradacja biologiczna i ubytki betonu na powierzchni cokołu fundamentowego (NB)', 'Gęsty nalot mchu i porostów na cokołu; wykwity solne i wytarcia powłok – długotrwałe działanie wilgoci.

Podstawa prawna: PN-EN 1504-3', 'Naprawić ubytki betonu na żelbetowym cokołu fundamentowym; oczyścić i wykonać konserwację.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P15', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Liczne drobne rysy, pęknięcia i raki na całej powierzchni cokołu betonowego (NB)', 'Rysy, pęknięcia i ubytki strukturalne (raki) na powierzchni cokołu – odsłonięte kruszywo, zwiększona porowatość.

Podstawa prawna: PN-EN 1504-3', 'Wykonać warstwę wyrównującą wierzchnią warstwę cokołu fundamentowego.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P16', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Korozja i uszkodzenia powłoki lakierniczej w dolnej zewnętrznej części wieży przy cokołu (K)', 'Liniowe ogniska korozji na łączeniu segmentów/kołnierzu; punktowe uszkodzenia powłoki lakierniczej.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację powłok malarskich zewnętrznej strony wieży w obrębie połączenia z cokołem.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P17', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Zarastanie opaski brukowej wokół fundamentu trawą i chwastami (K)', 'Opaska z kostki brukowej silnie porośnięta trawą i chwastami; roślinność nachodzi na cokół.

Podstawa prawna: —', 'Oczyścić opaskę z roślinności; odchwaszczonować szczeliny między elementami.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P18', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Korozja stalowej konstrukcji wsporczej paneli fotowoltaicznych (K)', 'Korozja powierzchniowa na profilach wsporczych, szczególnie w miejscach styku z ramami modułów.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać punktową konserwację antykorozyjną elementów konstrukcji wsporczej paneli fotowoltaicznych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P19', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Korozja stalowej balustrady prowadzącej do placu turbiny (K)', 'Zaawansowana korozja powierzchniowa na całej długości profilu stalowej barierki prowadzącej do placu.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację antykorozyjną balustrady prowadzącej do placu turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P20', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Zastoiska wodne na placu montażowym przy fundamencie turbiny (NB)', 'Rozległe zastoisko wody bezpośrednio przy cokołu; problemy z drenażem terenu.

Podstawa prawna: PN-EN 1504-9', 'Poprawić odprowadzanie wody z placu montażowego; rozważyć studnie chłonne.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P21', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Odpady pozostawione na placu manewrowym przy turbinie (K)', 'Zniszczone elementy tablicy informacyjnej i drewniane łaty porzucone w trawie placu.

Podstawa prawna: —', 'Zutylizować odpady komunalne z terenu placu manewrowego.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P22', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Korozja i uszkodzenia powłoki lakierniczej drzwi do rozdzielnicy i budynku (K)', 'Ogniska korozji i pęcherzenie powłoki lakierniczej na dolnych krawędziach drzwi do rozdzielnicy.

Podstawa prawna: —', 'Wykonać konserwację antykorozyjną drzwi stacji rozdzielnicy z poprawkami powłoki lakierniczej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P23', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Zanieczyszczenie terenu przy fundamencie odpadami bytowymi (K)', 'Foliowe opakowania i szklane butelki porzucone bezpośrednio przy fundamencie.

Podstawa prawna: PN-EN 1504-9', 'Uprzątnąć teren wokół fundamentu z odpadów niezwiązanych z pracą turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P24', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Nadmierna roślinność wokół turbiny i stacji kontenerowej – niewystarczające koszenie (K)', 'Gęsta, wysoka i nieskoszona trawa przy schodach, fundamencie i ścianach stacji.

Podstawa prawna: PN-EN 1504-9', 'Kontynuować koszenie roślinności wokół obiektów 1–2 razy do roku.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('P25', 'Pozostałe', '9. Otoczenie, drogi, ogrodzenie / inne', 'Zaleganie posypki papy w rynnach budynku stacji (K)', 'Znaczna ilość zalegającej posypki mineralnej z papy w korycie rynnowym – ryzyko niedrożności.

Podstawa prawna: —', 'Wyczyścić rynny z zalegającej posypki papy.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S01', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Ubytki i degradacja izolacji pionowej pasa przyziemia stacji kontenerowej (K)', 'Wyraźne ubytki, łuszczenie i degradacja czarnej powłoki izolacyjnej w pasie przyziemia budynku.

Podstawa prawna: PN-EN 1504-2; PN-EN 1504-3', 'Wykonać nową/odremontować izolację pionową stacji kontenerowej w pasie przyziemia.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S02', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Zabrudzenia i pozostałości po insektach na sufitach i w narożach stacji (K)', 'Liczne czarne punkty (odchody/kokony insektów) na sufitach i narożnikach; kurz i martwe owady.

Podstawa prawna: —', 'Oczyścić wnętrze stacji z zabrudzeń i pozostałości po insektach.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S03', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Ogólne zabrudzenia wnętrza stacji pomiarowej (K)', 'Kurz, pajęczyny i zabrudzenia stałe na posadzce przy rozdzielnicy i elementach elektrycznych.

Podstawa prawna: PN-EN 62305-3', 'Oczyścić wnętrze stacji pomiarowej z zabrudzeń.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S04', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Opaska wokół stacji kontenerowej zarosła roślinnością (K)', 'Opaska wokół stacji prawie całkowicie porośnięta gęstą trawą zarastającą przy fundamencie.

Podstawa prawna: —', 'Oczyścić opaskę wokół stacji z roślinności.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S05', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Zabrudzenia i insekty na i wokół szaf sterowniczych stacji (K)', 'Pajęczyny, kurz i martwe insekty na ścianach, sufitach i przy szafach kablowych.

Podstawa prawna: —', 'Wykonać czyszczenie/odkurzanie szaf sterowniczych z insektów i innych zabrudzeń.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S06', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Zaleganie gruntu (piasku) w dolnej sekcji fundamentowej stacji – nieszczelność przepustów (K)', 'Znaczna ilość zalegającego gruntu przy wprowadzeniach kablowych – możliwa nieszczelność przepustów.

Podstawa prawna: PN-EN 1504-9', 'Wyczyścić dolną sekcję fundamentową stacji; zaślepić puste przepusty kablowe.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S07', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Teren wokół stacji kontenerowej zarosły gęstą roślinnością (K)', 'Wysoka nieskoszona trawa i chwasty zasłaniające kratki wentylacyjne i przylegające do ścian.

Podstawa prawna: —', 'Przyciąć roślinność wokół stacji kontenerowej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S08', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Złuszczenia powłok malarskich elewacji stacji i wytarcia izolacji pionowej (K)', 'Złuszczenia i odpryski powłoki pod okapem; wytarcia izolacji pionowej cokołu; naloty organiczne na narożach.

Podstawa prawna: PN-EN 1504-2; PN-EN 1504-3', 'Wykonać konserwację i naprawy pęknięć wypraw elewacyjnych i złuszczeń powłok stacji.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S09', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Uprawy rolne prowadzone zbyt blisko ściany stacji kontenerowej (K)', 'Prace polowe w zbyt bliskiej odległości – brak pasa technicznego; ryzyko uszkodzeń mechanicznych.

Podstawa prawna: —', 'Odsunąć uprawy rolne od stacji kontenerowej; zachować wymagany pas techniczny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S10', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Uszkodzenie blokady drzwi stacji i wgniecenia na zewnętrznej powierzchni drzwi (NB)', 'Pęknięcie/brak uchwytu blokady drzwi; wgniecenia i odpryski powłoki lakierniczej na skrzydłach.

Podstawa prawna: —', 'Naprawić blokadę drzwi i usunąć punktowe uszkodzenia powłoki drzwi wejściowych stacji.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S11', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Zacieki, wykwity i łuszczenie się farby wewnątrz stacji pomiarowej (K)', 'Zacieki, przebarwienia, spękania tynku i łuszczenie farby na wewnętrznych ścianach stacji.

Podstawa prawna: PN-EN ISO 12944-5', 'Odświeżyć powłoki malarskie wnętrza stacji pomiarowej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S12', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Brak możliwości otwarcia drzwi stacji wskutek awarii mechanizmu zamka (K)', 'Mechanizm ryglowania nie zwalnia blokady mimo posiadania klucza – brak dostępu do stacji.

Podstawa prawna: —', 'Wykonać regulację i smarowanie mechanizmu ryglowania drzwi wejściowych do stacji.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S13', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Całkowite zniszczenie mechanizmu zamka drzwi wejściowych do stacji kontenerowej (NB)', 'Wkładka wraz z elementami mocującymi wyrwana z gniazda; puste gniazdo montażowe w drzwiach.

Podstawa prawna: —', 'Wymienić zniszczony zamek drzwi wejściowych do stacji kontenerowej.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S14', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Oderwane ramię ogranicznika drzwi wejściowych do stacji (K)', 'Ramię ogranicznika całkowicie oderwane od punktu mocowania na ościeżnicy; ryzyko gwałtownego otwarcia.

Podstawa prawna: —', 'Naprawić uszkodzony ogranicznik drzwi wejściowych do stacji.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S15', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Stojąca woda w dolnej sekcji fundamentowej stacji – zagrożenie instalacji elektrycznych (NB)', 'Wysoki poziom stojącej wody w sekcji technicznej stacji; konieczne użycie pompy zanurzeniowej.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5', 'Zlokalizować źródło wody; wykonać roboty naprawcze i zabezpieczyć dolną sekcję przed zalewaniem.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S16', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Widoczne przechylenie stacji kontenerowej względem poziomu (NB)', 'Niestabilność podłoża lub błąd zagęszczenia gruntu pod fundamentem – widoczne przechylenie obiektu.

Podstawa prawna: PN-EN 1504-9', 'Wykonać wyrównanie i wypoziomowanie posadowienia stacji kontenerowej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S17', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Materiały eksploatacyjne i odpady składowane wewnątrz stacji pomiarowej (K)', 'Kartonowe opakowania i worki pozostawione wewnątrz stacji – niezwiązane z jej funkcjonowaniem.

Podstawa prawna: —', 'Usunąć z wnętrza stacji przedmioty niezwiązane z jej funkcjonowaniem.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S18', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Zarysowania krawędzi płyty dachowej stacji kontenerowej (K)', 'Wyraźne zarysowania krawędzi płyty dachowej; stacja widocznie przechylona – naprężenia konstrukcyjne.

Podstawa prawna: PN-EN 1504-3', 'Zabezpieczyć zarysowania krawędzi płyty dachowej stacji; wdrożyć obserwację.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S19', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Zalewanie dolnej sekcji i ogólne zabrudzenia wnętrza stacji (NB)', 'Stojąca, brudna woda zakrywająca kable i wejścia peszel w dolnej sekcji stacji.

Podstawa prawna: PN-EN 1504-9; PN-EN ISO 12944-5', 'Zlokalizować źródło wody w sekcji fundamentowej stacji; wykonać izolacyjne roboty naprawcze i osuszyć.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S20', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Zerwany fragment papy termozgrzewalnej na dachu stacji kontenerowej (K)', 'Mechaniczne zerwanie warstwy hydroizolacyjnej na krawędzi dachu; odsłonięta konstrukcja betonowa.

Podstawa prawna: PN-EN 1504-2', 'Naprawić/uzupełnić zerwany fragment papy na dachu stacji; sprawdzić ciągłość hydroizolacji.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S21', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Skażenia biologiczne (mchy, porosty) na dachu i krawędziach stacji (K)', 'Rozległe pomarańczowe i szare porosty oraz mech na całej powierzchni daszku betonowego stacji.

Podstawa prawna: PN-EN 1504-2', 'Oczyścić dach ze skażeń biologicznych; poprawić hydroizolację dachu.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S22', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Nieprawidłowe spadki terenu wokół stacji powodujące gromadzenie się wody przy fundamencie (NB)', 'Nierówny teren; przemieszczone płyty opaski bez spadków zewnętrznych – woda gromadzi się przy konstrukcji.

Podstawa prawna: PN-EN 1504-2', 'Wyprofilować teren wokół stacji w celu poprawy odprowadzenia wody opadowej i roztopowej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S23', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Zawilgocenia i zaleganie gruntu w dolnej sekcji stacji – konieczna lokalizacja źródła (K)', 'Ślady zastoisk wodnych i zalegający grunt w piwnicy kablowej stacji.

Podstawa prawna: PN-EN 1504-9', 'Wyczyścić piwnicę kablową stacji; zlokalizować i zlikwidować źródło zanieczyszczeń.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S24', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Pęknięcie płyty dennej wewnątrz stacji kontenerowej (NB)', 'Pęknięcie płyty dennej odsłaniające wodę zalegającą w sekcji fundamentowej.

Podstawa prawna: PN-EN 1504-9', 'Naprawić pękniętą płytę denną stacji kontenerowej; uszczelnić.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S25', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Skażenia biologiczne i łuszczenie powłoki malarskiej stalowych drzwi stacji (K)', 'Mchy i porosty na elewacji i drzwiach; rozległe łuszczenie farby na metalowych skrzydłach.

Podstawa prawna: PN-EN ISO 12944-5', 'Wykonać konserwację powłok malarskich stalowych drzwi stacji, w tym progu wewnętrznego.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S26', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Stojąca woda w sekcji fundamentowej stacji – nieszczelność przepustów kablowych (NB)', 'Znaczna ilość stojącej brudnej wody w dolnej sekcji technicznej; nieszczelne przepusty kablowe.

Podstawa prawna: PN-EN 1504-9', 'Uszczelnić przepusty kablowe i styki segmentów stacji; wyeliminować penetrację wody.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S27', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Oderwana od ściany puszka instalacyjna na zewnętrznej ścianie stacji (K)', 'Puszka instalacyjna zwisająca na przewodzie zasilającym oderwana od zewnętrznej ściany stacji.

Podstawa prawna: PN-EN 62305-3', 'Przymocować puszkę instalacyjną do zewnętrznej ściany stacji.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S28', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Płyty betonowe opaski pochylone w kierunku stacji – woda spływa pod fundament (NB)', 'Płyty opaski pochylone ku ścianom budynku; woda spływa pod fundament zamiast na zewnątrz.

Podstawa prawna: PN-EN 1504-9', 'Wyprofilować pochylone płyty opaski wokół stacji z prawidłowym spadkiem od budynku.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('S29', 'Stacja', '13. Infrastruktura towarzysząca / Stacja', 'Osiadłe i zarosłe płyty chodnikowe opaski wokół stacji kontenerowej (K)', 'Płyty chodnikowe opaski zapadnięte (szczególnie w strefach narożnych); silnie zarosłe trawą.

Podstawa prawna: PN-EN 1504-9', 'Wyrównać osiadłe płyty opaski (głównie narożniki) i odchwaszczonować.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L01', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Zabrudzenia eksploatacyjne na podestach w górnych sekcjach wieży (K)', 'Zabrudzenia i plamy (w tym czerwona – wyciek płynu technicznego?) na stalowych podestach.

Podstawa prawna: —', 'Oczyścić podesty w górnych sekcjach wieży z zabrudzeń eksploatacyjnych.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L02', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Uszkodzenie trzech wyłączników różnicowoprądowych (28F2, 28F1, 26F1) w szafie sterowniczej gondoli (NB)', 'Miernik Sonel MPI wykazał błąd pomiaru i brak napięcia w gnieździe za szafą sterowniczą gondoli.

Podstawa prawna: PN-EN 61400', 'Niezwłocznie wymienić uszkodzone wyłączniki różnicowoprądowe 28F2, 28F1, 26F1.', 'I');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L03', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Uszkodzone gniazdo elektryczne i niedziałające oświetlenie w sekcji YAW i wieży (NB)', 'Uszkodzone gniazdo przy drabinie w YAW; niesprawne punkty oświetleniowe w wieży i YAW.

Podstawa prawna: PN-EN ISO 12944-5; PN-EN 353-1', 'Wymienić gniazdo elektryczne i naprawić/wymienić niesprawne oprawy oświetleniowe w sekcji YAW i wieży.', 'I');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L04', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Luzy montażowe zamka podestu przy pętli kablowej (cable loop) pod sekcją YAW (K)', 'Element ryglowania podestu przy cable loop wykazuje luzy – ryzyko niekontrolowanego otwarcia.

Podstawa prawna: —', 'Dokręcić i wyregulować zamek podestu przy cable loop pod sekcją YAW.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L05', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Ślady smaru na wale wolnoobrotowym gondoli (K)', 'Nadmiar rozbryzganego i zalegającego smaru na wale wolnoobrotowym i uszczelnieniach.

Podstawa prawna: PN-EN 61400', 'Wyczyścić nadmiar smaru z wału wolnoobrotowego wewnątrz gondoli.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L06', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Ślady wycieku smaru z sekcji YAW na ściany wieży i elementy śrubowe (K)', 'Świeże ślady wycieku czerwonego smaru z łożyska obrotu gondoli (YAW) spływające na ścianę wieży.

Podstawa prawna: PN-EN 1504-9; PN-EN 61400', 'Wyczyścić smar z wału, sekcji YAW i okolic połączeń śrubowych; sprawdzić uszczelnienie YAW.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L07', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Uszkodzenie ramy prowadzącej włazu wyjściowego na dach gondoli (K)', 'Rozłączone elementy ramy aluminiowej włazu – brak możliwości prawidłowego domknięcia; ryzyko penetracji wody.

Podstawa prawna: PN-EN 61400', 'Naprawić uszkodzoną ramę włazu wyjściowego na dach gondoli.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L08', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Stojąca woda w stalowej konstrukcji wsporczej transformatora przy różku uziemiającym (K)', 'Woda w profilu wsporczym transformatora bezpośrednio przy punkcie montażowym różka uziemiającego.

Podstawa prawna: PN-EN ISO 12944-5; PN-EN 62305-3', 'Zlokalizować i zlikwidować źródło cieczy w konstrukcji wsporczej transformatora przy różku uziemiającym.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L09', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Mechaniczne uszkodzenie (wygięcie) ostatniego szczebla drabiny między podestem windy a gondolą (K)', 'Wygięty/odkształcony ostatni szczebel drabiny na odcinku podest windy – gondola.

Podstawa prawna: PN-EN 353-1; PN-EN 61400', 'Naprawić lub wymienić uszkodzony szczebel drabiny na odcinku podest windy – gondola.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L10', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Liczne zacieki smaru na wewnętrznej ścianie wieży pod wieńcem obrotu gondoli (YAW) (K)', 'Ciemne zacieki smaru spływające z łożyska YAW na kołnierz wieży, zanieczyszczające śruby i okablowanie.

Podstawa prawna: PN-EN 61400', 'Wyczyścić zacieki smaru w sekcji YAW; sprawdzić uszczelnienie wieńca łożyskowego.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L11', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Ślady smaru na wale wolnoobrotowym i brak osłon śrub przy głównym łożysku (K)', 'Rozbryzgany smar na wale; brak wymaganej osłony śrub montażowych łożyska głównego.

Podstawa prawna: PN-EN 61400', 'Zamontować brakujące osłony śrub przy głównym łożysku gondoli.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L12', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Uszkodzenie wyłącznika różnicowoprądowego 28X1 (28F1) – znacznik czerwony (NB)', 'Wyłącznik 28X1 (28F1) ze znacznikiem czerwonym – awaria wewnętrznego mechanizmu wyzwalającego.

Podstawa prawna: PN-EN 61400', 'Niezwłocznie wymienić uszkodzony wyłącznik różnicowoprądowy 28X1 (28F1).', 'I');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L13', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Zbyt wysoka wartość rezystancji uziemienia ZK-5 (58,8 Ω) (NB)', 'Miernik wskazał R_E = 58,8 Ω – wartość przekraczająca wymagania norm dla instalacji uziemiającej.

Podstawa prawna: PN-EN 62305-3', 'Naprawić uziemienie ZK-5 lub uzyskać opinię projektanta w sprawie możliwości rezygnacji z ZK-3.', 'II');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L14', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Podesty zabrudzone; luźno leżący metalowy element osłony na platformie wewnątrz wieży (K)', 'Metalowa płyta osłonowa leżąca luźno na podeście przy przejściu kablowym i włazie.

Podstawa prawna: PN-EN 353-1', 'Oczyścić podesty; uprzątnąć i zamontować we właściwym miejscu element osłony z platformy.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L15', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Brak jednej osłony śruby (kapturka) na wieńcu mocowania łopaty do piasty (K)', 'Brak białego kapturka ochronnego na jednej nakrętce śruby dwustronnej łopaty–piasta.

Podstawa prawna: PN-EN 61400', 'Uzupełnić brakującą osłonę (kapturek) śruby mocowania łopaty do piasty wirnika.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L16', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Plamy smaru i oleju na podestach w górnych sekcjach wieży (K)', 'Plama substancji smarnej na aluminiowej płycie podestu przy styku z płaszczem wieży.

Podstawa prawna: —', 'Oczyścić podesty i inne zabrudzone elementy wyposażenia turbiny ze środków smarnych w górnych sekcjach.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L17', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Mechaniczne pęknięcie aluminiowego obramowania włazu wyjściowego na dach gondoli (K)', 'Przerwana ciągłość aluminiowego profilu obramowania wyłazu; ogniska korozji na łącznikach śrubowych.

Podstawa prawna: PN-EN 61400', 'Naprawić lub wymienić uszkodzone obramowanie włazu wyjściowego na dach gondoli.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L18', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Pionowe zacieki zużytego smaru z łożyska YAW na wewnętrznej ścianie górnych sekcji wieży (K)', 'Długotrwałe zacieki ciemnego smaru spod bieżni łożyska YAW; ilość wskazuje na uszkodzenie uszczelnienia.

Podstawa prawna: PN-EN 61400', 'Oczyścić z nadmiaru smaru wnętrze wieży w górnych sekcjach; sprawdzić uszczelnienie łożyska YAW.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L19', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Uszkodzenie (pęknięcie) czarnego zabezpieczenia (stopki) końca profilu drabiny w sekcji YAW (K)', 'Głębokie pęknięcie i ubytki polimeru stopki końca podłużnicy drabiny aluminiowej; odsłonięta krawędź.

Podstawa prawna: PN-EN 353-1', 'Naprawić lub wymienić uszkodzone zabezpieczenie (stopkę) drabiny w sekcji YAW.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L20', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Pionowe zacieki zużytego smaru z uszczelnienia łożyska wieńcowego YAW – górne sekcje wieży (K)', 'Ciemnobrunatne ślady smaru spływające pionowo po ścianie; nieszczelność uszczelnienia lub nadmierne smarowanie.

Podstawa prawna: —', 'Oczyścić wnętrze wieży z nadmiaru smaru w górnych sekcjach; sprawdzić dawkowanie smarownicy automatycznej.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L21', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Uszkodzenie stopki drabiny aluminiowej w sekcji YAW (K)', 'Pęknięta i częściowo wykruszona stopka (guma/tworzywo) na zakończeniu podłużnicy drabiny.

Podstawa prawna: PN-EN 353-1', 'Wymienić uszkodzoną stopkę drabiny aluminiowej w sekcji YAW.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L22', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Uszkodzone / niesprawne źródło światła na poziomie wejściowym turbiny (NB)', 'Niesprawna hermetyczna oprawa oświetleniowa na poziomie wejściowym – brak światła.

Podstawa prawna: —', 'Naprawić / wymienić niesprawną lampę na poziomie wejściowym turbiny.', 'III');
INSERT INTO defect_library (code, category, element_section, name_pl, description_template, recommendation_template, typical_urgency) VALUES ('5L23', '5-letnie', '5L – zakres rozszerzony (kontrola 5-letnia)', 'Zabezpieczenia nadprądowe o charakterystyce D na obwodach gniazd wieży – niezgodność z ochroną p.porażeniową (NB)', 'Zabezpieczenia char. D nie spełniają wymogu szybkiego wyłączenia ochrony p.porażeniowej dla gniazd w wieży.

Podstawa prawna: PN-EN 62305-3', 'Wymienić zabezpieczenie nadprądowe na obwodzie gniazd wieży (char. B) lub wymienić oprzewodowanie gniazd.', 'I');

-- STAN PO
SELECT 'after' AS phase, COUNT(*) AS total, COUNT(DISTINCT category) AS kategorii FROM defect_library;

COMMIT;

-- ROLLBACK: nie trywialny, uzyj defect_library_backup_2026-04-30.xlsx do restore
