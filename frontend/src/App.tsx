import React, { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { api } from './lib/api';
import { canAccessRoute } from './lib/menu';
import { AppProvider, useApp } from './state/store';
import { Icon } from './components/icons';
import { EmptyState } from './components/ui';
import { PublicShell } from './components/Shell';
import Installer from './pages/Installer';
import { LoginPage, RegisterPage, ForgotPage, ProfilePage, ResetPasswordPage } from './pages/Auth';
import { DashShell } from './components/Shell';

/* ---------- Wrapper untuk halaman yang butuh MODULES (Crud) ---------- */

/**
 * Mengambil MODULES dari kode yang di-lazy-load hanya setelah
 * chunk tersebut selesai di-fetch & di-evaluate. Tanpa ini,
 * static `def={MODULES.xxx}` memaksa seluruh kode Crud masuk ke
 * main bundle karena eager evaluation pada waktu kompilasi.
 */
function ModuleContentRoute({ moduleKey }: { moduleKey: string }) {
  const [def, setDef] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    import('./pages/dash/Crud').then(
      (m) => { if (active) setDef(m.MODULES[moduleKey]); },
      (err) => { if (active) setError(err?.message || 'Gagal memuat modul konten'); }
    );
    return () => { active = false; };
  }, [moduleKey]);
  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
        <div>
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warn-500/10 text-warn-600">
            <Icon name="alert-triangle" size={22} />
          </span>
          <p className="font-display text-base font-bold text-base-900 dark:text-base-50">Gagal memuat modul</p>
          <p className="mt-1 text-sm text-base-500">{error}</p>
          <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Muat Ulang</button>
        </div>
      </div>
    );
  }
  if (def === null) return <LoadingFallback title="Modul dimuat..." />;
  return <LazyRoute element={<ContentModule def={def as any} />} loading="Konten dimuat..." />;
}

/* ---------- ScrollToTop ---------- */

function ScrollTop() {
  const { pathname } = useLocation();
  return null;
}

/* ---------- Shared Suspense fallback ---------- */

function LoadingFallback({ title }: { title?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
      <div>
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
          <Icon name="refresh" size={22} />
        </span>
        <p className="font-display text-sm font-bold text-base-500">{title ?? 'Memuat...'}</p>
      </div>
    </div>
  );
}

/**
 * ErrorBoundary ringan yang mendeteksi apakah error berasal dari
 * gagal memuat chunk lazy (ModuleBuildError / chunk load) atau
 * error render biasa. Menampilkan pesan dan tombol Muat ulang.
 * Tidak membuat retry loop otomatis — user harus klik manual.
 */
class ChunkErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; isChunkError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }
  static getDerivedStateFromError(error: Error) {
    // Deteksi error dari failed chunk import vs error render biasa
    const isChunkError =
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Cannot read properties of undefined') && error.stack?.includes('Lazy');
    return { hasError: true, isChunkError };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
          <div>
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warn-500/10 text-warn-600">
              <Icon name="alert-triangle" size={22} />
            </span>
            <p className="font-display text-base font-bold text-base-900 dark:text-base-50">
              {this.state.isChunkError ? 'Gagal memuat halaman' : 'Terjadi kesalahan'}
            </p>
            <p className="mt-1 max-w-xs text-sm text-base-500 mx-auto">
              {this.state.isChunkError
                ? 'Koneksi terputus saat memuat resource. Muat ulang untuk mencoba lagi.'
                : 'Ada yang salah saat merender halaman ini.'}
            </p>
            <button
              className="btn-primary mt-4"
              onClick={() => window.location.reload()}
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- InstallGate ---------- */

function InstallGate({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <Suspense fallback={<LoadingFallback title="Mengecek status instalasi..." />}>
      <InstallGateInner loc={loc} children={children} />
    </Suspense>
  );
}

function InstallGateInner({ loc, children }: { loc: ReturnType<typeof useLocation>; children: ReactNode }) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);

  useEffect(() => {
    const markInstalled = () => setInstalled(true);
    window.addEventListener('kmsit-installed', markInstalled);
    void api.installStatus()
      .then((status) => { setInstalled((current) => current || status.installed); setCheckFailed(false); })
      .catch(() => setCheckFailed(true));
    return () => window.removeEventListener('kmsit-installed', markInstalled);
  }, []);

  if (installed === null) {
    if (checkFailed) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4 text-center">
          <div>
            <p className="font-display text-lg font-bold text-base-900 dark:text-base-50">Tidak dapat menghubungi server</p>
            <p className="mt-1 text-sm text-base-500 dark:text-base-400">Periksa koneksi database/server, lalu muat ulang halaman.</p>
            <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Muat Ulang</button>
          </div>
        </div>
      );
    }
    return <LoadingFallback title="Memeriksa status instalasi..." />;
  }
  if (!installed && loc.pathname !== '/install') return <Navigate to="/install" replace />;
  return <>{children}</>;
}

