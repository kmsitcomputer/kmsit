import { db, uid, now, type User, type RoleKey, type MediaItem, type Session, type ID, type AuditLog, type Notification } from './db';
import { api } from './api';

let remoteSettings: Record<string, string> = {};
export const hydratePublicSettings = (settings: Record<string, string | null>) => {
  remoteSettings = Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value ?? '']));
};

/* ================= utils ================= */

export const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

export function uniqueSlug(table: 'courses' | 'articles' | 'news' | 'tutorials' | 'activities' | 'pages' | 'products' | 'categories', base: string, exceptId?: ID): string {
  let slug = slugify(base) || `item-${uid().slice(-5)}`;
  let i = 1;
  while (db.find(table, (r) => (r as { slug: string }).slug === slug && (r as { id: ID }).id !== exceptId)) {
    slug = `${slugify(base)}-${++i}`;
  }
  return slug;
}

export const currency = () => db.settings().currency || 'IDR';
export const fmtMoney = (n: number): string => {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency(), maximumFractionDigits: 0 }).format(n || 0);
  } catch { return `Rp${(n || 0).toLocaleString('id-ID')}`; }
};
export const fmtDate = (ts: number | string | null | undefined): string => {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: db.settings().timezone || undefined }).format(new Date(ts));
  } catch { return new Date(ts).toLocaleDateString(); }
};
export const fmtDateTime = (ts: number | null | undefined): string => {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: db.settings().timezone || undefined }).format(new Date(ts));
  } catch { return new Date(ts).toLocaleString(); }
};
export const timeAgo = (ts: number): string => {
  const d = now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const dy = Math.floor(h / 24);
  if (dy < 30) return `${dy} hari lalu`;
  return fmtDate(ts);
};

/** Parse YouTube URL → video ID (sanitized, anti-XSS). */
export const youtubeId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,20})/);
  return m ? m[1] : null;
};
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Sanitize rich HTML — buang script/event handler/iframe. */
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(attr.name);
      if ((n === 'href' || n === 'src') && attr.value.trim().toLowerCase().startsWith('javascript:')) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
};

/** FNV-1a 32-bit — signature hash untuk verifikasi webhook sandbox. */
export const fnv1a = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
};

export const maskKey = (k: string): string => (k && k.length > 8 ? `••••••••${k.slice(-4)}` : k ? '••••' : '');

