-- Private evidence and identity buckets.
-- Evidence path: {university_id}/{report_id}/{file}
-- Identity path: {university_id}/{profile_id}/{file}

insert into storage.buckets (id, name, public)
values
  ('evidence', 'evidence', false),
  ('identity-docs', 'identity-docs', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'objects'
      and column_name = 'owner_id'
  ) then
    execute 'alter table storage.objects force row level security';
  end if;
end $$;

drop policy if exists evidence_select on storage.objects;
create policy evidence_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and (
      (storage.foldername(name))[1] = public.my_university()::text
      or public.is_uni_admin(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists evidence_insert on storage.objects;
create policy evidence_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.my_university()::text
  );

drop policy if exists identity_select on storage.objects;
create policy identity_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'identity-docs'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_uni_admin(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists identity_insert on storage.objects;
create policy identity_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'identity-docs'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (storage.foldername(name))[1] = (
      select p.university_id::text from public.profiles p where p.id = auth.uid()
    )
  );

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant select, insert on storage.objects to authenticated, service_role;
