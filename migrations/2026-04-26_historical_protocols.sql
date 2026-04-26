-- ============================================================
-- Migracja: tabela historical_protocols (Faza 15.E)
-- Data: 2026-04-26
-- Cel: archiwum protokołów PIIB sprzed wdrożenia aplikacji.
--      Każdy wpis = 1 PDF + meta. Plik wisi na Cloudflare R2,
--      DB trzyma metadane + klucz/URL R2.
--
-- Założenia:
--   - 1 turbina × 1 rok × 1 typ kontroli = max 1 protokół
--     (więc rocznej i 5-letniej w tym samym roku to 2 osobne wiersze)
--   - admin/inspektor: pełen CRUD
--   - client_user: SELECT tylko swoich (przez turbine → wind_farm.client_id)
--   - kasowanie wiersza nie usuwa pliku z R2 — to zrobi UI/API osobno
--     (ON DELETE SET NULL na uploaded_by zachowuje wpis nawet gdy user
--     został zdezaktywowany w auth.users)
--
-- Wykonanie:
--   1. Backup DB (Supabase Dashboard → Database → Backups → Manual)
--   2. Wklej całość do Supabase SQL Editor → Run
--   3. Sprawdź WERYFIKACJA na końcu
--   4. Po OK regenerator types.ts (lub edycja manualna w database.types.ts)
-- ============================================================


-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.historical_protocols (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  turbine_id            uuid          NOT NULL REFERENCES public.turbines(id) ON DELETE CASCADE,
  year                  integer       NOT NULL CHECK (year BETWEEN 2010 AND 2050),
  inspection_type       text          NOT NULL CHECK (inspection_type IN ('annual', 'five_year')),

  -- Plik na R2
  protocol_pdf_r2_key   text          NOT NULL UNIQUE,    -- "historical/{turbine_id}/{year}_{type}_{ts}_{rand}.pdf"
  protocol_pdf_url      text          NOT NULL,           -- pełen public URL (cache, żeby nie składać przy każdym SELECT)
  file_size_bytes       bigint,                           -- rozmiar pliku (do statystyk i UI)
  source_filename       text,                             -- oryginalna nazwa pliku z dysku/Drive

  -- Opcjonalne meta (admin może uzupełnić ręcznie z metryczki w PDF)
  protocol_number       text,                             -- np. "92/T/2025"
  inspection_date       date,                             -- jeśli widoczna w protokole

  -- Audyt
  notes                 text,                             -- "Uwagi" admin (np. "skan rozmazany, str. 3")
  uploaded_by           uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  -- Każda turbina × rok × typ = max 1 protokół
  UNIQUE(turbine_id, year, inspection_type)
);

COMMENT ON TABLE public.historical_protocols IS
  'Archiwum protokołów PIIB sprzed wdrożenia aplikacji. Plik PDF wisi na Cloudflare R2, ten wiersz trzyma metadane + klucz R2.';
COMMENT ON COLUMN public.historical_protocols.protocol_pdf_r2_key IS
  'Klucz w buckecie R2 prowatech-inspekcje. Używany do delete''a i regeneracji URL.';
COMMENT ON COLUMN public.historical_protocols.protocol_pdf_url IS
  'Cache public URL R2. Klient pobiera bezpośrednio przez ten URL (bucket ma Public Development URL enabled).';
COMMENT ON COLUMN public.historical_protocols.source_filename IS
  'Oryginalna nazwa pliku przy uploadzie — do troubleshootingu i sprawdzania source.';
COMMENT ON COLUMN public.historical_protocols.notes IS
  'Wolny tekst admina. Auto-uzupełniany przy uploadzie z parseowaną częścią nazwy pliku (oznaczenie turbiny / farma).';


-- 2. Indeks pod typowy query: lista per turbina sorted by year DESC
CREATE INDEX IF NOT EXISTS idx_historical_protocols_turbine_year
  ON public.historical_protocols(turbine_id, year DESC, inspection_type);


-- 3. Trigger automatycznie aktualizujący updated_at
CREATE OR REPLACE FUNCTION public.touch_historical_protocols_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historical_protocols_updated_at ON public.historical_protocols;
CREATE TRIGGER trg_historical_protocols_updated_at
  BEFORE UPDATE ON public.historical_protocols
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_historical_protocols_updated_at();


-- 4. Row Level Security
ALTER TABLE public.historical_protocols ENABLE ROW LEVEL SECURITY;


-- 4a. admin/inspector — pełen CRUD
DROP POLICY IF EXISTS "hp_staff_all" ON public.historical_protocols;
CREATE POLICY "hp_staff_all"
  ON public.historical_protocols
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'inspector')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'inspector')
    )
  );

-- 4c. viewer — SELECT only (read-only rola)
DROP POLICY IF EXISTS "hp_viewer_read" ON public.historical_protocols;
CREATE POLICY "hp_viewer_read"
  ON public.historical_protocols
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'viewer'
    )
  );


-- 4b. client_user — SELECT tylko swoich (przez turbine → wind_farm.client_id → client_users)
DROP POLICY IF EXISTS "hp_client_read" ON public.historical_protocols;
CREATE POLICY "hp_client_read"
  ON public.historical_protocols
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.turbines t
      JOIN public.wind_farms wf ON wf.id = t.wind_farm_id
      JOIN public.client_users cu ON cu.client_id = wf.client_id
      WHERE t.id = historical_protocols.turbine_id
        AND cu.user_id = auth.uid()
    )
  );


-- ============================================================
-- WERYFIKACJA — uruchom poniżej i sprawdź wyniki
-- ============================================================

-- Powinien zwrócić 1 wiersz z nazwą tabeli + 11 kolumn
SELECT
  table_name,
  count(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'historical_protocols'
GROUP BY table_name;
-- Oczekiwane: historical_protocols | 13

-- Powinien pokazać 13 kolumn
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'historical_protocols'
ORDER BY ordinal_position;

-- Powinien pokazać 1 unique constraint na (turbine_id, year, inspection_type) + PK + UNIQUE na r2_key
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'historical_protocols'
ORDER BY con.contype DESC;

-- Powinien pokazać 1 indeks (turbine_id, year DESC, inspection_type) + PK + 2× UNIQUE
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'historical_protocols'
ORDER BY indexname;

-- Powinien pokazać 3 polityki: hp_staff_all (ALL) + hp_client_read (SELECT) + hp_viewer_read (SELECT)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'historical_protocols'
ORDER BY policyname;

-- Powinien pokazać RLS = true
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'historical_protocols' AND relnamespace = 'public'::regnamespace;

-- Trigger updated_at
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'historical_protocols';

-- Smoke test: czy w tabeli można wstawić wiersz?
-- (pomijamy, bo wymaga zalogowanego admin/inspektora — pierwszy upload przez UI w Fazie 15.F)


-- ============================================================
-- ROLLBACK (gdyby coś poszło nie tak — uruchom w osobnym query)
-- ============================================================
-- DROP POLICY IF EXISTS "hp_viewer_read" ON public.historical_protocols;
-- DROP POLICY IF EXISTS "hp_client_read" ON public.historical_protocols;
-- DROP POLICY IF EXISTS "hp_staff_all" ON public.historical_protocols;
-- DROP TRIGGER IF EXISTS trg_historical_protocols_updated_at ON public.historical_protocols;
-- DROP FUNCTION IF EXISTS public.touch_historical_protocols_updated_at();
-- DROP TABLE IF EXISTS public.historical_protocols;