export const makeSalt = (): string => Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${password}::kmsit`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const genAppKey = (): string => `base64:${Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, '0')).join('')}`;

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

/* ================= settings ================= */

export const getSetting = (key: string, fallback = ''): string => remoteSettings[key] ?? db.settings()[key] ?? fallback;
export const setSetting = (key: string, value: string) => db.setSetting(key, value);
export const setSettings = (patch: Record<string, string>) => db.setSettings(patch);
export const siteName = () => getSetting('site_name', 'KMSIT Computer');
export const siteSlogan = () => getSetting('slogan', '');
export const isMaintenance = () => getSetting('maintenance_mode') === '1';

/* ================= auth ================= */

export const currentUser = (): Promise<User | null> => api.me();

export async function login(email: string, password: string, remember: boolean): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  void remember;
  try { return { ok: true, user: await api.login(email, password) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Login gagal.' }; }
}

export async function logout(user: User | null) {
  void user;
  await api.logout();
}

export async function register(data: { name: string; email: string; password: string; role: RoleKey }): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  try { return { ok: true, user: await api.register({ ...data, role: data.role === 'instructor' ? 'instructor' : 'student' }) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Registrasi gagal.' }; }
}

export const changePassword = async (user: User, current: string, next: string): Promise<string | null> => {
  const hash = await hashPassword(current, user.salt);
  if (hash !== user.passwordHash) return 'Password saat ini salah.';
  const salt = makeSalt();
  const passwordHash = await hashPassword(next, salt);
  db.update('users', user.id, { passwordHash, salt });
  return null;
};

export const resetPasswordByAdmin = async (userId: ID, newPass: string) => {
  const salt = makeSalt();
  const passwordHash = await hashPassword(newPass, salt);
  db.update('users', userId, { passwordHash, salt });
};

/* ================= rbac ================= */

export function can(user: User | null, perm: string): boolean {
  if (!user) return false;
  const role = db.find('roles', (r) => r.key === user.roleKey);
  if (!role) return false;
  if (role.permissions.includes('*')) return true;
  return role.permissions.includes(perm);
}
export const roleLabel = (k: RoleKey) => (k === 'super_admin' ? 'Super Admin' : k === 'admin' ? 'Admin' : k === 'instructor' ? 'Instructor' : 'Student');

/* ================= audit ================= */

export function audit(userId: ID | null, userName: string, action: string, model: string, modelId: ID | null, detail: string) {
  db.insert('auditLogs', {
    userId, userName, action, model, modelId, detail,
    ip: '127.0.0.1', ua: navigator.userAgent.slice(0, 120),
  } as Omit<AuditLog, 'id' | 'createdAt' | 'updatedAt'>);
}

/* ================= notifications ================= */

export function notify(userId: ID, title: string, body: string, link = '', kind: Notification['kind'] = 'info') {
  db.insert('notifications', { userId, title, body, link, kind, read: false } as Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>);
}
export function notifyAdmins(title: string, body: string, link = '') {
  db.where('users', (u) => u.roleKey === 'super_admin' || u.roleKey === 'admin').forEach((u) => notify(u.id, title, body, link, 'warning'));
}
export const markNotifRead = (id: ID) => db.update('notifications', id, { read: true });
export const markAllNotifRead = (userId: ID) => db.where('notifications', (n) => n.userId === userId && !n.read).forEach((n) => db.update('notifications', n.id, { read: true }));

/* ================= users ================= */

export const UsersService = {
  list: () => db.all('users'),
  byId: (id: ID) => db.byId('users', id),
  async create(data: { name: string; email: string; password: string; roleKey: RoleKey; status?: User['status'] }): Promise<{ ok: boolean; error?: string; user?: User }> {
    if (db.find('users', (x) => x.email.toLowerCase() === data.email.trim().toLowerCase())) return { ok: false, error: 'Email sudah digunakan.' };
    const salt = makeSalt();
    const passwordHash = await hashPassword(data.password, salt);
    const user = db.insert('users', {
      name: data.name.trim(), email: data.email.trim().toLowerCase(), passwordHash, salt,
      roleKey: data.roleKey, status: data.status ?? 'active', avatar: null, bio: '',
      instructorApproved: data.roleKey !== 'instructor', instructorHeadline: '',
    });
    return { ok: true, user };
  },
  update(id: ID, patch: Partial<User>) { db.update('users', id, patch); },
  remove(id: ID, actor: User) {
    const u = db.byId('users', id);
    if (!u || u.id === actor.id) return;
    db.remove('users', id);
    db.where('sessions', (s) => s.userId === id).forEach((s) => db.remove('sessions', s.id));
    db.where('enrollments', (e) => e.userId === id).forEach((e) => db.remove('enrollments', e.id));
    db.where('cartItems', (c) => c.userId === id).forEach((c) => db.remove('cartItems', c.id));
    audit(actor.id, actor.name, 'delete', 'user', id, `Menghapus user ${u.name}`);
  },
};

/* ================= media ================= */

export const MediaService = {
  add(file: File, uploadedBy: ID | null): Promise<MediaItem | { error: string }> {
    return new Promise((resolve) => {
      const okTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf'];
      if (!okTypes.includes(file.type)) return resolve({ error: 'Tipe file tidak diizinkan. Gunakan gambar atau PDF.' });
      if (file.size > 1.8 * 1024 * 1024) return resolve({ error: 'Ukuran maksimal 1.8 MB.' });
      const reader = new FileReader();
      reader.onload = () => {
        const item = db.insert('media', {
          name: file.name.replace(/[^\w.\- ]+/g, '_'), mime: file.type, size: file.size,
          url: String(reader.result), uploadedBy,
        });
        resolve(item);
      };
      reader.onerror = () => resolve({ error: 'Gagal membaca file.' });
      reader.readAsDataURL(file);
    });
  },
  remove(id: ID) { db.remove('media', id); },
};

/* ================= global search ================= */

export function globalSearch(q: string) {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  const has = (v: string | undefined | null) => !!v && v.toLowerCase().includes(s);
  const out: Array<{ group: string; label: string; to: string }> = [];
  db.where('courses', (c) => c.status === 'published' && (has(c.title) || has(c.shortDescription))).slice(0, 4)
    .forEach((c) => out.push({ group: 'Kelas', label: c.title, to: `/courses/${c.slug}` }));
  db.where('articles', (a) => a.status === 'published' && has(a.title)).slice(0, 3)
    .forEach((a) => out.push({ group: 'Artikel', label: a.title, to: `/articles/${a.slug}` }));
  db.where('news', (n) => n.status === 'published' && has(n.title)).slice(0, 3)
    .forEach((n) => out.push({ group: 'Berita', label: n.title, to: `/news/${n.slug}` }));
  db.where('tutorials', (t) => t.status === 'published' && has(t.title)).slice(0, 3)
    .forEach((t) => out.push({ group: 'Tutorial', label: t.title, to: `/tutorials/${t.slug}` }));
  db.where('products', (p) => p.status === 'published' && has(p.name)).slice(0, 3)
    .forEach((p) => out.push({ group: 'Produk', label: p.name, to: `/shop` }));
  db.where('users', (u) => has(u.name) || has(u.email)).slice(0, 3)
    .forEach((u) => out.push({ group: 'Pengguna', label: `${u.name} (${roleLabel(u.roleKey)})`, to: '/dashboard/users' }));
  return out.slice(0, 10);
}

/* ================= backup ================= */

export async function exportBackup() {
  const data = { app: 'kmsit-computer', exportedAt: new Date().toISOString(), tables: db.all('courses') ? snapshot() : null };
  downloadFile(`kmsit-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
  const actor = await currentUser();
  audit(actor?.id ?? null, actor?.name ?? 'system', 'backup', 'system', null, 'Ekspor backup database');
}
function snapshot() {
  const tables = ['users', 'roles', 'categories', 'courses', 'sections', 'lessons', 'enrollments', 'lessonProgress', 'quizzes', 'questions', 'quizAttempts', 'certificateTemplates', 'certificates', 'articles', 'news', 'tutorials', 'activities', 'pages', 'homepageBlocks', 'menus', 'menuItems', 'orders', 'payments', 'walletTx', 'withdrawals', 'products', 'notifications', 'auditLogs'] as const;
  const out: Record<string, unknown> = { settings: db.settings() };
  tables.forEach((t) => { out[t] = (db.all(t as never) as unknown[]).map((r) => ({ ...(r as object) })).map((r) => { if ('passwordHash' in (r as object)) delete (r as { passwordHash?: string }).passwordHash; if ('salt' in (r as object)) delete (r as { salt?: string }).salt; return r; }); });
  return out;
}

/* ================= contact ================= */

export function sendContactMessage(data: { name: string; email: string; subject: string; body: string }) {
  db.insert('contactMessages', { ...data, read: false });
  notifyAdmins('Pesan kontak baru', `${data.name}: ${data.subject}`, '/dashboard/messages');
}
