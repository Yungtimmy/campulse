"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HIDDEN_ADMIN_PATH } from "@/lib/admin-gate";
import { DEPARTMENTS } from "@/lib/labels";
import { PhotoError, stripExif } from "@/lib/exif";
import { validateRegistration } from "@/lib/registration";
import { getSession, isAdminOf } from "@/lib/session";
import type { AiSuggestion } from "@/lib/types";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

const suggestionSchema = z.object({
  category: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  summary: z.string().max(160),
  duplicate_of: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  model: z.string().optional(),
  prompt_version: z.string().optional(),
});

const categories = [
  "electricity",
  "water_supply",
  "infrastructure",
  "sanitation",
  "accommodation",
  "security",
  "academic_facilities",
  "other",
] as const;

export async function submitReport(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session.supabase || !session.user || session.profile?.verification_status !== "verified") {
    return { ok: false, error: "Sign in as a verified student to report an issue" };
  }

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const category = String(formData.get("category") ?? "");
  const anonymous = formData.get("anonymous") === "1";
  const duplicateOf = String(formData.get("duplicateOf") ?? "");
  const location = String(formData.get("location") ?? "");
  const suggestionRaw = String(formData.get("suggestion") ?? "");

  if (!categories.includes(category as (typeof categories)[number])) {
    return { ok: false, error: "Choose a category" };
  }

  let suggestion: AiSuggestion | null = null;
  if (suggestionRaw) {
    try {
      const parsed = suggestionSchema.safeParse(JSON.parse(suggestionRaw));
      if (parsed.success) suggestion = parsed.data;
    } catch {
      suggestion = null;
    }
  }

  const { data, error } = await session.supabase.rpc("submit_report", {
    p_title: title,
    p_description: description,
    p_category: category,
    p_is_anonymous: anonymous,
    p_duplicate_of: duplicateOf || null,
    p_ai_suggestion: suggestion,
    p_location_tag: location || null,
  });

  if (error || !data) {
    return { ok: false, error: friendly(error?.message, "The report could not be saved") };
  }

  const report = data as { id: string; incident_id: string; university_id: string };
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      const cleaned = await stripExif(Buffer.from(await photo.arrayBuffer()));
      const path = `${report.university_id}/${report.id}/photo.jpg`;
      const upload = await session.supabase.storage.from("evidence").upload(path, cleaned, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upload.error) {
        return { ok: true, id: report.incident_id, message: "Report saved. The photo could not be stored." };
      }
      const attached = await session.supabase.rpc("attach_report_image", {
        p_report_id: report.id,
        p_path: path,
      });
      if (attached.error) {
        return { ok: true, id: report.incident_id, message: "Report saved. The photo could not be attached." };
      }
    } catch (error) {
      const message = error instanceof PhotoError ? error.message : "Report saved. The photo could not be stored.";
      return { ok: true, id: report.incident_id, message: `Report saved. ${message}` };
    }
  }

  revalidatePath("/room", "layout");
  return { ok: true, id: report.incident_id };
}

