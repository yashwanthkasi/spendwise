import { callGeminiJSON, isGeminiEnabled } from '@/lib/gemini';
import { getGroq, getGroqModel } from '@/lib/groq';
import { buildMultiSystemPrompt, resolveOccurredAt } from './prompt';
import { parseWithRegex } from './regex';
import { applyCanonical } from './normalize';
import type { ParseContext, ParsedTransaction } from './types';
import type { LendingDirection, TransactionType } from '@/lib/db-types';

interface MultiItem {
  type: TransactionType | null;
  amount: number | null;
  category: string | null;
  group: string | null;
  note: string | null;
  occurred_at_hint: string | null;
  lending: { counterparty: string; direction: LendingDirection } | null;
  confidence: number;
  reasoning?: string;
  raw?: string;
}

async function callProvider(system: string, user: string): Promise<string | null> {
  if (isGeminiEnabled()) {
    try {
      const text = await callGeminiJSON({ system, user });
      if (text) return text;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[multi] gemini failed', err);
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
      console.warn('[multi] groq failed', err);
    }
  }
  return null;
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

function mapItem(
  item: MultiItem,
  ctx: ParseContext,
  raw: string,
): ParsedTransaction | null {
  if (
    !item.amount ||
    !Number.isFinite(item.amount) ||
    item.amount <= 0 ||
    !isValidType(item.type)
  ) {
    return null;
  }
  const type = item.type;

  const categoryMatch = item.category
    ? ctx.categories.find(
        (c) =>
          c.type === type &&
          c.name.toLowerCase() === item.category!.toLowerCase(),
      )
    : null;

  const groupMatch = item.group
    ? ctx.groups.find(
        (g) =>
          !g.archived && g.name.toLowerCase() === item.group!.toLowerCase(),
      )
    : null;

  const fallbackGroupId = groupMatch?.id ?? ctx.defaultGroupId ?? null;
  const fallbackGroupName =
    groupMatch?.name ??
    ctx.groups.find((g) => g.id === ctx.defaultGroupId)?.name ??
    null;

  const parsed: ParsedTransaction = {
    type,
    amount: item.amount,
    categoryId: categoryMatch?.id ?? null,
    categoryName: categoryMatch?.name ?? item.category,
    groupId: fallbackGroupId,
    groupName: fallbackGroupName,
    occurredAt: resolveOccurredAt(item.occurred_at_hint, ctx.now),
    note: item.note?.trim() || raw,
    lending:
      type === 'lending' && item.lending
        ? {
            counterparty: item.lending.counterparty,
            direction: item.lending.direction,
          }
        : null,
    confidence: Math.max(0, Math.min(1, item.confidence ?? 0.5)),
    engine: 'ai',
    rawInput: raw,
    reasoning: item.reasoning,
  };

  // Pin fuel/ride keywords to a single canonical category for consistency.
  return applyCanonical(parsed, ctx.categories);
}

/**
 * Split text into transaction-sized chunks for the regex fallback.
 * Order of splits matters: newlines first (strongest signal), then ; then " and "
 * (with word boundaries), finally commas — but only when followed by a letter,
 * so amounts like "10,000" are preserved.
 */
function splitChunks(text: string): string[] {
  const safeText = text.trim();
  if (!safeText) return [];
  // First pass: hard separators
  let parts = safeText.split(/\n+|;|\s+and\s+/gi);
  // Second pass: comma-then-letter (keeps "10,000")
  parts = parts.flatMap((p) => p.split(/,(?=\s*[A-Za-z])/g));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

export async function parseMulti(
  text: string,
  ctx: ParseContext,
): Promise<ParsedTransaction[]> {
  if (!text.trim()) return [];

  // AI path
  const system = buildMultiSystemPrompt(ctx);
  const content = await callProvider(system, text);

  if (content) {
    let payload: { items?: MultiItem[] };
    try {
      payload = JSON.parse(content);
    } catch {
      payload = {};
    }
    const items = Array.isArray(payload.items) ? payload.items : [];
    const mapped = items
      .map((it) => mapItem(it, ctx, (it.raw ?? text).trim()))
      .filter((p): p is ParsedTransaction => p !== null);
    if (mapped.length > 0) return mapped;
  }

  // Regex fallback: split, then single-parse each chunk
  return splitChunks(text)
    .map((chunk) => parseWithRegex(chunk, ctx))
    .filter((p): p is ParsedTransaction => p !== null);
}
