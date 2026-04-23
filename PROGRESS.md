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
