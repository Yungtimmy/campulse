import { CategoryIcon, IconInfo, IconShieldCheck } from "@/components/icons";
import { BandName, ConfidenceTag, DemoChip, PulseGauge, RoomFrame } from "@/components/chrome";
import { pulseDelta } from "@/lib/data";
import { includeDemoPulse } from "@/lib/env";
import { roomFacts } from "@/lib/facts";
import { requireRoom } from "@/lib/guard";
import { BAND_LABEL, COMPONENT_COPY, formatDay, formatPoints, formatWhen } from "@/lib/labels";
import { loadFeed } from "@/lib/data";
import { loadPulse } from "@/lib/pulse-load";
import type { Band } from "@/lib/pulse";

const BANDS: Array<{ id: Band; range: string }> = [
  { id: "healthy", range: "0–20" },
  { id: "moderate", range: "21–40" },
  { id: "elevated", range: "41–60" },
  { id: "critical", range: "61–80" },
  { id: "emergency", range: "81–100" },
];

export default async function PulsePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await requireRoom(slug);
  if (!room.ok) return room.view;
  const includeDemo = includeDemoPulse();
  const incidents = await loadFeed(room.supabase, room.uni.id);
  const { result, snapshots } = await loadPulse(room.supabase, room.uni.id, includeDemo);
  const counted = includeDemo ? incidents : incidents.filter((incident) => !incident.is_demo);
  const facts = roomFacts(counted, result, {
    ackTargetHours: room.uni.ack_target_hours,
    resolveTargetDays: room.uni.resolve_target_days,
  });
  const delta = pulseDelta(result.score, snapshots);
  const maxCategory = facts.openByCategory[0]?.count ?? 1;

  return (
    <RoomFrame slug={slug} name={room.uni.name} active="pulse" back={{ href: `/room/${slug}`, label: "Room" }}>
      <section className="page-head">
        <h1>Campus Pulse</h1>
        <p>
          {slug === "funaab" ? "FUNAAB Room" : room.uni.name} · last 90 days · updated {formatWhen(new Date())}
        </p>
      </section>
      <div className="stack">
        <section className="card">
          <div style={{ position: "relative", maxWidth: 248, margin: "8px auto 0" }}>
            <PulseGauge result={result} stroke={6} />
            <div className="gauge-read" style={{ position: "absolute", left: 0, right: 0, top: 64, alignItems: "center" }}>
              <span className="gauge-num" style={{ fontSize: 72 }}>{result.score ?? "–"}</span>
              <BandName band={result.band} />
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--cp-ink-2)", marginTop: 8 }}>
            0 healthy → 100 emergency. Higher means more unresolved problems.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <ConfidenceTag label={result.label} />
            {result.includesDemo ? <DemoChip>Includes demo data</DemoChip> : null}
          </div>
          <div className="scale" aria-label="Score bands">
            {BANDS.map((band) => (
              <div key={band.id} className={result.band === band.id ? `on ${band.id}` : undefined}>
                <i />
                {BAND_LABEL[band.id]}
                <br />
                <span className="tnum">{band.range}</span>
              </div>
            ))}
            {result.score !== null ? <span className="mk" style={{ left: `calc(${result.score}% - 1px)` }} /> : null}
          </div>
          <div className="hair" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cp-ink-2)" }}>
                <span className="sw" style={{ width: 10, height: 10, borderRadius: 3, background: "var(--cp-blue)" }} />
                Campus conditions
              </div>
              <div className="tnum" style={{ fontWeight: 600, fontSize: 22, color: "var(--cp-ink)", marginTop: 4 }}>{formatPoints(result.conditions)}</div>
              <div className="cap">Burden + recurring</div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--cp-ink-2)" }}>
                <span className="sw" style={{ width: 10, height: 10, borderRadius: 3, background: "var(--cp-amber)" }} />
                Admin response
              </div>
              <div className="tnum" style={{ fontWeight: 600, fontSize: 22, color: "var(--cp-ink)", marginTop: 4 }}>{formatPoints(result.response)}</div>
              <div className="cap">Resolution + response delay</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <h2>Components</h2>
            <span className="cap">Score out of 100 each</span>
          </div>
          {result.components.map((component) => {
            const copy = COMPONENT_COPY[component.key];
            const color = copy.tone === "conditions" ? "var(--cp-blue)" : "var(--cp-amber)";
            return (
              <div className="comp" key={component.key}>
                <div className="nm">
                  <span className="sw" style={{ background: color }} />
                  {copy.name}
                </div>
                <div className="val">
                  {component.value === null ? "–" : Math.round(component.value)}
                  <small> /100</small>
                </div>
                <div className="ms">{copy.measures}</div>
                <div className="ct">{component.contribution === null ? "left out" : `adds ${formatPoints(component.contribution)}`}</div>
                <div className="b">
                  <i style={{ width: `${Math.max(0, Math.min(100, component.value ?? 0))}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Last 30 days</h2>
            {delta ? <span className="cap tnum">{delta}</span> : <span className="cap">Daily snapshot</span>}
          </div>
          <Trend snapshots={snapshots} />
          <p className="cap" style={{ marginTop: 8 }}>
            Daily snapshot. {result.includesDemo ? "Includes demo data." : "Demo incidents are excluded unless PULSE_INCLUDE_DEMO is on."}
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Open incidents by category</h2>
            <span className="cap tnum">{facts.openIncidents} total</span>
          </div>
          {facts.openByCategory.length === 0 ? (
            <p className="hint">No open incidents are counted right now.</p>
          ) : (
            <ul className="bars">
              {facts.openByCategory.map((row, index) => (
                <li key={row.category} className={index === 0 ? "lead" : undefined}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CategoryIcon category={row.category} small />
                    {row.label}
                  </span>
                  <span className="n">{row.count}</span>
                  <span className="b"><i style={{ width: `${Math.round((row.count / maxCategory) * 100)}%` }} /></span>
                </li>
              ))}
            </ul>
          )}
          <p className="cap" style={{ marginTop: 12 }}>Duplicate reports are grouped into one incident, so they don&apos;t add to the count.</p>
        </section>

        <section className="card">
          <h2>How it&apos;s calculated</h2>
          <p className="hint" style={{ marginTop: 8 }}>A fixed formula, the same every day. AI helps sort reports but never sets the score.</p>
          <div className="formula" style={{ marginTop: 12 }}>{`Pulse = round(0.40·B + 0.25·F
             + 0.15·D + 0.20·R)

B  burden: min(100, 10 × Σ severity
   × confidence)
F  % verified, unresolved after 7 days
D  % not acknowledged within 48 hours
R  % resolved that return within 30 days

${result.score === null ? "No score yet. Not enough counted incidents or verified students." : `${result.score} = round(${result.components.map((item) => formatPoints(item.contribution)).filter((item) => item !== "–").join(" + ")})`}`}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <div className="notice">
              <IconShieldCheck />
              <span>Only verified incidents count fully. Unverified ones count at half weight once 3 or more students confirm them.</span>
            </div>
            <div className="notice">
              <IconInfo />
              <span>Weights and thresholds are pilot assumptions, to be calibrated with real verified data. There is no ranking between universities.</span>
            </div>
          </div>
        </section>

        {result.label !== "insufficient" ? (
          <section className="card" aria-label="Low data state">
            <div className="card-head" style={{ marginBottom: 8 }}>
              <h2>When data is thin</h2>
              <span className="cap">Rule</span>
            </div>
            <p className="hint">
              No score is shown until at least 5 incidents count and 20 students are verified. Components stay listed. With thinner data the score shows as Provisional.
            </p>
          </section>
        ) : (
          <section className="card">
            <h2>Insufficient data</h2>
            <p className="hint" style={{ marginTop: 8 }}>
              No score is shown until at least 5 incidents count and 20 students are verified. Components stay listed. With thinner data the score shows as Provisional.
            </p>
          </section>
        )}
      </div>
    </RoomFrame>
  );
}

function Trend({ snapshots }: { snapshots: Array<{ taken_on: string; score: number | null }> }) {
  const points = snapshots.filter((snapshot) => snapshot.score !== null);
  if (points.length < 2) {
    return <p className="hint">The line appears after a second daily snapshot.</p>;
  }
  const width = 290;
  const height = 110;
  const min = 0;
  const max = 100;
  const coords = points.map((point, index) => {
    const x = 28 + (index / (points.length - 1)) * width;
    const y = 8 + ((max - (point.score ?? 0)) / (max - min)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <svg viewBox="0 0 326 140" width="100%" role="img" aria-label="Pulse over recent snapshots">
      <line x1="28" x2="318" y1="8" y2="8" stroke="rgba(18,17,22,.08)" />
      <text x="22" y="11" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#6c6a72">100</text>
      <line x1="28" x2="318" y1="63" y2="63" stroke="rgba(18,17,22,.08)" />
      <text x="22" y="66" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#6c6a72">50</text>
      <line x1="28" x2="318" y1="118" y2="118" stroke="rgba(18,17,22,.08)" />
      <text x="22" y="121" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#6c6a72">0</text>
      <polyline points={coords.join(" ")} fill="none" stroke="var(--cp-indigo)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <text x="28" y="134" textAnchor="start" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#6c6a72">{formatDay(first.taken_on)}</text>
      <text x="318" y="134" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#6c6a72">{formatDay(last.taken_on)}</text>
    </svg>
  );
}
