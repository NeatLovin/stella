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

-- Migrations : photo et chanson par souvenir (sans effet si les colonnes existent déjà)
alter table public.timeline_events add column if not exists image_path text;
alter table public.timeline_events add column if not exists song_url text;

-- Bocal à raisons
create table if not exists public.reasons (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  favorite   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.reasons add column if not exists favorite boolean not null default false;
-- 'him' = ses raisons à lui pour elle, 'her' = ses raisons à elle pour lui
alter table public.reasons add column if not exists author text not null default 'him' check (author in ('him', 'her'));

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
-- Cadeau déjà offert / acheté (barré dans la wishlist)
alter table public.wishlist_items add column if not exists offered boolean not null default false;

-- Messages des jalons (clé : 'months-4', 'days-100', 'years-1'…)
create table if not exists public.milestone_messages (
  key     text primary key,
  message text not null
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

-- Symptômes notés jour par jour (une ligne par jour)
create table if not exists public.symptoms (
  day        date primary key,
  items      text[] not null default '{}',
  flow       text check (flow in ('leger', 'moyen', 'abondant')),
  note       text,
  updated_at timestamptz not null default now()
);

-- Ciné à deux : catégories de films et films à regarder ensemble
create table if not exists public.film_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  emoji      text not null default '🎬',
  blurb      text not null default '',
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.films (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references public.film_categories(id) on delete cascade,
  title          text not null,
  original_title text,
  year           int,
  tmdb_id        int,          -- null : pas encore cherché sur TMDB ; 0 : introuvable
  poster_path    text,
  overview       text,
  runtime        int,
  letterboxd_uri text,
  position       int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists films_category_idx on public.films (category_id);
-- Jeton TMDB : à insérer à la main dans settings (clé 'tmdb_token'), jamais dans le code

-- Calendrier de l'Avent : une case par jour (contenu écrit à la main dans le SQL Editor)
create table if not exists public.advent_days (
  date  date primary key,
  kind  text not null check (kind in ('mot','lettre','bon','souvenir','son','film','defi','quiz','jeu','rdv','voeu')),
  title text not null,
  body  text not null default '',
  extra jsonb not null default '{}'
);
-- Ce qu'elle en a fait : ouverte, bon utilisé / défi relevé, vœu écrit
create table if not exists public.advent_state (
  date      date primary key,
  opened_at timestamptz,
  used_at   timestamptz,
  answer    text
);

-- Sécurité : RLS partout, accès complet uniquement pour l'utilisateur connecté
-- (il n'existe qu'un seul compte, et les inscriptions sont désactivées).
do $$
declare t text;
begin
  foreach t in array array['settings','timeline_events','reasons','wishlist_items','periods','ovulations','photos','milestone_messages','symptoms','film_categories','films','advent_state']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Cases de l'Avent : lisibles seulement à partir de leur jour (heure suisse), jamais avant,
-- même en fouillant. Pas d'écriture depuis le site : le contenu s'écrit dans le SQL Editor.
alter table public.advent_days enable row level security;
drop policy if exists "advent days unlocked" on public.advent_days;
create policy "advent days unlocked" on public.advent_days
  for select to authenticated
  using (date <= (now() at time zone 'Europe/Zurich')::date);
revoke all on public.advent_days from anon;
grant select on public.advent_days to authenticated;

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
