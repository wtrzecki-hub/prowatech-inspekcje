-- Element / lokalizacja w previous_recommendations — uzupełnia parę work_kind/urgency_level
-- z migracji 2026-05-12_previous_recs_work_kind_urgency.sql.
--
-- Uwagi Artura 2026-05-12: "Zalecenia przepisane z poprzedniej kontroli (niewykonane
-- względem poprzedniej) — niewypełnione pole Element". hpr nie ma element_name,
-- więc inspektor wpisuje raz w prev_rec a carry propaguje do repair_scope_items.

ALTER TABLE previous_recommendations
  ADD COLUMN element_name TEXT;

COMMENT ON COLUMN previous_recommendations.element_name IS 'Element / lokalizacja zalecenia (np. "Fundament", "Wieża segment 2"). Wpisywany ręcznie przez inspektora w prev_rec; przy auto-carry "Nie wykonano" propaguje do repair_scope_items.element_name.';

-- Backfill EW Kamlarki: pozycja 1 (fundament) w obu sekcjach.
-- Resztę inspektor wpisze ręcznie — hpr nie ma element_name, nie ma jak wnioskować.
UPDATE previous_recommendations
SET element_name = 'Fundament'
WHERE inspection_id = 'fd11f6bf-8265-49f5-a69c-0ca1fceb1321'
  AND item_number = 1;
