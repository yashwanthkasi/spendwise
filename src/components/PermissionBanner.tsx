import { useState } from 'react';
import { MapPin, Mic, X } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';

/**
 * Mounted once in the app shell. Silently prompts for location + microphone on
 * first load (via usePermissions). If either is denied, shows a compact,
 * dismissible nudge with a one-tap re-request (needed because some browsers
 * only allow the mic prompt from a user gesture).
 */
export function PermissionBanner() {
  const { location, microphone, request } = usePermissions();
  const [dismissed, setDismissed] = useState(false);

  const locBad = location === 'denied';
  const micBad = microphone === 'denied';

  if (dismissed || (!locBad && !micBad)) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] px-3 py-2.5 text-sm">
      <div className="flex shrink-0 items-center gap-1 text-amber-600 dark:text-amber-400">
        {micBad && <Mic className="h-4 w-4" />}
        {locBad && <MapPin className="h-4 w-4" />}
      </div>
      <p className="min-w-0 flex-1 text-xs text-amber-800 dark:text-amber-200">
        Enable {micBad && 'microphone'}
        {micBad && locBad && ' & '}
        {locBad && 'location'} to speak transactions and tag them by place.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 border-amber-500/50 px-2.5 text-xs"
        onClick={() => void request()}
      >
        Enable
      </Button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-600/70 hover:text-amber-700 dark:text-amber-400/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
