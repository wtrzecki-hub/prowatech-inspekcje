# ProWaTech Inspekcje — nowa identyfikacja wizualna i&nbsp;UX

_Dokument towarzyszący do klikalnego prototypu `prowatech-prototype.html`. Wersja 1.0 · 23.04.2026 · przygotowane dla Waldemara._

---

## 1. Diagnoza obecnego stanu

Aplikacja działa solidnie funkcjonalnie — pełny CRUD, biblioteka defektów, generatory PDF/DOCX, tablet-first formularz. Warstwa wizualna jest natomiast ogólna, „shadcn-default” i nie komunikuje ani charakteru branży OZE, ani marki ProWaTech. Najważniejsze wnioski z przeglądu kodu i odpalenia aplikacji produkcyjnej:

**Spójność marki.** Logo ProWaTech jest wyraźnie zielone (turbina w&nbsp;kształcie domku, forest green), ale interfejs używa generycznego niebieskiego `#2563eb` jako koloru wiodącego. W efekcie jedyny element marki — logotyp — wygląda jak „wklejka” na tle niezwiązanego z nim systemu. Brand zieleni jest „zmarnowany”.

**Gęstość informacji.** Dashboard eksponuje 4 liczby bez kontekstu (brak trendu, sparkline, porównania MoM). Lista inspekcji ma duże wysokości wierszy i dużo pustego powietrza; na ekranie 1440×900 mieści się tylko 6 wierszy, co przy bazie 424 turbin i&nbsp;rosnącej liczbie inspekcji jest niepraktyczne. Tabela nie oddaje hierarchii (wszystkie kolumny mają ten sam waga wizualna).

**Typografia.** Brak rytmicznej skali; duże nagłówki `text-2xl bold` obok drobnych `text-xs text-gray-500` — brak rangi pośredniej. Nie ma systemowego rozróżnienia między danymi (liczby, kody) a treścią (opisy). Użycie jednego kroju sans-serif dla wszystkiego zaciera rolę liczb, które w branży inspekcyjnej są kluczowe.

**Ikonografia.** `Wind` z Lucide zastąpiono logo ProWaTech — dobrze. Ale ikony w KPI cards są neutralne, bez spójnej palety; mieszają się odcienie niebieskiego, żółtego, zielonego, czerwonego w sposób przypadkowy (m.in. avatar `WT` renderuje się w teal/jadeitowym, który nie jest w palecie).

**Formularz inspekcji.** Tablet-first jest dobrze ustawiony (shadcn tabs, większe kontrolki), ale brakuje w nim wskazania postępu i „kotwicy” — inspektor nie widzi na pierwszy rzut oka ile elementów z 26 zostało ocenionych ani która sekcja wymaga dokończenia. Auto-zapis istnieje w logice, ale nie jest sygnalizowany użytkownikowi.

**Portal klienta.** Nie istnieje — cała aplikacja zakłada pojedynczego wewnętrznego użytkownika. To największa luka — klienci-operatorzy farm wiatrowych obecnie dostają protokoły e-mailem lub przez Drive, bez jakiegokolwiek panelu. W propozycji traktuję portal jako osobny product track ze swoim tonem, uproszczoną nawigacją i&nbsp;bezwzględnie read-only widokiem danych.

**Protokół PDF/DOCX.** Dobrze ustrukturyzowany (część I + II, legalna podstawa Prawo budowlane), ale wizualnie „urzędowy lat 90-tych”: brak typograficznej hierarchii, czarne tabele bez kodowania kolorów, logo wklejone w&nbsp;nagłówek. Protokół trafia do&nbsp;klienta, który coraz częściej jest operatorem funduszu OZE — papier powinien komunikować profesjonalizm i&nbsp;sumienność ProWaTech. To&nbsp;jest materiał marketingowy, który podświadomie wpływa na postrzeganie firmy.

---

## 2. Kierunek wizualny

### 2.1. Pozycjonowanie marki

