import type { Band, ComponentKey, ConfidenceLabel } from "@/lib/pulse";

export const CATEGORIES = [
  { id: "electricity", label: "Electricity" },
  { id: "water_supply", label: "Water Supply" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "sanitation", label: "Sanitation" },
  { id: "accommodation", label: "Accommodation" },
  { id: "security", label: "Security" },
  { id: "academic_facilities", label: "Academic Facilities" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category.label]),
);

export const STATUSES = [
  "submitted",
  "under_review",
  "verified",
  "in_progress",
  "resolved",
  "rejected",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  verified: "Verified",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

export const STATUS_CLASS: Record<string, string> = {
  submitted: "s-submitted",
  under_review: "s-review",
  verified: "s-verified",
  in_progress: "s-progress",
  resolved: "s-resolved",
  rejected: "s-rejected",
};

export const SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const SEVERITY_CLASS: Record<string, string> = {
  low: "l1",
  medium: "l2",
  high: "l3",
  critical: "l4",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const DEPARTMENTS = [
  "Works and Services",
  "Student Affairs",
  "Security Unit",
  "Health Services",
] as const;

export const BAND_LABEL: Record<Band, string> = {
  healthy: "Healthy",
  moderate: "Moderate",
  elevated: "Elevated",
  critical: "Critical",
  emergency: "Emergency",
};

export const CONFIDENCE_LABEL: Record<ConfidenceLabel, string> = {
  insufficient: "Insufficient data",
  provisional: "Provisional",
  calibrating: "Calibrating · pilot weights",
};

export const COMPONENT_COPY: Record<
  ComponentKey,
  { name: string; measures: string; tone: "conditions" | "response" }
> = {
  burden: {
    name: "Problem burden and severity",
    measures: "Weight 40% · Number and seriousness of unresolved problems",
    tone: "conditions",
  },
  resolutionFailure: {
    name: "Resolution failure",
    measures: "Weight 25% · Share of verified problems not resolved within 7 days",
    tone: "response",
  },
  responseDelay: {
    name: "Response delay",
    measures: "Weight 15% · Share of reports not acknowledged within 48 hours",
    tone: "response",
  },
  recurring: {
    name: "Recurring issues",
    measures: "Weight 20% · Verified problems that return within 30 days of being resolved",
    tone: "conditions",
  },
};

export function roomPill(slug: string, name?: string | null): string {
  if (slug === "funaab") return "FUNAAB Room";
  return name ? `${name} Room` : "Room";
}

export function formatWhen(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export function formatDay(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export function formatPoints(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "–";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function categoryTone(category: string): string {
  if (category === "water_supply" || category === "sanitation") return "amber";
  if (category === "infrastructure" || category === "security" || category === "accommodation") {
    return "blue";
  }
  if (category === "academic_facilities") return "green";
  return "grey";
}
