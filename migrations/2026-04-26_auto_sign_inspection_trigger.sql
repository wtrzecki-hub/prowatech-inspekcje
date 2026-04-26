-- Faza 16+ (2026-04-26): auto-promocja statusu inspekcji completed -> signed
-- gdy obie daty podpisu (inspector + owner) zostaja wypelnione.
--
-- KONTEKST:
-- Portal klienta (`/portal/(client)/protokoly/page.tsx`) filtruje liste
-- protokolow po `.eq("status", "signed")`. W prod 0 z 23 inspekcji mialo
-- ten status, mimo ze 3 byly w `completed` — bo nikt nie klikal w UI
-- przycisku "Przejdz do: Podpisana" (StatusBar) i nie ma tez integracji
-- pomiedzy datami podpisu a statusem.
--
-- ROZWIAZANIE:
-- Trigger BEFORE UPDATE: gdy inspekcja jest w `completed` i obie daty
-- (`inspector_signature_date` + `owner_signature_date`) sa NOT NULL,
-- automatycznie ustawiamy `status='signed'`. Inspektor wpisuje obie daty
-- w UI inspekcji, status zmienia sie sam, klient widzi protokol w portalu.
--
-- BEZPIECZENSTWO:
-- - Trigger awansuje tylko z `completed` -> `signed` (nigdy nie cofa)
-- - Trigger fire'uje sie tylko gdy zmieniaja sie kolumny daty/status
--   (klauzula `OF inspector_signature_date, owner_signature_date, status`)
-- - StatusBar w UI inspektora dalej dziala jako manual fallback

CREATE OR REPLACE FUNCTION public.auto_sign_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND NEW.inspector_signature_date IS NOT NULL
     AND NEW.owner_signature_date IS NOT NULL
  THEN
    NEW.status := 'signed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_inspections_auto_sign ON public.inspections;

CREATE TRIGGER tr_inspections_auto_sign
BEFORE UPDATE OF inspector_signature_date, owner_signature_date, status
ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.auto_sign_inspection();

COMMENT ON FUNCTION public.auto_sign_inspection() IS
  'Faza 16+: gdy inspekcja w statusie completed dostaje obie daty podpisu (inspector + owner), auto-promuje status na signed. Portal klienta filtruje po status=signed.';
