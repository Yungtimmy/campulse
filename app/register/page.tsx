import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Blobs, SetupNotice } from "@/components/chrome";
import { getSession } from "@/lib/session";
import { googleDisplayName, initials, safeNext } from "@/lib/registration";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Your profile · Campulse",
  description: "Complete your Campulse profile.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const session = await getSession();
  if (!session.configured) return <SetupNotice />;
  if (!session.user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  if (session.profile?.verification_status === "rejected") redirect("/pending");
  if (session.profile?.registered_at || session.profile?.verification_status === "verified") redirect(next);

  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const fullName = session.profile?.display_name || googleDisplayName(meta, session.user.email);
  const email = session.user.email ?? "Google account";

  return (
    <>
      <Blobs />
      <main className="app auth" style={{ paddingBottom: 48 }}>
        <header className="top">
          <span className="room-pill">FUNAAB Room</span>
          <span className="wordmark">Campulse</span>
        </header>
        <section className="page-head" style={{ paddingTop: 32 }}>
          <h1>Tell us who you are</h1>
          <p>One short step, then you are in the FUNAAB Room.</p>
        </section>
        <RegisterForm next={next} fullName={fullName} email={email} initials={initials(fullName, session.user.email)} />
      </main>
    </>
  );
}
