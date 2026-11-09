import { notFound } from "next/navigation";
import { HIDDEN_ADMIN_PATH, adminRouteStatus } from "@/lib/admin-gate";
import { getSession } from "@/lib/session";

export default async function HiddenAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const status = adminRouteStatus(HIDDEN_ADMIN_PATH, {
    signedIn: Boolean(session.user),
    verified: session.profile?.verification_status === "verified",
    roles: session.roles,
    universityId: session.profile?.university_id ?? null,
  });
  if (status === 404) notFound();
  return children;
}
