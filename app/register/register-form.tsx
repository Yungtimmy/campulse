"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CollegeDepartmentFields } from "@/components/college-department-fields";
import { levelsFor, type Level } from "@/lib/campus";
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
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const levels = faculty ? levelsFor(faculty, department) : [];

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
        <CollegeDepartmentFields
          required
          faculty={faculty}
          department={department}
          onFacultyChange={(next) => {
            setFaculty(next);
            setDepartment("");
            setLevel("");
          }}
          onDepartmentChange={(next) => {
            setDepartment(next);
            if (!(levelsFor(faculty, next) as readonly string[]).includes(level)) setLevel("");
          }}
        />
        <div className="field">
          <label htmlFor="level">Level</label>
          <select
            id="level"
            name="level"
            value={levels.includes(level as Level) ? level : ""}
            required
            disabled={!faculty}
            className={faculty ? undefined : "wait"}
            onChange={(event) => setLevel(event.target.value)}
          >
            {faculty ? (
              <>
                <option value="">Choose your level</option>
                {levels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </>
            ) : (
              <option value="">Pick your college first</option>
            )}
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
