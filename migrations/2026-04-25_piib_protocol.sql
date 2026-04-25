-- =============================================================================
-- MIGRATION: PIIB protocol templates (2026-04-25)
-- Project:   lhxhsprqoecepojrxepf  (Supabase Prowatech Inspekcje)
-- Author:    Claude + Waldek
-- Reference: Załącznik do uchwały nr PIIB/KR/0051/2024 KR PIIB z 04.12.2024 r.
--            (Polska Izba Inżynierów Budownictwa - wzór wzór ogólnobudowlany)
--
-- ZAKRES:
--   1. Mapowanie enuma condition_rating: 5 stopni → 4 stopnie
--      zadowalajacy → dobry, sredni → dostateczny, zly → niedostateczny
--      (stare wartości pozostają w enumie - deprecated, nieużywane w nowym UI)
--   2. Nowe kolumny w inspection_elements: usage_suitability, recommendation_completion_date
--   3. Nowe kolumny metryczki PIIB w inspections (object_address, object_registry_number, ...)
--   4. Nowe tabele: previous_recommendations, emergency_state_items, repair_scope_items,
--                   basic_requirements_art5, inspection_attachments, electrical_measurement_protocols
--   5. Komentarze legacy na repair_recommendations.repair_type / urgency_level + wear_percentage
--
-- WYMAGANIA WSTĘPNE:
--   * Backup bazy (Supabase Dashboard → Database → Backups → Create manual backup)
--   * Wykonanie w Supabase SQL Editor jako jeden batch (Run)
--   * Po wykonaniu: regeneracja src/lib/database.types.ts (Supabase CLI lub Dashboard)
--
-- ROLLBACK:
--   * Restore z manual backup (jedyna pewna metoda dla zmiany enuma)
--   * Nowe tabele i kolumny są nullable - można je zostawić w bazie nawet po cofnięciu UI
--
-- NOTATKA:
--   ALTER TYPE ADD VALUE wymaga COMMIT przed kolejnym UPDATE z tą wartością
--   (Postgres restriction). Stąd dwa BEGIN/COMMIT w sekcji 1.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- 1. ENUM condition_rating - dodanie nowych wartości
-- ----------------------------------------------------------------------------

BEGIN;

ALTER TYPE condition_rating ADD VALUE IF NOT EXISTS 'dostateczny';
ALTER TYPE condition_rating ADD VALUE IF NOT EXISTS 'niedostateczny';

COMMIT;


-- ----------------------------------------------------------------------------
-- 2. Mapowanie istniejących wartości enuma condition_rating
--    (zgodnie z sekcją 3 raportu zmian PIIB)
-- ----------------------------------------------------------------------------

BEGIN;

-- inspection_elements
UPDATE inspection_elements
SET condition_rating = 'dobry'::condition_rating
WHERE condition_rating = 'zadowalajacy'::condition_rating;

UPDATE inspection_elements
SET condition_rating = 'dostateczny'::condition_rating
WHERE condition_rating = 'sredni'::condition_rating;

UPDATE inspection_elements
SET condition_rating = 'niedostateczny'::condition_rating
WHERE condition_rating = 'zly'::condition_rating;

-- inspections (overall_condition_rating)
UPDATE inspections
SET overall_condition_rating = 'dobry'::condition_rating
WHERE overall_condition_rating = 'zadowalajacy'::condition_rating;

UPDATE inspections
SET overall_condition_rating = 'dostateczny'::condition_rating
WHERE overall_condition_rating = 'sredni'::condition_rating;

UPDATE inspections
SET overall_condition_rating = 'niedostateczny'::condition_rating
WHERE overall_condition_rating = 'zly'::condition_rating;

-- defect_library (typical_rating)
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
-- 3. inspection_elements - nowe kolumny PIIB
-- ----------------------------------------------------------------------------

ALTER TABLE inspection_elements
  ADD COLUMN IF NOT EXISTS usage_suitability TEXT
    CHECK (usage_suitability IS NULL OR usage_suitability IN ('spelnia', 'nie_spelnia'));

ALTER TABLE inspection_elements
  ADD COLUMN IF NOT EXISTS recommendation_completion_date DATE;

COMMENT ON COLUMN inspection_elements.usage_suitability IS
  'Przydatnosc do uzytkowania (PIIB sekcja III, tylko 5-letni): spelnia / nie_spelnia';
COMMENT ON COLUMN inspection_elements.recommendation_completion_date IS
  'Data wykonania zalecen z tej kontroli (kolumna NR FOT./DATA WYK. w PIIB)';
