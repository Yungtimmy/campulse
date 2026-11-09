import "server-only";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AdminRole, Profile, University } from "@/lib/types";

export async function getSession() {
  if (!publicEnv()) {
    return {
      configured: false as const,
      supabase: null,
      user: null,
      profile: null as Profile | null,
      roles: [] as AdminRole[],
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { configured: true as const, supabase, user: null, profile: null, roles: [] as AdminRole[] };
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const { data: roles } = await supabase.from("admin_roles").select("*").eq("profile_id", user.id);
  return {
    configured: true as const,
    supabase,
    user,
    profile: (profile as Profile | null) ?? null,
    roles: (roles ?? []) as AdminRole[],
  };
}

export function isAdminOf(roles: AdminRole[], universityId: string): boolean {
  return roles.some(
    (role) => role.role === "super_admin" || (role.role === "university_admin" && role.university_id === universityId),
  );
}

export function hasAdminRole(roles: AdminRole[]): boolean {
  return roles.some((role) => role.role === "super_admin" || role.role === "university_admin");
}

export async function universityBySlug(
  supabase: NonNullable<Awaited<ReturnType<typeof getSession>>["supabase"]>,
  slug: string,
): Promise<University | null> {
  const { data } = await supabase.from("universities").select("*").eq("slug", slug).maybeSingle();
  return (data as University | null) ?? null;
}
