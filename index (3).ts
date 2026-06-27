-- ============================================================
-- CourtLab — Plan Club (monetización de clubes)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ------------------------------------------------------------
-- Modelo: cada club tiene un 'plan'.
--   'free' → hasta 4 jugadores (además del entrenador).
--   'pro'  → jugadores ilimitados (suscripción Club).
-- El límite se fuerza en el servidor con un trigger, así que
-- un jugador NO puede saltárselo desde el navegador.
-- ============================================================

-- 1) Columna de plan en cada club
alter table public.clubs
  add column if not exists plan text not null default 'free';

-- (opcional) referencia a la suscripción de Stripe del club
alter table public.clubs
  add column if not exists stripe_sub_id text;

-- 2) Trigger: bloquea unirse como jugador si el club gratis está lleno
create or replace function public.enforce_club_player_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  club_plan   text;
  player_count int;
  free_limit  int := 4;   -- jugadores gratis (sin contar al entrenador)
begin
  -- el entrenador (coach) nunca cuenta para el límite
  if NEW.role = 'coach' then
    return NEW;
  end if;

  select plan into club_plan from public.clubs where id = NEW.club_id;

  -- plan de pago → sin límite
  if club_plan is distinct from 'free' then
    return NEW;
  end if;

  select count(*) into player_count
    from public.club_members
   where club_id = NEW.club_id and role <> 'coach';

  if player_count >= free_limit then
    raise exception 'CLUB_FULL'
      using errcode = 'P0001',
            hint = 'El club gratis admite hasta 4 jugadores. Actualiza al Plan Club.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_club_player_limit on public.club_members;
create trigger trg_club_player_limit
  before insert on public.club_members
  for each row execute function public.enforce_club_player_limit();

-- 3) (Para conceder Plan Club a mano mientras montamos el pago)
--    update public.clubs set plan = 'pro' where invite_code = 'XXXXXX';
