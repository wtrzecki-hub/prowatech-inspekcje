# MIGRATION PLAN — Wzory protokołów PIIB

> **Plan wdrożenia wzorów protokołów kontroli okresowej zgodnych z Załącznikiem do uchwały nr PIIB/KR/0051/2024 KR PIIB z dnia 04.12.2024 r.**
> Bazuje na trzech plikach przekazanych 2026-04-25 przez Waldka: `Protokol_Kontroli_Rocznej_EW_PIIB.docx`, `Protokol_Kontroli_5-letniej_EW_PIIB.docx`, `Raport_zmian_wzory_PIIB.docx`.
> Status: **PROPOZYCJA — czeka na akceptację Waldka przed wykonaniem.**
> Autor: Claude (Cowork). Data: 2026-04-25.

---

## 1. Streszczenie zmian

Cel biznesowy: ujednolicenie protokołów branżowych (turbina wiatrowa) z układem ogólnobudowlanym PIIB tak, aby były rozpoznawane i akceptowane przez powiatowe inspektoraty nadzoru budowlanego i spójne z dokumentami sporządzanymi dla pozostałych obiektów budowlanych w portfelu zarządcy.

Zakres techniczny dotyka czterech warstw aplikacji:

1. **Baza danych (Supabase, projekt `lhxhsprqoecepojrxepf`)** — zmiana enuma `condition_rating` z 5 na 4 stopnie, mapowanie istniejących wartości, nowe tabele PIIB, nowe kolumny w `inspection_elements` i `inspections`, kolumny `repair_type` / `urgency_level` / `wear_percentage` zachowane jako legacy.
2. **Definicje elementów (`inspection_element_definitions`)** — nowy seed: 15 elementów dla protokołu rocznego, 16 dla 5-letniego (dodano "Estetyka obiektu i otoczenia"). Każdy element zawiera tekst "Pozycje do oceny", "Zakres roczny", "Zakres dodatkowy 5-letni", "Przepisy / normy".
3. **UI komponentów inspekcji** — `RatingBadge`, `ElementCard`, `RepairTable`, plus pięć nowych komponentów dla sekcji II, IV, VI, VIII PIIB (poprzednie zalecenia, stan awaryjny, zakres robót remontowych, wymagania art. 5 PB, załączniki).
4. **Generatory PDF/DOCX** — `/api/docx/[id]` i `/api/pdf/[id]` przepisane pod układ PIIB. Jeden generator z warunkiem `inspection_type` (sekcje 5-letnie warunkowe, kolumna "Zakres dodatkowy" pojawia się tylko dla `five_year`).

**Decyzje strategiczne (zatwierdzone przez Waldka 2026-04-25):**

- **A.** Mapowanie ocen: `zadowalajacy → dobry`, `sredni → dostateczny`, `zly → niedostateczny`. Po migracji enum ma 4 wartości: `dobry / dostateczny / niedostateczny / awaryjny`.
- **B.** Pola legacy (`wear_percentage`, `repair_type` NG/NB/K, `urgency_level` I-IV) zachowane w schemacie, ukryte w UI. Stare inspekcje w eksportach mogą je pokazywać dla dokumentacji historycznej.
- **C.** Jeden generator DOCX/PDF z warunkiem `inspection_type`. Mniej duplikacji, łatwiejsze utrzymanie.
- **D.** Zaczynamy od planu (ten dokument), dopiero po akceptacji Waldka — implementacja w fazach.

---

## 2. Stan wyjściowy (audyt 2026-04-25)

### 2.1. Tabele dotknięte zmianą

| Tabela | Liczba rekordów (prod) | Co się zmienia |
|---|---|---|
| `inspections` | nieznana — wiele po jednej na turbinę | Nowe kolumny metryczki PIIB (adres obiektu, nr ewid., nazwa obiektu, daty, właściciel/zarządca/wykonawca, podstawa prawna). Część z nich już jest. |
| `inspection_elements` | 15-16 × inspekcja | Dodanie `usage_suitability` (`spełnia` / `nie spełnia`) dla 5-letnich. Dodanie `recommendation_completion_date`. Pole `wear_percentage` zostaje (legacy). |
| `inspection_element_definitions` | 15-16 wierszy | **Pełny re-seed** — nowy tekst `scope_annual`, `scope_five_year_additional`, `applicable_standards` zgodnie z PIIB. Element nr 16 (Estetyka) — nowy. |
| `repair_recommendations` | wiele | Pola `repair_type`, `urgency_level` zostają (legacy). Nowa filozofia: zalecenia są w **nowej** tabeli `repair_scope_items` (Zakres czynności / Termin wykonania) bez pilności i typu. |
| `electrical_measurements` | per inspekcja 5-letnia | Bez zmian schematu — używamy istniejących pól (impedance, izolacja, RCD, uziemienie). Dodatkowo nowa pod-tabela `electrical_measurement_protocols` na listę protokołów do KOB (sekcja IV.C). |
| `service_info`, `service_checklist` | per inspekcja | Bez zmian schematu — sekcja V w obu wzorach PIIB jest 1:1 z obecną. |
| `inspection_photos` | wiele | Bez zmian schematu — sekcja VI/VII PIIB to numeracja fotografii zsynchronizowana z `nr_fot.` w tabeli ustaleń (już mamy `photo_number`). |