/* ---------- Auth guards ---------- */

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

/** Dashboard route guard derived from the same menu config that builds the sidebar. */
function RouteGuard({ route, children }: { route: string; children: ReactNode }) {
  const { user, t } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessRoute(user, route)) {
    return (
      <DashShell title="403">
        <div className="py-16">
          <EmptyState icon="shield" title={`403 — ${t('state_forbidden')}`} sub={t('state_forbidden_sub')}
            action={<Link to="/dashboard" className="btn-primary">{t('dashboard')}</Link>} />
        </div>
      </DashShell>
    );
  }
  return <>{children}</>;
}

/** Authenticated + menu-authorized lazy dashboard page. */
function Dash({ route, children, loading }: { route: string; children: ReactNode; loading?: string }) {
  return <RequireAuth><RouteGuard route={route}><LazyRoute element={children} loading={loading} /></RouteGuard></RequireAuth>;
}

/* ---------- NotFound ---------- */

function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-500">Error 404</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-base-900 dark:text-base-50">Halaman Tidak Ditemukan</h1>
        <p className="mt-2 text-sm text-base-500">URL yang kamu tuju tidak tersedia.</p>
        <Link to="/" className="btn-primary mt-6 inline-flex"><Icon name="home" size={15} /> Ke Beranda</Link>
      </div>
    </PublicShell>
  );
}

/* ---------- Lazy wrappers ---------- */

function LazyRoute({ element, loading }: { element: ReactNode; loading?: string }) {
  return (
    <Suspense fallback={<LoadingFallback title={loading} />}>
      <ChunkErrorBoundary>{element}</ChunkErrorBoundary>
    </Suspense>
  );
}

/* ---------- Lazy page imports ---------- */

