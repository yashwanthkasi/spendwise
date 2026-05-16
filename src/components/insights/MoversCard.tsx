import { ArrowDown, ArrowUp, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatINR } from '@/lib/utils';

export interface Mover {
  name: string;
  emoji: string | null;
  color: string | null;
  current: number;
  previous: number;
}

export function MoversCard({ movers }: { movers: Mover[] }) {
  if (movers.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" /> Top movers
        </div>
        <div className="space-y-2">
          {movers.map((m) => {
            const delta = m.current - m.previous;
            const pct =
              m.previous > 0 ? (delta / m.previous) * 100 : delta > 0 ? 100 : 0;
            const direction = delta > 0 ? 'up' : 'down';
            return (
              <div
                key={m.name}
                className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg"
                  style={{
                    backgroundColor: `${m.color ?? '#94a3b8'}1a`,
                  }}
                >
                  {m.emoji ?? '🏷️'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatINR(m.current)} now · {formatINR(m.previous)} prev
                  </div>
                </div>
                <div
                  className={cn(
                    'flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums',
                    direction === 'up'
                      ? 'text-destructive'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {direction === 'up' ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                  {Math.abs(pct).toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
