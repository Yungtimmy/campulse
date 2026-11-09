import "server-only";
import { notFound, redirect } from "next/navigation";
import { ForeignRoom, SetupNotice } from "@/components/chrome";
import { HIDDEN_ADMIN_PATH, adminRouteStatus } from "@/lib/admin-gate";
import { getSession, hasAdminRole, universityBySlug } from "@/lib/session";

export async function requireRoom(slug: string) {
  const session = await getSession();
  if (!session.configured || !session.supabase) {
    return { ok: false as const, view: <SetupNotice /> };
  }
  if (!session.user) redirect("/signin");
  if (session.profile?.verification_status === "rejected") redirect("/pending");
  if (session.profile?.verification_status !== "verified") {
    redirect(session.profile?.registered_at ? "/pending" : "/register");
  }
  if (!session.profile.university_id) redirect("/pending");
  const uni = await universityBySlug(session.supabase, slug);
  const { data: homeUni } = await session.supabase
    .from("universities")
    .select("slug")
    .eq("id", session.profile.university_id)
    .maybeSingle();
  const home = `/room/${homeUni?.slug ?? "funaab"}`;
  if (!uni || uni.id !== session.profile.university_id) {
    return { ok: false as const, view: <ForeignRoom home={home} /> };
  }
  return {
    ok: true as const,
    session,
    uni,
    supabase: session.supabase,
    showAdmin: hasAdminRole(session.roles),
  };
}

export async function requireAdmin(slug: string) {
  const session = await getSession();
  const uni = session.supabase ? await universityBySlug(session.supabase, slug) : null;
  const status = adminRouteStatus(`${HIDDEN_ADMIN_PATH}/${slug}`, {
    signedIn: Boolean(session.user),
    verified: session.profile?.verification_status === "verified",
    roles: session.roles,
    universityId: uni?.id ?? null,
  });
  if (status === 404 || !session.supabase || !uni) notFound();
  return { session, uni, supabase: session.supabase };
}
