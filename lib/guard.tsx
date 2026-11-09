import "server-only";
import { redirect } from "next/navigation";
import { ForeignRoom, SetupNotice } from "@/components/chrome";
import { getSession, isAdminOf, universityBySlug } from "@/lib/session";

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
  return { ok: true as const, session, uni, supabase: session.supabase };
}

export async function requireAdmin(slug: string) {
  const session = await getSession();
  if (!session.configured || !session.supabase) {
    return { ok: false as const, view: <SetupNotice /> };
  }
  if (!session.user) redirect("/signin");
  if (session.profile?.verification_status === "rejected") redirect("/pending");
  if (session.profile?.verification_status !== "verified") {
    redirect(session.profile?.registered_at ? "/pending" : "/register");
  }
  const uni = await universityBySlug(session.supabase, slug);
  if (!uni || !isAdminOf(session.roles, uni.id)) redirect("/room/funaab");
  return { ok: true as const, session, uni, supabase: session.supabase };
}
