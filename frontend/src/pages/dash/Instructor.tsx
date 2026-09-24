import { useEffect, useState, type FormEvent } from 'react';
import { api, type InstructorAttempt, type InstructorQuiz, type InstructorSale, type InstructorStudent } from '../../lib/api';
import { fmtDate, fmtDateTime, fmtMoney } from '../../lib/format';
import { useApp } from '../../state/store';
import { Icon } from '../../components/icons';
import { Avatar, Badge, Modal, PageHeader, Select, StatCard, StatusBadge, Tabs } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import { PagedTable, RemoteView, useRemote } from '../../components/remote';

/* A-23: instructor dashboard pages. Every request goes to the ownership-scoped
   /api/v1/instructor/* endpoints — never /admin/users or the instructor's own orders. */

function useCourseOptions() {
  return useRemote(() => api.courseOptions(), []);
}

function CourseFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useApp();
  const options = useCourseOptions();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-xs py-2 text-sm" aria-label={t('course')}>
      <option value="">{t('all_courses')}</option>
      {(options.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
    </Select>
  );
}

function SearchBox({ onSearch, placeholder }: { onSearch: (q: string) => void; placeholder: string }) {
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); onSearch(value.trim()); };
  return (
    <form className="relative min-w-[200px] flex-1 sm:max-w-xs" onSubmit={submit}>
      <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="input pl-9 py-2 text-sm" />
    </form>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-base-200 dark:bg-base-800"><div className="h-full bg-brand-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>
      <span className="font-mono text-[11px] font-bold">{pct}%</span>
    </div>
  );
}

/* ---------------- students & per-course progress ---------------- */

export function InstructorStudentsPage() {
  const { t } = useApp();
  const [courseId, setCourseId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [progressFor, setProgressFor] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => { setPage(1); }, [courseId, q]);
  const students = useRemote(() => api.instructorStudents({ page, course_id: courseId, q }), [page, courseId, q]);

  return (
    <DashShell title={t('nav_my_students')}>
      <PageHeader title={t('nav_my_students')} sub="Student yang terdaftar di kelas milikmu beserta progres belajarnya." />
      <RemoteView remote={students}>
        {(data) => (
          <PagedTable<InstructorStudent> page={data} onPage={setPage} rowKey={(r) => r.enrollment_id}
            toolbar={<><SearchBox onSearch={setQ} placeholder={t('search_name')} /><CourseFilter value={courseId} onChange={setCourseId} /></>}
            columns={[
              { key: 'student', label: t('student'), render: (r) => (
                <div className="flex items-center gap-2.5"><Avatar name={r.name} src={r.avatar} size={30} /><div className="min-w-0"><p className="truncate text-sm font-bold">{r.name}</p><p className="truncate font-mono text-[10px] text-base-400">{r.email}</p></div></div>
              ) },
              { key: 'course', label: t('course'), render: (r) => <span className="text-sm">{r.course_title ?? '—'}</span> },
              { key: 'progress', label: t('progress'), render: (r) => <ProgressBar pct={r.progress_pct} /> },
              { key: 'enrolled', label: t('enrolled_at'), render: (r) => <span className="font-mono text-[11px] text-base-400">{fmtDate(r.enrolled_at)}</span> },
              { key: 'last', label: t('last_activity'), render: (r) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(r.last_activity)}</span> },
            ]}
            rowActions={(r) => <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setProgressFor({ id: r.course_id, title: r.course_title ?? '' })}>{t('view_progress')}</button>}
          />
        )}
      </RemoteView>
      {progressFor && <CourseProgressModal course={progressFor} onClose={() => setProgressFor(null)} />}
    </DashShell>
  );
}

