# PROGRESS — Prowatech Inspekcje

> **Ten plik jest aktualizowany na koniec każdej sesji pracy nad projektem.**
> **Jeśli jesteś Claude rozpoczynającym nową sesję pracy nad Prowatech Inspekcje — przeczytaj ten plik w pierwszej kolejności**, zanim zaczniesz eksplorować repo lub pytać użytkownika o kontekst.
>
> Po refaktorze 2026-04-29 (wieczór) ten plik jest **cienki**: bieżący stan + W toku + linki. Pełna historia / pułapki / architektura → katalog [docs/](docs/).

_Ostatnia aktualizacja: 2026-04-29 (wieczór) — **Faza 17 DONE — 372 turbiny mają komplet 3 zdjęć z protokołów PIIB 2025 na karcie turbiny + refaktor PROGRESS.md na strukturę docs/.**_

---

## Bieżąca sesja — 2026-04-29 (wieczór): Faza 17 + refaktor PROGRESS

**(1) Faza 17 — DONE.** Auto-ekstrakcja 3 zdjęć turbiny ze strony tytułowej protokołów PIIB 2025 → karta turbiny.

- **Ekstrakcja (`scripts/extract_photos_2025.py`)**: 372/375 OK, 0 errors, 3 skipped (sample z poprzedniego runu), **419s = 7 min**, ~1 GB pobrania z R2. PyMuPDF render bbox z page 1 jako pixmap (DPI 220) → re-encode JPEG max 1920px q85 (~50–270 KB / zdjęcie).
- **Naprawa pierwszego runu**: bulk z hosta padał na 403 dla wszystkich 175 download-ów — okazało się że **R2 publiczny URL (`pub-*.r2.dev`) blokuje domyślny `User-Agent: Python-urllib/3.13`**, akceptuje `Mozilla/5.0`. Fix w `download_pdf()` (`scripts/extract_photos_2025.py:179`). Patrz [docs/gotchas.md](docs/gotchas.md) → nowa pozycja.
- **Upload (`scripts/upload_turbine_photos.py`)**: 372/372 OK + 3 sample dorzucone manualnie przez `_patch_sample3_manifest.py` = **375 turbin × 3 zdjęcia = 1125 plików na R2** + `UPDATE turbines.photo_url/_2/_3` przez supabase-py. ~7 min, 0 errors.
- **Stan DB po sesji**: **375/425 turbin ma komplet 3 zdjęć R2** (`pub-edbf124...r2.dev/turbines/{id}/photo_{1,2,3}.jpg`). 50 turbin bez zdjęć — wszystkie to turbiny bez 2025 annual PDF (oczekiwane: brak źródła). 0 błędów upload-u, smoke test HEAD na losowym URL → 200 OK / 72 KB / image/jpeg.

**(2) Refaktor PROGRESS.md** (>900 linii → cienki ~120 linii) — pełna historia wyniesiona do [docs/sessions/2026-04.md](docs/sessions/2026-04.md), pułapki do [docs/gotchas.md](docs/gotchas.md), stan + decyzje + komendy do [docs/architecture.md](docs/architecture.md).

**Pliki nowe (untracked, sandbox-output ignored):** `scripts/extract_photos_2025.py`, `scripts/upload_turbine_photos.py`, `scripts/_inspect_pdf_2025_sample.py`, `scripts/_patch_sample3_manifest.py`, `docs/sessions/2026-04.md`, `docs/gotchas.md`, `docs/architecture.md`. **Komity:** 0 (do zrobienia).

---

## Najnowsze sesje (skrót — pełne wpisy w [docs/sessions/2026-04.md](docs/sessions/2026-04.md))

- **2026-04-29 popołudnie** — implementacja Fazy 17 (sample 3-PDF zwalidowane, bulk z sandboxa padł 403 r2.dev). Niedokończona, sesja wieczorna ją zamknęła.
- **2026-04-29 rano** — migracje archiwum 2022/2023/2025 (947 plików, 3.6 GB na R2), bugfix UI Historia inspekcji (commit `6217232`), placeholdery 2025/2023, **91.5% pokrycia archiwum**.
- **2026-04-28 noc** — Faza 15.G dla 2024 (PB w GDrive 2025) + audyt 2025: 48 plików PB gotowych, +20 commitów na produkcji. Archiwum UI: tryby fill-placeholder / replace-file (commit `ee28901`).
- **2026-04-28 wieczór (×3)** — 167 + 43 EDP + polerka oznaczeń: 210 plików łącznie, pokrycie 2024 = 62.7%, model `area_label` dla POTEGOWO (8 farm w 3 obszarach), fix `ew_designation` Bęcino/Głuszynko.
- **2026-04-28 rano** — Faza 15.G ROZPOCZĘTA: 4 fazy + MVP wgrywania (Fazy 8–11 zamknięte, ew_designation 425/425, placeholdery historyczne 1130, refactor migrate_historical_protocols).
- **2026-04-27** — Roadmapa uwag Artura: 6/7 kroków DONE, 8 commitów + edit dialog dla turbin + raport `Raport_dla_Artura_2026-04-27.pdf`.
- **2026-04-26** — Faza 16 (audyt seedów + smoke test portalu klienta end-to-end), Faza 16.1 (DB trigger auto-sign), Faza 15 (R2 + archiwum PIIB), Faza 14 (3 zdjęcia turbiny w PDF/DOCX).

