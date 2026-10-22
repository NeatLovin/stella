-- Stella — schéma Supabase
-- À exécuter une fois dans Supabase → SQL Editor → New query → Run.
-- Ne contient aucune donnée perso (le contenu est dans seed.sql, non commité).

create extension if not exists pgcrypto;

-- Réglages clé / valeur (prénoms, date de mise en couple)
create table if not exists public.settings (
  key   text primary key,
  value text not null
);

-- Timeline (constellation)
create table if not exists public.timeline_events (
  id          uuid primary key default gen_random_uuid(),
  date_start  date not null,
  date_end    date,
  title       text not null,
  description text not null default '',
  icon        text not null default '✨',
  highlight   boolean not null default false,
  image_path  text,
  created_at  timestamptz not null default now(),
  check (date_end is null or date_end >= date_start)
);

-- Migration : photo par souvenir (sans effet si la colonne existe déjà)
alter table public.timeline_events add column if not exists image_path text;

-- Bocal à raisons
create table if not exists public.reasons (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  created_at timestamptz not null default now()
);

-- Mur de photos (page « Nous »)
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  image_path text not null,
  caption    text,
  created_at timestamptz not null default now()
);

-- Wishlist
create table if not exists public.wishlist_items (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  url        text,
  image_path text,
  created_at timestamptz not null default now()
);

-- Cycle
create table if not exists public.periods (
  id         uuid primary key default gen_random_uuid(),
  start_date date not null unique,
  end_date   date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.ovulations (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  created_at timestamptz not null default now()
);

-- Sécurité : RLS partout, accès complet uniquement pour l'utilisateur connecté
-- (il n'existe qu'un seul compte, et les inscriptions sont désactivées).
do $$
declare t text;
begin
  foreach t in array array['settings','timeline_events','reasons','wishlist_items','periods','ovulations','photos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Photos de la wishlist : bucket privé (URLs signées côté app)
insert into storage.buckets (id, name, public)
values ('wishlist', 'wishlist', false)
on conflict (id) do nothing;

drop policy if exists "wishlist authenticated access" on storage.objects;
create policy "wishlist authenticated access" on storage.objects
  for all to authenticated
  using (bucket_id = 'wishlist')
  with check (bucket_id = 'wishlist');

-- Anti-pause (plan gratuit) : une tâche GitHub Actions appelle cette fonction chaque jour.
-- Elle ne renvoie qu'un nombre, aucune donnée.
create or replace function public.keepalive()
returns integer
language sql
security definer
set search_path = public
as $$ select count(*)::int from public.settings $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
