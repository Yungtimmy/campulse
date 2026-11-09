export type AiSuggestion = {
  category?: string;
  severity?: string;
  priority?: string;
  summary?: string;
  duplicate_of?: string[];
  confidence?: number;
  model?: string;
  prompt_version?: string;
};

export type FeedIncident = {
  id: string;
  university_id: string;
  category: string;
  severity: string;
  priority: string;
  title: string;
  status: string;
  location_tag: string | null;
  assigned_department: string | null;
  public_code: string;
  opened_at: string;
  acknowledged_at: string | null;
  verified_at: string | null;
  resolved_at: string | null;
  reopened_count: number;
  is_demo: boolean;
  affected_count: number;
  description: string | null;
  is_anonymous: boolean | null;
  primary_report_id: string | null;
  image_path: string | null;
  ai_suggestion: AiSuggestion | null;
  author_id: string | null;
  report_count: number;
  confirmation_count: number;
};

export type Profile = {
  id: string;
  university_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  verification_status: "pending" | "verified" | "rejected";
  verification_method: string | null;
  verified_at: string | null;
  show_profile: boolean;
  matric_number: string | null;
  faculty: string | null;
  department: string | null;
  level: string | null;
  registered_at: string | null;
};

export type University = {
  id: string;
  slug: string;
  name: string;
  ack_target_hours: number;
  resolve_target_days: number;
  is_active: boolean;
};

export type AdminRole = {
  id: string;
  profile_id: string;
  university_id: string | null;
  role: "university_admin" | "super_admin";
  department: string | null;
};

export type StatusEvent = {
  id: string;
  incident_id: string;
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  note: string | null;
  created_at: string;
};

export type PulseSnapshot = {
  id: string;
  university_id: string;
  taken_on: string;
  score: number | null;
  band: string | null;
  label: string;
  includes_demo: boolean;
};
