-- Junction: inspekcja <-> osoba wykonujaca pomiary elektryczne (Artur uwagi pkt 6 cd).
-- Osobna tabela od inspection_inspectors zeby nie mieszac semantyki:
-- inspection_inspectors trzyma inspektorow podpisujacych protokol PIIB
-- (z branza i is_lead), a tutaj sa pomiarowcy z PDF Sonela.
-- Stosowana 2026-05-06 przez Supabase MCP apply_migration.
create table public.inspection_measurement_performers (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  inspector_id uuid not null references public.inspectors(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (inspection_id, inspector_id)
);

create index inspection_measurement_performers_inspection_idx
  on public.inspection_measurement_performers (inspection_id);

alter table public.inspection_measurement_performers enable row level security;

create policy imp_select on public.inspection_measurement_performers
  for select using (true);

create policy imp_insert on public.inspection_measurement_performers
  for insert with check ((select get_user_role()) = any (array['admin'::user_role, 'inspector'::user_role]));

create policy imp_delete on public.inspection_measurement_performers
  for delete using ((select get_user_role()) = any (array['admin'::user_role, 'inspector'::user_role]));
