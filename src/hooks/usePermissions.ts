import { useCallback, useEffect, useRef, useState } from 'react';
import { isGeolocationSupported, primeLocation } from '@/services/location';

export type PermState =
  | 'unknown'
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unsupported';

function micSupported(): boolean {
  return (
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  );
}

async function queryPermission(
  name: PermissionName,
): Promise<PermState | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return null;
    }
    const status = await navigator.permissions.query({ name });
    return status.state as PermState;
  } catch {
    return null;
  }
}

/**
 * Requests and tracks the two permissions SpendWise cares about: location
 * (to tag transactions with a place) and microphone (for voice entry).
 *
 * Auto-prompts once on mount for anything not already granted. Also exposes a
 * manual `request()` so a banner can re-trigger the prompt from a user gesture
 * (needed by some browsers for the mic).
 */
export function usePermissions() {
  const [location, setLocation] = useState<PermState>(
    isGeolocationSupported() ? 'unknown' : 'unsupported',
  );
  const [microphone, setMicrophone] = useState<PermState>(
    micSupported() ? 'unknown' : 'unsupported',
  );
  const bootstrapped = useRef(false);

  const requestLocation = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (!isGeolocationSupported()) {
        setLocation('unsupported');
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocation('granted');
          primeLocation(); // warm the reverse-geocode cache
          resolve();
        },
        (err) => {
          setLocation(
            err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt',
          );
          resolve();
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
      );
    });
  }, []);

  const requestMic = useCallback(async () => {
    if (!micSupported()) {
      setMicrophone('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only wanted the grant — release the mic immediately.
      stream.getTracks().forEach((t) => t.stop());
      setMicrophone('granted');
    } catch {
      setMicrophone('denied');
    }
  }, []);

  const request = useCallback(async () => {
    await Promise.all([requestLocation(), requestMic()]);
  }, [requestLocation, requestMic]);

  // One-time bootstrap: read current states, then prompt for whatever isn't
  // already granted.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let cancelled = false;

    (async () => {
      const [loc, mic] = await Promise.all([
        queryPermission('geolocation' as PermissionName),
        queryPermission('microphone' as PermissionName),
      ]);
      if (cancelled) return;
      if (loc) setLocation(loc);
      if (mic) setMicrophone(mic);

      if (loc !== 'granted') void requestLocation();
      if (mic !== 'granted') void requestMic();
    })();

    return () => {
      cancelled = true;
    };
  }, [requestLocation, requestMic]);

  return { location, microphone, request, requestLocation, requestMic };
}