ProWaTech operuje na styku trzech światów: **poważnego polskiego inżynierstwa** (urzędowe uprawnienia budowlane, UDT, Prawo budowlane), **sektora OZE** (zrównoważony rozwój, przyszłość, nowe inwestycje zielone) i **B2B SaaS** (tablet w terenie, portal online, e-mailowa dystrybucja raportów). Propozycja wizualna balansuje te trzy tożsamości poprzez:

- **zieleń ProWaTech** jako kolor podstawowy (kontynuacja tego, co jest w logo — nie blue bliski konkurentom SAP/Siemens, nie cyan typowy dla cleantech startupów, tylko głęboka forestowa zieleń, która czyta jako „las/pole/energia/stabilność”),
- **grafitową neutralność** (ciemno-stalowa paleta graphite) dla warstwy narracyjnej i danych — daje wrażenie poważnego dokumentu,
- **ciepłe akcenty bursztynowe** dla ostrzeżeń — miękciejsze niż czerwony, czytelne w&nbsp;PDF-ach drukowanych,
- **typograficzną dwoistość**: Inter dla tekstu, JetBrains Mono dla numerów, dat, kodów turbin, kluczowych mierzalnych wartości. Liczbom należy się własny krój, bo są najważniejszą treścią produktu.

### 2.2. Tokeny — wartości konkretne

**Kolory marki**

| Token | Wartość | Zastosowanie |
|---|---|---|
| `brand/50` | `#F0F9F1` | Tło kart aktywnych, hover, strefy „OK” |
| `brand/100` | `#DCEFE0` | Tła pomocnicze, chip-tagi |
| `brand/500` | `#2E9F4A` | Akcenty, linie separatorów markowych |
| `brand/600` | `#259648` | **Primary CTA**, ikony aktywne, logo _(decyzja Waldka 23.04.2026: jaśniejszy od logo o ~5%)_ |
| `brand/700` | `#1F7F3A` | Hover na CTA, nagłówki sekcyjne w PDF |
| `brand/800` | `#114B24` | Ciemne tła brandingowe |

**Grafity (neutralne)**

| Token | Wartość | Zastosowanie |
|---|---|---|
| `graphite/50` | `#F7F9FB` | Tło strony |
| `graphite/100` | `#EEF1F5` | Tło tabel nagłówkowych |
| `graphite/200` | `#DDE3EA` | Ramki kart |
| `graphite/500` | `#5F6B7A` | Tekst drugorzędny |
| `graphite/800` | `#1B2230` | Nagłówki |
| `graphite/900` | `#0F1520` | Tekst podstawowy, top-bar demo |

**Semantyka**

| Token | Wartość | Zastosowanie |
|---|---|---|
| `success/500` | `#2E9F4A` (brand) | Ocena „Dobry”, status „Podpisana” |
| `info/500` | `#0284C7` | Ocena „Zadowalający”, status „W toku” |
| `warning/500` | `#F59E0B` | Ocena „Średni”, pilność II |
| `danger/500` | `#DC2626` | Ocena „Awaryjny”, pilność I |

**Typografia**

Rodziny: Inter (sans-serif, zmienne wagi 400–800) + JetBrains Mono (dane liczbowe, wagi 500–600).

Skala (rem / px dla rem = 16px):

- `display/xl` 30px / 800 / -0.02em tracking — nagłówki hero
- `display/lg` 26px / 700 / -0.01em — nagłówki stron
- `heading/md` 18px / 700 — nagłówki sekcji
- `heading/sm` 15px / 700 — nagłówki kart
- `body/lg` 15px / 500 — body podstawowe
- `body/md` 14px / 400 — body tabel
- `body/sm` 13px / 400 — opisy
- `caption` 12px / 500 — metadane
- `label` 11px / 600 / uppercase / 0.08em tracking — etykiety pól, „kapitaliki”

**Przestrzenie** (system 4 px)

`0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96`. Padding kart: 20/24. Padding wiersza tabeli: 12/16. Odstęp między kartami: 20/24.

**Promienie (radius)**

`sm 6px · md 8px · lg 10px · card 14px · pill 999px`. Przycisk: 8–10. Karta podstawowa: 14. Mini-map/thumbnail: 12. Chip: pill.

