import {
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  format,
} from 'date-fns';

export type DateRangeKey =
  | 'this-month'
  | 'last-month'
  | '7d'
  | '30d'
  | 'this-year'
  | 'all'
  | 'custom';

export interface DateRange {
  key: DateRangeKey;
  from: string | null; // ISO
  to: string | null;
  label: string;
}

export const DATE_PRESETS: Array<{ key: DateRangeKey; label: string }> = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'this-year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

export function rangeFromKey(key: DateRangeKey, now = new Date()): DateRange {
  const today = endOfDay(now);
  switch (key) {
    case 'this-month':
      return {
        key,
        from: startOfMonth(now).toISOString(),
        to: endOfMonth(now).toISOString(),
        label: 'This month',
      };
    case 'last-month': {
      const lm = subMonths(now, 1);
      return {
        key,
        from: startOfMonth(lm).toISOString(),
        to: endOfMonth(lm).toISOString(),
        label: 'Last month',
      };
    }
    case '7d':
      return {
        key,
        from: startOfDay(subDays(today, 6)).toISOString(),
        to: today.toISOString(),
        label: 'Last 7 days',
      };
    case '30d':
      return {
        key,
        from: startOfDay(subDays(today, 29)).toISOString(),
        to: today.toISOString(),
        label: 'Last 30 days',
      };
    case 'this-year':
      return {
        key,
        from: startOfYear(now).toISOString(),
        to: endOfYear(now).toISOString(),
        label: 'This year',
      };
    case 'all':
      return { key, from: null, to: null, label: 'All time' };
    case 'custom':
      return { key, from: null, to: null, label: 'Custom' };
  }
}

export function customRange(fromYmd: string, toYmd: string): DateRange {
  let from = fromYmd;
  let to = toYmd;
  if (from > to) [from, to] = [to, from];
  return {
    key: 'custom',
    from: startOfDay(new Date(from)).toISOString(),
    to: endOfDay(new Date(to)).toISOString(),
    label: `${format(new Date(from), 'd MMM')} → ${format(new Date(to), 'd MMM yyyy')}`,
  };
}

export function rangeFromParams(params: URLSearchParams): DateRange {
  const k = params.get('range') as DateRangeKey | null;
  if (k === 'custom') {
    const from = params.get('from');
    const to = params.get('to');
    if (from && to) return customRange(from.slice(0, 10), to.slice(0, 10));
  }
  if (
    k === 'this-month' ||
    k === 'last-month' ||
    k === '7d' ||
    k === '30d' ||
    k === 'this-year' ||
    k === 'all'
  ) {
    return rangeFromKey(k);
  }
  return rangeFromKey('this-month');
}
