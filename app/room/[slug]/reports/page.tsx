import Link from "next/link";
import { CategoryAvatar, RoomFrame, StatusPill } from "@/components/chrome";
import { loadFeed } from "@/lib/data";
import { requireRoom } from "@/lib/guard";
import { CATEGORY_LABEL } from "@/lib/labels";

export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await requireRoom(slug);
  if (!room.ok) return room.view;
  const incidents = await loadFeed(room.supabase, room.uni.id);

  return (
    <RoomFrame slug={slug} name={room.uni.name} active="room" showAdmin={room.showAdmin} back={{ href: `/room/${slug}`, label: "Room" }}>
      <section className="page-head">
        <h1>Reports</h1>
        <p>{incidents.length} incident{incidents.length === 1 ? "" : "s"} in the {room.uni.name} Room. Duplicates are grouped.</p>
      </section>
      <section className="card" style={{ marginTop: 24 }}>
        {incidents.length === 0 ? (
          <p className="hint">No reports yet. The first one opens an incident.</p>
        ) : (
          <div className="rlist">
            {incidents.map((incident) => (
              <Link className="rrow" key={incident.id} href={`/room/${slug}/report/${incident.id}`}>
                <CategoryAvatar category={incident.category} />
                <div>
                  <div className="rt">{incident.title}</div>
                  <div className="rmeta">
                    <StatusPill status={incident.status} />
                    <span>{CATEGORY_LABEL[incident.category] ?? incident.category}</span>
                    <span>{incident.affected_count} affected</span>
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
