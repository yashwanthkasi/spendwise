import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isVoiceSupported, startVoiceCapture, type VoiceSession } from '@/services/voice';

export function MicButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const sessionRef = useRef<VoiceSession | null>(null);
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
    let finalText = '';
    sessionRef.current = startVoiceCapture({
      onResult: (r) => {
        if (r.isFinal) finalText = r.transcript;
      },
      onError: (msg) => {
        toast.error(`Voice: ${msg}`);
      },
      onEnd: () => {
        setRecording(false);
        sessionRef.current = null;
        if (finalText.trim()) onTranscript(finalText.trim());
      },
    });
  }

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
