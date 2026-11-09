-- University isolation. Unverified callers get an empty room: my_university() is null for them.

alter table public.universities enable row level security;
alter table public.profiles enable row level security;
alter table public.incidents enable row level security;
alter table public.reports enable row level security;
alter table public.report_identities enable row level security;
alter table public.confirmations enable row level security;
alter table public.incident_notes enable row level security;
alter table public.fix_checks enable row level security;
alter table public.status_events enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_audit enable row level security;
alter table public.join_requests enable row level security;
alter table public.pulse_snapshots enable row level security;
alter table public.bootstrap_admins enable row level security;

alter table public.universities force row level security;
alter table public.profiles force row level security;
alter table public.incidents force row level security;
alter table public.reports force row level security;
alter table public.report_identities force row level security;
alter table public.confirmations force row level security;
alter table public.incident_notes force row level security;
alter table public.fix_checks force row level security;
alter table public.status_events force row level security;
alter table public.admin_roles force row level security;
alter table public.admin_audit force row level security;
alter table public.join_requests force row level security;
alter table public.pulse_snapshots force row level security;
alter table public.bootstrap_admins force row level security;

create policy universities_read on public.universities
  for select to anon, authenticated
  using (true);

create policy universities_write on public.universities
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_uni_admin(university_id)
    or (
      show_profile
      and verification_status = 'verified'
      and university_id = public.my_university()
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_uni_admin(university_id))
  with check (id = auth.uid() or public.is_uni_admin(university_id));

create policy incidents_select on public.incidents
  for select to authenticated
  using (
    university_id = public.my_university()
    or public.is_uni_admin(university_id)
  );

create policy reports_select on public.reports
  for select to authenticated
  using (
    university_id = public.my_university()
    or public.is_uni_admin(university_id)
  );

create policy reports_insert on public.reports
  for insert to authenticated
  with check (
    university_id = public.my_university()
    and (
      (is_anonymous and author_id is null)
      or (not is_anonymous and author_id = auth.uid())
    )
  );

create policy report_identities_select on public.report_identities
  for select to authenticated
  using (profile_id = auth.uid() or public.is_super_admin());

create policy confirmations_select on public.confirmations
  for select to authenticated
  using (
    exists (
      select 1 from public.incidents i
      where i.id = confirmations.incident_id
        and (
          i.university_id = public.my_university()
          or public.is_uni_admin(i.university_id)
        )
    )
  );

create policy confirmations_insert on public.confirmations
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.incidents i
      where i.id = incident_id and i.university_id = public.my_university()
    )
  );

create policy incident_notes_select on public.incident_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_notes.incident_id
        and (
          i.university_id = public.my_university()
          or public.is_uni_admin(i.university_id)
        )
    )
  );

create policy fix_checks_select on public.fix_checks
  for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.incidents i
      where i.id = fix_checks.incident_id
        and public.is_uni_admin(i.university_id)
    )
  );

create policy status_events_select on public.status_events
  for select to authenticated
  using (
    exists (
      select 1 from public.incidents i
      where i.id = status_events.incident_id
        and (
          i.university_id = public.my_university()
          or public.is_uni_admin(i.university_id)
        )
    )
  );

create policy admin_roles_select on public.admin_roles
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or public.is_uni_admin(university_id)
  );

create policy admin_audit_select on public.admin_audit
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_uni_admin(university_id)
  );

create policy join_requests_select on public.join_requests
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_uni_admin(university_id)
  );

create policy join_requests_insert on public.join_requests
  for insert to authenticated
  with check (profile_id = auth.uid() and status = 'pending');

create policy pulse_snapshots_select on public.pulse_snapshots
  for select to authenticated
  using (
    university_id = public.my_university()
    or public.is_uni_admin(university_id)
  );

grant usage on schema public to anon, authenticated, service_role;

grant select on public.universities to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.incidents to authenticated;
grant select, insert on public.reports to authenticated;
grant select on public.report_identities to authenticated;
grant select, insert on public.confirmations to authenticated;
grant select on public.incident_notes to authenticated;
grant select on public.fix_checks to authenticated;
grant select on public.status_events to authenticated;
grant select on public.admin_roles to authenticated;
grant select on public.admin_audit to authenticated;
grant select, insert on public.join_requests to authenticated;
grant select on public.pulse_snapshots to authenticated;
grant select on public.pulse_inputs to authenticated;
grant select on public.incident_feed to authenticated;

grant usage, select on sequence public.public_code_seq to authenticated;

grant execute on function public.my_university() to anon, authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_uni_admin(uuid) to authenticated;
grant execute on function public.affected_count(uuid) to authenticated;
grant execute on function public.verified_member_count() to authenticated;
grant execute on function public.submit_report(text, text, public.category, boolean, uuid, jsonb, text) to authenticated;
grant execute on function public.attach_report_image(uuid, text) to authenticated;
grant execute on function public.confirm_incident(uuid, text) to authenticated;
grant execute on function public.add_incident_note(uuid, text) to authenticated;
grant execute on function public.record_fix_response(uuid, boolean) to authenticated;
grant execute on function public.set_incident_status(uuid, public.report_status, text, public.severity, text) to authenticated;
grant execute on function public.set_member_verification(uuid, public.verification_status, text) to authenticated;
grant execute on function public.request_manual_approval(text, text) to authenticated;
grant execute on function public.reveal_report_identity(uuid) to authenticated;
grant execute on function public.merge_incidents(uuid, uuid) to authenticated;
grant execute on function public.match_open_incidents(text) to authenticated;
grant execute on function public.save_pulse_snapshot(date, int, text, text, jsonb, boolean) to authenticated;

revoke all on function public.handle_auth_user() from public;
revoke all on function public.next_public_code() from public;
grant execute on function public.next_public_code() to authenticated;

revoke all on function public.submit_report(text, text, public.category, boolean, uuid, jsonb, text) from public;
revoke all on function public.attach_report_image(uuid, text) from public;
revoke all on function public.confirm_incident(uuid, text) from public;
revoke all on function public.add_incident_note(uuid, text) from public;
revoke all on function public.record_fix_response(uuid, boolean) from public;
revoke all on function public.set_incident_status(uuid, public.report_status, text, public.severity, text) from public;
revoke all on function public.set_member_verification(uuid, public.verification_status, text) from public;
revoke all on function public.request_manual_approval(text, text) from public;
revoke all on function public.reveal_report_identity(uuid) from public;
revoke all on function public.merge_incidents(uuid, uuid) from public;
revoke all on function public.save_pulse_snapshot(date, int, text, text, jsonb, boolean) from public;

grant execute on function public.submit_report(text, text, public.category, boolean, uuid, jsonb, text) to authenticated;
grant execute on function public.attach_report_image(uuid, text) to authenticated;
grant execute on function public.confirm_incident(uuid, text) to authenticated;
grant execute on function public.add_incident_note(uuid, text) to authenticated;
grant execute on function public.record_fix_response(uuid, boolean) to authenticated;
grant execute on function public.set_incident_status(uuid, public.report_status, text, public.severity, text) to authenticated;
grant execute on function public.set_member_verification(uuid, public.verification_status, text) to authenticated;
grant execute on function public.request_manual_approval(text, text) to authenticated;
grant execute on function public.reveal_report_identity(uuid) to authenticated;
grant execute on function public.merge_incidents(uuid, uuid) to authenticated;
grant execute on function public.save_pulse_snapshot(date, int, text, text, jsonb, boolean) to authenticated;
