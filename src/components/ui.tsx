import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { db, type Row, type ID } from '../lib/db';
import { MediaService, sanitizeHtml, youtubeId } from '../lib/services';
import { useApp } from '../state/store';
import { Icon, type IconName } from './icons';

/* ================= modal ================= */

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-base-950/60 backdrop-blur-[3px] anim-fade" onClick={onClose} />
      <div className={`relative card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} anim-scale my-auto`}>
        <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-5 py-4">
          <h3 className="font-display text-base font-bold text-base-900 dark:text-base-50">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-base-500 hover:bg-base-100 hover:text-base-900 dark:hover:bg-base-800 dark:hover:text-base-100 transition-colors cursor-pointer" aria-label="Tutup">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-base-200 dark:border-base-800 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, message, dangerLabel }: {
  open: boolean; onClose: () => void; onConfirm: () => void; message: string; dangerLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Konfirmasi" footer={
      <>
        <button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-danger" onClick={() => { onConfirm(); onClose(); }}>
          <Icon name="trash" size={14} /> {dangerLabel ?? 'Ya, Hapus'}
        </button>
      </>
    }>
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-500/12 text-danger-500"><Icon name="alert-triangle" size={18} /></span>
        <p className="text-sm text-base-600 dark:text-base-300">{message}</p>
      </div>
    </Modal>
  );
}

/* ================= form ================= */

export function Field({ label, error, required, hint, children }: {
  label: string; error?: string; required?: boolean; hint?: string; children: ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-danger-500 ml-0.5">*</span>}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-base-400">{hint}</p>}
      {error && <p className="mt-1 text-[11px] font-semibold text-danger-500 flex items-center gap-1"><Icon name="alert-circle" size={11} />{error}</p>}
    </div>
  );
}

