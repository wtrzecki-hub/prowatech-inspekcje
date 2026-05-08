-- =============================================================================
-- MIGRATION: pola "Zakres kontroli pkt 6/7" + "Metody i srodki" (2026-05-08)
-- Project:   lhxhsprqoecepojrxepf
--
-- ZAKRES:
--   Dodaje 3 nowe pola TEXT do `inspections`, odpowiadajace na punkty
--   deklarowane w sekcji "Zakres kontroli" oraz w "Ustaleniach koncowych"
--   wzorca PIIB:
--
--   1. environmental_protection_findings  - pkt 6 zakresu kontroli:
--      "Sprawdzenie stanu technicznego instalacji i urzadzen sluzacych
--      ochronie srodowiska (instalacja odgromowa, oswietlenie nawigacyjne)."
--
--   2. documentation_verification_findings - pkt 7 zakresu kontroli:
--      "Weryfikacja kompletnosci i aktualnosci dokumentow (KOB, protokoly
--      serwisowe, protokoly pomiarow, certyfikaty UDT)."
--
--   3. weather_exposure_methods - punkt 8.6 wzorca w "Ustaleniach koncowych":
--      "Metody i srodki uzytkowania elementow narazonych na szkodliwe
--      dzialanie wplywow atmosferycznych i niszczace dzialanie innych
--      czynnikow." Dla turbin wiatrowych zawsze "nie dotyczy" (turbiny sa
--      konstrukcyjnie odporne, brak elementow drewnianych itp.) - ale punkt
--      musi sie znalezc w protokole zgodnie z art. 62 PB.
--
-- KONTEKST (Waldek, audyt 2026-05-08, pkt 5):
--   "Zakres kontroli na drugiej stronie deklaruje 7 punktow, ale w protokole
--   brakuje odniesienia do pkt 6 i 7. Brakuje tez w ustaleniach koncowych
--   pkt 8.6. Wzorzec wymaga zeby protokol odzwierciedlal zakres kontroli."
--
-- DEFAULTY:
--   Pola maja wartosci startowe (sugestie tekstu dla turbin wiatrowych) -
--   inspektor moze edytowac. NULL = oznacza ze inspektor nie wpisal nic
--   (UI pokaze placeholder z domyslna formula). Po pierwszym zapisie wartosc
--   trafia do DB i zostaje. Zachowuje istniejace inspekcje (NULL).
-- =============================================================================

BEGIN;

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS environmental_protection_findings TEXT,
  ADD COLUMN IF NOT EXISTS documentation_verification_findings TEXT,
  ADD COLUMN IF NOT EXISTS weather_exposure_methods TEXT;

COMMENT ON COLUMN inspections.environmental_protection_findings IS
  'Pkt 6 zakresu kontroli: stan techniczny instalacji i urzadzen sluzacych ochronie srodowiska. Tekst wolny - ustalenia inspektora.';
COMMENT ON COLUMN inspections.documentation_verification_findings IS
  'Pkt 7 zakresu kontroli: weryfikacja kompletnosci i aktualnosci dokumentow (KOB, protokoly serwisowe, protokoly pomiarow, certyfikaty UDT). Tekst wolny.';
COMMENT ON COLUMN inspections.weather_exposure_methods IS
  'Pkt 8.6 wzorca PIIB w ustaleniach koncowych: metody i srodki uzytkowania elementow narazonych na szkodliwe wplywy atmosferyczne. Dla turbin zawsze "nie dotyczy", ale punkt musi byc w protokole.';

COMMIT;

-- WERYFIKACJA:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'inspections'
--   AND column_name IN (
--     'environmental_protection_findings',
--     'documentation_verification_findings',
--     'weather_exposure_methods'
--   );

-- ROLLBACK:
-- ALTER TABLE inspections
--   DROP COLUMN environmental_protection_findings,
--   DROP COLUMN documentation_verification_findings,
--   DROP COLUMN weather_exposure_methods;
