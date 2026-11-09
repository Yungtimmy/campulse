-- Helpers, auth trigger, and the RPCs that keep status, audit, and identity in step.

create or replace function public.my_university()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select university_id
  from public.profiles
  where id = auth.uid()
    and verification_status = 'verified'
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_roles
    where profile_id = auth.uid()
      and role = 'super_admin'
  )
$$;

create or replace function public.is_uni_admin(u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.admin_roles
      where profile_id = auth.uid()
        and role = 'university_admin'
        and university_id = u
    )
$$;

create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('campulse.allow_verification_write', true) = '1' then
    return new;
  end if;
  if auth.uid() is not null
     and not public.is_super_admin()
     and not public.is_uni_admin(old.university_id) then
    new.verification_status := old.verification_status;
    new.verification_method := old.verification_method;
    new.verified_at := old.verified_at;
    new.university_id := old.university_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uni_slug text;
  uni uuid;
  confirmed boolean;
begin
  perform set_config('campulse.allow_verification_write', '1', true);
  uni_slug := coalesce(new.raw_user_meta_data ->> 'university_slug', 'funaab');
  select id into uni from public.universities u where u.slug = uni_slug;
  if uni is null then
    select id into uni from public.universities where slug = 'funaab';
  end if;
  confirmed := new.email_confirmed_at is not null;

  insert into public.profiles (
    id,
    university_id,
    display_name,
    verification_status,
    verification_method,
    verified_at
  ) values (
    new.id,
    uni,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'student'), '@', 1)),
    case when confirmed then 'verified'::public.verification_status else 'pending'::public.verification_status end,
    'email_otp',
    case when confirmed then now() else null end
  )
  on conflict (id) do update
    set verification_status = case
          when profiles.verification_status = 'rejected' then profiles.verification_status
          when confirmed and profiles.verification_status = 'pending' then 'verified'::public.verification_status
          else profiles.verification_status
        end,
        verification_method = case
          when confirmed and profiles.verification_status = 'pending' then 'email_otp'
          else profiles.verification_method
        end,
        verified_at = case
          when confirmed and profiles.verification_status = 'pending' then coalesce(profiles.verified_at, now())
          else profiles.verified_at
        end,
        university_id = coalesce(profiles.university_id, excluded.university_id),
        display_name = coalesce(profiles.display_name, excluded.display_name);

  if confirmed and exists (
    select 1 from public.profiles
    where id = new.id and verification_status = 'verified'
  ) then
    insert into public.admin_roles (profile_id, university_id, role)
    select new.id, u.id, b.role
    from public.bootstrap_admins b
    join public.universities u on u.slug = b.university_slug
    where lower(b.email) = lower(coalesce(new.email, ''))
      and not exists (
        select 1
        from public.admin_roles ar
        where ar.profile_id = new.id
          and ar.role = b.role
          and ar.university_id is not distinct from u.id
      );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is distinct from new.email_confirmed_at)
  execute function public.handle_auth_user();

create or replace function public.ensure_report_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.report_identities where report_id = new.id
  ) then
    raise exception 'every report needs a protected identity row';
  end if;
  return null;
end;
$$;

drop trigger if exists reports_identity_required on public.reports;
create constraint trigger reports_identity_required
  after insert on public.reports
  deferrable initially deferred
  for each row execute function public.ensure_report_identity();

create or replace function public.affected_count(p_incident uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.incidents i
      where i.id = p_incident
        and (
          i.university_id = public.my_university()
          or public.is_uni_admin(i.university_id)
        )
    )
    then (
      select count(distinct profile_id)::int
      from (
        select ri.profile_id
        from public.report_identities ri
        join public.reports r on r.id = ri.report_id
        where r.incident_id = p_incident
        union
        select c.profile_id
        from public.confirmations c
        where c.incident_id = p_incident
      ) people
    )
    else 0
  end
$$;

create or replace function public.verified_member_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.profiles
  where university_id = public.my_university()
    and verification_status = 'verified'
$$;

