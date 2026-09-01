import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { db, type MenuItem } from '../lib/db';
import { can, getSetting, globalSearch, markAllNotifRead, markNotifRead, roleLabel, timeAgo } from '../lib/services';
import { ShopService } from '../lib/commerce';
import { useApp, useDB } from '../state/store';
import { Icon, type IconName } from './icons';
import { Avatar, Badge, ToastHost } from './ui';

/* ================= shared bits ================= */

export function Logo({ compact }: { compact?: boolean }) {
  const name = getSetting('site_name', 'KMSIT Computer');
  const logoUrl = getSetting('logo');
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-8 w-8 rounded-lg object-cover" />
      ) : (
        <span className="text-brand-500 transition-transform duration-200 group-hover:scale-110"><Icon name="logo" size={30} /></span>
      )}
      {!compact && (
        <span className="font-display text-[17px] font-bold tracking-tight text-base-900 dark:text-base-50 leading-none">
          {name.split(' ')[0]}<span className="text-brand-500"> {name.split(' ').slice(1).join(' ')}</span>
        </span>
      )}
    </Link>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const opts: Array<{ k: 'light' | 'dark' | 'system'; icon: IconName; label: string }> = [
    { k: 'light', icon: 'sun', label: 'Light' }, { k: 'dark', icon: 'moon', label: 'Dark' }, { k: 'system', icon: 'monitor', label: 'System' },
  ];
  const cur = opts.find((o) => o.k === theme)!;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} title="Mode tampilan" className="flex h-9 w-9 items-center justify-center rounded-lg text-base-500 transition-colors hover:bg-base-200/70 hover:text-base-900 dark:hover:bg-base-800 dark:hover:text-base-100 cursor-pointer">
        <Icon name={cur.icon} size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 card w-40 p-1.5 anim-scale">
          {opts.map((o) => (
            <button key={o.k} onClick={() => { setTheme(o.k); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${theme === o.k ? 'bg-brand-500/12 text-brand-600 dark:text-brand-400' : 'text-base-600 dark:text-base-300 hover:bg-base-100 dark:hover:bg-base-800'}`}>
              <Icon name={o.icon} size={15} /> {o.label}
              {theme === o.k && <Icon name="check" size={13} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LangToggle() {
  const { lang, setLang } = useApp();
  return (
    <button onClick={() => setLang(lang === 'id' ? 'en' : 'id')} title="Ganti bahasa"
      className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[11px] font-bold uppercase text-base-500 transition-colors hover:bg-base-200/70 hover:text-base-900 dark:hover:bg-base-800 dark:hover:text-base-100 cursor-pointer">
      <Icon name="globe" size={15} /> {lang}
    </button>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, fn: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fn(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, fn]);
}

/* ================= public shell ================= */

export function menuPath(item: MenuItem): string {
  switch (item.type) {
    case 'home': return '/';
    case 'courses': return '/courses';
    case 'articles': return '/articles';
    case 'news': return '/news';
    case 'tutorials': return '/tutorials';
    case 'activities': return '/activities';
    case 'about': return '/about';
    case 'contact': return '/contact';
    case 'shop': return '/shop';
    case 'page': return `/page/${item.target}`;
    default: return item.target || '/';
  }
}

function NavDropdown({ label, children }: { label: string; children: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div className="relative" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-sm font-semibold text-base-600 dark:text-base-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer py-2">
        {label} <Icon name="chevron-down" size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-44 card p-1.5 anim-scale">
          {children.map((c) => (
            <Link key={c.id} to={menuPath(c)} onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-semibold text-base-600 dark:text-base-300 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicNav() {
  const { t } = useApp();
  const useDBv = useDB();
  void useDBv;
  const headerMenu = db.find('menus', (m) => m.location === 'header');
  const items = headerMenu
    ? db.where('menuItems', (i) => i.menuId === headerMenu.id).sort((a, b) => a.order - b.order)
    : [];
  const roots = items.filter((i) => !i.parentId);
  const fallback: Array<[string, string]> = [['/', t('home')], ['/courses', t('courses')], ['/tutorials', t('tutorials')], ['/articles', t('articles')], ['/news', t('news')], ['/shop', t('shop')], ['/about', t('about')]];
  return (
    <nav className="hidden lg:flex items-center gap-5">
      {roots.length > 0
        ? roots.map((item) => {
            const children = items.filter((i) => i.parentId === item.id).sort((a, b) => a.order - b.order);
            return children.length > 0
              ? <NavDropdown key={item.id} label={item.label}>{children}</NavDropdown>
              : <NavLink key={item.id} to={menuPath(item)} end={menuPath(item) === '/'}
                  className={({ isActive }) => `py-2 text-sm font-semibold transition-colors ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-base-600 dark:text-base-300 hover:text-brand-600 dark:hover:text-brand-400'}`}>
                  {item.label}
                </NavLink>;
          })
        : fallback.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `py-2 text-sm font-semibold transition-colors ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-base-600 dark:text-base-300 hover:text-brand-600 dark:hover:text-brand-400'}`}>
              {label}
            </NavLink>
          ))}
    </nav>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  const { user, t } = useApp();
  useDB();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState('');
  const results = globalSearch(q);
  const cartCount = user ? ShopService.cartDetail(user.id).count : 0;
  const maintenance = getSetting('maintenance_mode') === '1';
  const isAdmin = !!user && (user.roleKey === 'super_admin' || user.roleKey === 'admin');

  if (maintenance && !isAdmin) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center anim-scale">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warn-400/15 text-accent-500"><Icon name="gear" size={26} /></span>
          <h1 className="font-display text-xl font-bold text-base-900 dark:text-base-50">Maintenance Mode</h1>
          <p className="mt-2 text-sm text-base-500 dark:text-base-400">{getSetting('site_name')} sedang dalam perawatan. Silakan kembali beberapa saat lagi.</p>
        </div>
      </div>
    );
  }

  const headerMenu = db.find('menus', (m) => m.location === 'header');
  const items = headerMenu ? db.where('menuItems', (i) => i.menuId === headerMenu.id).sort((a, b) => a.order - b.order) : [];
  const roots = items.filter((i) => !i.parentId);
  const footerMenu = db.find('menus', (m) => m.location === 'footer');
  const footerItems = footerMenu ? db.where('menuItems', (i) => i.menuId === footerMenu.id).sort((a, b) => a.order - b.order) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-base-200/80 dark:border-base-800/80 bg-white/85 dark:bg-base-925/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button className="lg:hidden p-2 -ml-2 text-base-500 hover:text-base-900 dark:hover:text-base-100 cursor-pointer" onClick={() => setMobileOpen(true)} aria-label="Menu"><Icon name="menu" size={20} /></button>
          <Logo />
          <div className="mx-auto"><PublicNav /></div>
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
            {(user?.roleKey === 'student' || user?.roleKey === 'instructor') && (
              <Link to="/shop" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-base-500 hover:bg-base-200/70 hover:text-base-900 dark:hover:bg-base-800 dark:hover:text-base-100 transition-colors" title={t('cart')}>
                <Icon name="cart" size={17} />
                {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-400 px-1 font-mono text-[9px] font-bold text-base-950">{cartCount}</span>}
              </Link>
            )}
            {user ? (
              <>
                <Link to="/dashboard" className="ml-1 hidden sm:flex items-center gap-2 rounded-lg border border-base-200 dark:border-base-700 py-1.5 pl-1.5 pr-3 hover:border-brand-500/50 transition-colors">
                  <Avatar name={user.name} src={user.avatar} size={26} />
                  <span className="text-sm font-bold text-base-800 dark:text-base-100">{t('dashboard')}</span>
                </Link>
                <Link to="/dashboard" className="sm:hidden p-2 text-base-500 hover:text-brand-600" title={t('dashboard')}><Icon name="grid" size={18} /></Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm hidden sm:inline-flex">{t('login')}</Link>
                <Link to="/register" className="btn-primary btn-sm">{t('register')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-base-950/60 backdrop-blur-sm anim-fade" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-base-900 border-r border-base-200 dark:border-base-800 p-5 anim-slide overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-base-400 hover:text-base-900 dark:hover:text-base-100 cursor-pointer"><Icon name="x" size={18} /></button>
            </div>
            <form className="mb-4" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { nav(`/courses?q=${encodeURIComponent(q.trim())}`); setMobileOpen(false); } }}>
              <div className="relative">
                <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_placeholder')} className="input pl-9 py-2 text-sm" />
                {results.length > 0 && (
                  <div className="absolute inset-x-0 top-11 card p-1.5 z-50">
                    {results.map((r, i) => (
                      <button type="button" key={i} onClick={() => { nav(r.to); setMobileOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-brand-500/10 cursor-pointer">
                        <span className="badge bg-base-100 dark:bg-base-800 text-base-400">{r.group}</span>
                        <span className="truncate font-semibold text-base-700 dark:text-base-200">{r.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </form>
            <nav className="space-y-1">
              {(roots.length > 0 ? roots : []).map((item) => (
                <Link key={item.id} to={menuPath(item)} onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-bold text-base-700 dark:text-base-200 hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
            {!user && (
              <div className="mt-6 space-y-2 border-t border-base-200 dark:border-base-800 pt-5">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-outline w-full">{t('login')}</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-primary w-full">{t('register')}</Link>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-base-200 dark:border-base-800 bg-base-100/60 dark:bg-base-925 mt-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-6 text-base-500 dark:text-base-400">{getSetting('slogan') || getSetting('footer_text')}</p>
            <div className="mt-4 flex gap-2">
              {([['facebook', getSetting('social_facebook')], ['instagram', getSetting('social_instagram')], ['youtube', getSetting('social_youtube')], ['tiktok', getSetting('social_tiktok')]] as const)
                .filter(([, url]) => url).map(([icon, url]) => (
                  <a key={icon} href={url} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-base-200 dark:border-base-700 text-base-500 hover:border-brand-500 hover:text-brand-500 transition-colors">
                    <Icon name={icon} size={16} />
                  </a>
                ))}
            </div>
          </div>
          <div>
            <p className="label">Navigasi</p>
            <ul className="mt-2 space-y-2">
              {(footerItems.length > 0 ? footerItems : items).slice(0, 8).map((i) => (
                <li key={i.id}><Link to={menuPath(i)} className="text-sm font-semibold text-base-500 dark:text-base-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">{i.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">{t('contact')}</p>
            <ul className="mt-2 space-y-2.5 text-sm text-base-500 dark:text-base-400">
              <li className="flex items-start gap-2"><Icon name="map-pin" size={15} className="mt-0.5 shrink-0 text-brand-500" />{getSetting('address')}</li>
              <li className="flex items-center gap-2"><Icon name="mail" size={15} className="text-brand-500" />{getSetting('email')}</li>
              <li className="flex items-center gap-2"><Icon name="phone" size={15} className="text-brand-500" />{getSetting('phone')}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-base-200 dark:border-base-800 py-4 text-center font-mono text-[11px] text-base-400">
          {getSetting('footer_text')}
        </div>
      </footer>
      <ToastHost />
    </div>
  );
}

/* ================= dashboard shell ================= */

export interface NavItem { to: string; label: string; icon: IconName; perm?: string; end?: boolean; }
export interface NavGroup { label: string; items: NavItem[]; }

export function dashboardNav(roleKey: string, perms: string[]): NavGroup[] {
  const has = (p: string) => perms.includes('*') || perms.includes(p);
  const staff = roleKey === 'super_admin' || roleKey === 'admin';
  const all: NavGroup[] = [
    { label: '', items: [{ to: '/dashboard', label: 'Dashboard', icon: 'grid', end: true }] },
    { label: 'Pembelajaran', items: [
      { to: '/dashboard/my-learning', label: 'Pembelajaranku', icon: 'grad-cap', perm: 'learn' },
      { to: '/dashboard/digital', label: 'Produk Digital', icon: 'download', perm: 'learn' },
      { to: '/dashboard/certificates', label: 'Sertifikat Saya', icon: 'award', perm: 'student_certificates' },
      { to: '/dashboard/orders', label: 'Order Saya', icon: 'receipt', perm: 'student_orders' },
    ]},
    { label: 'Akademik', items: [
      { to: '/dashboard/courses', label: 'Kelas', icon: 'book', perm: roleKey === 'instructor' ? 'instructor_courses' : 'manage_courses' },
      { to: '/dashboard/categories', label: 'Kategori', icon: 'tag', perm: 'manage_categories' },
      { to: '/dashboard/quizzes', label: 'Quiz', icon: 'target', perm: roleKey === 'instructor' ? 'instructor_quizzes' : 'manage_quizzes' },
      { to: '/dashboard/certificates', label: 'Sertifikat', icon: 'award', perm: roleKey === 'instructor' ? 'instructor_certificates' : 'manage_certificates' },
      { to: '/dashboard/students', label: 'Student Kelas', icon: 'users', perm: roleKey === 'instructor' ? 'instructor_students' : undefined },
    ]},
    { label: 'Konten', items: [
      { to: '/dashboard/articles', label: 'Artikel', icon: 'file-text', perm: 'manage_articles' },
      { to: '/dashboard/news', label: 'Berita', icon: 'news', perm: 'manage_news' },
      { to: '/dashboard/tutorials', label: 'Tutorial', icon: 'book-open', perm: 'manage_tutorials' },
      { to: '/dashboard/activities', label: 'Kegiatan', icon: 'calendar', perm: 'manage_activities' },
    ]},
    { label: 'Toko & Order', items: [
      { to: '/dashboard/products', label: 'Produk', icon: 'bag', perm: 'manage_shop' },
      { to: '/dashboard/vouchers', label: 'Voucher', icon: 'tag', perm: 'manage_vouchers' },
      { to: '/dashboard/orders', label: 'Orders', icon: 'receipt', perm: staff ? 'manage_orders' : 'instructor_wallet' },
      { to: '/dashboard/payments', label: 'Pembayaran', icon: 'card', perm: 'view_payments' },
    ]},
    { label: 'Keuangan', items: [
      { to: '/dashboard/wallet', label: 'Dompet', icon: 'wallet', perm: 'instructor_wallet' },
      { to: '/dashboard/withdrawals', label: 'Withdrawal', icon: 'banknote', perm: roleKey === 'instructor' ? 'instructor_withdrawals' : 'process_withdrawals' },
    ]},
    { label: 'Pengguna', items: [
      { to: '/dashboard/students', label: 'Students', icon: 'users', perm: 'manage_students' },
      { to: '/dashboard/instructors', label: 'Instructors', icon: 'grad-cap', perm: 'manage_instructors' },
      { to: '/dashboard/users', label: 'Semua User', icon: 'shield', perm: '*' },
      { to: '/dashboard/messages', label: 'Pesan Masuk', icon: 'chat', perm: 'view_messages' },
    ]},
    { label: 'Website', items: [
      { to: '/dashboard/homepage', label: 'Homepage', icon: 'layout', perm: 'manage_homepage' },
      { to: '/dashboard/menus', label: 'Menu', icon: 'list', perm: 'manage_menus' },
      { to: '/dashboard/pages', label: 'Halaman', icon: 'file', perm: 'manage_pages' },
      { to: '/dashboard/about', label: 'Tentang Kami', icon: 'info', perm: 'manage_about' },
      { to: '/dashboard/media', label: 'Media', icon: 'image', perm: 'manage_media' },
    ]},
    { label: 'Pengaturan', items: [
      { to: '/dashboard/settings', label: 'Umum', icon: 'gear', perm: '*' },
      { to: '/dashboard/settings-payments', label: 'Payment Gateway', icon: 'card', perm: '*' },
      { to: '/dashboard/settings-language', label: 'Bahasa & Wilayah', icon: 'globe', perm: '*' },
      { to: '/dashboard/settings-system', label: 'Sistem & Audit', icon: 'server', perm: '*' },
    ]},
    { label: 'Akun', items: [
      { to: '/dashboard/profile', label: 'Profil Saya', icon: 'user' },
    ]},
  ];
  return all
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || has(i.perm)) }))
    .filter((g) => g.items.length > 0);
}

function NotifBell() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  useDB();
  if (!user) return null;
  const notifs = db.where('notifications', (n) => n.userId === user.id).sort((a, b) => b.createdAt - a.createdAt);
  const unread = notifs.filter((n) => !n.read).length;
  const nav = useNavigate();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} title="Notifikasi" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-base-500 hover:bg-base-200/70 hover:text-base-900 dark:hover:bg-base-800 dark:hover:text-base-100 transition-colors cursor-pointer">
        <Icon name="bell" size={17} />
        {unread > 0 && <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 font-mono text-[9px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,360px)] card anim-scale overflow-hidden">
          <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-4 py-2.5">
            <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">Notifikasi</p>
            {unread > 0 && <button className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer" onClick={() => markAllNotifRead(user.id)}>Tandai dibaca</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 && <p className="px-4 py-8 text-center text-sm text-base-400">Belum ada notifikasi.</p>}
            {notifs.slice(0, 12).map((n) => (
              <button key={n.id} onClick={() => { markNotifRead(n.id); if (n.link) { nav(n.link); setOpen(false); } }}
                className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-brand-500/[0.05] cursor-pointer border-b border-base-100 dark:border-base-800/60 ${!n.read ? 'bg-brand-500/[0.04]' : ''}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.read ? 'bg-brand-500' : 'bg-base-300 dark:bg-base-700'}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold text-base-800 dark:text-base-100">{n.title}</span>
                  <span className="block truncate text-xs text-base-500 dark:text-base-400">{n.body}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-base-400">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalSearchBox() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useClickOutside(ref, () => setOpen(false));
  const results = globalSearch(q);
  return (
    <div className="relative hidden md:block w-72" ref={ref}>
      <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
      <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        placeholder="Cari kelas, artikel, user…" className="input pl-9 py-2 text-sm bg-base-100/70 dark:bg-base-850 border-transparent focus:bg-white dark:focus:bg-base-900" />
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-11 card p-1.5 z-50 anim-scale">
          {results.length === 0 && <p className="px-3 py-4 text-center text-xs text-base-400">Tidak ada hasil untuk "{q}".</p>}
          {results.map((r, i) => (
            <button key={i} onClick={() => { nav(r.to); setQ(''); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-brand-500/10 transition-colors cursor-pointer">
              <span className="badge bg-base-100 dark:bg-base-800 text-base-400 shrink-0">{r.group}</span>
              <span className="truncate font-semibold text-base-700 dark:text-base-200">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const { user, logout, t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useClickOutside(ref, () => setOpen(false));
  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-base-200/70 dark:hover:bg-base-800 transition-colors cursor-pointer">
        <Avatar name={user.name} src={user.avatar} size={30} />
        <Icon name="chevron-down" size={13} className="text-base-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 card p-1.5 anim-scale">
          <div className="border-b border-base-200 dark:border-base-800 px-3 pb-2.5 pt-1.5">
            <p className="text-sm font-bold text-base-900 dark:text-base-50 truncate">{user.name}</p>
            <p className="truncate text-xs text-base-400">{user.email}</p>
            <Badge tone="brand"><span className="normal-case">{roleLabel(user.roleKey)}</span></Badge>
          </div>
          <button onClick={() => { nav('/dashboard/profile'); setOpen(false); }} className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold text-base-600 dark:text-base-300 hover:bg-base-100 dark:hover:bg-base-800 transition-colors cursor-pointer">
            <Icon name="user" size={15} /> {t('profile')}
          </button>
          <button onClick={() => { setOpen(false); logout(); nav('/'); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold text-danger-500 hover:bg-danger-500/10 transition-colors cursor-pointer">
            <Icon name="logout" size={15} /> {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
}

export function DashShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, t } = useApp();
  useDB();
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const loc = useLocation();
  if (!user) return null;
  const role = db.find('roles', (r) => r.key === user.roleKey);
  const groups = dashboardNav(user.roleKey, role?.permissions ?? []);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-base-200 dark:border-base-800 px-4">
        <Logo compact />
        <span className="font-display text-sm font-bold text-base-900 dark:text-base-50 truncate">{getSetting('site_name', 'KMSIT')}</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((g) => {
          const isCollapsed = collapsed[g.label];
          return (
            <div key={g.label || 'root'} className="mb-3">
              {g.label && (
                <button onClick={() => setCollapsed((c) => ({ ...c, [g.label]: !c[g.label] }))}
                  className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-base-400 hover:text-base-600 dark:hover:text-base-300 transition-colors cursor-pointer">
                  {g.label}
                  <Icon name="chevron-down" size={11} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
              )}
              {!isCollapsed && g.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileNav(false)}
                  className={({ isActive }) => `group mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-bold transition-all duration-150 ${isActive ? 'bg-brand-500/12 text-brand-700 dark:text-brand-400 shadow-[inset_2px_0_0_var(--color-brand-500)]' : 'text-base-500 dark:text-base-400 hover:bg-base-100 dark:hover:bg-base-850 hover:text-base-900 dark:hover:text-base-100'}`}>
                  <Icon name={item.icon} size={16} className="shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-base-200 dark:border-base-800 p-3">
        <div className="rounded-lg bg-gradient-to-br from-brand-500/12 to-brand-500/[0.03] border border-brand-500/20 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-600 dark:text-brand-400">{roleLabel(user.roleKey)}</p>
          <p className="mt-0.5 truncate text-xs font-bold text-base-800 dark:text-base-100">{user.name}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-base-50 dark:bg-base-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-base-200 dark:border-base-800 bg-white dark:bg-base-900 lg:block">{sidebar}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-base-950/60 backdrop-blur-sm anim-fade" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white dark:bg-base-900 border-r border-base-200 dark:border-base-800 anim-slide">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-base-200 dark:border-base-800 bg-white/85 dark:bg-base-925/85 backdrop-blur-md px-4 sm:px-6">
          <button className="lg:hidden p-1.5 -ml-1 text-base-500 hover:text-base-900 dark:hover:text-base-100 cursor-pointer" onClick={() => setMobileNav(true)} aria-label="Navigasi"><Icon name="menu" size={20} /></button>
          <div className="hidden sm:block min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-base-400">{t('dashboard')}</p>
            <p className="truncate font-display text-sm font-bold text-base-900 dark:text-base-50">{title ?? 'Dashboard'}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <GlobalSearchBox />
            <LangToggle />
            <ThemeToggle />
            <NotifBell />
            <span className="mx-1 h-6 w-px bg-base-200 dark:bg-base-700 hidden sm:block" />
            <ProfileMenu />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
