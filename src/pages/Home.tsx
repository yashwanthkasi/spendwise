import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { startOfDay, format } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/PageHeader';
import { QuickAddBar } from '@/components/QuickAddBar';
import { ParseConfirmDialog } from '@/components/ParseConfirmDialog';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { SheetBody } from '@/components/ui/sheet';
import { TransactionForm } from '@/components/TransactionForm';
import type { TransactionWithRelations } from '@/hooks/useTransactions';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import { useProfile } from '@/hooks/useProfile';
import { useBudgets } from '@/hooks/useBudgets';
import { useLogParse } from '@/hooks/useParseLog';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  type TransactionInput,
} from '@/hooks/useTransactions';
import {
  parseTransaction,
  PARSE_CONFIDENCE_THRESHOLD,
  type ParsedTransaction,
} from '@/services/parser';
import { computeBudgetProgress } from '@/lib/budgetCalc';
import { TYPE_META } from '@/lib/constants';
import { formatINR } from '@/lib/utils';

export default function Home() {
  const { data: cats = [] } = useCategories();
  const { data: groups = [] } = useGroups();
  const { data: profile } = useProfile();
  const { data: txns = [] } = useTransactions({ limit: 500 });
  const { data: budgets = [] } = useBudgets();

  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();
  const logParse = useLogParse();

  const [parsing, setParsing] = useState(false);
  const [pending, setPending] = useState<ParsedTransaction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastOK, setLastOK] = useState<string | null>(null);
  const [selected, setSelected] = useState<TransactionWithRelations | null>(null);
  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);

  const today = startOfDay(new Date()).toISOString();
  const todayTxns = useMemo(
    () => txns.filter((t) => t.occurred_at >= today),
    [txns, today],
  );

  const todaySpent = useMemo(
    () =>
      todayTxns
        .filter((t) => t.type === 'expense')
        .reduce((acc, t) => acc + Number(t.amount), 0),
    [todayTxns],
  );
  const todayIncome = useMemo(
    () =>
      todayTxns
        .filter((t) => t.type === 'income')
        .reduce((acc, t) => acc + Number(t.amount), 0),
    [todayTxns],
  );
  const todayInvested = useMemo(
    () =>
      todayTxns
        .filter((t) => t.type === 'investment')
        .reduce((acc, t) => acc + Number(t.amount), 0),
    [todayTxns],
  );

  const lendingStats = useMemo(() => {
    let lent = 0;
    let borrowed = 0;
    for (const t of txns) {
      const d = t.lending_details;
      if (!d || d.settled) continue;
      if (d.direction === 'lent') lent += Number(t.amount);
      else borrowed += Number(t.amount);
    }
    return { lent, borrowed };
  }, [txns]);

  const budgetAlerts = useMemo(
    () =>
      budgets
        .map((b) => computeBudgetProgress(b, txns, cats, groups))
        .filter((p) => p.pct >= 80)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 3),
    [budgets, txns, cats, groups],
  );

  const recent = useMemo(() => txns.slice(0, 5), [txns]);

  async function handleQuickSubmit(text: string) {
    if (!profile) {
      toast.error('Profile not ready');
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseTransaction(text, {
        categories: cats,
        groups,
        defaultGroupId: profile.default_group_id,
        now: new Date(),
        timezone: profile.timezone,
      });
      if (!parsed) {
        toast.error("Couldn't detect an amount — try 'rice 400'");
        return;
      }
      if (parsed.confidence >= PARSE_CONFIDENCE_THRESHOLD) {
        const input = buildInput(parsed);
        await create.mutateAsync(input);
        logParse.mutate({ parsed, accepted: true, final: input });
        const label = `${TYPE_META[parsed.type].emoji} ${parsed.categoryName ?? parsed.type} · ${formatINR(parsed.amount)}`;
        setLastOK(label);
        toast.success(label);
        setTimeout(() => setLastOK(null), 2000);
      } else {
        setPending(parsed);
        setConfirmOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setParsing(false);
    }
  }

  async function handleDelete(t: TransactionWithRelations) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await del.mutateAsync(t.id);
      toast.success('Deleted');
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function toggleSettle(t: TransactionWithRelations) {
    const d = t.lending_details;
    if (!d) return;
    try {
      await update.mutateAsync({
        id: t.id,
        patch: {},
        lending: { settled: !d.settled },
      });
      toast.success(d.settled ? 'Reopened' : 'Settled');
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi${profile?.display_name ? `, ${profile.display_name}` : ''} 👋`}
        subtitle={format(new Date(), 'EEEE, d MMMM')}
      />

      <section className="space-y-2">
        <QuickAddBar onSubmit={handleQuickSubmit} loading={parsing} />
        <AnimatePresence>
          {lastOK && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-[hsl(var(--success))]"
            >
              <Check className="h-4 w-4" /> Added — {lastOK}
            </motion.div>
          )}
        </AnimatePresence>
        <p className="pl-1 text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3" />
          Try: "rice 400", "SIP 10000", "lent Ravi 2000 office".
        </p>
      </section>

      {/* Today snapshot */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Spent" value={todaySpent} color="hsl(var(--destructive))" />
        <StatCard label="Income" value={todayIncome} color="hsl(var(--success))" />
        <StatCard label="Invested" value={todayInvested} color={TYPE_META.investment.color} />
      </div>

      {/* Lending widget */}
      {(lendingStats.lent > 0 || lendingStats.borrowed > 0) && (
        <Link to="/activity?filter=lending">
          <Card className="transition-colors hover:bg-accent/40">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid flex-1 grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-[#6366f11a] p-1.5 text-[#6366f1]">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">They owe you</div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatINR(lendingStats.lent)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-[#e11d481a] p-1.5 text-[#e11d48]">
                    <ArrowDownLeft className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">You owe</div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatINR(lendingStats.borrowed)}
                    </div>
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Budget alerts */}
      {budgetAlerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Budget watch
          </h2>
          <div className="space-y-2">
            {budgetAlerts.map((p) => (
              <Card key={p.budget.id}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.label}</span>
                    <span
                      className="tabular-nums"
                      style={{
                        color: p.over ? 'hsl(var(--destructive))' : undefined,
                      }}
                    >
                      {formatINR(p.spent)} / {formatINR(Number(p.budget.amount))}
                    </span>
                  </div>
                  <Progress
                    value={p.spent}
                    max={Number(p.budget.amount)}
                    barClassName={p.over ? 'bg-destructive' : undefined}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent
          </h2>
          <Link to="/activity" className="text-xs text-primary hover:underline">
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing yet. Try "coffee 150" above.
          </div>
        ) : (
          <motion.div layout className="space-y-2">
            {recent.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <TransactionRow txn={t} onOpen={setSelected} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <TransactionDetailSheet
        txn={selected}
        onClose={() => setSelected(null)}
        onEdit={(t) => {
          setSelected(null);
          setEditing(t);
        }}
        onDelete={handleDelete}
        onToggleSettle={selected?.lending_details ? toggleSettle : undefined}
      />

      <SheetBody
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit transaction"
      >
        {editing && (
          <TransactionForm
            initial={editing}
            submitLabel="Save"
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              try {
                await update.mutateAsync({
                  id: editing.id,
                  patch: {
                    amount: input.amount,
                    type: input.type,
                    category_id: input.category_id,
                    group_id: input.group_id,
                    occurred_at: input.occurred_at,
                    note: input.note,
                  },
                  lending:
                    input.type === 'lending' && input.lending
                      ? {
                          counterparty: input.lending.counterparty,
                          direction: input.lending.direction,
                          due_date: input.lending.due_date ?? null,
                        }
                      : undefined,
                });
                toast.success('Updated');
                setEditing(null);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed');
              }
            }}
          />
        )}
      </SheetBody>

      <ParseConfirmDialog
        parsed={pending}
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) {
            if (pending) logParse.mutate({ parsed: pending, accepted: false });
            setPending(null);
          }
        }}
        onConfirm={async (input) => {
          try {
            await create.mutateAsync(input);
            if (pending) logParse.mutate({ parsed: pending, accepted: true, final: input });
            toast.success('Added');
            setConfirmOpen(false);
            setPending(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed');
          }
        }}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="space-y-0.5 p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className="truncate text-lg font-semibold tabular-nums"
          style={{ color: value > 0 ? color : undefined }}
        >
          {formatINR(value)}
        </div>
      </CardContent>
    </Card>
  );
}

function buildInput(parsed: ParsedTransaction): TransactionInput {
  return {
    amount: parsed.amount,
    type: parsed.type,
    category_id: parsed.categoryId,
    group_id: parsed.groupId,
    occurred_at: parsed.occurredAt,
    note: parsed.note,
    raw_input: parsed.rawInput,
    source: 'text_nl',
    lending: parsed.lending
      ? {
          counterparty: parsed.lending.counterparty,
          direction: parsed.lending.direction,
        }
      : null,
  };
}