### 2.2. Pliki dotknięte zmianą

```
src/lib/constants.ts                          [edycja — CONDITION_RATINGS 5→4, nowy LEGACY_RATING_MAP]
src/lib/database.types.ts                     [regeneracja po migracji DB]
src/lib/design/protocol-tokens.ts             [edycja — RATING_COLORS sev-1..5 → sev-1..4]
src/components/inspection/rating-badge.tsx    [edycja — 4 oceny + opisy PIIB]
src/components/inspection/element-card.tsx    [edycja — wear% jako legacy view-only, dodanie usage_suitability dla 5-letnich, scope split]
src/components/inspection/repair-table.tsx    [DEPRECATED → ukryte w UI, zachowane dla starych inspekcji]
src/components/inspection/electrical-measurements.tsx  [edycja — dodanie listy protokołów (sekcja IV.C)]
src/components/inspection/service-checklist.tsx        [bez zmian]
src/components/inspection/photo-gallery.tsx            [bez zmian funkcjonalnych — tylko nagłówek "Dokumentacja graficzna"]
src/components/forms/turbine-inspection-form.tsx       [edycja — 4 oceny, usunięcie wear% slidera, dodanie nowych sekcji metryczki PIIB]
src/app/api/docx/[id]/route.ts                [pełny rewrite — układ PIIB]
src/app/api/pdf/[id]/route.ts                 [pełny rewrite — układ PIIB]

NEW: src/components/inspection/previous-recommendations-table.tsx    [sekcja II — ocena realizacji]
NEW: src/components/inspection/emergency-state-table.tsx             [sekcja II — stan awaryjny]
NEW: src/components/inspection/repair-scope-table.tsx                [sekcja IV / VI — Zakres czynności / Termin]
NEW: src/components/inspection/basic-requirements-art5.tsx           [sekcja VI — tylko 5-letni]
NEW: src/components/inspection/attachments-list.tsx                  [sekcja VIII — załączniki]
NEW: src/components/inspection/inspection-metadata-piib.tsx          [metryczka PIIB w widoku/edycji]
```

### 2.3. Pułapki kontekstu (z PROGRESS.md)

- **Phantom `.git/index.lock` w Cowork** — Claude w sesji Cowork nie może zrobić `git commit`. Wszystkie zmiany przygotowuję w plikach, Waldek wykonuje `git add`/`commit`/`push` z Windows-side przez Git Bash.
- **Null bytes w plikach `src/`** — przy edycji uważam, nie używam `tr -d '\0'`. Edytuję tylko fragmentami przez Edit tool (nie pełny Write).
- **Hardkodowane creds Supabase** — URL i anon key w `src/lib/supabase/client.ts`. Migracja DB nie wymaga zmian w kodzie klienta.
- **`is_deleted` filter** — wszystkie nowe zapytania używają `.not('is_deleted', 'is', true)`.
- **Service_role JWT (Legacy)** — przy migracji ręcznej w Supabase Dashboard używam service_role z zakładki Legacy.
- **Single source of truth dla kolorów ocen** — `protocol-tokens.ts` (HEX dla DOCX, RGB dla PDF). Każda zmiana palety ocen = update w obu eksportach.

---

## 3. Migracja bazy danych

Wszystkie zmiany w **jednej transakcji** (`BEGIN ... COMMIT`), z `BACKUP` przed wykonaniem (Supabase Dashboard → Database → Backups → Create manual backup).

### 3.1. SQL migracji (do wykonania ręcznie w Supabase SQL Editor)

