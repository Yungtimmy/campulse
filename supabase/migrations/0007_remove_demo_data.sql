-- Already applied on production.
-- Fresh databases still run this file. It is idempotent and only deletes demo rows.
--
-- scripts/isolation.sh uses plain Postgres, which has no Supabase auth session
-- tables. Create empty stand-ins when they are missing so the deletes below can
-- run. Hosted Supabase already has these tables, so this block does nothing there.

do $shim$
begin
  if to_regclass('auth.sessions') is null then
    create table auth.sessions (
      id uuid primary key,
      user_id uuid
    );
  end if;
  if to_regclass('auth.refresh_tokens') is null then
    create table auth.refresh_tokens (
      id bigint generated always as identity primary key,
      user_id text
    );
  end if;
  if to_regclass('auth.identities') is null then
    create table auth.identities (
      id uuid primary key,
      user_id uuid
    );
  end if;
  if to_regclass('auth.one_time_tokens') is null then
    create table auth.one_time_tokens (
      id uuid primary key,
      user_id uuid
    );
  end if;
  if to_regclass('auth.mfa_factors') is null then
    create table auth.mfa_factors (
      id uuid primary key,
      user_id uuid
    );
  end if;
  if to_regclass('auth.mfa_amr_claims') is null then
    create table auth.mfa_amr_claims (
      id uuid primary key,
      session_id uuid
    );
  end if;
end
$shim$;

-- Remove Campulse demo seed data from the live database.
-- Idempotent: safe to re-run. Never touches is_demo=false rows or non-@campulse.demo users.
-- Keeps: funaab, real Gmail users, real bootstrap_admins, real reports/incidents,
--         pulse_snapshots with includes_demo=false, public_code_seq.

do $remove$
declare
  demo_u2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  -- 1) Child rows that reference profiles with NO ACTION, owned by demo or on demo incidents.
  delete from public.confirmations c
  where c.incident_id in (select id from public.incidents where is_demo = true)
     or c.profile_id in (select id from auth.users where email like '%@campulse.demo');

  if to_regclass('public.follow_checks') is not null then
    execute $q$
      delete from public.follow_checks f
      where f.incident_id in (select id from public.incidents where is_demo = true)
         or f.profile_id in (select id from auth.users where email like '%@campulse.demo')
    $q$;
  end if;

  delete from public.incident_notes n
  where n.incident_id in (select id from public.incidents where is_demo = true)
     or n.profile_id in (select id from auth.users where email like '%@campulse.demo');

  delete from public.status_events se
  where se.incident_id in (select id from public.incidents where is_demo = true)
     or se.actor_id in (select id from auth.users where email like '%@campulse.demo');

  -- 2) Admin audit by demo actors, targeting demo incidents/reports, or on demo-u2.
  delete from public.admin_audit a
  where a.actor_id in (select id from auth.users where email like '%@campulse.demo')
     or a.target_id in (select id from public.incidents where is_demo = true)
     or a.target_id in (select id from public.reports where is_demo = true)
     or a.university_id = demo_u2;

  -- 3) Report identities for demo reports or demo profiles.
  delete from public.report_identities ri
  where ri.report_id in (select id from public.reports where is_demo = true)
     or ri.profile_id in (select id from auth.users where email like '%@campulse.demo');

  -- 4) Demo reports, then demo incidents.
  delete from public.reports r where r.is_demo = true;
  delete from public.incidents i where i.is_demo = true;

  -- 5) Pulse snapshots that include demo.
  delete from public.pulse_snapshots ps where ps.includes_demo = true;

  -- 6) Demo bootstrap admin only.
  delete from public.bootstrap_admins where email like '%@campulse.demo';

  -- 7) Admin roles / join requests for demo users or demo-u2.
  delete from public.admin_roles ar
  where ar.profile_id in (select id from auth.users where email like '%@campulse.demo')
     or ar.university_id = demo_u2;

  delete from public.join_requests jr
  where jr.profile_id in (select id from auth.users where email like '%@campulse.demo')
     or jr.university_id = demo_u2;

  -- 8) If a demo user somehow authored a real report, anonymize to keep the real row.
  update public.reports r
  set author_id = null,
      is_anonymous = true
  where r.author_id in (select id from auth.users where email like '%@campulse.demo')
    and r.is_demo = false;

  -- 9) Detach demo profiles from demo-u2 before dropping the university.
  update public.profiles p
  set university_id = null
  where p.university_id = demo_u2
    and p.id in (select id from auth.users where email like '%@campulse.demo');

  -- 10) Clear auth children, then demo auth users (profiles cascade).
  delete from auth.mfa_amr_claims c
  where c.session_id in (
    select s.id from auth.sessions s
    where s.user_id in (select id from auth.users where email like '%@campulse.demo')
  );

  delete from auth.sessions s
  where s.user_id in (select id from auth.users where email like '%@campulse.demo');

  delete from auth.refresh_tokens r
  where r.user_id in (select id::text from auth.users where email like '%@campulse.demo');

  delete from auth.identities i
  where i.user_id in (select id from auth.users where email like '%@campulse.demo');

  delete from auth.one_time_tokens t
  where t.user_id in (select id from auth.users where email like '%@campulse.demo');

  delete from auth.mfa_factors m
  where m.user_id in (select id from auth.users where email like '%@campulse.demo');

  delete from auth.users u where u.email like '%@campulse.demo';

  -- 11) Remove inactive demo-u2 university.
  delete from public.universities
  where slug = 'demo-u2' and id = demo_u2;

  -- public_code_seq left unchanged.
  -- storage.objects left for Storage API (protect_objects_delete trigger).
end
$remove$;
