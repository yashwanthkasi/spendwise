import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  CalendarDays,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SheetBody } from '@/components/ui/sheet';
import { PageHeader } from '@/components/PageHeader';
import { TransactionForm } from '@/components/TransactionForm';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { QuickGroupSheet } from '@/components/QuickGroupSheet';
import { useGroups } from '@/hooks/useGroups';
import { useCategories } from '@/hooks/useCategories';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  type TransactionWithRelations,
} from '@/hooks/useTransactions';
import type { TransactionType } from '@/lib/db-types';
import { formatINR, cn } from '@/lib/utils';
import {
  rangeFromKey,
  rangeFromParams,
  type DateRange,
} from '@/lib/dateRange';
import { DateRangeSheet } from '@/components/activity/DateRangeSheet';
import {
  FiltersSheet,
  type TypeFilter,
} from '@/components/activity/FiltersSheet';
import { StatsBar } from '@/components/activity/StatsBar';
import { AiSummaryCard } from '@/components/activity/AiSummaryCard';

export default function Activity() {
  const [params, setParams] = useSearchParams();

  // ── filter state ────────────────────────────────────────────────────
  const [range, setRange] = useState<DateRange>(() => rangeFromParams(params));
  const [filter, setFilter] = useState<TypeFilter>(
    (params.get('filter') as TypeFilter | null) ?? 'all',
  );
  const [groupFilter, setGroupFilter] = useState<string>(
    params.get('group') ?? 'all',
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(
    params.get('cat') ?? 'all',
  );
  const [search, setSearch] = useState<string>(params.get('q') ?? '');

  // ── sheet state ─────────────────────────────────────────────────────
  const [dateOpen, setDateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);
  const [selected, setSelected] = useState<TransactionWithRelations | null>(null);

  // ── data ────────────────────────────────────────────────────────────
  const { data: txns = [], isLoading } = useTransactions({
    type: filter === 'all' ? 'all' : (filter as TransactionType),
    groupId: groupFilter === 'all' ? 'all' : groupFilter,
    categoryId: categoryFilter === 'all' ? 'all' : categoryFilter,
    search: search || undefined,
    from: range.from ?? undefined,
    to: range.to ?? undefined,
    limit: 1000,
  });
  const { data: groups = [] } = useGroups();
  const { data: categories = [] } = useCategories();

  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();

  // ── URL sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const next = new URLSearchParams(params);
    // range
    if (range.key === 'this-month') next.delete('range');
    else next.set('range', range.key);
    if (range.key === 'custom' && range.from && range.to) {
      next.set('from', range.from.slice(0, 10));
      next.set('to', range.to.slice(0, 10));
    } else {
      next.delete('from');
      next.delete('to');
    }
    // others
    if (filter === 'all') next.delete('filter');
    else next.set('filter', filter);
    if (groupFilter === 'all') next.delete('group');
    else next.set('group', groupFilter);
    if (categoryFilter === 'all') next.delete('cat');
    else next.set('cat', categoryFilter);
    if (!search) next.delete('q');
    else next.set('q', search);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, filter, groupFilter, categoryFilter, search]);

  // drop category that no longer matches selected type
  useEffect(() => {
    if (categoryFilter === 'all' || filter === 'all') return;
    const c = categories.find((x) => x.id === categoryFilter);
    if (c && c.type !== filter) setCategoryFilter('all');
  }, [filter, categoryFilter, categories]);

  // ── derived ────────────────────────────────────────────────────────
  const activeFilterCount =
    (filter !== 'all' ? 1 : 0) +
    (groupFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (search ? 1 : 0);
  const filtersActive = activeFilterCount > 0 || range.key !== 'this-month';

  function clearAll() {
    setRange(rangeFromKey('this-month'));
    setFilter('all');
    setGroupFilter('all');
    setCategoryFilter('all');
    setSearch('');
  }

  const filterDesc = useMemo(() => {
    const parts: string[] = [];
    if (filter !== 'all') parts.push(`type=${filter}`);
    if (groupFilter !== 'all') {
      const g = groups.find((x) => x.id === groupFilter);
      if (g) parts.push(`group=${g.name}`);
    }
    if (categoryFilter !== 'all') {
      const c = categories.find((x) => x.id === categoryFilter);
      if (c) parts.push(`category=${c.name}`);
    }
    if (search) parts.push(`search="${search}"`);
    return parts.length ? parts.join(', ') : 'no filters';
  }, [filter, groupFilter, categoryFilter, search, groups, categories]);

  const insightSignature = `${range.key}|${range.from}|${range.to}|${filter}|${groupFilter}|${categoryFilter}|${search}`;

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

  // ── mutations ──────────────────────────────────────────────────────
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
    <div className="space-y-4">
      <PageHeader
        title="Activity"
        action={
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        }
      />

      {/* Filter bar — two pills */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          icon={<CalendarDays className="h-4 w-4" />}
          label={range.label}
          onClick={() => setDateOpen(true)}
          primary
        />
        <FilterPill
          icon={<SlidersHorizontal className="h-4 w-4" />}
          label="Filters"
          onClick={() => setFiltersOpen(true)}
          badge={activeFilterCount}
        />
        {filtersActive && (
          <button
            onClick={clearAll}
            className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>

      {/* Stats — react to current filter set */}
      <StatsBar txns={txns} filter={filter} />

      {/* AI insight */}
      <AiSummaryCard
        txns={txns}
        rangeLabel={range.label}
        filterDesc={filterDesc}
        signature={insightSignature}
      />

      {/* Lending sub-summary when narrowed to lending */}
      {lendingSummary && (
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="flex items-center gap-2 p-3">
              <div className="rounded-md bg-[#6366f11a] p-1.5 text-[#6366f1]">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Outstanding · they owe you
                </div>
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
                <div className="text-xs text-muted-foreground">
                  Outstanding · you owe
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {formatINR(lendingSummary.borrowed)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : txns.length === 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <div>Nothing matches these filters.</div>
          {filtersActive && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              Reset filters
            </button>
          )}
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

      {/* Detail */}
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

      {/* Add */}
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

      {/* Edit */}
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

      {/* Date range */}
      <DateRangeSheet
        open={dateOpen}
        onOpenChange={setDateOpen}
        value={range}
        onChange={setRange}
      />

      {/* Filters */}
      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filter={filter}
        setFilter={setFilter}
        groupFilter={groupFilter}
        setGroupFilter={setGroupFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        search={search}
        setSearch={setSearch}
        groups={groups}
        categories={categories}
        onNewGroup={() => {
          setFiltersOpen(false);
          setNewGroupOpen(true);
        }}
        onClearAll={() => {
          setFilter('all');
          setGroupFilter('all');
          setCategoryFilter('all');
          setSearch('');
        }}
      />

      {/* Quick new group */}
      <QuickGroupSheet
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onCreated={(id) => {
          setGroupFilter(id);
          setFiltersOpen(true);
        }}
      />
    </div>
  );
}

function FilterPill({
  icon,
  label,
  onClick,
  badge,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
        primary
          ? 'border-primary/30 bg-primary/[0.06] text-foreground hover:bg-primary/10'
          : 'border-border bg-card text-foreground hover:bg-accent',
      )}
    >
      {icon}
      {label}
      {!!badge && badge > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}
