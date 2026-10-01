import { createClient } from "npm:@supabase/supabase-js@2";
export const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
export async function userClient(req: Request) {
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return { client, user: data.user };
}
export async function modelJSON(
  system: string,
  input: string,
): Promise<unknown> {
  const providers = [
    {
      key: Deno.env.get("GEMINI_API_KEY"),
      url: `https://generativelanguage.googleapis.com/v1beta/models/${Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash"}:generateContent`,
      gemini: true,
    },
    {
      key: Deno.env.get("GROQ_API_KEY"),
      url: "https://api.groq.com/openai/v1/chat/completions",
      gemini: false,
    },
  ];
  for (const p of providers) {
    if (!p.key) continue;
    try {
      const res = await fetch(p.url, {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: {
          "Content-Type": "application/json",
          ...(p.gemini
            ? { "x-goog-api-key": p.key }
            : { Authorization: `Bearer ${p.key}` }),
        },
        body: JSON.stringify(
          p.gemini
            ? {
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: "user", parts: [{ text: input }] }],
                generationConfig: {
                  temperature: 0,
                  responseMimeType: "application/json",
                },
              }
            : {
                model: Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile",
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: input },
                ],
              },
        ),
      });
      if (!res.ok) continue;
      const body = await res.json();
      return JSON.parse(
        p.gemini
          ? body.candidates?.[0]?.content?.parts?.[0]?.text
          : body.choices?.[0]?.message?.content,
      );
    } catch {
      /* A failed provider must never cause a partial write. */
    }
  }
  throw new Error(
    "Smart entry is temporarily unavailable. Your draft is safe; retry or use the form.",
  );
}