COMMENT ON COLUMN inspection_elements.wear_percentage IS
  'LEGACY (przed migracja PIIB 2026-04-25): % zuzycia 0-100. W nowym wzorze nie uzywane.';


-- ----------------------------------------------------------------------------
-- 4. inspections - nowe kolumny metryczki PIIB
-- ----------------------------------------------------------------------------

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS object_address TEXT,
  ADD COLUMN IF NOT EXISTS object_registry_number TEXT,
  ADD COLUMN IF NOT EXISTS object_name TEXT,
  ADD COLUMN IF NOT EXISTS object_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS manager_name TEXT,
  ADD COLUMN IF NOT EXISTS contractor_info TEXT,
  ADD COLUMN IF NOT EXISTS additional_participants TEXT,
  ADD COLUMN IF NOT EXISTS documents_reviewed JSONB,
  ADD COLUMN IF NOT EXISTS general_findings_intro TEXT,
  ADD COLUMN IF NOT EXISTS kob_entries_summary TEXT;

COMMENT ON COLUMN inspections.object_address IS
  'Adres obiektu budowlanego (PIIB metryczka): miejscowosc, gmina, powiat, wojewodztwo, dz. ewid.';
COMMENT ON COLUMN inspections.object_registry_number IS
  'Numer ewidencyjny obiektu (PIIB metryczka): nadawany przez wlasciciela / zarzadce';
COMMENT ON COLUMN inspections.object_name IS
  'Nazwa obiektu / funkcja (PIIB metryczka): np. elektrownia wiatrowa - turbina wiatrowa';
COMMENT ON COLUMN inspections.object_photo_url IS
  'URL fotografii ogolnej turbiny w metryczce PIIB';
COMMENT ON COLUMN inspections.owner_name IS
  'Wlasciciel obiektu (PIIB metryczka): imie i nazwisko / nazwa';
COMMENT ON COLUMN inspections.manager_name IS
  'Zarzadca obiektu (PIIB metryczka): imie i nazwisko / nazwa';
COMMENT ON COLUMN inspections.contractor_info IS
  'Wykonawca kontroli (PIIB metryczka): imie / nr uprawnien / specjalnosc';
COMMENT ON COLUMN inspections.additional_participants IS
  'Przy udziale (PIIB metryczka): przedstawiciel wlasciciela lub zarzadcy';
COMMENT ON COLUMN inspections.documents_reviewed IS
  'Dokumenty do wglądu (PIIB): { "previous_annual": "...", "previous_5y": "...", "electrical_measurements": "...", "service": "...", "other": "..." }';
COMMENT ON COLUMN inspections.general_findings_intro IS
  'Tekst wprowadzajacy do sekcji II PIIB (Sprawdzenie wykonania zalecen)';
COMMENT ON COLUMN inspections.kob_entries_summary IS
  'Podsumowanie wpisow w KOB za ostatnie 12 miesiecy (roczna) / 5 lat (5-letnia)';


