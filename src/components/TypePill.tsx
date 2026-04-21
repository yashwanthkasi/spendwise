import { TYPE_META } from '@/lib/constants';
import type { TransactionType } from '@/lib/db-types';
import { cn } from '@/lib/utils';

export function TypePill({
  type,
  className,
}: {
  type: TransactionType;
  className?: string;
}) {
  const meta = TYPE_META[type];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
