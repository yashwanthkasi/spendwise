import { addDays, addMonths, addWeeks } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type {
  RecurringCadence,
  RecurringRule,
  TransactionType,
} from '@/lib/db-types';

export function advanceNextRun(from: Date, cadence: RecurringCadence): Date {
  switch (cadence) {
    case 'daily':
      return addDays(from, 1);
    case 'weekly':
      return addWeeks(from, 1);
    case 'monthly':
    default:
      return addMonths(from, 1);
  }
}

interface RuleTemplate {
  amount: number;
  type: TransactionType;
  category_id: string | null;
  group_id: string | null;
  note: string | null;
}

function isValidTemplate(t: unknown): t is RuleTemplate {
  if (!t || typeof t !== 'object') return false;
  const r = t as Record<string, unknown>;
  return typeof r.amount === 'number' && typeof r.type === 'string';
}

export async function runDueRecurring(now = new Date()): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return 0;

  const { data: rules, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('active', true)
    .lte('next_run_at', now.toISOString());
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[recurring] fetch failed', error);
    return 0;
  }

  let inserted = 0;
  for (const rule of (rules ?? []) as RecurringRule[]) {
    if (!isValidTemplate(rule.template)) continue;
    let runAt = new Date(rule.next_run_at);
    // Fast-forward: keep firing until next_run_at is in the future.
    while (runAt <= now) {
      const { error: insErr } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: rule.template.amount,
        type: rule.template.type,
        category_id: rule.template.category_id,
        group_id: rule.template.group_id,
        occurred_at: runAt.toISOString(),
        note: rule.template.note,
        raw_input: null,
        source: 'recurring',
      });
      if (insErr) {
        // eslint-disable-next-line no-console
        console.warn('[recurring] insert failed', insErr);
        break;
      }
      inserted++;
      runAt = advanceNextRun(runAt, rule.cadence);
    }
    await supabase
      .from('recurring_rules')
      .update({
        last_run_at: now.toISOString(),
        next_run_at: runAt.toISOString(),
      })
      .eq('id', rule.id);
  }
  return inserted;
}
