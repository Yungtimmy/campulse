// Campus Pulse. Deterministic. AI never calls this.
// Locked formula (Nov 9, 2026): Burden = min(100, 10 * B_raw). No campus-size divisor.
// Higher is worse.

export const WINDOW_DAYS = 90;
export const RECUR_DAYS = 30;
export const ACK_TARGET_HOURS = 48;
export const RESOLVE_TARGET_DAYS = 7;

export const SEVERITY_WEIGHT = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 5,
} as const;

export const COMPONENT_WEIGHTS = {
  burden: 0.4,
  resolutionFailure: 0.25,
  responseDelay: 0.15,
  recurring: 0.2,
} as const;

export type Severity = keyof typeof SEVERITY_WEIGHT;
export type ReportStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "in_progress"
  | "resolved"
  | "rejected";

export type ConfidenceLabel = "insufficient" | "provisional" | "calibrating";
export type Band = "healthy" | "moderate" | "elevated" | "critical" | "emergency";
export type ComponentKey = keyof typeof COMPONENT_WEIGHTS;

export type PulseIncident = {
  id: string;
  category: string;
  severity: Severity;
  status: ReportStatus;
  openedAt: Date;
  acknowledgedAt: Date | null;
  verifiedAt: Date | null;
  resolvedAt: Date | null;
  reopenedCount: number;
  locationTag: string | null;
  confirmationCount: number;
  isDemo: boolean;
};

export type PulseInput = {
  incidents: PulseIncident[];
  verifiedMembers: number;
  now: Date;
  ackTargetHours?: number;
  resolveTargetDays?: number;
  windowDays?: number;
  includeDemo?: boolean;
};

export type ComponentScore = {
  key: ComponentKey;
  weight: number;
  /** 0–100, or null when the component has no eligible incidents. */
  value: number | null;
  /** Points this component adds after remaining weights are renormalized. */
  contribution: number | null;
};

export type PulseResult = {
  score: number | null;
  rawScore: number | null;
  band: Band | null;
  label: ConfidenceLabel;
  includesDemo: boolean;
  countedIncidents: number;
  verifiedMembers: number;
  components: ComponentScore[];
  conditions: number | null;
  response: number | null;
  dropped: ComponentKey[];
};

const COMPONENT_ORDER: ComponentKey[] = [
  "burden",
  "resolutionFailure",
  "responseDelay",
  "recurring",
];

export function bandFor(score: number): Band {
  if (score <= 20) return "healthy";
  if (score <= 40) return "moderate";
  if (score <= 60) return "elevated";
  if (score <= 80) return "critical";
  return "emergency";
}

export function confidenceWeight(incident: PulseIncident): number {
  if (incident.status === "rejected") return 0;
  if (
    incident.status === "verified" ||
    incident.status === "in_progress" ||
    incident.status === "resolved"
  ) {
    return 1;
  }
  if (
    (incident.status === "under_review" || incident.status === "submitted") &&
    incident.confirmationCount >= 3
  ) {
    return 0.5;
  }
  return 0;
}

type Weighted = { key: ComponentKey; weight: number; value: number | null };

/** Renormalize over components that have a denominator. Null when none do. */
export function scoreFromComponents(parts: Weighted[]): {
  raw: number | null;
  score: number | null;
  contributions: Record<ComponentKey, number | null>;
} {
  const active = parts.filter((part) => part.value !== null) as Array<
    Weighted & { value: number }
  >;
  const weightSum = active.reduce((sum, part) => sum + part.weight, 0);
  const contributions = {
    burden: null,
    resolutionFailure: null,
    responseDelay: null,
    recurring: null,
  } as Record<ComponentKey, number | null>;

  if (weightSum === 0) {
    return { raw: null, score: null, contributions };
  }

  let raw = 0;
  for (const part of active) {
    const contribution = (part.weight / weightSum) * part.value;
    contributions[part.key] = contribution;
    raw += contribution;
  }
  return { raw, score: Math.round(raw), contributions };
}

function inWindow(incident: PulseIncident, now: Date, windowDays: number): boolean {
  const start = now.getTime() - windowDays * 86_400_000;
  if (incident.openedAt.getTime() >= start) return true;
  if (incident.resolvedAt && incident.resolvedAt.getTime() >= start) return true;
  return false;
}

function hours(value: number): number {
  return value * 3_600_000;
}

function days(value: number): number {
  return value * 86_400_000;
}

