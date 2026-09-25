import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Course, HomeBlock, Product, ID } from '../../lib/types';
import { coursePrice, fmtMoney, fmtDate, timeAgo, youtubeId } from '../../lib/format';
import { getSetting } from '../../lib/settings';
import { useApp } from '../../state/store';
import { CART_CHANGED_EVENT } from '../../components/Shell';
import { Pager, RemoteView, useRemote } from '../../components/remote';

/** Lowest price a product can be bought for (display only; the server prices the cart). */
const productMinPrice = (p: Product): number => {
  if (p.variants && p.variants.length > 0) return Math.min(...p.variants.map((v) => v.price));
  return p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price;
};
import { api, type ApiCart, type CourseWithMeta } from '../../lib/api';
import { Icon, iconTone, iconToneBg, type IconName } from '../../components/icons';
import { Avatar, Badge, EmptyState, Reveal, RichHTML, SafeImg, Select, YouTube } from '../../components/ui';
import { PublicShell } from '../../components/Shell';

/* ================= course card ================= */

export function CourseCard({ course, delay = 0, progressPct }: { course: Course; delay?: number; progressPct?: number }) {
  const { categoryName: lookupCategory } = useApp();
  const price = coursePrice(course);
  const meta = course as CourseWithMeta;
  const instructorName = meta.instructorName;
  const categoryName = meta.categoryName ?? (lookupCategory(course.categoryId) || 'Umum');
  return (
    <Link to={`/courses/${course.slug}`} className="card card-hover group overflow-hidden block anim-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative overflow-hidden">
        <SafeImg src={course.thumbnail} alt={course.title} label={course.title} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {course.isFree ? <Badge tone="brand">Gratis</Badge> : course.featured ? <Badge tone="accent"><Icon name="star" size={10} /> Unggulan</Badge> : null}
        </div>
        {progressPct !== undefined && (
          <div className="absolute inset-x-0 bottom-0 bg-base-950/80 px-3 py-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-700"><div className="h-full rounded-full bg-brand-400 transition-all duration-500" style={{ width: `${progressPct}%` }} /></div>
              <span className="font-mono text-[10px] font-bold text-brand-300">{progressPct}%</span>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-base-400">
          <span>{categoryName}</span><span>·</span><span>{course.level}</span>
        </div>
        <h3 className="mt-1.5 font-display text-[15px] font-bold leading-snug text-base-900 dark:text-base-50 line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{course.title}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-base-500 dark:text-base-400">
          <Avatar name={instructorName ?? '?'} size={18} /> {instructorName ?? '—'}
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-base-100 dark:border-base-800 pt-3">
          <span className="flex items-center gap-3 font-mono text-[10px] text-base-400">
            <span className="flex items-center gap-1"><Icon name="users" size={11} />{meta.enrollmentsCount ?? 0}</span>
          </span>
          <span className={`font-display text-sm font-bold ${course.isFree ? 'text-brand-600 dark:text-brand-400' : 'text-base-900 dark:text-base-50'}`}>
            {course.isFree ? 'Gratis' : fmtMoney(price)}
            {!course.isFree && course.discountPrice > 0 && course.discountPrice < course.price && (
              <span className="ml-1.5 text-[10px] font-normal text-base-400 line-through">{fmtMoney(course.price)}</span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SectionHead({ title, sub, to }: { title: string; sub?: string; to?: string }) {
  const { t } = useApp();
  return (
    <Reveal>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-base-900 dark:text-base-50">{title}</h2>
          {sub && <p className="mt-1 text-sm text-base-500 dark:text-base-400">{sub}</p>}
        </div>
        {to && <Link to={to} className="btn-outline btn-sm shrink-0">{t('see_all')} <Icon name="arrow-right" size={13} /></Link>}
      </div>
    </Reveal>
  );
}

/* ================= homepage block renderer ================= */

function HeroBlock({ block }: { block: HomeBlock }) {
  const { user } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [courseCount, setCourseCount] = useState<number | null>(null);
  useEffect(() => { void api.coursePage({ per_page: 1 }).then((page) => setCourseCount(page.total)).catch(() => setCourseCount(0)); }, []);
  // Only "Kelas Aktif" is derivable from the public courses endpoint — total students / certificates
  // have no public read endpoint yet, so they're omitted here rather than faked.
  const stats = courseCount === null ? [] : [{ label: 'Kelas Aktif', value: courseCount }];
  return (
    <section className="surface-hero relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="absolute top-20 right-0 h-72 w-72 rounded-full bg-accent-400/[0.08] blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-20 items-center">
        <div className="anim-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" style={{ animation: 'pulseDot 2s infinite' }} />
            LMS · CMS · Sertifikat Digital
          </p>
          <h1 className="mt-5 font-display text-3xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-base-900 dark:text-base-50">
            {(block.settings.heading || 'Kuasai Skill Komputer').split('\n').map((line, i) => (
              <span key={i} className="block">{i === 1 ? <span className="surface-hero-accent">{line}</span> : line}</span>
            ))}
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-base-500 dark:text-base-400">{block.settings.sub}</p>
          <form className="mt-6 flex max-w-lg items-center gap-2" onSubmit={(e) => { e.preventDefault(); nav(`/courses${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}>
            <div className="relative flex-1">
              <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={block.settings.search_placeholder || 'Cari kelas…'} className="input pl-10 py-3 shadow-sm" />
            </div>
            <button className="btn-primary py-3 px-5">Cari</button>
          </form>
          <div className="mt-7 flex flex-wrap gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-display text-2xl font-bold text-base-900 dark:text-base-50 tabular-nums">{s.value}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-base-400">{s.label}</p>
              </div>
            ))}
          </div>
          {!user && (
            <div className="mt-7 flex gap-3">
              <Link to="/register" className="btn-primary">Daftar Gratis</Link>
              <Link to="/courses" className="btn-outline">Jelajahi Kelas</Link>
            </div>
          )}
        </div>
        <div className="anim-rise hidden lg:block" style={{ animationDelay: '120ms' }}>
          <div className="overflow-hidden rounded-2xl border border-base-200 dark:border-base-800 bg-white/80 dark:bg-base-900/80 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2 border-b border-base-200 dark:border-base-800 bg-base-100/70 dark:bg-base-925 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-danger-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-warn-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-ok-400/80" />
              <span className="ml-2 font-mono text-[11px] text-base-400">kmsit-terminal</span>
            </div>
            <div className="p-5 font-mono text-[12.5px] leading-7">
              <p className="text-base-400">$ kmsit enroll --course "web-development"</p>
              <p className="text-ok-500 dark:text-ok-400">✓ enrollment created · akses materi dibuka</p>
              <p className="text-base-400">$ kmsit quiz submit --score 92</p>
              <p className="text-ok-500 dark:text-ok-400">✓ lulus · passing score 75</p>
              <p className="text-base-400">$ kmsit certificate issue</p>
              <p className="text-brand-500">✓ KMSIT-{new Date().getFullYear()}-482913 · QR terverifikasi</p>
              <p className="text-base-400">$ <span className="anim-blink text-brand-500">▊</span></p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(['code', 'award', 'chart'] as IconName[]).map((ic, i) => (
              <div key={ic} className="card card-hover flex items-center justify-center gap-2 px-3 py-3 text-xs font-bold text-base-600 dark:text-base-300 anim-rise" style={{ animationDelay: `${200 + i * 90}ms` }}>
                <Icon name={ic} size={15} className={iconTone(ic)} /> {['Materi Interaktif', 'Sertifikat QR', 'Progress Tracking'][i]}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MapBlock({ block }: { block: HomeBlock }) {
  const lat = getSetting('map_lat'), lng = getSetting('map_lng');
  const q = getSetting('map_query') || `${lat},${lng}`;
  const apiKey = getSetting('google_maps_api_key');
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed${apiKey ? `&key=${apiKey}` : ''}`;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <SectionHead title={block.settings.title || 'Lokasi Kami'} sub={getSetting('address')} />
      <Reveal>
        <div className="overflow-hidden rounded-xl border border-base-200 dark:border-base-800">
          <iframe title="Peta lokasi" src={src} className="h-80 w-full" loading="lazy" />
        </div>
      </Reveal>
    </section>
  );
}

function StatsBlock() {
  const { categories } = useApp();
  const [courseTotal, setCourseTotal] = useState<number | null>(null);
  useEffect(() => { void api.coursePage({ per_page: 1 }).then((page) => setCourseTotal(page.total)).catch(() => setCourseTotal(0)); }, []);
  if (courseTotal === null) return null;
  // Only numbers the public API can state exactly are shown (no client-side estimates).
  const items: Array<{ icon: IconName; label: string; value: number }> = [
    { icon: 'book', label: 'Kelas Terbit', value: courseTotal },
    { icon: 'tag', label: 'Kategori Kelas', value: categories.filter((c) => c.scope === 'course').length },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.label} delay={i * 70}>
            <div className="card card-hover flex items-center gap-3.5 p-4">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconToneBg(it.icon)} ${iconTone(it.icon)}`}><Icon name={it.icon} size={20} /></span>
              <div>
                <p className="font-display text-xl font-bold text-base-900 dark:text-base-50 tabular-nums">{it.value}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-base-400">{it.label}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CoursesBlock({ block }: { block: HomeBlock }) {
  const s = block.settings;
  const [courses, setCourses] = useState<Course[] | null>(null);
  useEffect(() => {
    const query = block.type === 'featured_courses' ? { featured: true } : block.type === 'free_courses' ? { type: 'free' } : { sort: 'latest' };
    void api.courses({ per_page: 6, ...query }).then(setCourses).catch(() => setCourses([]));
  }, [block.type]);
  if (courses === null) return null;
  const list = courses;
  if (list.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHead title={s.title || 'Kelas'} sub={s.sub} to="/courses" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, 6).map((c, i) => <CourseCard key={c.id} course={c} delay={i * 60} />)}
      </div>
    </section>
  );
}

function CategoriesBlock({ block }: { block: HomeBlock }) {
  const s = block.settings;
  const { categories } = useApp();
  const cats = categories.filter((c) => c.scope === 'course');
  if (cats.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHead title={s.title || 'Kategori'} to="/courses" />
      <div className="flex flex-wrap gap-2.5">
        {cats.map((c, i) => (
          <Reveal key={c.id} delay={i * 40}>
            <Link to={`/courses?cat=${c.id}`} className="card card-hover flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-base-700 dark:text-base-200">
              <Icon name="tag" size={14} className="text-brand-500" />{c.name}
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// No public endpoint currently returns an instructor list (or embeds instructor name on course
// records reachable from the frontend's api.courses() typing) — gracefully hidden rather than
// showing broken/empty cards. A dedicated public instructors endpoint would unlock this section.
function InstructorsBlock() { return null; }

function ContentSectionBlock({ block }: { block: HomeBlock }) {
  const s = block.settings;
  const table = block.type as 'articles' | 'news' | 'tutorials' | 'activities';
  const [rows, setRows] = useState<import('../../lib/api').ApiContentRow[] | null>(null);
  useEffect(() => { void api.content(table).then((items) => setRows(items as import('../../lib/api').ApiContentRow[])).catch(() => setRows([])); }, [table]);
  if (rows === null) return null;
  const sorted = [...rows].sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt));
  if (sorted.length === 0) return null;
  const conf = {
    articles: { to: '/articles', icon: 'file-text' as IconName },
    news: { to: '/news', icon: 'news' as IconName },
    tutorials: { to: '/tutorials', icon: 'book-open' as IconName },
    activities: { to: '/activities', icon: 'calendar' as IconName },
  }[table];
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHead title={s.title || table} to={conf.to} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.slice(0, 3).map((row, i) => (
          <Reveal key={row.id} delay={i * 60}>
            <Link to={`${conf.to}/${row.slug}`} className="card card-hover group block overflow-hidden">
              <SafeImg src={row.thumbnail} alt={row.title} label={row.title} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              <div className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-base-400">{fmtDate(row.publishedAt ?? row.createdAt)}</p>
                <h3 className="mt-1 font-display text-[15px] font-bold leading-snug text-base-900 dark:text-base-50 line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{row.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-base-500 dark:text-base-400 line-clamp-2">{row.excerpt ?? row.description}</p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function blockItems(setting: unknown): Array<Record<string, string>> {
  if (Array.isArray(setting)) return setting.filter((item): item is Record<string, string> => typeof item === 'object' && item !== null);
  if (typeof setting === 'string' && setting.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(setting);
      if (Array.isArray(parsed)) return parsed.filter((item): item is Record<string, string> => typeof item === 'object' && item !== null);
    } catch { return []; }
  }
  return [];
}

function BannerBlock({ block }: { block: HomeBlock }) {
  const s = block.settings;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Reveal>
        <div className="surface-cta relative overflow-hidden rounded-2xl border border-base-800 px-6 py-12 sm:px-12" style={s.align ? { textAlign: s.align as 'left' | 'center' | 'right' } : undefined}>
          <div className="absolute inset-0 grid-bg opacity-40" />
          {s.image && <SafeImg src={s.image} alt={s.title || 'Banner'} className="absolute inset-0 h-full w-full object-cover opacity-20" />}
          <div className="relative">
            {s.title && <h2 className="font-display text-2xl sm:text-3xl font-bold">{s.title}</h2>}
            {s.subtitle && <p className="mx-auto mt-2 max-w-md text-sm opacity-80">{s.subtitle}</p>}
            {s.cta_label && s.cta_url && <Link to={s.cta_url} className="btn-primary mt-6 inline-flex">{s.cta_label} <Icon name="arrow-right" size={15} /></Link>}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function SliderBlock({ block }: { block: HomeBlock }) {
  const [index, setIndex] = useState(0);
  const items = blockItems(block.settings.items);
  if (items.length === 0) return null;
  const current = items[index % items.length];
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-base-200 dark:border-base-800">
          {current.image && <SafeImg src={current.image} alt={current.title || `Slide ${index + 1}`} className="aspect-video w-full object-cover" />}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-base-950/80 to-transparent p-6">
            {current.title && <h3 className="font-display text-xl font-bold text-white">{current.title}</h3>}
            {current.subtitle && <p className="mt-1 text-sm text-white/80">{current.subtitle}</p>}
            {current.cta_label && current.cta_url && <Link to={current.cta_url} className="btn-primary btn-sm mt-3 inline-flex">{current.cta_label}</Link>}
          </div>
          {items.length > 1 && (
            <div className="absolute right-4 top-4 flex gap-2">
              <button aria-label="Sebelumnya" className="btn-outline btn-sm" onClick={() => setIndex((index + items.length - 1) % items.length)}>‹</button>
              <button aria-label="Berikutnya" className="btn-outline btn-sm" onClick={() => setIndex((index + 1) % items.length)}>›</button>
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}

function FaqBlock({ block }: { block: HomeBlock }) {
  const s = block.settings;
  const [open, setOpen] = useState<number | null>(null);
  const items = blockItems(s.items);
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {s.title && <SectionHead title={s.title} sub={s.subtitle} />}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="card overflow-hidden">
            <button className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-display text-[15px] font-bold" onClick={() => setOpen(open === i ? null : i)}>
              {item.question}
              <Icon name={open === i ? 'chevron-up' : 'chevron-down'} size={16} className="shrink-0 text-base-400" />
            </button>
            {open === i && item.answer && <div className="px-5 pb-5"><RichHTML html={item.answer} /></div>}
          </div>
        ))}
      </div>
    </section>
  );
}

function TestimonialBlock({ block }: { block: HomeBlock }) {
  const s = block.settings;
  const items = blockItems(s.items);
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {s.title && <SectionHead title={s.title} sub={s.subtitle} />}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <Reveal key={i} delay={i * 60}>
            <div className="card h-full p-5">
              <div className="flex items-center gap-3">
                <Avatar name={item.name || '?'} src={item.photo} size={44} />
                <div>
                  <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">{item.name}</p>
                  {item.role && <p className="text-[11px] font-mono uppercase tracking-wide text-base-400">{item.role}</p>}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-base-600 dark:text-base-300">“{item.testimonial}”</p>
              {Number(item.rating) >= 1 && (
                <p className="mt-2 flex items-center gap-1 text-warn-500">
                  {Array.from({ length: Math.min(5, Math.max(1, Math.round(Number(item.rating)))) }).map((_, r) => (
                    <Icon key={r} name="star" size={13} />
                  ))}
                </p>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function BlockRenderer({ block }: { block: HomeBlock }) {
  const s = block.settings;
  switch (block.type) {
    case 'hero': return <HeroBlock block={block} />;
    case 'map': return <MapBlock block={block} />;
    case 'stats': return <StatsBlock />;
    case 'featured_courses':
    case 'latest_courses':
    case 'free_courses': return <CoursesBlock block={block} />;
    case 'categories': return <CategoriesBlock block={block} />;
    case 'instructors': return <InstructorsBlock />;
    case 'articles':
    case 'news':
    case 'tutorials':
    case 'activities': return <ContentSectionBlock block={block} />;
    case 'cta':
      return (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <Reveal>
            <div className="surface-cta relative overflow-hidden rounded-2xl border border-base-800 px-6 py-12 text-center sm:px-12">
              <div className="absolute inset-0 grid-bg opacity-40" />
              <div className="absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
              <div className="relative">
                <h2 className="font-display text-2xl sm:text-3xl font-bold">{s.title}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm opacity-80">{s.sub}</p>
                <Link to="/courses" className="btn-primary mt-6 inline-flex">{s.button_label || 'Lihat Semua Kelas'} <Icon name="arrow-right" size={15} /></Link>
              </div>
            </div>
          </Reveal>
        </section>
      );
    case 'text':
      return s.html ? (
        <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><Reveal><RichHTML html={s.html} /></Reveal></section>
      ) : null;
    case 'video':
      return youtubeId(s.url || '') ? (
        <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          {s.title && <SectionHead title={s.title} />}
          <Reveal><YouTube url={s.url} /></Reveal>
        </section>
      ) : null;
    case 'custom':
      return s.html ? (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" dangerouslySetInnerHTML={{ __html: sanitizeLocal(s.html) }} />
      ) : null;
    case 'banner': return <BannerBlock block={block} />;
    case 'slider': return <SliderBlock block={block} />;
    case 'faq': return <FaqBlock block={block} />;
    case 'testimonial': return <TestimonialBlock block={block} />;
    default: return null;
  }
}
function sanitizeLocal(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed').forEach((e) => e.remove());
  return doc.body.innerHTML;
}

export function HomePage() {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  useEffect(() => {
    void api.homepageBlocks().then((remote) => setBlocks(remote.map((block: any) => ({ id: String(block.id), type: block.type, enabled: Boolean(block.enabled), order: Number(block.sort ?? 0), settings: block.content || {}, createdAt: block.created_at ? Date.parse(block.created_at) : 0, updatedAt: block.updated_at ? Date.parse(block.updated_at) : 0 } as HomeBlock)))).catch(() => setBlocks([]));
  }, []);
  return (
    <PublicShell>
      {blocks.length === 0 ? (
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <EmptyState icon="layout" title="Homepage belum dikonfigurasi" sub="Super Admin dapat menyusun blok homepage melalui Dashboard → Website → Homepage." />
        </div>
      ) : (
        blocks.map((b) => <BlockRenderer key={b.id} block={b} />)
      )}
    </PublicShell>
  );
}

/* ================= generic listing pages ================= */

type ContentRow = { id: ID; title: string; slug: string; excerpt?: string; description?: string; content: string; thumbnail?: string | null; categoryId: ID | null; status: string; publishedAt: number | null; createdAt: number; authorId: ID | null; authorName?: string; videoUrl?: string; tags?: string[]; eventDate?: string; eventTime?: string; location?: string; registrationUrl?: string; gallery?: string[] };

function ContentListPage({ table, title, icon, detailPath, showVideo }: {
  table: 'articles' | 'news' | 'tutorials' | 'activities'; title: string; icon: IconName; detailPath: string; showVideo?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const [remoteRows, setRemoteRows] = useState<ContentRow[]>([]);
  const q = params.get('q') ?? '';
  const cat = params.get('cat') ?? '';
  useEffect(() => { void api.content(table, q).then((items) => setRemoteRows(items as ContentRow[])).catch(() => setRemoteRows([])); }, [table, q]);
  const rows = remoteRows
    .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt))
    .filter((r) => (!q || r.title.toLowerCase().includes(q.toLowerCase()) || (r.excerpt ?? '').toLowerCase().includes(q.toLowerCase())) && (!cat || r.categoryId === cat));
  const scope = table === 'articles' ? 'article' : table === 'tutorials' ? 'tutorial' : 'news';
  const [cats, setCats] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => { void api.categories(scope).then(setCats).catch(() => setCats([])); }, [scope]);
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? '';
  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 anim-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-500 flex items-center gap-2"><Icon name={icon} size={14} /> {title}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-base-900 dark:text-base-50">{title}</h1>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
            <input value={q} onChange={(e) => setParams((p) => { p.set('q', e.target.value); return p; }, { replace: true })} placeholder="Cari…" className="input pl-9" />
          </div>
          <Select value={cat} onChange={(e) => setParams((p) => { if (e.target.value) p.set('cat', e.target.value); else p.delete('cat'); return p; }, { replace: true })} className="w-auto">
            <option value="">Semua Kategori</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={icon} title="Belum ada data" sub={q || cat ? 'Tidak ada yang cocok dengan filter.' : 'Konten akan tampil di sini setelah dipublikasikan.'} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r, i) => (
              <Reveal key={r.id} delay={(i % 3) * 60}>
                <Link to={`${detailPath}/${r.slug}`} className="card card-hover group block overflow-hidden h-full">
                  <div className="relative">
                    <SafeImg src={r.thumbnail} alt={r.title} label={r.title} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    {showVideo && r.videoUrl && youtubeId(r.videoUrl) && (
                      <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-base-950/70 text-brand-400 backdrop-blur transition-transform group-hover:scale-110"><Icon name="play" size={22} /></span></span>
                    )}
                    {table === 'activities' && r.eventDate && (
                      <span className="absolute left-2.5 top-2.5 badge bg-base-950/80 text-base-100 backdrop-blur"><Icon name="calendar" size={10} />{fmtDate(r.eventDate)}</span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-base-400">{catName(r.categoryId)} · {fmtDate(r.publishedAt ?? r.createdAt)}</p>
                    <h3 className="mt-1.5 font-display text-[15px] font-bold leading-snug text-base-900 dark:text-base-50 line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{r.title}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-base-500 dark:text-base-400 line-clamp-2">{r.excerpt ?? r.description}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}

function ContentDetailPage({ table, detailPath }: { table: 'articles' | 'news' | 'tutorials' | 'activities'; detailPath: string }) {
  const { slug } = useParams();
  const [row, setRow] = useState<ContentRow | null>(null);
  const [related, setRelated] = useState<ContentRow[]>([]);
  const [cats, setCats] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!slug) return;
    void Promise.all([api.contentDetail(table, slug), api.content(table)]).then(([detail, items]) => {
      const current = detail as ContentRow;
      setRow(current); setRelated((items as ContentRow[]).filter((item) => item.id !== current.id).slice(0, 3));
    }).catch(() => { setRow(null); setRelated([]); });
    const scope = table === 'articles' ? 'article' : table === 'tutorials' ? 'tutorial' : 'news';
    void api.categories(scope).then(setCats).catch(() => setCats([]));
  }, [table, slug]);
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? '';
  if (!row) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-2xl px-4 py-24"><EmptyState icon="alert-circle" title="Konten tidak ditemukan" sub="Halaman yang kamu cari tidak tersedia atau belum dipublikasikan." action={<Link to={detailPath} className="btn-primary">Kembali</Link>} /></div>
      </PublicShell>
    );
  }
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to={detailPath} className="inline-flex items-center gap-1.5 text-sm font-bold text-base-400 hover:text-brand-500 transition-colors anim-rise"><Icon name="arrow-left" size={14} /> Kembali</Link>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-base-900 dark:text-base-50 anim-rise">{row.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-base-500 anim-rise">
          <span className="flex items-center gap-2"><Avatar name={row.authorName || '?'} size={26} /> <b className="text-base-700 dark:text-base-200">{row.authorName || '—'}</b></span>
          <span className="font-mono text-xs text-base-400">{fmtDate(row.publishedAt ?? row.createdAt)}</span>
          <Badge tone="brand">{catName(row.categoryId)}</Badge>
        </div>
        {table === 'activities' && (row.eventDate || row.location) && (
          <div className="mt-5 grid gap-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-4 sm:grid-cols-3 anim-rise">
            {row.eventDate && <p className="flex items-center gap-2 text-sm font-semibold text-base-700 dark:text-base-200"><Icon name="calendar" size={15} className="text-brand-500" />{fmtDate(row.eventDate)} {row.eventTime}</p>}
            {row.location && <p className="flex items-center gap-2 text-sm font-semibold text-base-700 dark:text-base-200"><Icon name="map-pin" size={15} className="text-brand-500" />{row.location}</p>}
            {row.registrationUrl && <a href={row.registrationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-bold text-brand-600 dark:text-brand-400 hover:underline"><Icon name="external" size={15} />Pendaftaran</a>}
          </div>
        )}
        <SafeImg src={row.thumbnail} alt={row.title} label={row.title} className="mt-6 aspect-video w-full rounded-2xl object-cover anim-rise" />
        {row.videoUrl && youtubeId(row.videoUrl) && <div className="mt-6"><YouTube url={row.videoUrl} /></div>}
        <div className="mt-8 anim-rise"><RichHTML html={row.content} /></div>
        {row.tags && row.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">{row.tags.map((tg) => <span key={tg} className="badge bg-base-100 dark:bg-base-800 text-base-500"><Icon name="tag" size={10} />{tg}</span>)}</div>
        )}
        {table === 'activities' && row.gallery && row.gallery.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">{row.gallery.map((g, i) => <SafeImg key={i} src={g} alt={`Galeri ${i + 1}`} className="aspect-video w-full rounded-xl object-cover" />)}</div>
        )}
        {related.length > 0 && (
          <div className="mt-12 border-t border-base-200 dark:border-base-800 pt-8">
            <h2 className="mb-4 font-display text-lg font-bold text-base-900 dark:text-base-50">Terkait</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link key={r.id} to={`${detailPath}/${r.slug}`} className="card card-hover group overflow-hidden">
                  <SafeImg src={r.thumbnail} alt={r.title} label={r.title} className="aspect-video w-full object-cover" />
                  <p className="p-3 font-display text-[13px] font-bold text-base-800 dark:text-base-100 line-clamp-2 group-hover:text-brand-500 transition-colors">{r.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </PublicShell>
  );
}

export const ArticlesPage = () => <ContentListPage table="articles" title="Artikel" icon="file-text" detailPath="/articles" />;
export const ArticleDetail = () => <ContentDetailPage table="articles" detailPath="/articles" />;
export const NewsPage = () => <ContentListPage table="news" title="Berita" icon="news" detailPath="/news" showVideo />;
export const NewsDetail = () => <ContentDetailPage table="news" detailPath="/news" />;
export const TutorialsPage = () => <ContentListPage table="tutorials" title="Tutorial" icon="book-open" detailPath="/tutorials" showVideo />;
export const TutorialDetail = () => <ContentDetailPage table="tutorials" detailPath="/tutorials" />;
export const ActivitiesPage = () => <ContentListPage table="activities" title="Kegiatan" icon="calendar" detailPath="/activities" showVideo />;
export const ActivityDetail = () => <ContentDetailPage table="activities" detailPath="/activities" />;

export function PageView() {
  const { slug } = useParams();
  const [page, setPage] = useState<ContentRow | null>(null);
  useEffect(() => { if (slug) void api.contentDetail('pages', slug).then((content) => setPage(content as ContentRow)).catch(() => setPage(null)); }, [slug]);
  if (!page) return <PublicShell><div className="mx-auto max-w-2xl px-4 py-24"><EmptyState icon="file" title="Halaman tidak ditemukan" action={<Link to="/" className="btn-primary">Ke Beranda</Link>} /></div></PublicShell>;
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 anim-rise">
        <h1 className="font-display text-3xl font-bold text-base-900 dark:text-base-50">{page.title}</h1>
        <div className="mt-6"><RichHTML html={page.content} /></div>
      </article>
    </PublicShell>
  );
}

/* ================= about us (100% CMS) ================= */

export function AboutPage() {
  const [settings, setSettings] = useState<Record<string, string | null>>({});
  useEffect(() => { void api.publicSettings().then(setSettings).catch(() => setSettings({})); }, []);
  const value = (key: string) => settings[key] ?? '';
  const team = useMemo(() => { try { return JSON.parse(value('about_team')) as Array<{ name: string; role: string; photo?: string }>; } catch { return []; } }, [settings]);
  const gallery = useMemo(() => { try { return JSON.parse(value('about_gallery')) as string[]; } catch { return []; } }, [settings]);
  return (
    <PublicShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 anim-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-500">Tentang Kami</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-base-900 dark:text-base-50">{value('about_hero_title')}</h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-base-500 dark:text-base-400">{value('about_hero_subtitle')}</p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 pb-4 sm:px-6">
        <Reveal><div className="card p-6 sm:p-8"><RichHTML html={value('about_description')} /></div></Reveal>
      </section>
      <section className="mx-auto grid max-w-4xl gap-5 px-4 py-8 sm:px-6 sm:grid-cols-2">
        <Reveal><div className="card h-full p-6 border-t-4 border-t-brand-500">
          <p className="flex items-center gap-2 font-display text-base font-bold text-base-900 dark:text-base-50"><Icon name="target" size={18} className="text-brand-500" /> Visi</p>
          <div className="mt-3"><RichHTML html={value('about_vision')} /></div>
        </div></Reveal>
        <Reveal delay={80}><div className="card h-full p-6 border-t-4 border-t-accent-400">
          <p className="flex items-center gap-2 font-display text-base font-bold text-base-900 dark:text-base-50"><Icon name="flag" size={18} className="text-accent-500" /> Misi</p>
          <div className="mt-3"><RichHTML html={value('about_mission')} /></div>
        </div></Reveal>
      </section>
      {value('about_history') && (
        <section className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <Reveal><div className="card p-6 sm:p-8">
            <p className="mb-3 flex items-center gap-2 font-display text-base font-bold text-base-900 dark:text-base-50"><Icon name="clock" size={18} className="text-brand-500" /> Sejarah</p>
            <RichHTML html={value('about_history')} />
          </div></Reveal>
        </section>
      )}
      {value('about_video') && youtubeId(value('about_video')) && (
        <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><Reveal><YouTube url={value('about_video')} /></Reveal></section>
      )}
      {team.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <SectionHead title="Tim Kami" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {team.map((m, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="card card-hover p-4 text-center">
                  <Avatar name={m.name} src={m.photo} size={60} />
                  <p className="mt-2.5 font-display text-sm font-bold text-base-900 dark:text-base-50">{m.name}</p>
                  <p className="text-[11px] font-mono uppercase tracking-wide text-base-400">{m.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}
      {gallery.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <SectionHead title="Galeri" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((g, i) => <Reveal key={i} delay={i * 40}><SafeImg src={g} alt={`Galeri ${i + 1}`} className="aspect-[4/3] w-full rounded-xl object-cover" /></Reveal>)}
          </div>
        </section>
      )}
    </PublicShell>
  );
}

/* ================= contact ================= */

export function ContactPage() {
  const { toast } = useApp();
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const lat = getSetting('map_lat'), lng = getSetting('map_lng');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email) || !form.body.trim()) { toast('error', 'Lengkapi nama, email valid, dan pesan.'); return; }
    setSending(true);
    void api.sendContact(form).then(() => { setForm({ name: '', email: '', subject: '', body: '' }); toast('success', 'Pesan terkirim. Kami akan segera membalas.'); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal mengirim pesan.')).finally(() => setSending(false));
  };
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 anim-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-500 flex items-center gap-2"><Icon name="chat" size={14} /> Kontak</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-base-900 dark:text-base-50">Hubungi Kami</h1>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4 anim-rise">
            {[
              { icon: 'map-pin' as IconName, label: 'Alamat', value: getSetting('address') },
              { icon: 'mail' as IconName, label: 'Email', value: getSetting('email') },
              { icon: 'phone' as IconName, label: 'Telepon', value: getSetting('phone') },
              { icon: 'chat' as IconName, label: 'WhatsApp', value: `+${getSetting('whatsapp')}` },
            ].map((c) => (
              <div key={c.label} className="card card-hover flex items-start gap-3.5 p-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconToneBg(c.icon)} ${iconTone(c.icon)}`}><Icon name={c.icon} size={18} /></span>
                <div><p className="font-mono text-[10px] uppercase tracking-widest text-base-400">{c.label}</p><p className="mt-0.5 text-sm font-semibold text-base-800 dark:text-base-100">{c.value || '—'}</p></div>
              </div>
            ))}
            <div className="overflow-hidden rounded-xl border border-base-200 dark:border-base-800">
              <iframe title="Peta" src={`https://maps.google.com/maps?q=${encodeURIComponent(getSetting('map_query') || `${lat},${lng}`)}&z=15&output=embed`} className="h-52 w-full" loading="lazy" />
            </div>
          </div>
          <form className="card p-6 anim-rise" style={{ animationDelay: '100ms' }} onSubmit={submit}>
            <h2 className="mb-4 font-display text-lg font-bold text-base-900 dark:text-base-50">Kirim Pesan</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="label">Nama</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="block"><span className="label">Email</span><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            </div>
            <label className="mt-4 block"><span className="label">Subjek</span><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
            <label className="mt-4 block"><span className="label">Pesan</span><textarea rows={5} className="textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
            <button className="btn-primary mt-5" disabled={sending}>{sending ? 'Mengirim…' : <><Icon name="send" size={15} /> Kirim Pesan</>}</button>
          </form>
        </div>
      </div>
    </PublicShell>
  );
}

/* ================= shop ================= */

function VariantModal({ product, onClose, onAdded }: { product: Product; onClose: () => void; onAdded: () => void }) {
  const { user, toast } = useApp();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const variants = product.variants ?? [];
  const chosen = variants.find((v) => v.id === variantId);
  const price = chosen ? chosen.price : productMinPrice(product);
  const add = async () => {
    if (!user) return;
    try {
      await api.addToCart(product.id, qty, variantId ?? undefined);
      toast('success', `"${product.name}${chosen ? ` — ${chosen.label}` : ''}" masuk keranjang.`);
      onAdded();
      onClose();
    } catch (error) { toast('error', error instanceof Error ? error.message : 'Gagal.'); }
  };
  return (
    <div className="fixed inset-0 z-[88] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-base-950/60 backdrop-blur-[3px] anim-fade" onClick={onClose} />
      <div className="relative card w-full max-w-md p-5 anim-scale">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <SafeImg src={product.thumbnail} alt={product.name} label={product.name} className="h-16 w-16 rounded-xl object-cover" />
            <div>
              <h3 className="font-display text-base font-bold text-base-900 dark:text-base-50">{product.name}</h3>
              <p className="font-mono text-[10px] uppercase tracking-wide text-base-400">Pilih varian</p>
            </div>
          </div>
          <button onClick={onClose} className="text-base-400 hover:text-base-800 dark:hover:text-base-100 cursor-pointer"><Icon name="x" size={16} /></button>
        </div>
        <div className="mt-4 grid gap-2">
          {variants.map((v) => {
            const out = v.stock <= 0;
            const sel = variantId === v.id;
            return (
              <button key={v.id} disabled={out} onClick={() => setVariantId(v.id)}
                className={`flex items-center justify-between rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sel ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-base-200 dark:border-base-700 text-base-700 dark:text-base-200 hover:border-brand-500/50'}`}>
                <span>{v.label}{out && <span className="ml-2 font-mono text-[10px] text-danger-400">habis</span>}</span>
                <span className="font-display">{fmtMoney(v.price)}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-base-300 dark:border-base-700">
            <button className="px-3 py-1.5 text-base-500 hover:text-brand-500 cursor-pointer" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span className="w-8 text-center font-mono text-sm font-bold">{qty}</span>
            <button className="px-3 py-1.5 text-base-500 hover:text-brand-500 cursor-pointer" onClick={() => setQty(Math.min(chosen?.stock ?? 99, qty + 1))}>+</button>
          </div>
          <button className="btn-primary flex-1" disabled={!variantId} onClick={add}>
            <Icon name="cart" size={14} /> Tambah · {fmtMoney(price * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopPage() {
  const { user, toast, t } = useApp();
  const nav = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const [cat, setCat] = useState('');
  const [kind, setKind] = useState<'all' | 'physical' | 'digital'>('all');
  const [variantFor, setVariantFor] = useState<Product | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discount: number } | null>(null);
  const [voucherErr, setVoucherErr] = useState('');
  const [ship, setShip] = useState({ name: user?.name ?? '', address: '', phone: user?.phone ?? '' });
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [cartFromApi, setCartFromApi] = useState<ApiCart>({ items: [], subtotal: 0, count: 0, hasPhysical: false, hasDigital: false });
  const { categories } = useApp();
  const cats = categories.filter((c) => c.scope === 'product');
  useEffect(() => { setPage(1); }, [cat, kind]);
  const productPage = useRemote(() => api.productPage({ page, category_id: cat, kind: kind === 'all' ? '' : kind }), [page, cat, kind]);

  // Cart state is always re-read from the server; the header badge listens for the same event.
  const refreshShop = () => {
    productPage.reload();
    if (user) void api.cart().then(setCartFromApi).catch(() => setCartFromApi({ items: [], subtotal: 0, count: 0, hasPhysical: false, hasDigital: false }));
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
  };
  useEffect(() => { if (user) void api.cart().then(setCartFromApi).catch(() => undefined); }, [user?.id]);
  const products = productPage.data?.items ?? [];
  const cart = cartFromApi;

  const applyVoucher = () => {
    setVoucherErr('');
    if (!voucherCode.trim()) return;
    void api.validateVoucher(voucherCode, cart.subtotal).then((res) => {
      setAppliedVoucher(res);
      toast('success', `Voucher ${res.code} diterapkan — hemat ${fmtMoney(res.discount)}.`);
    }).catch((error) => { setVoucherErr(error instanceof Error ? error.message : 'Voucher tidak valid.'); setAppliedVoucher(null); });
  };

  const checkout = () => {
    if (!user) { nav('/login?next=/shop'); return; }
    setBusy(true);
    api.createShopOrder({ voucher_code: appliedVoucher?.code ?? '', shipping: cart.hasPhysical ? ship : undefined }).then((response) => {
      const order = (response as { order: { id: string } }).order;
      setCartOpen(false); setAppliedVoucher(null); setVoucherCode(''); window.dispatchEvent(new Event(CART_CHANGED_EVENT)); nav(`/checkout/${order.id}`);
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal checkout.')).finally(() => setBusy(false));
  };

  const totalStock = (p: Product) => (p.variants && p.variants.length > 0 ? p.variants.reduce((a, v) => a + v.stock, 0) : p.stock);

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3 anim-rise">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-500 flex items-center gap-2"><Icon name="store" size={14} /> Toko</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-base-900 dark:text-base-50">{t('shop')}</h1>
            <p className="mt-1 text-sm text-base-500 dark:text-base-400">Produk fisik & digital — produk digital dikirim otomatis tanpa pengiriman barang.</p>
          </div>
          <button className="btn-outline relative" onClick={() => setCartOpen(true)}>
            <Icon name="cart" size={16} /> {t('cart')}
            {cart.count > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-400 px-1 font-mono text-[10px] font-bold text-base-950">{cart.count}</span>}
          </button>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2 anim-rise">
          {([['all', 'Semua'], ['physical', 'Fisik'], ['digital', 'Digital']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${kind === k ? 'bg-base-900 dark:bg-base-50 text-base-50 dark:text-base-950' : 'bg-base-100 dark:bg-base-850 text-base-500 hover:text-base-900 dark:hover:text-base-100'}`}>
              {l}
            </button>
          ))}
          <span className="mx-2 hidden sm:block h-5 w-px bg-base-200 dark:bg-base-700" />
          {cats.map((c) => (
            <button key={c.id} onClick={() => setCat(cat === c.id ? '' : c.id)}
              className={`badge cursor-pointer transition-colors ${cat === c.id ? 'bg-brand-500 text-base-950' : 'bg-base-100 dark:bg-base-800 text-base-500 hover:text-brand-500'}`}>{c.name}</button>
          ))}
        </div>
        {productPage.status === 'error' || productPage.status === 'forbidden' ? (
          <EmptyState icon="alert-triangle" title="Gagal memuat produk" sub={productPage.error} action={<button className="btn-primary" onClick={productPage.reload}>Coba lagi</button>} />
        ) : productPage.data === null ? (
          <p className="py-14 text-center text-sm text-base-400">Memuat produk…</p>
        ) : products.length === 0 ? (
          <EmptyState icon="bag" title="Belum ada produk" sub="Produk yang dipublikasikan dari dashboard toko akan tampil di sini." />
        ) : (
          <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
            {products.map((p, i) => {
              const price = productMinPrice(p);
              const hasVariants = !!(p.variants && p.variants.length > 0);
              const stock = totalStock(p);
              return (
                <div key={p.id} className="card card-hover group overflow-hidden anim-rise" style={{ animationDelay: `${(i % 4) * 60}ms` }}>
                  <div className="relative overflow-hidden">
                    <SafeImg src={p.thumbnail} alt={p.name} label={p.name} className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                    <div className="absolute left-2 top-2 flex flex-col gap-1.5">
                      {p.isDigital && <Badge tone="accent"><Icon name="download" size={10} /> Digital</Badge>}
                      {hasVariants && <Badge tone="info">{p.variants!.length} varian</Badge>}
                    </div>
                    {stock <= 0 && <span className="absolute inset-0 flex items-center justify-center bg-base-950/60 font-display text-sm font-bold text-base-100">Stok Habis</span>}
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-sm font-bold text-base-900 dark:text-base-50 line-clamp-2">{p.name}</h3>
                    <p className="mt-1.5 font-display text-base font-bold text-brand-600 dark:text-brand-400">
                      {hasVariants && <span className="mr-1 text-[10px] font-normal font-mono text-base-400">mulai</span>}
                      {fmtMoney(price)}
                      {!hasVariants && p.discountPrice > 0 && p.discountPrice < p.price && <span className="ml-1.5 text-[11px] font-normal text-base-400 line-through">{fmtMoney(p.price)}</span>}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-base-400">
                      {p.isDigital ? 'instan · tanpa ongkir' : `${t('stock')}: ${stock}`}
                    </p>
                    <button className="btn-primary btn-sm mt-3 w-full" disabled={stock <= 0}
                      onClick={() => {
                        if (!user) { nav('/login?next=/shop'); return; }
                        if (hasVariants) { setVariantFor(p); return; }
                        void api.addToCart(p.id).then(() => { toast('success', `"${p.name}" masuk keranjang.`); refreshShop(); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menambahkan produk.'));
                      }}>
                      <Icon name="cart" size={13} /> {hasVariants ? 'Pilih Varian' : t('add_to_cart')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {productPage.data && productPage.data.lastPage > 1 && <div className="card mt-6"><Pager page={productPage.data} onPage={setPage} /></div>}
      </div>

      {variantFor && <VariantModal product={variantFor} onClose={() => setVariantFor(null)} onAdded={() => { refreshShop(); setCartOpen(true); }} />}

      {cartOpen && (
        <div className="fixed inset-0 z-[85]">
          <div className="absolute inset-0 bg-base-950/60 backdrop-blur-sm anim-fade" onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white dark:bg-base-900 border-l border-base-200 dark:border-base-800 anim-slide">
            <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-5 py-4">
              <h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">{t('cart')} ({cart.count})</h2>
              <button onClick={() => setCartOpen(false)} className="p-1.5 text-base-400 hover:text-base-900 dark:hover:text-base-100 cursor-pointer"><Icon name="x" size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {cart.items.length === 0 ? (
                <EmptyState icon="cart" title="Keranjang kosong" sub="Tambahkan produk untuk mulai belanja." />
              ) : (
                <>
                  {cart.items.map(({ item, product, variant, price }) => (
                    <div key={item.id} className="mb-3 flex gap-3 rounded-xl border border-base-200 dark:border-base-800 p-3">
                      <SafeImg src={product!.thumbnail} alt={product!.name} label={product!.name} className="h-16 w-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-base-900 dark:text-base-50">{product!.name}</p>
                        <div className="flex items-center gap-1.5">
                          {variant && <Badge tone="info">{variant.label}</Badge>}
                          {product!.isDigital && <Badge tone="accent"><Icon name="download" size={9} /> Digital</Badge>}
                        </div>
                        <p className="mt-1 font-display text-sm font-bold text-brand-600 dark:text-brand-400">{fmtMoney(price)}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <button className="btn-ghost btn-sm !px-2" onClick={() => void api.updateCart(item.id, item.qty - 1).then(refreshShop).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui cart.'))}>−</button>
                          <span className="w-6 text-center font-mono text-sm font-bold">{item.qty}</span>
                          <button className="btn-ghost btn-sm !px-2" onClick={() => void api.updateCart(item.id, item.qty + 1).then(refreshShop).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui cart.'))}>+</button>
                          <button className="ml-auto text-danger-400 hover:text-danger-500 cursor-pointer" onClick={() => void api.removeFromCart(item.id).then(refreshShop).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menghapus item.'))}><Icon name="trash" size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="mt-4 rounded-xl border border-base-200 dark:border-base-800 p-3.5">
                    <p className="label !mb-2"><Icon name="tag" size={11} className="inline mr-1 -mt-0.5" />Voucher</p>
                    {appliedVoucher ? (
                      <div className="flex items-center justify-between rounded-lg bg-ok-500/10 border border-ok-500/30 px-3 py-2">
                        <span className="font-mono text-xs font-bold text-ok-500">{appliedVoucher.code} · −{fmtMoney(appliedVoucher.discount)}</span>
                        <button className="text-xs font-bold text-base-400 hover:text-danger-500 cursor-pointer" onClick={() => { setAppliedVoucher(null); setVoucherCode(''); }}>Hapus</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <input value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="KODE-VOUCHER"
                            className="input py-2 font-mono text-xs uppercase flex-1" onKeyDown={(e) => e.key === 'Enter' && applyVoucher()} />
                          <button className="btn-outline btn-sm" onClick={applyVoucher}>Pakai</button>
                        </div>
                        {voucherErr && <p className="mt-1.5 text-[11px] font-semibold text-danger-500">{voucherErr}</p>}
                      </>
                    )}
                  </div>

                  {cart.hasPhysical && (
                    <div className="mt-4 rounded-xl border border-base-200 dark:border-base-800 p-3.5 space-y-2.5">
                      <p className="label !mb-0"><Icon name="map-pin" size={11} className="inline mr-1 -mt-0.5" />Alamat Pengiriman (produk fisik)</p>
                      <input value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} placeholder="Nama penerima" className="input py-2 text-xs" />
                      <input value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} placeholder="No. HP" className="input py-2 text-xs font-mono" />
                      <textarea value={ship.address} onChange={(e) => setShip({ ...ship, address: e.target.value })} placeholder="Alamat lengkap…" rows={2} className="textarea py-2 text-xs" />
                    </div>
                  )}
                  {cart.hasDigital && !cart.hasPhysical && (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-500/[0.07] border border-brand-500/25 p-3 text-[11px] leading-4 text-brand-700 dark:text-brand-300">
                      <Icon name="download" size={13} className="mt-0.5 shrink-0" />
                      Semua item digital — tidak perlu alamat pengiriman. File dikirim otomatis setelah pembayaran.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="border-t border-base-200 dark:border-base-800 p-5">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-bold text-base-500">Subtotal</span>
                <span className="font-mono text-base-700 dark:text-base-200">{fmtMoney(cart.subtotal)}</span>
              </div>
              {appliedVoucher && (
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-bold text-ok-500">Diskon voucher</span>
                  <span className="font-mono text-ok-500">−{fmtMoney(appliedVoucher.discount)}</span>
                </div>
              )}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-base-500">Total</span>
                <span className="font-display text-lg font-bold text-base-900 dark:text-base-50">{fmtMoney(Math.max(0, cart.subtotal - (appliedVoucher?.discount ?? 0)))}</span>
              </div>
              <button className="btn-primary w-full py-3" onClick={checkout} disabled={cart.items.length === 0 || busy}>
                <Icon name="card" size={16} /> {busy ? 'Membuat order…' : `${t('checkout')} · Payment Gateway`}
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicShell>
  );
}
