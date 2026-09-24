import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney, fmtDate, timeAgo } from '../../lib/format';
import { useApp } from '../../state/store';
import { Icon } from '../../components/icons';
import { Avatar, Badge, BarChart, Donut, PageHeader, SafeImg, StatCard, StatusBadge } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import { RemoteView, useRemote } from '../../components/remote';
import { OpsPanel } from './Operations';
import { api, type ApiDashboardSummary } from '../../lib/api';

const TASK_LABEL: Record<string, { text: string; icon: 'book' | 'user-check' | 'banknote' | 'chat'; cls: string }> = {
  pending_courses: { text: 'kelas menunggu review', icon: 'book', cls: 'border-warn-400/30 bg-warn-400/[0.08] hover:bg-warn-400/15 text-accent-500' },
  pending_instructors: { text: 'instructor menunggu approval', icon: 'user-check', cls: 'border-info-400/30 bg-info-400/[0.08] hover:bg-info-400/15 text-info-400' },
  pending_withdrawals: { text: 'withdrawal menunggu', icon: 'banknote', cls: 'border-danger-500/30 bg-danger-500/[0.07] hover:bg-danger-500/15 text-danger-500' },
  unread_messages: { text: 'pesan belum dibaca', icon: 'chat', cls: 'border-brand-500/30 bg-brand-500/[0.07] hover:bg-brand-500/15 text-brand-500' },
};