export function computePulse(input: PulseInput): PulseResult {
  const now = input.now;
  const windowDays = input.windowDays ?? WINDOW_DAYS;
  const ackTargetHours = input.ackTargetHours ?? ACK_TARGET_HOURS;
  const resolveTargetDays = input.resolveTargetDays ?? RESOLVE_TARGET_DAYS;
  const includeDemo = input.includeDemo === true;

  const incidents = input.incidents.filter(
    (incident) =>
      (includeDemo || !incident.isDemo) &&
      incident.status !== "rejected" &&
      inWindow(incident, now, windowDays),
  );

  const countedIncidents = incidents.filter(
    (incident) => confidenceWeight(incident) > 0,
  ).length;

  let burdenRaw = 0;
  for (const incident of incidents) {
    if (incident.status === "resolved") continue;
    const weight = confidenceWeight(incident);
    if (weight === 0) continue;
    burdenRaw += SEVERITY_WEIGHT[incident.severity] * weight;
  }
  const burden = Math.min(100, 10 * burdenRaw);

  const resolutionEligible = incidents.filter((incident) => {
    if (confidenceWeight(incident) !== 1 || !incident.verifiedAt) return false;
    return incident.verifiedAt.getTime() + days(resolveTargetDays) <= now.getTime();
  });
  const resolutionFailed = resolutionEligible.filter((incident) => {
    const deadline = incident.verifiedAt!.getTime() + days(resolveTargetDays);
    if (incident.status !== "resolved" || !incident.resolvedAt) return true;
    return incident.resolvedAt.getTime() > deadline;
  });
  const resolutionFailure =
    resolutionEligible.length === 0
      ? null
      : (100 * resolutionFailed.length) / resolutionEligible.length;

  const delayEligible = incidents.filter(
    (incident) => incident.openedAt.getTime() + hours(ackTargetHours) <= now.getTime(),
  );
  const delayFailed = delayEligible.filter((incident) => {
    const deadline = incident.openedAt.getTime() + hours(ackTargetHours);
    if (!incident.acknowledgedAt) return true;
    return incident.acknowledgedAt.getTime() > deadline;
  });
  const responseDelay =
    delayEligible.length === 0
      ? null
      : (100 * delayFailed.length) / delayEligible.length;

  const windowStart = now.getTime() - days(windowDays);
  const recurEligible = incidents.filter(
    (incident) =>
      incident.resolvedAt !== null &&
      incident.resolvedAt.getTime() >= windowStart &&
      (incident.status === "resolved" || incident.reopenedCount > 0),
  );
  const recurred = recurEligible.filter((incident) => {
    if (incident.reopenedCount > 0) return true;
    if (!incident.resolvedAt || !incident.locationTag) return false;
    const until = incident.resolvedAt.getTime() + days(RECUR_DAYS);
    return incidents.some((other) => {
      if (other.id === incident.id) return false;
      if (other.category !== incident.category) return false;
      if (!other.locationTag || other.locationTag !== incident.locationTag) return false;
      if (confidenceWeight(other) < 1) return false;
      if (other.openedAt.getTime() < incident.resolvedAt!.getTime()) return false;
      if (other.openedAt.getTime() > until) return false;
      return true;
    });
  });
  const recurring =
    recurEligible.length === 0 ? null : (100 * recurred.length) / recurEligible.length;

  const parts: Weighted[] = [
    { key: "burden", weight: COMPONENT_WEIGHTS.burden, value: burden },
    {
      key: "resolutionFailure",
      weight: COMPONENT_WEIGHTS.resolutionFailure,
      value: resolutionFailure,
    },
    { key: "responseDelay", weight: COMPONENT_WEIGHTS.responseDelay, value: responseDelay },
    { key: "recurring", weight: COMPONENT_WEIGHTS.recurring, value: recurring },
  ];

  const combined = scoreFromComponents(parts);
  const dropped = parts
    .filter((part) => part.value === null)
    .map((part) => part.key);

  let label: ConfidenceLabel = "calibrating";
  if (countedIncidents < 5 || input.verifiedMembers < 20) label = "insufficient";
  else if (dropped.length > 0 || countedIncidents < 15) label = "provisional";

  const showNumber = label !== "insufficient";
  const conditions =
    showNumber && combined.raw !== null
      ? (combined.contributions.burden ?? 0) + (combined.contributions.recurring ?? 0)
      : null;
  const response =
    showNumber && combined.raw !== null
      ? (combined.contributions.resolutionFailure ?? 0) +
        (combined.contributions.responseDelay ?? 0)
      : null;

  return {
    score: showNumber ? combined.score : null,
    rawScore: showNumber ? combined.raw : null,
    band: showNumber && combined.score !== null ? bandFor(combined.score) : null,
    label,
    includesDemo: includeDemo && input.incidents.some((incident) => incident.isDemo),
    countedIncidents,
    verifiedMembers: input.verifiedMembers,
    components: COMPONENT_ORDER.map((key) => {
      const part = parts.find((item) => item.key === key)!;
      return {
        key,
        weight: part.weight,
        value: part.value,
        contribution: showNumber ? combined.contributions[key] : null,
      };
    }),
    conditions,
    response,
    dropped,
  };
}