> Pełne sesje (ze szczegółami implementacyjnymi, decyzjami, pułapkami): [docs/sessions/2026-04.md](docs/sessions/2026-04.md).

---

## Stan projektu (krótko)

Aplikacja webowa (PWA) do zarządzania inspekcjami turbin wiatrowych dla firmy ProWaTech. Next.js 14 App Router + Supabase + Cloudflare R2 + Vercel. UI po polsku.

**Kluczowe liczby (2026-04-29 wieczór):**
- 425 turbin / 98 farm / 70 klientów w bazie
- 375/425 turbin ma komplet 3 zdjęć z PDF 2025 (Faza 17)
- Archiwum protokołów PIIB: 1287/1407 placeholderów = **91.5% pokrycia** (2022 84.8%, 2023 83.6%, 2024 100%, 2025 90.9% annual + 100% five_year)
- R2 storage: ~6 GB / 10 GB free tier (60% used)

Pełen opis architektury, stosu technologicznego, decyzji projektowych, komend i linków → [docs/architecture.md](docs/architecture.md).

---

## W toku / następne kroki

**Bieżące priorytety (kolejna sesja):**

1. **Commit + push Fazy 17** — `git add scripts/extract_photos_2025.py scripts/upload_turbine_photos.py docs/ PROGRESS.md && git commit && git push`. Po wgraniu — smoke test w UI (otwórz dowolną turbinę z 2025 annual w `/turbiny/[id]`, sprawdź że karta + metryczka inspekcji pokazują 3 zdjęcia).

2. **Archiwum 2021** (139 placeholderów, 0%) — pipeline gotowy:
   ```bash
   cp scripts/scan_match_2022_local.py scripts/scan_match_2021_local.py
   sed -i 's/2022/2021/g' scripts/scan_match_2021_local.py
   python scripts/scan_match_2021_local.py            # dryrun
   python scripts/scan_match_2021_local.py --copy     # + manifest
   python scripts/upload_batch.py scripts/output/manifest_2021_full.json
   python scripts/generate_missing_2021_report.py     # raport PDF
   ```
   Folder GDrive: `G:\Dyski współdzielone\21 PROWATECH - INSPEKCJE\04 Inspekcje\2021`. Spodziewane pokrycie ~85% (matcher generyczny). ~30 min wall time.

3. **Archiwum 2020** (99 placeholderów) — analogicznie do 2021. Folder `04 Inspekcje/2020`.

**Otwarte / niezamknięte:**

4. **Sekcja B Dobrzyca multi-match** — 12 plików `WTG-EW{N}` których matcher nie potrafi deterministycznie zmapować do `WTG{NN}`. Wymaga ręcznego mapowania per turbina lub cross-reference EW→WTG od operatora.
5. **Bławaty/Brzeźno** (1 plik) — WS Wind Park VI: DB ma `T149-Bronisław` z `FW Brzeźno`, GDrive ma `EW Bławaty`. Decyzja DB vs operator, potem 1 ręczny upload.
6. **Krok 7 Artura — „opis nieprawidłowości"** — czeka na input Artura. Czy nowa kolumna w `inspection_elements` (trzecie pole obok `notes`/`recommendations`), czy doprecyzowanie istniejącego pola? Raport `Raport_dla_Artura_2026-04-27.pdf` zawiera to pytanie zwrotne.

**Drobna polerka odłożona** (nie blokująca):

- Hero w innych miejscach (lista turbin `/turbiny`, dashboard, search results) — dziś tylko `/turbiny/[id]` ma nowy format `EW 1 · Lokalizacja · T<code>`. Sweep ~30 min jeśli Artur powie „chcę wszędzie".
- `Raport_zmian_Prowatech_Inspekcje.pdf` w roocie repo to stary raport — nadpisać przez `Raport_dla_Artura_2026-04-27.pdf` albo zostawić. Oba untracked.

**Pliki w workspace gotowe do reuse:**
- `scripts/scan_match_{2022,2023,2025}_local.py` — szablony dla 2021/2020
- `scripts/generate_missing_{2022,2023,2025}_report.py` — szablony PDF reportów
- `scripts/upload_batch.py` — z trybem upsert (działa dla all years)
- `scripts/extract_photos_2025.py` + `scripts/upload_turbine_photos.py` — pipeline Fazy 17 (multi-year extension trywialny)

---

## Dokumenty pomocnicze

- **[docs/sessions/2026-04.md](docs/sessions/2026-04.md)** — pełna historia sesji (wpisy `Poprzednia:`, sekcja „Ostatnio zrobione", brief log, Faza 1 fundamenty designu)
- **[docs/gotchas.md](docs/gotchas.md)** — pułapki / utrwalone problemy (sandbox proxy, null bytes, PKCE+Gmail prefetch, R2 User-Agent block, etc.)
- **[docs/architecture.md](docs/architecture.md)** — stan projektu, kluczowe decyzje architektoniczne, komendy + linki, dane DB
- **[design/prowatech-redesign.md](design/prowatech-redesign.md)** — dokument projektowy redesignu (z 2026-04-23)
- **[design/prowatech-prototype.html](design/prowatech-prototype.html)** — klikany prototyp HTML
- **[migrations/](migrations/)** — wszystkie migracje SQL (każda z sekcją WERYFIKACJA + ROLLBACK)
