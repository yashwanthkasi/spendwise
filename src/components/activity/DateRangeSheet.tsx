import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetBody } from '@/components/ui/sheet';
import {
  customRange,
  DATE_PRESETS,
  rangeFromKey,
  type DateRange,
  type DateRangeKey,
} from '@/lib/dateRange';
import { cn } from '@/lib/utils';

export function DateRangeSheet({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (!open) return;
    if (value.key === 'custom' && value.from && value.to) {
      setCustomFrom(value.from.slice(0, 10));
      setCustomTo(value.to.slice(0, 10));
    } else {
      setCustomFrom('');
      setCustomTo('');
    }
  }, [open, value]);

  function selectPreset(k: DateRangeKey) {
    onChange(rangeFromKey(k));
    onOpenChange(false);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    onChange(customRange(customFrom, customTo));
    onOpenChange(false);
  }

  return (
    <SheetBody
      open={open}
      onOpenChange={onOpenChange}
      title="Date range"
      description="Pick a preset or set a custom range"
    >
      <div className="space-y-4 pt-1">
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((p) => {
            const active = value.key === p.key;
            return (
              <button
                key={p.key}
                onClick={() => selectPreset(p.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent',
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Custom range
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className="w-full"
          >
            Apply custom range
          </Button>
        </div>
      </div>
    </SheetBody>
  );
}
