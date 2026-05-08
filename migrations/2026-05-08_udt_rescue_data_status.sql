-- =============================================================================
-- MIGRATION: data_status w turbine_udt_devices + turbine_rescue_equipment (2026-05-08)
-- Project:   lhxhsprqoecepojrxepf
--
-- ZAKRES (Waldek 2026-05-08, follow-up po POC pre-fill z archiwum):
--   Status weryfikacji per-wiersz dla wpisów UDT i Sprzętu ewakuacyjno-
--   ratunkowego. Workflow:
--     1. Pre-fill z archiwalnego protokołu → ustawiamy 'do_weryfikacji'
--     2. Inspektor podczas kontroli na turbinie → 'aktualne' lub 'nieaktualne'
--     3. UI w karcie turbiny pokazuje badge przy każdym wpisie
--     4. Renderery PDF/DOCX pomijają wpisy 'nieaktualne' (sprzęt wymieniony /
--        urządzenie wycofane).
--
--   Dla danych technicznych turbiny (segmenty/fundament/dźwig) NIE dodajemy —
--   to są stałe parametry konstrukcyjne, nie wymagają weryfikacji per-kontrolę.
--
-- DEFAULT:
--   'aktualne' — dla wpisów dodawanych ręcznie przez inspektora (wpisuje co
--   właśnie widzi/sprawdził, więc dane są aktualne z definicji).
--   Pre-fill z archiwum nadpisze na 'do_weryfikacji' explicite.
--
-- WARTOŚCI:
--   - 'do_weryfikacji' (yellow badge) — dane z archiwum, nie zweryfikowane
--   - 'aktualne'       (green badge)  — potwierdzone aktualne
--   - 'nieaktualne'    (red badge)    — sprzęt wymieniony, w PDF pominięte
-- =============================================================================

BEGIN;

ALTER TABLE turbine_udt_devices
  ADD COLUMN IF NOT EXISTS data_status TEXT NOT NULL DEFAULT 'aktualne'
    CHECK (data_status IN ('do_weryfikacji', 'aktualne', 'nieaktualne'));

ALTER TABLE turbine_rescue_equipment
  ADD COLUMN IF NOT EXISTS data_status TEXT NOT NULL DEFAULT 'aktualne'
    CHECK (data_status IN ('do_weryfikacji', 'aktualne', 'nieaktualne'));

COMMENT ON COLUMN turbine_udt_devices.data_status IS
  'Status weryfikacji wpisu UDT przez inspektora. Pre-fill z archiwum ustawia ''do_weryfikacji''. Inspektor podczas kontroli zmienia na ''aktualne'' (potwierdzenie) lub ''nieaktualne'' (sprzęt wymieniony — pominięty w PDF/DOCX).';
COMMENT ON COLUMN turbine_rescue_equipment.data_status IS
  'Status weryfikacji wpisu sprzętu ewakuacyjno-ratunkowego. Pre-fill z archiwum ustawia ''do_weryfikacji''. Inspektor zmienia na ''aktualne'' lub ''nieaktualne''.';

COMMIT;

-- WERYFIKACJA:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name IN ('turbine_udt_devices', 'turbine_rescue_equipment')
--   AND column_name = 'data_status';

-- ROLLBACK:
-- ALTER TABLE turbine_udt_devices DROP COLUMN data_status;
-- ALTER TABLE turbine_rescue_equipment DROP COLUMN data_status;
