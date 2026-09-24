/**
 * Public site settings, held in memory only and always hydrated from
 * `GET /api/v1/settings/public`. A browser refresh re-reads the server — nothing is persisted.
 */
let remote: Record<string, string> = {};
const listeners = new Set<() => void>();
let version = 0;

export function hydratePublicSettings(settings: Record<string, string | null>) {
  remote = Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value ?? '']));
  bump();
}

/** Reflects a successful server write (the server stays the source of truth). */
export function patchRemoteSettings(patch: Record<string, string>) {
  remote = { ...remote, ...patch };
  bump();
}

export const getSetting = (key: string, fallback = ''): string => {
  const value = remote[key];
  return value === undefined || value === '' ? fallback : value;
};

export const settingsVersion = () => version;
export function subscribeSettings(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

function bump() { version++; listeners.forEach((fn) => fn()); }