```sql
-- =============================================================================
-- MIGRATION: PIIB protocol templates (2026-04-25)
-- Project: lhxhsprqoecepojrxepf
-- Author: Claude + Waldek
-- Reference: Załącznik do uchwały nr PIIB/KR/0051/2024 KR PIIB z 04.12.2024 r.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 3.1.1. ENUM condition_rating: 5 → 4 stopnie z mapowaniem
-- ----------------------------------------------------------------------------
-- Postgres nie pozwala na DROP wartości enuma bez przepisywania kolumn.
-- Strategia: dodajemy nowe wartości obok starych, mapujemy dane, potem 
-- na końcu zostawiamy stare wartości jako "deprecated" (nie używane w UI).

ALTER TYPE condition_rating ADD VALUE IF NOT EXISTS 'dostateczny';
ALTER TYPE condition_rating ADD VALUE IF NOT EXISTS 'niedostateczny';

-- COMMIT wymagany przed UPDATE (Postgres restriction on enum addition)
COMMIT;
BEGIN;

-- Mapowanie istniejących wartości (zgodnie z sekcją 3 raportu zmian)
UPDATE inspection_elements 
SET condition_rating = 'dobry'::condition_rating
WHERE condition_rating = 'zadowalajacy'::condition_rating;

UPDATE inspection_elements 
SET condition_rating = 'dostateczny'::condition_rating
WHERE condition_rating = 'sredni'::condition_rating;

UPDATE inspection_elements 
SET condition_rating = 'niedostateczny'::condition_rating
WHERE condition_rating = 'zly'::condition_rating;

UPDATE inspections 
SET overall_condition_rating = 'dobry'::condition_rating
WHERE overall_condition_rating = 'zadowalajacy'::condition_rating;

UPDATE inspections 
SET overall_condition_rating = 'dostateczny'::condition_rating
WHERE overall_condition_rating = 'sredni'::condition_rating;

UPDATE inspections 
SET overall_condition_rating = 'niedostateczny'::condition_rating
WHERE overall_condition_rating = 'zly'::condition_rating;

-- defect_library też używa typical_rating - mapujemy
UPDATE defect_library 
SET typical_rating = 'dobry'::condition_rating
WHERE typical_rating = 'zadowalajacy'::condition_rating;

UPDATE defect_library 
SET typical_rating = 'dostateczny'::condition_rating
WHERE typical_rating = 'sredni'::condition_rating;

UPDATE defect_library 
SET typical_rating = 'niedostateczny'::condition_rating
WHERE typical_rating = 'zly'::condition_rating;

-- ----------------------------------------------------------------------------
-- 3.1.2. inspection_elements: nowe kolumny PIIB
-- ----------------------------------------------------------------------------

ALTER TABLE inspection_elements 
  ADD COLUMN IF NOT EXISTS usage_suitability TEXT 
    CHECK (usage_suitability IN ('spelnia', 'nie_spelnia') OR usage_suitability IS NULL);

ALTER TABLE inspection_elements 
  ADD COLUMN IF NOT EXISTS recommendation_completion_date DATE;

COMMENT ON COLUMN inspection_elements.usage_suitability IS 
  'Przydatność do użytkowania (PIIB sekcja III, tylko 5-letni): spelnia / nie_spelnia';
COMMENT ON COLUMN inspection_elements.recommendation_completion_date IS 
  'Data wykonania zaleceń z tej kontroli (kolumna NR FOT./DATA WYK. w PIIB)';
COMMENT ON COLUMN inspection_elements.wear_percentage IS 
  'LEGACY (przed migracją PIIB 2026-04-25): % zużycia 0-100. W nowym wzorze nie używane.';

-- ----------------------------------------------------------------------------
-- 3.1.3. inspections: nowe kolumny metryczki PIIB
-- ----------------------------------------------------------------------------

ALTER TABLE inspections 
  ADD COLUMN IF NOT EXISTS object_address TEXT,                  -- "miejscowość, gmina, powiat, województwo, dz. ewid."
  ADD COLUMN IF NOT EXISTS object_registry_number TEXT,          -- nr ewidencyjny obiektu (nadawany przez właściciela/zarządcę)
  ADD COLUMN IF NOT EXISTS object_name TEXT,                     -- np. "elektrownia wiatrowa - turbina wiatrowa"
  ADD COLUMN IF NOT EXISTS object_photo_url TEXT,                -- URL fotografii obiektu w metryczce
  ADD COLUMN IF NOT EXISTS owner_name TEXT,                      -- "imię i nazwisko albo nazwa właściciela"
  ADD COLUMN IF NOT EXISTS manager_name TEXT,                    -- "imię i nazwisko albo nazwa zarządcy"
  ADD COLUMN IF NOT EXISTS contractor_info TEXT,                 -- "imię i nazwisko / nr uprawnień / specjalność"
  ADD COLUMN IF NOT EXISTS additional_participants TEXT,         -- "Przy udziale: ..."
  ADD COLUMN IF NOT EXISTS documents_reviewed JSONB,             -- Dokumenty przedstawione do wglądu (sekcja "Dokumenty do wglądu")
  ADD COLUMN IF NOT EXISTS general_findings_intro TEXT,          -- tekst wprowadzający do sekcji II
  ADD COLUMN IF NOT EXISTS kob_entries_summary TEXT;             -- podsumowanie wpisów w KOB za ostatnie 12 mies. / 5 lat

COMMENT ON COLUMN inspections.documents_reviewed IS
  'Dokumenty do wglądu (PIIB): { "previous_annual": {...}, "previous_5y": {...}, "electrical_measurements": {...}, "service": {...}, "other": "..." }';

-- ----------------------------------------------------------------------------
-- 3.1.4. NOWA TABELA: previous_recommendations 
--        (PIIB sekcja II — Ocena realizacji zaleceń z poprzedniej kontroli)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS previous_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  recommendation_text TEXT,
  completion_status TEXT CHECK (completion_status IN ('tak', 'nie', 'w_trakcie')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prev_recs_inspection ON previous_recommendations(inspection_id);

ALTER TABLE previous_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prev_recs_select" ON previous_recommendations 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM inspections i WHERE i.id = previous_recommendations.inspection_id)
  );
CREATE POLICY "prev_recs_all" ON previous_recommendations 
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'inspector'))
  );

-- ----------------------------------------------------------------------------
-- 3.1.5. NOWA TABELA: emergency_state_items 
--        (PIIB sekcja II — Stan awaryjny stwierdzony w wyniku przeglądu)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS emergency_state_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  element_name TEXT,
  urgent_repair_scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emerg_inspection ON emergency_state_items(inspection_id);

ALTER TABLE emergency_state_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emerg_select" ON emergency_state_items 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM inspections i WHERE i.id = emergency_state_items.inspection_id)
  );
CREATE POLICY "emerg_all" ON emergency_state_items 
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'inspector'))
  );

-- ----------------------------------------------------------------------------
-- 3.1.6. NOWA TABELA: repair_scope_items 
--        (PIIB sekcja IV/VI — Zakres robót remontowych: Zakres czynności / Termin)
--        Zastępuje tabelę NG/NB/K + pilność I-IV. 
--        Stara repair_recommendations zostaje (legacy, ukryta w UI dla nowych inspekcji).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS repair_scope_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  scope_description TEXT NOT NULL,
  deadline_text TEXT,                                  -- "do 30.06.2026" lub "natychmiast" (PIIB jest tekstowe)
  deadline_date DATE,                                  -- opcjonalnie sparsowana data dla sortowania/alertów
  is_completed BOOLEAN DEFAULT FALSE,
  completion_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_scope_inspection ON repair_scope_items(inspection_id);

ALTER TABLE repair_scope_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rep_scope_select" ON repair_scope_items 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM inspections i WHERE i.id = repair_scope_items.inspection_id)
  );
CREATE POLICY "rep_scope_all" ON repair_scope_items 
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'inspector'))
  );

-- ----------------------------------------------------------------------------
-- 3.1.7. NOWA TABELA: basic_requirements_art5 
--        (PIIB sekcja VI — Wymagania podstawowe wg art. 5 PB. TYLKO 5-letni.)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS basic_requirements_art5 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  requirement_code TEXT NOT NULL,    -- 'noniosa_wytrzymalosc', 'bezp_pozar', 'higiena', 'bezp_uzytkowanie', 'ochr_halas', 'oszcz_energia', 'zrownowazone'
  requirement_label TEXT NOT NULL,    -- pełna nazwa wg art. 5 PB
  is_met TEXT CHECK (is_met IN ('spelnia', 'nie_spelnia', 'nie_dotyczy')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (inspection_id, requirement_code)
);

CREATE INDEX IF NOT EXISTS idx_art5_inspection ON basic_requirements_art5(inspection_id);

ALTER TABLE basic_requirements_art5 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "art5_select" ON basic_requirements_art5 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM inspections i WHERE i.id = basic_requirements_art5.inspection_id)
  );
CREATE POLICY "art5_all" ON basic_requirements_art5 
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'inspector'))
  );

-- ----------------------------------------------------------------------------
-- 3.1.8. NOWA TABELA: inspection_attachments 
--        (PIIB sekcja VII/VIII — Załączniki do protokołu)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inspection_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  description TEXT NOT NULL,                     -- "Protokół pomiarów rezystancji uziemienia z dnia ..."
  file_url TEXT,                                 -- opcjonalnie URL do skanu/PDF
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attach_inspection ON inspection_attachments(inspection_id);

ALTER TABLE inspection_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attach_select" ON inspection_attachments 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM inspections i WHERE i.id = inspection_attachments.inspection_id)
  );
CREATE POLICY "attach_all" ON inspection_attachments 
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'inspector'))
  );

-- ----------------------------------------------------------------------------
-- 3.1.9. NOWA TABELA: electrical_measurement_protocols 
--        (PIIB sekcja IV.C — Wykaz protokołów pomiarowych do dołączenia do KOB)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS electrical_measurement_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  protocol_name TEXT NOT NULL,                  -- "Protokół z pomiaru rezystancji uziemienia"
  protocol_number TEXT,
  measurement_date DATE,
  measured_by TEXT,
  attached_to_kob BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_em_protos_inspection ON electrical_measurement_protocols(inspection_id);

ALTER TABLE electrical_measurement_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "em_protos_select" ON electrical_measurement_protocols 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM inspections i WHERE i.id = electrical_measurement_protocols.inspection_id)
  );
CREATE POLICY "em_protos_all" ON electrical_measurement_protocols 
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'inspector'))
  );

-- ----------------------------------------------------------------------------
-- 3.1.10. KOMENTARZE LEGACY (dokumentacja w schemacie)
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN repair_recommendations.repair_type IS 
  'LEGACY (przed migracją PIIB 2026-04-25): NG/NB/K. W nowych protokołach NIE używamy — używamy repair_scope_items.';
COMMENT ON COLUMN repair_recommendations.urgency_level IS 
  'LEGACY (przed migracją PIIB 2026-04-25): I-IV. W nowych protokołach NIE używamy — używamy repair_scope_items.deadline_text.';

COMMIT;

-- =============================================================================
-- KONIEC MIGRACJI 3.1
-- =============================================================================
```

