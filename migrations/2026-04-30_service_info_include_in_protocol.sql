-- Migracja: dorzucenie flagi czy serwis ma byc uwzgledniony w protokole
-- Data: 2026-04-30
-- Zgloszenie: inspektor Tomasz Wisniewski + decyzja Waldka (UWAGI program.doc, pkt 5)
--
-- KONTEKST:
-- Tomasz pytal "Na jakiej podstawie wypelniamy zakladke serwis?" - sygnal ze
-- nie zawsze ma dane serwisowe. Decyzja Waldka: checkbox decydujacy czy
-- sekcja serwisu trafia do protokolu PDF/DOCX. Domyslnie true (backward
-- compatible - istniejace inspekcje pokazuja serwis jak dotad).
--
-- WPLYW:
--  - service_info: 1 nowa kolumna BOOLEAN NOT NULL DEFAULT true
--  - Istniejace wpisy: dostana true (uwzgledniaja w protokole)
--  - Generatory PDF/DOCX odczytaja te kolumne i pomina sekcje gdy false

BEGIN;

ALTER TABLE service_info
  ADD COLUMN IF NOT EXISTS include_in_protocol BOOLEAN NOT NULL DEFAULT true;

COMMIT;

-- WERYFIKACJA:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'service_info' AND column_name = 'include_in_protocol';

-- ROLLBACK:
-- ALTER TABLE service_info DROP COLUMN include_in_protocol;