/** Staff overview: renders only the cards/tasks the server returned for this user's permissions. */
function AdminOverview({ data }: { data: ApiDashboardSummary }) {
  const remote = data.summary;
  const has = (key: string) => key in remote;
  const tasks = data.tasks ?? [];
  const content = ([['Artikel', 'articles'], ['Berita', 'news'], ['Tutorial', 'tutorials'], ['Kegiatan', 'activities'], ['Sertifikat', 'certificates']] as const).filter(([, key]) => has(key));
  const cards = [
    has('users') || has('students') || has('instructors') ? <StatCard key="users" icon="users" label={has('users') ? 'Total Users' : 'Pengguna'} value={remote.users ?? (remote.students ?? 0) + (remote.instructors ?? 0)} sub={[has('students') ? `${remote.students} student` : '', has('instructors') ? `${remote.instructors} instructor` : ''].filter(Boolean).join(' · ')} /> : null,
    has('courses') ? <StatCard key="courses" icon="book" label="Kelas" value={remote.courses} sub={`${remote.published_courses ?? 0} terbit · ${remote.pending_courses ?? 0} pending`} tone="info" /> : null,
    has('orders') ? <StatCard key="orders" icon="receipt" label="Total Order" value={remote.orders} sub={`${remote.paid_orders ?? 0} lunas`} tone="accent" /> : null,
    has('revenue') ? <StatCard key="revenue" icon="wallet" label="Total Revenue" value={fmtMoney(remote.revenue)} sub={`Platform ${fmtMoney(remote.platform_revenue ?? 0)}`} tone="ok" /> : null,
  ].filter(Boolean);

  return (
    <>
      {data.platform && <div className="mb-5"><OpsPanel status={data.platform} /></div>}
      {cards.length > 0 && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards}</div>}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {data.revenue_chart && (
          <div className="card p-5 lg:col-span-2 anim-rise">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Pendapatan 7 Hari</h2>
              <Badge tone="brand">pembayaran lunas</Badge>
            </div>
            <BarChart data={data.revenue_chart} />
          </div>
        )}
        <div className="space-y-5">
          <div className="card p-5 anim-rise">
            <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Butuh Tindakan</h2>
            <div className="space-y-2">
              {tasks.map((task) => {
                const meta = TASK_LABEL[task.key];
                return (
                  <Link key={task.key} to={task.link} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${meta?.cls ?? ''}`}>
                    <Icon name={meta?.icon ?? 'info'} size={16} />
                    <span className="flex-1 text-sm font-bold text-base-800 dark:text-base-100">{task.count} {meta?.text ?? task.key}</span>
                    <Icon name="chevron-right" size={14} className="text-base-400" />
                  </Link>
                );
              })}
              {tasks.length === 0 && <p className="flex items-center gap-2 text-sm text-base-400"><Icon name="check-circle" size={16} className="text-ok-500" /> Tidak ada tugas yang menunggu.</p>}
            </div>
          </div>
          {content.length > 0 && (
            <div className="card p-5 anim-rise">
              <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Statistik Konten</h2>
              {content.map(([label, key]) => (
                <div key={key} className="flex items-center justify-between border-b border-base-100 dark:border-base-800 py-1.5 text-sm last:border-0">
                  <span className="text-base-500">{label}</span><span className="font-mono font-bold text-base-800 dark:text-base-100">{remote[key]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {data.recent_orders && (
        <div className="mt-5 card overflow-hidden anim-rise">
          <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-5 py-3.5">
            <h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Order Terbaru</h2>
            <Link to="/dashboard/orders" className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">Lihat semua</Link>
          </div>
          {data.recent_orders.length === 0 ? <p className="px-5 py-8 text-center text-sm text-base-400">Belum ada order.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead className="bg-base-100/60 dark:bg-base-850"><tr><th className="th">Order</th><th className="th">User</th><th className="th">Tipe</th><th className="th">Total</th><th className="th">Status</th></tr></thead>
                <tbody>
                  {data.recent_orders.map((o) => (
                    <tr key={o.id} className="hover:bg-brand-500/[0.04]">
                      <td className="td font-mono text-xs">{o.item_title ?? '—'}</td>
                      <td className="td"><span className="flex items-center gap-2"><Avatar name={o.user_name ?? '?'} size={22} />{o.user_name ?? '—'}</span></td>
                      <td className="td"><Badge tone={o.type === 'course' ? 'brand' : 'accent'}>{o.type}</Badge></td>
                      <td className="td font-display font-bold">{fmtMoney(o.total)}</td>
                      <td className="td"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function InstructorOverview({ data }: { data: ApiDashboardSummary }) {
  const { user } = useApp();
  const remote = data.summary;
  const revenueChart = data.revenue_chart ?? [];
  const recentStudents = data.recent_students ?? [];
  if (!user) return null;
  return (
    <>
      {!user.instructorApproved && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-warn-400/30 bg-warn-400/[0.08] px-4 py-3 anim-rise">
          <Icon name="alert-triangle" size={18} className="text-accent-500" />
          <p className="text-sm font-semibold text-base-700 dark:text-base-200">Akun instructor-mu masih menunggu approval admin. Kamu tetap bisa membuat kelas (status draft) dan mengajukannya untuk review.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="book" label="Kelas Saya" value={remote.courses ?? 0} sub={`${remote.published_courses ?? 0} terbit`} delay={0} />
        <StatCard icon="users" label="Students" value={remote.students ?? 0} sub="total enrollment" tone="info" delay={50} />
        <StatCard icon="chart" label="Total Pendapatan" value={fmtMoney(remote.earnings ?? 0)} sub={`gross ${fmtMoney(remote.gross ?? 0)}`} tone="ok" delay={100} />
        <StatCard icon="wallet" label="Saldo" value={fmtMoney(remote.balance ?? 0)} sub={`withdrawable ${fmtMoney(remote.withdrawable ?? 0)}`} tone="accent" delay={150} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2 anim-rise">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Pendapatan 7 Hari</h2>
            <Badge tone="brand">fee platform {remote.platform_fee_percent ?? 15}%</Badge>
          </div>
          <BarChart data={revenueChart} />
        </div>
        <div className="card p-5 anim-rise" style={{ animationDelay: '80ms' }}>
          <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Ringkasan</h2>
          {[['Quiz dibuat', remote.quizzes ?? 0], ['Sertifikat terbit', remote.certificates ?? 0], ['Withdrawal selesai', remote.completed_withdrawals ?? 0], ['Menunggu withdrawal', remote.pending_withdrawals ?? 0]].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between border-b border-base-100 dark:border-base-800 py-2 text-sm last:border-0">
              <span className="text-base-500">{l}</span><span className="font-mono font-bold text-base-800 dark:text-base-100">{typeof v === 'number' && l === 'Menunggu withdrawal' ? fmtMoney(v) : v}</span>
            </div>
          ))}
          <Link to="/dashboard/wallet" className="btn-outline btn-sm mt-4 w-full"><Icon name="wallet" size={13} /> Kelola Dompet</Link>
        </div>
      </div>
      <div className="mt-5 card overflow-hidden anim-rise">
        <div className="border-b border-base-200 dark:border-base-800 px-5 py-3.5"><h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Student Terbaru</h2></div>
        {recentStudents.length === 0 ? <p className="px-5 py-8 text-center text-sm text-base-400">Belum ada student.</p> : (
          <ul>
            {recentStudents.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800 px-5 py-3 last:border-0">
                <Avatar name={s.user_name ?? '?'} src={s.user_avatar ?? undefined} size={32} />
                <div className="flex-1 min-w-0"><p className="truncate text-sm font-bold text-base-800 dark:text-base-100">{s.user_name}</p><p className="truncate text-xs text-base-400">{s.course_title}</p></div>
                <span className="font-mono text-[10px] text-base-400">{timeAgo(new Date(s.created_at).getTime())}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function StudentOverview({ data }: { data: ApiDashboardSummary }) {
  const { user } = useApp();
  const remote = data.summary;
  const inProgress = data.in_progress ?? [];
  if (!user) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="book" label="Kelas Diikuti" value={remote.enrollments ?? 0} sub={`${remote.completed_enrollments ?? 0} selesai`} delay={0} />
        <StatCard icon="target" label="Quiz Dikerjakan" value={remote.quiz_attempts ?? 0} sub={`${remote.passed_quizzes ?? 0} lulus`} tone="info" delay={50} />
        <StatCard icon="award" label="Sertifikat" value={remote.certificates ?? 0} sub="digital + QR" tone="accent" delay={100} />
        <StatCard icon="clock" label="Progress Rata-rata" value={`${Math.round(remote.avg_progress ?? 0)}%`} sub="semua kelas" tone="ok" delay={150} />
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
              {inProgress.map((c, i) => (
                <Link key={c.course_id} to={`/learn/${c.course_slug}`} className="card card-hover flex items-center gap-4 p-3.5 anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
                  <SafeImg src={c.course_thumbnail ?? undefined} alt={c.course_title ?? ''} label={c.course_title ?? ''} className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-base-900 dark:text-base-50">{c.course_title}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-200 dark:bg-base-800"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${c.progress_pct}%` }} /></div>
                      <span className="font-mono text-[10px] font-bold text-brand-600 dark:text-brand-400">{c.progress_pct}%</span>
                    </div>
                  </div>
                  <Icon name="play" size={20} className="shrink-0 text-brand-500" />
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card h-fit p-5 anim-rise" style={{ animationDelay: '100ms' }}>
          <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Progress Keseluruhan</h2>
          <div className="flex justify-center py-2">
            <Donut pct={Math.round(remote.avg_progress ?? 0)} size={120} />
          </div>
          <div className="mt-2 space-y-1.5 text-sm">
            <p className="flex justify-between"><span className="text-base-500">Selesai</span><b className="text-ok-500">{remote.completed_enrollments ?? 0}</b></p>
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
  const summary = useRemote(() => api.dashboardSummary(), [user?.id]);
  if (!user) return null;
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';

  return (
    <DashShell title="Overview">
      <PageHeader title={`${greet}, ${user.name.split(' ')[0]}`} sub={<span className="flex items-center gap-2">{fmtDate(Date.now())} · <Badge tone="brand"><span className="normal-case">{user.roleKey === 'super_admin' ? 'Super Admin' : user.roleKey === 'admin' ? 'Admin' : user.roleKey === 'instructor' ? 'Instructor' : 'Student'}</span></Badge></span>} />
      <RemoteView remote={summary}>
        {(data) => user.roleKey === 'student' ? <StudentOverview data={data} /> : user.roleKey === 'instructor' ? <InstructorOverview data={data} /> : <AdminOverview data={data} />}
      </RemoteView>
    </DashShell>
  );
}
