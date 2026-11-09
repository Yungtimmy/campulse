import Link from "next/link";
import { DemoChip } from "@/components/chrome";
import { IconBuilding, IconClock, IconFile, IconInbox, IconPulse, IconUserCheck } from "@/components/icons";
import { HIDDEN_ADMIN_PATH } from "@/lib/admin-gate";
import { requireAdmin } from "@/lib/guard";
import { roomPill } from "@/lib/labels";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = await requireAdmin(slug);
  const base = `${HIDDEN_ADMIN_PATH}/${slug}`;

  const [{ count: openCount }, { count: pendingCount }] = await Promise.all([
    admin.supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("university_id", admin.uni.id)
      .in("status", ["submitted", "under_review", "verified", "in_progress"]),
    admin.supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("university_id", admin.uni.id)
      .eq("verification_status", "pending"),
  ]);
  const demoAccount = admin.session.user?.email?.endsWith("@campulse.demo") ?? false;

  return (
    <div className="admin">
      <aside className="side" aria-label="Admin navigation">
        <div className="brand">
          <Link className="wordmark" href={`/room/${slug}`} style={{ fontSize: 20 }}>
            Campulse
          </Link>
          <span className="room-pill sm">{slug === "funaab" ? "FUNAAB" : roomPill(slug, admin.uni.name)}</span>
        </div>
        <Link className="nav" href={base}>
          <IconInbox />
          Report queue
          <span className="c">{openCount ?? 0}</span>
        </Link>
        <Link className="nav" href={`/room/${slug}/pulse`}>
          <IconPulse />
          Campus Pulse
        </Link>
        <a className="nav" href={`${base}#briefing`}>
          <IconFile />
          Campus briefing
        </a>
        <div className="sec">Admin</div>
        <Link className="nav" href={`${base}/verifications`}>
          <IconUserCheck />
          Verifications
          <span className="c">{pendingCount ?? 0}</span>
        </Link>
        <Link className="nav" href={`${base}/departments`}>
          <IconBuilding />
          Departments
        </Link>
        <Link className="nav" href={`${base}/activity`}>
          <IconClock />
          Activity log
        </Link>
        <div className="who">
          <b>{admin.session.profile?.display_name ?? "Room admin"}</b>
          <span className="cap">University administrator · {slug === "funaab" ? "FUNAAB" : admin.uni.name}</span>
          {demoAccount ? (
            <div style={{ marginTop: 8 }}>
              <DemoChip>Demo account</DemoChip>
            </div>
          ) : null}
        </div>
      </aside>
      {children}
    </div>
  );
}
