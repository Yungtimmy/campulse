import { NextResponse } from "next/server";
import { z } from "zod";
import { groqJson } from "@/lib/groq";
import { CATEGORIES } from "@/lib/labels";
import { getSession } from "@/lib/session";

const inputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(2000),
});

const categoryIds = CATEGORIES.map((category) => category.id) as [string, ...string[]];

const outputSchema = z.object({
  category: z.enum(categoryIds),
  severity: z.enum(["low", "medium", "high", "critical"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  summary: z.string().trim().min(1).max(120),
  duplicate_of: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.user || session.profile?.verification_status !== "verified" || !session.supabase) {
    return NextResponse.json({ suggestion: null }, { status: 401 });
  }
  if (limited(session.user.id)) {
    return NextResponse.json({ suggestion: null }, { status: 429 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ suggestion: null }, { status: 400 });

  const { data: candidates } = await session.supabase.rpc("match_open_incidents", {
    p_query: `${parsed.data.title}\n${parsed.data.description}`,
  });
  const open = (candidates ?? []) as Array<{
    id: string;
    title: string;
    category: string;
    public_code: string;
  }>;
  const allowed = new Set(open.map((row) => row.id));

  const completion = await groqJson(
    "You classify campus problem reports. Your output is advisory only. Do not assert allegations as facts. Do not invent counts, names, or places. Return JSON with keys category, severity, priority, summary, duplicate_of, confidence. category must be one of: electricity, water_supply, infrastructure, sanitation, accommodation, security, academic_facilities, other. severity must be low, medium, high, or critical. priority must be low, normal, high, or urgent. summary is one short neutral phrase under 80 characters. duplicate_of is an array of incident ids copied only from the candidate list, or empty. confidence is a number from 0 to 1.",
    `Candidates:\n${open.map((row) => `- ${row.id} | ${row.public_code} | ${row.category} | ${row.title}`).join("\n") || "(none)"}\n\nTitle: ${parsed.data.title}\nDescription: ${parsed.data.description}`,
  );

  const suggestion = outputSchema.safeParse(completion?.data);
  if (!suggestion.success) return NextResponse.json({ suggestion: null });

  const duplicateId = suggestion.data.duplicate_of.find((id) => allowed.has(id)) ?? null;
  let duplicate: { id: string; title: string; publicCode: string; status: string; affected: number } | null = null;
  if (duplicateId) {
    const { data } = await session.supabase.from("incident_feed").select("id, title, public_code, status, affected_count").eq("id", duplicateId).maybeSingle();
    if (data) {
      duplicate = {
        id: data.id as string,
        title: data.title as string,
        publicCode: data.public_code as string,
        status: data.status as string,
        affected: data.affected_count as number,
      };
    }
  }

  return NextResponse.json({
    suggestion: {
      ...suggestion.data,
      duplicate_of: duplicate ? [duplicate.id] : [],
      duplicate,
      model: completion?.model ?? "llama-3.3-70b-versatile",
      prompt_version: "classify-v1",
    },
  });
}

function limited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 10) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}
