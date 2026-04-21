import type { TransactionType } from '@/lib/db-types';
import type { ParseContext, ParsedTransaction } from './types';

interface Rule {
  type: TransactionType;
  category: string;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  // Lending — detected via verbs; handled specially below too
  { type: 'lending', category: 'Lent', patterns: [/\blent\b/i, /\bgave.*loan\b/i] },
  { type: 'lending', category: 'Borrowed', patterns: [/\bborrow(ed)?\b/i, /\btook.*loan\b/i] },

  // Investment
  { type: 'investment', category: 'SIP', patterns: [/\bsip\b/i] },
  { type: 'investment', category: 'Mutual Fund', patterns: [/\bmutual fund|mf\b/i] },
  { type: 'investment', category: 'Stocks', patterns: [/\bstock(s)?|shares|equity\b/i] },
  { type: 'investment', category: 'FD', patterns: [/\bfixed deposit|\bfd\b/i] },
  { type: 'investment', category: 'Crypto', patterns: [/\bcrypto|bitcoin|btc|eth|ethereum\b/i] },

  // Income
  { type: 'income', category: 'Salary', patterns: [/\bsalary|payroll|paycheck\b/i, /credited/i] },
  { type: 'income', category: 'Freelance', patterns: [/\bfreelance|invoice|client payment\b/i] },
  { type: 'income', category: 'Refund', patterns: [/\brefund(ed)?\b/i] },
  { type: 'income', category: 'Interest', patterns: [/\binterest\b/i] },

  // Transfer
  {
    type: 'transfer',
    category: 'Transfer',
    patterns: [
      /\btransfer(red)?\b/i,
      /\bmoved (to|from)\b/i,
      /\bsent to\b.*\b(savings|wallet|account)\b/i,
    ],
  },

  // Expense (broadest; listed last so specific types win first)
  { type: 'expense', category: 'Food', patterns: [/\brice|roti|dal|meal|lunch|dinner|breakfast|food\b/i] },
  { type: 'expense', category: 'Groceries', patterns: [/\bgrocer(y|ies)|vegetables|veggies|milk|fruits\b/i] },
  { type: 'expense', category: 'Rent', patterns: [/\brent\b/i] },
  { type: 'expense', category: 'Utilities', patterns: [/\belectricity|water bill|gas bill|utility|utilities|wifi|broadband|internet\b/i] },
  { type: 'expense', category: 'Transport', patterns: [/\buber|ola|rapido|metro|bus|train|taxi|cab|auto\b/i] },
  { type: 'expense', category: 'Fuel', patterns: [/\bpetrol|diesel|fuel\b/i] },
  { type: 'expense', category: 'Eating Out', patterns: [/\bcoffee|tea|cafe|restaurant|zomato|swiggy|dosa|pizza|burger\b/i] },
  { type: 'expense', category: 'Shopping', patterns: [/\bshopping|amazon|flipkart|myntra|ajio\b/i] },
  { type: 'expense', category: 'Health', patterns: [/\bdoctor|medicine|pharmacy|hospital|clinic\b/i] },
  { type: 'expense', category: 'Entertainment', patterns: [/\bmovie|netflix|spotify|cinema|concert\b/i] },
  { type: 'expense', category: 'Subscriptions', patterns: [/\bsubscription|plan renewal\b/i] },
  { type: 'expense', category: 'Travel', patterns: [/\bflight|hotel|airbnb|travel|trip\b/i] },
  { type: 'expense', category: 'Gifts', patterns: [/\bgift|present\b/i] },
];

const AMOUNT_RE = /(?:^|\s|[₹$])(\d+(?:[.,]\d+)?)(k|K|l|L)?\b/g;

function extractAmount(text: string): number | null {
  let last: number | null = null;
  for (const m of text.matchAll(AMOUNT_RE)) {
    const raw = m[1].replace(/,/g, '');
    let n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    const suffix = (m[2] ?? '').toLowerCase();
    if (suffix === 'k') n *= 1_000;
    else if (suffix === 'l') n *= 1_00_000;
    last = n;
  }
  return last;
}

function extractCounterparty(
  text: string,
  direction: 'lent' | 'borrowed',
): string | null {
  // "lent Ravi 2000" | "lent 2000 to Ravi"
  // "borrowed 500 from Aarav" | "Aarav borrowed 500"
  const patterns =
    direction === 'lent'
      ? [
          /\blent\s+to\s+([A-Za-z][A-Za-z .'-]*?)(?=\s*(?:\d|₹|$))/i,
          /\blent\s+([A-Za-z][A-Za-z .'-]*?)(?=\s*(?:\d|₹|$))/i,
          /\bto\s+([A-Za-z][A-Za-z .'-]*?)(?=\s|$)/i,
        ]
      : [
          /\bborrow(?:ed)?\s+(?:\d[\d,.]*\s*[kKlL]?\s+)?from\s+([A-Za-z][A-Za-z .'-]*?)(?=\s|$)/i,
          /\bfrom\s+([A-Za-z][A-Za-z .'-]*?)(?=\s|$)/i,
        ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ');
  }
  return null;
}

function pickCategory(
  ctx: ParseContext,
  type: TransactionType,
  name: string,
) {
  const match = ctx.categories.find(
    (c) => c.type === type && c.name.toLowerCase() === name.toLowerCase(),
  );
  return { id: match?.id ?? null, name: match?.name ?? name };
}

function pickGroup(ctx: ParseContext, text: string) {
  const lower = text.toLowerCase();
  for (const g of ctx.groups) {
    if (g.archived) continue;
    if (lower.includes(g.name.toLowerCase())) {
      return { id: g.id, name: g.name };
    }
  }
  if (ctx.defaultGroupId) {
    const d = ctx.groups.find((g) => g.id === ctx.defaultGroupId);
    if (d) return { id: d.id, name: d.name };
  }
  return { id: null, name: null };
}

export function parseWithRegex(
  input: string,
  ctx: ParseContext,
): ParsedTransaction | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const amount = extractAmount(trimmed);
  if (amount == null) return null;

  let matchedType: TransactionType = 'expense';
  let matchedCategory = 'Food';
  let confidence = 0.45;
  let matched = false;

  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(trimmed))) {
      matchedType = rule.type;
      matchedCategory = rule.category;
      confidence = 0.7;
      matched = true;
      break;
    }
  }

  // Lending counterparty
  let lending: ParsedTransaction['lending'] = null;
  if (matchedType === 'lending') {
    const direction: 'lent' | 'borrowed' = /\blent\b/i.test(trimmed)
      ? 'lent'
      : 'borrowed';
    const counterparty = extractCounterparty(trimmed, direction);
    if (counterparty) {
      lending = { counterparty, direction };
      confidence = Math.max(confidence, 0.75);
    } else {
      confidence = 0.5;
    }
  }

  const group = pickGroup(ctx, trimmed);
  const cat = pickCategory(ctx, matchedType, matchedCategory);

  return {
    type: matchedType,
    amount,
    categoryId: cat.id,
    categoryName: cat.name,
    groupId: group.id,
    groupName: group.name,
    occurredAt: ctx.now.toISOString(),
    note: trimmed,
    lending,
    confidence: matched ? confidence : 0.4,
    engine: 'regex',
    rawInput: trimmed,
    reasoning: matched ? 'keyword match' : 'amount only — category is a guess',
  };
}