**Cienie**

- `card` — `0 1px 0 0 rgba(15,23,32,0.03), 0 1px 2px rgba(15,23,32,0.04)` — standardowa karta
- `raised` — `0 4px 12px rgba(15,23,32,0.06), 0 1px 2px rgba(15,23,32,0.04)` — hover, modale niewielkie
- `pop` — `0 12px 32px rgba(15,23,32,0.10), 0 2px 4px rgba(15,23,32,0.05)` — arkusz A4 protokołu
- `focus` — `0 0 0 4px rgba(46,159,74,0.22)` — stan fokusu klawiaturowego na zielono

**Ikony** Lucide, standardowa grubość `1.75`, rozmiary 14/16/20/24. W cards mały 16, w&nbsp;KPI 18, w navigation 18.

### 2.3. Komponenty kluczowe

- **Card** — biała, `radius card`, `shadow card`, `border graphite/100`. Padding 20/24.
- **Button primary** — `bg brand/600`, hover `brand/700`, height 36 (desktop) / 44 (tablet), radius 8, font-weight 600.
- **Button secondary** — biała z ramką graphite/200.
- **Status pill** — `height 22`, font 11/600 uppercase przy 0.04em tracking, radius full, pary kolor tła + tekst per status.
- **Rating pill (ocena)** — ten sam komponent co status pill, w&nbsp;obrębie 5 wartości: dobry (brand), zadowalający (info), średni (amber), zły (orange), awaryjny (danger).
- **Table row** — h&nbsp;52 desktop / 56 tablet, hover `graphite/50`, dzielnik `graphite/100`, pierwsza kolumna często identyfikatorem w JetBrains Mono z wagą 600.
- **Sidebar nav item** — radius 10, padding 8/12, aktywny stan: `bg brand/50`, text `brand/700`, lewy pasek 3px `brand/500`.
- **Metric KPI card** — liczba w Mono 32–36, label caption, sparkline lub chip trendu pod spodem.

### 2.4. Kontynuacja vs zmiana

Kontynuujemy: logo (znak zostaje w&nbsp;aktualnej formie, tylko unifikujemy paletę wokół niego), Polish-first copy, tablet-first formularz, strukturę protokołu (CZĘŚĆ I / CZĘŚĆ II / ZALECENIA).

Zmieniamy: paletę kolorów (niebieska → zielono-grafitowa), typografię (Inter + Mono zamiast jednej rodziny), IA (nowa wierzchnia nawigacja dla Portalu klienta), hierarchię nagłówków, skróty w tabelach (użycie Mono), layout protokołu PDF (kolorystyczne kodowanie oceny elementów, minikarty inspektora).

**Brand continuity — protokoły.** Protokoły (dokumenty wychodzące do&nbsp;klientów i&nbsp;urzędów) zachowują oryginalne logo ProWaTech bez&nbsp;modyfikacji — to decyzja klienta ze&nbsp;względu na&nbsp;rozpoznawalność marki w&nbsp;oficjalnych dokumentach przekazywanych organom nadzoru i&nbsp;operatorom farm. W&nbsp;prototypie HTML strony protokołu (`data-context="doc"`, 3 arkusze A4) używają `public/logo-prowatech.png` osadzonego jako base64 data&nbsp;URI — identycznego zasobu co&nbsp;produkcyjny generator PDF (`src/app/api/pdf/[id]/route.ts`, `addImage 30×18 mm`). Ujednolicanie palety i&nbsp;typografii dotyczy tylko warstwy wokół logo (nagłówki, tabele, kodowanie kolorystyczne ocen) — sam znak graficzny pozostaje nienaruszony. Uproszczony „znak zastępczy” (stylizowany dom/turbina w&nbsp;SVG) używany jest&nbsp;nadal w&nbsp;panelu inspektora i&nbsp;portalu klienta jako element wewnętrznego UI — tam nie&nbsp;ma&nbsp;wymogu 1:1 zgodności z&nbsp;formalnym logotypem.

---

## 3. Mapa ekranów prototypu

