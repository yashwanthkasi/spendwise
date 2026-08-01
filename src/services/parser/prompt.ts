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
    'Category disambiguation (BE CONSISTENT — the same word must always map to the same category):',
    '- Buying fuel for a vehicle — "petrol", "diesel", "CNG", "fuel", "gas station", filling the tank → Fuel (NEVER Transport).',
    '- Paying for a ride or commute — "uber", "ola", "rapido", "cab", "taxi", "auto", "rickshaw", "metro", "bus", "train", "ride" → Transport (NEVER Fuel).',
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

export function buildMultiSystemPrompt(ctx: ParseContext): string {
  const base = buildSystemPrompt(ctx);
  return (
    base +
    '\n\n' +
    [
      '— MULTI MODE —',
      'The user may describe MULTIPLE transactions in one message, separated by commas, semicolons, "and", or newlines.',
      'Different items may have different types: an income and an expense in the same message is normal.',
      'Always respond as: {"items": [<single-tx schema>, ...]}.',
      'For each item include a "raw" field with the exact fragment of the input it came from.',
      'If the input is just one transaction, return an array of length 1.',
      'Be careful with commas inside numbers — "10,000" is a single amount, not two transactions.',
      '',
      'Examples:',
      'IN: gobi 40, shopping 400 and woodwork 70 home',
      'OUT: {"items":[{"type":"expense","amount":40,"category":"Groceries","group":null,"note":"gobi","raw":"gobi 40","occurred_at_hint":null,"lending":null,"confidence":0.85,"reasoning":"gobi → Groceries"},{"type":"expense","amount":400,"category":"Shopping","group":null,"note":"shopping","raw":"shopping 400","occurred_at_hint":null,"lending":null,"confidence":0.9,"reasoning":"explicit"},{"type":"expense","amount":70,"category":"Shopping","group":"Home","note":"woodwork","raw":"woodwork 70 home","occurred_at_hint":null,"lending":null,"confidence":0.7,"reasoning":"woodwork → Shopping; group Home"}]}',
      '',
      'IN: salary 95k and rent 20k',
      'OUT: {"items":[{"type":"income","amount":95000,"category":"Salary","group":null,"note":"salary","raw":"salary 95k","occurred_at_hint":null,"lending":null,"confidence":0.95,"reasoning":"salary → Income/Salary"},{"type":"expense","amount":20000,"category":"Rent","group":null,"note":"rent","raw":"rent 20k","occurred_at_hint":null,"lending":null,"confidence":0.95,"reasoning":"rent → Expense/Rent"}]}',
      '',
      'IN: rice 400',
      'OUT: {"items":[{"type":"expense","amount":400,"category":"Food","group":null,"note":"rice","raw":"rice 400","occurred_at_hint":null,"lending":null,"confidence":0.9,"reasoning":"rice → Food"}]}',
      '',
      'Output ONLY the JSON object. No prose, no markdown fences.',
    ].join('\n')
  );
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
