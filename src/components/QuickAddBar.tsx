import { FormEvent, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicButton } from '@/components/MicButton';

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

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const v = text.trim();
    if (!v) return;
    onSubmit(v);
    setText('');
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 rounded-xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring"
    >
      <Sparkles className="ml-2 h-5 w-5 text-muted-foreground" />
      <Input
        className="h-11 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder="rice 400 · SIP 10000 · lent Ravi 2000 office"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled || loading}
        autoFocus
      />
      <MicButton
        onTranscript={(t) => {
          setText(t);
          if (t.trim()) onSubmit(t.trim());
        }}
        disabled={disabled || loading}
      />
      <Button type="submit" disabled={!text.trim() || disabled || loading}>
        {loading ? 'Parsing…' : 'Add'}
      </Button>
    </form>
  );
}
