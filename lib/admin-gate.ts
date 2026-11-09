import type { AdminRole } from "@/lib/types";

/** Unlisted admin entry. Do not render this for students or signed-out visitors. */
export const HIDDEN_ADMIN_PATH = "/teblad";

export type AdminAccess = {
  signedIn: boolean;
  verified: boolean;
  roles: Pick<AdminRole, "role" | "university_id">[];
  /** University that owns the slug in the path. Null when that slug does not exist. */
  universityId: string | null;
};

export function isRetiredAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export function isHiddenAdminPath(path: string): boolean {
  const base = HIDDEN_ADMIN_PATH;
  return path === base || path.startsWith(`${base}/`);
}

/** These paths must never redirect to sign-in. A miss is a 404. */
export function bypassesAuthRedirect(path: string): boolean {
  return isRetiredAdminPath(path) || isHiddenAdminPath(path);
}

/**
 * 404 for the retired /admin tree, and for the hidden admin tree unless the
 * caller is a verified admin of that room. 200 means this gate does not block.
 */
export function adminRouteStatus(path: string, access: AdminAccess): 404 | 200 {
  if (isRetiredAdminPath(path)) return 404;
  if (!isHiddenAdminPath(path)) return 200;
  if (!access.signedIn || !access.verified) return 404;
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 1) {
    return access.roles.some((role) => role.role === "super_admin" || role.role === "university_admin") ? 200 : 404;
  }
  const allowed = access.roles.some(
    (role) => role.role === "super_admin" || (role.role === "university_admin" && role.university_id === access.universityId),
  );
  return allowed && access.universityId ? 200 : 404;
}