### Panel inspektora (wewnętrzny)

1. **Dashboard** — zamiast 4 „liczniki bez kontekstu” proponujemy KPI + sparkline/chip trendu, kalendarz inspekcji jako widok 14-dniowy z&nbsp;wyróżnieniem dziś, listę najpilniejszych zaleceń z&nbsp;kodem kolorystycznym pilności, i&nbsp;mini-bar-chart rozkładu ocen technicznych (warunek: w prawdziwych danych mamy ich pełny zbiór, więc to zero-kosztowy sygnał jakości rynku).
2. **Klienci** — tabela z&nbsp;ikoną inicjałową, liczbą farm/turbin, łączną mocą i&nbsp;średnią oceną. Pozwala szybko zidentyfikować „trudnych” klientów (czerwone chipy).
3. **Klient · szczegół** — header z&nbsp;KPI klienta + tabs do&nbsp;farm/turbin/inspekcji/kontaktów/dokumentów. Domyślnie pokazane farmy jako karty z&nbsp;chip-statusem zdrowia.
4. **Farmy** — widok grid kart z&nbsp;mini-mapą i&nbsp;kodowaniem kolorystycznym turbin (OK / Uwaga / Pilne). Ten widok jest kluczowy: w&nbsp;terenie inspektor patrzy na farmę, nie na&nbsp;klienta.
5. **Farma · szczegół** — duża mapa farmy z&nbsp;rozmieszczeniem turbin (punkty), tabela turbin, time-line aktywności z prawej strony. Oferuje natychmiastowy sytuacyjny overview, jakiego nie daje aktualna wersja.
6. **Turbiny** — katalog z&nbsp;filtrami po producentach, farmach, modelach.
7. **Turbina · szczegół** — najważniejszy ekran diagnostyczny: headliner w&nbsp;ciemnym grafitowym zaznacza „to nie&nbsp;obiekt administracyjny, to&nbsp;maszyna”. Wykres oceny technicznej w&nbsp;czasie (SVG line chart po 6 inspekcjach), karty ostatnia kontrola + najbliższe przeglądy, zakładki: Przegląd, Historia inspekcji, Zalecenia, Zdjęcia, Certyfikaty.
8. **Inspekcje — lista** — gęsta tabela z&nbsp;filtrami aktywnymi jako chipy, sortowaniem, paginacją, selekcją multi-row (przygotowanie pod bulk-export).
9. **Formularz inspekcji (tablet-first)** — sticky bar z&nbsp;nazwą inspekcji + pasek postępu + status auto-zapisu („Zapisano 14:36” z&nbsp;ikoną chmurki). Lewa kolumna: nawigacja sekcji A–E z&nbsp;licznikami „6/8 ocenionych”. Prawa: karty elementów z&nbsp;big-touch pills oceny, slider zużycia z&nbsp;gradientem (zielony → pomarańczowy → czerwony), textarea z&nbsp;przyciskiem „Z&nbsp;biblioteki”, siatka zdjęć 24×24 px i&nbsp;CTA „Zrób zdjęcie”. Elementy zwinięte w&nbsp;jednej linii gdy&nbsp;już ocenione (redukcja zmęczenia wzrokowego). Sugerowane zalecenie generowane automatycznie pod elementem o&nbsp;ocenie &lt;&nbsp;„Dobry”.
10. **Podgląd / generowanie protokołu** — split 1/3 + 2/3: status protokołu (5-stopniowy workflow), odbiorcy (inspektor + reprezentant klienta z&nbsp;avatarami), załączniki; z&nbsp;prawej miniaturka pierwszej strony PDF — kliknięcie otwiera pełny podgląd A4.

### Portal klienta (NOWY — operator farmy)

