import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Sparkles, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MicButton } from '@/components/MicButton';

export type QuickAddSource = 'text_nl' | 'voice_nl';

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 140;

const isHoverDevice =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover)').matches;

export function QuickAddBar({
  onSubmit,
  disabled,
  loading,
}: {
  onSubmit: (text: string, source: QuickAddSource) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to MAX_HEIGHT, then scroll inside.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [text]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const v = text.trim();
    if (!v) return;
    onSubmit(v, 'text_nl');
    setText('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Desktop: Enter submits, Shift+Enter for newline.
    // Mobile/touch: Enter is always a newline; user taps Add.
    if (!isHoverDevice) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="rounded-3xl border bg-card p-5 shadow-sm">
      {/* Voice-first hero */}
      <MicButton
        variant="hero"
        onTranscript={(t) => {
          if (t.trim()) onSubmit(t.trim(), 'voice_nl');
        }}
        disabled={disabled || loading}
      />

      {/* Divider */}
      <div className="my-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or type
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Text fallback */}
      <form
        onSubmit={submit}
        className="flex items-end gap-2 rounded-2xl border bg-background p-2 transition-shadow focus-within:ring-2 focus-within:ring-ring"
      >
        <Textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled || loading}
          placeholder="panipuri 40 — or many at once: gobi 40, salary 95k"
          className="min-h-0 resize-none border-0 bg-transparent px-1.5 py-2 text-base leading-snug shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ height: MIN_HEIGHT }}
        />
        <Button
          type="submit"
          disabled={!text.trim() || disabled || loading}
          size="sm"
          className="shrink-0"
        >
          {loading ? 'Adding…' : 'Add'}
        </Button>
      </form>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        <Sparkles className="mr-1 inline h-3 w-3" />
        Auto-detects amount, category &amp; your location.
        {isHoverDevice && (
          <span className="ml-1">
            <CornerDownLeft className="inline h-3 w-3" /> to add.
          </span>
        )}
      </p>
    </div>
  );
}