### 3.2. Re-seed `inspection_element_definitions` 

Po migracji 3.1 wykonujemy osobny skrypt `seed_element_definitions_piib.sql` (Faza 1B) z 16 elementami PIIB. Dla każdego: `section_code`, `name_pl`, `name_short`, `applies_to_annual`, `applies_to_five_year`, `scope_annual`, `scope_five_year_additional`, `applicable_standards` (cytaty z protokołów PIIB).

Strategia: `UPDATE` dla istniejących 15 wierszy (po `section_code`), `INSERT` dla nowego 16 (Estetyka — tylko 5-letni). Stare definicje zostaną nadpisane, ale `inspection_elements` referencjuje je przez `element_definition_id`, więc nic się nie psuje.

### 3.3. Regeneracja `database.types.ts`

Po wykonaniu 3.1 + 3.2:

```bash
npx supabase gen types typescript --project-id lhxhsprqoecepojrxepf > src/lib/database.types.ts
```

(lub przez Supabase Dashboard → Settings → API → Generate types).

---

## 4. Plan wdrożenia w fazach

Każda faza = osobna sesja Cowork + osobny commit (lub batch commitów). Numerowanie kontynuuje serię z PROGRESS.md.

### Faza 8 (Sesja 2) — Migracja DB + seed elementów

