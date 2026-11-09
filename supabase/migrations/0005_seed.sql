-- Demo admin, about 12 FUNAAB reports flagged is_demo, and an inactive demo-u2 room.
-- The demo admin signs in with email OTP at admin@campulse.demo.
-- Change bootstrap_admins.email to a real inbox before the first hosted sign-in
-- if that address cannot receive mail. The role is granted when the address confirms.

insert into public.bootstrap_admins (email, university_slug, role)
values ('admin@campulse.demo', 'funaab', 'university_admin')
on conflict (email) do nothing;

create or replace function public._seed_auth_user(
  p_id uuid,
  p_email text,
  p_confirmed timestamptz,
  p_meta jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hosted boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'confirmation_token'
  ) into hosted;

  if hosted then
    execute
      'insert into auth.users (
         instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
         created_at, updated_at,
         confirmation_token, email_change, email_change_token_new, recovery_token
       ) values (
         ''00000000-0000-0000-0000-000000000000'',
         $1, ''authenticated'', ''authenticated'', $2, '''',
         $3, ''{"provider":"email","providers":["email"]}''::jsonb, $4,
         now(), now(), '''', '''', '''', ''''
       )'
    using p_id, p_email, p_confirmed, p_meta;
  else
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    values (p_id, p_email, p_confirmed, p_meta);
  end if;
end;
$$;

do $$
declare
  funaab uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  u2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  admin_id uuid := '11111111-1111-4111-8111-111111111111';
  u2_user uuid := '22222222-2222-4222-8222-222222222222';
  pending_id uuid := '33333333-3333-4333-8333-333333333333';
  i int;
  sid uuid;
  water uuid := 'c1000000-0000-4000-8000-000000000142';
  bins uuid := 'c1000000-0000-4000-8000-000000000131';
  lights uuid := 'c1000000-0000-4000-8000-000000000135';
  power uuid := 'c1000000-0000-4000-8000-000000000139';
  roof uuid := 'c1000000-0000-4000-8000-000000000128';
  scopes uuid := 'c1000000-0000-4000-8000-000000000126';
  lift uuid := 'c1000000-0000-4000-8000-000000000137';
  testpost uuid := 'c1000000-0000-4000-8000-000000000120';
  flood uuid := 'c1000000-0000-4000-8000-000000000148';
  library uuid := 'c1000000-0000-4000-8000-000000000144';
  chairs uuid := 'c1000000-0000-4000-8000-000000000140';
  tiles uuid := 'c1000000-0000-4000-8000-000000000133';
  canary uuid := 'c2000000-0000-4000-8000-000000000001';
  water_report uuid := 'd1000000-0000-4000-8000-000000000142';
  water_dup uuid := 'd1000000-0000-4000-8000-000000000146';
  canary_report uuid := 'd2000000-0000-4000-8000-000000000001';
  author uuid := '44444444-4444-4444-8444-000000000016';
  anon_author uuid := '44444444-4444-4444-8444-000000000014';
  dup_author uuid := '44444444-4444-4444-8444-000000000015';
  roof_author uuid := '44444444-4444-4444-8444-000000000017';
begin
  begin
    perform public._seed_auth_user(
      admin_id,
      'admin@campulse.demo',
      now(),
      jsonb_build_object('display_name', 'Demo admin', 'university_slug', 'funaab')
    );
    perform public._seed_auth_user(
      u2_user,
      'u2@campulse.demo',
      now(),
      jsonb_build_object('display_name', 'Demo U2 student', 'university_slug', 'demo-u2')
    );
    perform public._seed_auth_user(
      pending_id,
      'pending@campulse.demo',
      null,
      jsonb_build_object('display_name', 'Pending student', 'university_slug', 'funaab')
    );
    for i in 1..20 loop
      sid := ('44444444-4444-4444-8444-' || lpad(i::text, 12, '0'))::uuid;
      perform public._seed_auth_user(
        sid,
        'demo.student.' || lpad(i::text, 2, '0') || '@campulse.demo',
        now(),
        jsonb_build_object('display_name', 'Demo student ' || i, 'university_slug', 'funaab')
      );
    end loop;
  exception
    when others then
      raise notice 'Demo auth users were not seeded (%). Universities and bootstrap_admins are in place.', sqlerrm;
      return;
  end;

  insert into public.incidents (
    id, university_id, category, severity, priority, title, status, location_tag,
    public_code, opened_at, acknowledged_at, verified_at, resolved_at, is_demo, assigned_department
  ) values
    (water, funaab, 'water_supply', 'high', 'urgent', 'Water supply down, Block C', 'under_review', 'Block C',
      'CP-0142', now() - interval '30 hours', now() - interval '24 hours 32 minutes', null, null, true, null),
    (bins, funaab, 'sanitation', 'medium', 'normal', 'Overflowing bins behind Block A', 'submitted', 'Block A',
      'CP-0131', now() - interval '54 hours', null, null, null, true, null),
    (lights, funaab, 'security', 'critical', 'urgent', 'Streetlights out on hostel road', 'verified', 'Hostel road',
      'CP-0135', now() - interval '4 days', now() - interval '3 days 20 hours', now() - interval '2 days', null, true, 'Security Unit'),
    (power, funaab, 'electricity', 'high', 'high', 'No power in Lecture Theatre 2', 'in_progress', 'Lecture Theatre 2',
      'CP-0139', now() - interval '5 days', now() - interval '4 days 20 hours', now() - interval '3 days', null, true, 'Works and Services'),
    (roof, funaab, 'accommodation', 'medium', 'normal', 'Leaking roof, hostel corridor', 'in_progress', 'Hostel corridor',
      'CP-0128', now() - interval '6 days', now() - interval '5 days 18 hours', now() - interval '4 days', null, true, 'Works and Services'),
    (scopes, funaab, 'academic_facilities', 'low', 'low', 'Broken microscopes, Biology lab', 'verified', 'Biology lab',
      'CP-0126', now() - interval '2 days', now() - interval '36 hours', now() - interval '1 day', null, true, null),
    (lift, funaab, 'infrastructure', 'medium', 'normal', 'Broken lift, Faculty of Science', 'resolved', 'Faculty of Science',
      'CP-0137', now() - interval '12 days', now() - interval '11 days 20 hours', now() - interval '8 days', now() - interval '3 days', true, 'Works and Services'),
    (testpost, funaab, 'other', 'low', 'low', 'Test post, no issue described', 'rejected', null,
      'CP-0120', now() - interval '6 days', now() - interval '5 days', null, null, true, null),
    (flood, funaab, 'water_supply', 'medium', 'normal', 'Hostel bathroom flood, Block B', 'submitted', 'Block B',
      'CP-0148', now() - interval '5 hours', null, null, null, true, null),
    (library, funaab, 'electricity', 'low', 'normal', 'Flickering lights, Library', 'under_review', 'Library',
      'CP-0144', now() - interval '20 hours', now() - interval '18 hours', null, null, true, null),
    (chairs, funaab, 'academic_facilities', 'low', 'low', 'Broken chairs, 200 level hall', 'submitted', '200 level hall',
      'CP-0140', now() - interval '10 hours', null, null, null, true, null),
    (tiles, funaab, 'infrastructure', 'medium', 'normal', 'Loose tiles, Senate building', 'resolved', 'Senate building',
      'CP-0133', now() - interval '9 days', now() - interval '8 days 20 hours', now() - interval '6 days', now() - interval '2 days', true, 'Works and Services'),
    (canary, u2, 'other', 'low', 'low', 'U2 private canary', 'submitted', 'U2 yard',
      'CP-9001', now() - interval '1 day', null, null, null, true, null);

  insert into public.reports (
    id, university_id, incident_id, title, description, category, is_anonymous, author_id,
    ai_suggestion, status, public_code, is_demo, created_at
  ) values
    (water_report, funaab, water, 'Water supply down, Block C',
      'There has been no water in our hostel for three days. Taps on all floors of Block C are dry since Friday morning.',
      'water_supply', true, null,
      jsonb_build_object(
        'category', 'water_supply', 'severity', 'high', 'priority', 'urgent',
        'summary', 'Prolonged hostel water shortage', 'duplicate_of', '[]'::jsonb,
        'confidence', 0.82, 'model', 'seed', 'prompt_version', 'seed'
      ),
      'under_review', 'CP-3142', true, now() - interval '30 hours'),
    (water_dup, funaab, water, 'Still no water, Block C second floor',
      'Same outage. The second floor taps are dry as well.',
      'water_supply', false, dup_author, null, 'under_review', 'CP-0146', true, now() - interval '26 hours'),
    (gen_random_uuid(), funaab, bins, 'Overflowing bins behind Block A',
      'The bins behind Block A have not been cleared. Waste is spilling onto the path.',
      'sanitation', false, author, null, 'submitted', 'CP-3131', true, now() - interval '54 hours'),
    (gen_random_uuid(), funaab, lights, 'Streetlights out on hostel road',
      'The lights along the hostel road have been out for several nights.',
      'security', false, author, null, 'verified', 'CP-3135', true, now() - interval '4 days'),
    (gen_random_uuid(), funaab, power, 'No power in Lecture Theatre 2',
      'Lecture Theatre 2 has had no power since the last storm. Classes are being moved.',
      'electricity', false, author, null, 'in_progress', 'CP-3139', true, now() - interval '5 days'),
    (gen_random_uuid(), funaab, roof, 'Leaking roof, hostel corridor',
      'Rain comes through the corridor roof outside the rooms. The floor stays wet.',
      'accommodation', true, null, null, 'in_progress', 'CP-3128', true, now() - interval '6 days'),
    (gen_random_uuid(), funaab, scopes, 'Broken microscopes, Biology lab',
      'Three microscopes in the biology lab do not focus. Practicals are sharing the rest.',
      'academic_facilities', false, author, null, 'verified', 'CP-3126', true, now() - interval '2 days'),
    (gen_random_uuid(), funaab, lift, 'Broken lift, Faculty of Science',
      'The faculty lift has been out of service. It was repaired and is back in use.',
      'infrastructure', false, author, null, 'resolved', 'CP-3137', true, now() - interval '12 days'),
    (gen_random_uuid(), funaab, testpost, 'Test post, no issue described',
      'This was an empty test and does not describe a campus problem.',
      'other', false, author, null, 'rejected', 'CP-3120', true, now() - interval '6 days'),
    (gen_random_uuid(), funaab, flood, 'Hostel bathroom flood, Block B',
      'A bathroom on the first floor of Block B is flooding into the corridor.',
      'water_supply', false, author, null, 'submitted', 'CP-3148', true, now() - interval '5 hours'),
    (gen_random_uuid(), funaab, library, 'Flickering lights, Library',
      'The reading-room lights flicker and go dim in the evening.',
      'electricity', false, author, null, 'under_review', 'CP-3144', true, now() - interval '20 hours'),
    (gen_random_uuid(), funaab, chairs, 'Broken chairs, 200 level hall',
      'Several chairs in the 200 level hall are broken and have been pushed aside.',
      'academic_facilities', false, author, null, 'submitted', 'CP-3140', true, now() - interval '10 hours'),
    (gen_random_uuid(), funaab, tiles, 'Loose tiles, Senate building',
      'Tiles on the ground-floor corridor were loose. They have been replaced.',
      'infrastructure', false, author, null, 'resolved', 'CP-3133', true, now() - interval '9 days'),
    (canary_report, u2, canary, 'U2 private canary',
      'This report belongs to demo-u2 and must stay invisible to the FUNAAB Room.',
      'other', false, u2_user, null, 'submitted', 'CP-3901', true, now() - interval '1 day');

  insert into public.report_identities (report_id, profile_id)
  select r.id, case
    when r.id = water_report then anon_author
    when r.id = water_dup then dup_author
    when r.id = canary_report then u2_user
    when r.incident_id = roof then roof_author
    else author
  end
  from public.reports r
  where r.is_demo = true;

  insert into public.confirmations (incident_id, profile_id)
  select water, ('44444444-4444-4444-8444-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 12) as n;

  insert into public.status_events (incident_id, from_status, to_status, actor_id, note, created_at)
  select i.id, null, 'submitted', author, 'Received by Campulse', i.opened_at
  from public.incidents i
  where i.is_demo and i.university_id = funaab;

  insert into public.status_events (incident_id, from_status, to_status, actor_id, note, created_at)
  select i.id, 'submitted', 'under_review', admin_id, 'Acknowledged by a Room admin', i.acknowledged_at
  from public.incidents i
  where i.acknowledged_at is not null and i.university_id = funaab;

  insert into public.status_events (incident_id, from_status, to_status, actor_id, note, created_at)
  select i.id, 'under_review', 'verified', admin_id, 'An admin confirmed the issue', i.verified_at
  from public.incidents i
  where i.verified_at is not null and i.university_id = funaab;

  insert into public.status_events (incident_id, from_status, to_status, actor_id, note, created_at)
  select i.id, 'verified', i.status, admin_id,
    case when i.status = 'resolved' then 'Reported fixed, with a resolution note.' else 'The assigned team is acting on it' end,
    coalesce(i.resolved_at, i.verified_at + interval '1 hour')
  from public.incidents i
  where i.status in ('in_progress', 'resolved') and i.university_id = funaab;

  insert into public.status_events (incident_id, from_status, to_status, actor_id, note, created_at)
  values (
    testpost, 'submitted', 'rejected', admin_id, 'No issue described', now() - interval '5 days'
  );

  insert into public.status_events (incident_id, from_status, to_status, actor_id, note, created_at)
  select i.id, i.status, i.status, admin_id, 'Assigned to ' || i.assigned_department, i.verified_at
  from public.incidents i
  where i.assigned_department is not null and i.university_id = funaab;

  insert into public.admin_audit (actor_id, university_id, action, target_id, meta, created_at)
  values
    (admin_id, funaab, 'set_status', water, '{"from":"submitted","to":"under_review"}'::jsonb, now() - interval '24 hours 32 minutes'),
    (admin_id, funaab, 'set_status', testpost, '{"from":"submitted","to":"rejected","note":"No issue described"}'::jsonb, now() - interval '5 days');

  insert into storage.objects (bucket_id, name, owner)
  values
    ('evidence', funaab::text || '/' || water_report::text || '/photo.jpg', anon_author),
    ('evidence', u2::text || '/' || canary_report::text || '/photo.jpg', u2_user);

  perform setval('public.public_code_seq', 4000, true);
end $$;

drop function public._seed_auth_user(uuid, text, timestamptz, jsonb);
