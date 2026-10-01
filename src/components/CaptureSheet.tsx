import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SheetBody } from "./ui/sheet";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { MicButton } from "./MicButton";
import { TransactionForm } from "./TransactionForm";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  saveTransactions,
  setDeleted,
  type TransactionInput,
} from "@/hooks/useTransactions";
import { capture } from "@/services/capture";
import { getCurrentPlace } from "@/services/location";
import { supabase } from "@/lib/supabase";
export function CaptureSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"smart" | "form">("smart");
  const [text, setText] = useState("");
  const [source, setSource] = useState<"text_nl" | "voice_nl">("text_nl");
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const request = useRef({ id: crypto.randomUUID(), payload: "" });
  const locked = useRef(false);
  useEffect(() => {
    if (open) setSaved([]);
  }, [open]);
  const draftKey = `spendwise:draft:${user?.id}`;
  useEffect(() => {
    if (user) {
      try {
        const raw = sessionStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw);
          setText(d.text ?? "");
          request.current = d.request ?? request.current;
        }
      } catch {
        /* storage unavailable */
      }
    }
  }, [draftKey, user]);
  function persist(value: string) {
    setText(value);
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ text: value, request: request.current }),
      );
    } catch {
      /* private browsing */
    }
  }
  function requestId(payload: string) {
    if (request.current.payload !== payload)
      request.current = { id: crypto.randomUUID(), payload };
    return request.current.id;
  }
  async function finish(ids: string[]) {
    setSaved(ids);
    request.current={id:crypto.randomUUID(),payload:""};
    setText("");
    setQuestions([]);
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      /* storage unavailable */
    }
    await qc.invalidateQueries({ queryKey: ["transactions"] });
    if (profile?.location_enabled) {
      void getCurrentPlace()
        .then(async (place) => {
          if (!place) return;
          const { error } = await supabase
            .from("transactions")
            .update({
              latitude: place.latitude,
              longitude: place.longitude,
              place_label: place.label,
            })
            .in("id", ids)
            .eq("user_id", user!.id);
          if (!error) void qc.invalidateQueries({ queryKey: ["transactions"] });
        })
        .catch(() => {});
    }
  }
  async function submit(value = text, kind = source) {
    if (locked.current || !value.trim()) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setSaved([]);
    const id = requestId(value);
    persist(value);
    try {
      const result = await capture(value, kind, id);
      if (result.status === "saved") await finish(result.ids);
      else if (result.status === "clarify") setQuestions(result.questions);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save. Please retry.",
      );
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  async function manual(input: TransactionInput) {
    if (locked.current) return;
    locked.current = true;
    setError("");
    setBusy(true);
    try {
      const id = requestId(JSON.stringify(input));
      persist(text);
      const ids = await saveTransactions([input], id);
      await finish(ids);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save. Please retry.",
      );
      throw e;
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return (
    <SheetBody
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
      title="Add transaction"
      description="A sentence is all you need. Or use the form."
    >
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-muted p-1">
        {(["smart", "form"] as const).map((m) => (
          <button
            key={m}
            disabled={busy}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-lg text-sm ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "smart" ? "Type or speak" : "Use form"}
          </button>
        ))}
      </div>
      {saved.length > 0 ? (
        <div
          role="status"
          className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5"
        >
          <p className="font-medium">
            Saved {saved.length} transaction{saved.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center text-sm underline"
              to={`/transactions?range=all&selected=${saved[0]}`}
              onClick={() => onOpenChange(false)}
            >
              View or edit
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await setDeleted(saved, true);
                  await qc.invalidateQueries({ queryKey: ["transactions"] });
                  setSaved([]);
                  toast.success("Undone");
                } catch {
                  toast.error("Could not undo. Please retry.");
                }
              }}
            >
              Undo
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSaved([]);
                request.current = { id: crypto.randomUUID(), payload: "" };
              }}
            >
              Add another
            </Button>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {mode === "smart" ? (
            <div className="space-y-4">
              {questions.length > 0 && (
                <div role="status" className="rounded-xl border p-4">
                  <p className="mb-2 font-medium">One more detail</p>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Update your message below, then submit again. Nothing has
                    been saved.
                  </p>
                </div>
              )}
              <label
                htmlFor="capture-text"
                className="block text-sm font-medium"
              >
                What happened?
              </label>
              <Textarea
                id="capture-text"
                value={text}
                disabled={busy}
                onChange={(e) => {
                  persist(e.target.value);
                  setSource("text_nl");
                }}
                placeholder="Yesterday I spent 250 on lunch and 120 on an Uber for Office"
                rows={5}
              />
              <div className="flex items-center justify-between">
                <MicButton
                  onDraft={persist}
                  disabled={busy}
                  onTranscript={(t) => {
                    setSource("voice_nl");
                    persist(t);
                    void submit(t, "voice_nl");
                  }}
                />
                <Button
                  disabled={busy || !text.trim()}
                  onClick={() => void submit()}
                >
                  {busy ? "Saving…" : "Add transaction"}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Include the amount, purpose, date, and group if needed. Clear
                entries save automatically. You can edit or undo afterwards.
              </p>
            </div>
          ) : (
            <TransactionForm
              draftKey={`spendwise:manual:${user?.id}`}
              key={saved.join(",")}
              onSubmit={manual}
              initialDraft={text ? { note: text } : undefined}
            />
          )}
        </>
      )}
    </SheetBody>
  );
}