export function TextInput({ error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input {...rest} className={`input ${error ? 'input-error' : ''} ${rest.className ?? ''}`} />;
}
export function TextArea({ error, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea {...rest} className={`textarea ${error ? 'input-error' : ''} ${rest.className ?? ''}`} />;
}
export function Select({ children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={`select ${rest.className ?? ''}`}>{children}</select>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5 cursor-pointer group" role="switch" aria-checked={checked}>
      <span className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? 'bg-brand-500' : 'bg-base-300 dark:bg-base-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-sm text-base-700 dark:text-base-300 group-hover:text-base-900 dark:group-hover:text-base-100">{label}</span>}
    </button>
  );
}

/* ================= badges & status ================= */

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'brand' | 'neutral' | 'accent';
const toneCls: Record<Tone, string> = {
  ok: 'bg-ok-500/12 text-ok-500 dark:text-ok-400',
  warn: 'bg-warn-400/14 text-accent-500 dark:text-warn-400',
  danger: 'bg-danger-500/12 text-danger-500 dark:text-danger-400',
  info: 'bg-info-400/12 text-info-400',
  brand: 'bg-brand-500/12 text-brand-600 dark:text-brand-400',
  accent: 'bg-accent-400/14 text-accent-500',
  neutral: 'bg-base-500/12 text-base-500 dark:text-base-400',
};
export function Badge({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge ${toneCls[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" style={{ animation: 'pulseDot 2s infinite' }} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    published: { tone: 'ok', label: 'Terbit' }, draft: { tone: 'neutral', label: 'Draft' },
    pending: { tone: 'warn', label: 'Pending Review' }, rejected: { tone: 'danger', label: 'Ditolak' },
    archived: { tone: 'neutral', label: 'Arsip' }, paid: { tone: 'ok', label: 'Lunas' },
    failed: { tone: 'danger', label: 'Gagal' }, expired: { tone: 'neutral', label: 'Kadaluarsa' },
    approved: { tone: 'info', label: 'Disetujui' }, processing: { tone: 'info', label: 'Diproses' },
    completed: { tone: 'ok', label: 'Selesai' }, issued: { tone: 'ok', label: 'Aktif' },
    revoked: { tone: 'danger', label: 'Dicabut' }, active: { tone: 'ok', label: 'Aktif' },
    suspended: { tone: 'danger', label: 'Ditangguhkan' }, in_progress: { tone: 'warn', label: 'Berlangsung' },
    submitted: { tone: 'info', label: 'Terkirim' }, free: { tone: 'brand', label: 'Gratis' },
  };
  const m = map[status] ?? { tone: 'neutral' as Tone, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/* ================= empty / stat / avatar ================= */

export function EmptyState({ icon = 'layers', title, sub, action }: { icon?: IconName; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-base-300 dark:border-base-700 px-6 py-14 text-center anim-rise">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500"><Icon name={icon} size={26} /></span>
      <p className="font-display text-base font-bold text-base-800 dark:text-base-100">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-sm text-base-500 dark:text-base-400">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({ icon, label, value, sub, tone = 'brand', delay = 0 }: {
  icon: IconName; label: string; value: ReactNode; sub?: string; tone?: Tone; delay?: number;
}) {
  return (
    <div className="card card-hover p-4 anim-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-base-400 font-mono">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-base-900 dark:text-base-50 tabular-nums">{value}</p>
          {sub && <p className="mt-1 text-xs text-base-400">{sub}</p>}
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneCls[tone]}`}><Icon name={icon} size={19} /></span>
      </div>
    </div>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  if (src && !err) return <img src={src} onError={() => setErr(true)} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />;
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display font-bold text-base-950">
      {initials}
    </span>
  );
}

export function SafeImg({ src, alt, className, label }: { src?: string | null; alt: string; className?: string; label?: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-base-800 via-base-850 to-base-900 text-brand-400/70 ${className ?? ''}`}>
        <span className="font-display text-lg font-bold tracking-wide">{label ?? alt.slice(0, 2).toUpperCase()}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setErr(true)} className={className} loading="lazy" />;
}

/* ================= content render ================= */

export function RichHTML({ html, className }: { html: string; className?: string }) {
  return <div className={`prose-cms max-w-none text-base-700 dark:text-base-300 ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

export function YouTube({ url, className, title = 'Video' }: { url: string; className?: string; title?: string }) {
  const id = youtubeId(url);
  if (!id) return null;
  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-base-950 ${className ?? ''}`} style={{ aspectRatio: '16 / 9' }}>
      <iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" />
    </div>
  );
}

/* ================= scroll reveal ================= */

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${inView ? 'is-in' : ''} ${className ?? ''}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* ================= data table ================= */

export interface Column<T> { key: string; label: string; render?: (row: T) => ReactNode; className?: string; }

export function DataTable<T extends Row>({ rows, columns, searchKeys, pageSize = 9, rowActions, onRowClick, emptyTitle = 'Belum ada data', emptySub, emptyAction, toolbar }: {
  rows: T[]; columns: Column<T>[]; searchKeys?: (row: T) => string; pageSize?: number;
  rowActions?: (row: T) => ReactNode; onRowClick?: (row: T) => void;
  emptyTitle?: string; emptySub?: string; emptyAction?: ReactNode; toolbar?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const filtered = q.trim() && searchKeys
    ? rows.filter((r) => searchKeys(r).toLowerCase().includes(q.trim().toLowerCase()))
    : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { setPage(1); }, [q, rows.length]);

  if (rows.length === 0) return <EmptyState title={emptyTitle} sub={emptySub} action={emptyAction} />;

  return (
    <div className="card overflow-hidden anim-rise">
      <div className="flex flex-wrap items-center gap-2 border-b border-base-200 dark:border-base-800 px-4 py-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari…" className="input pl-9 py-2 text-sm" />
        </div>
        <div className="ml-auto flex items-center gap-2">{toolbar}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="bg-base-100/60 dark:bg-base-850">
            <tr>{columns.map((c) => <th key={c.key} className={`th ${c.className ?? ''}`}>{c.label}</th>)}{rowActions && <th className="th text-right">Aksi</th>}</tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`transition-colors hover:bg-brand-500/[0.04] dark:hover:bg-brand-500/[0.05] ${onRowClick ? 'cursor-pointer' : ''}`}>
                {columns.map((c) => <td key={c.key} className={`td ${c.className ?? ''}`}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '—')}</td>)}
                {rowActions && <td className="td text-right"><div className="flex items-center justify-end gap-1">{rowActions(r)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-base-200 dark:border-base-800 px-4 py-2.5 text-xs text-base-500">
          <span className="font-mono">{filtered.length} entri · hal {safePage}/{pages}</span>
          <div className="flex gap-1">
            <button className="btn-ghost btn-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><Icon name="chevron-left" size={14} /></button>
            <button className="btn-ghost btn-sm" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}><Icon name="chevron-right" size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IconButton({ icon, onClick, title, tone = 'neutral' }: { icon: IconName; onClick: (e: React.MouseEvent) => void; title: string; tone?: 'neutral' | 'danger' | 'brand' }) {
  const cls = tone === 'danger' ? 'hover:bg-danger-500/12 hover:text-danger-500' : tone === 'brand' ? 'hover:bg-brand-500/12 hover:text-brand-600 dark:hover:text-brand-400' : 'hover:bg-base-200/70 dark:hover:bg-base-800 hover:text-base-900 dark:hover:text-base-100';
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className={`rounded-md p-1.5 text-base-400 transition-colors cursor-pointer ${cls}`}>
      <Icon name={icon} size={15} />
    </button>
  );
}

/* ================= charts (hand-rolled SVG) ================= */

export function BarChart({ data, height = 140, color = 'var(--color-brand-400)' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="group relative flex flex-1 flex-col items-center justify-end h-full">
          <div className="absolute -top-7 hidden group-hover:block rounded-md bg-base-900 dark:bg-base-800 px-2 py-0.5 text-[10px] font-mono text-base-100 shadow whitespace-nowrap z-10">{d.value}</div>
          <div className="w-full rounded-t-md anim-bar transition-all group-hover:opacity-80" style={{ height: `${Math.max(3, (d.value / max) * 100)}%`, background: color, animationDelay: `${i * 40}ms`, opacity: d.value === 0 ? 0.25 : 1 }} />
          <span className="mt-1.5 text-[9px] font-mono text-base-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ pct, size = 92, label, color = 'var(--color-brand-400)' }: { pct: number; size?: number; label?: string; color?: string }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-base-200 dark:text-base-800" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (Math.min(100, pct) / 100) * c} style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <span className="absolute font-display text-lg font-bold text-base-900 dark:text-base-50 tabular-nums">{label ?? `${pct}%`}</span>
    </div>
  );
}

/* ================= tabs / page header / toasts ================= */

export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-base-200 dark:border-base-800 bg-base-100/60 dark:bg-base-850 p-1 gap-1">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${active === t.key ? 'bg-white dark:bg-base-800 text-base-900 dark:text-base-50 shadow-sm' : 'text-base-500 hover:text-base-800 dark:hover:text-base-200'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 anim-rise">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-base-900 dark:text-base-50">{title}</h1>
        {sub && <p className="mt-1 text-sm text-base-500 dark:text-base-400">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ToastHost() {
  const { toasts, dismissToast } = useApp();
  const icon: Record<string, IconName> = { success: 'check-circle', error: 'alert-circle', info: 'info', warning: 'alert-triangle' };
  const tone: Record<string, string> = {
    success: 'border-ok-500/40 text-ok-500', error: 'border-danger-500/40 text-danger-500',
    info: 'border-info-400/40 text-info-400', warning: 'border-warn-400/40 text-warn-400',
  };
  return (
    <div className="fixed bottom-4 right-4 z-[120] flex flex-col gap-2 w-[min(92vw,360px)]">
      {toasts.map((t) => (
        <div key={t.id} className={`card anim-slide flex items-start gap-2.5 border-l-4 px-4 py-3 ${tone[t.kind]}`}>
          <Icon name={icon[t.kind]} size={17} className="mt-0.5 shrink-0" />
          <p className="flex-1 text-sm font-semibold text-base-800 dark:text-base-100">{t.msg}</p>
          <button onClick={() => dismissToast(t.id)} className="text-base-400 hover:text-base-700 dark:hover:text-base-200 cursor-pointer"><Icon name="x" size={13} /></button>
        </div>
      ))}
    </div>
  );
}

/* ================= media picker ================= */

export function MediaPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  const { user, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const items = db.all('media').slice().reverse();

  const upload = async (f: File) => {
    setBusy(true);
    const res = await MediaService.add(f, user?.id ?? null);
    setBusy(false);
    if ('error' in res) toast('error', res.error);
    else { toast('success', 'Media terunggah.'); onPick(res.url); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Media Library" wide>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-base-400 font-mono">{items.length} file</p>
        <button className="btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="upload" size={13} /> {busy ? 'Mengunggah…' : 'Unggah File'}
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="image" title="Belum ada media" sub="Unggah gambar atau PDF pertamamu." />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {items.map((m) => (
            <button key={m.id} onClick={() => { onPick(m.url); onClose(); }}
              className="group relative aspect-square overflow-hidden rounded-lg border border-base-200 dark:border-base-700 cursor-pointer transition-all hover:border-brand-500 hover:shadow-lg">
              {m.mime.startsWith('image/') ? (
                <img src={m.url} alt={m.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <span className="flex h-full items-center justify-center bg-base-100 dark:bg-base-850 text-base-400"><Icon name="file" size={22} /></span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-base-950/75 px-1.5 py-1 text-[9px] font-mono text-base-100 opacity-0 transition-opacity group-hover:opacity-100">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ================= misc ================= */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-base-300 dark:border-base-700 bg-base-100 dark:bg-base-850 px-1.5 py-0.5 font-mono text-[10px] text-base-500">{children}</kbd>;
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { toast } = useApp();
  return (
    <button className="btn-outline btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); toast('success', 'Disalin ke clipboard.'); }
      catch { toast('error', 'Gagal menyalin.'); }
    }}>
      <Icon name="copy" size={12} /> {label ?? 'Salin'}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
