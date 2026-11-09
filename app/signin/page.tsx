import type { Metadata } from "next";
import { Blobs } from "@/components/chrome";
import { publicEnv } from "@/lib/env";
import { safeNext } from "@/lib/registration";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in · Campulse",
  description: "Sign in and verify your FUNAAB affiliation.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
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
          <p>Sign in with Google. Only members of this Room can read and post reports here.</p>
        </section>
        {params.error === "link" ? (
          <p className="err" style={{ marginTop: 16 }}>Google sign-in did not finish. Try again.</p>
        ) : null}
        <SignInForm next={next} configured={publicEnv() !== null} />
      </main>
    </>
  );
}
