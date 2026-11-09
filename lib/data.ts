import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedIncident, StatusEvent } from "@/lib/types";

export async function loadFeed(supabase: SupabaseClient, universityId: string): Promise<FeedIncident[]> {
  const { data } = await supabase
    .from("incident_feed")
    .select("*")
    .eq("university_id", universityId)
    .order("opened_at", { ascending: false });
  return (data ?? []) as FeedIncident[];
}

export async function loadIncident(
  supabase: SupabaseClient,
  id: string,
): Promise<FeedIncident | null> {
  const { data } = await supabase.from("incident_feed").select("*").eq("id", id).maybeSingle();
  return (data as FeedIncident | null) ?? null;
}

export async function loadEvents(supabase: SupabaseClient, incidentId: string): Promise<StatusEvent[]> {
  const { data } = await supabase
    .from("status_events")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });
  return (data ?? []) as StatusEvent[];
}

export function targetSummary(
  incident: FeedIncident,
  ackHours: number,
  resolveDays: number,
  now = new Date(),
): { text: string; tone: "ok" | "late" | "wait" } {
  if (incident.status === "rejected") return { text: "Closed", tone: "wait" };
  const opened = new Date(incident.opened_at).getTime();
  const ackLimit = ackHours * 3_600_000;
  const resolveLimit = resolveDays * 86_400_000;

  if (incident.status === "resolved" && incident.resolved_at && incident.verified_at) {
    const took = new Date(incident.resolved_at).getTime() - new Date(incident.verified_at).getTime();
    const days = Math.max(1, Math.round(took / 86_400_000));
    const late = took > resolveLimit;
    return { text: `Resolved in ${days} day${days === 1 ? "" : "s"}`, tone: late ? "late" : "ok" };
  }

  if (!incident.verified_at) {
    if (incident.acknowledged_at) {
      const took = new Date(incident.acknowledged_at).getTime() - opened;
      return { text: `Ack met · ${formatSpan(took)}`, tone: "ok" };
    }
    const age = now.getTime() - opened;
    if (age > ackLimit) return { text: `Ack overdue · ${formatSpan(age - ackLimit)}`, tone: "late" };
    return { text: `Ack in ${formatSpan(ackLimit - age)}`, tone: "wait" };
  }

  const due = new Date(incident.verified_at).getTime() + resolveLimit;
  if (now.getTime() > due) return { text: `Resolve overdue · ${formatSpan(now.getTime() - due)}`, tone: "late" };
  return { text: `Resolve by ${formatShort(new Date(due))}`, tone: "wait" };
}

function formatSpan(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours >= 48) return `${Math.round(hours / 24)}d`;
  if (hours > 0 && remain > 0) return `${hours}h ${remain}m`;
  if (hours > 0) return `${hours}h`;
  return `${remain}m`;
}

function formatShort(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export function pulseDelta(
  score: number | null,
  snapshots: Array<{ taken_on: string; score: number | null }>,
): string | null {
  if (score === null) return null;
  const prior = [...snapshots].reverse().find((snapshot) => {
    const age = Date.now() - new Date(snapshot.taken_on).getTime();
    return snapshot.score !== null && age > 20 * 86_400_000;
  });
  if (!prior || prior.score === null) return null;
  const diff = score - prior.score;
  const when = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(prior.taken_on));
  if (diff === 0) return `Same as ${when}`;
  if (diff < 0) return `${Math.abs(diff)} lower vs ${when}`;
  return `${diff} higher vs ${when}`;
}
