import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { SheetBody } from '@/components/ui/sheet';
import { PageHeader } from '@/components/PageHeader';
import { TransactionForm } from '@/components/TransactionForm';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { QuickGroupSheet } from '@/components/QuickGroupSheet';
import { useGroups } from '@/hooks/useGroups';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  type TransactionWithRelations,
} from '@/hooks/useTransactions';
import type { TransactionType } from '@/lib/db-types';
import { formatINR, cn } from '@/lib/utils';

type Filter = 'all' | 'expense' | 'income' | 'investment' | 'lending' | 'transfer';

const TYPE_CHIPS: Array<{ value: Filter; label: string; emoji: string }> = [
  { value: 'all', label: 'All', emoji: '✨' },
  { value: 'expense', label: 'Expense', emoji: '💸' },
  { value: 'income', label: 'Income', emoji: '💰' },
  { value: 'investment', label: 'Invest', emoji: '📈' },
  { value: 'lending', label: 'Lending', emoji: '🤝' },
  { value: 'transfer', label: 'Transfer', emoji: '🔁' },
];

export default function Activity() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(
    (params.get('filter') as Filter | null) ?? 'all',
  );
  const [groupFilter, setGroupFilter] = useState<string>(
    params.get('group') ?? 'all',
  );
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);
  const [selected, setSelected] = useState<TransactionWithRelations | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const typeFilter: TransactionType | 'all' = filter === 'all' ? 'all' : filter;

  const { data: txns = [], isLoading } = useTransactions({
    type: typeFilter,
    groupId: groupFilter === 'all' ? 'all' : groupFilter,
    search: search || undefined,
    limit: 500,
  });
  const { data: groups = [] } = useGroups();

  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();

  // Sync filter/group back to URL
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (filter === 'all') next.delete('filter');
    else next.set('filter', filter);
    if (groupFilter === 'all') next.delete('group');
    else next.set('group', groupFilter);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, groupFilter]);

  const total = useMemo(
    () => txns.reduce((acc, t) => acc + Number(t.amount), 0),
    [txns],
  );

  const lendingSummary = useMemo(() => {
    if (filter !== 'lending') return null;
    let lent = 0;
    let borrowed = 0;
    for (const t of txns) {
      const d = t.lending_details;
      if (!d || d.settled) continue;
      if (d.direction === 'lent') lent += Number(t.amount);
      else borrowed += Number(t.amount);
    }
    return { lent, borrowed };
  }, [txns, filter]);

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
    <div className="space-y-5">
      <PageHeader
        title="Activity"
        subtitle={`${txns.length} · ${formatINR(total)}`}
        action={
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          placeholder="Search notes"
        />
      </div>

      {/* Type chips */}
      <ChipRow>
        {TYPE_CHIPS.map((c) => (
          <Chip
            key={c.value}
            active={filter === c.value}
            onClick={() => setFilter(c.value)}
          >
            <span>{c.emoji}</span>
            {c.label}
          </Chip>
        ))}
      </ChipRow>

      {/* Group chips */}
      <ChipRow>
        <Chip active={groupFilter === 'all'} onClick={() => setGroupFilter('all')}>
          <span>📂</span> All groups
        </Chip>
        {groups.map((g) => (
          <Chip
            key={g.id}
            active={groupFilter === g.id}
            onClick={() => setGroupFilter(g.id)}
            color={g.color}
          >
            <span>{g.emoji ?? '📁'}</span>
            {g.name}
          </Chip>
        ))}
        <button
          onClick={() => setNewGroupOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" /> New group
        </button>
      </ChipRow>

      {/* Lending summary — only on lending filter */}
      {lendingSummary && (
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="flex items-center gap-2 p-3">
              <div className="rounded-md bg-[#6366f11a] p-1.5 text-[#6366f1]">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">They owe you</div>
                <div className="text-sm font-semibold tabular-nums">
                  {formatINR(lendingSummary.lent)}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-2 p-3">
              <div className="rounded-md bg-[#e11d481a] p-1.5 text-[#e11d48]">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">You owe</div>
                <div className="text-sm font-semibold tabular-nums">
                  {formatINR(lendingSummary.borrowed)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List — uniform, tappable rows */}
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : txns.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing matches these filters.
        </div>
      ) : (
        <motion.div layout className="space-y-2">
          {txns.map((t) => (
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

      {/* Detail sheet */}
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

      {/* Add sheet */}
      <SheetBody open={addOpen} onOpenChange={setAddOpen} title="New transaction">
        <TransactionForm
          submitLabel="Add"
          onCancel={() => setAddOpen(false)}
          onSubmit={async (input) => {
            try {
              await create.mutateAsync(input);
              toast.success('Added');
              setAddOpen(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed');
            }
          }}
        />
      </SheetBody>

      {/* Edit sheet */}
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

      {/* Quick group creation */}
      <QuickGroupSheet
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onCreated={(id) => setGroupFilter(id)}
      />
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string | null;
  children: React.ReactNode;
}) {
  const tint = color ?? '#6366f1';
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-transparent text-white shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:bg-accent',
      )}
      style={
        active
          ? { backgroundColor: tint, borderColor: tint, color: 'white' }
          : undefined
      }
    >
      {children}
    </button>
  );
}
