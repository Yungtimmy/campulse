import { Blobs } from "@/components/chrome";
import { publicEnv } from "@/lib/env";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/room/funaab";
  return (
    <>
      <Blobs />
      <main className="app auth" style={{ paddingBottom: 48 }}>
        <header className="top">
          <span className="room-pill">FUNAAB Room</span>
          <span className="wordmark">Campulse</span>
        </header>
        <section className="page-head" style={{ paddingTop: 32 }}>
          <h1>Join the FUNAAB Room</h1>
          <p>A confirmed email joins the Room. Only members of this Room can read and post reports here.</p>
        </section>
        {params.error === "link" ? (
          <p className="err" style={{ marginTop: 16 }}>That sign-in link expired. Request a new code.</p>
        ) : null}
        <SignInForm next={next} configured={publicEnv() !== null} />
      </main>
    </>
  );
}
