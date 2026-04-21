import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetBody } from '@/components/ui/sheet';
import { ColorPicker } from '@/components/ColorSwatch';
import { useCreateGroup } from '@/hooks/useGroups';
import { EMOJI_SUGGESTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function QuickGroupSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [color, setColor] = useState('#6366f1');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const g = await create.mutateAsync({
        name: name.trim(),
        emoji,
        color,
        kind: 'persistent',
      });
      toast.success(`Created "${g.name}"`);
      onCreated?.(g.id);
      onOpenChange(false);
      setName('');
      setEmoji('📁');
      setColor('#6366f1');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <SheetBody
      open={open}
      onOpenChange={onOpenChange}
      title="New group"
      description="Buckets help you filter — e.g. Home, Office, or a trip."
    >
      <form onSubmit={submit} className="space-y-4 pt-1">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Trip to Goa, Family, Side project…"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label>Emoji</Label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_SUGGESTIONS.map((e) => (
              <button
                key={e}
                type="button"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors hover:bg-accent',
                  emoji === e && 'border-primary bg-accent',
                )}
                onClick={() => setEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </SheetBody>
  );
}
