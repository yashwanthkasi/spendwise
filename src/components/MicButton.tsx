import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isVoiceSupported, startVoiceCapture, type VoiceSession } from '@/services/voice';

export function MicButton({
  onTranscript,
  disabled,
  variant = 'icon',
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** 'icon' = small inline button; 'hero' = large tap-to-speak control. */
  variant?: 'icon' | 'hero';
}) {
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState('');
  const sessionRef = useRef<VoiceSession | null>(null);
  const lastInterimRef = useRef('');
  const supported = isVoiceSupported();

  useEffect(() => () => sessionRef.current?.stop(), []);

  function toggle() {
    if (!supported) {
      toast.error('Voice input not supported in this browser');
      return;
    }
    if (recording) {
      sessionRef.current?.stop();
      return;
    }
    setRecording(true);
    setInterim('');
    lastInterimRef.current = '';
    let finalText = '';
    sessionRef.current = startVoiceCapture({
      onResult: (r) => {
        if (r.isFinal) {
          finalText = r.transcript;
        } else {
          lastInterimRef.current = r.transcript;
          setInterim(r.transcript);
        }
      },
      onError: (msg) => {
        toast.error(`Voice: ${msg}`);
      },
      onEnd: () => {
        setRecording(false);
        setInterim('');
        sessionRef.current = null;
        // Prefer the final transcript; fall back to the latest interim if the
        // engine ended without emitting a final result.
        const text = (finalText || lastInterimRef.current).trim();
        if (text) onTranscript(text);
      },
    });
  }

  // ── Large hero control ────────────────────────────────────────────────
  if (variant === 'hero') {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || !supported}
          aria-label={recording ? 'Stop recording' : 'Start voice input'}
          className={cn(
            'relative flex h-24 w-24 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-all',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-50',
            recording
              ? 'bg-destructive'
              : 'bg-primary hover:scale-105 active:scale-95',
          )}
        >
          {recording && (
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />
          )}
          {!supported ? (
            <MicOff className="h-9 w-9" />
          ) : recording ? (
            <Square className="h-8 w-8" />
          ) : (
            <Mic className="h-10 w-10" />
          )}
        </button>
        <p className="min-h-5 text-center text-sm text-muted-foreground">
          {!supported ? (
            'Voice not supported here'
          ) : recording ? (
            <span className="font-medium text-foreground">
              {interim || 'Listening…'}
            </span>
          ) : (
            <>Tap and say &ldquo;panipuri 40&rdquo;</>
          )}
        </p>
      </div>
    );
  }

  // ── Small inline icon button ──────────────────────────────────────────
  return (
    <Button
      type="button"
      variant={recording ? 'destructive' : 'ghost'}
      size="icon"
      onClick={toggle}
      disabled={disabled || !supported}
      aria-label={recording ? 'Stop recording' : 'Start voice input'}
      className={cn(recording && 'animate-pulse')}
      title={supported ? (recording ? 'Stop' : 'Speak') : 'Voice unsupported'}
    >
      {!supported ? (
        <MicOff className="h-4 w-4" />
      ) : recording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
