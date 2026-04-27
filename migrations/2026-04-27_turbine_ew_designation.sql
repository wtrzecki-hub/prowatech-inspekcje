-- =============================================================================
-- Migracja: dodaj kolumnę `ew_designation` do tabeli `turbines`
-- Data: 2026-04-27
-- Krok 6 z roadmapy uwag Artura
-- =============================================================================
--
-- Cel: standardowe oznaczenie turbiny w obrębie farmy (Elektrownia Wiatrowa
-- nr X), używane w polskich protokołach PIIB w identyfikacji obiektu.
-- Format: free-text (np. "EW 1", "EW 12", "EW 24A"), żeby nie narzucać
-- format-u, bo niektóre farmy używają literek/podziałów.
--
-- Wartość przejdzie do nagłówka protokołu PDF/DOCX w sekcji METRYCZKA OBIEKTU
-- jako linia "Oznaczenie EW: ..." nad adresem obiektu.
--
-- Non-destructive: kolumna NULL, bez NOT NULL constraintu — istniejące
-- 233 turbiny pozostają bez wartości, admin uzupełnia stopniowo.
-- =============================================================================

-- 1. ALTER TABLE
ALTER TABLE turbines
  ADD COLUMN IF NOT EXISTS ew_designation TEXT NULL;

-- 2. Komentarz dla dokumentacji
COMMENT ON COLUMN turbines.ew_designation IS
  'Oznaczenie turbiny w obrębie farmy wiatrowej (np. "EW 1", "EW 12"). Free text — używane w nagłówku protokołów PIIB jako identyfikator obiektu.';

-- 3. Weryfikacja
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'turbines'
      AND column_name = 'ew_designation'
  ) THEN
    RAISE EXCEPTION 'Migracja nieudana: kolumna ew_designation nie istnieje';
  END IF;
  RAISE NOTICE 'OK: kolumna turbines.ew_designation utworzona/istnieje.';
END $$;

-- 4. Sprawdź ile turbin ma EW (na początku 0)
SELECT
  COUNT(*) AS total_turbines,
  COUNT(ew_designation) AS turbines_with_ew,
  COUNT(*) - COUNT(ew_designation) AS turbines_without_ew
FROM turbines;

-- =============================================================================
-- ROLLBACK (jeśli potrzeba):
--   ALTER TABLE turbines DROP COLUMN IF EXISTS ew_designation;
-- =============================================================================
