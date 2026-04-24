# PROGRESS — Prowatech Inspekcje

> **Ten plik jest aktualizowany na koniec każdej sesji pracy nad projektem.**
> **Jeśli jesteś Claude rozpoczynającym nową sesję pracy nad Prowatech Inspekcje — przeczytaj ten plik w pierwszej kolejności**, zanim zaczniesz eksplorować repo lub pytać użytkownika o kontekst. Zaktualizuj go na końcu sesji (sekcje "Ostatnio zrobione", "W toku / następne kroki" oraz "Historia sesji").

_Ostatnia aktualizacja: 2026-04-24 — **Redesign krok 6 — reszta paneli wdrożona.** Pełny re-skin `/inspektorzy` (tabela 8-kol, badges GWO/UDT/SEP/Izba, font-mono na nr uprawnień i telefonach) + formularza inspektora (5 kolorowych sekcji: Uprawnienia=primary, Izba=success, GWO=info, UDT=warning, SEP=graphite) + mop-up layoutów (sidebar, header, mobile-nav — nowe logo w mobile-nav zamiast Wind-ikonki) + /login (gradient primary-50→primary-100) + /diagnostyka (graphite-900 bg, font-mono na JSON). UI primitives shadcn (avatar/separator/skeleton/sheet/dropdown-menu) zmigrowane gray-* → graphite-*. Zero blue-*/gray-* w całym scope. Dodany `.gitattributes` (preventive LF normalization) + admin-only link „Diagnostyka" w sidebar i mobile-nav (role-gated przez profiles.role w (protected)/layout.tsx)._

---

## Stan projektu

Aplikacja webowa (PWA) do zarządzania inspekcjami turbin wiatrowych dla firmy ProWaTech. Zbudowana na Next.js 14 App Router + Supabase + Vercel. Cały UI po polsku.

Po ~6 tygodniach pracy (2026-04-01 → 2026-04-13) aplikacja ma:
- Działający deployment na Vercel z OAuth Google i rolami (admin / inspektor).
- Pełny CRUD dla klientów, farm wiatrowych, turbin, inspekcji, inspektorów.
- Formularz inspekcji dostosowany do tabletu (3-krokowy), połączony z Supabase, z realnymi definicjami elementów turbiny.
- Bibliotekę defektów / wad (`defect_library`) jako picker w formularzu inspekcji.
- Galerię zdjęć per-inspekcja i per-element z określonymi wymiarami (portret 12×7 cm, pejzaż 5,5×7 cm) dopasowanymi do layoutu protokołu.
- Generowanie protokołu PDF (jspdf + autotable, font Roboto dla polskich znaków, logo ProWaTech, nagłówek prawny).
- Generowanie protokołu DOCX (biblioteka `docx`, runtime `nodejs`).
- Certyfikaty inspektora: GWO (4 moduły z osobnymi datami ważności), UDT (z załącznikami skanu uprawnień + izby), SEP, WINDA ID.
- Soft-delete inspekcji (tylko admin).

Od 2026-04-24 (po kroku 6) na gałęzi `main` jest `.gitattributes` (`* text=auto eol=lf` + binary exclusions, commit `368d34d`) — preventive measure zapobiegający regresjom CRLF/null-bytes. Są nietrackowane pliki robocze (SQL-e sianiające defekty, skrypty GAS, Raport PDF) — patrz "Pliki nietrackowane" niżej.

## Ostatnio zrobione

Pogrupowane tematycznie (kolejność chronologiczna w obrębie grupy):

**Generowanie dokumentów (2026-04-10 → 04-13)**
- PDF: poprawione nazwy kolumn i JOIN-y, obsługa polskich znaków przez osadzony font Roboto.
- PDF: nagłówek firmowy ProWaTech + prawny tytuł protokołu, logo ProWaTech w nagłówku.
- DOCX: nowy endpoint `/api/docx/[id]` + przycisk pobierania. Po kilku iteracjach naprawione: runtime `nodejs`, poprawne użycie `PageNumber`, `Buffer`, `altText` dla obrazów.

**Branding (2026-04-12)**
- Logo ProWaTech zastąpiło ikonę `Wind` w sidebarze, nagłówku i na stronie logowania.

**Iteracja po feedbacku testera (2026-04-10)**
- Duży batch: fix zapisu, szablony, automatyczne daty, wyszukiwanie.
- Picker biblioteki defektów w formularzu inspekcji.
- Per-element photos, picker biblioteki dla notatek i rekomendacji, auto-fill inspektora.
- Typ naprawy i pilność jako szybkie przyciski toggle (zamiast `select`).
- Slider zużycia widoczny tylko dla inspekcji 5-letnich.
- Śledzenie poprzednich findings per-turbine (ładowanie i wyświetlanie).
- Zmiana etykiety "Konserwacja" → "Prace konserwacyjne".
- Wyszukiwanie inspekcji po turbinie / farmie / kliencie + działający filtr klienta.
- Przycisk usunięcia inspekcji (admin, soft-delete przez `is_deleted`).

**Inspektorzy i certyfikaty (2026-04-10)**
- GWO jako 4 osobne kursy z datami ważności (First Aid, Manual Handling, Fire Awareness, Working at Heights).
- Formularz inspektora: WINDA ID, skany uprawnień + izby, specjalność jako enum.
- `rated_power_kw` → `rated_power_mw` (migracja kolumn), pola certyfikatów izby.
- Farm → turbine filtr (kaskadowy), certyfikaty GWO / UDT / SEP, checklista ukończenia.

**Formularz inspekcji + UI (2026-04-07 → 04-08)**
- `TurbineInspectionForm` — 3-krokowy formularz zoptymalizowany pod tablet.
- Podłączony do Supabase z realnymi definicjami elementów.
- Struktura formularza odpowiada strukturze protokołu papierowego.
- Kompletna modernizacja UI: profesjonalny design, tablet-first.
- Shadcn-ui wdrożony jako biblioteka komponentów.
- Karta turbiny: zdjęcie, poprzednie findings, status, upload dla admin/inspektor.
- Layout zdjęć 3-photo: portret po lewej + 2 pejzaże po prawej, dokładne wymiary (12×7 cm portret, 5,5×7 cm pejzaż).

**Stabilizacja (2026-04-02 → 04-07)**
- Naprawa błędów SSR w Supabase: `createClient()` przeniesiony poza poziom komponentu, potem do `useEffect`, ostatecznie zrobiony tak, by był wywoływany dopiero runtime.
- Hardkodowanie kredenciali Supabase (po problemach z inlining zmiennych środowiskowych w buildzie Vercel).
- PWA: manifest, ikony, meta tagi.
- Naprawa nazw kolumn (polskie → angielskie), filtry `is_deleted`, null-safe access dla JOIN-ów, empty `SelectItem` values → `'all'`.

**Początek (2026-04-01 → 04-02)**
- Initial commit: aplikacja Next.js.
- Ominięcie błędów TypeScript/ESLint w buildzie Vercel.

## W toku / następne kroki

**Redesign — Faza 1 DONE (2026-04-23).** Tokeny, fonty i komponenty bazowe wdrożone w commit `0c4fd3c`.

**Redesign — Faza 2 DONE (2026-04-23).** Re-skin wszystkich ekranów wewnętrznych wdrożony w commit `a43d457`. Zero hard-coded `blue-*`/`gray-*`; wszystkie klasy tokeny z Fazy 1.

