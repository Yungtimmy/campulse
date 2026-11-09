-- Cross-university isolation. A verified member of a second university must see zero FUNAAB rows.
-- Demo seed data is retired. This file creates throwaway fixtures, then rolls them back.
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql

begin;

-- Throwaway fixtures. 0005 no longer inserts users, incidents, or evidence.
do $$
declare
  funaab uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  u2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  admin_id uuid := '11111111-1111-4111-8111-111111111111';
  u2_user uuid := '22222222-2222-4222-8222-222222222222';
  pending_id uuid := '33333333-3333-4333-8333-333333333333';
  student uuid := '44444444-4444-4444-8444-000000000001';
  water uuid := 'c1000000-0000-4000-8000-000000000142';
  flood uuid := 'c1000000-0000-4000-8000-000000000148';
  canary uuid := 'c2000000-0000-4000-8000-000000000001';
  canary_report uuid := 'd2000000-0000-4000-8000-000000000001';
  i int;
  incident_id uuid;
  report_id uuid;
begin
  insert into public.universities (id, slug, name, email_domains, is_active)
  values (u2, 'demo-u2', 'Second university', '{}', false)
  on conflict (id) do nothing;

  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values
    (admin_id, 'room.admin@example.test', now(), jsonb_build_object('display_name', 'Room admin', 'university_slug', 'funaab')),
    (u2_user, 'u2.student@example.test', now(), jsonb_build_object('display_name', 'Second room student', 'university_slug', 'demo-u2')),
    (pending_id, 'pending.student@example.test', null, jsonb_build_object('display_name', 'Pending student', 'university_slug', 'funaab')),
    (student, 'funaab.student@example.test', now(), jsonb_build_object('display_name', 'FUNAAB student', 'university_slug', 'funaab'));

  insert into public.admin_roles (profile_id, university_id, role)
  values (admin_id, funaab, 'university_admin');

  for i in 1..12 loop
    incident_id := case i
      when 1 then water
      when 2 then flood
      else ('c1000000-0000-4000-8000-' || lpad((200 + i)::text, 12, '0'))::uuid
    end;
    report_id := ('d1000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    insert into public.incidents (
      id, university_id, category, severity, priority, title, status, public_code
    ) values (
      incident_id, funaab, 'other', 'low', 'low',
      'Fixture incident ' || i, 'submitted', 'CP-' || lpad((3000 + i)::text, 4, '0')
    );

    insert into public.reports (
      id, university_id, incident_id, title, description, category,
      is_anonymous, author_id, status, public_code
    ) values (
      report_id, funaab, incident_id,
      'Fixture incident ' || i,
      'Throwaway report created by the isolation test.',
      'other', false, student, 'submitted', 'CP-' || lpad((4000 + i)::text, 4, '0')
    );

    insert into public.report_identities (report_id, profile_id)
    values (report_id, student);
  end loop;

  insert into public.incidents (
    id, university_id, category, severity, priority, title, status, public_code
  ) values (
    canary, u2, 'other', 'low', 'low', 'Second room canary', 'submitted', 'CP-9001'
  );

  insert into public.reports (
    id, university_id, incident_id, title, description, category,
    is_anonymous, author_id, status, public_code
  ) values (
    canary_report, u2, canary, 'Second room canary',
    'This report belongs to the second university and must stay invisible to the FUNAAB Room.',
    'other', false, u2_user, 'submitted', 'CP-9002'
  );

  insert into public.report_identities (report_id, profile_id)
  values (canary_report, u2_user);

  insert into public.confirmations (incident_id, profile_id)
  values (water, student);

  insert into public.status_events (incident_id, from_status, to_status, actor_id, note)
  values (water, null, 'submitted', student, 'Received by Campulse');

  insert into public.admin_audit (actor_id, university_id, action, target_id)
  values (admin_id, funaab, 'fixture', water);

  insert into storage.objects (bucket_id, name, owner)
  values
    ('evidence', funaab::text || '/d1000000-0000-4000-8000-000000000001/photo.jpg', student),
    ('evidence', u2::text || '/' || canary_report::text || '/photo.jpg', u2_user);
end $$;

-- second-university student
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

  select count(*) into n from public.admin_audit;
  if n <> 0 then raise exception 'student read admin_audit (% rows)', n; end if;

  select count(*) into n from public.admin_roles;
  if n <> 0 then raise exception 'student read admin_roles (% rows)', n; end if;

  begin
    select count(*) into n from public.bootstrap_admins;
    if n <> 0 then raise exception 'student read bootstrap_admins (% rows)', n; end if;
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.incidents
    set status = 'resolved'
    where id = 'c1000000-0000-4000-8000-000000000142';
    if found then
      raise exception 'student updated an incident directly';
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

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

-- room admin: rejected requires a reason, and a reason is accepted
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
    raise exception 'room admin is not a FUNAAB admin';
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

reset role;

-- Fixture members keep email_otp and are already registered. The pending user is not.
do $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = '44444444-4444-4444-8444-000000000001'
      and verification_status = 'verified'
      and verification_method = 'email_otp'
      and registered_at is not null
      and faculty is null
  ) then
    raise exception 'fixture FUNAAB student is missing registration columns';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = '33333333-3333-4333-8333-333333333333'
      and (registered_at is not null or verification_status <> 'pending' or verification_method <> 'email_otp')
  ) then
    raise exception 'pending user should stay unregistered';
  end if;
