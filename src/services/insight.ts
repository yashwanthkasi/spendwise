import { getDay } from 'date-fns';
import { callGeminiJSON, isGeminiEnabled } from '@/lib/gemini';
import { getGroq, getGroqModel } from '@/lib/groq';
import type { TransactionWithRelations } from '@/hooks/useTransactions';

export interface InsightInput {
  rangeLabel: string;
  filterDesc: string;
  txns: TransactionWithRelations[];
  /** Optional prior-period data for comparison. */
  previousTxns?: TransactionWithRelations[];
  /** Label for the previous period (e.g. "April 2026"). */
  previousLabel?: string;
}

interface CategoryStat {
  name: string;
  amount: number;
  count: number;
}

/**
 * The data shape we hand to the model. Every field exists to let the model
 * make a specific, numerically-grounded observation.
 */
interface StructuredStats {
  range: string;
  previous_range?: string;
  filters: string;
  transactions: number;
  total_inr: number;
  by_type: Record<string, { count: number; amount: number }>;
  top_categories: CategoryStat[];
  top_groups: CategoryStat[];
  top_locations: CategoryStat[];
  // ── habit signals ──
  habits: {
    eating_out: { count: number; amount: number; avg_ticket: number } | null;
    coffee_cafe: { count: number; amount: number; avg_ticket: number } | null;
    groceries: { count: number; amount: number } | null;
    transport: { count: number; amount: number; avg_ticket: number } | null;
    shopping: { count: number; amount: number } | null;
    subscriptions: { count: number; amount: number } | null;
    weekday_amount: number;
    weekend_amount: number;
    most_active_day: string | null;
    largest_txn: { amount: number; note: string; category: string | null } | null;
    frequent_merchants: Array<{ keyword: string; count: number; amount: number }>;
  };
  outstanding_lent_inr?: number;
  outstanding_borrowed_inr?: number;
  previous?: {
    total_inr: number;
    by_type: Record<string, { count: number; amount: number }>;
    top_categories: CategoryStat[];
  };
}

