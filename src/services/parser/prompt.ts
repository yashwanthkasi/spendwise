import type { ParseContext } from './types';
import { FEW_SHOT_EXAMPLES } from './examples';

export function buildSystemPrompt(ctx: ParseContext): string {
  const catsByType: Record<string, string[]> = {};
  for (const c of ctx.categories) {
    (catsByType[c.type] ??= []).push(c.name);
  }
  const groupList = ctx.groups.filter((g) => !g.archived).map((g) => g.name);
  const defaultGroup =
    ctx.groups.find((g) => g.id === ctx.defaultGroupId)?.name ?? null;

  return [
    'You are a financial-transaction parser for an Indian personal-finance app (INR).',
    'Given a short phrase (typed or transcribed from voice), output ONLY a JSON object that matches the schema below.',
    'If you cannot extract an amount, set amount to null and confidence to 0 — do not invent values.',
    'Default currency is INR. "k" = 1,000 and "l" = 1,00,000 (1 lakh).',
    '',
    'Allowed `type` values: "expense", "income", "investment", "lending", "transfer".',
    '- expense: money going out (food, rent, shopping, travel, utilities…)',
    '- income: money coming in (salary, freelance, refund, interest…)',
    '- investment: money put into an asset (SIP, stocks, FD, crypto, mutual fund…)',
    '- lending: money loaned to or borrowed from a person. Always include `lending.counterparty` and `lending.direction`.',
    '- transfer: movement between the user\'s own accounts (bank → savings, wallet top-up). Do NOT use transfer for paying a merchant.',
    '',
    'Allowed `category` values MUST come from the lists below (match the exact spelling). If none fits well, pick the closest and lower confidence.',
    ...Object.entries(catsByType).map(
      ([type, names]) => `  ${type}: ${names.join(', ')}`,
    ),
    '',
    `Allowed \`group\` values (or null): ${groupList.join(', ') || '(none)'}.`,
    defaultGroup
      ? `If no group is implied, use null and the app will default to "${defaultGroup}".`
      : 'If no group is implied, use null.',
    '',
    `Today is ${ctx.now.toISOString()} (${ctx.timezone}).`,
    'If the user mentions "yesterday", "last night", "morning" etc., set `occurred_at_hint` to that phrase — do not compute the date yourself.',
    '',
    'Output JSON schema:',
    '{',
    '  "type": "expense" | "income" | "investment" | "lending" | "transfer",',
    '  "amount": number | null,',
    '  "category": string | null,',
    '  "group": string | null,',
    '  "note": string,',
    '  "occurred_at_hint": string | null,',
    '  "lending": { "counterparty": string, "direction": "lent" | "borrowed" } | null,',
    '  "confidence": number,  // 0..1 — your honest self-estimate',
    '  "reasoning": string    // one short sentence',
    '}',
    '',
    'Examples:',
    ...FEW_SHOT_EXAMPLES.flatMap((ex) => [
      `IN: ${ex.input}`,
      `OUT: ${JSON.stringify(ex.output)}`,
    ]),
    '',
    'Output ONLY the JSON. No prose, no markdown fences.',
  ].join('\n');
}

export function resolveOccurredAt(hint: string | null, now: Date): string {
  if (!hint) return now.toISOString();
  const h = hint.toLowerCase();
  const d = new Date(now);
  if (h.includes('yesterday') || h.includes('last night')) {
    d.setDate(d.getDate() - 1);
  } else if (h.includes('day before yesterday')) {
    d.setDate(d.getDate() - 2);
  } else if (h.includes('last week')) {
    d.setDate(d.getDate() - 7);
  }
  return d.toISOString();
}