**Pliki tworzone:**
- `migrations/2026-04-25_piib_protocol.sql` (treść z sekcji 3.1)
- `migrations/2026-04-25_piib_element_definitions.sql` (re-seed 16 elementów)
- `MIGRATION_PLAN_PIIB.md` (ten plik) — już istnieje

**Akcje (Waldek wykonuje ręcznie):**
1. Backup Supabase (Database → Backups → Create manual).
2. Uruchom `2026-04-25_piib_protocol.sql` w SQL Editor.
3. Uruchom `2026-04-25_piib_element_definitions.sql`.
4. Wygeneruj nowe `database.types.ts`.
5. Smoke test: `SELECT condition_rating, COUNT(*) FROM inspection_elements GROUP BY 1` — wartości tylko z `dobry/dostateczny/niedostateczny/awaryjny` (+ `zadowalajacy/sredni/zly` z 0 wystąpień, jeśli zachowane w enumie).

**Kryterium akceptacji:** Aplikacja na Vercelu nadal działa (build przechodzi z legacy danymi w `repair_recommendations.repair_type` etc.). UI nie pokazuje błędów TypeScript.

---

### Faza 9 (Sesja 2 lub 3) — Tokeny + RatingBadge + ElementCard

**Pliki edytowane:**
- `src/lib/constants.ts` — `CONDITION_RATINGS` na 4 stopnie z opisami PIIB. Dodaj `LEGACY_RATING_LABELS` dla starych inspekcji z mapowaniem na wyświetlanie historyczne.
- `src/lib/design/protocol-tokens.ts` — `RATING_COLORS_HEX` / `RATING_COLORS_RGB` z 5→4 wartości. Mapowanie:
  - `dobry` = success-50 / success-800 (jak było `dobry`)
  - `dostateczny` = info-50 / info-800 (kolor info — był sredni amber)
  - `niedostateczny` = warning-100 / warning-800 (kolor warning — był zly orange)
  - `awaryjny` = danger-100 / danger-800 (jak było)
