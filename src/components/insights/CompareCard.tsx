import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatINR } from '@/lib/utils';

interface Metric {
  label: string;
  current: number;
  previous: number;
  // For expenses: lower is better → "down" = good (green).
  // For income/net: higher is better → "up" = good (green).
  positiveDirection: 'up' | 'down';
}

export function CompareCard({
  spent,
  income,
  spentPrev,
  incomePrev,
  prevLabel,
}: {
  spent: number;
  income: number;
  spentPrev: number;
  incomePrev: number;
  prevLabel: string;
}) {
  const net = income - spent;
  const netPrev = incomePrev - spentPrev;

  const metrics: Metric[] = [
    {
      label: 'Spent',
      current: spent,
      previous: spentPrev,
      positiveDirection: 'down',
    },
    {
      label: 'Income',
      current: income,
      previous: incomePrev,
      positiveDirection: 'up',
    },
    {
      label: 'Net',
      current: net,
      previous: netPrev,
      positiveDirection: 'up',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {metrics.map((m) => (
        <MetricTile key={m.label} metric={m} prevLabel={prevLabel} />
      ))}
    </div>
  );
}

function MetricTile({ metric, prevLabel }: { metric: Metric; prevLabel: string }) {
  const delta = metric.current - metric.previous;
  const pct = metric.previous !== 0 ? (delta / Math.abs(metric.previous)) * 100 : null;

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (Math.abs(delta) > 0.5) trend = delta > 0 ? 'up' : 'down';

  const isGood =
    trend === 'flat'
      ? true
      : metric.positiveDirection === 'up'
        ? trend === 'up'
        : trend === 'down';

  return (
    <Card>
      <CardContent className="space-y-1 p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {metric.label}
        </div>
        <div className="truncate text-lg font-bold tabular-nums">
          {formatINR(metric.current)}
        </div>
        <div
          className={cn(
            'flex items-center gap-1 text-[11px] font-medium',
            trend === 'flat'
              ? 'text-muted-foreground'
              : isGood
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-destructive',
          )}
          title={`vs ${prevLabel}`}
        >
          {trend === 'up' ? (
            <ArrowUp className="h-3 w-3" />
          ) : trend === 'down' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {pct === null
            ? 'no prior'
            : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs prev`}
        </div>
      </CardContent>
    </Card>
  );
}
