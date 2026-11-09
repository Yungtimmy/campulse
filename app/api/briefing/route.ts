import { NextResponse } from "next/server";
import { z } from "zod";
import { loadFeed } from "@/lib/data";
import { includeDemoPulse } from "@/lib/env";
import { briefingSentences, narrativeUsesOnlyFacts, roomFacts } from "@/lib/facts";
import { groqJson } from "@/lib/groq";
import { loadPulse } from "@/lib/pulse-load";
import { getSession, isAdminOf, universityBySlug } from "@/lib/session";

const bodySchema = z.object({ slug: z.string().min(1).max(80) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.supabase || !session.user || session.profile?.verification_status !== "verified") {
    return NextResponse.json({ error: "Sign in as a Room admin" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing room" }, { status: 400 });

  const uni = await universityBySlug(session.supabase, parsed.data.slug);
  if (!uni || !isAdminOf(session.roles, uni.id)) {
    return NextResponse.json({ error: "Only a Room admin can generate a briefing" }, { status: 403 });
  }

  const incidents = await loadFeed(session.supabase, uni.id);
  const { result } = await loadPulse(session.supabase, uni.id, includeDemoPulse());
  const facts = roomFacts(incidents, result, {
    ackTargetHours: uni.ack_target_hours,
    resolveTargetDays: uni.resolve_target_days,
  });
  const fallback = briefingSentences(facts);

  const completion = await groqJson(
    'You write a short campus briefing for university administrators. Use only numbers and names that appear in FACTS. Do not add any number, date, count, or percentage that is not in FACTS. Write 4 to 6 plain sentences. Do not use an exclamation mark. The summary is advisory. If a figure is missing, omit it. Return JSON {"briefing":"..."} and nothing else.',
    `FACTS:\n${JSON.stringify(facts)}`,
  );
  const raw = completion?.data;
  const narrative = typeof raw === "object" && raw && "briefing" in raw && typeof (raw as { briefing: unknown }).briefing === "string"
    ? (raw as { briefing: string }).briefing
    : typeof raw === "object" && raw && "summary" in raw && typeof (raw as { summary: unknown }).summary === "string"
      ? (raw as { summary: string }).summary
      : null;

  if (!narrative || !narrativeUsesOnlyFacts(narrative, facts)) {
    return NextResponse.json({ narrative: fallback, source: "records", includesDemo: facts.includesDemo });
  }
  return NextResponse.json({ narrative, source: "groq", includesDemo: facts.includesDemo });
}