- `src/components/inspection/rating-badge.tsx` — 4 wartości + nowy fallback dla `zadowalajacy/sredni/zly` z odpowiednim mapowaniem.
- `src/components/inspection/element-card.tsx` — przyciski toggle `dobry/dostateczny/niedostateczny/awaryjny`. Slider `wear_percentage` ukryty dla nowych inspekcji (warunek: jeśli `wear_percentage` było zapisane w starej inspekcji, pokazujemy je read-only ze znacznikiem "legacy"). Dla `inspection_type === 'five_year'` dodać dropdown `usage_suitability` (spełnia / nie_spełnia). Tekst zakresu rozdzielony na "Zakres roczny" + "Zakres dodatkowy 5-letni" — z `applicable_standards` w mniejszej czcionce poniżej.

**Kryterium akceptacji:** Lokalny `npm run dev` — otwórz inspekcję, wybierz ocenę "dostateczny" — zapisuje się do DB i renderuje na liście inspekcji z prawidłowym kolorem. PDF + DOCX dalej generują z istniejącym układem (zostanie zaktualizowane w fazie 11).

---

### Faza 10 (Sesja 3) — Nowe komponenty UI dla sekcji II / IV / VI / VIII

**Pliki tworzone:**
- `src/components/inspection/previous-recommendations-table.tsx` — sekcja II PIIB. Tabela z kolumnami: Lp / Zalecenie z poprzedniej / Stopień wykonania (tak/nie/w_trakcie) / Uwagi. CRUD na `previous_recommendations`. Auto-fill z poprzedniej inspekcji turbiny (load `repair_scope_items` LUB `repair_recommendations` w trybie legacy z poprzedniej zakończonej inspekcji).
- `src/components/inspection/emergency-state-table.tsx` — sekcja II PIIB. Tabela z kolumnami: Lp / Element / Zakres pilnego remontu. Często pusta (brak stanu awaryjnego).
- `src/components/inspection/repair-scope-table.tsx` — sekcja IV/VI PIIB. Tabela z kolumnami: Zakres czynności / Termin wykonania (tekst lub data). Zastępuje `RepairTable` w nowych inspekcjach. CRUD na `repair_scope_items`.
- `src/components/inspection/basic-requirements-art5.tsx` — sekcja VI PIIB tylko 5-letni. Lista 7 wymagań z art. 5 PB (1. Nośność i wytrzymałość konstrukcji, 2. Bezpieczeństwo pożarowe, 3. Higiena i zdrowie, 4. Bezpieczne użytkowanie, 5. Ochrona przed hałasem, 6. Oszczędność energii, 7. Zrównoważone wykorzystanie zasobów). Przy każdym: spełnia / nie spełnia / nie dotyczy + uwagi.
- `src/components/inspection/attachments-list.tsx` — sekcja VII/VIII PIIB. Lista załączników (Lp / Opis / opcjonalny URL). CRUD na `inspection_attachments`.
- `src/components/inspection/inspection-metadata-piib.tsx` — kompozyt metryczki PIIB: adres obiektu, nr ewidencyjny, nazwa obiektu, daty bieżącej/kolejnej kontroli, właściciel/zarządca/wykonawca/przy udziale.

**Pliki edytowane:**
- `src/app/(protected)/inspekcje/[id]/page.tsx` — dodanie nowych komponentów w widoku detalu inspekcji.
- `src/components/inspection/electrical-measurements.tsx` — dodanie sub-listy `electrical_measurement_protocols` (sekcja IV.C).

**Kryterium akceptacji:** Inspektor może w widoku inspekcji uzupełnić: poprzednie zalecenia, stan awaryjny, zakres robót remontowych z terminami, wymagania art. 5 PB (5-letni), załączniki. Dane zapisują się do DB. UI jest spójne z resztą aplikacji (tokeny, design system).

---

### Faza 11 (Sesja 3 lub 4) — Generatory DOCX i PDF wg wzoru PIIB

