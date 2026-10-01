import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SheetBody } from "@/components/ui/sheet";
import { ColorPicker } from "@/components/ColorSwatch";
import { TypePill } from "@/components/TypePill";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type CategoryInput,
} from "@/hooks/useCategories";
import type { Category, TransactionType } from "@/lib/db-types";
import { TYPE_ORDER } from "@/lib/constants";

const DEFAULT_FORM: CategoryInput = {
  name: "",
  type: "expense",
  emoji: "🏷️",
  color: "#64748b",
  description: "",
};

export function CategoriesManager() {
  const { data: cats = [], isLoading } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const del = useDeleteCategory();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryInput>(DEFAULT_FORM);

  function openCreate(type?: TransactionType) {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, type: type ?? "expense" });
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setForm({
      name: c.name,
      type: c.type,
      emoji: c.emoji,
      color: c.color,
      description: c.description ?? "",
    });
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: {
            name: form.name.trim(),
            type: form.type,
            emoji: form.emoji ?? null,
            color: form.color ?? null,
            description: form.description?.trim() || null,
          },
        });
        toast.success("Updated");
      } else {
        await create.mutateAsync(form);
        toast.success("Created");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete "${c.name}"? Transactions using it will be unlinked.`))
      return;
    try {
      await del.mutateAsync(c.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const grouped: Record<TransactionType, Category[]> = {
    expense: [],
    income: [],
    investment: [],
    lending: [],
    transfer: [],
  };
  for (const c of cats) grouped[c.type].push(c);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        TYPE_ORDER.map((t) => (
          <section key={t} className="space-y-2">
            <div className="flex items-center justify-between">
              <TypePill type={t} />
              <button
                onClick={() => openCreate(t)}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {grouped[t].length === 0 ? (
              <p className="text-xs text-muted-foreground">No categories</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {grouped[t].map((c) => (
                  <CategoryChip
                    key={c.id}
                    c={c}
                    onEdit={() => openEdit(c)}
                    onDelete={() => remove(c)}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}

      <SheetBody
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit category" : "New category"}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input aria-label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Coffee, Rent, SIP"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as TransactionType }))
                }
              >
                <SelectTrigger aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Emoji</Label>
              <Input aria-label="Emoji"
                value={form.emoji ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, emoji: e.target.value }))
                }
                placeholder="🏷️"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea aria-label="Description"
              rows={2}
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder='Shown as a tooltip. e.g. "Daily meals — rice, dal, roti. e.g. rice 400"'
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker
              value={form.color}
              onChange={(c) => setForm((f) => ({ ...f, color: c }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || update.isPending}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </SheetBody>
    </div>
  );
}

function CategoryChip({c,onEdit,onDelete}:{c:Category;onEdit:()=>void;onDelete:()=>void}) {
 return <div className="flex w-full items-center gap-3 border-b py-2"><button type="button" aria-label={`Edit ${c.name}`} onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm"><span className="h-2 w-2 shrink-0 rounded-full" style={{background:c.color??'hsl(var(--primary))'}}/><span className="truncate">{c.name}</span></button><Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={onDelete}><Trash2 size={16} className="text-muted-foreground"/></Button></div>;
}
