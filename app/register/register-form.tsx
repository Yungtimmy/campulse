"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FACULTIES, LEVELS, STUDENT_DEPARTMENTS } from "@/lib/campus";
import { completeRegistration } from "@/lib/actions";

export function RegisterForm({
  next,
  fullName,
  email,
  initials,
}: {
  next: string;
  fullName: string;
  email: string;
  initials: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await completeRegistration(new FormData(event.currentTarget));
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <section className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingBottom: 16,
            borderBottom: "1px solid var(--cp-line, rgba(0,0,0,.08))",
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--cp-indigo-50, #e8e5fa)",
              color: "var(--cp-indigo, #1800ac)",
              display: "grid",
              placeItems: "center",
              fontWeight: 600,
            }}
            aria-hidden="true"
          >
            {initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: "block", fontSize: 15 }}>Signed in with Google</b>
            <span className="cap" style={{ fontFamily: "var(--cp-mono, monospace)" }}>
              {email}
            </span>
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="full-name">Full name</label>
          <input id="full-name" name="fullName" type="text" defaultValue={fullName} autoComplete="name" required />
          <span className="hint">Filled from Google. Change it if it&apos;s not the name you use on campus.</span>
        </div>
        <div className="field">
          <label htmlFor="faculty">Faculty</label>
          <select id="faculty" name="faculty" defaultValue="" required>
            <option value="" disabled>
              Choose your faculty
            </option>
            {FACULTIES.map((faculty) => (
              <option key={faculty} value={faculty}>
                {faculty}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="department">Department</label>
          <select id="department" name="department" defaultValue="" required>
            <option value="" disabled>
              Choose your department
            </option>
            {STUDENT_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="level">Level</label>
          <select id="level" name="level" defaultValue="" required>
            <option value="" disabled>
              Choose your level
            </option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="matric">
            Matric number <span style={{ fontWeight: 400, color: "var(--cp-ink-3)" }}>(optional)</span>
          </label>
          <input id="matric" name="matric" type="text" placeholder="Matric number" inputMode="numeric" />
          <span className="hint">
            Helps admins confirm you if a report needs follow-up. Never shown to other students.
          </span>
        </div>
        {error ? <p className="err" style={{ marginTop: 12 }}>{error}</p> : null}
        <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 24 }} disabled={busy}>
          Join the FUNAAB Room
        </button>
      </section>
      <p className="cap" style={{ textAlign: "center" }}>
        You can edit these later in your profile. Anonymous reports still hide your name.
      </p>
    </form>
  );
}
