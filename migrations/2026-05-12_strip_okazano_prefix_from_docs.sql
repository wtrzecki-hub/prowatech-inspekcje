-- Migracja: strip prefiksu "Okazano, " z documents_reviewed.{key}.info
-- Data: 2026-05-12
-- Uwaga Artura 2026-05-12 (T5): w UI metryczki widać dwa razy słowo "Okazano":
--   - lewa kolumna: Select ze statusem (Okazano / Nie okazano)
--   - prawa kolumna: Input "Numer protokołu / data / uwagi" z wartością
--     typu "Okazano, nr 59/T/2025, z dnia 05.05.2025"
--
-- Źródło duplikacji: `loadDocumentsAutoFill` w inspection-metadata-piib.tsx
-- budował `info` jako pełny string z prefiksem "Okazano, ", a Select status
-- był osobny. Po fixie auto-fill ustawia `status='okazano'` + `info` bez
-- prefiksu — tu naprawiamy historyczne wpisy w bazie.
--
-- Zakres: 6 inspekcji w bazie (zob. SELECT COUNT(...) sprzed migracji).
-- Dotyczy 4 kluczy: previous_annual, previous_5y, electrical_measurements, service.

BEGIN;

DO $$
DECLARE
  k TEXT;
BEGIN
  FOREACH k IN ARRAY ARRAY['previous_annual', 'previous_5y', 'electrical_measurements', 'service']
  LOOP
    UPDATE inspections
    SET documents_reviewed = jsonb_set(
      documents_reviewed,
      ARRAY[k],
      jsonb_build_object(
        'status', 'okazano',
        'info', NULLIF(
                  regexp_replace(
                    documents_reviewed->k->>'info',
                    '^Okazano,\s*',
                    ''
                  ),
                  ''
                )
      )
    )
    WHERE documents_reviewed IS NOT NULL
      AND documents_reviewed->k->>'info' ~ '^Okazano,';
  END LOOP;
END $$;

-- Sanity check: po migracji żadne info nie powinno zaczynać się od "Okazano,".
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM inspections
  WHERE documents_reviewed::text LIKE '%"Okazano, %';

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Po migracji zostało % inspekcji z prefiksem "Okazano, " w info', remaining;
  END IF;
END $$;

COMMIT;