function CourseProgressModal({ course, onClose }: { course: { id: string; title: string }; onClose: () => void }) {
  const { t } = useApp();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  useEffect(() => { setPage(1); }, [q]);
  const progress = useRemote(() => api.instructorCourseProgress(course.id, { page, q }), [course.id, page, q]);
  return (
    <Modal open onClose={onClose} title={`${t('progress')} — ${course.title}`} wide>
      <RemoteView remote={progress}>
        {(data) => (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon="users" label={t('enrolled')} value={data.course.enrolled} />
              <StatCard icon="check-circle" label={t('completed')} value={data.course.completed} tone="ok" />
              <StatCard icon="target" label={t('progress')} value={`${data.course.avg_progress}%`} tone="info" />
              <StatCard icon="book" label={t('lessons')} value={data.course.lessons_total} tone="accent" />
            </div>
            <PagedTable page={data.page} onPage={setPage} rowKey={(r) => r.enrollment_id}
              toolbar={<SearchBox onSearch={setQ} placeholder={t('search_name')} />}
              columns={[
                { key: 'student', label: t('student'), render: (r) => <div className="flex items-center gap-2"><Avatar name={r.name} src={r.avatar} size={26} /><span className="text-sm font-bold">{r.name}</span></div> },
                { key: 'progress', label: t('progress'), render: (r) => <ProgressBar pct={r.progress_pct} /> },
                { key: 'status', label: t('status'), render: (r) => <StatusBadge status={r.status} /> },
                { key: 'last', label: t('last_activity'), render: (r) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(r.last_activity)}</span> },
              ]} />
          </>
        )}
      </RemoteView>
    </Modal>
  );
}

/* ---------------- sales & earnings ---------------- */

export function InstructorSalesPage() {
  const { t } = useApp();
  const [tab, setTab] = useState<'sales' | 'earnings'>('sales');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState('paid');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [courseId, status, tab]);
  const sales = useRemote(() => (tab === 'sales' ? api.instructorSales({ page, course_id: courseId, status }) : Promise.resolve(null)), [tab, page, courseId, status]);
  const earnings = useRemote(() => (tab === 'earnings' ? api.instructorEarnings({ page, course_id: courseId }) : Promise.resolve(null)), [tab, page, courseId]);

  return (
    <DashShell title={t('nav_sales')}>
      <PageHeader title={t('nav_sales')} sub="Penjualan kelas milikmu dan pendapatan bersih setelah fee platform." />
      <div className="mb-4"><Tabs tabs={[{ key: 'sales', label: t('sales') }, { key: 'earnings', label: t('earnings') }]} active={tab} onChange={(k) => setTab(k as 'sales' | 'earnings')} /></div>
      {tab === 'sales' ? (
        <RemoteView remote={sales}>
          {(data) => data && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard icon="receipt" label={t('sales')} value={data.summary.count} />
                <StatCard icon="banknote" label={t('gross')} value={fmtMoney(data.summary.gross)} tone="ok" />
              </div>
              <PagedTable<InstructorSale> page={data.page} onPage={setPage} rowKey={(r) => r.id}
                toolbar={<>
                  <CourseFilter value={courseId} onChange={setCourseId} />
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[160px] py-2 text-sm" aria-label={t('status')}>
                    {['paid', 'pending', 'failed', 'expired', 'cancelled', 'all'].map((s) => <option key={s} value={s}>{s === 'all' ? t('all') : s}</option>)}
                  </Select>
                </>}
                columns={[
                  { key: 'course', label: t('course'), render: (r) => <span className="text-sm font-bold">{r.title}</span> },
                  { key: 'buyer', label: t('buyer'), render: (r) => <span className="text-sm">{r.buyer_name ?? '—'}</span> },
                  { key: 'gross', label: t('gross'), render: (r) => <span className="font-display text-sm font-bold">{fmtMoney(r.gross)}</span> },
                  { key: 'net', label: t('net_earning'), render: (r) => <span className="text-sm">{r.net_earning === null ? '—' : fmtMoney(r.net_earning)}</span> },
                  { key: 'status', label: t('status'), render: (r) => <StatusBadge status={r.order_status} /> },
                  { key: 'date', label: t('date'), render: (r) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(r.paid_at ?? r.ordered_at)}</span> },
                ]} />
            </>
          )}
        </RemoteView>
      ) : (
        <RemoteView remote={earnings}>
          {(data) => data && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon="wallet" label={t('net_earning')} value={fmtMoney(data.summary.net)} tone="ok" />
                <StatCard icon="banknote" label={t('gross')} value={fmtMoney(data.summary.gross)} />
                <StatCard icon="receipt" label={t('platform_fee')} value={fmtMoney(data.summary.platform_fee)} tone="warn" />
              </div>
              <PagedTable page={data.page} onPage={setPage} rowKey={(r) => r.id}
                toolbar={<CourseFilter value={courseId} onChange={setCourseId} />}
                columns={[
                  { key: 'course', label: t('course'), render: (r) => <span className="text-sm font-bold">{r.course_title ?? '—'}</span> },
                  { key: 'gross', label: t('gross'), render: (r) => <span className="text-sm">{fmtMoney(r.gross)}</span> },
                  { key: 'fee', label: t('platform_fee'), render: (r) => <span className="text-sm">{fmtMoney(r.platform_fee)}</span> },
                  { key: 'net', label: t('net_earning'), render: (r) => <span className="font-display text-sm font-bold">{fmtMoney(r.amount)}</span> },
                  { key: 'date', label: t('date'), render: (r) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(r.created_at)}</span> },
                ]} />
            </>
          )}
        </RemoteView>
      )}
    </DashShell>
  );
}