/** Simple keyword frequency over notes / raw_input for merchant detection. */
function topMerchantKeywords(
  txns: TransactionWithRelations[],
  limit = 5,
): Array<{ keyword: string; count: number; amount: number }> {
  const STOP = new Set([
    'and',
    'the',
    'for',
    'with',
    'from',
    'to',
    'a',
    'an',
    'in',
    'on',
    'at',
    'of',
    'is',
    'my',
    'me',
    'i',
    'we',
    'you',
    'this',
    'that',
    'paid',
    'spent',
    'expense',
    'rs',
    'inr',
    // unit / dosage / generic
    'one',
    'two',
    'three',
    'today',
    'yesterday',
    'home',
    'office',
  ]);
  const map = new Map<string, { count: number; amount: number }>();
  for (const t of txns) {
    const text = ((t.raw_input ?? '') + ' ' + (t.note ?? '')).toLowerCase();
    const words = text.match(/[a-z][a-z'-]{2,}/g) ?? [];
    const seen = new Set<string>();
    for (const w of words) {
      if (STOP.has(w)) continue;
      if (/^\d+$/.test(w)) continue;
      if (seen.has(w)) continue; // count once per transaction
      seen.add(w);
      const entry = map.get(w) ?? { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += Number(t.amount);
      map.set(w, entry);
    }
  }
  return Array.from(map.entries())
    .map(([keyword, v]) => ({ keyword, ...v }))
    .filter((m) => m.count >= 2) // at least seen twice to count as a habit
    .sort((a, b) => b.count - a.count || b.amount - a.amount)
    .slice(0, limit);
}

function summarizeCategory(
  txns: TransactionWithRelations[],
  categoryName: string,
): { count: number; amount: number; avg_ticket: number } | null {
  const rows = txns.filter(
    (t) => t.category?.name?.toLowerCase() === categoryName.toLowerCase(),
  );
  if (rows.length === 0) return null;
  const amount = rows.reduce((a, t) => a + Number(t.amount), 0);
  return {
    count: rows.length,
    amount: Math.round(amount),
    avg_ticket: Math.round(amount / rows.length),
  };
}

function detectCoffeeHabit(
  txns: TransactionWithRelations[],
): { count: number; amount: number; avg_ticket: number } | null {
  const rows = txns.filter((t) => {
    if (t.type !== 'expense') return false;
    const text = `${t.raw_input ?? ''} ${t.note ?? ''}`.toLowerCase();
    return /\b(coffee|cafe|caf[eé]|starbucks|barista|chai|latte|espresso|cappuccino|mocha|americano)\b/.test(
      text,
    );
  });
  if (rows.length === 0) return null;
  const amount = rows.reduce((a, t) => a + Number(t.amount), 0);
  return {
    count: rows.length,
    amount: Math.round(amount),
    avg_ticket: Math.round(amount / rows.length),
  };
}

function dayBreakdown(txns: TransactionWithRelations[]) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let weekday = 0;
  let weekend = 0;
  const byDay: Record<string, number> = {};
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    const d = new Date(t.occurred_at);
    const idx = getDay(d);
    const v = Number(t.amount);
    if (idx === 0 || idx === 6) weekend += v;
    else weekday += v;
    byDay[dayNames[idx]] = (byDay[dayNames[idx]] ?? 0) + v;
  }
  let topDay: string | null = null;
  let topVal = 0;
  for (const [k, v] of Object.entries(byDay)) {
    if (v > topVal) {
      topVal = v;
      topDay = k;
    }
  }
  return {
    weekday: Math.round(weekday),
    weekend: Math.round(weekend),
    topDay,
  };
}

function aggregateCategories(
  txns: TransactionWithRelations[],
  topN = 6,
): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  for (const t of txns) {
    if (!t.category) continue;
    const k = t.category.id;
    const e = map.get(k) ?? { name: t.category.name, amount: 0, count: 0 };
    e.amount += Number(t.amount);
    e.count += 1;
    map.set(k, e);
  }
  return Array.from(map.values())
    .map((c) => ({ ...c, amount: Math.round(c.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);
}

function aggregateGroups(
  txns: TransactionWithRelations[],
  topN = 6,
): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  for (const t of txns) {
    if (t.type !== 'expense' || !t.group) continue;
    const k = t.group.id;
    const e = map.get(k) ?? { name: t.group.name, amount: 0, count: 0 };
    e.amount += Number(t.amount);
    e.count += 1;
    map.set(k, e);
  }
  return Array.from(map.values())
    .map((g) => ({ ...g, amount: Math.round(g.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);
}

function aggregateLocations(
  txns: TransactionWithRelations[],
  topN = 5,
): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  for (const t of txns) {
    if (t.type !== 'expense' || !t.place_label) continue;
    const name = t.place_label.trim();
    if (!name) continue;
    const k = name.toLowerCase();
    const e = map.get(k) ?? { name, amount: 0, count: 0 };
    e.amount += Number(t.amount);
    e.count += 1;
    map.set(k, e);
  }
  return Array.from(map.values())
    .map((l) => ({ ...l, amount: Math.round(l.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);
}

function buildStats(input: InsightInput): StructuredStats {
  const { txns, previousTxns } = input;
  const byType: Record<string, { count: number; amount: number }> = {};
  let total = 0;
  let outLent = 0;
  let outBorrowed = 0;
  let largest: StructuredStats['habits']['largest_txn'] = null;
  for (const t of txns) {
    const v = Number(t.amount);
    total += v;
    byType[t.type] ??= { count: 0, amount: 0 };
    byType[t.type].count += 1;
    byType[t.type].amount += v;
    if (t.lending_details && !t.lending_details.settled) {
      if (t.lending_details.direction === 'lent') outLent += v;
      else outBorrowed += v;
    }
    if (t.type === 'expense' && (!largest || v > largest.amount)) {
      largest = {
        amount: Math.round(v),
        note: (t.note ?? t.raw_input ?? '').trim() || t.category?.name || '',
        category: t.category?.name ?? null,
      };
    }
  }

  const expenseTxns = txns.filter((t) => t.type === 'expense');
  const days = dayBreakdown(txns);

  return {
    range: input.rangeLabel,
    previous_range: input.previousLabel,
    filters: input.filterDesc,
    transactions: txns.length,
    total_inr: Math.round(total),
    by_type: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [
        k,
        { count: v.count, amount: Math.round(v.amount) },
      ]),
    ),
    top_categories: aggregateCategories(txns),
    top_groups: aggregateGroups(txns),
    top_locations: aggregateLocations(txns),
    habits: {
      eating_out: summarizeCategory(txns, 'Eating Out'),
      coffee_cafe: detectCoffeeHabit(txns),
      groceries: summarizeCategory(txns, 'Groceries'),
      transport: summarizeCategory(txns, 'Transport'),
      shopping: summarizeCategory(txns, 'Shopping'),
      subscriptions: summarizeCategory(txns, 'Subscriptions'),
      weekday_amount: days.weekday,
      weekend_amount: days.weekend,
      most_active_day: days.topDay,
      largest_txn: largest,
      frequent_merchants: topMerchantKeywords(expenseTxns, 6),
    },
    ...(outLent > 0 ? { outstanding_lent_inr: Math.round(outLent) } : {}),
    ...(outBorrowed > 0
      ? { outstanding_borrowed_inr: Math.round(outBorrowed) }
      : {}),
    ...(previousTxns
      ? {
          previous: {
            total_inr: Math.round(
              previousTxns.reduce((a, t) => a + Number(t.amount), 0),
            ),
            by_type: (() => {
              const m: Record<string, { count: number; amount: number }> = {};
              for (const t of previousTxns) {
                m[t.type] ??= { count: 0, amount: 0 };
                m[t.type].count += 1;
                m[t.type].amount += Number(t.amount);
              }
              return Object.fromEntries(
                Object.entries(m).map(([k, v]) => [
                  k,
                  { count: v.count, amount: Math.round(v.amount) },
                ]),
              );
            })(),
            top_categories: aggregateCategories(previousTxns, 5),
          },
        }
      : {}),
  };
}

const SYSTEM = [
  "You are a friendly personal-finance analyst summarizing a single user's transactions in INR.",
  '',
  'Given a JSON blob of stats, produce a useful 3–5 sentence plain-English narrative that:',
  '',
  '1. ONE SENTENCE on the big picture: total spend, top category, and a comparison vs `previous` if present (use %).',
  '2. ONE OR TWO SENTENCES on BEHAVIORAL HABITS using the `habits` block. Pick the most striking pattern(s):',
  '   - eating-out frequency ("you ate out 12 times — about 3×/week — for ₹4,200")',
  '   - coffee/cafe runs ("8 coffee charges adding to ₹1,150")',
  '   - weekend vs weekday split if skewed',
  '   - frequent_merchants array: call out by name ("Zomato shows up 9 times")',
  '   - largest_txn outlier',
  '   - subscriptions if present',
  '   - top_locations: call out WHERE money went by place ("₹2,300 around Indiranagar") when present',
  '3. OPTIONALLY one sentence with a concrete observation or tiny nudge — never preachy.',
  '',
  'Rules:',
  '- Every claim must cite a number from the JSON (₹ amounts and/or counts).',
  '- Plain text. No markdown, no bullet points, no greetings, no "Hello".',
  '- Friendly but direct. Speak in second person ("you").',
  '- Skip habits that are absent (null) — focus on what the data shows.',
  '',
  'Respond strictly as: {"summary": "..."}',
].join('\n');

export function isInsightAvailable(): boolean {
  return isGeminiEnabled() || getGroq() !== null;
}

export async function generateInsight(
  input: InsightInput,
): Promise<string | null> {
  if (input.txns.length === 0) return null;
  const stats = buildStats(input);
  const user = JSON.stringify(stats);

  if (isGeminiEnabled()) {
    try {
      const text = await callGeminiJSON({ system: SYSTEM, user });
      if (text) {
        const parsed = JSON.parse(text) as { summary?: string };
        if (typeof parsed.summary === 'string') return parsed.summary.trim();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[insight] gemini failed', err);
    }
  }
  const groq = getGroq();
  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: getGroqModel(),
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      });
      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content) as { summary?: string };
        if (typeof parsed.summary === 'string') return parsed.summary.trim();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[insight] groq failed', err);
    }
  }
  return null;
}