1. **Login klienta** — 50/50 split: formularz + hero z&nbsp;krajobrazem turbin na&nbsp;zielono-grafitowym gradiencie. Wsparcie dla Google i&nbsp;Microsoft 365 SSO (bo&nbsp;80% klientów-B2B ma konta Microsoft), jako trzeci wariant e-mail+hasło. Osobny branding „Portal operatora” odróżniający go od&nbsp;aplikacji wewnętrznej.
2. **Panel** — wielka zielono-grafitowa karta powitalna z&nbsp;KPI klienta (farmy / turbiny / protokoły / zalecenia). Jeśli są nowe zalecenia — alert amber na&nbsp;górze z&nbsp;CTA. 3 karty „szybkiego dostępu” (moje farmy / protokoły / kontakt), lista 3 nadchodzących inspekcji (z&nbsp;poziomym kalendarzem date-block) i&nbsp;skrót 4&nbsp;najnowszych protokołów.
3. **Moje farmy** — grid 2-kolumnowy z&nbsp;mini-mapami i&nbsp;chipem stanu zdrowia. Każda farma klikalna → turbina.
4. **Turbina (widok operatora)** — hero z&nbsp;ilustracją wiatraków + header z&nbsp;5 KPI turbiny. Centralny blok amber (jeśli jest zalecenie), pionowy timeline inspekcji z&nbsp;dużymi datami i&nbsp;pigułkami oceny (czytelne dla nie-inżyniera), brak danych „wewnętrznych” (zużycie w&nbsp;procentach, notatki roboczego inspektora). Po&nbsp;prawej sidebar z&nbsp;dokumentacją i&nbsp;trackerami terminów z&nbsp;paskami postępu.
5. **Archiwum protokołów** — tabela protokołów z&nbsp;filtrami farma / rok / typ, z&nbsp;dwoma przyciskami pobierania (PDF i DOCX) dostępnymi bez&nbsp;klikania w&nbsp;wiersz. Chip „Nowe” na&nbsp;nieotwartych protokołach.
6. **Konto i&nbsp;powiadomienia** — dane kontaktowe, tabela powiadomień e-mail (nowy protokół, pilne zalecenie, zbliżająca się kontrola, tygodniowy raport), panel bezpieczeństwa (2FA, zmiana hasła).

### Protokół (PDF A4)

Trzy strony pokazane w&nbsp;prototypie (cover + ocena + podpisy) — proporcje dokładnie 210&nbsp;×&nbsp;297&nbsp;mm:

- **Strona 1 · Cover** — górny pas z&nbsp;logo i&nbsp;danymi firmy oddzielony grubą zieloną linią (`brand/500`, 4&nbsp;px), wyśrodkowany blok tytułowy („PROTOKÓŁ” w&nbsp;small-caps → duży numer w&nbsp;Mono → data), tabela „Dane obiektu” w&nbsp;stylu dwukolumnowym z&nbsp;etykietami w&nbsp;label-caps, karta zespołu inspekcji z&nbsp;avatarem, numerami uprawnień i&nbsp;statusem GWO/UDT/SEP.
- **Strona 2 · Ocena + zalecenia** — running header z&nbsp;miniaturą logo i&nbsp;breadcrumb, tabela ocen z&nbsp;kolorystycznym paskiem po&nbsp;lewej (legenda sev-1 do sev-5) + kolumna zużycia w&nbsp;Mono. Tabela zaleceń osobno, z&nbsp;nagłówkiem `graphite/800` w&nbsp;bieli. Legenda pilności pod spodem.
- **Strona 3 · Dokumentacja fotograficzna + wnioski + podpisy** — siatka 3-kolumnowa zdjęć z&nbsp;numerami „FOT. 01..”, blok podsumowania z&nbsp;dużą oceną „ŚREDNI” w&nbsp;amber-caps i&nbsp;dopiskiem „dalsza eksploatacja dopuszczalna”, dwie kolumny podpisów z&nbsp;pełnymi numerami uprawnień.

Spójna estetyka: nagłówki sekcji w&nbsp;spacjowanych kapitalikach (0.12em letter-spacing), kody/daty/numery zawsze w&nbsp;Mono, akcenty zielone tylko przy elementach markowych (pasek nagłówkowy, logo, hipertekstowane zakładki „Część I”), kolorystyka użyta funkcjonalnie (nigdy dekoracyjnie).

---

## 4. Portal klienta — implikacje architektoniczne

