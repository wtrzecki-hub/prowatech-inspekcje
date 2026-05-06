-- Slownik sprzetu pomiarowego (Artur uwagi pkt 6).
-- Wzor: tabela inspectors + junction inspection_inspectors.
-- Stosowana 2026-05-06 przez Supabase MCP apply_migration.
create table public.measurement_devices (
  id uuid primary key default uuid_generate_v4(),
  model text not null,
  serial_number text not null,
  manufacturer text,
  calibration_certificate_number text,
  calibration_date date,
  calibration_expiry_date date,
  notes text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (model, serial_number)
);

create index measurement_devices_active_idx
  on public.measurement_devices (is_active, is_deleted)
  where is_deleted = false;

alter table public.measurement_devices enable row level security;

create policy measurement_devices_select on public.measurement_devices
  for select using (true);

create policy measurement_devices_insert on public.measurement_devices
  for insert with check ((select get_user_role()) = any (array['admin'::user_role, 'inspector'::user_role]));

create policy measurement_devices_update on public.measurement_devices
  for update using ((select get_user_role()) = any (array['admin'::user_role, 'inspector'::user_role]));

-- Junction inspection <-> device
create table public.inspection_measurement_devices (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  device_id uuid not null references public.measurement_devices(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (inspection_id, device_id)
);

create index inspection_measurement_devices_inspection_idx
  on public.inspection_measurement_devices (inspection_id);

alter table public.inspection_measurement_devices enable row level security;

create policy imd_select on public.inspection_measurement_devices
  for select using (true);

create policy imd_insert on public.inspection_measurement_devices
  for insert with check ((select get_user_role()) = any (array['admin'::user_role, 'inspector'::user_role]));

create policy imd_delete on public.inspection_measurement_devices
  for delete using ((select get_user_role()) = any (array['admin'::user_role, 'inspector'::user_role]));

-- Seed sprzetu z uwag Artura
insert into public.measurement_devices (model, serial_number, manufacturer)
values
  ('SONEL MRU-200', 'E31147', 'SONEL S.A.'),
  ('SONEL MPI-507', 'LF2345', 'SONEL S.A.')
on conflict (model, serial_number) do nothing;
