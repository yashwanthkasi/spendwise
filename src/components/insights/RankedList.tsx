import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatINR } from '@/lib/utils';

export interface RankedItem {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  amount: number;
  count: number;
}

/**
 * A scrollable list of items sorted by amount (descending).
 * Shows a thin share-of-total bar under each row for at-a-glance distribution.
 * Falls back to a friendly empty state when there's nothing to show.
 */
export function RankedList({
  title,
  items,
  emptyText = 'Nothing yet.',
  maxRows = 4,
}: {
  title: string;
  items: RankedItem[];
  emptyText?: string;
  maxRows?: number;
}) {
  const total = items.reduce((acc, i) => acc + i.amount, 0);
  // Roughly 56px per row including its bar — cap the visible height so the
  // rest scrolls.
  const maxH = `${maxRows * 56}px`;

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <div
            className="space-y-3 overflow-y-auto overscroll-contain pr-1"
            style={{ maxHeight: items.length > maxRows ? maxH : undefined }}
          >
            {items.map((item) => {
              const pct = total > 0 ? (item.amount / total) * 100 : 0;
              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base"
                      style={{
                        backgroundColor: `${item.color ?? '#94a3b8'}1a`,
                      }}
                    >
                      {item.emoji ?? '🏷️'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {formatINR(item.amount)}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div className="ml-10 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full')}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.color ?? '#94a3b8',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
