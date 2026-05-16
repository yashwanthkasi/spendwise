import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SheetBody } from '@/components/ui/sheet';
import type { Category, Group, TransactionType } from '@/lib/db-types';
import { cn } from '@/lib/utils';

export type TypeFilter =
  | 'all'
  | 'expense'
  | 'income'
  | 'investment'
  | 'lending'
  | 'transfer';

const TYPE_CHIPS: Array<{ value: TypeFilter; label: string; emoji: string }> = [
  { value: 'all', label: 'All', emoji: '✨' },
  { value: 'expense', label: 'Expense', emoji: '💸' },
  { value: 'income', label: 'Income', emoji: '💰' },
  { value: 'investment', label: 'Invest', emoji: '📈' },
  { value: 'lending', label: 'Lending', emoji: '🤝' },
  { value: 'transfer', label: 'Transfer', emoji: '🔁' },
];

export function FiltersSheet({
  open,
  onOpenChange,
  filter,
  setFilter,
  groupFilter,
  setGroupFilter,
  categoryFilter,
  setCategoryFilter,
  search,
  setSearch,
  groups,
  categories,
  onNewGroup,
  onClearAll,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filter: TypeFilter;
  setFilter: (v: TypeFilter) => void;
  groupFilter: string;
  setGroupFilter: (id: string) => void;
  categoryFilter: string;
  setCategoryFilter: (id: string) => void;
  search: string;
  setSearch: (q: string) => void;
  groups: Group[];
  categories: Category[];
  onNewGroup: () => void;
  onClearAll: () => void;
}) {
  const visibleCats =
    filter === 'all'
      ? categories
      : categories.filter((c) => c.type === (filter as TransactionType));

  return (
    <SheetBody
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      description="Narrow the activity list"
    >
      <div className="space-y-5 pt-1">
        <div className="flex items-center justify-end">
          <button
            onClick={onClearAll}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        </div>

        <Section label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              placeholder="Search notes"
            />
          </div>
        </Section>

        <Section label="Type">
          <Wrap>
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
          </Wrap>
        </Section>

        <Section label="Groups">
          <Wrap>
            <Chip
              active={groupFilter === 'all'}
              onClick={() => setGroupFilter('all')}
            >
              <span>📂</span> All
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
              onClick={onNewGroup}
              className="flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-3 w-3" /> New group
            </button>
          </Wrap>
        </Section>

        <Section label={filter === 'all' ? 'Category' : `Category (${filter})`}>
          <Wrap>
            <Chip
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
            >
              <span>🏷️</span> All
            </Chip>
            {visibleCats.map((c) => (
              <Chip
                key={c.id}
                active={categoryFilter === c.id}
                onClick={() => setCategoryFilter(c.id)}
                color={c.color}
              >
                <span>{c.emoji ?? '🏷️'}</span>
                {c.name}
              </Chip>
            ))}
          </Wrap>
        </Section>

        <div className="flex justify-end pt-1">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </div>
    </SheetBody>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
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
        'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-transparent shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:bg-accent',
      )}
      style={
        active ? { backgroundColor: tint, color: 'white' } : undefined
      }
    >
      {children}
    </button>
  );
}
