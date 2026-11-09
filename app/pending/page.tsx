import { redirect } from "next/navigation";
import { Blobs, SetupNotice } from "@/components/chrome";
import { getSession } from "@/lib/session";
import { PendingForm } from "./pending-form";

export default async function PendingPage() {
  const session = await getSession();
  if (!session.configured) return <SetupNotice />;
  if (!session.user) redirect("/signin");
  if (session.profile?.verification_status === "verified") redirect("/room/funaab");
  if (!session.profile?.registered_at && session.profile?.verification_status !== "rejected") redirect("/register");
  const rejected = session.profile?.verification_status === "rejected";

  return (
    <>
      <Blobs />
      <main className="app auth" style={{ paddingBottom: 48 }}>
        <header className="top">
          <span className="room-pill">FUNAAB Room</span>
          <span className="wordmark">Campulse</span>
        </header>
        <section className="page-head" style={{ paddingTop: 32 }}>
          <h1>{rejected ? "Access revoked" : "Waiting for a Room admin"}</h1>
          <p>
            {rejected
              ? "A FUNAAB Room admin revoked this account. You can request manual approval. Until it is approved, the Room stays empty."
              : "This account is not in the FUNAAB Room yet. A Room admin can approve the request below."}
          </p>
        </section>
        <PendingForm email={session.user.email ?? "your email"} matric={session.profile?.matric_number ?? ""} />
      </main>
    </>
  );
}
