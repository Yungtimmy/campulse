import type { Metadata } from "next";
import Link from "next/link";
import { Blobs } from "@/components/chrome";

export const metadata: Metadata = {
  title: "Page not found · Campulse",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Blobs />
      <main className="app">
        <header className="top">
          <span className="room-pill">FUNAAB Room</span>
          <Link className="wordmark" href="/room/funaab">
            Campulse
          </Link>
        </header>
        <section className="nf">
          <span className="code">404</span>
          <h1>We can&apos;t find this page.</h1>
          <p className="lede">The link may be old or typed wrong.</p>
          <Link className="btn btn-primary" href="/room/funaab">
            Back to the Room
          </Link>
        </section>
      </main>
    </>
  );
}
