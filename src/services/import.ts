import { callGeminiJSON, isGeminiEnabled } from '@/lib/gemini';
import { getGroq, getGroqModel } from '@/lib/groq';
import { buildSystemPrompt, resolveOccurredAt } from './parser/prompt';
import { parseWithRegex } from './parser/regex';
import type { ParseContext, ParsedTransaction } from './parser/types';
import type { LendingDirection, TransactionType } from '@/lib/db-types';

interface BatchItem {
  type: TransactionType | null;
  amount: number | null;
  category: string | null;
  group: string | null;
  note: string | null;
  occurred_at_hint: string | null;
  lending: { counterparty: string; direction: LendingDirection } | null;
  confidence: number;
  reasoning?: string;
}

async function callProvider(system: string, user: string): Promise<string | null> {
  if (isGeminiEnabled()) {
    try {
      const text = await callGeminiJSON({ system, user });
      if (text) return text;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[import] gemini failed', err);
    }
  }
  const client = getGroq();
  if (client) {
    try {
      const completion = await client.chat.completions.create({
        model: getGroqModel(),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      return completion.choices[0]?.message?.content ?? null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[import] groq failed', err);
    }
  }
  return null;
}

export async function parseStatement(
  text: string,
  ctx: ParseContext,
): Promise<ParsedTransaction[]> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const system =
    buildSystemPrompt(ctx) +
    '\n\nYou will now receive MULTIPLE lines separated by newlines. ' +
    'Return a JSON object: {"items": [ <same schema as before>, ... ]} one entry per input line, in order. ' +
    'If a line is a header, a running balance, or otherwise not a transaction, include it with amount=null and confidence=0.';

  const content = await callProvider(system, lines.join('\n'));
  if (!content) {
    // No AI available / all providers failed — per-line regex fallback.
    return lines
      .map((l) => parseWithRegex(l, ctx))
      .filter((p): p is ParsedTransaction => p !== null);
  }

  let payload: { items: BatchItem[] };
  try {
    payload = JSON.parse(content);
  } catch {
    return [];
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  const out: ParsedTransaction[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const raw = lines[i] ?? '';
    if (!item || !item.amount || !item.type) continue;
    if (!isValidType(item.type)) continue;

    const categoryMatch = item.category
      ? ctx.categories.find(
          (c) =>
            c.type === item.type &&
            c.name.toLowerCase() === item.category!.toLowerCase(),
        )
      : null;
    const groupMatch = item.group
      ? ctx.groups.find(
          (g) =>
            !g.archived && g.name.toLowerCase() === item.group!.toLowerCase(),
        )
      : null;

    out.push({
      type: item.type,
      amount: item.amount,
      categoryId: categoryMatch?.id ?? null,
      categoryName: categoryMatch?.name ?? item.category,
      groupId: groupMatch?.id ?? ctx.defaultGroupId,
      groupName:
        groupMatch?.name ??
        ctx.groups.find((g) => g.id === ctx.defaultGroupId)?.name ??
        null,
      occurredAt: resolveOccurredAt(item.occurred_at_hint, ctx.now),
      note: item.note?.trim() || raw,
      lending:
        item.type === 'lending' && item.lending
          ? {
              counterparty: item.lending.counterparty,
              direction: item.lending.direction,
            }
          : null,
      confidence: Math.max(0, Math.min(1, item.confidence ?? 0.5)),
      engine: 'ai',
      rawInput: raw,
      reasoning: item.reasoning,
    });
  }
  return out;
}

function isValidType(t: unknown): t is TransactionType {
  return (
    t === 'expense' ||
    t === 'income' ||
    t === 'investment' ||
    t === 'lending' ||
    t === 'transfer'
  );
}