To nie&nbsp;jest spec, tylko notatki do&nbsp;rozmowy z&nbsp;deweloperem nad rozszerzeniem back-endu Supabase. Jeśli Waldek zdecyduje się iść w&nbsp;tym kierunku, poniższe wątki powinny być zaadresowane zanim zacznie się kodować UI klienta:

- **Nowa rola `client`** w&nbsp;tabeli `profiles` (obok `admin` / `inspektor`). Role nie są mutualnie wykluczające — w&nbsp;zasadzie `client` nie ma dostępu do&nbsp;routów `/dashboard`, `/inspekcje/nowa`, itp.
- **Row-Level Security w&nbsp;Supabase** — polityki RLS na&nbsp;tabelach `clients`, `wind_farms`, `turbines`, `inspections`, `repair_recommendations`, `inspection_elements`, `photos` muszą filtrować po&nbsp;`client_id` przypisanym do&nbsp;zalogowanego użytkownika (przez nową tabelę `client_users` wiążącą `auth.users` z&nbsp;`clients`). To największe ryzyko w&nbsp;całej operacji: wyciek danych o&nbsp;jednej farmie do&nbsp;konkurencyjnego klienta jest potencjalnie drogi biznesowo.
- **Osobny flow autentykacyjny** — obecny OAuth Google dla&nbsp;inspektorów jest OK. Dla&nbsp;klientów portalu: **e-mail + hasło** (decyzja Waldka 23.04.2026). SSO Microsoft 365 do&nbsp;rozważenia w&nbsp;przyszłości. Trzeba oddzielić routy `/portal/login` od&nbsp;`/login` i&nbsp;dostosować `middleware.ts` do&nbsp;przekierowywania po roli.
- **Branded URL / subdomeny** — do&nbsp;rozważenia `portal.prowatech.pl` (klienci) vs&nbsp;`app.prowatech.pl` (inspektorzy). Oddzielne subdomeny dają nie&nbsp;tylko wrażenie odrębnego produktu, ale też upraszczają politykę cookies i&nbsp;CORS. Dla&nbsp;MVP można zostać na&nbsp;jednej subdomenie z&nbsp;różnymi prefiksami ścieżek (`/portal/*`).
- **Powiadomienia e-mail** — integracja Resend lub&nbsp;Postmark z&nbsp;triggerami Supabase (`on insert` do&nbsp;`inspections` z&nbsp;`status = 'signed'` → e-mail do&nbsp;kontaktu klienta z&nbsp;linkiem do&nbsp;portalu). Szablon maila w&nbsp;tej samej estetyce markowej — małe, proste, z&nbsp;CTA „Pobierz protokół”. Trigger drugi: zmiana `repair_recommendations.urgency_level = 'I'` → pilny alert.
- **Pobieranie protokołów** — obecne routy `/api/pdf/[id]` i&nbsp;`/api/docx/[id]` są bez&nbsp;RLS. Dla&nbsp;portalu potrzeba wrappera sprawdzającego `session.user.id → client_id → inspection.client_id`. Inaczej każdy klient mógłby pobrać cudzy protokół przez znany UUID.
- **Widok read-only** — wspólne komponenty UI powinny być sparametryzowane `readOnly: boolean`. Na&nbsp;turbina-detail komponenty `PhotoGallery`, `ElementCard`, `RepairTable` w&nbsp;trybie klienckim nie pokazują przycisków edycji, nie ujawniają wartości `wear_percentage` (nadinformacja dla klienta), zamieniają techniczne „notes / recommendations” na&nbsp;sformatowaną prozę.
- **Analytics** — zalogowanie każdego pobrania PDF/DOCX przez klienta (`audit_log`). Daje cenne dane sprzedażowe („klient X zainteresował się protokołem Y w&nbsp;ciągu 2h od&nbsp;wysyłki”) i&nbsp;GDPR-friendly logi dostępowe.
- **Branding opcjonalny** — docelowo mile widziane, żeby duzi klienci (PGE, RWE, EDF) mogli mieć własne logo w&nbsp;nagłówku portalu i&nbsp;w&nbsp;stopce e-maili. Pole `clients.logo_url` i&nbsp;`clients.accent_color` daje elastyczność bez&nbsp;forkowania aplikacji.
- **Tablet offline** — nie&nbsp;dotyczy portalu, ale warto przy okazji: formularz inspekcji w&nbsp;wersji 2 powinien mieć service worker z&nbsp;IndexedDB dla&nbsp;szkiców, bo&nbsp;na&nbsp;terenie farm wiatrowych zasięg LTE bywa&nbsp;w&nbsp;kratkę. Dzisiaj aplikacja jest&nbsp;PWA ale bez&nbsp;offline-first strategii zapisu.

