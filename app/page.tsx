import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/chrome";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (!session.configured || !session.supabase) return <SetupNotice />;
  if (!session.user) redirect("/signin");
  if (session.profile?.verification_status !== "verified" || !session.profile.university_id) {
    redirect("/pending");
  }
  const { data: uni } = await session.supabase
    .from("universities")
    .select("slug")
    .eq("id", session.profile.university_id)
    .maybeSingle();
  redirect(`/room/${uni?.slug ?? "funaab"}`);
}
