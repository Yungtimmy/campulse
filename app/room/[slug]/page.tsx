import Link from "next/link";
import {
  BandName,
  CategoryAvatar,
  ConfidenceTag,
  MyReportsButton,
  PulseGauge,
  RoomFrame,
  StatusPill,
} from "@/components/chrome";
import { IconEyeOff, IconScan, IconUserCheck } from "@/components/icons";
import { loadFeed } from "@/lib/data";
import { requireRoom } from "@/lib/guard";
import { loadPulse } from "@/lib/pulse-load";

export default async function RoomHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await requireRoom(slug);
  if (!room.ok) return room.view;

  const incidents = await loadFeed(room.supabase, room.uni.id);
  const { result } = await loadPulse(room.supabase, room.uni.id);
  const recent = incidents.slice(0, 3);

  return (
    <RoomFrame slug={slug} name={room.uni.name} active="room" showAdmin={room.showAdmin}>
      <section className="hero">
        <h1>
          Your Campus.
          <br />
          Your Voice.
          <br />
          Real Solutions.
        </h1>
        <p className="lede">Report campus issues and track how they&apos;re resolved.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href={`/room/${slug}/report/new`}>
            Report an issue
          </Link>
          <Link className="btn btn-outline" href={`/room/${slug}/pulse`}>
            View Campus Pulse
          </Link>
          <MyReportsButton href={`/room/${slug}/mine`} />
        </div>
      </section>

      <div className="stack rise">
        <Link className="card" href={`/room/${slug}/pulse`} style={{ display: "block", color: "inherit", textDecoration: "none" }} aria-label="Open Campus Pulse breakdown">
          <div className="pulse-mini">
            <div className="g-wrap">
              <PulseGauge result={result} />
              <div className="gauge-read">
                <span className="gauge-num">{result.score ?? "–"}</span>
                <BandName band={result.band} />
              </div>
            </div>
            <div>
              <div className="cap" style={{ marginBottom: 8 }}>Component weights</div>
              <div className="comp-grid">
                <div><span>Severity</span><b>40%</b></div>
                <div><span>Resolution</span><b>25%</b></div>
                <div><span>Response</span><b>15%</b></div>
                <div><span>Recurring</span><b>20%</b></div>
              </div>
            </div>
          </div>
          <div className="pulse-foot">
            <span className="cap">0 healthy · 100 emergency · higher is worse</span>
            <ConfidenceTag label={result.label} />
          </div>
        </Link>

        <section className="card" aria-label="How the Room works">
          <ul className="trust">
            <li>
              <span className="ico"><IconUserCheck /></span>
              <div>
                <b>Verified students only</b>
                <span>Email check before you join</span>
              </div>
            </li>
            <li>
              <span className="ico"><IconEyeOff /></span>
              <div>
                <b>Anonymous reporting</b>
                <span>Your name stays hidden from students and routine admin views</span>
              </div>
            </li>
            <li>
              <span className="ico"><IconScan /></span>
              <div>
                <b>AI classification</b>
                <span>Suggests category and severity. Admins confirm.</span>
              </div>
            </li>
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Recent reports</h2>
            <Link href={`/room/${slug}/reports`}>All reports</Link>
          </div>
          {recent.length === 0 ? (
            <p className="hint">No reports yet.</p>
          ) : (
            <div className="rlist">
              {recent.map((incident) => (
                <Link className="rrow" key={incident.id} href={`/room/${slug}/report/${incident.id}`}>
                  <CategoryAvatar category={incident.category} />
                  <div>
                    <div className="rt">{incident.title}</div>
                    <div className="rmeta">
                      <StatusPill status={incident.status} />
                      <span>{incident.affected_count} affected</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </RoomFrame>
  );
}
