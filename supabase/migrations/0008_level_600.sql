-- Doctor of Veterinary Medicine (COLVET) runs through 600 level.
-- Postgraduate stays in the check so an earlier profile row remains valid.

alter table public.profiles drop constraint if exists profiles_level_chk;
alter table public.profiles add constraint profiles_level_chk check (
  level is null or level in ('100', '200', '300', '400', '500', '600', 'Postgraduate')
);

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
      and new.level in ('100', '200', '300', '400', '500', '600', 'Postgraduate')
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
