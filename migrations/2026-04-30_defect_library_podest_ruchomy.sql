-- Migracja: dorzucenie wpisu dla aktualnego badania UDT podestu ruchomego
-- Data: 2026-04-30
-- Zgloszenie: Waldek (kontynuacja UWAGI program.doc, pkt 6 Tomasza Wisniewskiego)
--
-- KONTEKST:
-- Po rundzie REC-245..249 dorzucamy osobny wpis dla podestu ruchomego.
-- Podest ruchomy (np. nozycowy, koszowy, dzwig serwisowy z koszem) podlega
-- badaniom okresowym UDT zgodnie z rozporzadzeniem Min. Gospodarki z 2003 r.
-- W obrebie WTG to czesto stale wyposazenie wewnatrz wiezy.
--
-- Analogicznie do REC-248 (urzadzenia dzwigowe UDT) urgency = I (niezwlocznie),
-- bo prowadzenie prac na podescie z wygaslym badaniem UDT to natychmiastowy
-- problem bezpieczenstwa.

BEGIN;

INSERT INTO defect_library (code, category, name_pl, recommendation_template, typical_urgency, is_active)
VALUES
  ('REC-250', 'Inne',
   'Przeprowadzić aktualne badania okresowe UDT podestu ruchomego (NB)',
   'NB', 'I', true);

DO $$
DECLARE
  inserted_count INT;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM defect_library WHERE code = 'REC-250' AND is_active = true;
  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'Migracja nie powiodla sie: oczekiwano 1 wiersza, faktycznie %', inserted_count;
  END IF;
END $$;

COMMIT;

-- ROLLBACK:
-- DELETE FROM defect_library WHERE code = 'REC-250';
