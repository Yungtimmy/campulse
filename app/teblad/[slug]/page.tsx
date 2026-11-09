import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { CollegeDepartmentFilters } from "@/components/college-department-filters";
import { IconScan, IconSearch } from "@/components/icons";
import { departmentsFor } from "@/lib/campus";
import { pulseDelta, targetSummary } from "@/lib/data";
import { loadFeed } from "@/lib/data";
import { briefingSentences, roomFacts } from "@/lib/facts";
import { HIDDEN_ADMIN_PATH } from "@/lib/admin-gate";
import { requireAdmin } from "@/lib/guard";
import { BAND_LABEL, CATEGORIES, CATEGORY_LABEL, formatWhen, SEVERITY_CLASS, SEVERITY_LABEL, STATUS_CLASS, STATUS_LABEL } from "@/lib/labels";
import { loadPulse } from "@/lib/pulse-load";
import type { FeedIncident } from "@/lib/types";
import { AdminPanel } from "./panel";
import { BriefingButton } from "./briefing-button";

const OPEN = ["submitted", "under_review", "verified", "in_progress"];

export default async function AdminQueue({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const admin = await requireAdmin(slug);

  const incidents = await loadFeed(admin.supabase, admin.uni.id);
  const { data: people } = await admin.supabase
    .from("profiles")
    .select("id, faculty, department")
    .eq("university_id", admin.uni.id);
  const authors = new Map(
    ((people ?? []) as Array<{ id: string; faculty: string | null; department: string | null }>).map((person) => [
      person.id,
      person,
    ]),
  );
  const { result, snapshots } = await loadPulse(admin.supabase, admin.uni.id);
  const facts = roomFacts(incidents, result, {
    ackTargetHours: admin.uni.ack_target_hours,
    resolveTargetDays: admin.uni.resolve_target_days,
  });
  const filtered = filterIncidents(incidents, query, authors);
  const selected = filtered.find((incident) => incident.id === query.id) ?? filtered[0] ?? null;
  const activity = selected ? await loadActivity(admin.supabase as SupabaseClient, selected.id) : [];
  const base = `${HIDDEN_ADMIN_PATH}/${slug}`;
  const clearHref = hrefFor(base, { ...query, id: undefined });
  const delta = pulseDelta(result.score, snapshots);
  const notAck = incidents.filter((incident) => incident.status === "submitted");
  const pastAck = facts.pastAckTarget;

  return (
    <>
      <main className="main">
        <div className="mhead">
          <div>
            <h1>Report queue</h1>
            <p>
              {slug === "funaab" ? "FUNAAB Room" : admin.uni.name} · {formatWhen(new Date())}
            </p>
          </div>
        </div>

        <div className="stats">
          <div className="stat pulse">
            <div className="k">Campus Pulse</div>
            <div className="v">
              {result.score ?? "–"}
              {result.band ? <span style={{ color: "var(--band-" + result.band + ")" }}>{BAND_LABEL[result.band]}</span> : null}
            </div>
            <div className="d">{delta ?? "Higher is worse"}</div>
          </div>
          <div className="stat">
            <div className="k">Open incidents</div>
            <div className="v">{facts.openIncidents}</div>
            <div className="d">From {facts.reportCount} reports</div>
          </div>
          <div className="stat">
            <div className="k">Not acknowledged</div>
            <div className="v">{notAck.length}</div>
            <div className="d">{pastAck > 0 ? <span className="late">{pastAck} past 48h target</span> : "Within the 48h target"}</div>
          </div>
          <div className="stat">
            <div className="k">Resolved, 7 days</div>
            <div className="v">{facts.resolvedLast7Days}</div>
            <div className="d">{facts.resolvedOnTime} on time</div>
          </div>
        </div>

        <section className="brief" id="briefing">
          <h2><IconScan />Campus briefing</h2>
          <BriefingButton slug={slug} initial={briefingSentences(facts)} />
        </section>

        <form className="filters" role="search" action={base}>
          <div className="srch">
            <IconSearch />
            <input type="text" name="q" placeholder="Search reports" aria-label="Search reports" defaultValue={query.q ?? ""} />
          </div>
          <select name="status" aria-label="Status" className={query.status && query.status !== "open" ? "set" : undefined} defaultValue={query.status ?? "open"}>
            <option value="open">Open statuses</option>
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="category" aria-label="Category" defaultValue={query.category ?? ""}>
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
          <select name="severity" aria-label="Severity" defaultValue={query.severity ?? ""}>
            <option value="">All severities</option>
            {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="range" aria-label="Date" defaultValue={query.range ?? "30"}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <CollegeDepartmentFilters faculty={query.faculty ?? ""} department={query.department ?? ""} />
          <button className="link-btn clear" type="submit">Apply</button>
          <Link className="clear" href={base}>Clear</Link>
        </form>

        <div className="tablewrap">
          <table className="q">
            <thead>
              <tr>
                <th>Report</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((incident) => {
                const target = targetSummary(incident, admin.uni.ack_target_hours, admin.uni.resolve_target_days);
                return (
                  <tr key={incident.id} className={selected?.id === incident.id ? "sel" : undefined} aria-selected={selected?.id === incident.id}>
                    <td>
                      <Link href={hrefFor(base, { ...query, id: incident.id })} style={{ color: "inherit", textDecoration: "none" }}>
                        <div className="tt">{incident.title}</div>
                        <div className="sub">
                          <span className="mono">{incident.public_code}</span>
                          <span>·</span>
                          <span>{CATEGORY_LABEL[incident.category]}</span>
                          <span>·</span>
                          <span className="tnum">{incident.affected_count} affected</span>
                          {incident.is_anonymous ? <span>· Anonymous</span> : null}
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span className={`sev ${SEVERITY_CLASS[incident.severity] ?? ""}`}>
                        <i><b /><b /><b /><b /></i>
                        {SEVERITY_LABEL[incident.severity]}
                      </span>
                    </td>
                    <td><span className={`status pill ${STATUS_CLASS[incident.status]}`}>{STATUS_LABEL[incident.status]}</span></td>
                    <td><span className={`due ${target.tone}`}>{target.text}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {incidents.length === 0 ? (
          <p className="hint" style={{ marginTop: 12 }}>No reports yet.</p>
        ) : filtered.length === 0 ? (
          <p className="hint" style={{ marginTop: 12 }}>No reports match these filters.</p>
        ) : (
          <p className="cap" style={{ marginTop: 12 }}>
            Showing {filtered.length} of {incidents.length} incidents
          </p>
        )}
      </main>
      <AdminPanel key={selected?.id ?? "none"} incident={selected} slug={slug} activity={activity} clearHref={clearHref} />
    </>
  );
}

function filterIncidents(
  incidents: FeedIncident[],
  query: Record<string, string | undefined>,
  authors: Map<string, { faculty: string | null; department: string | null }>,
) {
  const status = query.status ?? "open";
  const range = Number(query.range ?? "30");
  const since = Date.now() - range * 86_400_000;
  const q = (query.q ?? "").trim().toLowerCase();
  const faculty = query.faculty ?? "";
  const department =
    faculty && (departmentsFor(faculty) as readonly string[]).includes(query.department ?? "")
      ? query.department ?? ""
      : "";
  return incidents.filter((incident) => {
    if (status === "open" && !OPEN.includes(incident.status)) return false;
    if (status !== "open" && status !== "all" && incident.status !== status) return false;
    if (query.category && incident.category !== query.category) return false;
    if (query.severity && incident.severity !== query.severity) return false;
    if (new Date(incident.opened_at).getTime() < since && incident.status !== "submitted") return false;
    if (q && !`${incident.title} ${incident.public_code} ${incident.description ?? ""}`.toLowerCase().includes(q)) return false;
    if (faculty || department) {
      const author = incident.author_id ? authors.get(incident.author_id) : undefined;
      if (!author || (faculty && author.faculty !== faculty)) return false;
      if (department && author.department !== department) return false;
    }
    return true;
  });
}

function hrefFor(base: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `${base}?${text}` : base;
}

async function loadActivity(supabase: SupabaseClient, incidentId: string) {
  const [{ data: events }, { data: audit }] = await Promise.all([
    supabase.from("status_events").select("created_at, from_status, to_status, note").eq("incident_id", incidentId).order("created_at", { ascending: false }),
    supabase.from("admin_audit").select("created_at, action, meta").eq("target_id", incidentId).order("created_at", { ascending: false }),
  ]);
  const rows = [
    ...((events ?? []) as Array<{ created_at: string; from_status: string | null; to_status: string; note: string | null }>).map((event) => ({
      at: event.created_at,
      text: event.from_status && event.from_status !== event.to_status
        ? `${STATUS_LABEL[event.from_status] ?? event.from_status} → ${STATUS_LABEL[event.to_status] ?? event.to_status}${event.note ? ` · ${event.note}` : ""}`
        : event.note ?? "Updated",
    })),
    ...((audit ?? []) as Array<{ created_at: string; action: string; meta: { department?: string } | null }>).map((row) => ({
      at: row.created_at,
      text: row.action === "assign" ? `Assigned to ${row.meta?.department ?? "a department"}` : `Logged ${row.action.replaceAll("_", " ")}`,
    })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}
