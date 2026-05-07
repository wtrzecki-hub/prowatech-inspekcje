-- =============================================================================
-- MIGRATION: client_representatives + inspection_participants (2026-05-07)
-- Project:   lhxhsprqoecepojrxepf  (Supabase Prowatech Inspekcje)
--
-- ZAKRES:
--   1. NOWA TABELA: client_representatives
--      Przedstawiciele wlasciciela / zarzadcy obiektu, przypisani per klient.
--      Te same osoby pojawiaja sie przy kazdej nowej inspekcji turbin
--      tego samego klienta (zamiast wpisywac recznie za kazdym razem).
--
--   2. NOWA TABELA: inspection_participants
--      Junction inspekcja <-> przedstawiciel. Pozwala odznaczyc osoby
--      ktore nie uczestnicza w danej kontroli (nie zawsze sa obecni).
--
-- RELACJA Z LEGACY:
--   inspections.additional_participants (TEXT) zostaje jako fallback
--   dla istniejacych protokolow. Renderery PDF/DOCX uzyja inspection_participants
--   gdy istnieja, w przeciwnym razie spadna do additional_participants.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. client_representatives
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_representatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_reps_client
  ON public.client_representatives(client_id)
  WHERE is_deleted = FALSE;

ALTER TABLE public.client_representatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_reps_select" ON public.client_representatives;
CREATE POLICY "client_reps_select" ON public.client_representatives
  FOR SELECT
  USING (
    public.get_user_role() IN ('admin', 'inspector')
    OR EXISTS (
      SELECT 1
      FROM public.client_users cu
      WHERE cu.client_id = client_representatives.client_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_reps_write" ON public.client_representatives;
CREATE POLICY "client_reps_write" ON public.client_representatives
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'inspector'))
  WITH CHECK (public.get_user_role() IN ('admin', 'inspector'));

COMMENT ON TABLE public.client_representatives IS
  'Przedstawiciele wlasciciela / zarzadcy per klient (PIIB ''Przy udziale''). Reuzywani przy nowych inspekcjach turbin tego samego klienta.';
COMMENT ON COLUMN public.client_representatives.role IS
  'Funkcja / rola, np. ''Przedstawiciel wlasciciela'', ''Zarzadca'', ''Inspektor BHP'' (free-text).';


-- ----------------------------------------------------------------------------
-- 2. inspection_participants (junction)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inspection_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  representative_id UUID NOT NULL REFERENCES public.client_representatives(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inspection_id, representative_id)
);

CREATE INDEX IF NOT EXISTS idx_insp_participants_inspection
  ON public.inspection_participants(inspection_id);

ALTER TABLE public.inspection_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insp_participants_select" ON public.inspection_participants;
CREATE POLICY "insp_participants_select" ON public.inspection_participants
  FOR SELECT
  USING (
    public.get_user_role() IN ('admin', 'inspector')
    OR EXISTS (
      SELECT 1
      FROM public.inspections i
      JOIN public.turbines t ON t.id = i.turbine_id
      JOIN public.wind_farms wf ON wf.id = t.wind_farm_id
      JOIN public.client_users cu ON cu.client_id = wf.client_id
      WHERE i.id = inspection_participants.inspection_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insp_participants_insert" ON public.inspection_participants;
CREATE POLICY "insp_participants_insert" ON public.inspection_participants
  FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'inspector'));

DROP POLICY IF EXISTS "insp_participants_delete" ON public.inspection_participants;
CREATE POLICY "insp_participants_delete" ON public.inspection_participants
  FOR DELETE
  USING (public.get_user_role() IN ('admin', 'inspector'));

COMMENT ON TABLE public.inspection_participants IS
  'Junction: ktorzy przedstawiciele klienta uczestniczyli w danej inspekcji (PIIB ''Przy udziale''). Mozna odznaczyc bo nie zawsze sa obecni.';