/* ---------------- quizzes & attempts ---------------- */

export function InstructorQuizResultsPage() {
  const { t } = useApp();
  const [courseId, setCourseId] = useState('');
  const [quizId, setQuizId] = useState('');
  const [passed, setPassed] = useState('');
  const [quizPage, setQuizPage] = useState(1);
  const [attemptPage, setAttemptPage] = useState(1);
  useEffect(() => { setQuizPage(1); setAttemptPage(1); setQuizId(''); }, [courseId]);
  useEffect(() => { setAttemptPage(1); }, [quizId, passed]);
  const quizzes = useRemote(() => api.instructorQuizzes({ page: quizPage, course_id: courseId }), [quizPage, courseId]);
  const attempts = useRemote(() => api.instructorQuizAttempts({ page: attemptPage, course_id: courseId, quiz_id: quizId, passed: passed === '' ? undefined : passed === '1' }), [attemptPage, courseId, quizId, passed]);

  return (
    <DashShell title={t('nav_quiz_attempts')}>
      <PageHeader title={t('nav_quiz_attempts')} sub="Quiz pada kelas milikmu dan hasil percobaan student." actions={<CourseFilter value={courseId} onChange={setCourseId} />} />
      <RemoteView remote={quizzes}>
        {(data) => (
          <PagedTable<InstructorQuiz> page={data} onPage={setQuizPage} rowKey={(r) => r.id}
            columns={[
              { key: 'title', label: t('title'), render: (r) => <span className="text-sm font-bold">{r.title}</span> },
              { key: 'course', label: t('course'), render: (r) => <span className="text-sm">{r.course?.title ?? '—'}</span> },
              { key: 'questions', label: 'Soal', render: (r) => <span className="font-mono text-xs">{r.questions_count}</span> },
              { key: 'attempts', label: t('attempts'), render: (r) => <span className="font-mono text-xs">{r.submitted_attempts_count}</span> },
              { key: 'status', label: t('status'), render: (r) => <Badge tone={r.active ? 'ok' : 'neutral'}>{r.active ? 'Aktif' : 'Nonaktif'}</Badge> },
            ]}
            rowActions={(r) => <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setQuizId(r.id)}>{t('attempts')}</button>} />
        )}
      </RemoteView>
      <div className="mt-6">
        <RemoteView remote={attempts}>
          {(data) => (
            <PagedTable<InstructorAttempt> page={data} onPage={setAttemptPage} rowKey={(r) => r.id}
              toolbar={<>
                {quizId && <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setQuizId('')}><Icon name="x" size={12} /> Filter quiz</button>}
                <Select value={passed} onChange={(e) => setPassed(e.target.value)} className="max-w-[160px] py-2 text-sm" aria-label={t('status')}>
                  <option value="">{t('all')}</option><option value="1">{t('passed')}</option><option value="0">{t('not_passed')}</option>
                </Select>
              </>}
              columns={[
                { key: 'student', label: t('student'), render: (r) => <span className="text-sm font-bold">{r.student_name ?? '—'}</span> },
                { key: 'quiz', label: 'Quiz', render: (r) => <span className="text-sm">{r.quiz_title ?? '—'}</span> },
                { key: 'course', label: t('course'), render: (r) => <span className="text-xs text-base-500">{r.course_title ?? '—'}</span> },
                { key: 'score', label: t('score'), render: (r) => <span className="font-mono text-xs font-bold">{r.score}/{r.max_score} · {r.percent}%</span> },
                { key: 'passed', label: t('status'), render: (r) => <Badge tone={r.passed ? 'ok' : 'danger'}>{r.passed ? t('passed') : t('not_passed')}</Badge> },
                { key: 'date', label: t('date'), render: (r) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(r.submitted_at)}</span> },
              ]} />
          )}
        </RemoteView>
      </div>
    </DashShell>
  );
}