-- ----------------------------------------------------------------------------
-- 5. NOWA TABELA: previous_recommendations
--    (PIIB sekcja II - Ocena realizacji zalecen z poprzedniej kontroli)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS previous_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  recommendation_text TEXT,
  completion_status TEXT CHECK (completion_status IS NULL OR completion_status IN ('tak', 'nie', 'w_trakcie')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prev_recs_inspection ON previous_recommendations(inspection_id);

ALTER TABLE previous_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prev_recs_select" ON previous_recommendations;
CREATE POLICY "prev_recs_select" ON previous_recommendations
  FOR SELECT
  USING (
    public.get_user_role() IN ('admin', 'inspector')
    OR EXISTS (
      SELECT 1
      FROM inspections i
      JOIN turbines t ON t.id = i.turbine_id
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE i.id = previous_recommendations.inspection_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prev_recs_write" ON previous_recommendations;
CREATE POLICY "prev_recs_write" ON previous_recommendations
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'inspector'))
  WITH CHECK (public.get_user_role() IN ('admin', 'inspector'));

COMMENT ON TABLE previous_recommendations IS
  'PIIB sekcja II: Ocena realizacji zalecen z poprzedniej kontroli (Lp / Zalecenie / Stopien wykonania / Uwagi)';


-- ----------------------------------------------------------------------------
-- 6. NOWA TABELA: emergency_state_items
--    (PIIB sekcja II - Stan awaryjny stwierdzony w wyniku przegladu)
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

DROP POLICY IF EXISTS "emerg_select" ON emergency_state_items;
CREATE POLICY "emerg_select" ON emergency_state_items
  FOR SELECT
  USING (
    public.get_user_role() IN ('admin', 'inspector')
    OR EXISTS (
      SELECT 1
      FROM inspections i
      JOIN turbines t ON t.id = i.turbine_id
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE i.id = emergency_state_items.inspection_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "emerg_write" ON emergency_state_items;
CREATE POLICY "emerg_write" ON emergency_state_items
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'inspector'))
  WITH CHECK (public.get_user_role() IN ('admin', 'inspector'));

COMMENT ON TABLE emergency_state_items IS
  'PIIB sekcja II: Stan awaryjny stwierdzony w wyniku przegladu (Lp / Element / Zakres pilnego remontu)';


-- ----------------------------------------------------------------------------
-- 7. NOWA TABELA: repair_scope_items
--    (PIIB sekcja IV/VI - Zakres robot remontowych: Zakres czynnosci / Termin)
--    Zastepuje stara repair_recommendations w nowych protokolach.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS repair_scope_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  scope_description TEXT NOT NULL,
  deadline_text TEXT,
  deadline_date DATE,
  is_completed BOOLEAN DEFAULT FALSE,
  completion_date DATE,
  completion_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_scope_inspection ON repair_scope_items(inspection_id);
CREATE INDEX IF NOT EXISTS idx_rep_scope_deadline ON repair_scope_items(deadline_date) WHERE is_completed = FALSE;

ALTER TABLE repair_scope_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rep_scope_select" ON repair_scope_items;
CREATE POLICY "rep_scope_select" ON repair_scope_items
  FOR SELECT
  USING (
    public.get_user_role() IN ('admin', 'inspector')
    OR EXISTS (
      SELECT 1
      FROM inspections i
      JOIN turbines t ON t.id = i.turbine_id
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE i.id = repair_scope_items.inspection_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rep_scope_write" ON repair_scope_items;
CREATE POLICY "rep_scope_write" ON repair_scope_items
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'inspector'))
  WITH CHECK (public.get_user_role() IN ('admin', 'inspector'));

COMMENT ON TABLE repair_scope_items IS
  'PIIB sekcja IV/VI: Zakres robot remontowych (Zakres czynnosci / Termin wykonania) - zastepuje stara repair_recommendations';


-- ----------------------------------------------------------------------------
-- 8. NOWA TABELA: basic_requirements_art5
--    (PIIB sekcja VI - Wymagania podstawowe wg art. 5 PB. TYLKO 5-letni.)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS basic_requirements_art5 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  requirement_code TEXT NOT NULL,
  requirement_label TEXT NOT NULL,
  is_met TEXT CHECK (is_met IS NULL OR is_met IN ('spelnia', 'nie_spelnia', 'nie_dotyczy')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (inspection_id, requirement_code)
);

CREATE INDEX IF NOT EXISTS idx_art5_inspection ON basic_requirements_art5(inspection_id);

ALTER TABLE basic_requirements_art5 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "art5_select" ON basic_requirements_art5;
CREATE POLICY "art5_select" ON basic_requirements_art5
  FOR SELECT
  USING (
    public.get_user_role() IN ('admin', 'inspector')
    OR EXISTS (
      SELECT 1
      FROM inspections i
      JOIN turbines t ON t.id = i.turbine_id
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE i.id = basic_requirements_art5.inspection_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "art5_write" ON basic_requirements_art5;
CREATE POLICY "art5_write" ON basic_requirements_art5
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'inspector'))
  WITH CHECK (public.get_user_role() IN ('admin', 'inspector'));

COMMENT ON TABLE basic_requirements_art5 IS
  'PIIB sekcja VI (TYLKO 5-letni): Wymagania podstawowe z art. 5 ustawy Prawo budowlane (7 wymagan)';


-- ----------------------------------------------------------------------------
-- 9. NOWA TABELA: inspection_attachments
--    (PIIB sekcja VII/VIII - Zalaczniki do protokolu)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inspection_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  file_url TEXT,
  google_drive_file_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attach_inspection ON inspection_attachments(inspection_id);

ALTER TABLE inspection_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attach_select" ON inspection_attachments;
CREATE POLICY "attach_select" ON inspection_attachments
  FOR SELECT
  USING (
    public.get_user_role() IN ('admin', 'inspector')
    OR EXISTS (
      SELECT 1
      FROM inspections i
      JOIN turbines t ON t.id = i.turbine_id
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE i.id = inspection_attachments.inspection_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attach_write" ON inspection_attachments;
CREATE POLICY "attach_write" ON inspection_attachments
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'inspector'))
  WITH CHECK (public.get_user_role() IN ('admin', 'inspector'));

COMMENT ON TABLE inspection_attachments IS
  'PIIB sekcja VII/VIII: Zalaczniki do protokolu (Lp / Opis / opcjonalny URL)';


-- ----------------------------------------------------------------------------
-- 10. NOWA TABELA: electrical_measurement_protocols
--     (PIIB sekcja IV.C - Wykaz protokolow pomiarowych do dolaczenia do KOB)
--     TYLKO 5-letni
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS electrical_measurement_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  protocol_name TEXT NOT NULL,
  protocol_number TEXT,
  measurement_date DATE,
  measured_by TEXT,
  attached_to_kob BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_em_protos_inspection ON electrical_measurement_protocols(inspection_id);

ALTER TABLE electrical_measurement_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "em_protos_select" ON electrical_measurement_protocols;
CREATE POLICY "em_protos_select" ON electrical_measurement_protocols
  FOR SELECT
  USING (
    public.get_user_role() IN ('admin', 'inspector')
    OR EXISTS (
      SELECT 1
      FROM inspections i
      JOIN turbines t ON t.id = i.turbine_id
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE i.id = electrical_measurement_protocols.inspection_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "em_protos_write" ON electrical_measurement_protocols;
CREATE POLICY "em_protos_write" ON electrical_measurement_protocols
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'inspector'))
  WITH CHECK (public.get_user_role() IN ('admin', 'inspector'));

COMMENT ON TABLE electrical_measurement_protocols IS
  'PIIB sekcja IV.C (TYLKO 5-letni): Wykaz protokolow pomiarowych do dolaczenia do KOB';


-- ----------------------------------------------------------------------------
-- 11. Komentarze legacy na repair_recommendations
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN repair_recommendations.repair_type IS
  'LEGACY (przed migracja PIIB 2026-04-25): NG/NB/K. W nowych protokolach NIE uzywamy - uzywamy repair_scope_items.';
COMMENT ON COLUMN repair_recommendations.urgency_level IS
  'LEGACY (przed migracja PIIB 2026-04-25): I-IV. W nowych protokolach NIE uzywamy - uzywamy repair_scope_items.deadline_text.';

COMMENT ON TABLE repair_recommendations IS
  'LEGACY (przed migracja PIIB 2026-04-25): tabela zalecen z systemem NG/NB/K + pilnosc I-IV. W nowych protokolach uzywamy repair_scope_items.';


COMMIT;


-- =============================================================================
-- WERYFIKACJA POMIGRACYJNA (uruchom po COMMIT)
-- =============================================================================

-- (a) Sprawdzenie ze wszystkie stare ratings sa zmapowane
SELECT condition_rating, COUNT(*)
FROM inspection_elements
GROUP BY condition_rating
ORDER BY condition_rating;
-- Oczekiwane wartosci: dobry / dostateczny / niedostateczny / awaryjny / NULL
-- NIE powinno juz byc: zadowalajacy / sredni / zly (po mapowaniu = 0)

-- (b) Sprawdzenie nowych tabel
SELECT
  'previous_recommendations'        AS tbl, COUNT(*) FROM previous_recommendations
UNION ALL SELECT 'emergency_state_items',    COUNT(*) FROM emergency_state_items
UNION ALL SELECT 'repair_scope_items',       COUNT(*) FROM repair_scope_items
UNION ALL SELECT 'basic_requirements_art5',  COUNT(*) FROM basic_requirements_art5
UNION ALL SELECT 'inspection_attachments',   COUNT(*) FROM inspection_attachments
UNION ALL SELECT 'electrical_measurement_protocols', COUNT(*) FROM electrical_measurement_protocols;
-- Wszystkie powinny dac 0 (nowe tabele)

-- (c) Sprawdzenie nowych kolumn w inspections
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inspections'
  AND column_name IN ('object_address', 'object_registry_number', 'object_name',
                      'object_photo_url', 'owner_name', 'manager_name',
                      'contractor_info', 'additional_participants',
                      'documents_reviewed', 'general_findings_intro', 'kob_entries_summary')
ORDER BY column_name;
-- Oczekiwane: 11 wierszy

-- (d) Sprawdzenie nowych kolumn w inspection_elements
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inspection_elements'
  AND column_name IN ('usage_suitability', 'recommendation_completion_date');
-- Oczekiwane: 2 wiersze


-- =============================================================================
-- KONIEC migracji 2026-04-25_piib_protocol.sql
-- Po wykonaniu: uruchom 2026-04-25_piib_element_definitions.sql
-- =============================================================================