const HomePage = lazy(() => import('./pages/public/Public').then(m => ({ default: m.HomePage })));
const CoursesCatalog = lazy(() => import('./pages/public/Courses').then(m => ({ default: m.CoursesCatalog })));
const CourseDetailPage = lazy(() => import('./pages/public/Courses').then(m => ({ default: m.CourseDetailPage })));
const LearnPage = lazy(() => import('./pages/public/Courses').then(m => ({ default: m.LearnPage })));
const CheckoutPage = lazy(() => import('./pages/public/Courses').then(m => ({ default: m.CheckoutPage })));
const ArticlesPage = lazy(() => import('./pages/public/Public').then(m => ({ default: m.ArticlesPage })));
const ArticleDetail = lazy(() => import('./pages/public/Public').then(m => ({ default: m.ArticleDetail })));
const NewsPage = lazy(() => import('./pages/public/Public').then(m => ({ default: m.NewsPage })));
const NewsDetail = lazy(() => import('./pages/public/Public').then(m => ({ default: m.NewsDetail })));
const TutorialsPage = lazy(() => import('./pages/public/Public').then(m => ({ default: m.TutorialsPage })));
const TutorialDetail = lazy(() => import('./pages/public/Public').then(m => ({ default: m.TutorialDetail })));
const ActivitiesPage = lazy(() => import('./pages/public/Public').then(m => ({ default: m.ActivitiesPage })));
const ActivityDetail = lazy(() => import('./pages/public/Public').then(m => ({ default: m.ActivityDetail })));
const PageView = lazy(() => import('./pages/public/Public').then(m => ({ default: m.PageView })));
const AboutPage = lazy(() => import('./pages/public/Public').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./pages/public/Public').then(m => ({ default: m.ContactPage })));
const ShopPage = lazy(() => import('./pages/public/Public').then(m => ({ default: m.ShopPage })));
const VerifyPage = lazy(() => import('./pages/public/Certificates').then(m => ({ default: m.VerifyPage })));

const Overview = lazy(() => import('./pages/dash/Overview').then(m => ({ default: m.default })));
const CoursesAdmin = lazy(() => import('./pages/dash/Courses').then(m => ({ default: m.default })));
const QuizzesAdmin = lazy(() => import('./pages/dash/Quizzes').then(m => ({ default: m.default })));
const ContentModule = lazy(() => import('./pages/dash/Crud').then(m => ({ default: m.ContentModule })));
const CategoriesPage = lazy(() => import('./pages/dash/Crud').then(m => ({ default: m.CategoriesPage })));
const MediaPage = lazy(() => import('./pages/dash/Crud').then(m => ({ default: m.MediaPage })));
const CertificateTemplatesPage = lazy(() => import('./pages/dash/Crud').then(m => ({ default: m.CertificateTemplatesPage })));
const CertificatesAdmin = lazy(() => import('./pages/dash/Crud').then(m => ({ default: m.CertificatesAdmin })));
const PeoplePage = lazy(() => import('./pages/dash/People').then(m => ({ default: m.PeoplePage })));
const MessagesPage = lazy(() => import('./pages/dash/People').then(m => ({ default: m.MessagesPage })));
const OrdersPage = lazy(() => import('./pages/dash/Commerce').then(m => ({ default: m.OrdersPage })));
const PaymentsPage = lazy(() => import('./pages/dash/Commerce').then(m => ({ default: m.PaymentsPage })));
const WalletPage = lazy(() => import('./pages/dash/Commerce').then(m => ({ default: m.WalletPage })));
const WithdrawalsPage = lazy(() => import('./pages/dash/Commerce').then(m => ({ default: m.WithdrawalsPage })));
const MyDigitalPage = lazy(() => import('./pages/dash/Commerce').then(m => ({ default: m.MyDigitalPage })));
const VouchersPage = lazy(() => import('./pages/dash/Vouchers').then(m => ({ default: m.default })));
const HomepageBuilder = lazy(() => import('./pages/dash/Cms').then(m => ({ default: m.HomepageBuilder })));
const MenusPage = lazy(() => import('./pages/dash/Cms').then(m => ({ default: m.MenusPage })));
const AboutEditor = lazy(() => import('./pages/dash/Cms').then(m => ({ default: m.AboutEditor })));
const SettingsGeneral = lazy(() => import('./pages/dash/Settings').then(m => ({ default: m.SettingsGeneral })));
const SettingsPayments = lazy(() => import('./pages/dash/Settings').then(m => ({ default: m.SettingsPayments })));
const SettingsIntegrations = lazy(() => import('./pages/dash/Settings').then(m => ({ default: m.SettingsIntegrations })));
const SettingsLanguage = lazy(() => import('./pages/dash/Settings').then(m => ({ default: m.SettingsLanguage })));
const SettingsSystem = lazy(() => import('./pages/dash/Settings').then(m => ({ default: m.SettingsSystem })));
const SettingsTheme = lazy(() => import('./pages/dash/SettingsTheme').then(m => ({ default: m.SettingsTheme })));
const InstructorStudentsPage = lazy(() => import('./pages/dash/Instructor').then(m => ({ default: m.InstructorStudentsPage })));
const InstructorSalesPage = lazy(() => import('./pages/dash/Instructor').then(m => ({ default: m.InstructorSalesPage })));
const InstructorQuizResultsPage = lazy(() => import('./pages/dash/Instructor').then(m => ({ default: m.InstructorQuizResultsPage })));
const MyLearningPage = lazy(() => import('./pages/dash/Learner').then(m => ({ default: m.MyLearningPage })));
const MyQuizzesPage = lazy(() => import('./pages/dash/Learner').then(m => ({ default: m.MyQuizzesPage })));
const NotificationsPage = lazy(() => import('./pages/dash/Learner').then(m => ({ default: m.NotificationsPage })));
const OperationsPage = lazy(() => import('./pages/dash/Operations').then(m => ({ default: m.OperationsPage })));

function DashProfile() {
  return <LazyRoute element={<DashShell title="Profil"><ProfilePage /></DashShell>} loading="Profil dimuat..." />;
}

/** Same URL, role-specific data: students see their own orders, staff with manage_orders see all. */
function OrdersRoute() {
  const { user } = useApp();
  if (!user) return null;
  return <OrdersPage own={user.roleKey === 'student'} />;
}

/** Same URL, role-specific data source: instructors only ever hit /instructor/students. */
function StudentsRoute() {
  const { user } = useApp();
  if (!user) return null;
  return user.roleKey === 'instructor' ? <InstructorStudentsPage /> : <PeoplePage role="student" />;
}

/* ---------- Main App ---------- */

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <ScrollTop />
        <InstallGate>
          <Routes>
            {/* installer */}
            <Route path="/install" element={<Installer />} />

            {/* auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot" element={<ForgotPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* public website */}
            <Route path="/" element={<LazyRoute element={<HomePage />} loading="Beranda dimuat..." />} />
            <Route path="/courses" element={<LazyRoute element={<CoursesCatalog />} loading="Katalog kelas dimuat..." />} />
            <Route path="/courses/:slug" element={<LazyRoute element={<CourseDetailPage />} loading="Detail kelas dimuat..." />} />
            <Route path="/learn/:slug" element={<LazyRoute element={<LearnPage />} loading="Halaman belajar dimuat..." />} />
            <Route path="/checkout/:orderId" element={<LazyRoute element={<CheckoutPage />} loading="Checkout dimuat..." />} />
            <Route path="/articles" element={<LazyRoute element={<ArticlesPage />} loading="Artikel dimuat..." />} />
            <Route path="/articles/:slug" element={<LazyRoute element={<ArticleDetail />} loading="Artikel dimuat..." />} />
            <Route path="/news" element={<LazyRoute element={<NewsPage />} loading="Berita dimuat..." />} />
            <Route path="/news/:slug" element={<LazyRoute element={<NewsDetail />} loading="Berita dimuat..." />} />
            <Route path="/tutorials" element={<LazyRoute element={<TutorialsPage />} loading="Tutorial dimuat..." />} />
            <Route path="/tutorials/:slug" element={<LazyRoute element={<TutorialDetail />} loading="Tutorial dimuat..." />} />
            <Route path="/activities" element={<LazyRoute element={<ActivitiesPage />} loading="Kegiatan dimuat..." />} />
            <Route path="/activities/:slug" element={<LazyRoute element={<ActivityDetail />} loading="Kegiatan dimuat..." />} />
            <Route path="/page/:slug" element={<LazyRoute element={<PageView />} loading="Halaman dimuat..." />} />
            <Route path="/about" element={<LazyRoute element={<AboutPage />} loading="Halaman dimuat..." />} />
            <Route path="/contact" element={<LazyRoute element={<ContactPage />} loading="Kontak dimuat..." />} />
            <Route path="/shop" element={<LazyRoute element={<ShopPage />} loading="Toko dimuat..." />} />
            <Route path="/certificate/verify" element={<LazyRoute element={<VerifyPage />} loading="Verifikasi sertifikat dimuat..." />} />
            <Route path="/certificate/verify/:number" element={<LazyRoute element={<VerifyPage />} loading="Verifikasi sertifikat dimuat..." />} />

            {/* dashboard — role-based */}
            <Route path="/dashboard" element={<LazyRoute element={<RequireAuth><Overview /></RequireAuth>} loading="Dashboard dimuat..." />} />
            <Route path="/dashboard/profile" element={<RequireAuth><DashProfile /></RequireAuth>} />
            <Route path="/dashboard/notifications" element={<Dash route="/dashboard/notifications"><NotificationsPage /></Dash>} />

            {/* student */}
            <Route path="/dashboard/my-learning" element={<Dash route="/dashboard/my-learning"><MyLearningPage /></Dash>} />
            <Route path="/dashboard/my-quizzes" element={<Dash route="/dashboard/my-quizzes"><MyQuizzesPage /></Dash>} />
            <Route path="/dashboard/digital" element={<Dash route="/dashboard/digital"><MyDigitalPage /></Dash>} />
            <Route path="/dashboard/orders" element={<Dash route="/dashboard/orders"><OrdersRoute /></Dash>} />
            <Route path="/dashboard/certificates" element={<Dash route="/dashboard/certificates"><CertificatesAdmin /></Dash>} />
            <Route path="/dashboard/certificate-templates" element={<Dash route="/dashboard/certificate-templates"><CertificateTemplatesPage /></Dash>} />

            {/* instructor & academic */}
            <Route path="/dashboard/courses" element={<Dash route="/dashboard/courses" loading="Kelas dimuat..."><CoursesAdmin /></Dash>} />
            <Route path="/dashboard/students" element={<Dash route="/dashboard/students"><StudentsRoute /></Dash>} />
            <Route path="/dashboard/quizzes" element={<Dash route="/dashboard/quizzes"><QuizzesAdmin /></Dash>} />
            <Route path="/dashboard/quiz-results" element={<Dash route="/dashboard/quiz-results"><InstructorQuizResultsPage /></Dash>} />
            <Route path="/dashboard/sales" element={<Dash route="/dashboard/sales"><InstructorSalesPage /></Dash>} />
            <Route path="/dashboard/wallet" element={<Dash route="/dashboard/wallet"><WalletPage /></Dash>} />
            <Route path="/dashboard/withdrawals" element={<Dash route="/dashboard/withdrawals"><WithdrawalsPage /></Dash>} />
            <Route path="/dashboard/categories" element={<Dash route="/dashboard/categories"><CategoriesPage /></Dash>} />

            {/* content */}
            <Route path="/dashboard/articles" element={<RequireAuth><RouteGuard route="/dashboard/articles"><ModuleContentRoute moduleKey="articles" /></RouteGuard></RequireAuth>} />
            <Route path="/dashboard/news" element={<RequireAuth><RouteGuard route="/dashboard/news"><ModuleContentRoute moduleKey="news" /></RouteGuard></RequireAuth>} />
            <Route path="/dashboard/tutorials" element={<RequireAuth><RouteGuard route="/dashboard/tutorials"><ModuleContentRoute moduleKey="tutorials" /></RouteGuard></RequireAuth>} />
            <Route path="/dashboard/activities" element={<RequireAuth><RouteGuard route="/dashboard/activities"><ModuleContentRoute moduleKey="activities" /></RouteGuard></RequireAuth>} />
            <Route path="/dashboard/pages" element={<RequireAuth><RouteGuard route="/dashboard/pages"><ModuleContentRoute moduleKey="pages" /></RouteGuard></RequireAuth>} />
            <Route path="/dashboard/products" element={<RequireAuth><RouteGuard route="/dashboard/products"><ModuleContentRoute moduleKey="products" /></RouteGuard></RequireAuth>} />
            <Route path="/dashboard/media" element={<Dash route="/dashboard/media"><MediaPage /></Dash>} />

            {/* commerce & people */}
            <Route path="/dashboard/payments" element={<Dash route="/dashboard/payments"><PaymentsPage /></Dash>} />
            <Route path="/dashboard/vouchers" element={<Dash route="/dashboard/vouchers"><VouchersPage /></Dash>} />
            <Route path="/dashboard/instructors" element={<Dash route="/dashboard/instructors"><PeoplePage role="instructor" /></Dash>} />
            <Route path="/dashboard/users" element={<Dash route="/dashboard/users"><PeoplePage role="all" /></Dash>} />
            <Route path="/dashboard/admins" element={<Dash route="/dashboard/admins"><PeoplePage role="admin" /></Dash>} />
            <Route path="/dashboard/messages" element={<Dash route="/dashboard/messages"><MessagesPage /></Dash>} />

            {/* website */}
            <Route path="/dashboard/homepage" element={<Dash route="/dashboard/homepage"><HomepageBuilder /></Dash>} />
            <Route path="/dashboard/menus" element={<Dash route="/dashboard/menus"><MenusPage /></Dash>} />
            <Route path="/dashboard/about" element={<Dash route="/dashboard/about"><AboutEditor /></Dash>} />

            {/* platform */}
            <Route path="/dashboard/operations" element={<Dash route="/dashboard/operations"><OperationsPage /></Dash>} />
            <Route path="/dashboard/settings" element={<Dash route="/dashboard/settings"><SettingsGeneral /></Dash>} />
            <Route path="/dashboard/settings-theme" element={<Dash route="/dashboard/settings-theme"><SettingsTheme /></Dash>} />
            <Route path="/dashboard/settings-payments" element={<Dash route="/dashboard/settings-payments"><SettingsPayments /></Dash>} />
            <Route path="/dashboard/integrations" element={<Dash route="/dashboard/integrations"><SettingsIntegrations /></Dash>} />
            <Route path="/dashboard/settings-language" element={<Dash route="/dashboard/settings-language"><SettingsLanguage /></Dash>} />
            <Route path="/dashboard/settings-system" element={<Dash route="/dashboard/settings-system"><SettingsSystem /></Dash>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </InstallGate>
      </HashRouter>
    </AppProvider>
  );
}
