import { useEffect, type ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { db } from './lib/db';
import { can } from './lib/services';
import { AppProvider, useApp, useDB } from './state/store';
import { Icon } from './components/icons';
import { EmptyState } from './components/ui';
import { PublicShell } from './components/Shell';
import Installer from './pages/Installer';
import { LoginPage, RegisterPage, ForgotPage, ProfilePage } from './pages/Auth';
import { HomePage, ArticlesPage, ArticleDetail, NewsPage, NewsDetail, TutorialsPage, TutorialDetail, ActivitiesPage, ActivityDetail, PageView, AboutPage, ContactPage, ShopPage } from './pages/public/Public';
import { CoursesCatalog, CourseDetailPage, LearnPage, CheckoutPage } from './pages/public/Courses';
import { VerifyPage } from './pages/public/Certificates';
import Overview from './pages/dash/Overview';
import CoursesAdmin from './pages/dash/Courses';
import QuizzesAdmin from './pages/dash/Quizzes';
import { ContentModule, MODULES, CategoriesPage, MediaPage, CertificateTemplatesPage, CertificatesAdmin } from './pages/dash/Crud';
import { PeoplePage, MessagesPage } from './pages/dash/People';
import { OrdersPage, PaymentsPage, WalletPage, WithdrawalsPage } from './pages/dash/Commerce';
import { HomepageBuilder, MenusPage, AboutEditor } from './pages/dash/Cms';
import { SettingsGeneral, SettingsPayments, SettingsLanguage, SettingsSystem } from './pages/dash/Settings';
import { DashShell } from './components/Shell';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/** Jika aplikasi belum ter-install → semua route dialihkan ke /install (installer lock). */
function InstallGate({ children }: { children: ReactNode }) {
  useDB();
  const loc = useLocation();
  if (!db.meta().installed && loc.pathname !== '/install') return <Navigate to="/install" replace />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

/** Proteksi route berbasis permission — akses URL manual ditolak backend-style. */
function Guard({ anyOf, children }: { anyOf: string[]; children: ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  const ok = anyOf.some((p) => can(user, p));
  if (!ok) {
    return (
      <DashShell title="403">
        <div className="py-16">
          <EmptyState icon="shield" title="403 — Akses Ditolak"
            sub={`Role kamu tidak memiliki permission untuk halaman ini (${anyOf.join(' / ')}).`}
            action={<Link to="/dashboard" className="btn-primary">Kembali ke Dashboard</Link>} />
        </div>
      </DashShell>
    );
  }
  return <>{children}</>;
}

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

function DashProfile() {
  return <DashShell title="Profil"><ProfilePage /></DashShell>;
}

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

            {/* public website */}
            <Route path="/" element={<HomePage />} />
            <Route path="/courses" element={<CoursesCatalog />} />
            <Route path="/courses/:slug" element={<CourseDetailPage />} />
            <Route path="/learn/:slug" element={<LearnPage />} />
            <Route path="/checkout/:orderId" element={<CheckoutPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:slug" element={<ArticleDetail />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/news/:slug" element={<NewsDetail />} />
            <Route path="/tutorials" element={<TutorialsPage />} />
            <Route path="/tutorials/:slug" element={<TutorialDetail />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/activities/:slug" element={<ActivityDetail />} />
            <Route path="/page/:slug" element={<PageView />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/certificate/verify" element={<VerifyPage />} />
            <Route path="/certificate/verify/:number" element={<VerifyPage />} />

            {/* dashboard — role-based */}
            <Route path="/dashboard" element={<RequireAuth><Overview /></RequireAuth>} />
            <Route path="/dashboard/profile" element={<RequireAuth><DashProfile /></RequireAuth>} />
            <Route path="/dashboard/my-learning" element={<RequireAuth><Navigate to="/dashboard" replace /></RequireAuth>} />

            <Route path="/dashboard/courses" element={<RequireAuth><Guard anyOf={['manage_courses', 'instructor_courses']}><CoursesAdmin /></Guard></RequireAuth>} />
            <Route path="/dashboard/categories" element={<RequireAuth><Guard anyOf={['manage_categories']}><CategoriesPage /></Guard></RequireAuth>} />
            <Route path="/dashboard/quizzes" element={<RequireAuth><Guard anyOf={['manage_quizzes', 'instructor_quizzes']}><QuizzesAdmin /></Guard></RequireAuth>} />
            <Route path="/dashboard/certificates" element={<RequireAuth><Guard anyOf={['manage_certificates', 'instructor_certificates', 'student_certificates']}><CertificatesAdmin /></Guard></RequireAuth>} />

            <Route path="/dashboard/articles" element={<RequireAuth><Guard anyOf={['manage_articles']}><ContentModule def={MODULES.articles} /></Guard></RequireAuth>} />
            <Route path="/dashboard/news" element={<RequireAuth><Guard anyOf={['manage_news']}><ContentModule def={MODULES.news} /></Guard></RequireAuth>} />
            <Route path="/dashboard/tutorials" element={<RequireAuth><Guard anyOf={['manage_tutorials']}><ContentModule def={MODULES.tutorials} /></Guard></RequireAuth>} />
            <Route path="/dashboard/activities" element={<RequireAuth><Guard anyOf={['manage_activities']}><ContentModule def={MODULES.activities} /></Guard></RequireAuth>} />
            <Route path="/dashboard/pages" element={<RequireAuth><Guard anyOf={['manage_pages']}><ContentModule def={MODULES.pages} /></Guard></RequireAuth>} />
            <Route path="/dashboard/media" element={<RequireAuth><Guard anyOf={['manage_media']}><MediaPage /></Guard></RequireAuth>} />

            <Route path="/dashboard/students" element={<RequireAuth><Guard anyOf={['manage_students', 'instructor_students']}><PeoplePage role="student" /></Guard></RequireAuth>} />
            <Route path="/dashboard/instructors" element={<RequireAuth><Guard anyOf={['manage_instructors']}><PeoplePage role="instructor" /></Guard></RequireAuth>} />
            <Route path="/dashboard/users" element={<RequireAuth><Guard anyOf={['*']}><PeoplePage role="all" /></Guard></RequireAuth>} />
            <Route path="/dashboard/admins" element={<RequireAuth><Guard anyOf={['*']}><PeoplePage role="admin" /></Guard></RequireAuth>} />
            <Route path="/dashboard/messages" element={<RequireAuth><Guard anyOf={['view_messages']}><MessagesPage /></Guard></RequireAuth>} />

            <Route path="/dashboard/orders" element={<RequireAuth><OrdersRoute /></RequireAuth>} />
            <Route path="/dashboard/payments" element={<RequireAuth><Guard anyOf={['view_payments']}><PaymentsPage /></Guard></RequireAuth>} />
            <Route path="/dashboard/wallet" element={<RequireAuth><Guard anyOf={['instructor_wallet']}><WalletPage /></Guard></RequireAuth>} />
            <Route path="/dashboard/withdrawals" element={<RequireAuth><Guard anyOf={['process_withdrawals', 'instructor_withdrawals']}><WithdrawalsPage /></Guard></RequireAuth>} />
            <Route path="/dashboard/products" element={<RequireAuth><Guard anyOf={['manage_shop']}><ContentModule def={MODULES.products} /></Guard></RequireAuth>} />

            <Route path="/dashboard/homepage" element={<RequireAuth><Guard anyOf={['manage_homepage']}><HomepageBuilder /></Guard></RequireAuth>} />
            <Route path="/dashboard/menus" element={<RequireAuth><Guard anyOf={['manage_menus']}><MenusPage /></Guard></RequireAuth>} />
            <Route path="/dashboard/about" element={<RequireAuth><Guard anyOf={['manage_about']}><AboutEditor /></Guard></RequireAuth>} />

            <Route path="/dashboard/settings" element={<RequireAuth><Guard anyOf={['*']}><SettingsGeneral /></Guard></RequireAuth>} />
            <Route path="/dashboard/settings-payments" element={<RequireAuth><Guard anyOf={['*']}><SettingsPayments /></Guard></RequireAuth>} />
            <Route path="/dashboard/settings-language" element={<RequireAuth><Guard anyOf={['*']}><SettingsLanguage /></Guard></RequireAuth>} />
            <Route path="/dashboard/settings-system" element={<RequireAuth><Guard anyOf={['*']}><SettingsSystem /></Guard></RequireAuth>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </InstallGate>
      </HashRouter>
    </AppProvider>
  );
}

function OrdersRoute() {
  const { user } = useApp();
  if (!user) return null;
  if (user.roleKey === 'student') return <OrdersPage own />;
  return <Guard anyOf={['manage_orders', 'instructor_wallet']}><OrdersPage /></Guard>;
}
