import Link from "next/link";
import { CategoryAvatar, RoomFrame, StatusPill } from "@/components/chrome";
import { requireRoom } from "@/lib/guard";
import type { FeedIncident } from "@/lib/types";

export default async function MinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await requireRoom(slug);
  if (!room.ok) return room.view;

  const { data: identities } = await room.supabase.from("report_identities").select("report_id").eq("profile_id", room.session.user!.id);
  const reportIds = (identities ?? []).map((row) => row.report_id as string);
  let incidents: FeedIncident[] = [];
  if (reportIds.length > 0) {
    const { data: reports } = await room.supabase.from("reports").select("incident_id").in("id", reportIds);
    const incidentIds = [...new Set((reports ?? []).map((row) => row.incident_id as string))];
    if (incidentIds.length > 0) {
      const { data } = await room.supabase.from("incident_feed").select("*").in("id", incidentIds).order("opened_at", { ascending: false });
      incidents = (data ?? []) as FeedIncident[];
    }
  }

  return (
    <RoomFrame slug={slug} name={room.uni.name} active="room" showAdmin={room.showAdmin} back={{ href: `/room/${slug}`, label: "Room" }}>
      <section className="page-head">
        <h1>My reports</h1>
        <p>Includes anonymous reports you filed. Other students still cannot see your name on those.</p>
      </section>
      <section className="card" style={{ marginTop: 24 }}>
        {incidents.length === 0 ? (
          <p className="hint">You have not filed a report in this Room yet.</p>
        ) : (
          <div className="rlist">
            {incidents.map((incident) => (
              <Link className="rrow" key={incident.id} href={`/room/${slug}/report/${incident.id}`}>
                <CategoryAvatar category={incident.category} />
                <div>
                  <div className="rt">{incident.title}</div>
                  <div className="rmeta">
                    <StatusPill status={incident.status} />
                    <span className="mono">{incident.public_code}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </RoomFrame>
  );
}
