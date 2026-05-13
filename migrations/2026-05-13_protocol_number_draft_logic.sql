-- Numeracja protokołów: szkice (draft/in_progress) nie dostają numeru.
-- Decyzja Waldka 2026-05-13: „numeracja docelowa szła po kolei, robocze jako szkic".
--
-- Stan przed: trigger BEFORE INSERT zawsze nadawał kolejny numer (001..N),
-- niezależnie od statusu. Testowe drafty zjadały numery sekwencji — Artur
-- raportował że inspekcja Solbet dostała 020/R/2026 zamiast 001/R/2026,
-- bo wcześniej w bazie było 16 testowych draftów Niewolno.
--
-- Stan po:
-- 1) INSERT z status='draft' lub 'in_progress' → protocol_number = NULL (Szkic).
--    Inspektor widzi „Szkic" zamiast numeru w UI/protokole.
-- 2) Pierwsze przejście status z 'draft'/'in_progress' na cokolwiek innego
--    (review/completed/signed) → trigger AFTER UPDATE nadaje kolejny
--    protocol_number, licząc MAX(active) gdzie status NOT IN ('draft','in_progress').
-- 3) Manualne nadanie numeru przez inspektora wciąż jest możliwe — gdy
--    NEW.protocol_number jest podany w INSERT/UPDATE, trigger nie zmienia.

CREATE OR REPLACE FUNCTION public.generate_protocol_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  prefix TEXT;
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  -- Manualne nadanie ma priorytet (nie nadpisujemy świadomego wpisu)
  IF NEW.protocol_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Szkice (draft / in_progress) nie dostają numeru — pojawi się przy
  -- przejściu na pierwszy "docelowy" status (review/completed/signed).
  IF NEW.status IN ('draft', 'in_progress') THEN
    RETURN NEW;
  END IF;

  prefix := CASE NEW.inspection_type
    WHEN 'annual' THEN 'R'
    WHEN 'five_year' THEN 'P'
  END;

  year_str := EXTRACT(YEAR FROM COALESCE(NEW.inspection_date, CURRENT_DATE))::TEXT;

  -- MAX z aktywnych (NIE szkice) tego typu i roku. Drafty pomijane —
  -- nie zjadają sekwencji.
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(protocol_number, '^(\d+)/.*$', '\1'), protocol_number)::INTEGER
  ), 0) + 1
  INTO seq_num
  FROM inspections
  WHERE inspection_type = NEW.inspection_type
    AND EXTRACT(YEAR FROM COALESCE(inspection_date, created_at)) = EXTRACT(YEAR FROM COALESCE(NEW.inspection_date, CURRENT_DATE))
    AND protocol_number IS NOT NULL
    AND status NOT IN ('draft', 'in_progress');

  NEW.protocol_number := LPAD(seq_num::TEXT, 3, '0') || '/' || prefix || '/' || year_str;
  RETURN NEW;
END;
$function$;

-- Trigger BEFORE UPDATE statusu: przejście z 'draft'/'in_progress' na coś
-- innego = czas nadać numer (jeśli inspektor wcześniej nie wpisał ręcznie).
CREATE OR REPLACE FUNCTION public.generate_protocol_number_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  prefix TEXT;
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  -- Tylko gdy status zmienia się Z draft/in_progress NA coś innego
  IF OLD.status NOT IN ('draft', 'in_progress') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('draft', 'in_progress') THEN
    RETURN NEW;
  END IF;
  IF NEW.protocol_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  prefix := CASE NEW.inspection_type
    WHEN 'annual' THEN 'R'
    WHEN 'five_year' THEN 'P'
  END;

  year_str := EXTRACT(YEAR FROM COALESCE(NEW.inspection_date, CURRENT_DATE))::TEXT;

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(protocol_number, '^(\d+)/.*$', '\1'), protocol_number)::INTEGER
  ), 0) + 1
  INTO seq_num
  FROM inspections
  WHERE inspection_type = NEW.inspection_type
    AND EXTRACT(YEAR FROM COALESCE(inspection_date, created_at)) = EXTRACT(YEAR FROM COALESCE(NEW.inspection_date, CURRENT_DATE))
    AND protocol_number IS NOT NULL
    AND status NOT IN ('draft', 'in_progress')
    AND id != NEW.id;  -- pomijaj siebie (race)

  NEW.protocol_number := LPAD(seq_num::TEXT, 3, '0') || '/' || prefix || '/' || year_str;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_protocol_number_on_status_change ON inspections;
CREATE TRIGGER tr_protocol_number_on_status_change
  BEFORE UPDATE OF status ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION generate_protocol_number_on_status_change();
