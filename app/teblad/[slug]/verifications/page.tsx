import Link from "next/link";
import { CollegeDepartmentFilters } from "@/components/college-department-filters";
import { approveMember, revokeMember } from "@/lib/actions";
import { HIDDEN_ADMIN_PATH } from "@/lib/admin-gate";
import { departmentsFor } from "@/lib/campus";
import { requireAdmin } from "@/lib/guard";
import type { Profile } from "@/lib/types";

export default async function VerificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const admin = await requireAdmin(slug);
  const { data } = await admin.supabase
    .from("profiles")
    .select("id, display_name, verification_status, verification_method, matric_number, faculty, department, level, created_at")
    .eq("university_id", admin.uni.id)
    .order("created_at", { ascending: false });
  const profiles = ((data ?? []) as unknown as Profile[]).filter((profile) => matchesCollege(profile, query));
  const waiting = profiles.filter((profile) => profile.verification_status !== "verified");
  const members = profiles.filter((profile) => profile.verification_status === "verified");
  const base = `${HIDDEN_ADMIN_PATH}/${slug}/verifications`;
  const narrowed = Boolean(query.faculty);

  return (
    <main className="main">
      <div className="mhead">
        <div>
          <h1>Verifications</h1>
          <p>A Google account and a short profile join this Room. Approve or revoke here when access needs a human decision.</p>
        </div>
      </div>
      <form className="filters" action={base}>
        <CollegeDepartmentFilters faculty={query.faculty ?? ""} department={query.department ?? ""} />
        <button className="link-btn clear" type="submit">Apply</button>
        <Link className="clear" href={base}>Clear</Link>
      </form>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>Waiting or revoked</h2>
        {waiting.length === 0 ? (
          <p className="hint" style={{ marginTop: 8 }}>
            {narrowed ? "No one in this college is waiting." : "No one is waiting."}
          </p>
        ) : null}
        <MemberList profiles={waiting} mode="waiting" />
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Members</h2>
        <p className="hint" style={{ marginTop: 8 }}>Revoke hides the Room from that account. You cannot change your own row.</p>
        {members.length === 0 && narrowed ? <p className="hint">No members in this college.</p> : null}
        <MemberList profiles={members} mode="members" selfId={admin.session.user?.id} />
      </section>
    </main>
  );
}

function matchesCollege(profile: Profile, query: Record<string, string | undefined>) {
  const faculty = query.faculty ?? "";
  if (!faculty) return true;
  if (profile.faculty !== faculty) return false;
  const department = query.department ?? "";
  if (!department) return true;
  if (!(departmentsFor(faculty) as readonly string[]).includes(department)) return true;
  return profile.department === department;
}

function MemberList({
  profiles,
  mode,
  selfId,
}: {
  profiles: Profile[];
  mode: "waiting" | "members";
  selfId?: string;
}) {
  return (
    <div className="rlist">
      {profiles.map((profile) => (
        <div className="rrow" key={profile.id} style={{ alignItems: "center", gridTemplateColumns: "1fr auto" }}>
          <div>
            <div className="rt">{profile.display_name ?? "Student"}</div>
            <div className="rmeta">
              <span>{profile.verification_status}</span>
              {profile.faculty ? <span>{profile.faculty}</span> : null}
              {profile.department ? <span>{profile.department}</span> : null}
              {profile.level ? <span>Level {profile.level}</span> : null}
              {profile.matric_number ? <span>Matric {profile.matric_number}</span> : null}
              {profile.verification_method ? <span>{profile.verification_method}</span> : null}
            </div>
          </div>
          {profile.id === selfId ? null : mode === "waiting" ? (
            <form action={approveMember.bind(null, profile.id)}>
              <button className="btn btn-sm btn-outline" type="submit">Approve</button>
            </form>
          ) : (
            <form action={revokeMember.bind(null, profile.id)}>
              <button className="btn btn-sm btn-quiet" type="submit">Revoke</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
