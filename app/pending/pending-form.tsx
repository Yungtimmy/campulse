"use client";

import { useState } from "react";
import { IconId } from "@/components/icons";
import { requestManualApproval } from "@/lib/actions";

export function PendingForm({ email, matric }: { email: string; matric: string }) {
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function onSubmit(formData: FormData) {
    const result = await requestManualApproval(formData);
    setOk(result.ok);
    setMessage(result.ok ? result.message ?? "Request sent." : result.error);
  }

  return (
    <form className="stack" action={onSubmit}>
      <section className="card">
        <h2>Request manual approval</h2>
        <p className="hint" style={{ marginTop: 8 }}>
          Signed in as {email}. A Room admin approves or declines this request.
        </p>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="matric">Matric number</label>
          <input id="matric" name="matric" type="text" placeholder="Matric number" defaultValue={matric} />
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
        <button className="btn btn-primary btn-block btn-md" type="submit" style={{ marginTop: 20 }}>
          Request manual approval
        </button>
        {message ? <p className={ok ? "hint" : "err"} style={{ marginTop: 12 }}>{message}</p> : null}
        <p className="cap" style={{ marginTop: 12 }}>
          Default, pending founder · manual approval is a backup, not the usual path
        </p>
      </section>
    </form>
  );
}
