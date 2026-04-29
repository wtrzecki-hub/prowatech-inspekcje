# Architektura — Prowatech Inspekcje

_Wynesione z PROGRESS.md w refaktorze 2026-04-29. Stałe decyzje techniczne projektu, niezależne od bieżącej pracy._

Patrz też: [PROGRESS.md](../PROGRESS.md) (bieżący stan), [docs/gotchas.md](gotchas.md) (pułapki), [docs/sessions/2026-04.md](sessions/2026-04.md) (historia sesji).

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

---

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

---

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
