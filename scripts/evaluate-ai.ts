// Runs the real provider without writing transactions. No keys are read from VITE_*.
import { readFileSync } from "node:fs";
import {
  parserPrompt,
  validatePayload,
  resolveDate,
  type Context,
} from "../supabase/functions/_shared/validation.ts";
const cases = JSON.parse(
  readFileSync(new URL("../tests/ai-evaluation.json", import.meta.url), "utf8"),
);
const categories = [
  "Food",
  "Salary",
  "Fuel",
  "Transport",
  "Groceries",
  "SIP",
  "Rent",
  "Refund",
  "Utilities",
].map((name, i) => ({
  id: String(i),
  name,
  type: ["Salary", "Refund"].includes(name)
    ? "income"
    : name === "SIP"
      ? "investment"
      : "expense",
}));
const ctx: Context = {
  categories,
  groups: [{ id: "office", name: "Office", archived: false }],
  defaultGroupId: null,
  timezone: "Asia/Kolkata",
  now: "2026-09-30T12:00:00Z",
};
const key = process.env.GEMINI_API_KEY;
if (!key)
  throw new Error("GEMINI_API_KEY is required to evaluate the real model.");
let passed = 0,
  unsafe = 0;
for (const test of cases) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? "gemini-2.5-flash"}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: parserPrompt(ctx) }] },
        contents: [{ role: "user", parts: [{ text: test.text }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Provider request failed: ${res.status}`);
  const data = await res.json();
  const result = validatePayload(
    JSON.parse(data.candidates[0].content.parts[0].text),
    ctx,
    test.text,
  );
  const ok = test.clarify
    ? result.questions.length > 0
    : result.questions.length === 0 &&
      result.items.length === test.expected.length &&
      test.expected.every((e: Record<string, unknown>, i: number) => {
        const item = result.items[i];
        return (
          item.amount === e.amount &&
          item.type === e.type &&
          (!e.category ||
            categories.find((c) => c.id === item.category_id)?.name ===
              e.category) &&
          (!e.group || item.group_id === "office") &&
          (!e.date || item.occurred_at === resolveDate(e.date, ctx)) &&
          (!e.counterparty || item.lending?.counterparty === e.counterparty) &&
          (!e.direction || item.lending?.direction === e.direction)
        );
      });
  if (ok) passed++;
  if (test.clarify && !result.questions.length) unsafe++;
  console.log(`${ok ? "PASS" : "FAIL"} ${test.text}`);
}
console.log(
  `${passed}/${cases.length} (${((passed / cases.length) * 100).toFixed(1)}%), unsafe auto-saves: ${unsafe}`,
);
if (passed / cases.length < 0.95 || unsafe) process.exitCode = 1;
