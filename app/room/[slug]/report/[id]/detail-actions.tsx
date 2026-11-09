"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconInfo, IconNote, IconRefresh, IconUsers } from "@/components/icons";
import { addIncidentNote, confirmIncident, recordFix } from "@/lib/actions";

export function DetailActions({
  incidentId,
  status,
  alreadyReported,
  alreadyConfirmed,
  fixAnswer,
}: {
  incidentId: string;
  status: string;
  alreadyReported: boolean;
  alreadyConfirmed: boolean;
  fixAnswer: boolean | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [openNote, setOpenNote] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError("");
    const result = await confirmIncident(incidentId);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function sendNote() {
    setBusy(true);
    setError("");
    const result = await addIncidentNote(incidentId, note);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else {
      setNote("");
      setOpenNote(false);
      router.refresh();
    }
  }

  async function answer(still: boolean) {
    setBusy(true);
    setError("");
    const result = await recordFix(incidentId, still);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <>
      <section className="card">
        <div style={{ display: "grid", gap: 8 }}>
          {alreadyReported ? (
            <p className="hint">You already reported this incident, so it counts you once.</p>
          ) : alreadyConfirmed ? (
            <p className="hint">You confirmed this incident.</p>
          ) : (
            <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={() => void confirm()}>
              <IconUsers />
              Same issue for me
            </button>
          )}
          <button className="btn btn-quiet btn-block" type="button" onClick={() => setOpenNote((value) => !value)}>
            <IconNote />
            Add information
          </button>
          {openNote ? (
            <div className="field">
              <label htmlFor="extra">Additional information</label>
              <textarea id="extra" value={note} onChange={(event) => setNote(event.target.value)} />
              <button className="btn btn-md btn-outline" type="button" disabled={busy} onClick={() => void sendNote()}>
                Save note
              </button>
            </div>
          ) : null}
        </div>
        {error ? <p className="err" style={{ marginTop: 12 }}>{error}</p> : null}
        <div className="notice" style={{ marginTop: 16 }}>
          <IconInfo />
          <span>Confirmations show how many people are affected. They don&apos;t verify a report on their own; an admin does.</span>
        </div>
      </section>

      {status === "resolved" ? (
        <section className="card" aria-label="Is it fixed for you">
          <div className="card-head" style={{ marginBottom: 8 }}>
            <h2>Is it fixed for you?</h2>
            <span className="cap">Shown when Resolved</span>
          </div>
          <p className="hint">Your answer is recorded with the resolution. If it&apos;s still happening, the incident reopens and counts as recurring.</p>
          {fixAnswer === null ? (
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              <button className="btn btn-md btn-outline" type="button" disabled={busy} onClick={() => void answer(false)}>
                <IconCheck small />
                Yes, it&apos;s fixed
              </button>
              <button className="btn btn-md btn-quiet" type="button" disabled={busy} onClick={() => void answer(true)}>
                <IconRefresh />
                Still happening
              </button>
            </div>
          ) : (
            <p className="hint" style={{ marginTop: 12 }}>
              {fixAnswer ? "You said it is still happening. The incident is open again." : "You said it is fixed."}
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
