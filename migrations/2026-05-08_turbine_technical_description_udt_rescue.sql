-- =============================================================================
-- MIGRATION: Karta turbiny — opis techniczny rozszerzony + UDT + ewakuacja
-- Project:   lhxhsprqoecepojrxepf
-- Data:      2026-05-08
--
-- ZAKRES (Waldek, audyt 5L pkt 6):
--   "W protokolach archiwalnych mamy opis techniczny turbiny, w ktorym
--   znajdziemy jej podstawowe dane (...). Dobrze by bylo aby wyciagnac te
--   dane do naszej karty turbiny i wykorzystac je w karcie inspekcji."
--
--   Rozszerzamy karte turbiny o 3 obszary:
--   1. Opis techniczny (dodatkowe pola na turbines)
--   2. Urzadzenia podlegajace UDT (nowa tabela 1:N)
--   3. Sprzet ewakuacyjno-ratunkowy (nowa tabela 1:N)
-- =============================================================================

BEGIN;

-- 1. ROZSZERZENIE TURBINES — opis techniczny ────────────────────────────────
ALTER TABLE turbines
  ADD COLUMN IF NOT EXISTS tower_segments_count INTEGER,
  ADD COLUMN IF NOT EXISTS nacelle_material TEXT,
  ADD COLUMN IF NOT EXISTS blade_material TEXT,
  ADD COLUMN IF NOT EXISTS foundation_diameter_m NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS foundation_depth_m NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS foundation_concrete_class TEXT,
  ADD COLUMN IF NOT EXISTS pedestal_height_m NUMERIC(4, 2),
  ADD COLUMN IF NOT EXISTS service_crane_capacity_t NUMERIC(5, 3);

COMMENT ON COLUMN turbines.tower_segments_count IS
  'Liczba segmentow stalowej wiezy (np. 5).';
COMMENT ON COLUMN turbines.nacelle_material IS
  'Material gondoli (np. "kompozyt szklano-weglowy z zywica epoksydowa").';
COMMENT ON COLUMN turbines.blade_material IS
  'Material lopat (czesto identyczny z gondola - kompozyt).';
COMMENT ON COLUMN turbines.foundation_diameter_m IS
  'Srednica fundamentu kolowego w metrach (np. 24.00).';
COMMENT ON COLUMN turbines.foundation_depth_m IS
  'Glebokosc posadowienia fundamentu w metrach poniżej terenu (np. 2.25).';
COMMENT ON COLUMN turbines.foundation_concrete_class IS
  'Klasa betonu fundamentu (np. "C30/C37 wg PN-EN 206-1").';
COMMENT ON COLUMN turbines.pedestal_height_m IS
  'Wysokosc cokolu wystajacego nad poziom przyleglego terenu (np. 0.20).';
COMMENT ON COLUMN turbines.service_crane_capacity_t IS
  'Udzwig dzwigu/wciagarki serwisowej (np. 0.25 = 250 kg).';

-- 2. TABELA UDT — urzadzenia podlegajace pod Urzad Dozoru Technicznego ─────
CREATE TABLE IF NOT EXISTS turbine_udt_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turbine_id UUID NOT NULL REFERENCES turbines(id) ON DELETE CASCADE,

  -- Identyfikacja urzadzenia
  device_type TEXT NOT NULL,           -- np. "Podest ruchomy", "Wciagarka serwisowa"
  manufacturer TEXT,                    -- np. "Hailo Wind System", "Koster GmbH"
  model TEXT,                           -- np. "GLOBALLift R4 DE", "WE1"
  capacity_t NUMERIC(5, 3),             -- udzwig w tonach (np. 0.24)

  -- Status UDT
  is_udt_subject BOOLEAN NOT NULL DEFAULT TRUE,  -- czy podlega UDT
  inspection_frequency TEXT,            -- np. "co roku", "co 2 lata"
  certificate_number TEXT,              -- nr decyzji/certyfikatu UDT
  last_inspection_date DATE,
  next_inspection_date DATE,

  -- Tekst opisowy (uwagi, sprawdzenia, etc.)
  notes TEXT,

  -- Meta
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turbine_udt_turbine
  ON turbine_udt_devices (turbine_id);

COMMENT ON TABLE turbine_udt_devices IS
  'Urzadzenia turbiny podlegajace pod UDT (lub kontrolowane przez uprawniony zespol). 1:N do turbines.';

-- 3. TABELA EWAKUACJA-RATUNEK — sprzet ewakuacyjno-ratunkowy ───────────────
CREATE TABLE IF NOT EXISTS turbine_rescue_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turbine_id UUID NOT NULL REFERENCES turbines(id) ON DELETE CASCADE,

  -- Typ sprzetu (enumerated string)
  equipment_type TEXT NOT NULL,         -- np. "PSA", "Drabina z asekuracja", "Punkty zaczepienia"
  manufacturer TEXT,
  model TEXT,                           -- np. "PSA AG 10K"

  -- Cykl kontrolny
  inspection_frequency TEXT,            -- np. "raz w roku"
  last_inspection_date DATE,
  next_inspection_date DATE,

  -- Tekst opisowy (parametry, uwagi)
  description TEXT,
  notes TEXT,

  -- Meta
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turbine_rescue_turbine
  ON turbine_rescue_equipment (turbine_id);

COMMENT ON TABLE turbine_rescue_equipment IS
  'Sprzet ewakuacyjno-ratunkowy turbiny (PSA, drabiny z asekuracja, punkty zaczepienia, itp.). 1:N do turbines.';

-- 4. RLS — admin/inspektor full, klient read tylko swoich turbin ────────────
ALTER TABLE turbine_udt_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE turbine_rescue_equipment ENABLE ROW LEVEL SECURITY;

-- Admin/inspector pelen dostep
CREATE POLICY udt_admin_inspector ON turbine_udt_devices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'inspector')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'inspector')
    )
  );

CREATE POLICY rescue_admin_inspector ON turbine_rescue_equipment
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'inspector')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'inspector')
    )
  );

-- Klient SELECT tylko swoich turbin
CREATE POLICY udt_client_select ON turbine_udt_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM turbines t
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE t.id = turbine_udt_devices.turbine_id
        AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY rescue_client_select ON turbine_rescue_equipment
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM turbines t
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE t.id = turbine_rescue_equipment.turbine_id
        AND cu.user_id = auth.uid()
    )
  );

COMMIT;