**Pliki edytowane (pełny rewrite):**
- `src/app/api/docx/[id]/route.ts` — nowa struktura wg `Protokol_Kontroli_Rocznej_EW_PIIB.docx` i `Protokol_Kontroli_5-letniej_EW_PIIB.docx`:
  1. Nagłówek PIIB (numer, data, opis zakresu, branża, częstotliwość, podstawa prawna).
  2. Metryczka obiektu (adres, nr ewid., zdjęcie, daty, właściciel/zarządca/wykonawca).
  3. Podstawowe dane obiektu (turbina: producent, moc, H, D, KOB).
  4. (Tylko 5-letni) Skład komisji kontrolującej.
  5. Dokumenty przedstawione do wglądu.
  6. Kryteria oceny (4-stopniowe).
  7. **I.** Zakres kontroli.
  8. **II.** Sprawdzenie wykonania zaleceń (tabela realizacji + tabela stanu awaryjnego).
  9. **III.** Ustalenia — **JEDNA TABELA PIIB** z 5/7 kolumnami (5 dla rocznego, 7 dla 5-letniego z dodatkową "Zakres dodatkowy 5-letni" + "Przydatność").
  10. (Tylko 5-letni) **IV.** Wyniki pomiarów elektrycznych (3 pod-tabele A/B/C).
  11. **V.** Informacje o serwisie technicznym turbiny (firma + checklist).
  12. **IV/VI.** Zalecenia — tabela "Zakres czynności / Termin" + linie wniosków.
  13. (Tylko 5-letni) Wymagania podstawowe art. 5 PB.
  14. **VI/VII.** Dokumentacja graficzna.
  15. **VII/VIII.** Podpisy (1 lub 2 branże) + Załączniki.

  Cała logika warunkowa per `inspection.inspection_type`. Zachowane `protocol-tokens.ts` jako single source of truth.

- `src/app/api/pdf/[id]/route.ts` — analogicznie, w jspdf + autoTable.

**Kryterium akceptacji:** Pobranie PDF/DOCX dla inspekcji rocznej daje dokument identyczny strukturalnie z `Protokol_Kontroli_Rocznej_EW_PIIB.docx` (tylko z danymi z DB). Pobranie dla 5-letniej daje dokument identyczny z `Protokol_Kontroli_5-letniej_EW_PIIB.docx`. Polskie znaki, kolory ocen, tabele wyrównane. PINB powinien zaakceptować bez uwag.

---

### Faza 12 (Sesja 4) — Update formularza inspekcji + portal klienta

**Pliki edytowane:**
- `src/components/forms/turbine-inspection-form.tsx` (2058 linii — edycja inkrementalna):
  - Krok 1 (Dane podstawowe): dodać pola PIIB metryczki.
  - Krok 2 (Elementy): nowe oceny 4-stopniowe, ukrycie wear%.
  - Krok 3 (Podsumowanie): zastąpienie pola "Zalecenia NG/NB/K" → `RepairScopeTable`.
- `src/app/portal/(client)/protokoly/page.tsx` — bez zmian funkcjonalnych, tylko sprawdzić że PDF/DOCX dla starych protokołów (z legacy ratings) nadal działa.

**Kryterium akceptacji:** Inspektor może w terenie (tablet) wprowadzić pełną inspekcję rocznej / 5-letniej zgodnie z PIIB. Klient w portalu może pobrać PDF/DOCX. Stare protokoły (sprzed migracji) dalej da się pobrać bez błędów.

---

### Faza 13 (Sesja 4) — Aktualizacja PROGRESS.md + commity

- Dodać do "Ostatnio zrobione" nową sekcję "Migracja PIIB (2026-04-25)" z opisem decyzji i napotkanych pułapek.
- Zaktualizować "W toku / następne kroki" — dodać ewentualne odłożone tematy (np. wymuszone migrowanie wszystkich inspekcji z legacy ratings na nowe).
- Commity:
  - `feat(db): migracja PIIB - schema + seed elementów`
  - `feat(design): tokeny + RatingBadge + ElementCard pod 4 stopnie PIIB`
  - `feat(inspection): nowe komponenty sekcji PIIB II/IV/VI/VIII`
  - `feat(protocol): rewrite DOCX + PDF wg wzoru PIIB`
  - `feat(form): aktualizacja formularza inspekcji pod PIIB`
  - `docs: PROGRESS.md - migracja PIIB`

---

## 5. Ryzyka i mitygacje

### 5.1. Ryzyko utraty danych przy mapowaniu ocen

**Mitygacja:** Pełen backup bazy przed wykonaniem 3.1.1. SQL z `UPDATE` jest deterministyczny i odwracalny (mapowanie 3-do-1 nie traci informacji bo nie ma kombinacji wymagającej rozjazdu). Jeśli okazałoby się że zadowalajacy ≠ dobry semantycznie, można cofnąć przez restore.

### 5.2. Ryzyko zepsucia portalu klienta

