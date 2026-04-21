import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetBody } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColorPicker } from '@/components/ColorSwatch';
import {
  useCreateGroup,
  useDeleteGroup,
  useGroups,
  useUpdateGroup,
  type GroupInput,
} from '@/hooks/useGroups';
import { EMOJI_SUGGESTIONS } from '@/lib/constants';
import type { Group, GroupKind } from '@/lib/db-types';
import { cn } from '@/lib/utils';

const DEFAULT_FORM: GroupInput = {
  name: '',
  emoji: '🏠',
  color: '#6366f1',
  kind: 'persistent',
  start_date: null,
  end_date: null,
};

export function GroupsManager() {
  const { data: groups = [], isLoading } = useGroups({ includeArchived: true });
  const create = useCreateGroup();
  const update = useUpdateGroup();
  const del = useDeleteGroup();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState<GroupInput>(DEFAULT_FORM);

  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setOpen(true);
  }
  function openEdit(g: Group) {
    setEditing(g);
    setForm({
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      kind: g.kind,
      start_date: g.start_date,
      end_date: g.end_date,
    });
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: form });
        toast.success('Updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Created');
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function toggleArchive(g: Group) {
    try {
      await update.mutateAsync({ id: g.id, patch: { archived: !g.archived } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function remove(g: Group) {
    if (!confirm(`Delete "${g.name}"? Transactions will be unlinked.`)) return;
    try {
      await del.mutateAsync(g.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {active.map((g) => (
              <GroupChip key={g.id} g={g} onEdit={openEdit} onArchive={toggleArchive} onDelete={remove} />
            ))}
            <button
              onClick={openCreate}
              className="flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add group
            </button>
          </div>

          {archived.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-medium text-muted-foreground">Archived</div>
              <div className="flex flex-wrap gap-2 opacity-60">
                {archived.map((g) => (
                  <GroupChip
                    key={g.id}
                    g={g}
                    onEdit={openEdit}
                    onArchive={toggleArchive}
                    onDelete={remove}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <SheetBody
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit group' : 'New group'}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Home / Office / Trip to Goa"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as GroupKind }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="persistent">Persistent</SelectItem>
                  <SelectItem value="trip">Trip (dated)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1">
                {EMOJI_SUGGESTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md border text-lg hover:bg-accent',
                      form.emoji === e && 'border-primary bg-accent',
                    )}
                    onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {form.kind === 'trip' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="date"
                  value={form.start_date ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, start_date: e.target.value || null }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="date"
                  value={form.end_date ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, end_date: e.target.value || null }))
                  }
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </SheetBody>
    </div>
  );
}

function GroupChip({
  g,
  onEdit,
  onArchive,
  onDelete,
}: {
  g: Group;
  onEdit: (g: Group) => void;
  onArchive: (g: Group) => void;
  onDelete: (g: Group) => void;
}) {
  return (
    <div
      className="group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
      style={{ backgroundColor: `${g.color ?? '#6366f1'}14`, borderColor: `${g.color ?? '#6366f1'}33` }}
    >
      <span>{g.emoji ?? '📁'}</span>
      <span className="font-medium">{g.name}</span>
      <span className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(g)} aria-label="Edit">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onArchive(g)}
          aria-label={g.archived ? 'Restore' : 'Archive'}
        >
          {g.archived ? (
            <ArchiveRestore className="h-3 w-3" />
          ) : (
            <Archive className="h-3 w-3" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(g)} aria-label="Delete">
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </span>
    </div>
  );
}
