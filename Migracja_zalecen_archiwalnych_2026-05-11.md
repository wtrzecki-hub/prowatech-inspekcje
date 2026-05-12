# Migracja zaleceń archiwalnych 2026-05-11 (sync v2 z xlsx)

Sesja domyka tematy z `Migracja_zalecen_archiwalnych_2026-05-10.md`:
synchronizuje stan `historical_protocols` + `historical_protocol_recommendations`
ze źródłowym `spis wyciągniętych zaleceń.xlsx` i naprawia bug "115 duplikatów"
oraz "65 kolizji" wykryte poprzedniego dnia.

Plus zmiany kodu UI — patrz [PR #25](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/25).

## Migracje DB (5 zaaplikowanych przez `apply_migration`)

### A. `2026_05_11_sync_hp_protocol_numbers_with_xlsx`
**Co:** UPDATE `protocol_number` na 114 hp 2025 zgodnie z xlsx (głównie 5y zlepione pod nr rocznego).

Wykrywanie: `fix_serial` (strip prefiksów `GE-`, auto-fix `GE-25185XXX → 27185XXX` literówki Potęgowo) + porównanie xlsx serial+type → db hp. 116 mismatch, z czego 2 pominięte:
- T212-Trląg `493/T/2025` → xlsx `493/T/2024` (rok różny)
- T214-Trląg `495/T/2025` → xlsx `495T/2025` (literówka xlsx, baza ma poprawny format)

Spot-check: T199-Bronisław 5y `221/T/2025` → `238/T/2025`, T343-Pełczyce 5y `53/T/2025` → `50/T/2025`, T190-Gradowo 5y `212/T/2025` → `229/T/2025`, T067-Głuszynko 5y `111/T/2025` → `131/T/2025`.

### B. `2026_05_11_hpr_dedup_and_remove_placeholders` (krok 1)
**Co:** DEDUP po `(historical_protocol_id, item_number, recommendation_text)`, zachowaj najstarszy.

Skala: 437 zduplikowanych wpisów hpr usuniętych — efekt znanych "65 kolizji" z 2026-05-10 (3 różne nr protokołu w xlsx mapowały do 1 hp_id w DB).

### C. `2026_05_11_hpr_dedup_and_remove_placeholders` (krok 2)
**Co:** DELETE wszystkich placeholder `BRAK ZALECEŃ` / `Brak robót` w hpr.

Skala: 195 wierszy. Po migracji A 14 hp 5y które wcześniej miały tylko placeholder są puste, stąd po stronie UI sekcje 5y dla nich nie pokażą się (zgodne z prawdą — w PDF tych protokołów też nie ma zaleceń).

### A2 + D. `2026_05_11_import_missing_xlsx_recs_v2`
**Co:** Druga fala synchronizacji po rozszerzeniu `fix_serial` o prefiksy `PW`, `FWT-`, `GE` bez myślnika.

Pre-existing fix_serial sprzed sesji 2026-05-10 obsługiwał tylko `GE-` → 30 turbin z prefiksami `PW56090007`, `FWT-D-034 2500-100`, `GE78991907`, `GE-52102066` itp. nie zostały wcześniej zmapowane.

Akcje:
1. UPDATE T005-Chełmce 5y `208/T/2025` → `225/T/2025` (kolejny mismatch który umknął sesji A bez `PW` prefix)
2. INSERT 105 zaleceń xlsx do **39 hp** gdzie hp w bazie istnieje, ale hpr było puste (np. `T160/T161-Broniewice`, `T187-T189-Żeńsko`, `T045-Kietrz`, T005-Chełmce annual, T200-Orle, T197-Gradowo, T194-Lubsin, EW Sumin-Strzygi, T328/T329-Sumin, T330/T331-Żałe + 14 turbin Głuszynko/Karżcino/Sulechówko/Bartolino/Przystawy/Borkowo).

### E. `2026_05_11_fuzzy_dedup_hpr_strip_repair_suffix`
**Co:** Fuzzy dedup po `regexp_replace(text, '\s*\((K|NB|NG)\)\s*$', '')`.

Sesja 2026-05-10 strippowała sufiks `(K)/(NB)/(NG)` z `recommendation_text` (zostawiała tylko w `repair_type`), sesja 2026-05-11 (krok D) zachowała sufiks. Bez fuzzy dedup pojawiły się dublety dla T005-Chełmce 5y (5 sztuk). DELETE 5 dublujących się wpisów, zachowując najstarsze (czystszy tekst bez sufiksu).

### F. `2026_05_11_import_t012_ostrowite_xlsx_recs`
**Co:** Manual import 5 zaleceń xlsx dla **T012-Ostrowite** (Ventus, Fuhrlander MD77, EW Ostrowite).

xlsx ma serial `FL693VE01BMD77`, baza ma skrócony `FL693` (zatwierdzony przez Waldka jako poprawny). `fix_serial` nie miałby jak obsłużyć tej różnicy bez heurystyki która mogłaby zepsuć inne dane → ręczne dolinkowanie po `hp_id` (`f8b0a7ba-...` dla `93/T/2025` annual z 2025-05-08).

5 zaleceń: 1×NB + 4×K, wszystkie pilność III.

## Wyniki w bazie

| Metryka | Przed (start sesji) | Po (koniec sesji) |
|---|---|---|
| `historical_protocol_recommendations` | 1346 wierszy | **844 wierszy** |
| Unikalnych hp z zaleceniami | 428 | **317** |
| Pary annual+5y z TYM SAMYM `protocol_number` (bug 115 duplikatów) | ~115 (2024-2025) | **0** (2024-2025) |
| Turbiny z sekcją annual w UI karty | — | **206** (z 386 hp annual) |
| Turbiny z sekcją 5y w UI karty | — | **111** (z 125 hp 5y) |

## "2 w 1" — zweryfikowane

Waldek wskazał że "czasem robimy protokół 5-letni z elementami przeglądu rocznego" — czyli jeden PDF spełnia oba kryteria.

Sprawdzono: w archiwum 2024-2025 **0 takich przypadków** w R2. Wszystkie 14 turbin z grupy "BRAK ZALECEŃ 5y" mają OSOBNE pliki PDF dla annual i 5y. Migracja A nie zniszczyła żadnego "2 w 1".

W 2022 znaleziono 2 pary z identycznym `protocol_number` na annual i 5y, ale oba mają RÓŻNE pliki PDF — więc to są osobne protokoły z błędną numeracją, nie "2 w 1".

Reguła "2 w 1" zapisana w memory `reference_xlsx_zalecenia.md` na przyszłość przy imporcie nowych protokołów.

## TODO — pozostałe (do osobnej sesji)

1. **12 AUTO-CREATED z 2026-05-10 bez PDF w R2** (potwierdzone przez listing R2 = brak plików):
   - `99P/T/2024` T154-Skarboszewo, `100P/T/2024` T155-Skarboszewo
   - `207/T/2024` T062-Bęcino, `208/T/2024` T063-Karżniczka, `209/T/2024` T064-Karżniczka, `210/T/2024` T065-Karżniczka, `211/T/2024` T066-Bęcino
   - `232/T/2025` T196-Malina
   - `371/T/2025` T350-Graboszewo, `372/T/2025` T351-Graboszewo, `373/T/2025` T352-Paruszewo
   - `466/T/2025` T149-Bronisław

   Wymagane: ręczne wgranie PDF do bucketu R2 + UPDATE `protocol_pdf_r2_key` + `protocol_pdf_url` w hp.

2. **T212-Trląg** — `493/T/2024` (xlsx) vs `493/T/2025` (db). Sprawdzić w PDF z R2 który rok prawidłowy.

3. **T214-Trląg** — `495T/2025` (xlsx, literówka — brak `/T/`) vs `495/T/2025` (db, poprawny format). Najpewniej baza ma rację — ale warto sprawdzić w PDF.

## Pliki robocze

`outputs/work/`:
- `xlsx_protocols.json` — pełen ekstrakt xlsx (608 wierszy z czystym serial/proto/type)
- `db_hp_2024_2025.json` — snapshot bazy hp 2024-2025 (879 wierszy)
- `protocol_mismatches.json` — diff xlsx vs db (mismatch + missing_hp + db_only)
- `v2_problems.json` — re-analiza po lepszym fix_serial (3 mismatch + 1 missing_hp + 39 recs_to_import)
- `r2_listing.json` + `r2_index.json` — listing R2 bucket prowatech-inspekcje (1631 plików, 1626 zindeksowanych po `(turbine_id, year, type)`)
- `migration_a_update_proto.sql` — 114 UPDATE-ów dla migracji A
- `migration_d_recs_v2.sql` — 105 INSERT-ów dla migracji D
- `commit_msg.txt` — wiadomość commitu PR #25

## Kod (PR #25)

Patrz [feat(zalecenia-archiwum): wystaw zalecenia z hpr...](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/25):
- Karta turbiny: 2 sekcje (annual + 5y) z badge'ami K/NB/NG i pilnością I-IV
- Karta klienta + farmy: union `inspections` + `historical_protocols` z badge "Archiwum"
- Formularz inspekcji: warstwa 3 auto-importu czyta hpr (zamiast tylko metadata)
- Filtr placeholder + dedup po tekście w UI (martwy net na wypadek przyszłych re-importów)

---

_Sesja: 2026-05-11, ~3-4h pracy: pełna analiza xlsx vs DB → 6 migracji DB → weryfikacja "2 w 1" przez R2 listing → manual fix T012-Ostrowite → memory update._
