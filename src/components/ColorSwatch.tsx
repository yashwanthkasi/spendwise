import { COLOR_PALETTE } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn(
            'h-6 w-6 rounded-full ring-offset-2 transition',
            value === c && 'ring-2 ring-ring',
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
