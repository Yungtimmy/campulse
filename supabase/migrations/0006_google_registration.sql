-- Google sign-in and first-time registration (Nov 9, 2026).
-- A Google account gets a FUNAAB profile immediately. The Room stays closed
-- until they save faculty, department, and level. That save marks them
-- registered and approved. An admin can still revoke.
-- Does not create or alter anything in the storage schema.

alter table public.profiles add column if not exists faculty text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists level text;
alter table public.profiles add column if not exists registered_at timestamptz;

alter table public.profiles drop constraint if exists profiles_method_chk;
alter table public.profiles add constraint profiles_method_chk check (
  verification_method is null or verification_method in ('email_otp', 'manual', 'google')
);

alter table public.profiles drop constraint if exists profiles_level_chk;
alter table public.profiles add constraint profiles_level_chk check (
  level is null or level in ('100', '200', '300', '400', '500', 'Postgraduate')
);

alter table public.profiles drop constraint if exists profiles_faculty_len_chk;
alter table public.profiles add constraint profiles_faculty_len_chk check (
  faculty is null or char_length(faculty) between 1 and 120
);

alter table public.profiles drop constraint if exists profiles_department_len_chk;
alter table public.profiles add constraint profiles_department_len_chk check (
  department is null or char_length(department) between 1 and 120
);

alter table public.profiles drop constraint if exists profiles_matric_len_chk;
alter table public.profiles add constraint profiles_matric_len_chk check (
  matric_number is null or char_length(matric_number) <= 40
);

-- People already approved (demo seed, earlier OTP) are registered.
update public.profiles
set registered_at = coalesce(registered_at, verified_at, created_at)
where verification_status = 'verified'
  and registered_at is null;

create or replace function public.grant_bootstrap_admin(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_profile
      and verification_status = 'verified'
  ) then
    return;
  end if;

  insert into public.admin_roles (profile_id, university_id, role)
  select p_profile, u.id, b.role
  from public.bootstrap_admins b
  join public.universities u on u.slug = b.university_slug
  join auth.users au on au.id = p_profile
  where lower(b.email) = lower(coalesce(au.email, ''))
    and not exists (
      select 1
      from public.admin_roles ar
      where ar.profile_id = p_profile
        and ar.role = b.role
        and ar.university_id is not distinct from u.id
    );
end;
$$;