export async function confirmIncident(incidentId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.supabase) return { ok: false, error: "Sign in to confirm" };
  const { error } = await session.supabase.rpc("confirm_incident", {
    p_incident_id: incidentId,
    p_note: null,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not record that") };
  revalidatePath("/room", "layout");
  return { ok: true };
}

export async function addIncidentNote(incidentId: string, body: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.supabase) return { ok: false, error: "Sign in to add information" };
  const { error } = await session.supabase.rpc("add_incident_note", {
    p_incident_id: incidentId,
    p_body: body,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not add that note") };
  revalidatePath("/room", "layout");
  return { ok: true };
}

export async function recordFix(incidentId: string, stillHappening: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session.supabase) return { ok: false, error: "Sign in to answer" };
  const { error } = await session.supabase.rpc("record_fix_response", {
    p_incident_id: incidentId,
    p_still_happening: stillHappening,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not record your answer") };
  revalidatePath("/room", "layout");
  return { ok: true };
}

export async function saveIncident(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session.supabase || !session.profile?.university_id) {
    return { ok: false, error: "Sign in as a Room admin" };
  }
  if (!isAdminOf(session.roles, session.profile.university_id)) {
    return { ok: false, error: "Only a Room admin can change status" };
  }

  const incidentId = String(formData.get("incidentId") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "");
  const severity = String(formData.get("severity") ?? "");
  const department = String(formData.get("department") ?? "");

  if (department && !DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number])) {
    return { ok: false, error: "Choose a department from the list" };
  }
  if (status === "rejected" && note.trim().length === 0) {
    return { ok: false, error: "Rejected needs a reason" };
  }
  if (status === "resolved" && note.trim().length === 0) {
    return { ok: false, error: "Resolved needs a resolution note" };
  }

  const { error } = await session.supabase.rpc("set_incident_status", {
    p_incident_id: incidentId,
    p_to_status: status,
    p_note: note.trim() || null,
    p_severity: severity || null,
    p_department: department || null,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not save the change") };
  revalidatePath(HIDDEN_ADMIN_PATH, "layout");
  revalidatePath("/room", "layout");
  return { ok: true };
}

export async function setMemberVerification(profileId: string, status: "verified" | "rejected" | "pending"): Promise<ActionResult> {
  const session = await getSession();
  if (!session.supabase || !session.profile?.university_id || !isAdminOf(session.roles, session.profile.university_id)) {
    return { ok: false, error: "Only a Room admin can do that" };
  }
  const { error } = await session.supabase.rpc("set_member_verification", {
    p_profile_id: profileId,
    p_status: status,
    p_note: status === "rejected" ? "Access revoked by a Room admin" : null,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not update that member") };
  revalidatePath(HIDDEN_ADMIN_PATH, "layout");
  return { ok: true };
}

export async function approveMember(profileId: string): Promise<void> {
  await setMemberVerification(profileId, "verified");
}

export async function revokeMember(profileId: string): Promise<void> {
  await setMemberVerification(profileId, "rejected");
}

export async function completeRegistration(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session.supabase || !session.user) {
    return { ok: false, error: "Sign in with Google first" };
  }
  if (session.profile?.verification_status === "rejected") {
    return { ok: false, error: "A Room admin revoked this account" };
  }
  if (session.profile?.registered_at && session.profile.verification_status === "verified") {
    return { ok: true };
  }

  const parsed = validateRegistration({
    fullName: String(formData.get("fullName") ?? ""),
    faculty: String(formData.get("faculty") ?? ""),
    department: String(formData.get("department") ?? ""),
    level: String(formData.get("level") ?? ""),
    matricNumber: String(formData.get("matric") ?? ""),
  });
  if (!parsed.ok) return parsed;

  const { data, error } = await session.supabase
    .from("profiles")
    .update({
      display_name: parsed.value.fullName,
      faculty: parsed.value.faculty,
      department: parsed.value.department,
      level: parsed.value.level,
      matric_number: parsed.value.matricNumber,
    })
    .eq("id", session.user.id)
    .select("registered_at, verification_status")
    .maybeSingle();

  if (error || !data?.registered_at || data.verification_status !== "verified") {
    return { ok: false, error: friendly(error?.message, "The profile could not be saved") };
  }

  revalidatePath("/room", "layout");
  return { ok: true };
}

export async function requestManualApproval(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session.supabase || !session.user) {
    return { ok: false, error: "Sign in first. Manual approval is a backup after you have an account." };
  }
  const matric = String(formData.get("matric") ?? "");
  let photoPath: string | null = null;
  const photo = formData.get("idPhoto");
  if (photo instanceof File && photo.size > 0 && session.profile?.university_id) {
    try {
      const cleaned = await stripExif(Buffer.from(await photo.arrayBuffer()));
      photoPath = `${session.profile.university_id}/${session.user.id}/id.jpg`;
      const upload = await session.supabase.storage.from("identity-docs").upload(photoPath, cleaned, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (upload.error) photoPath = null;
    } catch (error) {
      if (error instanceof PhotoError) return { ok: false, error: error.message };
      photoPath = null;
    }
  }
  const { error } = await session.supabase.rpc("request_manual_approval", {
    p_matric: matric,
    p_id_photo_path: photoPath,
  });
  if (error) return { ok: false, error: friendly(error.message, "Could not file that request") };
  revalidatePath("/pending");
  return { ok: true, message: "Request sent. A Room admin will approve or decline it." };
}

function friendly(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  const text = message.replace(/^.*?:\s*/, "");
  if (/reason/i.test(text) || /resolution note/i.test(text) || /forbidden/i.test(text) || /already/i.test(text)) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return fallback;
}
