// Thin wrapper around the Web Speech API.
// Chrome/Edge/Safari desktop all expose webkitSpeechRecognition.

type SpeechRecognitionResult = {
  transcript: string;
  isFinal: boolean;
};

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getCtor() !== null;
}

export interface VoiceSession {
  stop(): void;
}

export function startVoiceCapture({
  lang = 'en-IN',
  onResult,
  onError,
  onEnd,
}: {
  lang?: string;
  onResult: (r: SpeechRecognitionResult) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
}): VoiceSession {
  const Ctor = getCtor();
  if (!Ctor) {
    onError?.('Voice not supported in this browser');
    onEnd?.();
    return { stop: () => {} };
  }
  const r = new Ctor();
  r.continuous = false;
  r.interimResults = true;
  r.lang = lang;
  r.onresult = (e: any) => {
    const last = e.results[e.results.length - 1];
    onResult({ transcript: last[0].transcript, isFinal: last.isFinal });
  };
  r.onerror = (e: any) => onError?.(e.error || 'voice error');
  r.onend = () => onEnd?.();
  r.start();
  return {
    stop: () => {
      try {
        r.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
