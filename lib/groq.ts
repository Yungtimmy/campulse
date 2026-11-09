import "server-only";

const PRIMARY = "llama-3.3-70b-versatile";
const FALLBACK = "llama-3.1-8b-instant";

export async function groqJson(
  system: string,
  user: string,
): Promise<{ data: unknown; model: string } | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  for (const model of [PRIMARY, FALLBACK]) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = payload.choices?.[0]?.message?.content;
      if (!text) continue;
      return { data: JSON.parse(text) as unknown, model };
    } catch {
      continue;
    }
  }
  return null;
}
