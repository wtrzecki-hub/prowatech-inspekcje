-- =============================================================================
-- MIGRATION: service_info.include_in_protocol DEFAULT false (2026-05-08)
-- Project:   lhxhsprqoecepojrxepf
--
-- ZAKRES:
--   Zmiana domyslnej wartosci `service_info.include_in_protocol` z TRUE na FALSE.
--
-- KONTEKST (Waldek, audyt 2026-05-08, pkt 3):
--   "Mamy w tej zakladce check do odhaczenia, nie wiem dlaczego przy kazdej
--   nowej edycji inspekcji z automatu jest on zaznaczony. Mozemy zrobic tak,
--   zeby byl odznaczony, a dopiero po zaznaczeniu i wypisaniu danych bedzie
--   ta sekcja uwzgledniana w protokole."
--
--   Sekcja V "Informacje o serwisie technicznym" w PDF/DOCX byla generowana
--   z pustymi polami (—) bo include_in_protocol mial DEFAULT true. Po tej
--   migracji nowe wpisy beda mialy FALSE - sekcja sie nie pokaze dopoki
--   uzytkownik swiadomie nie zaznaczy "Uwzglednij sekcje 'Serwis' w protokole"
--   i nie wpisze co najmniej jednego pola serwisowego.
--
--   Generatory PDF/DOCX dodatkowo sprawdzaja `hasServiceData` - sekcja jest
--   pomijana nawet przy include_in_protocol=true, jesli wszystkie pola sa puste.
--
-- BACKWARD COMPAT:
--   Istniejace wiersze (z TRUE) nie sa modyfikowane - tylko default sie zmienia.
--   Inspektorzy musza recznie odznaczyc checkbox dla starych inspekcji jesli
--   chca pominac pusta sekcje. Alternatywnie mozna by uruchomic UPDATE dla
--   wierszy gdzie wszystkie pola sa NULL/puste, ale to ryzykowne (mogli
--   celowo zaznaczyc checkbox z pustymi polami).
-- =============================================================================

BEGIN;

ALTER TABLE service_info
  ALTER COLUMN include_in_protocol SET DEFAULT false;

COMMIT;

-- WERYFIKACJA:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'service_info' AND column_name = 'include_in_protocol';
-- => column_default powinien byc 'false'

-- ROLLBACK:
-- ALTER TABLE service_info ALTER COLUMN include_in_protocol SET DEFAULT true;
