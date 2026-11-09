"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconClose, IconLock, IconShieldCheck } from "@/components/icons";
import { saveIncident } from "@/lib/actions";
import { CATEGORY_LABEL, DEPARTMENTS, formatWhen, PRIORITY_LABEL, SEVERITY_LABEL, STATUS_CLASS, STATUS_LABEL } from "@/lib/labels";
import type { AiSuggestion, FeedIncident } from "@/lib/types";

const STATUSES = ["submitted", "under_review", "verified", "in_progress", "resolved", "rejected"] as const;

export function AdminPanel({
  incident,
  slug,
  activity,
  clearHref,
}: {
  incident: FeedIncident | null;
  slug: string;
  activity: Array<{ at: string; text: string }>;
  clearHref: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(incident?.status ?? "submitted");
  const [severity, setSeverity] = useState(incident?.severity ?? "medium");
  const [department, setDepartment] = useState(incident?.assigned_department ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!incident) {
    return (
      <aside className="panel" aria-label="Selected report">
        <p className="hint">Select a report to review it.</p>
      </aside>
    );
  }

  const suggestion = incident.ai_suggestion as AiSuggestion | null;
  const needsNote = status === "rejected" || status === "resolved";

  async function save(nextStatus = status) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("incidentId", incident!.id);
    form.set("status", nextStatus);
    form.set("severity", severity);
    form.set("department", department);
    form.set("note", note);
    const result = await saveIncident(form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNote("");
    router.refresh();
  }

  return (
    <aside className="panel" aria-label="Selected report">
      <div className="ph">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="mono" style={{ color: "var(--cp-ink-3)" }}>{incident.public_code}</span>
        </div>
        <a className="icon-btn" href={clearHref} style={{ width: 32, height: 32, boxShadow: "none", background: "var(--cp-raised)" }} aria-label="Close panel">
          <IconClose />
        </a>
      </div>
      <div>
        <h2>{incident.title}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <span className={`status pill ${STATUS_CLASS[incident.status]}`}>{STATUS_LABEL[incident.status]}</span>
          <span className="cap" style={{ fontSize: 13 }}>
            {CATEGORY_LABEL[incident.category]} · {formatWhen(incident.opened_at)} · {incident.affected_count} affected
          </span>
        </div>
        <p className="desc" style={{ marginTop: 12 }}>{incident.description}</p>
      </div>

      {incident.is_anonymous ? (
        <div className="idbox">
          <IconLock />
          <span>
            <b>Anonymous reporter</b>
            <br />
            Identity is hidden in this view. Only a platform super admin can open it, and each access is logged.
          </span>
        </div>
      ) : (
        <p className="hint">Posted under the student&apos;s name. The protected identity record stays in report identities.</p>
      )}

      {suggestion ? (
        <div className="sect">
          <span className="label">AI suggestion · advisory</span>
          <dl className="kv" style={{ marginTop: 0, gridTemplateColumns: "88px 1fr", fontSize: 13 }}>
            <dt>Category</dt>
            <dd>{CATEGORY_LABEL[suggestion.category ?? ""] ?? suggestion.category}</dd>
            <dt>Severity</dt>
            <dd>{SEVERITY_LABEL[suggestion.severity ?? ""] ?? suggestion.severity}</dd>
            <dt>Priority</dt>
            <dd>{PRIORITY_LABEL[suggestion.priority ?? ""] ?? suggestion.priority}</dd>
            <dt>Duplicates</dt>
            <dd>{Math.max(0, incident.report_count - 1)} reports grouped here</dd>
          </dl>
        </div>
      ) : null}

      <div className="sect">
        <span className="label">Review</span>
        <div className="row">
          <button className="btn btn-md btn-outline" type="button" disabled={busy} onClick={() => { setStatus("verified"); void save("verified"); }}>
            <IconShieldCheck />
            Verify report
          </button>
        </div>
        <div className="frow">
          <span>Final severity</span>
          <select aria-label="Final severity" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="frow">
          <span>Assign to</span>
          <select aria-label="Assign to department" value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">Unassigned</option>
            {DEPARTMENTS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="sect">
        <span className="label">Status</span>
        <div className="sopts" role="radiogroup" aria-label="Status">
          {STATUSES.map((value) => (
            <label key={value} className={status === value ? "sopt on" : "sopt"}>
              <input type="radio" name="status" checked={status === value} onChange={() => setStatus(value)} />
              <span className={`status ${STATUS_CLASS[value]}`}>{STATUS_LABEL[value]}</span>
              <span className="cap" style={{ marginLeft: "auto" }}>
                {value === incident.status ? "Current" : value === "resolved" ? "Needs a resolution note" : value === "rejected" ? "Needs a reason" : ""}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="sect">
        <label className="label" htmlFor="note" style={{ fontSize: 12, fontWeight: 500, color: "var(--cp-ink-3)" }}>
          Internal note · admins only
        </label>
        <textarea id="note" value={note} placeholder={status === "rejected" ? "Reason for rejecting" : "Add a note for other admins"} onChange={(event) => setNote(event.target.value)} />
        <span className="cap">Resolution notes are shown to students once a report is Resolved. A rejection reason is shown too.</span>
      </div>

      {error ? <p className="err">{error}</p> : null}
      <button className="btn btn-primary btn-block btn-md" type="button" disabled={busy || (needsNote && note.trim().length === 0)} onClick={() => void save()}>
        Save changes
      </button>

      <div className="sect">
        <span className="label">Activity log</span>
        <ul className="audit">
          {activity.map((item) => (
            <li key={`${item.at}-${item.text}`}>
              <time>{formatWhen(item.at)}</time>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        <span className="cap">Every status change, assignment, rejection and identity access is logged.</span>
      </div>
      <p className="cap">
        <a href={`/room/${slug}/report/${incident.id}`}>Open the student view</a>
      </p>
    </aside>
  );
}
