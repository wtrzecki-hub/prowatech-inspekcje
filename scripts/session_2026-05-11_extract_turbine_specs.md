# Sesja 2026-05-11 evening — Ekstrakcja parametrów technicznych z protokołów 2025

Branch: `claude/extract-turbine-specs` (commit `84ecdd8`)

## 1. Cel

Wyciągnąć parametry techniczne turbin z sekcji „Opis techniczny" w archiwalnych
protokołach rocznych 2025 (R2) i zapisać do `turbines.*` w Supabase. Bez LLM —
regex tylko.

Kontekst: PR #17 (`feat(turbina): rozszerzony opis techniczny...`) dodał kolumny
techniczne do `turbines`. Były puste — trzeba uzupełnić z archiwalnych protokołów.

## 2. Zakres

**9 pól docelowych** (z 14 z PR #17 — 5 odrzuconych jako „nie potrzeba"):

- tower_height_m, hub_height_m, rotor_diameter_m
- tower_segments_count, tower_construction_type
- foundation_diameter_m, foundation_depth_m
- building_permit_number, building_permit_date

**Pomijane** (kolumny zostają w DB, nie wyciągane): foundation_concrete_class,
nacelle_material, blade_material, service_crane_capacity_t, pedestal_height_m.

**Skala:** 375 protokołów rocznych 2025 na R2 (`historical/<uuid>/2025_annual_*.pdf`),
1.3 GB. Streaming przez boto3 + fitz, bez plików tymczasowych.

## 3. Decyzje

- Strategia: **regex** (deterministyczna, zero kosztów API, brittle akceptowalny)
- Walidacja: od razu do DB (PATCH przez Supabase REST)
- Konflikty: **skip-if-any-filled** — turbina z JAKIMKOLWIEK z 9 pól non-NULL → skip
- Akceptujemy prefix „ok." w PDF (np. „H= ok. 120 m" → 120.0)

## 4. Implementacja — kluczowe decyzje regex

### 4.1. Lokalizacja sekcji „Opis techniczny"

```python
m = re.search(
    r"Opis techniczny:(.+?)(?:Cz[eę][sś][cć]\s+II|Stan techniczny|Ocena stanu)",
    full_text, re.DOTALL | re.IGNORECASE,
)
```

Sekcja jest zawsze na stronach 1-3, zakończona „Część II" / „Stan techniczny" / „Ocena stanu".
Brak match → pusty słownik (no_text=0 w finalnym dry-run, czyli zawsze znaleziona).

### 4.2. Normalizacja whitespace

Po wyciągnięciu sekcji: `text = re.sub(r"\s+", " ", text)`. To pozwala matchować przez
łamania linii bez specjalnej obsługi.

### 4.3. Tower construction type — priorytet zamiast jednego matchu

**Problem:** w tekście „Wieża stalową rurą... Fundament żelbetowy" regex `wieża.*?(stalow|żelbet)`
mógł złapać „żelbet" z fundamentu jako wartość dla wieży.

**Fix:** zbierz WSZYSTKIE kandydatów, zastosuj priorytet:
1. **stalowa** — wygrywa jeśli pojawia się w opisie
2. **hybrydowa**
3. **zelbetowa** — tylko jeśli stalowa/hybrydowa nie znaleziono

Powód: „żelbetowa" typowo opisuje fundament, „stalowa" wieżę. Jeśli oba są w opisie wieży,
wieża jest stalowa.

### 4.4. Pułapki regex (do pamięci)

- **`[^.!?]{0,N}?` jako window** zawiedzie na liczbach typu „GE 2.75MW" — kropka cuts.
  Używać `.{0,N}?` z lazy quantifier.
- **`[aąyej]+`** nie matchuje „stalowych" (nie ma `c`). Używać `\w+`.
- **Prefix „ok."** — `_OK_PREFIX = r"(?:ok\.\s*)?"` dla tower_height/hub_height/rotor_diameter.

## 5. Wyniki

### Apply na pełnych 375 (2026-05-11 18:XX)

```
=== APPLY DONE ===
  updated              370
  skipped_filled       5
  no_data              0
  errors               0
```

### Per-pole pokrycie (z 370 przetworzonych)

| Pole | % | Komentarz |
|---|---|---|
| tower_height_m | 99.5 | ★ |
| rotor_diameter_m | 98.6 | ★ |
| tower_construction_type | 93.8 | ★ |
| building_permit_number | 56.5 | data + numer typowo razem |
| building_permit_date | 56.5 | |
| hub_height_m | 48.9 | często równe wysokości wieży, regex `h=` nie zawsze |
| foundation_depth_m | 39.5 | różne formaty: `-2,25 m`, `p.p.t`, `głębokości X m` |
| foundation_diameter_m | 34.3 | `średnicy X m`, `d=X,Ym` |
| tower_segments_count | 27.3 | tylko gdy PDF wprost wymienia liczbę |

Niskie wartości to braki w samych PDF-ach (krótsze opisy techniczne dla niektórych
producentów/lat), nie wina regex.

## 6. Co dalej (opcjonalne)

- Rozszerzyć na 5L (zmiana filtra `2025_annual` → `2025_five_year`) — łatwe
- Backfill starszych roczników (2024, 2023, ...) — analogicznie
- LLM fallback (Claude Haiku) dla pól które regex pominął — koszt ~$0.001/protokół
- Lub manualny edit przez UI karty turbiny dla brakujących pól

## 7. Memory updates

- Nowa: `reference_extract_turbine_specs.md` (skrypt, R2 paths, stats, regex gotchas)
- Update: `MEMORY.md` index

## 8. Branch + commit

```
84ecdd8 feat(turbines): skrypt ekstrakcji parametrów technicznych z protokołów 2025

Branch:  claude/extract-turbine-specs
Push:    ✓ origin
PR:      not opened (per project pattern — leave for user)
```
