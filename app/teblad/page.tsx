import { notFound, redirect } from "next/navigation";
import { HIDDEN_ADMIN_PATH, adminRouteStatus } from "@/lib/admin-gate";
import { getSession } from "@/lib/session";

export default async function HiddenAdminEntry() {
  const session = await getSession();
  const status = adminRouteStatus(HIDDEN_ADMIN_PATH, {
    signedIn: Boolean(session.user),
    verified: session.profile?.verification_status === "verified",
    roles: session.roles,
    universityId: session.profile?.university_id ?? null,
  });
  if (status === 404 || !session.supabase) notFound();

  const role =
    session.roles.find((item) => item.role === "university_admin" && item.university_id) ??
    session.roles.find((item) => item.role === "super_admin");
  if (!role) notFound();
  let slug = "funaab";
  if (role.university_id) {
    const { data } = await session.supabase
      .from("universities")
      .select("slug")
      .eq("id", role.university_id)
      .maybeSingle();
    if (!data?.slug) notFound();
    slug = data.slug;
  }
  redirect(`${HIDDEN_ADMIN_PATH}/${slug}`);
}
