-- Generyczna tabela na zdjęcia przypięte do pozycji zaleceń.
-- Wzorzec parent_type+parent_id, żeby przy auto-carry "Nie wykonano" w
-- previous_recommendations można było skopiować WSKAŹNIK do tego samego pliku
-- pod nowy parent (repair_scope_item) — bez duplikacji binarki w R2.
--
-- inspection_id jest redundantny ale konieczny dla RLS i czystego index path
-- w R2 (key buduje się jako inspections/{inspection_id}/recommendation-photos/...).

CREATE TABLE recommendation_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type TEXT NOT NULL CHECK (parent_type IN ('previous_recommendation', 'repair_scope_item')),
  parent_id UUID NOT NULL,
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rec_photos_parent ON recommendation_photos (parent_type, parent_id);
CREATE INDEX idx_rec_photos_inspection ON recommendation_photos (inspection_id);

ALTER TABLE recommendation_photos ENABLE ROW LEVEL SECURITY;

-- Admin/inspektor: pełen dostęp
CREATE POLICY "admin_inspector_all_recommendation_photos"
  ON recommendation_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'inspector')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'inspector')
    )
  );

-- Client: SELECT tylko swoich inspekcji (przez wind_farms → client_users)
CREATE POLICY "client_select_own_recommendation_photos"
  ON recommendation_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM inspections i
      JOIN turbines t ON t.id = i.turbine_id
      JOIN wind_farms wf ON wf.id = t.wind_farm_id
      JOIN client_users cu ON cu.client_id = wf.client_id
      WHERE i.id = recommendation_photos.inspection_id
        AND cu.user_id = auth.uid()
    )
  );

COMMENT ON TABLE recommendation_photos IS 'Zdjęcia przypięte do pozycji zaleceń — albo do previous_recommendations (inspektor dokumentuje że "Nie wykonano"), albo do repair_scope_items (skopiowane przez auto-carry). parent_type rozróżnia źródło.';
COMMENT ON COLUMN recommendation_photos.parent_id IS 'ID rekordu w tabeli wskazywanej przez parent_type. NIE jest FK żeby uniknąć cascade delete przez 2 tabele — czyszczenie sierot przez okresowy job lub trigger.';
