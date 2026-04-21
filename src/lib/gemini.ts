// Thin REST wrapper for Google Gemini. No SDK needed — avoids an extra dep
// and keeps the bundle small. The API accepts browser calls with an API key,
// which is acceptable here only because SpendWise is a solo-use app.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function isGeminiEnabled(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

export function getGeminiModel(): string {
  return import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-2.5-flash';
}

export interface GeminiJSONArgs {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}

export async function callGeminiJSON({
  system,
  user,
  model,
  temperature = 0,
}: GeminiJSONArgs): Promise<string | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) return null;

  const modelName = model ?? getGeminiModel();
  const url = `${BASE}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ?? null;
}