create or replace function public.submit_report(
  p_title text,
  p_description text,
  p_category public.category,
  p_is_anonymous boolean,
  p_duplicate_of uuid default null,
  p_ai_suggestion jsonb default null,
  p_location_tag text default null
) returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uni uuid;
  inc public.incidents;
  rep public.reports;
  sev public.severity := 'medium';
  pri public.priority := 'normal';
  sugg_sev text;
  sugg_pri text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select university_id into uni
  from public.profiles
  where id = uid and verification_status = 'verified';

  if uni is null then
    raise exception 'not verified';
  end if;

  if p_title is null or length(trim(p_title)) = 0 or length(p_title) > 80 then
    raise exception 'title must be 1-80 characters';
  end if;
  if p_description is null or length(trim(p_description)) = 0 or length(p_description) > 2000 then
    raise exception 'description must be 1-2000 characters';
  end if;

  if p_ai_suggestion is not null then
    sugg_sev := p_ai_suggestion ->> 'severity';
    sugg_pri := p_ai_suggestion ->> 'priority';
    if sugg_sev in ('low', 'medium', 'high', 'critical') then
      sev := sugg_sev::public.severity;
    end if;
    if sugg_pri in ('low', 'normal', 'high', 'urgent') then
      pri := sugg_pri::public.priority;
    end if;
  end if;

  if p_duplicate_of is not null then
    select * into inc
    from public.incidents
    where id = p_duplicate_of and university_id = uni;
    if not found then
      raise exception 'duplicate incident not in your room';
    end if;
    insert into public.confirmations (incident_id, profile_id, note)
    values (inc.id, uid, 'Reported the same issue')
    on conflict (incident_id, profile_id) do nothing;
  else
    insert into public.incidents (
      university_id, category, severity, priority, title, status, location_tag, public_code, opened_at
    ) values (
      uni,
      p_category,
      sev,
      pri,
      trim(p_title),
      'submitted',
      nullif(trim(coalesce(p_location_tag, '')), ''),
      public.next_public_code(),
      now()
    )
    returning * into inc;

    insert into public.status_events (incident_id, from_status, to_status, actor_id, note)
    values (inc.id, null, 'submitted', uid, 'Received by Campulse');
  end if;

  insert into public.reports (
    university_id,
    incident_id,
    title,
    description,
    category,
    is_anonymous,
    author_id,
    ai_suggestion,
    status,
    public_code
  ) values (
    uni,
    inc.id,
    trim(p_title),
    trim(p_description),
    p_category,
    p_is_anonymous,
    case when p_is_anonymous then null else uid end,
    p_ai_suggestion,
    inc.status,
    public.next_public_code()
  )
  returning * into rep;

  insert into public.report_identities (report_id, profile_id)
  values (rep.id, uid);

  return rep;
end;
$$;

