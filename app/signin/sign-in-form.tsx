"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconId, IconSend } from "@/components/icons";
import { requestManualApproval } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  async function sendCode(target = email) {
    setError("");
    setInfo("");
    if (!configured) {
      setError("Supabase environment variables are not set");
      return;
    }
    const address = target.trim().toLowerCase();
    if (!address.includes("@")) {
      setError("Enter the email you want the code sent to");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        data: { university_slug: "funaab" },
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (otpError) {
      setError("The code could not be sent. Try again in a moment.");
      return;
    }
    setEmail(address);
    setSentTo(address);
    setDigits(["", "", "", "", "", ""]);
    setInfo("Code sent. It expires in 10 minutes.");
  }

  async function verify(code: string) {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setBusy(false);
    if (verifyError) {
      setError("That code did not match. Request a new one if it expired.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  function onDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = clean;
    setDigits(nextDigits);
    if (clean && index < 5) inputs.current[index + 1]?.focus();
    const code = nextDigits.join("");
    if (code.length === 6 && nextDigits.every(Boolean)) void verify(code);
  }

  async function onManual(formData: FormData) {
    setManualMessage("");
    const result = await requestManualApproval(formData);
    setManualMessage(result.ok ? result.message ?? "Request sent." : result.error);
  }

  const masked = sentTo ? maskEmail(sentTo) : "";

  return (
    <div className="stack">
      <section className="card">
        <div className="steps">
          <b>Step 1 of 2</b>
          <span>·</span>
          <span>Your email</span>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="university">University</label>
          <select id="university" disabled defaultValue="funaab">
            <option value="funaab">FUNAAB</option>
          </select>
          <span className="hint">V1 opens one Room. More universities later.</span>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <span className="hint">We send a 6-digit code to confirm it is yours.</span>
        </div>
        {error && !sentTo ? <p className="err" style={{ marginTop: 12 }}>{error}</p> : null}
        <button className="btn btn-primary btn-block" type="button" style={{ marginTop: 24 }} disabled={busy} onClick={() => void sendCode()}>
          <IconSend />
          Send code
        </button>
      </section>

      <section className="card">
        <div className="steps">
          <b>Step 2 of 2</b>
          <span>·</span>
          <span>Enter code</span>
        </div>
        <p style={{ marginTop: 12, fontSize: 14, color: "var(--cp-ink-2)" }}>
          {sentTo ? (
            <>
              We sent a 6-digit code to <b style={{ color: "var(--cp-ink)", fontWeight: 600 }}>{masked}</b>. It expires in 10 minutes.
            </>
          ) : (
            "The code appears here after you send it. A confirmed code joins the FUNAAB Room."
          )}
        </p>
        <div className="otp" style={{ marginTop: 16 }} role="group" aria-label="6-digit code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(node) => {
                inputs.current[index] = node;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              aria-label={`Digit ${index + 1}`}
              onChange={(event) => onDigit(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 14 }}>
          <span className="cap">{info || "Resend after the code arrives"}</span>
          <button
            className="link-btn"
            type="button"
            style={{ fontSize: 14 }}
            onClick={() => {
              setSentTo("");
              setDigits(["", "", "", "", "", ""]);
              setError("");
            }}
          >
            Use a different email
          </button>
        </div>
        {error && sentTo ? <p className="err" style={{ marginTop: 12 }}>{error}</p> : null}
        <p className="hint" style={{ marginTop: 12 }}>Or open the sign-in link in the same email.</p>
        {sentTo ? (
          <button className="link-btn" type="button" style={{ marginTop: 8 }} disabled={busy} onClick={() => void sendCode(sentTo)}>
            Resend code
          </button>
        ) : null}
      </section>

      <section className="card">
        <h2>Email not working?</h2>
        <p className="hint" style={{ marginTop: 8 }}>
          Request manual approval. A FUNAAB Room admin checks your details and approves or declines. Until then you will see a pending screen.
        </p>
        <form action={onManual}>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="matric">Matric number</label>
            <input id="matric" name="matric" type="text" placeholder="Matric number" />
          </div>
          <div className="field">
            <span className="label">
              Student ID photo <span style={{ fontWeight: 400, color: "var(--cp-ink-3)" }}>(optional)</span>
            </span>
            <label className="drop" style={{ fontWeight: 400 }}>
              <IconId />
              <span>
                <b>Add a photo of your ID</b>
                Stored privately. Only Room admins can view it.
              </span>
              <input type="file" name="idPhoto" accept="image/jpeg,image/png,image/webp" hidden />
            </label>
          </div>
          <button className="btn btn-outline btn-block btn-md" type="submit" style={{ marginTop: 20 }}>
            Request manual approval
          </button>
        </form>
        {manualMessage ? <p className="hint" style={{ marginTop: 12 }}>{manualMessage}</p> : null}
        <p className="cap" style={{ marginTop: 12 }}>
          A confirmed code joins the FUNAAB Room immediately. Manual approval is a backup if you are stuck, or if an admin has revoked access.
        </p>
      </section>

      <p style={{ textAlign: "center", fontSize: 14, color: "var(--cp-ink-3)" }}>
        University administrator? <a href={`/signin?next=${encodeURIComponent("/admin/funaab")}`} style={{ fontWeight: 600 }}>Admin sign in</a>
      </p>
    </div>
  );
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 1);
  return `${visible}${"•".repeat(Math.max(1, Math.min(4, name.length - 1)))}@${domain}`;
}