create or replace function public.grant_admin_on_verify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'verified'
     and old.verification_status is distinct from 'verified' then
    perform public.grant_bootstrap_admin(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_grant_admin on public.profiles;
create trigger profiles_grant_admin
  after update on public.profiles
  for each row execute function public.grant_admin_on_verify();

-- A student may change registration fields only. Status, method, and
-- registered_at stay put unless this trigger is completing their own form,
-- or an admin function has set campulse.allow_verification_write.
create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  completing boolean := false;
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
    new.registered_at := old.registered_at;

    completing := old.verification_status = 'pending'
      and old.registered_at is null
      and auth.uid() = old.id
      and nullif(trim(coalesce(new.display_name, '')), '') is not null
      and char_length(trim(new.display_name)) between 2 and 80
      and nullif(trim(coalesce(new.faculty, '')), '') is not null
      and char_length(trim(new.faculty)) between 1 and 120
      and nullif(trim(coalesce(new.department, '')), '') is not null
      and char_length(trim(new.department)) between 1 and 120
      and new.level in ('100', '200', '300', '400', '500', 'Postgraduate')
      and (new.matric_number is null or char_length(trim(new.matric_number)) <= 40);

    if completing then
      new.display_name := trim(new.display_name);
      new.faculty := trim(new.faculty);
      new.department := trim(new.department);
      new.level := trim(new.level);
      new.matric_number := nullif(trim(coalesce(new.matric_number, '')), '');
      new.registered_at := now();
      new.verification_status := 'verified';
      new.verification_method := 'google';
      new.verified_at := coalesce(old.verified_at, now());
      if new.university_id is null then
        select id into new.university_id from public.universities where slug = 'funaab';
      end if;
    end if;
  end if;

  return new;
end;
$$;

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
  is_google boolean;
  full_name text;
  avatar text;
begin
  perform set_config('campulse.allow_verification_write', '1', true);
  is_google := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google'
    or coalesce(new.raw_user_meta_data ->> 'provider', '') = 'google'
    or (coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google');

  if is_google then
    uni_slug := 'funaab';
  else
    uni_slug := coalesce(new.raw_user_meta_data ->> 'university_slug', 'funaab');
  end if;

  select id into uni from public.universities u where u.slug = uni_slug;
  if uni is null then
    select id into uni from public.universities where slug = 'funaab';
  end if;

  full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'student'), '@', 1)
  );
  avatar := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'picture'), '')
  );
  confirmed := new.email_confirmed_at is not null;

  if is_google then
    -- Google confirms the email, but the Room opens only after registration.
    insert into public.profiles (
      id,
      university_id,
      display_name,
      avatar_url,
      verification_status,
      verification_method,
      verified_at,
      registered_at
    ) values (
      new.id,
      uni,
      full_name,
      avatar,
      'pending',
      'google',
      null,
      null
    )
    on conflict (id) do update
      set avatar_url = coalesce(profiles.avatar_url, excluded.avatar_url),
          display_name = case
            when profiles.registered_at is null then coalesce(excluded.display_name, profiles.display_name)
            else profiles.display_name
          end,
          university_id = coalesce(profiles.university_id, excluded.university_id);
  else
    insert into public.profiles (
      id,
      university_id,
      display_name,
      avatar_url,
      verification_status,
      verification_method,
      verified_at,
      registered_at
    ) values (
      new.id,
      uni,
      full_name,
      avatar,
      case when confirmed then 'verified'::public.verification_status else 'pending'::public.verification_status end,
      'email_otp',
      case when confirmed then now() else null end,
      case when confirmed then now() else null end
    )
    on conflict (id) do update
      set verification_status = case
            when profiles.verification_status = 'rejected' then profiles.verification_status
            when confirmed and profiles.verification_status = 'pending' then 'verified'::public.verification_status
            else profiles.verification_status
          end,
          verification_method = case
            when profiles.verification_method = 'google' then profiles.verification_method
            when confirmed and profiles.verification_status = 'pending' then 'email_otp'
            else profiles.verification_method
          end,
          verified_at = case
            when confirmed and profiles.verification_status = 'pending' then coalesce(profiles.verified_at, now())
            else profiles.verified_at
          end,
          registered_at = case
            when profiles.verification_status = 'rejected' then profiles.registered_at
            when confirmed and profiles.verification_status = 'pending' then coalesce(profiles.registered_at, now())
            else profiles.registered_at
          end,
          university_id = coalesce(profiles.university_id, excluded.university_id),
          display_name = coalesce(profiles.display_name, excluded.display_name),
          avatar_url = coalesce(profiles.avatar_url, excluded.avatar_url);
  end if;

  perform public.grant_bootstrap_admin(new.id);
  -- The flag is transaction-local. Clear it so a later statement in the same
  -- transaction cannot skip the registration lock.
  perform set_config('campulse.allow_verification_write', '', true);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();

drop trigger if exists on_auth_user_confirmed on auth.users;
drop trigger if exists on_auth_user_touched on auth.users;
create trigger on_auth_user_touched
  after update on auth.users
  for each row execute function public.handle_auth_user();

-- Column privileges are the gate. RLS still limits the update to the owner's row.
revoke update on public.profiles from authenticated;
grant update (
  display_name,
  faculty,
  department,
  level,
  matric_number,
  avatar_url,
  show_profile
) on public.profiles to authenticated;

revoke all on function public.grant_bootstrap_admin(uuid) from public;
revoke all on function public.grant_admin_on_verify() from public;
revoke all on function public.handle_auth_user() from public;
