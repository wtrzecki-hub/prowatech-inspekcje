# PROGRESS — Prowatech Inspekcje

> **Ten plik jest aktualizowany na koniec każdej sesji pracy nad projektem.**
> **Jeśli jesteś Claude rozpoczynającym nową sesję pracy nad Prowatech Inspekcje — przeczytaj ten plik w pierwszej kolejności**, zanim zaczniesz eksplorować repo lub pytać użytkownika o kontekst.
>
> Po refaktorze 2026-04-29 (wieczór) ten plik jest **cienki**: bieżący stan + W toku + linki. Pełna historia / pułapki / architektura → katalog [docs/](docs/).

_Ostatnia aktualizacja: 2026-04-30 — **Faza 17 commit+push + przycisk „Otwórz" w PhotoSlot + migracja archiwum 2021 (192/206 = 93.2% pokrycia, +0.33 GB na R2).**_

---

## Bieżąca sesja — 2026-04-30: Faza 17 push + UX zdjęć + archiwum 2021

**(1) Commit + push Fazy 17 (4 commity, deployed Vercel).** `aab54f6` feat pipeline ekstrakcji + uploadu, `63218e1` refaktor PROGRESS na strukturę docs/, `e9bafcd` generator raportu PDF (Faza17_pominiete), `ac24fe5` markdown lista 50 pominiętych. Smoke test prod (Chrome) — T072 / WTG G06 / Głuszynko: 3 zdjęcia (portret 599×957 + 2 pejzaże) ładują się poprawnie z R2, layout Fazy 14 + dane Fazy 17 zielone end-to-end.

**(2) UX: przycisk „Otwórz" w hover overlay zdjęć turbiny (commit `c601002`).** Dotąd `PhotoSlot` ([page.tsx:1843](src/app/(protected)/turbiny/[id]/page.tsx#L1843)) miał w hover overlay tylko „Zmień" (+ tylko dla rol z `canUpload`). Po Fazie 17 wszystkie 375 turbin maja 3 zdjęcia, ale jedyna interakcja to upload — brakowało otwierania pełnowymiarowego pliku. Dorzucony `<a target="_blank" rel="noopener noreferrer">` z ikoną `ExternalLink` (lucide-react, już importowane). Overlay pokazuje się teraz **zawsze** gdy jest URL (każda rola), „Otwórz" lewy przycisk, „Zmień" prawy tylko gdy `canUpload`. Smoke test prod: klik „Otwórz" → nowa karta z `pub-edbf124.../turbines/{id}/photo_1.jpg`, Chrome native viewer renderuje obraz.