Klient w portalu może mieć już otwarte protokoły z `repair_type` NG/NB/K w UI. Po zmianie UI te zniknią w widoku.

**Mitygacja:** W Fazie 12 potwierdzić że `RepairTable` zostaje **w widoku tylko** (read-only) dla starych inspekcji (te z `repair_recommendations.repair_type IS NOT NULL` w bazie). Nowe inspekcje używają `RepairScopeTable`. W detalu inspekcji warunek: jeśli `repair_recommendations.length > 0 && repair_scope_items.length === 0` → pokaż starą tabelę read-only; jeśli `repair_scope_items.length > 0` → pokaż nową.

### 5.3. Ryzyko regresji w generatorze PDF/DOCX

Stare protokoły (sprzed migracji) mogą się przestać generować jeśli generator wymaga pól PIIB metryczki, których stare inspekcje nie mają.

**Mitygacja:** Wszystkie nowe pola w `inspections` są nullable. Generator używa fallback: jeśli `object_address IS NULL` → zostawia placeholder "miejscowość, gmina, ..." (jak w pustym wzorze). Jeśli `documents_reviewed IS NULL` → renderuje pustą tabelę z placeholderami.

### 5.4. Phantom `.git/index.lock` blokuje commity

**Mitygacja:** Claude przygotuje wszystkie zmiany w plikach + krótki przepis komend gitowych do wykonania w terminalu Windows. Waldek robi `git add ... && git commit -m "..." && git push` z Git Bash.

### 5.5. Null bytes w plikach `src/`

**Mitygacja:** Edytuję wyłącznie przez `Edit` tool (zachowuje encoding). Po każdej fazie krótka weryfikacja: `python3 -c "open('plik').read().encode('utf-8')"` — jeśli przejdzie, plik czysty. Nigdy nie używam `tr -d '\0'`.

### 5.6. Hardkodowane Supabase keys

Bez wpływu — migracja DB nie zmienia URL/anon key. Nowy `database.types.ts` po regeneracji jest kompatybilny (ten sam kontrakt typów + nowe tabele).

---

## 6. Rollback plan

W przypadku krytycznego problemu po wykonaniu fazy 8 (migracja DB):

```sql
-- ROLLBACK 6.1: cofnięcie mapowania ocen (jeśli okaże się że zmapowane wartości są semantycznie błędne)
-- WYMAGA: backupu z chwili przed migracją (Supabase → Backups → Restore from manual backup)
```

W praktyce: **restore z backupu Supabase**. Reszta zmian (nowe tabele, nowe kolumny) nie psuje aplikacji jeśli UI nie ma jeszcze edycji do nich (nullable defaults). Można je trzymać w schemacie nawet po cofnięciu UI.

W przypadku problemu w Fazie 9-12 (UI):

```bash
git revert HEAD                # cofnij ostatni commit
git push                       # deploy się odbuduje na Vercelu
```

---

## 7. Załączniki

- `Raport_zmian_wzory_PIIB.docx` — pełny raport zmian od PIIB (sekcje 1-8).
- `Protokol_Kontroli_Rocznej_EW_PIIB.docx` — wzór protokołu rocznego (referencja struktury dla generatora).
- `Protokol_Kontroli_5-letniej_EW_PIIB.docx` — wzór protokołu 5-letniego (referencja struktury dla generatora).
- Załącznik do uchwały nr PIIB/KR/0051/2024 KR PIIB z dnia 04.12.2024 r. (publiczny, ogólnobudowlany wzór PIIB — nie kopiowany, tylko układ formalny).

---

## 8. Następny krok

**Po Twojej akceptacji tego planu:**

1. Powiedz "Akceptuję plan" lub wskaż konkretne zmiany.
2. Ja przygotuję pliki:
   - `migrations/2026-04-25_piib_protocol.sql`
   - `migrations/2026-04-25_piib_element_definitions.sql`
3. Ty wykonasz je w Supabase SQL Editor (po backupie).
4. Wygenerujesz `database.types.ts` przez Supabase CLI.
5. Przejdziemy do Fazy 9.

**Lub jeśli wolisz inne tempo:** zaczynamy od pojedynczej fazy (np. tylko Fazy 9 + 10 — zmiany UI bez dotykania DB), żeby zobaczyć efekt wizualny zanim ruszymy na produkcję. Wtedy enum `condition_rating` na DB zostaje 5-stopniowy a UI mapuje wyświetlanie do 4-stopniowego. **Ale wtedy generator PDF/DOCX będzie miał semantykę niespójną z DB** — niepolecam.

---

_Koniec MIGRATION_PLAN_PIIB.md_
