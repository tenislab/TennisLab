-- ============================================================
-- TennisLab — MODO CLUB (tablas)
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- DESPUÉS de tener ya creada la tabla user_state (schema.sql).
-- ------------------------------------------------------------
-- Modelo:
--   clubs           → un club por entrenador (dueño = owner)
--   club_members    → quién pertenece a cada club (entrenador + jugadores)
--   club_tactics    → tácticas compartidas que ve todo el club
-- ============================================================

-- 1) CLUBES -------------------------------------------------------
create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  invite_code text not null unique,         -- código para que los jugadores se unan
  created_at  timestamptz not null default now()
);

-- 2) MIEMBROS -----------------------------------------------------
create table if not exists public.club_members (
  club_id   uuid not null references public.clubs(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  email     text,
  role      text not null default 'player', -- 'coach' | 'player'
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- 3) TÁCTICAS COMPARTIDAS ----------------------------------------
create table if not exists public.club_tactics (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,               -- la táctica completa (igual que en la app)
  name       text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- SEGURIDAD (RLS)
-- ============================================================
alter table public.clubs         enable row level security;
alter table public.club_members  enable row level security;
alter table public.club_tactics  enable row level security;

-- función auxiliar: ¿soy miembro de este club?
create or replace function public.is_club_member(c uuid)
returns boolean language sql security definer stable as $$
  select exists(select 1 from public.club_members m
                where m.club_id = c and m.user_id = auth.uid());
$$;

-- función auxiliar: ¿soy el entrenador (dueño) de este club?
create or replace function public.is_club_owner(c uuid)
returns boolean language sql security definer stable as $$
  select exists(select 1 from public.clubs cl
                where cl.id = c and cl.owner_id = auth.uid());
$$;

-- CLUBS: ver si eres miembro; crear si eres tú el dueño; editar/borrar solo el dueño
drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs for select
  using (owner_id = auth.uid() or public.is_club_member(id));
drop policy if exists clubs_insert on public.clubs;
create policy clubs_insert on public.clubs for insert
  with check (owner_id = auth.uid());
drop policy if exists clubs_modify on public.clubs;
create policy clubs_modify on public.clubs for update using (owner_id = auth.uid());
drop policy if exists clubs_delete on public.clubs;
create policy clubs_delete on public.clubs for delete using (owner_id = auth.uid());

-- MEMBERS: ves los miembros de tus clubes; te puedes añadir a ti mismo (unirte)
drop policy if exists members_select on public.club_members;
create policy members_select on public.club_members for select
  using (user_id = auth.uid() or public.is_club_owner(club_id));
drop policy if exists members_insert on public.club_members;
create policy members_insert on public.club_members for insert
  with check (user_id = auth.uid() or public.is_club_owner(club_id));
drop policy if exists members_delete on public.club_members;
create policy members_delete on public.club_members for delete
  using (user_id = auth.uid() or public.is_club_owner(club_id));

-- CLUB_TACTICS: las ve cualquier miembro; las crea/edita/borra el autor (entrenador)
drop policy if exists ctactics_select on public.club_tactics;
create policy ctactics_select on public.club_tactics for select
  using (public.is_club_member(club_id));
drop policy if exists ctactics_insert on public.club_tactics;
create policy ctactics_insert on public.club_tactics for insert
  with check (author_id = auth.uid() and public.is_club_member(club_id));
drop policy if exists ctactics_modify on public.club_tactics;
create policy ctactics_modify on public.club_tactics for update using (author_id = auth.uid());
drop policy if exists ctactics_delete on public.club_tactics;
create policy ctactics_delete on public.club_tactics for delete using (author_id = auth.uid());

-- ============================================================
-- Al crear un club, añadir automáticamente al dueño como 'coach'
-- ============================================================
create or replace function public.handle_new_club()
returns trigger language plpgsql security definer as $$
begin
  insert into public.club_members (club_id, user_id, email, role)
  values (new.id, new.owner_id,
          (select email from auth.users where id = new.owner_id), 'coach')
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_club_created on public.clubs;
create trigger on_club_created
  after insert on public.clubs
  for each row execute function public.handle_new_club();