---

## 5. Następne kroki wdrożenia

Pragmatyczna kolejność (od&nbsp;najniższego ryzyka / najwyższej wartości):

1. **Tokeny i&nbsp;paleta + komponenty core UI** — ✅ **DONE 2026-04-23** (commit `0c4fd3c`). `tailwind.config.ts` z&nbsp;pełną paletą brand/graphite/semantic, fonty Inter + JetBrains Mono (next/font/google), CSS variables design tokenów, `CONDITION_COLORS`/`STATUS_COLORS` na&nbsp;nowych tokenach. `Button` (danger), `Card` (shadow-xs), `Badge` (5 wariantów), `Table` (graphite), `Sheet`/`Slider` (primary), sidebar + header (aktywny stan blue→primary), body bg → graphite-50.
2. **Re-skin ekranów aplikacji** — ✅ **DONE 2026-04-23** (commit `a43d457`). 15 plików: Dashboard, Inspekcje (lista + detail), Formularz inspekcji, Klienci (lista + detail), Farmy (lista + detail), Turbiny (detail), komponenty inspection/* (element-card, rating-badge, status-bar). Zero hard-coded `blue-*`/`gray-*`. Wzorce: `font-mono` dla dat/kodów/liczb, `text-[11px] uppercase tracking-wider text-graphite-400` nagłówki tabel, `h-[52px] hover:bg-graphite-50/50` wiersze, `border-graphite-200 shadow-xs rounded-xl` karty.
3. **Re-layout Dashboard** (≈&nbsp;1–2 dni). Dodanie sparkline SVG, kalendarza 14-dniowego (prosty grid), rozkładu ocen (bar chart). Użycie realnych danych z&nbsp;Supabase, nawet bez&nbsp;agregatów — dashboard to&nbsp;największa storefront. **Niski risk, wysoki wow-factor.**
4. **Re-skin protokołu PDF/DOCX** (≈&nbsp;3 dni, największe ryzyko). Protokół trafia do&nbsp;urzędów i&nbsp;auditorów — każda zmiana musi być skonsultowana z&nbsp;Waldkiem i&nbsp;testowana na&nbsp;realnych danych. Rekomendacja: najpierw DOCX (bo&nbsp;łatwiej iterować wizualnie), potem PDF (bo&nbsp;jspdf jest&nbsp;sztywny). Przeprowadzić „A/B” — wygenerować stary i&nbsp;nowy protokół dla&nbsp;017/R/2026 i&nbsp;porównać. **Produkcyjny generator protokołów zachowuje obecny logo asset (`public/logo-prowatech.png`) — nie&nbsp;wymienia się.** Zmiany dotyczą wyłącznie typografii, rozkładu tabel oraz kolorystycznego kodowania ocen; sam znak ProWaTech w&nbsp;nagłówku pozostaje 1:1 jak dziś.
5. **Turbina · detail redesign** (≈&nbsp;2 dni). Dodanie wykresu oceny w&nbsp;czasie, tabs ze&nbsp;zdjęciami i&nbsp;certyfikatami, timeline aktywności. Użytkowe dla&nbsp;inspektora na&nbsp;miejscu.
6. **Reszta paneli wewnętrznych** (≈&nbsp;3 dni). Klient, Farma detail, Inspekcje filtrowanie i&nbsp;dense table, Turbiny katalog. Iteracyjnie.
7. **Formularz inspekcji v2** (≈&nbsp;3–4 dni). Sticky progress bar, wizualna lewa kolumna sekcji z&nbsp;licznikami, zwinięte karty po&nbsp;ocenieniu, wskaźnik auto-save. Testować na&nbsp;tablecie w&nbsp;realnych warunkach.
8. **Portal klienta — MVP** (≈&nbsp;2–3 tygodnie). Zacząć od&nbsp;najkosztowniejszego: RLS + nowa rola + auth flow + sprawdzenie routów PDF/DOCX. Dopiero potem UI: Login → Panel → Moje farmy → Archiwum protokołów. Turbina-detail i&nbsp;Ustawienia można dowieźć w&nbsp;drugim sprincie. Mailingu (Resend) nie&nbsp;odpalać przed testowaniem RLS na&nbsp;kilku użytkownikach-pilotach.
9. **Accessibility sweep** (≈&nbsp;1 dzień). Focus rings (mam `shadow-focus` w&nbsp;tokenach), kontrast par tekst/tło (obecne amber-700 / amber-50 jest&nbsp;OK, ale trzeba sprawdzić ocena-pills), nawigacja klawiaturowa w&nbsp;formularzu inspekcji (Tab-order przez elementy, Enter&nbsp;=&nbsp;ocena „Dobry”), ARIA labels na&nbsp;pickerach i&nbsp;dialogach. Prowatech używa Radix → to&nbsp;w&nbsp;90% darmowe.

**Co bym zrobił w&nbsp;pierwszej kolejności, gdybym miał 1 dzień**: Kroki&nbsp;1 + 2 + 3 — najszybsza subiektywna zmiana odbioru aplikacji. **Co bym zrobił gdybym miał tydzień**: dodać 4 (protokół) bo&nbsp;tam jest&nbsp;największa szansa na&nbsp;sygnał „ProWaTech podniosło standard”. **Co bym zrobił gdybym miał miesiąc**: 1–7 + start prac nad RLS pod portal klienta.

---

## Załączniki

- `prowatech-prototype.html` — jedno-plikowy klikalny prototyp, Tailwind + Lucide przez CDN, działa offline-po-scache'owaniu zasobów CDN. Przełącznik kontekstu u&nbsp;góry: **Panel inspektora · Portal klienta · Protokół (PDF)**. Kliknij dowolny wiersz lub kartę — nawigacja między ekranami działa.

### Założenia / rzeczy do potwierdzenia przez Waldka

- Zieleń ProWaTech — użyłem odcienia pośredniego między tym, co widzę w&nbsp;logo `logo-prowatech.png`, a&nbsp;typowym „forest green”. Jeśli w&nbsp;marce ProWaTech istnieje eksportowany Pantone/hex — należy go użyć zamiast `#1F7F3A`.
- Typografia — Inter i&nbsp;JetBrains Mono są OSS i&nbsp;darmowe. Jeśli Waldek chce wejść w&nbsp;stronę płatnego (np. GT Walsheim, Sohne) — podmienię w&nbsp;tokenach jednym wierszem.
- Copy w&nbsp;portalu klienta — **„Państwo/Państwa”** (decyzja Waldka 23.04.2026). Zastosować we wszystkich mikro-copy portalu klienta przy wdrożeniu Fazy 3.
- Auth portalu klienta — **e-mail + hasło** (decyzja Waldka 23.04.2026). SSO Microsoft odłożone na&nbsp;później.
- Branded URL — w&nbsp;prototypie przyjąłem `portal.prowatech.pl` / `app.prowatech.pl`. Do&nbsp;skonsultowania z&nbsp;właścicielem domeny.
- Mapa — w&nbsp;prototypie używam SVG z&nbsp;punktami jako placeholder. Produkcyjnie sugeruję Mapbox GL lub&nbsp;MapTiler (free tier) z&nbsp;tile-ami topo lub OSM, z&nbsp;markerami turbin i&nbsp;warstwą farm jako polygon. Google Maps możliwy, ale droższy w&nbsp;skali 424 turbin rysowanych na&nbsp;dashboard.
