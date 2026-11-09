-- Cross-university isolation. A verified demo-u2 member must see zero FUNAAB rows.
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql

begin;

-- demo-u2 student
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '22222222-2222-4222-8222-222222222222',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  n int;
  funaab uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  u2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  if public.my_university() is distinct from u2 then
    raise exception 'demo-u2 user resolved university %', public.my_university();
  end if;

  select count(*) into n from public.reports where university_id = funaab;
  if n <> 0 then raise exception 'FUNAAB reports leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n from public.incidents where university_id = funaab;
  if n <> 0 then raise exception 'FUNAAB incidents leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n from public.incident_feed where university_id = funaab;
  if n <> 0 then raise exception 'FUNAAB feed leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n from public.pulse_inputs where university_id = funaab;
  if n <> 0 then raise exception 'FUNAAB pulse inputs leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n
  from public.status_events se
  join public.incidents i on i.id = se.incident_id
  where i.university_id = funaab;
  if n <> 0 then raise exception 'FUNAAB status events leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n from public.confirmations c
  join public.incidents i on i.id = c.incident_id
  where i.university_id = funaab;
  if n <> 0 then raise exception 'FUNAAB confirmations leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n from public.report_identities ri
  where ri.profile_id <> '22222222-2222-4222-8222-222222222222';
  if n <> 0 then raise exception 'FUNAAB report identities leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n from public.report_identities;
  if n <> 1 then raise exception 'demo-u2 user should see only their own identity, saw %', n; end if;

  select count(*) into n from public.profiles where university_id = funaab;
  if n <> 0 then raise exception 'FUNAAB profiles leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n from public.admin_audit where university_id = funaab;
  if n <> 0 then raise exception 'FUNAAB audit leaked to demo-u2 (% rows)', n; end if;

  select count(*) into n
  from storage.objects
  where bucket_id = 'evidence'
    and (storage.foldername(name))[1] = funaab::text;
  if n <> 0 then raise exception 'FUNAAB evidence leaked to demo-u2 (% objects)', n; end if;

  select count(*) into n from public.incidents where university_id = u2;
  if n <> 1 then raise exception 'demo-u2 user should see their own canary, saw %', n; end if;

  select count(*) into n
  from storage.objects
  where bucket_id = 'evidence'
    and (storage.foldername(name))[1] = u2::text;
  if n <> 1 then raise exception 'demo-u2 user should see their own evidence, saw %', n; end if;
end $$;

reset role;

-- unverified FUNAAB account
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '33333333-3333-4333-8333-333333333333',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  n int;
begin
  if public.my_university() is not null then
    raise exception 'pending user should have no room, got %', public.my_university();
  end if;
  select count(*) into n from public.incidents;
  if n <> 0 then raise exception 'pending user saw % incidents', n; end if;
  select count(*) into n from public.reports;
  if n <> 0 then raise exception 'pending user saw % reports', n; end if;
  select count(*) into n from storage.objects;
  if n <> 0 then raise exception 'pending user saw % evidence objects', n; end if;
end $$;

reset role;

-- verified FUNAAB student sees FUNAAB and not demo-u2
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '44444444-4444-4444-8444-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  n int;
  funaab uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  u2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin
  if public.my_university() is distinct from funaab then
    raise exception 'FUNAAB student resolved university %', public.my_university();
  end if;
  select count(*) into n from public.incidents where university_id = funaab;
  if n < 12 then raise exception 'FUNAAB student should see the seeded room, saw %', n; end if;
  select count(*) into n from public.incidents where university_id = u2;
  if n <> 0 then raise exception 'FUNAAB student saw % demo-u2 incidents', n; end if;
  select count(*) into n
  from storage.objects
  where (storage.foldername(name))[1] = u2::text;
  if n <> 0 then raise exception 'FUNAAB student saw demo-u2 evidence'; end if;

  begin
    perform public.set_incident_status(
      'c1000000-0000-4000-8000-000000000142',
      'verified',
      'students cannot do this'
    );
    raise exception 'student status change was accepted';
  exception
    when others then
      if sqlerrm ilike '%student status change was accepted%' then
        raise;
      end if;
      if sqlerrm not ilike '%forbidden%' then
        raise;
      end if;
  end;
end $$;

reset role;

-- demo admin: rejected requires a reason, and a reason is accepted
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  updated public.incidents;
begin
  if not public.is_uni_admin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'demo admin is not a FUNAAB admin';
  end if;

  begin
    perform public.set_incident_status(
      'c1000000-0000-4000-8000-000000000148',
      'rejected',
      null
    );
    raise exception 'rejected without a reason was accepted';
  exception
    when others then
      if sqlerrm ilike '%rejected without a reason was accepted%' then
        raise;
      end if;
      if sqlerrm not ilike '%reason%' then
        raise;
      end if;
  end;

  updated := public.set_incident_status(
    'c1000000-0000-4000-8000-000000000148',
    'rejected',
    'Duplicate of a test, no campus issue described'
  );
  if updated.status <> 'rejected' then
    raise exception 'admin reject did not stick';
  end if;
  if not exists (
    select 1 from public.admin_audit
    where target_id = 'c1000000-0000-4000-8000-000000000148'
      and action = 'set_status'
  ) then
    raise exception 'admin reject was not audited';
  end if;
end $$;

rollback;