**Redesign — krok 6 (reszta paneli) DONE (2026-04-24)**, 3 commity:
- `368d34d` — **chore(repo): add .gitattributes enforcing LF line endings.** Preventive measure: `* text=auto eol=lf` + binary exclusions (png/jpg/pdf/docx/xlsx/pptx/woff/ttf). Nie rozwiązuje zaległych null bytes w HEAD obiektów gitowych (wymagałoby `git filter-branch`/BFG, osobny temat), ale blokuje pogłębianie problemu przy przyszłych edycjach z Windows-side Cowork.
- `d15929a` — **feat(design): krok 6 — re-skin pozostałych paneli.** 13 plików, 110 insertions / 119 deletions (clean diff bez null-byte szumu).
- `5ced61d` — **feat(layout): link „Diagnostyka" w sidebar + mobile-nav (admin-only).** Fetch `profile.role` w `(protected)/layout.tsx` po `getSession()`, przekaz jako `userRole` prop do Sidebar i MobileNav. Komponenty dzielą `navItems` na `NAV_ITEMS_BASE` (widoczne dla wszystkich) + `NAV_ITEMS_ADMIN` (tylko role=admin). Ikona `Activity` z lucide-react.

Zakres re-skinu (commit `d15929a`):
- `/inspektorzy/page.tsx` — pełny re-skin listy (wcześniej 37 hits blue/gray): nagłówek, CTA „Dodaj inspektora" zielony primary, empty state, karty mobile, tabela desktop (8 kolumn). Badges certyfikatów: **GWO=info (niebieski), UDT=warning (amber), SEP=neutral (graphite)** — SEP jako wyjątek bo brak purple w tokenach. Badge Aktywny=success, Nieaktywny=neutral. Font-mono na `license_number` i `phone`.
- `components/forms/inspector-form.tsx` — 5 kolorowych sekcji wg semantic tokens: **Uprawnienia=primary-50/700, Izba=success-50/800, GWO=info-50/800, UDT=warning-50/800, SEP=graphite-100/800**. Error box=danger-50/800. Scan link=info-800.
- `components/layout/sidebar.tsx`, `header.tsx` — dokończenie migracji z Fazy 1: `border-graphite-200`, `shadow-xs`, user section graphite.
- `components/layout/mobile-nav.tsx` — pełna migracja na tokeny + **logo ProWaTech zamiast Wind-icon-w-niebieskim-boxie** (konsystencja z desktop sidebar).
- `(protected)/layout.tsx` — `text-graphite-500` na „Ładowanie…" loading message.
- `/diagnostyka/page.tsx` — `bg-graphite-900`, `text-success` na JSON output, nowa struktura (nagłówek + opis), `font-mono` + `shadow-xs` + `rounded-xl` na `<pre>`.
- `/login/page.tsx` — `bg-gradient from-primary-50 to-primary-100` (wcześniej blue), `border-graphite-200`, `shadow-lg`, graphite texts.
- `components/ui/{avatar,separator,skeleton,sheet,dropdown-menu}.tsx` — mop-up fallbacków shadcn (`bg-gray-*` → `bg-graphite-*`, `text-gray-*` → `text-graphite-*`).

Decyzje projektowe:
- **SEP = graphite** (nie purple) bo paleta nie ma `purple-*` w tokenach; traktujemy SEP jako neutralną „trzecią" kategorię certyfikatów, spójną hierarchicznie po GWO (info) i UDT (warning). Jeśli kiedyś dojdzie purple do palety, SEP przejdzie na purple.
- **Link „Diagnostyka" admin-only w UI, nie na route** — strona `/diagnostyka` dalej dostępna bezpośrednio przez URL (RLS na DB i tak chroni dane). Jeśli chcemy server-side guard — osobny ticket.
- **`.gitattributes` dodany jako osobny commit** (nie razem z re-skinem) — zgodnie z polityką „jeden commit = jeden rodzaj zmiany", żeby `git blame` kroku 6 było clean.

Pułapka sesji (ważna na przyszłość — patrz też „Gotchas" niżej):
- **Null bytes w plikach `src/`** — podczas sesji Cowork okazało się, że **80 plików w `src/` ma null bytes zacommitowane w HEAD** (`git show HEAD:file | grep -c $'\\x00'` daje np. 70 dla `dashboard/page.tsx`). Prawdopodobna przyczyna: wcześniejsze edycje z Windows-side zapisywały fragmenty UTF-16 LE lub bug Edit tool. Build Vercela przechodzi przez `typescript.ignoreBuildErrors: true`. Git for Windows z `core.autocrlf=true` maskuje problem u klienta (po `git checkout` pliki w WT są LF bez null bytes), ale jak sklonuje ktoś na Linux bez autocrlf, dostanie uszkodzone pliki. `.gitattributes` zapobiega pogłębianiu — nie cofa historii.
- **`tr -d '\\0'` obcina ogony plików UTF-16 LE** — klasyczny bug: plik UTF-16 LE kończący się pełnym znakiem ma parę bajtów `X\\0` lub `\\0X` na końcu, które `tr -d '\\0'` usunie częściowo → ostatnie bajty lecą w niebyt. W sesji 2026-04-24 zepsuło to 13 plików (ogony exportów ucięte do `Separato`, `Skeleto`, `SheetDescrip` itd.). Naprawione ręcznie dopisywaniem brakujących ogonów. **Zasada**: do konwersji UTF-16 LE → UTF-8 używać `iconv -f UTF-16LE -t UTF-8`, nigdy `tr -d '\\0'`.
- **Phantom `.git/index.lock` w Cowork sandbox** — w sesji Cowork mount `.git/` ma Windows ACL, nie pozwala sandboxowi na `rm` pliku który Git tworzy. Skutek: Claude w Cowork **nie może zrobić `git commit`** — trzeba to robić z Windows-side przez Git Bash. Plik lock istnieje jako „phantom" (widoczny w `ls .git/` ale `stat .git/index.lock` mówi „No such file") — nieusuwalny z sandboxa, nieaktywny.

