import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { PulseResult } from "@/lib/pulse";
import type { FeedIncident } from "@/lib/types";

export type RoomFacts = {
  topCategory: string | null;
  topCategoryLabel: string | null;
  topCategoryOpen: number;
  largest: { title: string; code: string; affected: number; status: string } | null;
  urgentUnresolved: number;
  pastAckTarget: number;
  resolvedLast7Days: number;
  resolvedOnTime: number;
  openIncidents: number;
  reportCount: number;
  pulseScore: number | null;
  pulseBand: string | null;
  pulseLabel: string;
  ackTargetHours: number;
  resolveTargetDays: number;
  includesDemo: boolean;
  resolvedWindowDays: number;
  openByCategory: Array<{ category: string; label: string; count: number }>;
};

const OPEN = new Set(["submitted", "under_review", "verified", "in_progress"]);

export function roomFacts(
  incidents: FeedIncident[],
  pulse: PulseResult,
  targets: { ackTargetHours: number; resolveTargetDays: number },
  now = new Date(),
): RoomFacts {
  const open = incidents.filter((incident) => OPEN.has(incident.status));
  const counts = new Map<string, number>();
  for (const incident of open) {
    counts.set(incident.category, (counts.get(incident.category) ?? 0) + 1);
  }
  const openByCategory = [...counts.entries()]
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const top = openByCategory[0] ?? null;
  const largest = [...open].sort((a, b) => b.affected_count - a.affected_count)[0] ?? null;
  const ackMs = targets.ackTargetHours * 3_600_000;
  const resolveMs = targets.resolveTargetDays * 86_400_000;
  const weekAgo = now.getTime() - 7 * 86_400_000;

  const resolvedWeek = incidents.filter(
    (incident) => incident.resolved_at && new Date(incident.resolved_at).getTime() >= weekAgo,
  );
  const onTime = resolvedWeek.filter((incident) => {
    if (!incident.verified_at || !incident.resolved_at) return false;
    return new Date(incident.resolved_at).getTime() <= new Date(incident.verified_at).getTime() + resolveMs;
  });

  return {
    topCategory: top?.category ?? null,
    topCategoryLabel: top?.label ?? null,
    topCategoryOpen: top?.count ?? 0,
    largest: largest
      ? {
          title: largest.title,
          code: largest.public_code,
          affected: largest.affected_count,
          status: STATUS_LABEL[largest.status] ?? largest.status,
        }
      : null,
    urgentUnresolved: open.filter((incident) => incident.priority === "urgent").length,
    pastAckTarget: incidents.filter(
      (incident) =>
        incident.status === "submitted" && now.getTime() - new Date(incident.opened_at).getTime() > ackMs,
    ).length,
    resolvedLast7Days: resolvedWeek.length,
    resolvedOnTime: onTime.length,
    openIncidents: open.length,
    reportCount: incidents.reduce((sum, incident) => sum + incident.report_count, 0),
    pulseScore: pulse.score,
    pulseBand: pulse.band,
    pulseLabel: pulse.label,
    ackTargetHours: targets.ackTargetHours,
    resolveTargetDays: targets.resolveTargetDays,
    includesDemo: incidents.some((incident) => incident.is_demo) || pulse.includesDemo,
    resolvedWindowDays: 7,
    openByCategory,
  };
}

export function briefingSentences(facts: RoomFacts): string {
  const parts: string[] = [];
  if (facts.topCategoryLabel) {
    parts.push(
      `${facts.topCategoryLabel} is the most reported category, with ${facts.topCategoryOpen} open incident${facts.topCategoryOpen === 1 ? "" : "s"}.`,
    );
  } else {
    parts.push("No category has an open incident right now.");
  }
  if (facts.largest) {
    parts.push(
      `The largest open incident is ${facts.largest.title} (${facts.largest.code}), with ${facts.largest.affected} affected and status ${facts.largest.status}.`,
    );
  }
  parts.push(
    `${facts.urgentUnresolved} urgent incident${facts.urgentUnresolved === 1 ? " is" : "s are"} unresolved.`,
  );
  parts.push(
    `${facts.pastAckTarget} report${facts.pastAckTarget === 1 ? " has" : "s have"} passed the ${facts.ackTargetHours}-hour acknowledgement target.`,
  );
  parts.push(
    `${facts.resolvedLast7Days} incident${facts.resolvedLast7Days === 1 ? " was" : "s were"} resolved in the last 7 days, ${facts.resolvedOnTime} on time.`,
  );
  return parts.join(" ");
}

/** Every numeral in the rewrite must already exist in the facts. */
export function narrativeUsesOnlyFacts(narrative: string, facts: RoomFacts): boolean {
  const allowed = new Set((JSON.stringify(facts).match(/\d+(?:\.\d+)?/g) ?? []).map((value) => value.replace(/\.0$/, "")));
  const used = narrative.match(/\d+(?:\.\d+)?/g) ?? [];
  return used.every((value) => allowed.has(value) || allowed.has(String(Number(value))));
}
