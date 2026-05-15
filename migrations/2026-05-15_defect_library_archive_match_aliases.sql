-- Kolumna `archive_match_aliases` trzyma alternatywne wersje zalecenia
-- (z archiwalnych protokołów) które semantycznie odpowiadają temu samemu
-- defektowi, ale słownie różnią się od głównego `recommendation_template`.
--
-- Renderer tabeli III (kolumna Opis i ustalenia → sekcja „Zaobserwowane
-- defekty z poprzedniej kontroli") używa zarówno `recommendation_template`
-- jak i wszystkich `archive_match_aliases` jako źródeł tokenów do fuzzy
-- matchu z `previous_recommendations.recommendation_text`.

BEGIN;

ALTER TABLE defect_library
  ADD COLUMN IF NOT EXISTS archive_match_aliases TEXT[];

COMMENT ON COLUMN defect_library.archive_match_aliases IS
  'Alternatywne wersje zalecenia z archiwalnych protokołów (akronyimy, parafrazy, błędy ortograficzne) — używane do fuzzy matchu w rendererze sekcji „Zaobserwowane defekty z poprzedniej kontroli". NULL/[] = używamy tylko głównego `recommendation_template`.';

-- Mapowania wprowadzone przez Waldka 2026-05-15 (sesja podglądu EW Kamlarki):
--   S14 ← „Wykonać konserwację izolacji pionowej stacji kontenerowej w pasie przyziemia"
--   S17 ← „Oczyścić z zabrudzeń i zanieczyszczeń wnętrze stacji kontenerowej"
--   S26 ← „Dokonać naprawy drobnych uszkodzeń tynku zewnętrznego stacji kontenerowej oraz usunąć skażenia biologiczne"
--   P-80 ← „Przyciąć roślinność wokół fundamentu turbiny i stacji kontenerowej"
UPDATE defect_library
SET archive_match_aliases = ARRAY['Wykonać konserwację izolacji pionowej stacji kontenerowej w pasie przyziemia']
WHERE code = 'S14';

UPDATE defect_library
SET archive_match_aliases = ARRAY['Oczyścić z zabrudzeń i zanieczyszczeń wnętrze stacji kontenerowej']
WHERE code = 'S17';

UPDATE defect_library
SET archive_match_aliases = ARRAY['Dokonać naprawy drobnych uszkodzeń tynku zewnętrznego stacji kontenerowej oraz usunąć skażenia biologiczne']
WHERE code = 'S26';

UPDATE defect_library
SET archive_match_aliases = ARRAY['Przyciąć roślinność wokół fundamentu turbiny i stacji kontenerowej']
WHERE code = 'P-80';

-- P-80 miał element_number=NULL — uzupełniam zgodnie z decyzją Waldka (element #16 Estetyka).
UPDATE defect_library
SET element_number = 16
WHERE code = 'P-80' AND element_number IS NULL;

COMMIT;
