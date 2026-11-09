-- Campulse V1 schema.
-- Locked decisions (Nov 9, 2026, 19:28 WAT):
--   * A confirmed email OTP verifies the student and joins them to the FUNAAB Room.
--   * Manual approve/reject is a backup admin control only.
--   * Burden = min(100, 10 * B_raw), computed in lib/pulse.ts. No campus-size divisor.
--   * rejected is a normal admin status and requires a reason (enforced in set_incident_status).

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Roles exist on hosted Supabase. Create them only for a fresh Postgres.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

-- Auth shim for local Postgres. Hosted Supabase already has auth.users and auth.uid().
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text unique,
      encrypted_password text,
      email_confirmed_at timestamptz,
      raw_app_meta_data jsonb not null default '{}'::jsonb,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      instance_id uuid,
      aud text default 'authenticated',
      role text default 'authenticated'
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $fn$
      select nullif(
        coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
        ),
        ''
      )::uuid
    $fn$;
  end if;
end $$;

-- Storage shim. Hosted Supabase already has storage.buckets / storage.objects.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'storage' and p.proname = 'foldername'
  ) then
    create function storage.foldername(name text)
    returns text[]
    language sql
    immutable
    as $fn$
      select string_to_array(name, '/')
    $fn$;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'category') then
    create type public.category as enum (
      'electricity',
      'water_supply',
      'infrastructure',
      'sanitation',
      'accommodation',
      'security',
      'academic_facilities',
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'severity') then
    create type public.severity as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'priority') then
    create type public.priority as enum ('low', 'normal', 'high', 'urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum (
      'submitted',
      'under_review',
      'verified',
      'in_progress',
      'resolved',
      'rejected'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type public.verification_status as enum ('pending', 'verified', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type public.admin_role as enum ('university_admin', 'super_admin');
  end if;
end $$;

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  email_domains text[] not null default '{}',
  student_population int,
  ack_target_hours int not null default 48,
  resolve_target_days int not null default 7,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.universities (id, slug, name, email_domains, ack_target_hours, resolve_target_days, is_active)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'funaab',
    'Federal University of Agriculture, Abeokuta',
    '{}',
    48,
    7,
    true
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'demo-u2',
    'Demo University 2',
    '{}',
    48,
    7,
    false
  )
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  university_id uuid references public.universities (id),
  display_name text,
  avatar_url text,
  verification_status public.verification_status not null default 'pending',
  verification_method text,
  verified_at timestamptz,
  show_profile boolean not null default true,
  matric_number text,
  created_at timestamptz not null default now(),
  constraint profiles_method_chk check (
    verification_method is null or verification_method in ('email_otp', 'manual')
  )
);

-- Emails that receive a Room admin role the moment that address confirms a code.
-- Change the demo address to a real inbox before the first sign-in on hosted Supabase.
create table if not exists public.bootstrap_admins (
  email text primary key,
  university_slug text not null,
  role public.admin_role not null default 'university_admin'
);

create sequence if not exists public.public_code_seq start 1000;

create or replace function public.next_public_code()
returns text
language sql
security definer
set search_path = public
as $$
  select 'CP-' || lpad(nextval('public.public_code_seq')::text, 4, '0')
$$;

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id),
  category public.category not null,
  severity public.severity not null default 'medium',
  priority public.priority not null default 'normal',
  title text not null,
  status public.report_status not null default 'submitted',
  location_tag text,
  assigned_department text,
  public_code text not null unique,
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  verified_at timestamptz,
  resolved_at timestamptz,
  reopened_count int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  title text not null,
  description text not null,
  category public.category not null,
  image_path text,
  is_anonymous boolean not null default false,
  author_id uuid references public.profiles (id),
  ai_suggestion jsonb,
  status public.report_status not null default 'submitted',
  public_code text not null unique,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reports_anon_author_chk check (
    (is_anonymous and author_id is null)
    or (not is_anonymous and author_id is not null)
  )
);

create table if not exists public.report_identities (
  report_id uuid primary key references public.reports (id) on delete cascade,
  profile_id uuid not null references public.profiles (id)
);

create table if not exists public.confirmations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  note text,
  created_at timestamptz not null default now(),
  unique (incident_id, profile_id)
);

create table if not exists public.incident_notes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fix_checks (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  still_happening boolean not null,
  created_at timestamptz not null default now(),
  unique (incident_id, profile_id)
);

create table if not exists public.status_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  from_status public.report_status,
  to_status public.report_status not null,
  actor_id uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  university_id uuid references public.universities (id),
  role public.admin_role not null,
  department text,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_roles_super_unique
  on public.admin_roles (profile_id)
  where role = 'super_admin';

create unique index if not exists admin_roles_uni_unique
  on public.admin_roles (profile_id, university_id)
  where role = 'university_admin';

create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  university_id uuid references public.universities (id),
  action text not null,
  target_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  university_id uuid not null references public.universities (id),
  matric_number text,
  id_photo_path text,
  status public.verification_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.pulse_snapshots (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id),
  taken_on date not null,
  score int,
  band text,
  label text not null,
  components jsonb not null,
  includes_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (university_id, taken_on, includes_demo)
);

create index if not exists reports_university_created_idx
  on public.reports (university_id, created_at desc);
create index if not exists incidents_university_status_idx
  on public.incidents (university_id, status);
create index if not exists incidents_university_opened_idx
  on public.incidents (university_id, opened_at desc);
create index if not exists incidents_title_trgm_idx
  on public.incidents using gin (title gin_trgm_ops);
create index if not exists status_events_incident_idx
  on public.status_events (incident_id, created_at);
create index if not exists confirmations_incident_idx
  on public.confirmations (incident_id);
create index if not exists profiles_university_status_idx
  on public.profiles (university_id, verification_status);
create index if not exists admin_audit_university_idx
  on public.admin_audit (university_id, created_at desc);
