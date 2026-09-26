import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSetting,
  hydratePublicSettings,
  patchRemoteSettings,
  settingsVersion,
  subscribeSettings,
} from '../settings';

describe('public settings state', () => {
  beforeEach(() => {
    hydratePublicSettings({});
  });

  it('hydrates values and applies fallbacks to empty or missing settings', () => {
    hydratePublicSettings({ site_name: 'KMSIT', tagline: null, currency: 'IDR' });

    expect(getSetting('site_name')).toBe('KMSIT');
    expect(getSetting('tagline', 'Belajar bersama')).toBe('Belajar bersama');
    expect(getSetting('missing', 'fallback')).toBe('fallback');
  });

  it('patches only the supplied remote values', () => {
    hydratePublicSettings({ site_name: 'KMSIT', currency: 'IDR' });
    patchRemoteSettings({ site_name: 'KMSIT Academy' });

    expect(getSetting('site_name')).toBe('KMSIT Academy');
    expect(getSetting('currency')).toBe('IDR');
  });

  it('increments the version for hydration and patches', () => {
    const before = settingsVersion();

    hydratePublicSettings({ site_name: 'KMSIT' });
    expect(settingsVersion()).toBe(before + 1);

    patchRemoteSettings({ site_name: 'KMSIT Academy' });
    expect(settingsVersion()).toBe(before + 2);
  });

  it('notifies active subscribers and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSettings(listener);

    patchRemoteSettings({ timezone: 'Asia/Jakarta' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    patchRemoteSettings({ timezone: 'UTC' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
