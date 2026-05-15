-- Wariant uproszczony rocznika: usuwamy wzmianki o analizie zapisów SCADA.
--
-- Powód (Waldek, 2026-05-15): w wariancie uproszczonym inspektor pozostaje
-- na poziomie terenu / parteru wieży i NIE ma dostępu do SCADA — czynności
-- analityczne wykonuje serwis producenta. Wzmianki o SCADA w „Zakresie
-- rocznym (oględziny)" są wprowadzające w błąd (sugerują czynność, której
-- inspektor w wariancie U nie wykonuje).
--
-- Zmiany dotyczą TYLKO `scope_annual_simplified`. Wariant rozszerzony
-- (`scope_annual`) zostaje bez zmian — w nim inspektor wjeżdża i SCADA jest
-- realnym źródłem danych.
--
-- Dotknięte elementy:
--   • 4 Gondola (nacela) — 2 linie do usunięcia z „Zakresu rocznego"
--   • 6 Wirnik / rotor z łopatami — 1 linia z „Pozycji do oceny"
--                                   + 1 linia z „Zakresu rocznego"

BEGIN;

-- Element #4 Gondola — usunięcie 2 linii ze SCADA z „Zakresu rocznego"
UPDATE inspection_element_definitions
SET scope_annual_simplified = $$Pozycje do oceny:
• Stan obudowy GRP / kompozyt – pęknięcia, nieszczelności
• Stan ramy nośnej (bedplate) – korozja, mocowania
• Wyposażenie BHP wewnątrz gondoli
• Klimatyzacja / wentylacja / oświetlenie

Połączenie z wieżą (łożysko wieńcowe azymutu):
• Stan łożyska wieńcowego (yaw bearing) i smarowania
• Stan napędów azymutu (yaw drives)
• Połączenia śrubowe flansza wieża–łożysko (oznaczenia, korozja)

Połączenie z wirnikiem (piasta, łożysko główne, system pitch):
• Połączenia śrubowe piasta–wał główny
• Stan łożyska głównego wału (temperatura, drgania, dźwięk, wycieki)
• Smarowanie i uszczelnienia
• Stan połączenia piasta–łopaty

Zakres roczny (oględziny):
• Ocena wizualna gondoli z poziomu terenu (lornetka; w miarę możliwości obrót gondoli o 360° dla pełnego oglądu)
• Brak widocznych wycieków, zacieków na zewnętrznej obudowie gondoli / pod gondolą
• Nasłuch podczas obrotu gondoli (yaw test) — brak nietypowych dźwięków, drgań przekazywanych na konstrukcję$$
WHERE element_number = 4
  AND is_active = TRUE
  AND scope_annual_simplified LIKE '%SCADA%';

-- Element #6 Wirnik — usunięcie linii ze SCADA z „Pozycji do oceny" + „Zakresu rocznego"
UPDATE inspection_element_definitions
SET scope_annual_simplified = $$Pozycje do oceny:
• Powierzchnia łopat – pęknięcia, delaminacja, erozja krawędzi natarcia
• Receptory odgromowe na łopatach (ciągłość, mocowanie)
• System pitch – łożyska łopat, kable

Zakres roczny (oględziny):
• Ocena wizualna wirnika i łopat z poziomu terenu (lornetka)
• Wizualna ocena receptorów odgromowych z dołu w dostępnym zakresie$$
WHERE element_number = 6
  AND is_active = TRUE
  AND scope_annual_simplified LIKE '%SCADA%';

-- Sanity check (NOTICE jeśli któryś update nie złapał):
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*)
    INTO cnt
    FROM inspection_element_definitions
    WHERE is_active = TRUE
      AND scope_annual_simplified ILIKE '%SCADA%';
  IF cnt > 0 THEN
    RAISE NOTICE 'UWAGA: pozostało % aktywnych definicji z SCADA w scope_annual_simplified — sprawdź ręcznie.', cnt;
  END IF;
END
$$;

COMMIT;
