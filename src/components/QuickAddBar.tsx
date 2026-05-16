import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Sparkles, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MicButton } from '@/components/MicButton';

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 168;

const isHoverDevice =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover)').matches;

export function QuickAddBar({
  onSubmit,
  disabled,
  loading,
}: {
  onSubmit: (text: string) => void;
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
    onSubmit(v);
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

  const lineCount = (text.match(/\n/g)?.length ?? 0) + 1;

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border bg-card p-2 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring"
    >
      <div className="flex items-start gap-2">
        <Sparkles className="ml-1.5 mt-2.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <Textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled || loading}
          autoFocus
          placeholder="rice 400 — or many at once: gobi 40, salary 95k, lent Ravi 2000"
          className="min-h-0 resize-none border-0 bg-transparent px-1 py-2 text-base leading-snug shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ height: MIN_HEIGHT }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 pl-1 pr-1 pt-1">
        <p className="text-[11px] text-muted-foreground">
          {isHoverDevice ? (
            <>
              <CornerDownLeft className="inline h-3 w-3" /> to add,{' '}
              <kbd className="rounded bg-muted px-1 text-[10px]">Shift+Enter</kbd>{' '}
              for newline
            </>
          ) : (
            <>List many with commas or new lines</>
          )}
          {lineCount > 1 && (
            <span className="ml-2 text-primary">· {lineCount} lines</span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <MicButton
            onTranscript={(t) => {
              setText(t);
              if (t.trim()) onSubmit(t.trim());
            }}
            disabled={disabled || loading}
          />
          <Button
            type="submit"
            disabled={!text.trim() || disabled || loading}
            size="sm"
          >
            {loading ? 'Parsing…' : 'Add'}
          </Button>
        </div>
      </div>
    </form>
  );
}
