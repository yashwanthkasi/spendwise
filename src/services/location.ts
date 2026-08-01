// Geolocation + reverse geocoding.
//
// We use the browser Geolocation API for coordinates and BigDataCloud's free
// client-side reverse-geocoding endpoint (no API key, no env config) to turn
// them into a human-readable place label like "Indiranagar" or "Pune".
//
// Everything here is best-effort: if the user denies location, the device has
// no GPS, or the network call fails, we return null so a transaction still
// saves — just without a place.

export interface Place {
  latitude: number;
  longitude: number;
  label: string;
}

/** Minimal shape needed to render a place in the UI. */
export type PlaceLike = {
  place_label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

// Location doesn't move fast enough to re-fetch on every transaction, so we
// cache the last successful lookup for a few minutes.
const CACHE_MS = 5 * 60 * 1000;
let cached: { place: Place; at: number } | null = null;

/** In-flight lookup — dedupes concurrent getCurrentPlace() calls. */
let pending: Promise<Place | null> | null = null;

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

function getPosition(timeout = 15000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout,
      maximumAge: CACHE_MS,
    });
  });
}

interface GeocodePayload {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string; order?: number }>;
    informative?: Array<{ name?: string; order?: number }>;
  };
}

function labelFromGeocode(data: GeocodePayload): string | null {
  if (data.locality?.trim()) return data.locality.trim();
  if (data.city?.trim()) return data.city.trim();

  const admin = data.localityInfo?.administrative;
  if (Array.isArray(admin) && admin.length > 0) {
    // Most specific administrative area is usually last (highest order).
    const sorted = [...admin].sort(
      (a, b) => (b.order ?? 0) - (a.order ?? 0),
    );
    const name = sorted[0]?.name?.trim();
    if (name) return name;
  }

  if (data.principalSubdivision?.trim()) return data.principalSubdivision.trim();
  if (data.countryName?.trim()) return data.countryName.trim();
  return null;
}

function coordsFallbackLabel(lat: number, lng: number): string {
  return `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return coordsFallbackLabel(lat, lng);
    const data = (await res.json()) as GeocodePayload;
    return labelFromGeocode(data) ?? coordsFallbackLabel(lat, lng);
  } catch {
    return coordsFallbackLabel(lat, lng);
  }
}

async function fetchPlace(): Promise<Place | null> {
  try {
    const pos = await getPosition();
    const latitude = Number(pos.coords.latitude.toFixed(6));
    const longitude = Number(pos.coords.longitude.toFixed(6));
    const label = await reverseGeocode(latitude, longitude);
    const place: Place = { latitude, longitude, label };
    cached = { place, at: Date.now() };
    return place;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[location] getCurrentPlace failed', err);
    return null;
  }
}

/**
 * Best-effort current place. Never throws — resolves to null when location is
 * unavailable or permission is denied, so callers can save without a place.
 */
export async function getCurrentPlace(): Promise<Place | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.place;
  if (pending) return pending;
  pending = fetchPlace().finally(() => {
    pending = null;
  });
  return pending;
}

/** Warm the cache (e.g. right after granting permission or on Home mount). */
export function primeLocation(): void {
  void getCurrentPlace();
}

/** Human-readable place for list rows / detail sheets. */
export function displayPlace(txn: PlaceLike): string | null {
  if (txn.place_label?.trim()) return txn.place_label.trim();
  if (txn.latitude != null && txn.longitude != null) {
    return coordsFallbackLabel(Number(txn.latitude), Number(txn.longitude));
  }
  return null;
}

/** Whether this transaction has any location data worth showing. */
export function hasPlace(txn: PlaceLike): boolean {
  return displayPlace(txn) !== null;
}
