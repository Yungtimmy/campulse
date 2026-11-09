"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ next, configured }: { next: string; configured: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function continueWithGoogle() {
    setError("");
    if (!configured) {
      setError("Supabase environment variables are not set");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) {
      setBusy(false);
      setError("Google sign-in could not start. Try again in a moment.");
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="field">
          <label htmlFor="university">University</label>
          <select id="university" disabled defaultValue="funaab">
            <option value="funaab">FUNAAB</option>
          </select>
          <span className="hint">V1 opens one Room. More universities later.</span>
        </div>
        <button
          className="btn btn-outline btn-block"
          type="button"
          style={{ marginTop: 20, gap: 10 }}
          disabled={busy}
          onClick={() => void continueWithGoogle()}
        >
          <GoogleMark />
          Continue with Google
        </button>
        {error ? <p className="err" style={{ marginTop: 12 }}>{error}</p> : null}
        <p className="hint" style={{ marginTop: 12 }}>
          First time here? You&apos;ll fill in a short profile next, then you&apos;re in the FUNAAB Room.
        </p>
      </section>
      <p className="cap" style={{ textAlign: "center" }}>
        We only use your Google name and email. Your name stays hidden on anonymous reports.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