create or replace function public.attach_report_image(p_report_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1
    from public.report_identities
    where report_id = p_report_id and profile_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  update public.reports r
  set image_path = p_path
  where r.id = p_report_id
    and r.image_path is null
    and split_part(p_path, '/', 1) = r.university_id::text
    and split_part(p_path, '/', 2) = r.id::text;

  if not found then
    raise exception 'image path rejected';
  end if;
end;
$$;

create or replace function public.confirm_incident(p_incident_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uni uuid := public.my_university();
  uid uuid := auth.uid();
begin
  if uni is null or uid is null then
    raise exception 'not verified';
  end if;
  if not exists (
    select 1 from public.incidents where id = p_incident_id and university_id = uni
  ) then
    raise exception 'not found';
  end if;
  if exists (
    select 1
    from public.report_identities ri
    join public.reports r on r.id = ri.report_id
    where r.incident_id = p_incident_id and ri.profile_id = uid
  ) then
    raise exception 'you already reported this incident';
  end if;

  insert into public.confirmations (incident_id, profile_id, note)
  values (p_incident_id, uid, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (incident_id, profile_id) do update
    set note = coalesce(excluded.note, public.confirmations.note);
end;
$$;

create or replace function public.add_incident_note(p_incident_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uni uuid := public.my_university();
  body text := nullif(trim(coalesce(p_body, '')), '');
begin
  if uni is null then
    raise exception 'not verified';
  end if;
  if body is null or length(body) > 1000 then
    raise exception 'note must be 1-1000 characters';
  end if;
  if not exists (
    select 1 from public.incidents where id = p_incident_id and university_id = uni
  ) then
    raise exception 'not found';
  end if;
  insert into public.incident_notes (incident_id, profile_id, body)
  values (p_incident_id, auth.uid(), body);
end;
$$;

create or replace function public.record_fix_response(
  p_incident_id uuid,
  p_still_happening boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inc public.incidents;
  uni uuid := public.my_university();
  uid uuid := auth.uid();
  next_status public.report_status;
begin
  if uni is null or uid is null then
    raise exception 'not verified';
  end if;

  select * into inc
  from public.incidents
  where id = p_incident_id and university_id = uni
  for update;

  if not found then
    raise exception 'not found';
  end if;
  if inc.status <> 'resolved' then
    raise exception 'incident is not resolved';
  end if;

  insert into public.fix_checks (incident_id, profile_id, still_happening)
  values (p_incident_id, uid, p_still_happening)
  on conflict (incident_id, profile_id) do update
    set still_happening = excluded.still_happening,
        created_at = now();

  if p_still_happening then
    next_status := case
      when inc.verified_at is not null then 'verified'::public.report_status
      else 'under_review'::public.report_status
    end;

    update public.incidents
    set status = next_status,
        reopened_count = reopened_count + 1
    where id = p_incident_id;

    update public.reports
    set status = next_status
    where incident_id = p_incident_id;

    insert into public.status_events (incident_id, from_status, to_status, actor_id, note)
    values (
      p_incident_id,
      'resolved',
      next_status,
      uid,
      'Student reported it is still happening'
    );
  end if;
end;
$$;

create or replace function public.set_incident_status(
  p_incident_id uuid,
  p_to_status public.report_status,
  p_note text default null,
  p_severity public.severity default null,
  p_department text default null
) returns public.incidents
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  old public.incidents;
  updated public.incidents;
  note text := nullif(trim(coalesce(p_note, '')), '');
  dept text := nullif(trim(coalesce(p_department, '')), '');
  public_note text;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;

  select * into old
  from public.incidents
  where id = p_incident_id
  for update;

  if not found then
    raise exception 'not found';
  end if;
  if not public.is_uni_admin(old.university_id) then
    raise exception 'forbidden';
  end if;
  if p_to_status = 'rejected' and note is null then
    raise exception 'rejected status requires a reason';
  end if;
  if p_to_status = 'resolved' and note is null then
    raise exception 'resolved status requires a resolution note';
  end if;
  if dept is not null and length(dept) > 80 then
    raise exception 'department name is too long';
  end if;

  update public.incidents
  set status = p_to_status,
      severity = coalesce(p_severity, severity),
      assigned_department = coalesce(dept, assigned_department),
      acknowledged_at = case
        when acknowledged_at is null and status = 'submitted' and p_to_status <> 'submitted' then now()
        else acknowledged_at
      end,
      verified_at = case
        when verified_at is null and p_to_status in ('verified', 'in_progress', 'resolved') then now()
        else verified_at
      end,
      resolved_at = case
        when p_to_status = 'resolved' then now()
        else resolved_at
      end,
      reopened_count = case
        when status = 'resolved' and p_to_status not in ('resolved', 'rejected') then reopened_count + 1
        else reopened_count
      end
  where id = p_incident_id
  returning * into updated;

  public_note := case
    when p_to_status in ('resolved', 'rejected') then note
    when p_to_status = 'under_review' then 'Acknowledged by a Room admin'
    when p_to_status = 'verified' then 'An admin confirmed the issue'
    when p_to_status = 'in_progress' then 'The assigned team is acting on it'
    when p_to_status = 'submitted' then 'Returned to submitted'
    else null
  end;

  if old.status is distinct from p_to_status then
    insert into public.status_events (incident_id, from_status, to_status, actor_id, note)
    values (p_incident_id, old.status, p_to_status, actor, public_note);

    update public.reports
    set status = p_to_status
    where incident_id = p_incident_id;
  end if;

  insert into public.admin_audit (actor_id, university_id, action, target_id, meta)
  values (
    actor,
    old.university_id,
    'set_status',
    p_incident_id,
    jsonb_build_object(
      'from', old.status,
      'to', p_to_status,
      'note', note,
      'severity', coalesce(p_severity::text, old.severity::text),
      'department', coalesce(dept, old.assigned_department)
    )
  );

  if dept is not null and dept is distinct from old.assigned_department then
    insert into public.status_events (incident_id, from_status, to_status, actor_id, note)
    values (
      p_incident_id,
      updated.status,
      updated.status,
      actor,
      'Assigned to ' || dept
    );
    insert into public.admin_audit (actor_id, university_id, action, target_id, meta)
    values (
      actor,
      old.university_id,
      'assign',
      p_incident_id,
      jsonb_build_object('department', dept)
    );
  end if;

  return updated;
end;
$$;

create or replace function public.set_member_verification(
  p_profile_id uuid,
  p_status public.verification_status,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if actor = p_profile_id then
    raise exception 'you cannot change your own verification';
  end if;

  select * into target from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'not found';
  end if;
  if target.university_id is null or not public.is_uni_admin(target.university_id) then
    raise exception 'forbidden';
  end if;
  if p_status not in ('pending', 'verified', 'rejected') then
    raise exception 'unsupported status';
  end if;

  update public.profiles
  set verification_status = p_status,
      verification_method = case
        when p_status = 'verified' then 'manual'
        else verification_method
      end,
      verified_at = case
        when p_status = 'verified' then coalesce(verified_at, now())
        else verified_at
      end
  where id = p_profile_id;

  update public.join_requests
  set status = p_status
  where profile_id = p_profile_id and status = 'pending';

  insert into public.admin_audit (actor_id, university_id, action, target_id, meta)
  values (
    actor,
    target.university_id,
    'set_verification',
    p_profile_id,
    jsonb_build_object('status', p_status, 'note', nullif(trim(coalesce(p_note, '')), ''))
  );
end;
$$;

create or replace function public.request_manual_approval(
  p_matric text,
  p_id_photo_path text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  matric text := nullif(trim(coalesce(p_matric, '')), '');
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  perform set_config('campulse.allow_verification_write', '1', true);
  select * into prof from public.profiles where id = uid;
  if not found then
    raise exception 'profile missing';
  end if;
  if prof.verification_status = 'verified' then
    raise exception 'already in the room';
  end if;
  if matric is null or length(matric) > 40 then
    raise exception 'matric number is required';
  end if;

  update public.profiles
  set matric_number = matric,
      verification_status = 'pending'
  where id = uid;

  insert into public.join_requests (profile_id, university_id, matric_number, id_photo_path, status)
  values (uid, prof.university_id, matric, nullif(p_id_photo_path, ''), 'pending');
end;
$$;

create or replace function public.reveal_report_identity(p_report_id uuid)
returns table (profile_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  rep public.reports;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  select * into rep from public.reports where id = p_report_id;
  if not found then
    raise exception 'not found';
  end if;

  insert into public.admin_audit (actor_id, university_id, action, target_id, meta)
  values (
    auth.uid(),
    rep.university_id,
    'reveal_identity',
    p_report_id,
    jsonb_build_object('report_id', p_report_id)
  );

  return query
  select ri.profile_id, p.display_name
  from public.report_identities ri
  join public.profiles p on p.id = ri.profile_id
  where ri.report_id = p_report_id;
end;
$$;

create or replace function public.merge_incidents(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.incidents;
  target public.incidents;
  actor uuid := auth.uid();
begin
  if p_source = p_target then
    raise exception 'choose two different incidents';
  end if;
  select * into source from public.incidents where id = p_source for update;
  select * into target from public.incidents where id = p_target for update;
  if source.id is null or target.id is null then
    raise exception 'not found';
  end if;
  if source.university_id <> target.university_id then
    raise exception 'incidents are in different rooms';
  end if;
  if not public.is_uni_admin(source.university_id) then
    raise exception 'forbidden';
  end if;

  update public.reports
  set incident_id = target.id,
      status = target.status
  where incident_id = source.id;

  insert into public.confirmations (incident_id, profile_id, note, created_at)
  select target.id, c.profile_id, c.note, c.created_at
  from public.confirmations c
  where c.incident_id = source.id
  on conflict (incident_id, profile_id) do nothing;

  delete from public.confirmations where incident_id = source.id;

  update public.incident_notes set incident_id = target.id where incident_id = source.id;

  update public.incidents
  set status = 'rejected',
      resolved_at = coalesce(resolved_at, now())
  where id = source.id;

  insert into public.status_events (incident_id, from_status, to_status, actor_id, note)
  values (
    source.id,
    source.status,
    'rejected',
    actor,
    'Merged into ' || target.public_code
  );

  insert into public.admin_audit (actor_id, university_id, action, target_id, meta)
  values (
    actor,
    source.university_id,
    'merge',
    target.id,
    jsonb_build_object('source', source.id, 'target', target.id, 'source_code', source.public_code)
  );
end;
$$;

create or replace function public.match_open_incidents(p_query text)
returns table (
  id uuid,
  title text,
  category public.category,
  public_code text,
  similarity real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    i.id,
    i.title,
    i.category,
    i.public_code,
    similarity(i.title, left(coalesce(p_query, ''), 200)) as similarity
  from public.incidents i
  where i.university_id = public.my_university()
    and i.status not in ('resolved', 'rejected')
    and i.opened_at > now() - interval '30 days'
    and (
      similarity(i.title, left(coalesce(p_query, ''), 200)) > 0.12
      or i.title ilike '%' || left(coalesce(p_query, ''), 48) || '%'
    )
  order by similarity desc, i.opened_at desc
  limit 30
$$;

create or replace function public.save_pulse_snapshot(
  p_taken_on date,
  p_score int,
  p_band text,
  p_label text,
  p_components jsonb,
  p_includes_demo boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uni uuid := public.my_university();
begin
  if uni is null then
    raise exception 'not verified';
  end if;
  if p_label not in ('insufficient', 'provisional', 'calibrating') then
    raise exception 'unknown confidence label';
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'score out of range';
  end if;

  insert into public.pulse_snapshots (
    university_id, taken_on, score, band, label, components, includes_demo
  ) values (
    uni, p_taken_on, p_score, p_band, p_label, coalesce(p_components, '{}'::jsonb), p_includes_demo
  )
  on conflict (university_id, taken_on, includes_demo) do update
    set score = excluded.score,
        band = excluded.band,
        label = excluded.label,
        components = excluded.components;
end;
$$;

create or replace view public.pulse_inputs
with (security_invoker = true) as
select
  i.id,
  i.university_id,
  i.category::text as category,
  i.severity::text as severity,
  i.status::text as status,
  i.opened_at,
  i.acknowledged_at,
  i.verified_at,
  i.resolved_at,
  i.reopened_count,
  i.location_tag,
  i.is_demo,
  i.title,
  i.public_code,
  coalesce((
    select count(*)::int from public.confirmations c where c.incident_id = i.id
  ), 0) as confirmation_count,
  u.ack_target_hours,
  u.resolve_target_days
from public.incidents i
join public.universities u on u.id = i.university_id;

create or replace view public.incident_feed
with (security_invoker = true) as
select
  i.id,
  i.university_id,
  i.category::text as category,
  i.severity::text as severity,
  i.priority::text as priority,
  i.title,
  i.status::text as status,
  i.location_tag,
  i.assigned_department,
  i.public_code,
  i.opened_at,
  i.acknowledged_at,
  i.verified_at,
  i.resolved_at,
  i.reopened_count,
  i.is_demo,
  public.affected_count(i.id) as affected_count,
  (
    select r.description
    from public.reports r
    where r.incident_id = i.id
    order by r.created_at asc
    limit 1
  ) as description,
  (
    select r.is_anonymous
    from public.reports r
    where r.incident_id = i.id
    order by r.created_at asc
    limit 1
  ) as is_anonymous,
  (
    select r.id
    from public.reports r
    where r.incident_id = i.id
    order by r.created_at asc
    limit 1
  ) as primary_report_id,
  (
    select r.image_path
    from public.reports r
    where r.incident_id = i.id and r.image_path is not null
    order by r.created_at asc
    limit 1
  ) as image_path,
  (
    select r.ai_suggestion
    from public.reports r
    where r.incident_id = i.id and r.ai_suggestion is not null
    order by r.created_at asc
    limit 1
  ) as ai_suggestion,
  (
    select r.author_id
    from public.reports r
    where r.incident_id = i.id and r.is_anonymous = false
    order by r.created_at asc
    limit 1
  ) as author_id,
  (
    select count(*)::int from public.reports r where r.incident_id = i.id
  ) as report_count,
  (
    select count(*)::int from public.confirmations c where c.incident_id = i.id
  ) as confirmation_count
from public.incidents i;
