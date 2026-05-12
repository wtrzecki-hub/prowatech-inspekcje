-- Dodaje kolumny work_kind + urgency_level do previous_recommendations.
--
-- Kontekst (audyt 2026-05-12, inspekcja EW Kamlarki fd11f6bf-8265-49f5-a69c-0ca1fceb1321):
-- Auto-import w `previous-recommendations-table.tsx` SELECT-uje z hpr `repair_type` + `urgency`,
-- ale przy mappingu do `previous_recommendations.insert(...)` wyrzuca te pola (linie 541-543).
-- W konsekwencji `ensureCarryToScope` przy "Nie wykonano" wpisuje do `repair_scope_items`
-- tylko `scope_description` + `source_previous_type` — work_kind/urgency_level lecą NULL,
-- mimo że hpr je ma.
--
-- Naprawa: zachować te wartości w prev_recs (z opcją edycji per wiersz w UI) i przekazać
-- do scope przy carry-over.

ALTER TABLE previous_recommendations
  ADD COLUMN work_kind TEXT CHECK (work_kind IN ('K', 'NB', 'NG')),
  ADD COLUMN urgency_level TEXT CHECK (urgency_level IN ('I', 'II', 'III', 'IV'));

COMMENT ON COLUMN previous_recommendations.work_kind IS 'Rodzaj robót (K/NB/NG) — przenoszony z hpr przy auto-import, edytowalny w UI, przepisywany do repair_scope_items.work_kind przy auto-carry "Nie wykonano".';
COMMENT ON COLUMN previous_recommendations.urgency_level IS 'Stopień pilności (I-IV) — przenoszony z hpr przy auto-import, edytowalny w UI, przepisywany do repair_scope_items.urgency_level przy auto-carry "Nie wykonano".';

-- Backfill dla EW Kamlarki (5 annual + 5 five_year, wszystkie K + III z hpr 59/T/2025 + 76/T/2025)
-- + 1 wpis five_year #6 (pomiary elektryczne, urgency=I z hpr).
UPDATE previous_recommendations
SET work_kind = 'K', urgency_level = 'III'
WHERE inspection_id = 'fd11f6bf-8265-49f5-a69c-0ca1fceb1321'
  AND item_number BETWEEN 1 AND 5;

UPDATE previous_recommendations
SET urgency_level = 'I'
WHERE inspection_id = 'fd11f6bf-8265-49f5-a69c-0ca1fceb1321'
  AND source_inspection_type = 'five_year'
  AND item_number = 6;