**Redesign — krok 5 (Turbina · detail redesign) DONE (2026-04-24)**, commity `fe30f4a` → `26ae3a2`:
- `fe30f4a` C1 — hero graphite + struktura 5 tabs (dotychczasowa zawartość opakowana w tab „Przegląd"). Nowy fetch `inspectionsCount` + `openRecsCount` do liczników tab-trigger i chipów hero. W tym commicie też wprowadzenie `SESSION_HANDOVER_2026-04-24.md` (plik to-shot-use, później usunięty).
- `163cc47` C2 — tab Przegląd: wykres oceny w czasie (inline SVG, 6 ostatnich inspekcji, skala sev-1..5 z empty state gdy <2 punkty), karta „Ostatnia kontrola" (nr protokołu Mono, data, lead inspector, linki PDF/DOCX), karta „Najbliższe przeglądy" (3 typy kontroli z countdown dni).
- `e8a197e` C3 — tab Historia inspekcji (tabela 5-kol: Data · Nr protokołu · Typ pill · Inspektor · PDF/DOCX linki) + tab Zalecenia (filter bar „Tylko otwarte", lista kart z urgency pills I-IV, element + opis + rodzaj + deadline + nr protokołu). Wspólne `URGENCY_UI` (klucze I/II/III/IV, klasy Tailwind) zgodne z DOCX A3 / PDF B3.
- `26ae3a2` C4 — tab Zdjęcia (grid 2/3/4-kol responsywny, badge „FOT. NN" na tile, opis + nr protokołu + data pod spodem, klik otwiera pełny obraz) + tab Certyfikaty (lista kart per inspektor z ostatniej inspekcji, certyfikaty UDT/SEP/GWO/Izba z expiry pills: success >90d / warning ≤90d / danger przeterminowane).

Decyzje projektowe potwierdzone w tym kroku:
- Karta „Ustalenia z ostatniej kontroli" (legacy `previous_findings`) **zostaje** w tab Przegląd — Waldek ma tam dane z poprzednich kontroli, zniknie gdy zostaną zmigrowane do `repair_recommendations`.
- Wykres oceny w czasie: **empty state gdy <2 punkty** (z info „Pierwsza inspekcja: [data]. Trend pojawi się po drugiej inspekcji").
- Stare 3 zdjęcia turbiny (`turbines.photo_url/2/3`) **zostają w tab Przegląd** jako wizytówka — nie przenoszone do tab Zdjęcia. Empty state tab Zdjęcia wskazuje użytkownikowi gdzie je znaleźć.
- Tab Historia — **prosta tabela** (data / nr / typ / PDF/DOCX), bez ocen pill czy rich details, bo szczegóły są w samym PDF-ie. Decyzja uzasadniona planami dodawania protokołów historycznych w osobnym feature (inne storage niż Supabase, decyzja odłożona).

Wzorce:
- `InspectionTrendChart` — inline SVG 600×200, 5 grid lines, gradient fill brand-500 18%, linia brand-600 2.5px, punkty r=4 (ostatni r=5 w amber), X labels Mono data, Y labels „Dobry / Zadow. / Średni / Zły / Awaryj.". Skala Y: dobry=5 (górę), awaryjny=1 (dół).
- `URGENCY_UI` w `page.tsx` — map `{ I: danger-50/danger-800, II: amber-100/amber-800, III: info-50/info-700, IV: graphite-100/graphite-700 }`, identyczne wartości jak `URGENCY_COLORS_HEX` z `protocol-tokens.ts` ale jako klasy Tailwind dla UI.
- Joiny przez inner join `inspections!inner(turbine_id, is_deleted)` + filter — wzorzec używany w C3 (`repair_recommendations`) i C4 (`inspection_photos`). Konsekwentny z wzorcami z kroku 4 (DOCX/PDF).
- Empty states everywhere — każdy tab ma sensowny komunikat gdy dane są puste (zgodnie z gotchaa „baza nowych inspekcji jest pusta, będzie napełniana przez aplikację w najbliższym czasie").

**Redesign — krok 4 (re-skin protokołu PDF/DOCX) DONE (2026-04-24)**, commity `654e9b4` → `f48a07e`:
- `654e9b4` A1 — DOCX paleta + typografia (nowy moduł `src/lib/design/protocol-tokens.ts`)
- `5dd35ec` A2 — DOCX color-coding ocen sev-1..5 w tabeli elementów
- `6ab653b` A3 — DOCX color-coding pilności I-IV w tabeli zaleceń
- `c551522` B1 — PDF paleta + typografia (jspdf RGB tokeny, uppercase z kerningiem)
- (B2) PDF color-coding ocen sev-1..5 (autoTable didParseCell + didDrawCell dla paska 1.5mm)
- `f48a07e` B3 — PDF color-coding pilności I-IV (autoTable didParseCell per col 0)

Decyzje projektowe (potwierdzone z Waldkiem na starcie kroku 4): (1) nagłówki tabel w `graphite-800` (oficjalne/urzędowe), nie brand; (2) paleta sev-1..5 1:1 z prototypu HTML; (3) pills pilności I-IV ze standardowej semantyki danger/amber/info/graphite; (4) zwykły workflow testowania — baseline przed startem, po każdym etapie pobieranie nowej wersji z prod. Logo ProWaTech bez zmian. Ratingi per-row weryfikowane SQL-em (opcja A: zmiana 4 elementów → pobierz DOCX → pełna paleta widoczna → rollback).

Wzorce:
- Single source of truth dla protokołów — `src/lib/design/protocol-tokens.ts` z eksportami HEX (docx) + RGB (jspdf) dla brand / graphite / semantic / rating (sev-1..5) / urgency (I-IV) + skala typografii (DXA / pt) + TRACKING_DXA.
- Nagłówki sekcji: 11pt, `text.toUpperCase()`, `characterSpacing: TRACKING_DXA` (docx) lub `setCharSpace(0.4)` (jspdf).
- Tabela ocen (DOCX): wiersz renderowany przez `elementRow(el, idx)` — tło wg `RATING_COLORS_HEX[rating].bg`, tekst wg `.text`, pierwsza komórka ma `left: { style: SINGLE, size: 18 }` jako pasek 3px.
- Tabela ocen (PDF): `pdf.autoTable` z `didParseCell` (fillColor/textColor per row) + `didDrawCell` (dodatkowy `pdf.rect(x, y, 1.5, height, 'F')` — pasek 1.5mm z lewej).
- Tabela zaleceń: kolumna Pilność ma nadpisane tło + kolor tekstu wg `URGENCY_COLORS_HEX/RGB[level]`, reszta kolumn neutralna.

**Redesign — krok 3 (re-layout Dashboard) DONE (2026-04-24), commit `c9b09aa`.** 3 nowe komponenty + nowy grid w `dashboard/page.tsx`:
- `components/dashboard/inspection-trend-sparkline.tsx` — sparkline SVG liczby inspekcji per tydzień (12 tyg.), KPI + chip trendu (Δ vs poprzedni tydzień), gradient fill pod linią, ostatni punkt wyróżniony primary-700. Zapytanie: `inspections.inspection_date >= 12w ago`, `.not('is_deleted', 'is', true)`.
- `components/dashboard/inspection-calendar-14d.tsx` — heat-grid 14 dni (dziś-3 → dziś+10), układ 7-kolumnowy z nagłówkami Pn–Nd, wyróżnienie „dziś" (primary-600 border + ring), liczniki wyk./plan. per dzień. Zapytanie: `inspection_date` + `next_annual_date` + `next_five_year_date` + `next_electrical_date` w oknie, przez Supabase `.or('and(...),and(...)')`. Klik w dzień z danymi → `/inspekcje?date=YYYY-MM-DD`.
- `components/dashboard/rating-distribution.tsx` — bar-chart poziomy rozkładu ocen elementów z `inspection_elements` (5 kategorii: dobry / zadowalający / średni / zły / awaryjny) z kolorami semantic tokens + liczba + procent. Zapytanie z `inspections!inner(is_deleted)` i filtrem `.not('inspections.is_deleted', 'is', true)`, `is_not_applicable=false`, `condition_rating IS NOT NULL`.

Nowy layout Dashboard:
- Row 1: `StatsCards` (bez zmian, 4 KPI)
- Row 2: `InspectionTrendSparkline` (1/3) + `InspectionCalendar14d` (2/3)
- Row 3: `RecentInspections` (2/3) + `{RatingDistribution + AlertsPanel}` (1/3)

Zero nowych zależności. Wszystkie wykresy inline SVG / Tailwind — zgodnie z zasadą „preferuj recharts jeśli już jest, inaczej zaproponuj" — recharts nie było w `package.json`, więc pojechałem czystym SVG. Zgodnie z konwencją: `createClient()` w `useEffect`, `.not('is_deleted', 'is', true)` wszędzie, Polish-first copy.

**Faza 3 — Portal klienta WDROŻONY NA PRODUKCJĘ (2026-04-24), commit `d301abf`, Vercel deploy `TaVz1pRJ5`:**
- ✅ Blok 1 — Migracja DB (`client_users`, `profiles.force_password_change`) + `/api/portal/create-account` + UI w `/klienci/[id]`
- ✅ Blok 2 — `/portal/login` (email+hasło, reset hasła), `/portal/auth/reset`, `/portal/(client)/layout.tsx` (guard roli), `auth/callback` (redirect per rola)
- ✅ Blok 3 — `/portal/(client)/dashboard` (KPI cards, ostatnie protokoły, nadchodzące inspekcje), `/portal/(client)/farmy` (grid z chipem zdrowia)
- ✅ Blok 4 — `/portal/(client)/turbiny/[id]` (read-only, access check), `/portal/(client)/protokoly` (tabela, PDF/DOCX download)
- ✅ Blok 5 — `/portal/(client)/konto` (zmiana hasła + force_password_change)
- ✅ Zabezpieczenie `/api/pdf/[id]` i `/api/docx/[id]` — auth check + weryfikacja dostępu dla `client_user`

**Konfiguracja produkcyjna (wykonane 2026-04-24):**
1. ✅ `SUPABASE_SERVICE_ROLE_KEY` (Sensitive) na Vercelu w środowiskach Production + Preview. Development blokowany przez Vercel dla Sensitive vars — obsłużony lokalnym `.env.local`. **Pułapka:** pierwszy klucz wklejony 2026-04-23 okazał się nieprawidłowy ("Invalid API key" w teście) — trzeba było ponownie skopiować service_role JWT z Supabase → Settings → API Keys → zakładka "Legacy anon, service_role API keys" → Reveal → Copy i nadpisać wartość w Vercelu + wymusić Redeploy.
2. ✅ `.env.local` (w `.gitignore`) z jednym wpisem `SUPABASE_SERVICE_ROLE_KEY=...` — URL i anon key są hardkodowane w `src/lib/supabase/client.ts` i `src/app/api/portal/create-account/route.ts`, więc `NEXT_PUBLIC_*` w `.env.local` są zbędne.
3. ✅ Supabase → Authentication → URL Configuration → Additional Redirect URLs: `https://prowatech-inspekcje.vercel.app/portal/auth/reset` (już był dodany wcześniej).

**Test przepływu (testowe konto, potem skasowane):**
- ✅ POST `/api/portal/create-account` → temp password XXXX-XXXX-XXXX
- ✅ `/portal/login` z temp password → redirect do `/portal/konto` (force_password_change)
- ✅ Zmiana hasła → redirect do `/portal/dashboard`
- ✅ Dashboard: "Witamy, Działdowo Sp. z o.o." + KPI (1 Farma / 2 Turbiny / 0 Protokołów) + Nadchodzące inspekcje
- ✅ `/portal/farmy`: tylko FW Działdowo (1 z 98 farm w bazie) — access check działa
- ✅ `/portal/turbiny/[własna]`: T027-Kisiny widoczna
- ✅ `/portal/turbiny/[obca]` (turbina innego klienta): "Brak dostępu do tej turbiny" + przycisk "Wróć do farm"
- ✅ `/portal/protokoly`: empty state "Brak protokołów" (klient bez zakończonych inspekcji)
- ⏭️ **Nie testowane:** reset hasła przez email (infra OK, Redirect URL skonfigurowany), pobieranie PDF/DOCX (klient Działdowo bez zakończonych inspekcji — pierwszy klient z protokołem sprawdzi ten scenariusz)

Poza propozycją designu brak innych jawnie udokumentowanych prac w toku w repo, ale na podstawie stanu gałęzi i nietrackowanych plików można przypuszczać następujące otwarte wątki:

- ~~**Kosmetyczny diff CRLF/LF**~~ — **ROZWIĄZANE 2026-04-24** (commit `368d34d`): dodany `.gitattributes` z `* text=auto eol=lf` + binary exclusions. Nowe edycje trzymają LF automatycznie.
- **Seed biblioteki defektów** — w katalogu głównym są `defect_library.json`, `defect_batch_0..4.sql`, `seed_defects_via_ef.mjs`, `upload_defects.mjs`. Feature biblioteki defektów jest już w UI (commit `09e82ae`), ale te pliki nie są ani zacommitowane, ani oczywiście wykonane — warto potwierdzić z użytkownikiem, czy seed został faktycznie załadowany do Supabase produkcyjnego.
- **Seed findings** — podobnie `findings_batch_0..11.sql`, `findings_v2_batch_0..11.sql`, `findings_updates.json`, `upload_findings.mjs` — wygląda na dwa przebiegi (v1 i v2) migracji poprzednich findings do nowego schematu. Status nieznany.
- **Rename folderów Google Drive** — `rename_folders_2024.gs` i `rename_folders_2025.gs` (Google Apps Script). Nie powiązane bezpośrednio z appem — raczej pomocnicze skrypty do uporządkowania zdjęć / dokumentów ze starych inspekcji w GDrive.
- **Raport zmian** — `Raport_zmian_Prowatech_Inspekcje.pdf` — prawdopodobnie wygenerowany przez Claude raport dla klienta/stakeholdera. Nie powinien być commitowany.
- **Zdjęcia główne turbin** — `turbine_main_photos/` + `turbine_photos_map.json` + `upload_photos.mjs` — seedowanie zdjęć głównych. Status nieznany.

**Niepotwierdzone, możliwe kolejne tematy** — ponieważ feature-set wydaje się już dość kompletny, naturalne następne kroki to: kontrola dostępu per-klient (RLS w Supabase), eksport do Excel, dashboard analityczny, mobilna wersja offline (już jest PWA — być może service worker z cache).

## Znane problemy / gotchas

- **`is_deleted` nulluje się domyślnie** — kolumna `is_deleted` w kilku tabelach ma default `NULL`, nie `FALSE`. Dlatego zapytania client-side filtrujące skasowane rekordy **muszą** używać:
  ```ts
  .not('is_deleted', 'is', true)
  ```
  a **nie**:
  ```ts
  .eq('is_deleted', false)   // ❌ gubi wszystkie rekordy z NULL
  ```
  To jest powtarzający się błąd — fix widać w commitach `adfb128` i `8dcac77`.

- **OAuth redirect na Vercel** — lokalny `localhost:3000` przy logowaniu Google OAuth zostaje przekierowany na URL Vercela. W praktyce: testuj feature'y związane z auth na deployu Vercel, nie lokalnie. Prawdopodobnie wynika z konfiguracji Redirect URL w Supabase → Auth → Providers → Google (wskazuje na produkcyjny URL).

- **Credentialsy Supabase hardkodowane** — po problemach z inliningiem `NEXT_PUBLIC_*` w buildzie Vercel, URL i anon key są twardo wpisane w `src/lib/supabase/client.ts` (commit `1a39485`). Przy rotacji klucza — pamiętać o update w kodzie, nie tylko w env.

- **Empty `SelectItem value=""`** — shadcn/ui Select nie toleruje pustych wartości. Używamy `'all'` jako sentinel dla "brak filtra" (commit `7fe2348`, `98824f4`).

- **Polskie znaki w PDF** — domyślny font jspdf nie ma polskich znaków. Projekt osadza Roboto przez font subset (patrz `src/fonts/`). Nowe endpointy PDF muszą wczytać i zarejestrować ten font.

- **DOCX API route wymaga runtime `nodejs`** — `export const runtime = 'nodejs'` na górze pliku. W Edge runtime nie działa `Buffer` ani biblioteka `docx`. Nauczone po 3 iteracjach (`6f955b0`, `3b58e34`, `329e6ca`).

- **SSR w Supabase** — `createClient()` **nie wolno** wywoływać w body komponentu ani na top-level module. Zawsze w `useEffect` albo przez Server Action / Route Handler. Commity `5d3aff5` i `e328fdb`.

- **Migracja `rated_power_kw` → `rated_power_mw`** — starsze dane lub seedy mogą mieć starą nazwę. Zmiana z commit `2719c85`.

- **Bug formularza `/klienci/[id]`** (wykryty 2026-04-24) — przycisk "Zaktualizuj" w sekcji "Dane klienta" nie zapisuje zmian w DB (m.in. `contact_email` zostaje `NULL` po submit). UI wygląda jakby zapisał (toast?/brak błędu), ale reload ujawnia stary stan. Workaround: direct SQL `UPDATE public.clients SET contact_email=... WHERE id=...`. Do naprawy: sprawdzić `src/app/(protected)/klienci/[id]/page.tsx` — prawdopodobnie brak `await` na mutacji lub problem z kluczami kolumn.

- **`inspections.completed_at` nie istnieje** (wykryte 2026-04-24). Tabela `inspections` w obecnym schemacie nie ma pola `completed_at` — są tylko `inspection_date`, `inspector_signature_date`, `owner_signature_date`, `site_visit_date`. Jeśli spotkasz filtr `.gte('completed_at', ...)` — to stary bug, zamieniać na `inspection_date`. StatsCards miał go od Fazy 2 i cicho zwracał 0 (aż się ujawniło po un-delete testowych inspekcji w kroku 3 redesignu).

- **Filter na embedded relation przez `!inner`** (potwierdzone 2026-04-24). Kiedy trzeba filtrować listę `repair_recommendations` / `inspection_elements` po polu z parent `inspections`, robi się `.select("*, inspections!inner(is_deleted)")` + `.not('inspections.is_deleted', 'is', true)`. Składnia działa w Supabase JS client i mapuje się na inner join z klauzulą. Używane w `rating-distribution.tsx` i `alerts-panel.tsx`. Commit `9147796`.

- **Sensitive env var niedostępny w Development na Vercelu** — Vercel blokuje flagę Sensitive dla środowiska Development ("Sensitive environment variables cannot be created in the Development environment"). Dla Production + Preview OK. Lokalne dev używa `.env.local`.

- **Service_role JWT vs nowe sb_secret_...** — Supabase ma teraz dwa tryby API keys: "Publishable and secret keys" (nowy, `sb_secret_...`) oraz "Legacy anon, service_role API keys" (klasyczny JWT). Kod projektu (`route.ts` używa klasycznej zmiennej `SUPABASE_SERVICE_ROLE_KEY`) — używamy **klasycznego service_role JWT z zakładki Legacy** dla zgodności nomenklatury i kompatybilności z `@supabase/supabase-js` w klasycznym trybie.

- **Null bytes w plikach `src/` zacommitowane w HEAD** (wykryte 2026-04-24) — 80 plików w `src/` ma null bytes w wersji gitowej (HEAD). Prawdopodobne źródło: wcześniejsze edycje z Windows-side Cowork zapisywały fragmenty UTF-16 LE. Build Vercela nie cierpi bo `typescript.ignoreBuildErrors: true` + Git for Windows z `autocrlf=true` konwertuje przy checkout. Ale Linux / CI bez autocrlf dostanie uszkodzone pliki. `.gitattributes` z kroku 6 (commit `368d34d`) zapobiega pogłębianiu — **nie cofa historii**. Pełne czyszczenie wymagałoby `git filter-branch`/BFG (osobny temat).

- **`tr -d '\0'` obcina ogony UTF-16 LE plików** (wykryte 2026-04-24) — klasyczny bug: plik UTF-16 LE kończący się pełnym znakiem ma bajty `X\0` lub `\0X` na końcu, które `tr -d '\0'` usunie częściowo — ostatnie bajty zostają odcięte, tracąc ogon. W sesji 2026-04-24 zepsuło mi to 13 plików (ogony typu `Separato`, `Skeleto`, `SheetDescrip` zamiast pełnych nazw). **Zasada**: do konwersji UTF-16 LE → UTF-8 używać `iconv -f UTF-16LE -t UTF-8`, nigdy `tr -d '\0'`.

- **Phantom `.git/index.lock` w Cowork sandbox** (wykryte 2026-04-24) — `.git/` w Cowork mount ma Windows ACL, sandbox nie może usunąć pliku lock. Skutek: **Claude w sesji Cowork nie może zrobić `git commit`**. Lock istnieje jako „phantom" (widoczny w `ls .git/` ale `stat .git/index.lock` mówi „No such file"). Workaround: wszystkie commity i push robisz z Windows-side przez Git Bash. Claude przygotowuje zmiany w plikach, Ty wykonujesz `git add`/`commit`/`push`.

- ~~**Line endings (CRLF/LF)**~~ — **ROZWIĄZANE 2026-04-24** (commit `368d34d`): `.gitattributes` z `* text=auto eol=lf`.

## Kluczowe decyzje architektoniczne

- **Next.js 14 App Router**, nie Pages Router. Struktura `src/app/(protected)/...` z grupą chronioną przez `layout.tsx` z sprawdzaniem sesji.
- **Supabase Client-side only** w większości miejsc, przez `@supabase/ssr` (`createBrowserClient`). Serwerowy klient (`server.ts`) używany głównie w route handlers (`/api/pdf`, `/api/docx`) i w auth callbacku.
- **Język UI i domeny: polski**. Wszystkie etykiety, nazwy tras (`/inspekcje`, `/turbiny`, `/farmy`, `/klienci`, `/inspektorzy`, `/diagnostyka`), nazwy elementów turbiny, typy napraw itp. są po polsku. Nazwy kolumn w DB — angielskie (po migracji z commita `47a7e50`).
- **Shadcn/ui + Radix** dla komponentów, **Tailwind** dla stylu. `components.json` zcommitowany.
- **Autentykacja**: Google OAuth wyłącznie, ról z tabeli `profiles` (admin / inspektor). Brak logowania email/password.
- **PWA** (manifest + ikony) — aplikacja ma być instalowalna, głównie na tablecie używanym w terenie.
- **PDF: jspdf + jspdf-autotable**. DOCX: `docx` (Node runtime).
- **Formularz inspekcji jako kreator 3-krokowy** — odzwierciedla przepływ papierowego protokołu, nie techniczny model DB.
- **Soft-delete** (`is_deleted`) zamiast fizycznego usuwania — po stronie UI filtrowane przez `.not('is_deleted', 'is', true)`.
- **Biblioteki (defects, findings, templates)** — pickery z gotowych fraz w Supabase, żeby inspektorzy nie wpisywali tego samego ręcznie za każdym razem.

## Przydatne komendy / linki

| Co | Gdzie |
|---|---|
| Repo na dysku | `C:\prowatech-inspekcje` |
| GitHub | https://github.com/wtrzecki-hub/prowatech-inspekcje |
| Live | https://prowatech-inspekcje.vercel.app |
| Supabase project id | `lhxhsprqoecepojrxepf` |
| Supabase URL | `https://lhxhsprqoecepojrxepf.supabase.co` |
| User (admin) | Waldek — `w.trzecki@cgedata.com` (Google OAuth) |
| Branch główny | `main` |
| Dane w DB | 424 turbiny, 98 farm, 70 klientów |

Przydatne komendy:
```bash
npm run dev           # lokalnie (ale OAuth redirectuje na Vercel)
npm run build         # produkcyjny build
npm run type-check    # tsc --noEmit
git log --oneline -20 # ostatnie commity
```

## Pliki nietrackowane (stan na 2026-04-23)

Do potwierdzenia z użytkownikiem czy gitignorować / zcommitować / usunąć:

- `Raport_zmian_Prowatech_Inspekcje.pdf` — raport dla klienta, nie commitować.
- `defect_batch_0..4.sql`, `defect_library.json`, `seed_defects_via_ef.mjs`, `upload_defects.mjs` — seed biblioteki defektów.
- `findings_batch_*.sql`, `findings_v2_batch_*.sql`, `findings_updates.json`, `upload_findings.mjs` — seed/migracja findings (już w .gitignore? do sprawdzenia).
- `seed_defect_library.sql` — jedna z wersji seedu.
- `rename_folders_2024.gs`, `rename_folders_2025.gs` — Google Apps Scripts, pomocnicze.
- `turbine_main_photos/`, `turbine_photos_map.json`, `upload_photos.mjs`, `generate-icons.mjs`, `generate-icons.ps1` — skrypty/assets jednorazowe.

Wszystkie skrypty z rozszerzeniem `.mjs` w katalogu głównym to prawdopodobnie operacje jednorazowe (seed, upload) uruchamiane przez Node ręcznie z lokalnej maszyny.

## Faza 1 — Fundamenty designu (zakończona 2026-04-23)

**13 plików, 2 commity na `main`:**
- `0c4fd3c` — `feat(design): faza 1 — tokeny kolorystyczne, typografia, komponenty bazowe`
- `5a1ad4d` — `docs: aktualizacja PROGRESS.md i redesign.md po Fazie 1 — sekcje 2, 4, 5`

### Tokeny — `tailwind.config.ts` + `src/app/globals.css`

**Primary / brand**
- `primary-600` = `#259648` (DEFAULT) — delikatnie jaśniejszy od logo #1F7F3A, ~5%. Zmiana jednolinijkowa gdy przyjdzie dokładny hex z pliku źródłowego logo.
- `primary-700` = `#1F7F3A` — hover na CTA
- Pełna paleta: `primary-50 / 100 / 500 / 600 / 700 / 800`

**Graphite (neutralna paleta zamiast generic `gray-*`)**

| Token | Hex | Zastosowanie |
|---|---|---|
| `graphite-50` | `#F7F9FB` | Tło strony / body |
| `graphite-100` | `#EEF1F5` | Nagłówki tabel, tła pomocnicze |
| `graphite-200` | `#DDE3EA` | Ramki, border default |
| `graphite-500` | `#5F6B7A` | Tekst drugorzędny, ikony nieaktywne |
| `graphite-800` | `#1B2230` | Nagłówki tabel (TableHead) |
| `graphite-900` | `#0F1520` | Tekst podstawowy |

**Kolory semantyczne** (każdy z odcieniami 50 / 100 / DEFAULT / foreground / 800)

| Token | DEFAULT | Zastosowanie |
|---|---|---|
| `success` | `#2E9F4A` | Ocena Dobry, status Zakończona/Podpisana |
| `info` | `#0284C7` | Ocena Zadowalający, status W toku |
| `warning` | `#F59E0B` | Ocena Średni, pilność Średnia |
| `danger` / `destructive` | `#DC2626` | Ocena Awaryjny, pilność Wysoka/Krytyczna |

**Shadcn base tokens** — wcześniej niezdefiniowane, teraz poprawnie podpięte jako bezpośrednie hex w `tailwind.config.ts`:

```
background / foreground / border / input / ring
card (DEFAULT + foreground)
muted (DEFAULT + foreground)
accent (DEFAULT + foreground)
secondary (DEFAULT + foreground)
popover (DEFAULT + foreground)
```

Dzięki temu klasy `bg-background`, `border-input`, `ring-ring`, `ring-offset-background`, `hover:bg-accent`, `bg-muted`, `text-muted-foreground` itp. faktycznie generują CSS (wcześniej cicho fallbackowały na transparent/nieokreślone).

**Cienie** (subtelne, B2B — nie „jebnięte"):

| Klasa | Wartość |
|---|---|
| `shadow-xs` | `0 1px 2px rgba(15,23,32,0.04)` |
| `shadow-sm` | `0 1px 3px rgba(15,23,32,0.06), 0 1px 2px rgba(15,23,32,0.04)` |
| `shadow-md` | `0 4px 12px rgba(15,23,32,0.06), 0 1px 2px rgba(15,23,32,0.04)` |
| `shadow-lg` | `0 12px 32px rgba(15,23,32,0.10), 0 2px 4px rgba(15,23,32,0.05)` |
| `shadow-focus` | `0 0 0 4px rgba(37,150,72,0.22)` |

**Radius** — `sm=4px, md=6px, lg=8px, xl=12px, 2xl=16px` (odpowiada Tailwind defaults poza `sm`: 2px→4px).

**CSS variables w `globals.css`** — `--color-primary`, `--color-fg-default`, `--color-surface-0/1/2/3`, `--color-border`, `--shadow-xs/sm/md/lg/focus`, `--radius-sm/md/lg/xl/2xl` — dla bezpośredniego użycia w CSS i przyszłego theming.

---

### Typografia — `src/app/layout.tsx`

- **Inter** (400 / 500 / 600) via `next/font/google`, zmienna CSS `--font-inter`
- **JetBrains Mono** (400 / 500) via `next/font/google`, zmienna CSS `--font-jetbrains-mono`
- `body className` = `{inter.variable} {jetbrainsMono.variable} font-sans`
- `tailwind.config.ts fontFamily` mapuje `font-sans` → `var(--font-inter)` i `font-mono` → `var(--font-jetbrains-mono)`
- Klasa `font-mono` gotowa do użycia wszędzie tam gdzie dane liczbowe / kody / daty (Faza 2)
- `theme-color` meta zmieniony z niebieskiego na `#259648`

---

### Komponenty bazowe

| Komponent | Zmiana |
|---|---|
| `badge.tsx` | +5 wariantów semantycznych: `neutral` (graphite), `success` (zielony), `warning` (amber), `danger` (czerwony), `info` (niebieski) — backward compat: stare warianty `default/secondary/destructive/outline` bez zmian |
| `button.tsx` | Wariant `default` → teraz zielony (bo `bg-primary` = `#259648`); +nowy wariant `danger`; hover `primary-700` zamiast `primary/90` |
| `card.tsx` | `shadow-sm` → `shadow-xs` (subtelniejszy); jawny `border-border` |
| `table.tsx` | `TableHeader`/`TableFooter`: `bg-gray-100` → `bg-graphite-100`; `TableRow`: `border-gray-200` → `border-graphite-200`, `hover:bg-gray-50` → `hover:bg-graphite-50`; `TableHead`: `text-gray-700` → `text-graphite-800`; `TableCaption`: `text-gray-500` → `text-graphite-500` |
| `sheet.tsx` | Focus ring: `ring-blue-500` → `ring-ring` (zielony) |
| `slider.tsx` | Track: `bg-gray-200` → `bg-graphite-200`; thumb: `accent-blue-600` → `accent-primary` |

---

### Layout

**`src/components/layout/sidebar.tsx`**
- Aktywny nav item: `bg-blue-50 text-blue-700` → `bg-primary-50 text-primary-700`
- Aktywna ikona: `text-blue-600` → `text-primary-600`
- Aktywna kropka: `bg-blue-600` → `bg-primary-600`
- Avatar fallback: `bg-blue-600` → `bg-primary-600`
- Nieaktywne ikony: `text-gray-400` → `text-graphite-500`
- Hover nav item: `hover:bg-gray-50` → `hover:bg-graphite-50`

**`src/components/layout/header.tsx`**
- Avatar fallback: `bg-blue-600` → `bg-primary-600`

**`src/app/(protected)/layout.tsx`**
- Loading spinner: `border-blue-600` → `border-primary`
- Kontener strony: `bg-gray-50` → `bg-graphite-50`

**`src/app/globals.css`**
- Body background: `#f3f4f6` (gray-100) → `#F7F9FB` (graphite-50)
- Scrollbar track/thumb: zaktualizowane do graphite

---

### `src/lib/constants.ts`

`STATUS_COLORS`, `CONDITION_COLORS`, `URGENCY_LEVEL`, `INSPECTION_STATUS` zaktualizowane do nowych tokenów semantycznych:

| Klucz | Przed | Po |
|---|---|---|
| `in_progress` | `bg-blue-100 text-blue-800` | `bg-info-100 text-info-800` |
| `completed` | `bg-green-100 text-green-800` | `bg-success-100 text-success-800` |
| `signed` | `bg-emerald-100 text-emerald-800` | `bg-primary-100 text-primary-700` |
| `draft` | `bg-gray-100 text-gray-800` | `bg-graphite-100 text-graphite-800` |
| `review` | `bg-yellow-100 text-yellow-800` | `bg-warning-100 text-warning-800` |
| `zadowalajacy` | `bg-blue-100 text-blue-800` | `bg-info-100 text-info-800` |
| `dobry` | `bg-green-100 text-green-800` | `bg-success-100 text-success-800` |
| `awaryjny` | `bg-red-100 text-red-800` | `bg-danger-100 text-danger-800` |
| urgency `low` | `bg-blue-100 text-blue-800` | `bg-info-100 text-info-800` |

---

### Co NIE zostało zmienione w Fazie 1

- Logika biznesowa, zapytania Supabase, typy TypeScript
- API / propsy komponentów (żadnych zmian w sygnaturach)
- Protokoły PDF/DOCX i logo w dokumentach (`public/logo-prowatech.png`)
- Indywidualne ekrany aplikacji (Dashboard, Klienci, Farmy, Inspekcje, Turbiny) — nadal mają hard-coded `blue-*` i `gray-*` klasy → to jest zakres Fazy 2

---

### Co wymaga oczu przed Fazą 2

1. **Kolor primary na żywo na Vercelu** — sprawdź czy `#259648` wygląda dobrze przy logo ProWaTech w sidebarze. Jak dostarczysz plik źródłowy logo z dokładnym hexem — zmiana jednolinijkowa w `tailwind.config.ts` (pole `primary-600` i `ring`).
2. **Ekrany aplikacji nadal mają `blue-*`** — sidebar i header są już zielone, ale np. Dashboard (`stats-cards.tsx`, `recent-inspections.tsx`), Inspekcje, Klienci, Inspektorzy mają jeszcze stare klasy — wygląd mieszany do momentu ukończenia Fazy 2.

---

## Historia sesji

Brief log kolejnych sesji pracy z Claude nad tym projektem. Każda nowa sesja powinna **dodać jedną linię** na górę tej sekcji.

- **2026-04-24** — **Redesign krok 6 — reszta paneli + link Diagnostyka.** 3 commity: `368d34d` (chore(repo): `.gitattributes` enforcing LF + binary exclusions — preventive), `d15929a` (feat(design): krok 6 re-skin pozostałych paneli — 13 plików, 110+/119-; re-skin `/inspektorzy` z font-mono na kodach uprawnień, 5 kolorowych sekcji formularza inspektora z semantic tokens, mop-up layoutów + logo w mobile-nav, `/login` z primary gradient, `/diagnostyka` z graphite-900 i font-mono na JSON, mop-up UI primitives shadcn), `5ced61d` (feat(layout): link „Diagnostyka" admin-only w sidebar+mobile-nav — fetch `profile.role` w `(protected)/layout.tsx`, podział `NAV_ITEMS_BASE` + `NAV_ITEMS_ADMIN`, ikona Activity). Zweryfikowane wizualnie na prod (Vercel) — badges GWO/UDT/SEP dokładnie w info/warning/neutral, font-mono na numerach uprawnień i telefonach, Aktywny=success. **Pułapka sesji**: próba ręcznego cleanup null bytes przez `tr -d '\0'` obcięła ogony 13 plikom UTF-16 LE (zepsute exporty typu `Separato`/`Skeleto`/`SheetDescrip`) — naprawione ręcznie dopisywaniem brakujących końcówek. Drugi blocker: **phantom `.git/index.lock` w Cowork sandbox** uniemożliwił Claude'owi wykonanie `git commit` — wszystkie commity zrobione z Windows-side Git Bash. Pełny audyt null-byte state w repo: 80 plików w `src/` ma null bytes zacommitowane w HEAD, build Vercela je znosi przez `typescript.ignoreBuildErrors: true` + autocrlf Windows Git. Decyzja: `.gitattributes` jako preventive; pełne cleanup HEAD odłożone (wymaga `git filter-branch`/BFG). Trzy nowe Gotchas: null bytes + `tr -d '\0'` pułapka + phantom `.git/index.lock`.
- **2026-04-24** — **Redesign krok 5 — Turbina · detail redesign.** 4 commity `fe30f4a` → `26ae3a2`: C1 (hero graphite z kodem turbiny Mono + chipy + 5 tabs, obecna zawartość w tab Przegląd), C2 (wykres oceny SVG + KPI „Ostatnia kontrola" i „Najbliższe przeglądy" z empty state dla małej historii), C3 (tabela historii + lista zaleceń z urgency pills I-IV zgodne z DOCX A3/PDF B3), C4 (grid zdjęć z `inspection_photos` + lista certyfikatów zespołu ostatniej inspekcji z expiry countdown). Zweryfikowane wizualnie na T150-Kowalewo (`fc7f18d6-cb55-45b8-a13b-1c44dbe406c7`) — dla testowej inspekcji 017/R/2026 pokazuje realne dane zaleceń (7 otwartych, 6×III i 1×II amber), empty states dla wykresu (<2 punkty), certyfikatów (brak `inspection_inspectors` relacji). **Plik przejściowy `SESSION_HANDOVER_2026-04-24.md`** wprowadzony w C1 (bo sesja była przy 61% tokenów; kolejne tury kontynuowały w tej samej sesji więc handover nie był potrzebny). **Gotcha**: URL `/turbiny/<id>` używa `turbine_id`, nie `inspection_id` — łatwo pomylić (UUID `4df3b711-...` to inspekcja 017/R/2026, `fc7f18d6-...` to turbina T150-Kowalewo). Plik page.tsx urósł z 479 → 1718 linii; wszystkie komponenty inline (do wydzielenia w osobnym refactorze jeśli będzie potrzeba).
- **2026-04-24** — **Redesign krok 4 — re-skin protokołu PDF/DOCX.** 6 commitów: `654e9b4` A1 (DOCX paleta/typografia + nowy moduł `src/lib/design/protocol-tokens.ts`), `5dd35ec` A2 (DOCX color-coding ocen sev-1..5 per-row shading + 3px pasek po lewej), `6ab653b` A3 (DOCX pills pilności I-IV w komórce Priorytet), `c551522` B1 (PDF analogicznie A1: jspdf RGB tokeny, setCharSpace dla kerningu, grubszy zielony pasek cover, running header graphite), B2 (PDF autoTable `didParseCell` + `didDrawCell` dla paska 1.5mm), `f48a07e` B3 (PDF autoTable `didParseCell` tylko na kolumnie Priorytet). Każdy etap zweryfikowany wizualnie na realnej inspekcji `4df3b711-867d-43d8-9127-91bdab1f91ef` (017/R/2026 — un-deleted dla celów testu + temporary SQL update 4 elementów na sev-2..5 → pobranie DOCX → pełna paleta widoczna → rollback). Decyzje: nagłówki tabel `graphite-800` (nie brand — prototyp HTML sugeruje oficjalność), paleta sev-1..5 1:1 z `design/prowatech-prototype.html` § 3, pills pilności z `constants.ts URGENCY_LEVEL`. Logo ProWaTech bez zmian (decyzja klienta). Polski copy (`Dobry/Zadowalający/Średni/Zły/Awaryjny`) z `RATING_LABELS` zamiast starych fragmentów (`'1'→'Bdb'`) z wcześniejszego kodu. Workflow: baseline pobrany na starcie (`PROTOKOL_017_PRZED.pdf/docx`) jako punkt odniesienia dla A/B. **Pułapka sesji:** Edit tool notorycznie obcinał duże pliki (DOCX route 1016 linii) — rozwiązanie: edycje przez Python w bash z parsowaniem ze świadomością string literals i `[` w `TableRow[]` (counting brackets od pozycji po `= [`).
- **2026-04-24** — **Fix Dashboard: filtr is_deleted w 3 starych komponentach + drobiazgi** (commit `9147796`). Po un-delete 3 testowych inspekcji odsłoniły się stare bugi: `StatsCards.totalInspections`, `RecentInspections` i `AlertsPanel` nie filtrowały `is_deleted` (w efekcie Dashboard pokazywał soft-deleted jako aktywne); `StatsCards.completedThisMonth` filtrował po nieistniejącym polu `completed_at` (zawsze 0) — zmiana na `inspection_date`. `AlertsPanel` użyła wzorca `inspections!inner(is_deleted)` + `.not('inspections.is_deleted', 'is', true)` — zweryfikowany SQL-em (7/0/7 — wszystkie otwarte zalecenia pochodzą z żywych inspekcji). Sparkline: copy chipu „w.t. tyg." → „vs poprz. tydz." + empty-state z ikoną gdy `total=0` zamiast płaskiej linii z kropkami. Build + Vercel deploy OK.
- **2026-04-24** — **Redesign krok 3 — re-layout Dashboard** (commit `c9b09aa`). Dodane 3 nowe komponenty w `src/components/dashboard/`: `inspection-trend-sparkline.tsx` (sparkline 12-tyg. liczby inspekcji, SVG inline z gradientem primary + chip trendu Δ), `inspection-calendar-14d.tsx` (grid 14 dni z wyróżnieniem „dziś", liczniki wyk./plan., klik → `/inspekcje?date=…`), `rating-distribution.tsx` (bar-chart poziomy rozkładu 5 ocen elementów). `dashboard/page.tsx` przepisany na 3-wierszowy układ: StatsCards → (sparkline 1/3 + kalendarz 2/3) → (Recent 2/3 + stack [RatingDist + Alerts] 1/3). Zero nowych zależności (recharts nie ma w package.json — użyto inline SVG). Konwencje: `createClient()` w `useEffect`, `.not('is_deleted', 'is', true)`, tokeny graphite/primary/semantic, UI po polsku. Build Next 14.2 — BUILD_ID `q_HDgEwR5eOCMD0eYr7vX`, brak błędów. 5 files changed, 759 insertions(+), 10 deletions(-).
- **2026-04-24** — **Portal klienta (Faza 3) wdrożony na produkcję.** Konfiguracja Vercel: nadpisano `SUPABASE_SERVICE_ROLE_KEY` świeżym service_role JWT z zakładki Legacy Supabase (pierwotny klucz z 2026-04-23 zwracał "Invalid API key" — pewnie został obcięty przy pierwszym wklejaniu). Env var tylko w Production + Preview (Development blokowany przez Vercel dla Sensitive). Utworzono `.env.local` z jedną zmienną `SUPABASE_SERVICE_ROLE_KEY` (Waldek wklejał wartość lokalnie). Supabase → URL Configuration: Redirect URL `portal/auth/reset` już był dodany wcześniej. Wymuszono pełny Redeploy na Vercelu (deploy `TaVz1pRJ5`). **Test przepływu**: utworzono testowe konto `w.trzecki+portaltest@cgedata.com` dla klienta Działdowo, zalogowano, zmieniono hasło (force_password_change OK), sprawdzono dashboard / farmy / turbinę własną / turbinę obcą (Brak dostępu OK) / protokoly. Testowe konto skasowane (auth.users + profiles + client_users + contact_email klienta przywrócony do `NULL`). Nowe wpisy w "Gotchas": bug formularza /klienci/[id] (UPDATE nie zapisuje), Sensitive env var vs Development Vercel, service_role vs nowe sb_secret_ keys.
- **2026-04-23** — **Faza 3 — Portal klienta** (commit `d301abf`). 14 nowych plików: migracja SQL (`client_users` + `force_password_change`), `/api/portal/create-account` (service role, temp password XXXX-XXXX-XXXX), UI portalu w `/klienci/[id]` (karta "Portal klienta", tworzenie konta, wyświetlanie hasła tymczasowego z kopiowaniem), `/portal/login` (email+hasło, reset hasła), `/portal/auth/reset` (route handler), `/portal/(client)/layout.tsx` (guard `client_user`, sidebar, force_password_change redirect), `auth/callback` (redirect per rola), dashboard, farmy, turbiny/[id], protokoly, konto. Zabezpieczone `/api/pdf` i `/api/docx` (auth check + weryfikacja `client_id` dla `client_user`). Pliki `design/next-steps.md` i `database.types.ts` zaktualizowane.
- **2026-04-23** — **Faza 2 wdrożona** (commit `a43d457`). Re-skin 15 plików: Dashboard (page+stats+recent+alerts), Inspekcje (lista+detail+StatusBar+ElementCard+RatingBadge), Formularz inspekcji (turbine-inspection-form), Klienci (lista+detail), Farmy (lista+detail), Turbiny (detail+PhotoSlot+InfoItem). Wzorce: font-mono dla dat/kodów/liczb, `text-[11px] uppercase tracking-wider text-graphite-400` dla nagłówków tabel, `h-[52px] hover:bg-graphite-50/50` dla wierszy, `border-graphite-200 shadow-xs rounded-xl` dla kart. Build czysty `✓ Compiled successfully`. Wypchnięto na `main`.
- **2026-04-23** — **Faza 1 wdrożona** (commit `0c4fd3c`). Tokeny kolorystyczne (#259648 primary), typografia (Inter 400/500/600 + JetBrains Mono 400/500 via next/font), palety graphite/semantic, shadcn base tokens, cienie xs–lg. Komponenty: badge (5 wariantów semantycznych), button (danger), card (shadow-xs), table (graphite), sheet/slider (primary). Layout: sidebar/header avatar+aktywny stan blue→primary, body bg→graphite-50. constants.ts: STATUS_COLORS/CONDITION_COLORS na nowe tokeny. Build przeszedł czysto. Vercel deploy w toku.
- **2026-04-23** — Propozycja nowego designu aplikacji (panel inspektora + portal klienta + protokół PDF). Deliverable: `design/prowatech-prototype.html` (klikany prototyp) + `design/prowatech-redesign.md` (dokument). Decyzje: primary #259648 (delikatnie jaśniejszy od logo #1F7F3A), JetBrains Mono na dane/kody, portal klienta email+hasło (Faza 3), ton portalu „Państwo/Państwa". **Logo protokołów zostaje bez zmian** — oryginalna wersja (`public/logo-prowatech.png`) w dokumentach wychodzących. Stylizowany znak SVG pozostaje w UI wewnętrznym.
- **2026-04-23** — utworzenie tego pliku PROGRESS.md. Read-only rekonesans: git log, struktura repo, stan gałęzi. Nie wprowadzono zmian w kodzie.
- **2026-04-13** — (rekonstrukcja z git log) DOCX: naprawa korupcji pliku, `runtime = 'nodejs'`, poprawne `Buffer`, `PageNumber`. Stabilizacja endpointu `/api/docx/[id]`.
- **2026-04-12 / 04-13** — dodanie endpointu DOCX i przycisku pobierania, osadzenie logo ProWaTech w PDF, nagłówek firmowy + prawny w protokole PDF.
- **2026-04-10** — duża sesja po feedbacku testera: biblioteka defektów, GWO 4 moduły, inspektorzy (WINDA ID, skany), farm→turbine kaskada, soft-delete inspekcji, wyszukiwarka, formularz PDF z polskimi znakami.
- **2026-04-07 / 04-08** — modernizacja UI (tablet-first, shadcn), formularz inspekcji `TurbineInspectionForm` 3-krokowy, layout zdjęć 12×7 cm / 5,5×7 cm, naprawa crashy klienta.
- **2026-04-02 → 04-04** — stabilizacja deploymentu na Vercel: SSR, env vars, kolumny, foreign keys, PWA manifest.
- **2026-04-01** — initial commit aplikacji.