**(3) Migracja archiwum 2021 — 192/206 = 93.2% pokrycia.** Folder lokalny: `02 Archiwum_Prowatech\2021` (NIE `04 Inspekcje\2021` jak twierdziło PROGRESS przed sesją — historyczne archiwum jest w innym katalogu). 17 klientów / 400 PDF łącznie. Pipeline 4-krokowy:
- **Adaptacja matchera** (`scripts/scan_match_2021_local.py`, base z 2022 + 4 ulepszenia): (a) **klient hint po całej rel_path** (nie tylko top folder, bo 2021 ma multi-poziom — `EUROWIND/FW POŁUDNIE/DENMARK WIND/EW1`); (b) **multi-occurrence find** dla EW (np. `EW2` w `Protokol 04_EW_2021 ... EW2 Olsza` — pierwsze hit ma next='0' rejected, drugie 'o' accepted); (c) **farm_name fallback** w location_match (T177-Gościejewo / FW ROGOŹNO matchuje plik „EW Rogoźno 1"); (d) **digit_outside_pool drop** — gdy plik ma cyfrę (np. `WTG 17`) ale żadna turbina w pool kandydatów nie ma takiej cyfry → drop do no_ew_match (eliminuje multi-match Park Wiatrowy 12).
- **Filtr non-protocol** rozszerzony o `^FA_`, `^F\s*VAT`, `\bfaktur`, `upadkiem` (kontrola systemów ochrony przed upadkiem = ŚOI nie PIIB), `ewakuacyjn` — eliminuje 35 false-positive.
- **Skok pokrycia po polerce: 72% → 89%** (z polerką, dryrun final). Po uploadzie z trybem upsert: **93.2%** (placeholdery 2021 wzrosły z 139 → 206 dzięki cross-client wpisom).
- **Upload na R2 (host bash)**: 192/194 wgranych, 2 pominięte (T026/T027 Działdowo — already_filled z manualnego uploadu wcześniej), 0 błędów, 339.5 MB w ~5 min. Smoke test T072: counter „Historia inspekcji" 5 → 6 (+1 wpis 2021), tabela pokazuje pełną oś czasu 2021–2025 (`84/T/2021 Roczna`, 14.07.2021).
- **Raport PDF** `Brakujace_protokoly_2021.pdf` (36.1 KB, untracked) — Sekcja A: 14 brakujących u 7 klientów (FW Działoszyn EW Bella/Flower, Podzamek Golubski, Solec Kujawski, Pruchnowo, Wójcice), B: 6 multi-match (Strzałkowo ST5/6 cross-Cytrus/Gólcz, Podzamek/Solec confusion), C: 18 no-match (Bławaty gotcha, scany doc01416, RSN stacje).

**(4) R2 stan po sesji** (faktyczny pomiar przez `_r2_size_check.py`): **5.15 GB / 10 GB = 51.5%**. Korekta wobec PROGRESS sprzed sesji (mówił „~6 GB / 60%" — to był szacunek, faktycznie było 4.82 GB przed uploadem 2021).

**Pliki nowe (untracked po sesji):** `scripts/scan_match_2021_local.py`, `scripts/generate_missing_2021_report.py`, `Brakujace_protokoly_2021.pdf`, `scripts/output/manifest_2021_full*.json`, `scripts/output/upload_2021_run.log`, `scripts/output/report_batch_2026-04-30_*.json`. **Komity:** 5 (`aab54f6`/`63218e1`/`e9bafcd`/`ac24fe5` Faza 17 push + `c601002` przycisk Otwórz). Pipeline 2021 do commita w tej sesji.

---

## Najnowsze sesje (skrót — pełne wpisy w [docs/sessions/2026-04.md](docs/sessions/2026-04.md))

- **2026-04-29 wieczór** — Faza 17 DONE (372 turbiny × 3 zdjęcia z PDF 2025) + refaktor PROGRESS na strukturę docs/.
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

**Kluczowe liczby (2026-04-30):**
- 425 turbin / 98 farm / 70 klientów w bazie
- 375/425 turbin ma komplet 3 zdjęć z PDF 2025 (Faza 17)
- Archiwum protokołów PIIB rocznych: **1422/1599 placeholderów = 88.9% pokrycia** (2021 93.2%, 2022 89.0%, 2023 87.5%, 2024 100%, 2025 100%, 2020 0%)
- R2 storage (faktyczne): **5.15 GB / 10 GB = 51.5%** (`historical/` 5.09 GB, `turbines/` 58 MB, `inspections/` 5 MB)
- 6/425 turbin ma inspekcje wykonane w aplikacji (`inspections`), 5 ma otwarte zalecenia (`repair_recommendations`) — reszta tylko archiwum PDF (oczekiwane dla młodej aplikacji)

Pełen opis architektury, stosu technologicznego, decyzji projektowych, komend i linków → [docs/architecture.md](docs/architecture.md).

---

## W toku / następne kroki

**Bieżące priorytety (kolejna sesja):**

1. **Commit pipeline 2021** — `git add scripts/scan_match_2021_local.py scripts/generate_missing_2021_report.py PROGRESS.md && git commit && git push`. (Zostały do commita po sesji 2026-04-30.)

2. **Archiwum 2020** (99 placeholderów, 0%) — analogicznie do 2021. **UWAGA**: folder lokalny to `02 Archiwum_Prowatech\2020` (nie `04 Inspekcje\2020`), `04 Inspekcje` zaczyna się od 2022.
   ```bash
   cp scripts/scan_match_2021_local.py scripts/scan_match_2020_local.py
   sed -i 's/2021/2020/g' scripts/scan_match_2020_local.py
   # + zmień GDRIVE_2020 na "...02 Archiwum_Prowatech\\2020" (sed niewystarczający bo katalog ten sam)
   python scripts/scan_match_2020_local.py            # dryrun
   python scripts/scan_match_2020_local.py --copy     # + manifest
   python scripts/upload_batch.py scripts/output/manifest_2020_full.json
   ```
   Spodziewane pokrycie ~88-93% (matcher po polerce 2021 jest generyczny — singleton-farm + farm_name fallback + digit_outside_pool). ~20 min wall time. Po uploadzie R2 ~5.35 GB (54%).

**Otwarte / niezamknięte:**

3. **Brakujące placeholdery 2021 (14)** — Sekcja A raportu `Brakujace_protokoly_2021.pdf`: FW Działoszyn (T001/T002 EW Bella/Flower), FW Podzamek Golubski (T320/T321 EW 01/02), FW Solec Kujawski (T322/T323 EW 1/2), Pruchnowo (T004), Wójcice (T158). Wymagają zapytania do operatora czy kontrola roczna 2021 została wykonana.
4. **Sekcja B 2021 multi-match (6)** — Strzałkowo ST5/ST6 (cross-Cytrus/Gólcz, podobne do 2023 batch 1), Podzamek/Solec confusion (matcher bierze T323 i T329-Sumin razem). Manualne rozstrzygnięcie.
5. **Sekcja B Dobrzyca multi-match** (z 2023) — 12 plików `WTG-EW{N}` których matcher nie potrafi deterministycznie zmapować do `WTG{NN}`. Wymaga ręcznego mapowania per turbina lub cross-reference EW→WTG od operatora.
6. **Bławaty/Brzeźno** (1 plik 2021 + 1 plik 2023) — WS Wind Park VI: DB ma `T149-Bronisław` z `FW Brzeźno`, GDrive ma `EW Bławaty`. Decyzja DB vs operator, potem 2 ręczne uploady.
7. **Krok 7 Artura — „opis nieprawidłowości"** — czeka na input Artura. Czy nowa kolumna w `inspection_elements` (trzecie pole obok `notes`/`recommendations`), czy doprecyzowanie istniejącego pola? Raport `Raport_dla_Artura_2026-04-27.pdf` zawiera to pytanie zwrotne.

**Drobna polerka odłożona** (nie blokująca):

- Hero w innych miejscach (lista turbin `/turbiny`, dashboard, search results) — dziś tylko `/turbiny/[id]` ma nowy format `EW 1 · Lokalizacja · T<code>`. Sweep ~30 min jeśli Artur powie „chcę wszędzie".
- `Raport_zmian_Prowatech_Inspekcje.pdf` w roocie repo to stary raport — nadpisać przez `Raport_dla_Artura_2026-04-27.pdf` albo zostawić. Oba untracked.

**Pliki w workspace gotowe do reuse:**
- `scripts/scan_match_{2021,2022,2023,2025}_local.py` — szablony dla 2020 (preferuj 2021 jako bazę — najnowsze polerki: rel_path hint, multi-occurrence find, farm_name fallback, digit_outside_pool drop)
- `scripts/generate_missing_{2021,2022,2023,2025}_report.py` — szablony PDF reportów
- `scripts/upload_batch.py` — z trybem upsert (działa dla all years)
- `scripts/extract_photos_2025.py` + `scripts/upload_turbine_photos.py` — pipeline Fazy 17 (multi-year extension trywialny)
- `scripts/_r2_size_check.py` — szybki audyt zużycia R2 (boto3 list_objects + aggregation per prefix)

---

## Dokumenty pomocnicze

- **[docs/sessions/2026-04.md](docs/sessions/2026-04.md)** — pełna historia sesji (wpisy `Poprzednia:`, sekcja „Ostatnio zrobione", brief log, Faza 1 fundamenty designu)
- **[docs/gotchas.md](docs/gotchas.md)** — pułapki / utrwalone problemy (sandbox proxy, null bytes, PKCE+Gmail prefetch, R2 User-Agent block, etc.)
- **[docs/architecture.md](docs/architecture.md)** — stan projektu, kluczowe decyzje architektoniczne, komendy + linki, dane DB
- **[design/prowatech-redesign.md](design/prowatech-redesign.md)** — dokument projektowy redesignu (z 2026-04-23)
- **[design/prowatech-prototype.html](design/prowatech-prototype.html)** — klikany prototyp HTML
- **[migrations/](migrations/)** — wszystkie migracje SQL (każda z sekcją WERYFIKACJA + ROLLBACK)
