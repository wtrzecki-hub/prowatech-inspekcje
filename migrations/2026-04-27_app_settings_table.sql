-- Faza Ustawienia (2026-04-27): tabela app_settings (key/value) dla edytowalnego
-- konfigu aplikacji. Pierwszy use-case: dane firmy ProWaTech (nazwa, NIP, adres,
-- email, telefon, www, logo URL) ciagniete do naglowka protokolow PDF/DOCX.
-- Dotychczas hardkodowane w `src/app/api/pdf/[id]/route.ts` i analogicznie DOCX.
--
-- ROZWAZANE ALTERNATYWY:
-- a) Pojedyncza tabela `company_settings` z kolumnami per pole — sztywniejsza,
--    kazda nowa wartosc to migracja. ODRZUCONE.
-- b) JSONB w `profiles` (per user) — to setttingi globalne, nie per user. ODRZUCONE.
-- c) `app_settings(key text PK, value jsonb)` — wybrane: elastyczne, latwe do
--    rozszerzania (kolejne klucze: branding, defaults inspekcji, etc.).
--
-- BEZPIECZENSTWO:
-- - RLS: SELECT dla wszystkich zalogowanych (admin/inspector/client_user/viewer)
--   bo dane firmy sa wlasciwie publiczne (siedzi w stopce protokolu klienta).
-- - INSERT/UPDATE/DELETE tylko dla admin.
--
-- ROLLBACK:
-- DROP TABLE IF EXISTS public.app_settings CASCADE;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Auto-update updated_at na UPDATE
CREATE OR REPLACE FUNCTION public.app_settings_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_app_settings_updated_at ON public.app_settings;

CREATE TRIGGER tr_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.app_settings_set_updated_at();

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS app_settings_admin_write ON public.app_settings;
CREATE POLICY app_settings_admin_write ON public.app_settings
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Seed: dane firmy ProWaTech (na podstawie obecnego naglowka protokolu)
INSERT INTO public.app_settings (key, value, description) VALUES
  ('company.name',    '"ProWaTech Sp. z o.o."'::jsonb, 'Pelna nazwa firmy widoczna w naglowku protokolu'),
  ('company.short',   '"ProWaTech"'::jsonb,            'Krotka nazwa do nawigacji / sidebar'),
  ('company.nip',     '""'::jsonb,                     'NIP firmy'),
  ('company.regon',   '""'::jsonb,                     'REGON'),
  ('company.address', '""'::jsonb,                     'Adres siedziby (jeden wiersz)'),
  ('company.email',   '""'::jsonb,                     'Email kontaktowy'),
  ('company.phone',   '""'::jsonb,                     'Telefon kontaktowy'),
  ('company.website', '"https://prowatech.pl"'::jsonb, 'Strona WWW'),
  ('company.logo_url','"/logo-prowatech.png"'::jsonb,  'URL logo (publicznie dostepne, uzywane w protokolach PDF/DOCX)')
ON CONFLICT (key) DO NOTHING;

-- WERYFIKACJA (po Run wybierz wszystkie 7 zapytan, kazde powinno zwrocic spodziewany rezultat):
-- 1) Tabela istnieje:
SELECT 'tabela utworzona' AS status, count(*) AS rows FROM public.app_settings;

-- 2) Trigger updated_at:
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.app_settings'::regclass;

-- 3) Polityki RLS:
SELECT polname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_settings';

-- 4) Seed:
SELECT key, value, description FROM public.app_settings ORDER BY key;

-- 5) Test jako admin (powinno przejsc):
-- UPDATE public.app_settings SET value = '"Test"'::jsonb WHERE key = 'company.name';

-- 6) Test get_user_role:
SELECT public.get_user_role() AS my_role;

-- 7) Liczba seedow:
SELECT count(*) AS seeded_keys FROM public.app_settings WHERE key LIKE 'company.%';
