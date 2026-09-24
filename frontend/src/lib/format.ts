/* Pure presentation helpers (no business state). */
import type { RoleKey } from './types';
import { getSetting } from './settings';

export const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

const toTime = (ts: number | string | null | undefined): number | null => {
  if (ts === null || ts === undefined || ts === '') return null;
  const n = typeof ts === 'number' ? ts : Date.parse(ts);
  return Number.isNaN(n) ? null : n;
};

export const fmtMoney = (n: number): string => {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: getSetting('currency', 'IDR'), maximumFractionDigits: 0 }).format(n || 0);
  } catch { return `Rp${(n || 0).toLocaleString('id-ID')}`; }
};

export const fmtDate = (ts: number | string | null | undefined): string => {
  const t = toTime(ts);
  if (!t) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: getSetting('timezone') || undefined }).format(new Date(t));
  } catch { return new Date(t).toLocaleDateString(); }
};

export const fmtDateTime = (ts: number | string | null | undefined): string => {
  const t = toTime(ts);
  if (!t) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: getSetting('timezone') || undefined }).format(new Date(t));
  } catch { return new Date(t).toLocaleString(); }
};

export const timeAgo = (ts: number | string | null | undefined): string => {
  const t = toTime(ts);
  if (!t) return '—';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  return fmtDate(t);
};

/** Parse YouTube URL → video ID (sanitized, anti-XSS). */
export const youtubeId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,20})/);
  return m ? m[1] : null;
};
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Defence in depth: the server already sanitizes rich HTML. */
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(attr.name);
      if ((n === 'href' || n === 'src') && !/^(https?:|mailto:|tel:|\/|#)/i.test(attr.value.trim())) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
};

/** Only http(s) or app-relative links may become an href. */
export const safeHref = (url: string | null | undefined): string | undefined => {
  const v = (url ?? '').trim();
  return /^(https?:\/\/|\/(?!\/)|mailto:|tel:)/i.test(v) ? v : undefined;
};

export const maskKey = (k: string): string => (k && k.length > 8 ? `••••••••${k.slice(-4)}` : k ? '••••' : '');

export function downloadFile(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export const roleLabel = (k: RoleKey | string) => (k === 'super_admin' ? 'Super Admin' : k === 'admin' ? 'Admin' : k === 'instructor' ? 'Instructor' : 'Student');

/** Client-only key for unsaved form rows (never persisted as business data). */
export const tempId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** Display price of a course; mirrors OrderController::storeCourse (the server stays authoritative). */
export const coursePrice = (c: { isFree: boolean; price: number; discountPrice: number }): number =>
  c.isFree ? 0 : c.discountPrice > 0 && c.discountPrice < c.price ? c.discountPrice : c.price;
