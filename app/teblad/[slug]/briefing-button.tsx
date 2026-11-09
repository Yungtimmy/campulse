"use client";

import { useState } from "react";

export function BriefingButton({
  slug,
  initial,
}: {
  slug: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [source, setSource] = useState<"records" | "groq">("records");
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    try {
      const response = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = (await response.json()) as { narrative?: string; source?: "records" | "groq" };
      if (payload.narrative) {
        setText(payload.narrative);
        setSource(payload.source ?? "records");
        setAt(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(new Date()));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span className="cap">{at ?? "From Room records"}</span>
        <button className="btn btn-sm btn-quiet" type="button" style={{ height: 32, fontSize: 13 }} disabled={busy} onClick={() => void regenerate()}>
          {busy ? "Writing" : "Regenerate"}
        </button>
      </div>
      <p>{text}</p>
      <div className="meta">
        <span className="tag adv">Advisory</span>
        <span className="cap">
          {source === "groq"
            ? "Figures come from Room records. AI only writes the sentences."
            : "These sentences are written from the Room counts, without an AI rewrite."}
        </span>
      </div>
    </>
  );
}
