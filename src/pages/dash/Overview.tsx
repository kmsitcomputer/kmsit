import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import { fmtMoney, fmtDate, timeAgo } from '../../lib/services';
import { CourseService, EnrollmentService, ProgressService, QuizService } from '../../lib/lms';
import { OrderService, WalletService, WithdrawalService } from '../../lib/commerce';
import { useApp, useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import { Avatar, Badge, BarChart, Donut, PageHeader, SafeImg, StatCard, StatusBadge } from '../../components/ui';
import { DashShell } from '../../components/Shell';

function last7Revenue(userId?: string): { label: string; value: number }[] {
  const days: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const next = d.getTime() + 86400000;
    const payments = db.where('payments', (p) => p.status === 'paid' && p.createdAt >= d.getTime() && p.createdAt < next)
      .filter((p) => {
        if (!userId) return true;
        const order = OrderService.byId(p.orderId);
        return order?.items.some((it) => it.instructorId === userId) ?? false;
      });
    days.push({ label: d.toLocaleDateString('id-ID', { weekday: 'short' }), value: payments.reduce((a, p) => a + p.amount, 0) });
  }
  return days;
}

function AdminOverview() {
  const users = db.all('users');
  const paidOrders = db.where('orders', (o) => o.status === 'paid');
  const revenue = paidOrders.reduce((a, o) => a + o.total, 0);
  const platformRevenue = db.where('walletTx', (t) => t.type === 'earning').reduce((a, t) => a + t.platformFee, 0);
  const instructorRevenue = db.where('walletTx', (t) => t.type === 'earning' && t.status === 'completed').reduce((a, t) => a + t.amount, 0);
  const pendingWd = WithdrawalService.list().filter((w) => w.status === 'pending');
  const pendingCourses = db.where('courses', (c) => c.status === 'pending');
  const pendingInstructors = db.where('users', (u) => u.roleKey === 'instructor' && !u.instructorApproved);
  const recentOrders = OrderService.list().slice(0, 6);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="users" label="Total Users" value={users.length} sub={`${users.filter((u) => u.roleKey === 'student').length} student · ${users.filter((u) => u.roleKey === 'instructor').length} instructor`} delay={0} />
        <StatCard icon="book" label="Kelas" value={db.count('courses')} sub={`${db.count('courses', (c) => c.status === 'published')} terbit · ${pendingCourses.length} pending`} tone="info" delay={50} />
        <StatCard icon="receipt" label="Total Order" value={db.count('orders')} sub={`${paidOrders.length} lunas`} tone="accent" delay={100} />
        <StatCard icon="wallet" label="Total Revenue" value={fmtMoney(revenue)} sub={`Platform ${fmtMoney(platformRevenue)}`} tone="ok" delay={150} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2 anim-rise">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Pendapatan 7 Hari</h2>
            <Badge tone="brand">semua gateway</Badge>
          </div>
          <BarChart data={last7Revenue()} />
        </div>
        <div className="space-y-5">
          <div className="card p-5 anim-rise" style={{ animationDelay: '80ms' }}>
            <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Butuh Tindakan</h2>
            <div className="space-y-2">
              {pendingCourses.length > 0 && (
                <Link to="/dashboard/courses?status=pending" className="flex items-center gap-3 rounded-lg border border-warn-400/30 bg-warn-400/[0.08] px-3 py-2.5 transition-colors hover:bg-warn-400/15">
                  <Icon name="book" size={16} className="text-accent-500" />
                  <span className="flex-1 text-sm font-bold text-base-800 dark:text-base-100">{pendingCourses.length} kelas menunggu review</span>
                  <Icon name="chevron-right" size={14} className="text-base-400" />
                </Link>
              )}
              {pendingInstructors.length > 0 && (
                <Link to="/dashboard/instructors" className="flex items-center gap-3 rounded-lg border border-info-400/30 bg-info-400/[0.08] px-3 py-2.5 transition-colors hover:bg-info-400/15">
                  <Icon name="user-check" size={16} className="text-info-400" />
                  <span className="flex-1 text-sm font-bold text-base-800 dark:text-base-100">{pendingInstructors.length} instructor menunggu approval</span>
                  <Icon name="chevron-right" size={14} className="text-base-400" />
                </Link>
              )}
              {pendingWd.length > 0 && (
                <Link to="/dashboard/withdrawals" className="flex items-center gap-3 rounded-lg border border-danger-500/30 bg-danger-500/[0.07] px-3 py-2.5 transition-colors hover:bg-danger-500/15">
                  <Icon name="banknote" size={16} className="text-danger-500" />
                  <span className="flex-1 text-sm font-bold text-base-800 dark:text-base-100">{pendingWd.length} withdrawal menunggu</span>
                  <Icon name="chevron-right" size={14} className="text-base-400" />
                </Link>
              )}
              {pendingCourses.length === 0 && pendingInstructors.length === 0 && pendingWd.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-base-400"><Icon name="check-circle" size={16} className="text-ok-500" /> Semua terkendali.</p>
              )}
            </div>
          </div>
          <div className="card p-5 anim-rise" style={{ animationDelay: '140ms' }}>
            <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Statistik Konten</h2>
            {[
              ['Artikel', db.count('articles')], ['Berita', db.count('news')], ['Tutorial', db.count('tutorials')],
              ['Kegiatan', db.count('activities')], ['Sertifikat', db.count('certificates')],
            ].map(([l, v]) => (
              <div key={l as string} className="flex items-center justify-between border-b border-base-100 dark:border-base-800 py-1.5 text-sm last:border-0">
                <span className="text-base-500">{l}</span><span className="font-mono font-bold text-base-800 dark:text-base-100">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 card overflow-hidden anim-rise">
        <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-5 py-3.5">
          <h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Order Terbaru</h2>
          <Link to="/dashboard/orders" className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">Lihat semua</Link>
        </div>
        {recentOrders.length === 0 ? <p className="px-5 py-8 text-center text-sm text-base-400">Belum ada order.</p> : (
          <table className="w-full">
            <thead className="bg-base-100/60 dark:bg-base-850"><tr><th className="th">Order</th><th className="th">User</th><th className="th">Tipe</th><th className="th">Total</th><th className="th">Status</th></tr></thead>
            <tbody>
              {recentOrders.map((o) => {
                const buyer = db.byId('users', o.userId);
                return (
                  <tr key={o.id} className="hover:bg-brand-500/[0.04]">
                    <td className="td font-mono text-xs">{o.items[0]?.title ?? '—'}</td>
                    <td className="td"><span className="flex items-center gap-2"><Avatar name={buyer?.name ?? '?'} size={22} />{buyer?.name ?? '—'}</span></td>
                    <td className="td"><Badge tone={o.type === 'course' ? 'brand' : 'accent'}>{o.type}</Badge></td>
                    <td className="td font-display font-bold">{fmtMoney(o.total)}</td>
                    <td className="td"><StatusBadge status={o.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function InstructorOverview() {
  const { user } = useApp();
  if (!user) return null;
  const myCourses = CourseService.ofInstructor(user.id);
  const myStudents = db.where('enrollments', (e) => myCourses.some((c) => c.id === e.courseId));
  const s = WalletService.summary(user.id);
  const myQuizzes = QuizService.ofInstructor(user.id);
  const certs = db.where('certificates', (c) => myCourses.some((m) => m.id === c.courseId));
  const recentEnrolls = myStudents.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  return (
    <>
      {!user.instructorApproved && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-warn-400/30 bg-warn-400/[0.08] px-4 py-3 anim-rise">
          <Icon name="alert-triangle" size={18} className="text-accent-500" />
          <p className="text-sm font-semibold text-base-700 dark:text-base-200">Akun instructor-mu masih menunggu approval admin. Kamu tetap bisa membuat kelas (status draft) dan mengajukannya untuk review.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="book" label="Kelas Saya" value={myCourses.length} sub={`${myCourses.filter((c) => c.status === 'published').length} terbit`} delay={0} />
        <StatCard icon="users" label="Students" value={myStudents.length} sub="total enrollment" tone="info" delay={50} />
        <StatCard icon="chart" label="Total Pendapatan" value={fmtMoney(s.totalEarning)} sub={`gross ${fmtMoney(s.totalGross)}`} tone="ok" delay={100} />
        <StatCard icon="wallet" label="Saldo" value={fmtMoney(s.balance)} sub={`withdrawable ${fmtMoney(s.withdrawable)}`} tone="accent" delay={150} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2 anim-rise">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Pendapatan 7 Hari</h2>
            <Badge tone="brand">fee platform {db.settings().platform_fee_percent ?? 15}%</Badge>
          </div>
          <BarChart data={last7Revenue(user.id)} />
        </div>
        <div className="card p-5 anim-rise" style={{ animationDelay: '80ms' }}>
          <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Ringkasan</h2>
          {[['Quiz dibuat', myQuizzes.length], ['Sertifikat terbit', certs.length], ['Withdrawal selesai', s.completedWd], ['Menunggu withdrawal', s.pendingWd]].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between border-b border-base-100 dark:border-base-800 py-2 text-sm last:border-0">
              <span className="text-base-500">{l}</span><span className="font-mono font-bold text-base-800 dark:text-base-100">{typeof v === 'number' && l === 'Menunggu withdrawal' ? fmtMoney(v) : v}</span>
            </div>
          ))}
          <Link to="/dashboard/wallet" className="btn-outline btn-sm mt-4 w-full"><Icon name="wallet" size={13} /> Kelola Dompet</Link>
        </div>
      </div>
      <div className="mt-5 card overflow-hidden anim-rise">
        <div className="border-b border-base-200 dark:border-base-800 px-5 py-3.5"><h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Student Terbaru</h2></div>
        {recentEnrolls.length === 0 ? <p className="px-5 py-8 text-center text-sm text-base-400">Belum ada student.</p> : (
          <ul>
            {recentEnrolls.map((e) => {
              const u = db.byId('users', e.userId); const c = CourseService.byId(e.courseId);
              return (
                <li key={e.id} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800 px-5 py-3 last:border-0">
                  <Avatar name={u?.name ?? '?'} src={u?.avatar} size={32} />
                  <div className="flex-1 min-w-0"><p className="truncate text-sm font-bold text-base-800 dark:text-base-100">{u?.name}</p><p className="truncate text-xs text-base-400">{c?.title}</p></div>
                  <span className="font-mono text-[10px] text-base-400">{timeAgo(e.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function StudentOverview() {
  const { user } = useApp();
  if (!user) return null;
  const enrolls = EnrollmentService.mine(user.id);
  const withCourse = enrolls.map((e) => ({ e, course: CourseService.byId(e.courseId) })).filter((x) => x.course);
  const completed = withCourse.filter(({ e }) => e.completedAt);
  const myCerts = db.where('certificates', (c) => c.userId === user.id);
  const myAttempts = db.where('quizAttempts', (a) => a.userId === user.id && a.status === 'submitted');
  const inProgress = withCourse.filter(({ e }) => !e.completedAt).sort((a, b) => b.e.updatedAt - a.e.updatedAt);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="book" label="Kelas Diikuti" value={enrolls.length} sub={`${completed.length} selesai`} delay={0} />
        <StatCard icon="target" label="Quiz Dikerjakan" value={myAttempts.length} sub={`${myAttempts.filter((a) => a.passed).length} lulus`} tone="info" delay={50} />
        <StatCard icon="award" label="Sertifikat" value={myCerts.length} sub="digital + QR" tone="accent" delay={100} />
        <StatCard icon="clock" label="Jam Belajar" value={`${Math.round(withCourse.reduce((a, { e, course }) => a + (ProgressService.of(user.id, course!.id).done * 5), 0) / 60 * 10) / 10}j`} sub="estimasi" tone="ok" delay={150} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50 anim-rise">Lanjutkan Belajar</h2>
          {inProgress.length === 0 ? (
            <div className="card p-8 text-center anim-rise">
              <Icon name="book-open" size={28} className="mx-auto text-brand-500" />
              <p className="mt-3 font-display font-bold text-base-900 dark:text-base-50">Belum ada kelas yang sedang diikuti</p>
              <p className="mt-1 text-sm text-base-400">Jelajahi katalog dan mulai belajar hari ini.</p>
              <Link to="/courses" className="btn-primary mt-4 inline-flex">Jelajahi Kelas</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {inProgress.slice(0, 4).map(({ e, course }, i) => {
                const prog = ProgressService.of(user.id, course!.id);
                return (
                  <Link key={e.id} to={`/learn/${course!.slug}`} className="card card-hover flex items-center gap-4 p-3.5 anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
                    <SafeImg src={course!.thumbnail} alt={course!.title} label={course!.title} className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold text-base-900 dark:text-base-50">{course!.title}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-200 dark:bg-base-800"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${prog.pct}%` }} /></div>
                        <span className="font-mono text-[10px] font-bold text-brand-600 dark:text-brand-400">{prog.pct}%</span>
                      </div>
                    </div>
                    <Icon name="play" size={20} className="shrink-0 text-brand-500" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="card h-fit p-5 anim-rise" style={{ animationDelay: '100ms' }}>
          <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Progress Keseluruhan</h2>
          <div className="flex justify-center py-2">
            <Donut pct={withCourse.length === 0 ? 0 : Math.round(withCourse.reduce((a, { e, course }) => a + ProgressService.of(user.id, course!.id).pct, 0) / withCourse.length)} size={120} />
          </div>
          <div className="mt-2 space-y-1.5 text-sm">
            <p className="flex justify-between"><span className="text-base-500">Selesai</span><b className="text-ok-500">{completed.length}</b></p>
            <p className="flex justify-between"><span className="text-base-500">Berjalan</span><b>{inProgress.length}</b></p>
          </div>
          <Link to="/dashboard/certificates" className="btn-outline btn-sm mt-4 w-full"><Icon name="award" size={13} /> Sertifikat Saya</Link>
        </div>
      </div>
    </>
  );
}

export default function Overview() {
  const { user } = useApp();
  useDB();
  if (!user) return null;
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  return (
    <DashShell title="Overview">
      <PageHeader title={`${greet}, ${user.name.split(' ')[0]}`} sub={<span className="flex items-center gap-2">{fmtDate(Date.now())} · <Badge tone="brand"><span className="normal-case">{user.roleKey === 'super_admin' ? 'Super Admin' : user.roleKey === 'admin' ? 'Admin' : user.roleKey === 'instructor' ? 'Instructor' : 'Student'}</span></Badge></span>} />
      {user.roleKey === 'student' ? <StudentOverview /> : user.roleKey === 'instructor' ? <InstructorOverview /> : <AdminOverview />}
    </DashShell>
  );
}
