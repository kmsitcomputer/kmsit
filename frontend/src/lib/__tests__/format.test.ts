import { describe, expect, it } from 'vitest';
import {
  coursePrice,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  maskKey,
  roleLabel,
  safeHref,
  slugify,
  youtubeId,
} from '../format';

describe('format helpers', () => {
  it('formats IDR money without relying on exact locale spacing', () => {
    const formatted = fmtMoney(1_250_000);

    expect(formatted).toMatch(/Rp/i);
    expect(formatted.replace(/\D/g, '')).toBe('1250000');
    expect(fmtMoney(Number.NaN).replace(/\D/g, '')).toBe('0');
  });

  it('formats valid dates and returns a placeholder for missing dates', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('not-a-date')).toBe('—');
    expect(fmtDate('2026-09-27T00:00:00.000Z')).toContain('2026');
    expect(fmtDateTime('2026-09-27T00:00:00.000Z')).toContain('2026');
  });

  it('normalizes slugs and safe links', () => {
    expect(slugify('  Kelas React: Dasar & Lanjut  ')).toBe('kelas-react-dasar-lanjut');
    expect(safeHref('https://kms.test/course')).toBe('https://kms.test/course');
    expect(safeHref('/dashboard')).toBe('/dashboard');
    expect(safeHref('//evil.test')).toBeUndefined();
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
  });

  it('extracts supported YouTube ids and rejects unrelated URLs', () => {
    expect(youtubeId('https://youtu.be/abcDEF12345')).toBe('abcDEF12345');
    expect(youtubeId('https://example.test/video')).toBeNull();
  });

  it('keeps display-only helpers deterministic', () => {
    expect(maskKey('abcdefghijkl')).toBe('••••••••ijkl');
    expect(roleLabel('super_admin')).toBe('Super Admin');
    expect(coursePrice({ isFree: true, price: 100_000, discountPrice: 50_000 })).toBe(0);
    expect(coursePrice({ isFree: false, price: 100_000, discountPrice: 75_000 })).toBe(75_000);
    expect(coursePrice({ isFree: false, price: 100_000, discountPrice: 150_000 })).toBe(100_000);
  });
});
