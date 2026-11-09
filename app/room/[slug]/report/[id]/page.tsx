import { CategoryIcon, IconCheck, IconScan } from "@/components/icons";
import { RoomFrame, StatusPill } from "@/components/chrome";
import { loadEvents, loadIncident } from "@/lib/data";
import { requireRoom } from "@/lib/guard";
import { CATEGORY_LABEL, formatWhen, STATUS_LABEL } from "@/lib/labels";
import type { AiSuggestion, StatusEvent } from "@/lib/types";
import { DetailActions } from "./detail-actions";

const STEPS = [
  { status: "submitted", hint: "Received by Campulse" },
  { status: "under_review", hint: "A Room admin has acknowledged it" },
  { status: "verified", hint: "An admin confirms the issue and assigns a department" },
  { status: "in_progress", hint: "The assigned team is acting on it" },
  { status: "resolved", hint: "Reported fixed, with a resolution note. You'll be asked to confirm." },
] as const;

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const room = await requireRoom(slug);
  if (!room.ok) return room.view;
  const incident = await loadIncident(room.supabase, id);
  if (!incident || incident.university_id !== room.uni.id) {
    return (
      <RoomFrame slug={slug} name={room.uni.name} active="room" showAdmin={room.showAdmin} back={{ href: `/room/${slug}`, label: "Room" }}>
        <section className="page-head">
          <h1>Report not found</h1>
          <p>It may belong to another Room, or it is no longer available.</p>
        </section>
      </RoomFrame>
    );
  }

  const events = await loadEvents(room.supabase, incident.id);
  const { data: notes } = await room.supabase
    .from("incident_notes")
    .select("id, body, created_at")
    .eq("incident_id", incident.id)
    .order("created_at", { ascending: true });
  const userId = room.session.user!.id;
  const { data: ownIdentities } = await room.supabase.from("report_identities").select("report_id");
  const ownReportIds = new Set((ownIdentities ?? []).map((row) => row.report_id as string));
  const { data: incidentReports } = await room.supabase.from("reports").select("id").eq("incident_id", incident.id);
  const alreadyReported = (incidentReports ?? []).some((row) => ownReportIds.has(row.id as string));
  const { data: confirmation } = await room.supabase
    .from("confirmations")
    .select("id")
    .eq("incident_id", incident.id)
    .eq("profile_id", userId)
    .maybeSingle();
  const { data: fix } = await room.supabase
    .from("fix_checks")
    .select("still_happening")
    .eq("incident_id", incident.id)
    .eq("profile_id", userId)
    .maybeSingle();

  let author = "Anonymous student";
  if (!incident.is_anonymous && incident.author_id) {
    const { data: profile } = await room.supabase
      .from("profiles")
      .select("display_name, show_profile")
      .eq("id", incident.author_id)
      .maybeSingle();
    author = profile?.show_profile && profile.display_name ? profile.display_name : "A student";
  }

  let imageUrl: string | null = null;
  if (incident.image_path) {
    const signed = await room.supabase.storage.from("evidence").createSignedUrl(incident.image_path, 300);
    imageUrl = signed.data?.signedUrl ?? null;
  }

  const suggestion = incident.ai_suggestion as AiSuggestion | null;
  const ack = ackCard(incident, room.uni.ack_target_hours);
  const resolve = resolveCard(incident, room.uni.resolve_target_days);

  return (
    <RoomFrame slug={slug} name={room.uni.name} active="room" showAdmin={room.showAdmin} back={{ href: `/room/${slug}`, label: "Room" }}>
      <section className="page-head">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="mono" style={{ color: "var(--cp-ink-3)" }}>{incident.public_code}</span>
          <span className="tag">
            <CategoryIcon category={incident.category} small />
            {CATEGORY_LABEL[incident.category] ?? incident.category}
          </span>
        </div>
        <h1 style={{ marginTop: 12 }}>{incident.title}</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
          <StatusPill status={incident.status} />
          <span className="cap" style={{ fontSize: 13 }}>{author} · {formatWhen(incident.opened_at)}</span>
        </div>
      </section>

      <div className="stack">
        <section className="card">
          <p style={{ color: "var(--cp-ink)", fontSize: 15, lineHeight: 1.55 }}>{incident.description}</p>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" style={{ marginTop: 16, width: "100%", borderRadius: 12 }} />
          ) : null}
          {suggestion?.summary ? (
            <>
              <div className="hair" />
              <div style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 10, fontSize: 13, color: "var(--cp-ink-2)" }}>
                <span style={{ color: "var(--cp-blue-ink)" }}><IconScan small /></span>
                <span>
                  <b style={{ color: "var(--cp-ink)", fontWeight: 600 }}>AI summary</b> · advisory
                  <br />
                  {suggestion.summary}
                  {suggestion.severity ? ` Suggested severity ${suggestion.severity}, priority ${suggestion.priority}.` : ""} Not yet a confirmation.
                </span>
              </div>
            </>
          ) : null}
          {incident.assigned_department ? (
            <p className="hint" style={{ marginTop: 12 }}>Assigned to {incident.assigned_department}</p>
          ) : null}
        </section>

        <section className="card">
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="gauge-num" style={{ fontSize: 40 }}>{incident.affected_count}</span>
            <span style={{ fontWeight: 600, color: "var(--cp-ink)" }}>students affected</span>
          </div>
          <p className="hint" style={{ marginTop: 4 }}>
            Includes the reporter{incident.report_count > 1 ? "s" : ""} and {incident.confirmation_count} confirmation{incident.confirmation_count === 1 ? "" : "s"}, grouped into one incident.
          </p>
        </section>

        <DetailActions
          incidentId={incident.id}
          status={incident.status}
          alreadyReported={alreadyReported}
          alreadyConfirmed={Boolean(confirmation)}
          fixAnswer={fix ? Boolean(fix.still_happening) : null}
        />

        {(notes ?? []).length > 0 ? (
          <section className="card">
            <h2>Added information</h2>
            <ul className="rlist" style={{ marginTop: 8 }}>
              {(notes ?? []).map((note) => (
                <li key={note.id as string} className="rrow" style={{ display: "block" }}>
                  <p style={{ color: "var(--cp-ink)" }}>{note.body as string}</p>
                  <p className="cap" style={{ marginTop: 4 }}>{formatWhen(note.created_at as string)}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="card">
          <h2>Status</h2>
          <Timeline status={incident.status} events={events} />
          {incident.status !== "rejected" ? (
            <>
              <div className="hair" />
              <ol className="tl">
                <li className="alt next">
                  <span className="dot" />
                  <div>
                    <div className="t" style={{ color: "var(--st-rejected)" }}>Rejected</div>
                    <div className="d">If an admin dismisses a report it ends here, with the reason shown</div>
                  </div>
                </li>
              </ol>
            </>
          ) : null}
        </section>

        <section className="card">
          <div className="card-head" style={{ marginBottom: 12 }}>
            <h2>Target times</h2>
            <span className="tag pending">Default · pending founder</span>
          </div>
          <div className="targets">
            <div className="target">
              <div className="k">Acknowledge within {room.uni.ack_target_hours}h</div>
              <div className="v">{ack.value}</div>
              <div className={`s ${ack.tone}`}>{ack.label}</div>
              <div className="meter"><i style={{ width: `${ack.meter}%` }} /></div>
            </div>
            <div className="target">
              <div className="k">Resolve within {room.uni.resolve_target_days} days</div>
              <div className="v">{resolve.value}</div>
              <div className={`s ${resolve.tone}`}>{resolve.label}</div>
              <div className="meter"><i style={{ width: `${resolve.meter}%` }} /></div>
            </div>
          </div>
        </section>
      </div>
    </RoomFrame>
  );
}

function Timeline({ status, events }: { status: string; events: StatusEvent[] }) {
  const reached = new Map<string, StatusEvent>();
  for (const event of events) {
    if (event.from_status !== event.to_status) reached.set(event.to_status, event);
  }
  const rejected = reached.get("rejected");
  if (status === "rejected") {
    const happened = STEPS.filter((step) => reached.has(step.status));
    return (
      <ol className="tl" style={{ marginTop: 16 }}>
        {happened.map((step) => (
          <Step key={step.status} title={STATUS_LABEL[step.status]} detail={detailFor(reached.get(step.status), step.hint)} state="done" />
        ))}
        <Step title="Rejected" detail={rejected?.note || "An admin dismissed this report"} state="now" rejected />
      </ol>
    );
  }

  const current = STEPS.findIndex((step) => step.status === status);
  return (
    <ol className="tl" style={{ marginTop: 16 }}>
      {STEPS.map((step, index) => {
        const event = reached.get(step.status);
        const state = index < current ? "done" : index === current ? "now" : "next";
        const detail = event ? detailFor(event, step.hint) : step.hint;
        return <Step key={step.status} title={STATUS_LABEL[step.status]} detail={detail} state={state} current={state === "now"} />;
      })}
      {events
        .filter((event) => event.from_status === event.to_status && event.note)
        .map((event) => (
          <li key={event.id} className="done">
            <span className="dot"><IconCheck small /></span>
            <div>
              <div className="t">Note</div>
              <div className="d note">{event.note} · {formatWhen(event.created_at)}</div>
            </div>
          </li>
        ))}
    </ol>
  );
}

function Step({
  title,
  detail,
  state,
  current = false,
  rejected = false,
}: {
  title: string;
  detail: string;
  state: "done" | "now" | "next";
  current?: boolean;
  rejected?: boolean;
}) {
  return (
    <li className={state === "done" ? "done" : state === "now" ? "now" : "next"}>
      <span className="dot">{state === "done" ? <IconCheck small /> : null}</span>
      <div>
        <div className="t" style={rejected ? { color: "var(--st-rejected)" } : undefined}>
          {title}
          {current ? <span className="cap" style={{ fontWeight: 500 }}>Current</span> : null}
        </div>
        <div className="d">{detail}</div>
      </div>
    </li>
  );
}

function detailFor(event: StatusEvent | undefined, fallback: string): string {
  if (!event) return fallback;
  const when = formatWhen(event.created_at);
  return event.note ? `${when} · ${event.note}` : `${when} · ${fallback}`;
}

function ackCard(incident: { opened_at: string; acknowledged_at: string | null }, hours: number) {
  const opened = new Date(incident.opened_at).getTime();
  const limit = hours * 3_600_000;
  if (!incident.acknowledged_at) {
    const age = Date.now() - opened;
    if (age > limit) return { value: "Overdue", label: "Past the acknowledgement target", tone: "late", meter: 100 };
    return { value: "Waiting", label: "Not acknowledged yet", tone: "wait", meter: Math.round((age / limit) * 100) };
  }
  const took = new Date(incident.acknowledged_at).getTime() - opened;
  const met = took <= limit;
  return {
    value: span(took),
    label: met ? "Met" : "Late",
    tone: met ? "ok" : "late",
    meter: Math.min(100, Math.round((took / limit) * 100)),
  };
}

function resolveCard(
  incident: { status: string; verified_at: string | null; resolved_at: string | null },
  days: number,
) {
  if (!incident.verified_at) {
    return { value: "Not started", label: "Clock starts at verification", tone: "wait", meter: 0 };
  }
  const start = new Date(incident.verified_at).getTime();
  const limit = days * 86_400_000;
  if (incident.resolved_at) {
    const took = new Date(incident.resolved_at).getTime() - start;
    const met = took <= limit;
    const dayCount = Math.max(1, Math.round(took / 86_400_000));
    return {
      value: `${dayCount} day${dayCount === 1 ? "" : "s"}`,
      label: met ? "Met" : "Late",
      tone: met ? "ok" : "late",
      meter: Math.min(100, Math.round((took / limit) * 100)),
    };
  }
  const age = Date.now() - start;
  if (age > limit) return { value: "Overdue", label: "Past the resolution target", tone: "late", meter: 100 };
  return { value: "In progress", label: "Clock is running", tone: "wait", meter: Math.round((age / limit) * 100) };
}

function span(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours > 0 && remain > 0) return `${hours}h ${remain}m`;
  if (hours > 0) return `${hours}h`;
  return `${remain}m`;
}
