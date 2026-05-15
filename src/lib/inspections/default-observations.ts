/**
 * TYMCZASOWY FALLBACK — domyślne „Opis stanu technicznego" per element_number.
 *
 * Docelowo treści żyją w kolumnie `inspection_element_definitions.default_observation`
 * (migracja `2026-05-15_default_observation_seed.sql`). Ten plik jest
 * używany jako fallback gdy `def.default_observation === null` — co pozwala
 * uruchomić podgląd PDF bez konieczności wgrania migracji na produkcję.
 *
 * Po uruchomieniu migracji ten fallback nie jest już potrzebny. Wartości
 * tu i w migracji MUSZĄ być identyczne. Po wgraniu migracji można ten plik
 * usunąć i wywalić import w `src/app/api/pdf/[id]/route.ts` + `docx/route.ts`.
 *
 * Treści zaakceptowane przez Waldka 2026-05-15 (sesja 18 formułek po jednej).
 */

export const DEFAULT_OBSERVATIONS_BY_ELEMENT_NUMBER: Record<number, string> = {
  1: 'W trakcie kontroli dokonano oceny wizualnej fundamentu. W wyniku przeprowadzonych oględzin nie stwierdzono poważnych rys i pęknięć na powierzchni mogących być konsekwencją nierównomiernego osiadania obiektu i uszkodzenia fundamentu. Nie stwierdzono uszkodzeń mogących mieć wpływ na wartości użytkowe fundamentu.',

  2: 'W trakcie przeprowadzonej kontroli sprawdzono oznaczenia kontrolne (markery momentu dokręcenia) na śrubach kołnierzowych segmentów wieży. Brak oznak rdzy na śrubach i kołnierzach łączących poszczególne sekcje wieży. Stan zabezpieczeń antykorozyjnych połączeń kołnierzowych — prawidłowy. Nie stwierdzono wycieków smaru/oleju wokół flansz ani luzów stykających się płaszczyzn.',

  3: 'W trakcie przeprowadzonej kontroli nie stwierdzono śladów korozji na styku elementu kotwiącego z pierwszym elementem rurowym po stronie zewnętrznej oraz na kołnierzu sekcji kotwiącej wewnątrz obiektu. Brak oznak rdzy na śrubach i kołnierzach łączących poszczególne sekcje wieży. Kontrola docisku połączeń poszczególnych elementów wieży objęta jest w zakresie obsługi serwisowej.',

  4: 'W trakcie kontroli dokonano oceny wizualnej — poszczególne elementy nie wykazują nadmiernego zużycia, nie stwierdzono nieprawidłowości na łączeniu wieży z łożyskiem układu kierunkowania, brak wycieków i plam oleju wewnątrz gondoli. Stan poszycia gondoli — dobry. Stan wyposażenia gondoli podlega czynnościom serwisowym.',

  5: 'W trakcie przeprowadzonej kontroli sprawdzono stan łożyska wieńcowego azymutu (yaw bearing) — brak nietypowych dźwięków i drgań przekazywanych na konstrukcję podczas obrotu gondoli. Nie stwierdzono wycieków smaru spod łożyska ani nieprawidłowości połączeń śrubowych flansza wieża–łożysko. Stan napędów azymutu (yaw drives) — bez uwag. Stan łożyska i jego smarowania podlega czynnościom serwisowym.',

  6: 'W trakcie kontroli dokonano oceny wizualnej — poszczególne elementy nie wykazują nadmiernego zużycia, nie stwierdzono rys, spękań, ubytków na łopatach a także nieprawidłowości na łączeniu łopat z piastą. Stan poszycia łopat — dobry. Stan łopat podlega czynnościom serwisowym.',

  7: 'W trakcie przeprowadzonej kontroli sprawdzono stan połączenia piasta–wał główny — brak wycieków smaru i plam oleju w obszarze łożyska głównego. Nie stwierdzono nietypowych dźwięków, drgań ani podwyższonej temperatury przekazywanej na konstrukcję. Stan systemu pitch (łożyska łopat, kable) podlega czynnościom serwisowym.',

  8: 'W trakcie przeprowadzonej kontroli dokonano oceny wizualnej platform oraz podestów spoczynkowych. Kontrolowane obiekty nie wykazują nadmiernego zużycia. Montaż platform oraz podestów spoczynkowych — prawidłowy. Drabina wewnętrzna z systemem zabezpieczającym przed upadkiem z wysokości — bez deformacji, uszkodzeń i oznak korozji. Punkty zaczepienia i łączniki prawidłowe. Sprawdzono poprawność mocowania mechanizmu samozaciskowego — prawidłowy.',

  9: 'W trakcie przeprowadzonej kontroli dokonano oceny wizualnej urządzeń ewakuacyjno-ratunkowych. Zestaw sprzętu ratowniczego do zjazdu awaryjnego — odpowiednio oznakowany. Data ważności przeglądu sprzętu ratowniczego — aktualna. Apteczka pierwszej pomocy — kompletna i w stanie używalności. Plan ewakuacji — czytelny i aktualny.',

  10: 'W trakcie kontroli nie stwierdzono oznak nadmiernego zużycia schodów zewnętrznych, drzwi i balustrad. Uszczelnienia i zamknięcia drzwi zewnętrznych w stanie prawidłowym. Punkty mocowania balustrad i pochwytów — prawidłowe.',

  11: 'W trakcie przeprowadzonej kontroli nie stwierdzono nadmiernego zużycia tego elementu. Poszczególne elementy połączeń wyrównawczych bez oznak korozji, prawidłowo zabezpieczone wazeliną techniczną bezkwasową. Złącza kontrolne na fundamencie / segmencie 1 — drożne i czytelne.',

  12: 'W trakcie przeprowadzonej kontroli sprawdzono stan instalacji elektrycznej SN/nN — kabli, rozdzielnicy SN-15kV oraz stacji pomiarowej. Nie stwierdzono uszkodzeń izolacji, śladów przegrzewania ani nieprawidłowości oznakowania. Aktualne pomiary elektryczne i protokoły badań dołączone są do dokumentacji obiektu. Czynności serwisowe (pomiary, oględziny) wykonywane są przez wyspecjalizowaną firmę elektroenergetyczną.',

  13: 'W trakcie kontroli dokonano oceny wizualnej prawidłowości rozmieszczenia oznakowania BHP i P-POŻ oraz sprawdzono lokalizację sprzętu p-poż i daty ważności przeglądów gaśnic. Oznakowanie — prawidłowe. Rozmieszczenie sprzętu p-poż — prawidłowe. Daty ważności przeglądów gaśnic — aktualne.',

  14: 'W trakcie kontroli sprawdzono aktualność badań i protokoły odbiorów urządzeń podlegających kontroli Urzędu Dozoru Technicznego. Wszystkie urządzenia posiadają aktualne badania i decyzje dopuszczające do użytkowania podpisane przez inspektora dozoru technicznego. Urządzenia posiadają aktualne dzienniki konserwacji. Na podeście ruchomym oraz przy wciągarce wywieszone instrukcje obsługi.',

  15: 'W trakcie kontroli nie stwierdzono oznak nadmiernego zużycia dróg dojazdowych i placu manewrowego. Nawierzchnia — bez znaczących ubytków, zagłębień i kolein. Odwodnienia drożne.',

  16: 'W trakcie kontroli dokonano oceny wizualnej estetyki obiektu i jego otoczenia. Powłoki malarskie wieży i stacji — utrzymane w stanie zadowalającym. Roślinność wokół fundamentu turbiny i stacji kontenerowej — kontrolowana. Otoczenie obiektu uporządkowane.',

  17: 'Stan techniczny stacji kontenerowo-pomiarowej — dobry. W trakcie kontroli nie zaobserwowano uszkodzeń mogących świadczyć o nieprawidłowym montażu bądź użytkowaniu obiektu. Wyposażenie stacji pomiarowej podlega czynnościom serwisowym. W ramach okresowych przeglądów przeprowadzane są oględziny wszystkich elementów wyposażenia elektroenergetycznego oraz dokonywane pomiary uziomów.',

  18: 'W trakcie przeprowadzonej kontroli dokonano oceny wizualnej instalacji fotowoltaicznej. Panele fotowoltaiczne — bez widocznych pęknięć, zarysowań ani zacienień przez roślinność. Konstrukcja wsporcza — bez śladów korozji, mocowania pewne. Falownik i okablowanie DC — bez sygnalizacji błędów. Pomiary elektryczne instalacji PV objęte odrębnym protokołem.',
}

/**
 * Zwraca tekst „Opis stanu technicznego" dla danego elementu.
 * Priorytet: `inspection_elements.observation` (nadpisanie inspektora) →
 *           `inspection_element_definitions.default_observation` (z bazy) →
 *           fallback mapa w tym pliku (gdy migracja jeszcze nie wgrana).
 *
 * Zwraca `null` gdy żadne źródło nie ma tekstu — w PDF/DOCX sekcja będzie
 * pominięta dla danego elementu.
 */
export function resolveDefaultObservation(
  elementObservation: string | null | undefined,
  defDefaultObservation: string | null | undefined,
  elementNumber: number | null | undefined,
): string | null {
  if (elementObservation && elementObservation.trim()) {
    return elementObservation.trim()
  }
  if (defDefaultObservation && defDefaultObservation.trim()) {
    return defDefaultObservation.trim()
  }
  if (elementNumber != null) {
    const fallback = DEFAULT_OBSERVATIONS_BY_ELEMENT_NUMBER[elementNumber]
    if (fallback) return fallback
  }
  return null
}