end $$;

-- Google sign-in creates an unregistered FUNAAB profile. Completing the
-- registration fields approves them. A bootstrap Gmail receives admin on the
-- next auth update once that email is in bootstrap_admins.
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values (
  '55555555-5555-4555-8555-555555555555',
  'a.adeyemi@gmail.com',
  now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"Adebola Adeyemi","name":"Adebola","avatar_url":"https://example.com/a.png"}'::jsonb
);

do $$
declare
  status public.verification_status;
  method text;
  registered timestamptz;
  display text;
  avatar text;
  uni uuid;
begin
  select p.verification_status, p.verification_method, p.registered_at, p.display_name, p.avatar_url, p.university_id
    into status, method, registered, display, avatar, uni
  from public.profiles p
  where p.id = '55555555-5555-4555-8555-555555555555';

  if status <> 'pending' or method <> 'google' or registered is not null then
    raise exception 'google user should be an unregistered google profile, got % %', status, method;
  end if;
  if display <> 'Adebola Adeyemi' then
    raise exception 'google full_name was not copied, got %', display;
  end if;
  if avatar <> 'https://example.com/a.png' then
    raise exception 'google avatar was not copied, got %', avatar;
  end if;
  if uni is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'google user was not placed in FUNAAB';
  end if;

  begin
    update public.profiles
    set verification_method = 'carrier-pigeon'
    where id = '55555555-5555-4555-8555-555555555555';
    raise exception 'unknown verification method was accepted';
  exception
    when others then
      if sqlerrm ilike '%unknown verification method was accepted%' then
        raise;
      end if;
      if sqlerrm not ilike '%profiles_method_chk%' and sqlerrm not ilike '%check%' then
        raise;
      end if;
  end;
end $$;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '55555555-5555-4555-8555-555555555555',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  n int;
  status public.verification_status;
  method text;
  registered timestamptz;
begin
  if public.my_university() is not null then
    raise exception 'unregistered google user should have no room, got %', public.my_university();
  end if;

  begin
    update public.profiles
    set verification_status = 'verified'
    where id = '55555555-5555-4555-8555-555555555555';
    raise exception 'status update was accepted';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlerrm ilike '%status update was accepted%' then
        raise;
      end if;
      if sqlerrm not ilike '%permission%' and sqlerrm not ilike '%privilege%' then
        raise;
      end if;
  end;

  update public.profiles
  set display_name = 'Adebola Adeyemi',
      faculty = 'College of Engineering (COLENG)',
      department = 'Mechanical Engineering',
      level = '300',
      matric_number = '2019/1234'
  where id = '55555555-5555-4555-8555-555555555555';

  select p.verification_status, p.verification_method, p.registered_at
    into status, method, registered
  from public.profiles p
  where p.id = '55555555-5555-4555-8555-555555555555';

  if status <> 'verified' or method <> 'google' or registered is null then
    raise exception 'registration did not approve the google user (% %)', status, method;
  end if;
  if public.my_university() is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'registered google user did not join FUNAAB';
  end if;
  if public.is_uni_admin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
    raise exception 'google user became an admin before their email was bootstrapped';
  end if;

  select count(*) into n from public.incidents where university_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if n < 12 then
    raise exception 'registered google user should see the FUNAAB room, saw %', n;
  end if;

  update public.profiles
  set faculty = 'College of Engineering (COLENG)'
  where id = '44444444-4444-4444-8444-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'google user updated another profile (% rows)', n;
  end if;
end $$;

reset role;

insert into public.bootstrap_admins (email, university_slug, role)
values ('a.adeyemi@gmail.com', 'funaab', 'university_admin')
on conflict (email) do nothing;

update auth.users
set email = email
where id = '55555555-5555-4555-8555-555555555555';

do $$
declare
  got_faculty text;
begin
  if not exists (
    select 1
    from public.admin_roles
    where profile_id = '55555555-5555-4555-8555-555555555555'
      and role = 'university_admin'
      and university_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'bootstrap gmail was not granted on the next sign-in';
  end if;

  select p.faculty into got_faculty
  from public.profiles p
  where p.id = '44444444-4444-4444-8444-000000000001';
  if got_faculty is not null then
    raise exception 'another student''s faculty was changed';
  end if;

  perform set_config('request.jwt.claims', '', true);
  update public.profiles
  set verification_status = 'rejected'
  where id = '55555555-5555-4555-8555-555555555555';

  delete from public.admin_roles
  where profile_id = '55555555-5555-4555-8555-555555555555';
end $$;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '55555555-5555-4555-8555-555555555555',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $$
declare
  status public.verification_status;
begin
  update public.profiles
  set display_name = 'Adebola Adeyemi',
      faculty = 'College of Biosciences (COLBIOS)',
      department = 'Microbiology',
      level = '400'
  where id = '55555555-5555-4555-8555-555555555555';

  select p.verification_status into status
  from public.profiles p
  where p.id = '55555555-5555-4555-8555-555555555555';
  if status <> 'rejected' then
    raise exception 'revoked google user rejoined by editing registration, got %', status;
  end if;
  if public.my_university() is not null then
    raise exception 'revoked google user still has a room';
  end if;
end $$;

rollback;
