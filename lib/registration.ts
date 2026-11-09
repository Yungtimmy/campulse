import { FACULTIES, LEVELS, STUDENT_DEPARTMENTS, type Faculty, type Level, type StudentDepartment } from "./campus.ts";

export const DEFAULT_NEXT = "/room/funaab";

const MATRIC_MAX = 40;
const NAME_MAX = 80;

export type RegistrationInput = {
  fullName: string;
  faculty: string;
  department: string;
  level: string;
  matricNumber: string;
};

export type RegistrationValue = {
  fullName: string;
  faculty: Faculty;
  department: StudentDepartment;
  level: Level;
  matricNumber: string | null;
};

export function safeNext(value: string | null | undefined, fallback = DEFAULT_NEXT): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/auth") || value.startsWith("/signin") || value.startsWith("/register")) return fallback;
  if (/[\s\\]/.test(value)) return fallback;
  return value;
}

export function googleDisplayName(
  meta: Record<string, unknown> | null | undefined,
  email?: string | null,
): string {
  const full = textField(meta, "full_name") || textField(meta, "name") || textField(meta, "display_name");
  if (full) return full;
  const local = email?.split("@")[0]?.trim();
  return local || "";
}

export function initials(name: string, email?: string | null): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const local = email?.split("@")[0]?.replace(/[^a-z0-9]/gi, "") ?? "";
  return local.slice(0, 2).toUpperCase() || "?";
}

export function needsRegistration(profile: {
  registered_at: string | null;
  verification_status: string;
} | null): boolean {
  if (!profile) return true;
  if (profile.verification_status === "verified" || profile.verification_status === "rejected") return false;
  return profile.registered_at == null;
}

export function validateRegistration(
  input: RegistrationInput,
): { ok: true; value: RegistrationValue } | { ok: false; error: string } {
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2) return { ok: false, error: "Enter the name you use on campus" };
  if (fullName.length > NAME_MAX) return { ok: false, error: "That name is too long" };

  if (!isListed(FACULTIES, input.faculty)) return { ok: false, error: "Choose your faculty" };
  if (!isListed(STUDENT_DEPARTMENTS, input.department)) return { ok: false, error: "Choose your department" };
  if (!isListed(LEVELS, input.level)) return { ok: false, error: "Choose your level" };

  const matric = input.matricNumber.trim();
  if (matric.length > MATRIC_MAX) return { ok: false, error: "Matric number is too long" };

  return {
    ok: true,
    value: {
      fullName,
      faculty: input.faculty,
      department: input.department,
      level: input.level,
      matricNumber: matric.length > 0 ? matric : null,
    },
  };
}

function textField(meta: Record<string, unknown> | null | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function isListed<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}
