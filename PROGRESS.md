# PROGRESS — Prowatech Inspekcje

> **Ten plik jest aktualizowany na koniec każdej sesji pracy nad projektem.**
> **Jeśli jesteś Claude rozpoczynającym nową sesję pracy nad Prowatech Inspekcje — przeczytaj ten plik w pierwszej kolejności**, zanim zaczniesz eksplorować repo lub pytać użytkownika o kontekst. Zaktualizuj go na końcu sesji (sekcje "Ostatnio zrobione", "W toku / następne kroki" oraz "Historia sesji").

_Ostatnia aktualizacja: 2026-04-23 — sesja inicjująca plik PROGRESS.md. Ostatni commit w repo: `329e6ca` z 2026-04-13._

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

Na gałęzi `main` znajdują się niezacommitowane modyfikacje **tylko typu end-of-line** (CRLF↔LF) w kilkudziesięciu plikach — kosmetyczny szum, nie realne zmiany. Są też nietrackowane pliki roboczie (SQL-e sianiające defekty, skrypty GAS, Raport PDF) — patrz "Pliki nietrackowane" niżej.

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

**Redesign — Faza 1 DONE (2026-04-23).** Tokeny, fonty i komponenty bazowe wdrożone w commit `0c4fd3c`. Fazy 2–8 czekają — patrz `design/prowatech-redesign.md` sekcja 5.

**Faza 2 — następna:** Re-skin indywidualnych ekranów aplikacji (Dashboard, Klienci, Farmy, Inspekcje, Turbiny). Ekrany nadal używają hard-coded `blue-*`/`gray-*` klas — Faza 1 wniosła tokeny, Faza 2 je konsumuje.

Poza propozycją designu brak innych jawnie udokumentowanych prac w toku w repo, ale na podstawie stanu gałęzi i nietrackowanych plików można przypuszczać następujące otwarte wątki:

- **Kosmetyczny diff CRLF/LF** — prawie wszystkie śledzone pliki `src/` mają uncommitted diff polegający wyłącznie na zmianie końców linii. Do rozważenia: `.gitattributes` z `* text=auto eol=lf` (lub `eol=crlf`) + `git add --renormalize .` aby usunąć szum raz na zawsze. Jeśli użytkownik pracuje na Windows i pliki spontanicznie zmieniają się na CRLF, jest to prawdopodobne źródło.
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

- **Line endings (CRLF/LF)** — patrz "W toku". Plik się regeneruje jako diff po checkoutcie na Windows bez `.gitattributes`.

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

- **2026-04-23** — **Faza 1 wdrożona** (commit `0c4fd3c`). Tokeny kolorystyczne (#259648 primary), typografia (Inter 400/500/600 + JetBrains Mono 400/500 via next/font), palety graphite/semantic, shadcn base tokens, cienie xs–lg. Komponenty: badge (5 wariantów semantycznych), button (danger), card (shadow-xs), table (graphite), sheet/slider (primary). Layout: sidebar/header avatar+aktywny stan blue→primary, body bg→graphite-50. constants.ts: STATUS_COLORS/CONDITION_COLORS na nowe tokeny. Build przeszedł czysto. Vercel deploy w toku.
- **2026-04-23** — Propozycja nowego designu aplikacji (panel inspektora + portal klienta + protokół PDF). Deliverable: `design/prowatech-prototype.html` (klikany prototyp) + `design/prowatech-redesign.md` (dokument). Decyzje: primary #259648 (delikatnie jaśniejszy od logo #1F7F3A), JetBrains Mono na dane/kody, portal klienta email+hasło (Faza 3), ton portalu „Państwo/Państwa". **Logo protokołów zostaje bez zmian** — oryginalna wersja (`public/logo-prowatech.png`) w dokumentach wychodzących. Stylizowany znak SVG pozostaje w UI wewnętrznym.
- **2026-04-23** — utworzenie tego pliku PROGRESS.md. Read-only rekonesans: git log, struktura repo, stan gałęzi. Nie wprowadzono zmian w kodzie.
- **2026-04-13** — (rekonstrukcja z git log) DOCX: naprawa korupcji pliku, `runtime = 'nodejs'`, poprawne `Buffer`, `PageNumber`. Stabilizacja endpointu `/api/docx/[id]`.
- **2026-04-12 / 04-13** — dodanie endpointu DOCX i przycisku pobierania, osadzenie logo ProWaTech w PDF, nagłówek firmowy + prawny w protokole PDF.
- **2026-04-10** — duża sesja po feedbacku testera: biblioteka defektów, GWO 4 moduły, inspektorzy (WINDA ID, skany), farm→turbine kaskada, soft-delete inspekcji, wyszukiwarka, formularz PDF z polskimi znakami.
- **2026-04-07 / 04-08** — modernizacja UI (tablet-first, shadcn), formularz inspekcji `TurbineInspectionForm` 3-krokowy, layout zdjęć 12×7 cm / 5,5×7 cm, naprawa crashy klienta.
- **2026-04-02 → 04-04** — stabilizacja deploymentu na Vercel: SSR, env vars, kolumny, foreign keys, PWA manifest.
- **2026-04-01** — initial commit aplikacji.
