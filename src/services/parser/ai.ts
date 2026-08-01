import { callGeminiJSON, isGeminiEnabled } from '@/lib/gemini';
import { getGroq, getGroqModel } from '@/lib/groq';
import { buildSystemPrompt, resolveOccurredAt } from './prompt';
import { applyCanonical } from './normalize';
import type { ParseContext, ParsedTransaction } from './types';
import type { LendingDirection, TransactionType } from '@/lib/db-types';

export type AIProvider = 'gemini' | 'groq' | 'none';

export function activeProvider(): AIProvider {
  if (isGeminiEnabled()) return 'gemini';
  if (getGroq()) return 'groq';
  return 'none';
}

export function isAIEnabled(): boolean {
  return activeProvider() !== 'none';
}

interface AIPayload {
  type: TransactionType;
  amount: number | null;
  category: string | null;
  group: string | null;
  note: string;
  occurred_at_hint: string | null;
  lending: { counterparty: string; direction: LendingDirection } | null;
  confidence: number;
  reasoning: string;
}

async function callProvider(
  provider: 'gemini' | 'groq',
  system: string,
  user: string,
): Promise<string | null> {
  if (provider === 'gemini') {
    return callGeminiJSON({ system, user });
  }
  const client = getGroq();
  if (!client) return null;
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
}

export async function parseWithAI(
  input: string,
  ctx: ParseContext,
): Promise<ParsedTransaction | null> {
  const system = buildSystemPrompt(ctx);

  const providers: Array<'gemini' | 'groq'> = [];
  if (isGeminiEnabled()) providers.push('gemini');
  if (getGroq()) providers.push('groq');

  for (const provider of providers) {
    try {
      const content = await callProvider(provider, system, input);
      if (!content) continue;
      const mapped = mapPayload(content, input, ctx, provider);
      if (mapped) return mapped;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[parser] ${provider} failed`, err);
    }
  }
  return null;
}

function mapPayload(
  content: string,
  input: string,
  ctx: ParseContext,
  provider: 'gemini' | 'groq',
): ParsedTransaction | null {
  let payload: AIPayload;
  try {
    payload = JSON.parse(content);
  } catch {
    return null;
  }

  if (
    payload.amount == null ||
    !Number.isFinite(payload.amount) ||
    payload.amount <= 0
  ) {
    return null;
  }
  if (!isValidType(payload.type)) return null;

  const categoryMatch = payload.category
    ? ctx.categories.find(
        (c) =>
          c.type === payload.type &&
          c.name.toLowerCase() === payload.category!.toLowerCase(),
      )
    : null;

  const groupMatch = payload.group
    ? ctx.groups.find(
        (g) => !g.archived && g.name.toLowerCase() === payload.group!.toLowerCase(),
      )
    : null;
  const fallbackGroupId = groupMatch?.id ?? ctx.defaultGroupId ?? null;
  const fallbackGroupName =
    groupMatch?.name ??
    ctx.groups.find((g) => g.id === ctx.defaultGroupId)?.name ??
    null;

  const parsed: ParsedTransaction = {
    type: payload.type,
    amount: payload.amount,
    categoryId: categoryMatch?.id ?? null,
    categoryName: categoryMatch?.name ?? payload.category,
    groupId: fallbackGroupId,
    groupName: fallbackGroupName,
    occurredAt: resolveOccurredAt(payload.occurred_at_hint, ctx.now),
    note: payload.note?.trim() || input,
    lending:
      payload.type === 'lending' && payload.lending
        ? {
            counterparty: payload.lending.counterparty,
            direction: payload.lending.direction,
          }
        : null,
    confidence: Math.max(0, Math.min(1, payload.confidence ?? 0)),
    engine: 'ai',
    rawInput: input,
    reasoning: `${provider}: ${payload.reasoning ?? ''}`.trim(),
  };

  // Pin fuel/ride keywords to a single canonical category for consistency.
  return applyCanonical(parsed, ctx.categories);
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
