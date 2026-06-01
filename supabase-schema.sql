-- TicketPro Escolar - esquema Supabase
-- Ejecuta este archivo en Supabase SQL Editor antes de conectar la SPA.

create table if not exists public.profiles (
  id text primary key,
  full_name text not null,
  email text not null unique,
  demo_password text not null,
  role text not null check (role in ('admin', 'user')) default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id text primary key,
  title text not null,
  description text not null,
  category text not null,
  priority text not null check (priority in ('Baja', 'Media', 'Alta')),
  status text not null check (status in ('Abierto', 'En progreso', 'Resuelto', 'Cerrado')),
  requester_id text references public.profiles(id) on delete set null,
  assignee text default 'Sin asignar',
  images jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.hardware_inventory (
  id text primary key,
  name text not null,
  type text not null,
  serial text not null,
  location text not null,
  assigned_to text,
  status text not null check (status in ('Activo', 'En reparación', 'Prestado', 'Baja')),
  purchase_date date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.hardware_inventory enable row level security;

drop policy if exists "demo read profiles" on public.profiles;
drop policy if exists "demo write profiles" on public.profiles;
drop policy if exists "demo read tickets" on public.tickets;
drop policy if exists "demo write tickets" on public.tickets;
drop policy if exists "demo read hardware" on public.hardware_inventory;
drop policy if exists "demo write hardware" on public.hardware_inventory;

-- Políticas abiertas para prototipo escolar con anon key.
-- Para producción, reemplaza estas reglas por Supabase Auth + JWT claims por rol.
create policy "demo read profiles" on public.profiles for select using (true);
create policy "demo write profiles" on public.profiles for all using (true) with check (true);
create policy "demo read tickets" on public.tickets for select using (true);
create policy "demo write tickets" on public.tickets for all using (true) with check (true);
create policy "demo read hardware" on public.hardware_inventory for select using (true);
create policy "demo write hardware" on public.hardware_inventory for all using (true) with check (true);

insert into public.profiles (id, full_name, email, demo_password, role)
values ('u-admin', 'Administrador Demo', 'admin@escuela.local', 'admin123', 'admin')
on conflict (id) do nothing;

create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_priority on public.tickets(priority);
create index if not exists idx_tickets_requester on public.tickets(requester_id);
create index if not exists idx_hardware_status on public.hardware_inventory(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tickets_updated_at on public.tickets;
create trigger set_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

create or replace view public.ticket_report_metrics as
select
  count(*) as total_tickets,
  count(*) filter (where resolved_at is not null) as resolved_tickets,
  avg(extract(epoch from (coalesce(resolved_at, updated_at) - created_at))) as avg_resolution_seconds,
  count(*) filter (where status in ('Abierto', 'En progreso')) as open_backlog
from public.tickets;
