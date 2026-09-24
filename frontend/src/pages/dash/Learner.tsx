import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type MyEnrollment, type MyQuizAttempt } from '../../lib/api';
import { fmtDateTime, timeAgo } from '../../lib/format';
import type { Notification } from '../../lib/types';
import { useApp } from '../../state/store';
import { Icon } from '../../components/icons';
import { Badge, EmptyState, PageHeader, SafeImg, Tabs } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import { PagedTable, Pager, RemoteView, useRemote } from '../../components/remote';

/* ---------------- Pembelajaranku (server enrollments + progress) ---------------- */

export function MyLearningPage() {
  const { t } = useApp();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [status]);
  const enrollments = useRemote(() => api.myEnrollments({ page, status, per_page: 12 }), [page, status]);
  return (
    <DashShell title={t('my_learning')}>
      <PageHeader title={t('my_learning')} sub="Kelas yang kamu ikuti beserta progres terbaru dari server." actions={<Link to="/courses" className="btn-outline"><Icon name="search" size={14} /> Jelajahi Kelas</Link>} />
      <div className="mb-4"><Tabs tabs={[{ key: '', label: t('all') }, { key: 'active', label: 'Berjalan' }, { key: 'completed', label: t('completed') }]} active={status} onChange={setStatus} /></div>
      <RemoteView remote={enrollments} isEmpty={(p) => p.total === 0 && !status} emptyTitle="Belum ada kelas" emptySub="Daftar kelas gratis atau beli kelas untuk mulai belajar.">
        {(data) => data.items.length === 0 ? <EmptyState title={t('no_data')} /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((e: MyEnrollment) => (
                <div key={e.id} className="card overflow-hidden anim-rise">
                  <SafeImg src={e.course_thumbnail} alt={e.course_title ?? ''} label={e.course_title ?? ''} className="aspect-video w-full object-cover" />
                  <div className="p-4">
                    <p className="font-display text-sm font-bold text-base-900 dark:text-base-50 line-clamp-2">{e.course_title}</p>
                    <p className="mt-0.5 text-xs text-base-400">{e.instructor_name ?? '—'} · {t('last_activity')} {timeAgo(e.last_activity)}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-200 dark:bg-base-800"><div className="h-full bg-brand-500" style={{ width: `${e.progress_pct}%` }} /></div>
                      <span className="font-mono text-[11px] font-bold">{e.progress_pct}%</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {e.status === 'completed' ? <Badge tone="ok">{t('completed')}</Badge> : <Badge tone="brand">Berjalan</Badge>}
                      {e.course_published && e.course_slug
                        ? <Link to={`/learn/${e.course_slug}`} className="btn-primary btn-sm"><Icon name="play" size={12} /> {e.progress_pct > 0 ? t('continue_learning') : t('start_learning')}</Link>
                        : <span className="text-[11px] text-base-400">Kelas tidak tersedia</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {data.lastPage > 1 && <div className="card mt-4"><Pager page={data} onPage={setPage} /></div>}
          </>
        )}
      </RemoteView>
    </DashShell>
  );
}

/* ---------------- Riwayat quiz (own submitted attempts) ---------------- */

export function MyQuizzesPage() {
  const { t } = useApp();
  const [page, setPage] = useState(1);
  const attempts = useRemote(() => api.myQuizAttempts({ page }), [page]);
  return (
    <DashShell title={t('nav_my_quizzes')}>
      <PageHeader title={t('nav_my_quizzes')} sub="Nilai dihitung server; percobaan yang sudah dikumpulkan tidak dapat diubah." />
      <RemoteView remote={attempts} isEmpty={(p) => p.total === 0} emptyTitle="Belum ada percobaan quiz" emptySub="Kerjakan quiz dari halaman belajar kelas.">
        {(data) => (
          <PagedTable<MyQuizAttempt> page={data} onPage={setPage} rowKey={(r) => r.id}
            columns={[
              { key: 'quiz', label: 'Quiz', render: (r) => <span className="text-sm font-bold">{r.quiz_title ?? '—'}</span> },
              { key: 'course', label: t('course'), render: (r) => r.course_slug ? <Link to={`/learn/${r.course_slug}`} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">{r.course_title}</Link> : <span className="text-xs text-base-400">{r.course_title ?? '—'}</span> },
              { key: 'score', label: t('score'), render: (r) => <span className="font-mono text-xs font-bold">{r.score}/{r.max_score} · {r.percent}%</span> },
              { key: 'status', label: t('status'), render: (r) => <Badge tone={r.passed ? 'ok' : 'danger'}>{r.passed ? t('passed') : `${t('not_passed')} (min ${r.passing_score}%)`}</Badge> },
              { key: 'date', label: t('date'), render: (r) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(r.submitted_at)}</span> },
            ]} />
        )}
      </RemoteView>
    </DashShell>
  );
}

/* ---------------- Notifikasi (paginated, owner-scoped) ---------------- */

export function NotificationsPage() {
  const { t, toast } = useApp();
  const nav = useNavigate();
  const [filter, setFilter] = useState<'' | 'unread'>('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filter]);
  const list = useRemote(() => api.notifications({ page, is_read: filter === 'unread' ? false : undefined }), [page, filter]);
  const open = (n: Notification) => {
    const go = () => { if (n.link) nav(n.link); };
    if (n.read) { go(); return; }
    void api.readNotification(n.id).then(() => { list.reload(); go(); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menandai notifikasi.'));
  };
  const readAll = () => { void api.readAllNotifications().then(list.reload).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menandai notifikasi.')); };
  const tone = (kind: Notification['kind']) => (kind === 'success' ? 'ok' : kind === 'danger' ? 'danger' : kind === 'warning' ? 'warn' : 'info');
  return (
    <DashShell title={t('notifications')}>
      <PageHeader title={t('notifications')} sub="Pemberitahuan pembayaran, kelas, sertifikat, dan keuangan dari server."
        actions={list.data && list.data.unread > 0 ? <button className="btn-outline" onClick={readAll}><Icon name="check" size={14} /> {t('mark_all_read')}</button> : undefined} />
      <div className="mb-4"><Tabs tabs={[{ key: '', label: t('all') }, { key: 'unread', label: t('unread') }]} active={filter} onChange={(k) => setFilter(k as '' | 'unread')} /></div>
      <RemoteView remote={list} isEmpty={(d) => d.page.total === 0} emptyTitle={t('no_notifications')}>
        {(data) => (
          <div className="card overflow-hidden">
            <ul>
              {data.page.items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => open(n)} className={`flex w-full items-start gap-3 border-b border-base-100 dark:border-base-800 px-5 py-3.5 text-left transition-colors hover:bg-brand-500/[0.05] cursor-pointer ${!n.read ? 'bg-brand-500/[0.04]' : ''}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.read ? 'bg-brand-500' : 'bg-base-300 dark:bg-base-700'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="text-sm font-bold text-base-800 dark:text-base-100">{n.title}</span><Badge tone={tone(n.kind)}>{n.read ? t('read') : t('unread')}</Badge></span>
                      <span className="mt-0.5 block text-xs text-base-500 dark:text-base-400">{n.body}</span>
                      <span className="mt-1 block font-mono text-[10px] text-base-400">{fmtDateTime(n.createdAt)}</span>
                    </span>
                    {n.link && <Icon name="arrow-right" size={14} className="mt-1 text-base-400" />}
                  </button>
                </li>
              ))}
            </ul>
            <Pager page={data.page} onPage={setPage} />
          </div>
        )}
      </RemoteView>
    </DashShell>
  );
}
