import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computePulse, type PulseIncident, type PulseResult, type ReportStatus, type Severity } from "@/lib/pulse";
import type { PulseSnapshot } from "@/lib/types";

type PulseRow = {
  id: string;
  category: string;
  severity: Severity;
  status: ReportStatus;
  opened_at: string;
  acknowledged_at: string | null;
  verified_at: string | null;
  resolved_at: string | null;
  reopened_count: number;
  location_tag: string | null;
  confirmation_count: number;
  ack_target_hours: number;
  resolve_target_days: number;
};

export async function loadPulse(
  supabase: SupabaseClient,
  universityId: string,
): Promise<{ result: PulseResult; snapshots: PulseSnapshot[] }> {
  const { data } = await supabase
    .from("pulse_inputs")
    .select(
      "id, category, severity, status, opened_at, acknowledged_at, verified_at, resolved_at, reopened_count, location_tag, confirmation_count, ack_target_hours, resolve_target_days",
    )
    .eq("university_id", universityId);
  const inputs = (data ?? []) as PulseRow[];
  const { data: members } = await supabase.rpc("verified_member_count");

  const result = computePulse({
    incidents: inputs.map(toIncident),
    verifiedMembers: typeof members === "number" ? members : 0,
    now: new Date(),
    ackTargetHours: inputs[0]?.ack_target_hours ?? 48,
    resolveTargetDays: inputs[0]?.resolve_target_days ?? 7,
  });

  const today = new Date().toISOString().slice(0, 10);
  await supabase.rpc("save_pulse_snapshot", {
    p_taken_on: today,
    p_score: result.score,
    p_band: result.band,
    p_label: result.label,
    p_components: result.components,
    p_includes_demo: false,
  });

  const { data: snaps } = await supabase
    .from("pulse_snapshots")
    .select("id, university_id, taken_on, score, band, label")
    .eq("university_id", universityId)
    .eq("includes_demo", false)
    .order("taken_on", { ascending: true });

  return {
    result,
    snapshots: (snaps ?? []) as PulseSnapshot[],
  };
}

function toIncident(row: PulseRow): PulseIncident {
  return {
    id: row.id,
    category: row.category,
    severity: row.severity,
    status: row.status,
    openedAt: new Date(row.opened_at),
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
    reopenedCount: row.reopened_count,
    locationTag: row.location_tag,
    confirmationCount: row.confirmation_count,
  };
}
