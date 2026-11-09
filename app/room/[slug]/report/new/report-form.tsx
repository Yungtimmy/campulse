"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryIcon, IconCamera, IconCheck, IconCopy, IconEyeOff, IconPencil, IconScan, IconUser } from "@/components/icons";
import { submitReport } from "@/lib/actions";
import { CATEGORIES, STATUS_LABEL } from "@/lib/labels";
import type { AiSuggestion } from "@/lib/types";

type Duplicate = {
  id: string;
  title: string;
  publicCode: string;
  status: string;
  affected: number;
};

type Suggestion = AiSuggestion & { duplicate: Duplicate | null };

export function ReportForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const categoryTouched = useRef(false);

  useEffect(() => {
    if (title.trim().length < 8 || description.trim().length < 20) {
      setSuggestion(null);
      return;
    }
    const handle = setTimeout(() => {
      void fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      })
        .then(async (response) => {
          const payload = (await response.json()) as { suggestion: Suggestion | null };
          setSuggestion(payload.suggestion);
          if (payload.suggestion?.category && !categoryTouched.current) {
            setCategory(payload.suggestion.category);
          }
        })
        .catch(() => setSuggestion(null));
    }, 700);
    return () => clearTimeout(handle);
  }, [title, description]);

  async function onSubmit(formData: FormData) {
    setError("");
    setBusy(true);
    formData.set("anonymous", anonymous ? "1" : "0");
    formData.set("category", category);
    formData.set("duplicateOf", duplicateOf ?? "");
    if (suggestion) {
      const stored: AiSuggestion = {
        category: suggestion.category,
        severity: suggestion.severity,
        priority: suggestion.priority,
        summary: suggestion.summary,
        duplicate_of: suggestion.duplicate_of,
        confidence: suggestion.confidence,
        model: suggestion.model,
        prompt_version: suggestion.prompt_version,
      };
      formData.set("suggestion", JSON.stringify(stored));
    }
    const result = await submitReport(formData);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/room/${slug}/report/${result.id}`);
    router.refresh();
  }

  return (
    <form className="stack" action={onSubmit}>
      <section className="card">
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" type="text" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} />
          <span className="count tnum">{title.length} / 80</span>
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />
          <span className="hint">Say where, since when, and who is affected.</span>
        </div>
        <div className="field">
          <label htmlFor="location">Where</label>
          <input id="location" name="location" type="text" maxLength={80} value={location} placeholder="Block, road, or hall" onChange={(event) => setLocation(event.target.value)} />
          <span className="hint">Optional. Used only to notice when the same place has the problem again.</span>
        </div>
      </section>

      {suggestion ? (
        <section className="ai" aria-live="polite">
          <div className="ai-head">
            <IconScan />
            AI suggestion
            <span className="tag adv">Advisory</span>
          </div>
          <dl className="kv">
            <dt>Category</dt>
            <dd>{CATEGORIES.find((item) => item.id === suggestion.category)?.label ?? suggestion.category}</dd>
            <dt>Severity</dt>
            <dd style={{ textTransform: "capitalize" }}>{suggestion.severity}</dd>
            <dt>Priority</dt>
            <dd style={{ textTransform: "capitalize" }}>{suggestion.priority}</dd>
            <dt>Summary</dt>
            <dd>{suggestion.summary}</dd>
          </dl>
          {suggestion.duplicate ? (
            <div className="dup">
              <IconCopy />
              <div>
                <b>Possible duplicate</b>
                <br />
                {suggestion.duplicate.title} · {suggestion.duplicate.affected} affected · {STATUS_LABEL[suggestion.duplicate.status] ?? suggestion.duplicate.status}
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <button type="button" className="link-btn" onClick={() => setDuplicateOf(suggestion.duplicate?.id ?? null)}>
                    Confirm it
                  </button>
                  <button type="button" className="link-btn" style={{ color: "var(--cp-ink-2)" }} onClick={() => setDuplicateOf(null)}>
                    It&apos;s different
                  </button>
                </div>
                {duplicateOf ? <p className="hint" style={{ marginTop: 8 }}>This report will be grouped with {suggestion.duplicate.publicCode}.</p> : null}
              </div>
            </div>
          ) : null}
          <div className="ai-actions">
            <button type="button" className="btn btn-sm btn-outline" onClick={() => suggestion.category && setCategory(suggestion.category)}>
              <IconCheck small />
              Accept
            </button>
            <button type="button" className="btn btn-sm btn-quiet" style={{ height: 36 }} onClick={() => setCategory("")}>
              <IconPencil />
              Edit
            </button>
          </div>
          <p className="ai-note">You choose the final category. An admin sets the final severity. Suggestions never confirm a report.</p>
        </section>
      ) : null}

      <section className="card">
        <div className="field">
          <span className="label" id="category-label">Category</span>
          <div className="cats" role="group" aria-labelledby="category-label">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={category === item.id ? "cat on" : "cat"}
                aria-pressed={category === item.id}
                onClick={() => {
                  categoryTouched.current = true;
                  setCategory(item.id);
                }}
              >
                <CategoryIcon category={item.id} small />
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">
            Photo <span style={{ fontWeight: 400, color: "var(--cp-ink-3)" }}>(optional)</span>
          </span>
          <label className="drop" style={{ fontWeight: 400 }}>
            <IconCamera />
            <span>
              <b>{photoName || "Add a photo"}</b>
              JPG or PNG. Location data is removed on upload.
            </span>
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="field">
          <span className="label" id="post-as">Post as</span>
          <div className="seg" role="radiogroup" aria-labelledby="post-as">
            <button type="button" role="radio" aria-checked={!anonymous} className={anonymous ? undefined : "on"} onClick={() => setAnonymous(false)}>
              <IconUser />
              Normal
            </button>
            <button type="button" role="radio" aria-checked={anonymous} className={anonymous ? "on" : undefined} onClick={() => setAnonymous(true)}>
              <IconEyeOff />
              Anonymous
            </button>
          </div>
          <p className="hint">
            Anonymous hides your name from students and routine admin views. Campulse keeps a protected record for verification and abuse prevention, open only to platform administrators and logged on every access.
          </p>
        </div>
      </section>

      {error ? <p className="err">{error}</p> : null}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        Submit report
      </button>
      <p className="cap" style={{ textAlign: "center", marginTop: -4 }}>
        Target: acknowledged within 48 hours · <span title="Default — pending founder">default, pending founder</span>
      </p>
    </form>
  );
}
