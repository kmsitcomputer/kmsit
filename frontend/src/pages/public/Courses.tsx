import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Course, Lesson, LiveClass, Quiz, ID, Order, Question } from '../../lib/types';
import { api, type ApiCertificate, type ApiCourseDetail, type LearningStatus } from '../../lib/api';
import { coursePrice, fmtMoney, youtubeId } from '../../lib/format';
import { useApp } from '../../state/store';
import { Pager, RemoteView, useRemote } from '../../components/remote';
import { Icon } from '../../components/icons';
import { Badge, Donut, EmptyState, Modal, RichHTML, SafeImg, Select, Spinner, StatusBadge, YouTube } from '../../components/ui';
import { PublicShell } from '../../components/Shell';
import { CourseCard } from './Public';
import { CertificateModal } from './Certificates';

/* ================= catalog ================= */

export function CoursesCatalog() {
  const { categories } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = params.get('cat') ?? '';
  const level = params.get('level') ?? '';
  const type = params.get('type') ?? '';
  const sort = params.get('sort') ?? 'latest';
  const [term, setTerm] = useState(q);
  const [page, setPage] = useState(1);
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  // Debounced so typing does not fire one request per keystroke.
  useEffect(() => { const timer = window.setTimeout(() => { if (term !== q) set('q', term); }, 300); return () => window.clearTimeout(timer); }, [term]);
  useEffect(() => { setPage(1); }, [q, cat, level, type, sort]);
  const courses = useRemote(() => api.coursePage({ page, search: q, category_id: cat, level, type, sort }), [page, q, cat, level, type, sort]);
  const filtered = !!(q || cat || level || type);

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 anim-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-500 flex items-center gap-2"><Icon name="book" size={14} /> Katalog</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-base-900 dark:text-base-50">Kelas Online</h1>
          <p className="mt-1 text-sm text-base-500 dark:text-base-400">{courses.data ? `${courses.data.total} kelas tersedia` : 'Memuat kelas'} — gratis & berbayar dengan sertifikat digital.</p>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2.5 anim-rise">
          <div className="relative min-w-52 flex-1 sm:max-w-sm">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cari kelas atau topik…" className="input pl-9" />
          </div>
          <Select value={cat} onChange={(e) => set('cat', e.target.value)} className="w-auto">
            <option value="">Semua Kategori</option>
            {categories.filter((c) => c.scope === 'course').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={level} onChange={(e) => set('level', e.target.value)} className="w-auto">
            <option value="">Semua Level</option>
            <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </Select>
          <Select value={type} onChange={(e) => set('type', e.target.value)} className="w-auto">
            <option value="">Gratis & Berbayar</option><option value="free">Gratis</option><option value="paid">Berbayar</option>
          </Select>
          <Select value={sort} onChange={(e) => set('sort', e.target.value)} className="w-auto">
            <option value="latest">Terbaru</option><option value="popular">Terpopuler</option>
            <option value="price_asc">Harga Terendah</option><option value="price_desc">Harga Tertinggi</option>
          </Select>
        </div>
        <RemoteView remote={courses} isEmpty={(p) => p.total === 0}
          emptyTitle={filtered ? 'Tidak ada kelas yang cocok' : 'Belum ada kelas tersedia'}
          emptySub={filtered ? 'Coba ubah kata kunci atau filter.' : 'Kelas yang dipublikasikan instructor akan tampil di sini.'}>
          {(data) => (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((c, i) => <CourseCard key={c.id} course={c} delay={(i % 3) * 60} />)}
              </div>
              {data.lastPage > 1 && <div className="card mt-6"><Pager page={data} onPage={setPage} /></div>}
            </>
          )}
        </RemoteView>
      </div>
    </PublicShell>
  );
}

/* ================= course detail ================= */

export function CourseDetailPage() {
  const { slug } = useParams();
  const { user, toast, categoryName } = useApp();
  const nav = useNavigate();
  const [remoteDetail, setRemoteDetail] = useState<ApiCourseDetail | null>(null);
  const [status, setStatus] = useState<LearningStatus | null>(null);
  useEffect(() => { if (slug) void api.course(slug).then(setRemoteDetail).catch(() => setRemoteDetail(null)); }, [slug, user?.id]);
  const course = remoteDetail?.course;
  useEffect(() => {
    if (user && course?.id && remoteDetail?.enrolled) void api.learningStatus(course.id).then(setStatus).catch(() => setStatus(null));
    else setStatus(null);
  }, [user?.id, course?.id, remoteDetail?.enrolled]);
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [certOpen, setCertOpen] = useState<ApiCertificate | null>(null);

  if (!course) {
    return <PublicShell><div className="mx-auto max-w-2xl px-4 py-24"><EmptyState icon="alert-circle" title="Kelas tidak ditemukan" action={<Link to="/courses" className="btn-primary">Lihat Katalog</Link>} /></div></PublicShell>;
  }
  const isOwner = user?.id === course.instructorId;
  const isStaff = user?.roleKey === 'super_admin' || user?.roleKey === 'admin';
  if (course.status !== 'published' && !isOwner && !isStaff) {
    return <PublicShell><div className="mx-auto max-w-2xl px-4 py-24"><EmptyState icon="lock" title="Kelas belum tersedia" sub="Kelas ini belum dipublikasikan." action={<Link to="/courses" className="btn-primary">Lihat Katalog</Link>} /></div></PublicShell>;
  }

  const enrolled = user ? (remoteDetail?.enrolled ?? false) : false;
  const prog = enrolled ? status?.progress ?? null : null;
  const price = coursePrice(course);
  const instructor = remoteDetail?.instructor;
  const sections = remoteDetail?.sections ?? [];
  const lessonCount = remoteDetail?.lessonCount ?? 0;
  const duration = remoteDetail?.duration ?? 0;
  const studentsCount = remoteDetail?.studentsCount ?? 0;
  const cert = status?.certificate && status.certificate.status === 'issued' ? status.certificate : null;

  const enrollFree = () => {
    if (!user) { nav(`/login?next=/courses/${course.slug}`); return; }
    setBusy(true);
    api.enroll(course.slug).then(() => {
      toast('success', 'Berhasil mendaftar! Selamat belajar.');
      nav(`/learn/${course.slug}`);
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal mendaftar.')).finally(() => setBusy(false));
  };

  const buy = () => {
    if (!user) { nav(`/login?next=/courses/${course.slug}`); return; }
    setBusy(true);
    api.createCourseOrder(course.slug).then((response) => {
      const order = (response as { order: { id: string } }).order;
      nav(`/checkout/${order.id}`);
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal membuat order.')).finally(() => setBusy(false));
  };

  return (
    <PublicShell>
      <section className="relative overflow-hidden border-b border-base-200 dark:border-base-800 bg-base-900 dark:bg-base-925 text-base-100">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-brand-500/12 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="anim-rise">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{course.categoryName ?? (categoryName(course.categoryId) || 'Umum')}</Badge>
              <Badge tone="neutral"><span className="normal-case">{course.level}</span></Badge>
              {course.status !== 'published' && <StatusBadge status={course.status} />}
            </div>
            <h1 className="mt-4 font-display text-2xl sm:text-4xl font-bold leading-tight text-base-50">{course.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-base-300">{course.shortDescription}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-base-300">
              <span className="flex items-center gap-2"><SafeImg src={instructor?.avatar} alt={instructor?.name ?? ''} label={instructor?.name} className="h-7 w-7 rounded-full object-cover" /><b className="text-base-100">{instructor?.name}</b></span>
              <span className="flex items-center gap-1.5 font-mono text-xs"><Icon name="play" size={13} /> {lessonCount} materi</span>
              <span className="flex items-center gap-1.5 font-mono text-xs"><Icon name="clock" size={13} /> {duration} menit</span>
              <span className="flex items-center gap-1.5 font-mono text-xs"><Icon name="users" size={13} /> {studentsCount} student</span>
            </div>
          </div>
          <div className="anim-rise lg:pl-6" style={{ animationDelay: '120ms' }}>
            <div className="card overflow-hidden !bg-white dark:!bg-base-900">
              <div className="relative">
                <SafeImg src={course.thumbnail} alt={course.title} label={course.title} className="aspect-video w-full object-cover" />
                {enrolled && prog && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-base-800"><div className="h-full bg-brand-400" style={{ width: `${prog.pct}%` }} /></div>}
              </div>
              <div className="p-5">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-base-900 dark:text-base-50">{course.isFree ? 'Gratis' : fmtMoney(price)}</span>
                  {!course.isFree && course.discountPrice > 0 && course.discountPrice < course.price && (
                    <>
                      <span className="text-sm text-base-400 line-through">{fmtMoney(course.price)}</span>
                      <Badge tone="danger">-{Math.round((1 - course.discountPrice / course.price) * 100)}%</Badge>
                    </>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {enrolled ? (
                    <>
                      <Link to={`/learn/${course.slug}`} className="btn-primary w-full py-3"><Icon name="play" size={16} /> {prog && prog.pct > 0 ? 'Lanjutkan Belajar' : 'Mulai Belajar'}</Link>
                      {cert && <button onClick={() => setCertOpen(cert)} className="btn-outline w-full"><Icon name="award" size={15} /> Lihat Sertifikat</button>}
                    </>
                  ) : course.isFree ? (
                    <button className="btn-primary w-full py-3" onClick={enrollFree} disabled={busy}>{busy ? <Spinner size={15} /> : <Icon name="check-circle" size={16} />} Daftar Gratis</button>
                  ) : (
                    <button className="btn-primary w-full py-3" onClick={buy} disabled={busy}>{busy ? <Spinner size={15} /> : <Icon name="card" size={16} />} Beli Kelas</button>
                  )}
                </div>
                <ul className="mt-4 space-y-1.5 text-xs text-base-500 dark:text-base-400">
                  <li className="flex items-center gap-2"><Icon name="check" size={12} className="text-ok-500" /> Akses materi selamanya</li>
                  <li className="flex items-center gap-2"><Icon name="check" size={12} className="text-ok-500" /> Quiz & sertifikat digital terverifikasi</li>
                  <li className="flex items-center gap-2"><Icon name="check" size={12} className="text-ok-500" /> Payment gateway aman (Tripay / Xendit / Stripe)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          {course.outcomes.length > 0 && (
            <section className="card p-6 anim-rise">
              <h2 className="font-display text-lg font-bold text-base-900 dark:text-base-50">Yang Akan Kamu Kuasai</h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {course.outcomes.map((o, i) => <li key={i} className="flex items-start gap-2.5 text-sm text-base-600 dark:text-base-300"><Icon name="check-circle" size={16} className="mt-0.5 shrink-0 text-brand-500" />{o}</li>)}
              </ul>
            </section>
          )}
          <section className="card mt-5 overflow-hidden anim-rise">
            <div className="border-b border-base-200 dark:border-base-800 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-base-900 dark:text-base-50">Kurikulum</h2>
              <p className="text-xs text-base-400 font-mono">{sections.length} section · {lessonCount} materi · {duration} menit</p>
            </div>
            {sections.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-base-400">Kurikulum sedang disusun.</p>
            ) : sections.map((sec, si) => {
              const lessons = sec.lessons;
              const open = openSection === sec.id || si === 0;
              return (
                <div key={sec.id} className="border-b border-base-100 dark:border-base-800/70 last:border-0">
                  <button className="flex w-full items-center gap-3 px-6 py-3.5 text-left transition-colors hover:bg-brand-500/[0.04] cursor-pointer" onClick={() => setOpenSection(open && openSection === sec.id ? null : sec.id)}>
                    <span className="font-mono text-[11px] font-bold text-brand-500">{String(si + 1).padStart(2, '0')}</span>
                    <span className="flex-1 font-display text-sm font-bold text-base-800 dark:text-base-100">{sec.title}</span>
                    <span className="font-mono text-[10px] text-base-400">{lessons.length} materi</span>
                    <Icon name="chevron-down" size={14} className={`text-base-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <ul className="pb-2">
                      {lessons.map((l) => {
                        // The server only returns content for previews, enrolled students and owners.
                        const viewable = enrolled || l.preview || isOwner || isStaff;
                        return (
                          <li key={l.id}>
                            <button disabled={!viewable} onClick={() => setPreviewLesson(l)}
                              className={`flex w-full items-center gap-3 px-6 py-2.5 text-left text-sm transition-colors ${viewable ? 'text-base-600 dark:text-base-300 hover:bg-brand-500/[0.06] hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer' : 'text-base-400 dark:text-base-600'}`}>
                              <Icon name={viewable ? 'play' : 'lock'} size={14} className={viewable ? 'text-brand-500' : ''} />
                              <span className="flex-1 truncate font-semibold">{l.title}</span>
                              {l.preview && !enrolled && <Badge tone="brand">Preview</Badge>}
                              <span className="font-mono text-[10px] text-base-400">{l.durationMin}m</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
          <section className="card mt-5 p-6 anim-rise">
            <h2 className="font-display text-lg font-bold text-base-900 dark:text-base-50">Tentang Kelas Ini</h2>
            <div className="mt-3"><RichHTML html={course.description} /></div>
            {course.requirements.length > 0 && (
              <>
                <h3 className="mt-6 font-display text-base font-bold text-base-900 dark:text-base-50">Persyaratan</h3>
                <ul className="mt-3 space-y-2">{course.requirements.map((r, i) => <li key={i} className="flex items-start gap-2.5 text-sm text-base-600 dark:text-base-300"><Icon name="arrow-right" size={14} className="mt-1 shrink-0 text-accent-500" />{r}</li>)}</ul>
              </>
            )}
            {course.tags.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{course.tags.map((tg) => <span key={tg} className="badge bg-base-100 dark:bg-base-800 text-base-500"><Icon name="tag" size={10} />{tg}</span>)}</div>}
          </section>
        </div>
        <div>
          <div className="card p-5 anim-rise">
            <p className="label">Instructor</p>
            <div className="flex items-center gap-3">
              <SafeImg src={instructor?.avatar} alt={instructor?.name ?? ''} label={instructor?.name} className="h-14 w-14 rounded-xl object-cover" />
              <div>
                <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">{instructor?.name}</p>
                <p className="text-xs text-base-400 line-clamp-2">{instructor?.instructorHeadline || roleWord(instructor?.roleKey)}</p>
              </div>
            </div>
            {instructor?.bio && <p className="mt-3 text-xs leading-5 text-base-500 dark:text-base-400 line-clamp-4">{instructor.bio}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-base-100 dark:bg-base-850 py-2"><p className="font-display font-bold text-base-900 dark:text-base-50">{remoteDetail?.instructorStats.courses ?? 0}</p><p className="font-mono text-[9px] uppercase text-base-400">Kelas</p></div>
              <div className="rounded-lg bg-base-100 dark:bg-base-850 py-2"><p className="font-display font-bold text-base-900 dark:text-base-50">{remoteDetail?.instructorStats.students ?? 0}</p><p className="font-mono text-[9px] uppercase text-base-400">Student</p></div>
            </div>
          </div>
          <RelatedCourses current={course} />
        </div>
      </div>

      <Modal open={!!previewLesson} onClose={() => setPreviewLesson(null)} title={previewLesson?.title ?? ''} wide>
        {previewLesson && <LessonContent lesson={previewLesson} />}
      </Modal>
      {certOpen && <CertificateModal certificate={certOpen} open onClose={() => setCertOpen(null)} />}
    </PublicShell>
  );

  function roleWord(k?: string) { return k === 'instructor' ? 'Instructor' : 'Pengajar'; }
}

function RelatedCourses({ current }: { current: Course }) {
  const [related, setRelated] = useState<Course[]>([]);
  useEffect(() => {
    void api.courses({ per_page: 3, exclude: current.id, category_id: current.categoryId ?? undefined }).then(setRelated).catch(() => setRelated([]));
  }, [current.id, current.categoryId]);
  if (related.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="label mb-2">Kelas Terkait</p>
      <div className="space-y-3">
        {related.map((c) => (
          <Link key={c.id} to={`/courses/${c.slug}`} className="card card-hover flex gap-3 overflow-hidden p-2.5">
            <SafeImg src={c.thumbnail} alt={c.title} label={c.title} className="h-16 w-24 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 py-0.5">
              <p className="truncate font-display text-[13px] font-bold text-base-800 dark:text-base-100">{c.title}</p>
              <p className="mt-1 font-display text-xs font-bold text-brand-600 dark:text-brand-400">{c.isFree ? 'Gratis' : fmtMoney(coursePrice(c))}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ================= lesson content ================= */

export function LessonContent({ lesson }: { lesson: Lesson }) {
  if (lesson.type === 'youtube' && youtubeId(lesson.mediaUrl)) return (
    <div><YouTube url={lesson.mediaUrl} /><div className="mt-4"><RichHTML html={lesson.content} /></div></div>
  );
  if (lesson.type === 'video' && lesson.mediaUrl) return (
    <div>
      <video src={lesson.mediaUrl} controls className="w-full rounded-xl bg-base-950" style={{ aspectRatio: '16/9' }} />
      <div className="mt-4"><RichHTML html={lesson.content} /></div>
    </div>
  );
  if ((lesson.type === 'pdf' || lesson.type === 'file') && lesson.mediaUrl) {
    const isData = lesson.mediaUrl.startsWith('data:');
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-base-200 dark:border-base-700 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/12 text-brand-500"><Icon name="file" size={20} /></span>
          <div className="flex-1"><p className="text-sm font-bold text-base-800 dark:text-base-100">Materi {lesson.type.toUpperCase()}</p><p className="text-xs text-base-400">Unduh untuk belajar offline.</p></div>
          <a href={lesson.mediaUrl} download target={isData ? undefined : '_blank'} rel="noopener noreferrer" className="btn-primary btn-sm"><Icon name="download" size={13} /> Unduh</a>
        </div>
        <RichHTML html={lesson.content} />
      </div>
    );
  }
  if (lesson.type === 'image' && lesson.mediaUrl) return (
    <div><SafeImg src={lesson.mediaUrl} alt={lesson.title} className="w-full rounded-xl object-contain max-h-[420px] bg-base-100 dark:bg-base-850" /><div className="mt-4"><RichHTML html={lesson.content} /></div></div>
  );
  if (lesson.type === 'url' && lesson.mediaUrl) return (
    <div className="space-y-4">
      <a href={lesson.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/[0.06] p-4 transition-colors hover:bg-brand-500/10">
        <Icon name="external" size={18} className="text-brand-500" />
        <span className="text-sm font-bold text-brand-700 dark:text-brand-300 break-all">{lesson.mediaUrl}</span>
      </a>
      <RichHTML html={lesson.content} />
    </div>
  );
  if (lesson.type === 'embed' && /^(https:\/\/(www\.)?(youtube\.com|youtu\.be|player\.vimeo\.com|vimeo\.com)\/)/.test(lesson.mediaUrl)) {
    const yid = youtubeId(lesson.mediaUrl);
    return yid ? <YouTube url={lesson.mediaUrl} /> : (
      <div className="overflow-hidden rounded-xl" style={{ aspectRatio: '16/9' }}>
        <iframe src={lesson.mediaUrl} title={lesson.title} className="h-full w-full" allowFullScreen />
      </div>
    );
  }
  return <RichHTML html={lesson.content} />;
}

/* ================= quiz player ================= */

export function QuizPlayer({ quiz, onClose, onSubmitted }: { quiz: Quiz; onClose: () => void; onSubmitted?: () => void }) {
  const { user, toast } = useApp();
  const [serverQuiz, setServerQuiz] = useState<Quiz | null>(null);
  const [serverQuestions, setServerQuestions] = useState<Question[]>([]);
  const [usedAttempts, setUsedAttempts] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [attemptId, setAttemptId] = useState<ID | null>(null);
  const [answers, setAnswers] = useState<Record<ID, string[]>>({});
  const [qIndex, setQIndex] = useState(0);
  const activeQuiz = serverQuiz ?? quiz;
  const [remaining, setRemaining] = useState(activeQuiz.timeLimitMin * 60);
  const [result, setResult] = useState<{ percent: number; passed: boolean; score: number; maxScore: number } | null>(null);
  const questions = useMemo(() => {
    let qs = serverQuestions;
    if (activeQuiz.randomize) qs = [...qs].sort(() => Math.random() - 0.5);
    return qs;
  }, [activeQuiz.id, activeQuiz.randomize, phase === 'run', serverQuestions]);
  const submittedRef = useRef(false);

  useEffect(() => { if (user) void api.quiz(quiz.id).then((response) => { setServerQuiz(response.quiz); setServerQuestions(response.questions); setRemaining(response.quiz.timeLimitMin * 60); }).catch(() => undefined); }, [quiz.id, user]);

  const loadAttempts = () => { if (user) void api.myQuizAttempts({ quiz_id: quiz.id }).then((page) => setUsedAttempts(page.total)).catch(() => undefined); };
  useEffect(loadAttempts, [quiz.id, user?.id]);
  // The server enforces max_attempts on start and submit; this only mirrors it for display.
  const attemptsLeft = activeQuiz.maxAttempts > 0 ? Math.max(0, activeQuiz.maxAttempts - usedAttempts) : -1;

  const submit = async (auto = false) => {
    if (submittedRef.current || !attemptId) return;
    submittedRef.current = true;
    try {
      const r = await api.submitQuiz(attemptId, answers) as { attempt: { percent: number; passed: boolean; score: number; max_score: number } };
      const resultData = r.attempt;
      setResult({ percent: resultData?.percent ?? 0, passed: resultData?.passed ?? false, score: resultData?.score ?? 0, maxScore: resultData?.max_score ?? 0 });
      setPhase('result');
      loadAttempts();
      onSubmitted?.();
      toast(resultData?.passed ? 'success' : 'warning', auto ? 'Waktu habis — jawaban otomatis dikumpulkan.' : resultData?.passed ? `Lulus! Skor ${resultData?.percent}%.` : `Skor ${resultData?.percent}% — belum mencapai batas lulus ${activeQuiz.passingScore}%.`);
    } catch (error) { submittedRef.current = false; toast('error', error instanceof Error ? error.message : 'Gagal mengumpulkan jawaban.'); }
  };

  useEffect(() => {
    if (phase !== 'run') return;
    const iv = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(iv); submit(true); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = async () => {
    if (!user) return;
    try {
      const response = await api.startQuiz(activeQuiz.id) as { attempt: { id: string } };
      setAttemptId(response.attempt.id); setAnswers({}); setQIndex(0); setRemaining(activeQuiz.timeLimitMin * 60); submittedRef.current = false; setPhase('run');
    } catch (error) { toast('error', error instanceof Error ? error.message : 'Gagal memulai quiz.'); }
  };

  const q = questions[qIndex];
  const setAnswer = (qid: ID, value: string, multi: boolean) => {
    setAnswers((a) => {
      if (!multi) return { ...a, [qid]: [value] };
      const cur = a[qid] ?? [];
      return { ...a, [qid]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
    });
  };
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <Modal open onClose={onClose} title={quiz.title} wide footer={
      phase === 'run' ? (
        <>
          <span className={`mr-auto font-mono text-sm font-bold ${remaining < 60 ? 'text-danger-500' : 'text-base-500'}`}><Icon name="clock" size={14} className="inline mr-1.5 -mt-0.5" />{mm}:{ss}</span>
          <button className="btn-ghost" disabled={qIndex === 0} onClick={() => setQIndex(qIndex - 1)}>Sebelumnya</button>
          {qIndex < questions.length - 1
            ? <button className="btn-primary" onClick={() => setQIndex(qIndex + 1)}>Lanjut</button>
            : <button className="btn-primary" onClick={() => submit(false)}><Icon name="send" size={14} /> Kumpulkan Jawaban</button>}
        </>
      ) : undefined
    }>
      {phase === 'intro' && (
        <div className="text-center py-4">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-500"><Icon name="target" size={26} /></span>
          <p className="mt-4 text-sm leading-6 text-base-500 dark:text-base-400">{quiz.description || 'Uji pemahamanmu terhadap materi kelas ini.'}</p>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-base-100 dark:bg-base-850 py-2.5"><p className="font-display font-bold text-base-900 dark:text-base-50">{questions.length}</p><p className="font-mono text-[9px] uppercase text-base-400">Soal</p></div>
            <div className="rounded-lg bg-base-100 dark:bg-base-850 py-2.5"><p className="font-display font-bold text-base-900 dark:text-base-50">{quiz.timeLimitMin} mnt</p><p className="font-mono text-[9px] uppercase text-base-400">Waktu</p></div>
            <div className="rounded-lg bg-base-100 dark:bg-base-850 py-2.5"><p className="font-display font-bold text-base-900 dark:text-base-50">{quiz.passingScore}%</p><p className="font-mono text-[9px] uppercase text-base-400">Batas Lulus</p></div>
          </div>
          <p className="mt-4 font-mono text-xs text-base-400">{attemptsLeft === -1 ? 'Percobaan tak terbatas' : `Sisa percobaan: ${attemptsLeft}`}</p>
          {attemptsLeft === 0
            ? <p className="mt-3 text-sm font-bold text-warn-400">Batas percobaan tercapai.</p>
            : <button className="btn-primary mt-5 px-8" onClick={start} disabled={questions.length === 0}>{questions.length === 0 ? 'Belum ada soal' : 'Mulai Quiz'}</button>}
        </div>
      )}
      {phase === 'run' && q && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-200 dark:bg-base-800">
              <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }} />
            </div>
            <span className="font-mono text-[11px] font-bold text-base-400">{qIndex + 1}/{questions.length}</span>
          </div>
          <div className="mb-1.5 flex items-center gap-2">
            <Badge tone="brand">{q.type === 'single' ? 'Pilihan Ganda' : q.type === 'boolean' ? 'Benar / Salah' : q.type === 'multiple' ? 'Jawaban Ganda' : 'Isian Singkat'}</Badge>
            <span className="font-mono text-[10px] text-base-400">{q.points} poin{q.type === 'multiple' ? ' · pilih semua yang benar' : ''}</span>
          </div>
          <p className="font-display text-base font-bold text-base-900 dark:text-base-50">{q.text}</p>
          <div className="mt-4 space-y-2">
            {(q.type === 'single' || q.type === 'multiple' || q.type === 'boolean') && (
              (q.type === 'boolean' ? [{ id: 'true', text: 'Benar' }, { id: 'false', text: 'Salah' }] : q.options).map((opt) => {
                const selected = (answers[q.id] ?? []).includes(opt.id);
                return (
                  <button key={opt.id} onClick={() => setAnswer(q.id, opt.id, q.type === 'multiple')}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all cursor-pointer ${selected ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-base-200 dark:border-base-700 text-base-700 dark:text-base-200 hover:border-brand-500/50'}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${q.type === 'multiple' ? 'rounded-md' : 'rounded-full'} ${selected ? 'border-brand-500 bg-brand-500 text-base-950' : 'border-base-300 dark:border-base-600'}`}>
                      {selected && <Icon name="check" size={11} />}
                    </span>
                    {opt.text}
                  </button>
                );
              })
            )}
            {q.type === 'short' && (
              <input className="input" placeholder="Ketik jawabanmu…" value={(answers[q.id] ?? [])[0] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: [e.target.value] }))} />
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setQIndex(i)}
                className={`h-8 w-8 rounded-lg font-mono text-[11px] font-bold transition-colors cursor-pointer ${i === qIndex ? 'bg-brand-500 text-base-950' : (answers[qq.id] ?? []).length > 0 ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-base-100 dark:bg-base-800 text-base-400'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 'result' && result && (
        <div className="py-4 text-center">
          <Donut pct={result.percent} size={120} color={result.passed ? 'var(--color-ok-400)' : 'var(--color-danger-400)'} />
          <p className={`mt-4 font-display text-xl font-bold ${result.passed ? 'text-ok-500' : 'text-danger-500'}`}>{result.passed ? 'Selamat, Kamu Lulus!' : 'Belum Lulus'}</p>
          <p className="mt-1 text-sm text-base-500 dark:text-base-400">Skor {result.score}/{result.maxScore} ({result.percent}%) · batas lulus {quiz.passingScore}%</p>
          {!result.passed && attemptsLeft !== 0 && <p className="mt-2 text-xs text-base-400">{attemptsLeft > 0 ? `Kamu masih punya ${attemptsLeft} percobaan.` : ''}</p>}
          <div className="mt-5 flex justify-center gap-2">
            {!result.passed && attemptsLeft !== 0 && <button className="btn-primary" onClick={() => { setPhase('intro'); }}><Icon name="refresh" size={14} /> Coba Lagi</button>}
            <button className="btn-outline" onClick={onClose}>Tutup</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ================= learn player ================= */

export function LearnPage() {
  const { slug } = useParams();
  const { user, toast } = useApp();
  const nav = useNavigate();
  const [remoteDetail, setRemoteDetail] = useState<import('../../lib/api').ApiCourseDetail | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [remoteQuizzes, setRemoteQuizzes] = useState<Quiz[]>([]);
  const [remoteLives, setRemoteLives] = useState<LiveClass[]>([]);
  const [status, setStatus] = useState<LearningStatus | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<ID | null>(null);
  const [quizOpen, setQuizOpen] = useState<Quiz | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const course = remoteDetail?.course;
  useEffect(() => { if (slug) void api.course(slug).then(setRemoteDetail).catch(() => setRemoteDetail(null)); }, [slug]);
  useEffect(() => { if (slug && user) void api.courseProgress(slug).then((progress) => setCompletedLessonIds(progress.completedLessonIds)).catch(() => setCompletedLessonIds([])); }, [slug, user]);
  useEffect(() => { if (course?.id && user && remoteDetail?.enrolled) void api.quizzes(course.id).then(setRemoteQuizzes).catch(() => setRemoteQuizzes([])); }, [course?.id, user, remoteDetail?.enrolled]);
  useEffect(() => { if (course?.id && user && remoteDetail?.enrolled) void api.courseLiveClasses(course.id).then(setRemoteLives).catch(() => setRemoteLives([])); }, [course?.id, user, remoteDetail?.enrolled]);
  const reloadStatus = () => { if (course?.id && user && remoteDetail?.enrolled) void api.learningStatus(course.id).then(setStatus).catch(() => setStatus(null)); };
  useEffect(reloadStatus, [course?.id, user?.id, remoteDetail?.enrolled]);

  const enrolled = !!user && !!course && !!remoteDetail?.enrolled;
  const sections = remoteDetail?.sections ?? [];
  const allLessons = sections.flatMap((section) => section.lessons).filter((lesson) => lesson.status === 'published' || user?.id === course?.instructorId);
  const lesson = allLessons.find((l) => l.id === currentLessonId) ?? allLessons[0] ?? null;
  const prog = status?.progress ?? null;
  const quizzes = remoteQuizzes;
  const quizPassed = (quizId: string) => !!status?.quizzes.find((row) => row.id === quizId)?.passed;
  const cert = status?.certificate && status.certificate.status === 'issued' ? status.certificate : null;
  const claimCertificate = () => {
    if (!course) return;
    setClaiming(true);
    void api.issueCertificate(course.id).then(() => { toast('success', 'Sertifikat diterbitkan.'); reloadStatus(); })
      .catch((error) => toast('error', error instanceof Error ? error.message : 'Sertifikat belum dapat diterbitkan.')).finally(() => setClaiming(false));
  };

  useEffect(() => {
    if (enrolled && !currentLessonId && allLessons[0]) setCurrentLessonId(allLessons[0].id);
  }, [enrolled, currentLessonId, allLessons]);

  if (!course) return <PublicShell><div className="mx-auto max-w-2xl px-4 py-24"><EmptyState icon="alert-circle" title="Kelas tidak ditemukan" action={<Link to="/courses" className="btn-primary">Katalog</Link>} /></div></PublicShell>;

  if (!user || !enrolled) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-xl px-4 py-20 text-center anim-scale">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-400/15 text-accent-500"><Icon name="lock" size={30} /></span>
          <h1 className="mt-5 font-display text-2xl font-bold text-base-900 dark:text-base-50">Materi Terkunci</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-base-500 dark:text-base-400">
            {!user ? 'Masuk atau daftar untuk mengakses kelas ini.' : `Kelas "${course.title}" adalah kelas berbayar. Selesaikan pembelian untuk membuka seluruh materi.`}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {!user
              ? <Link to={`/login?next=/learn/${course.slug}`} className="btn-primary">Masuk / Daftar</Link>
              : <Link to={`/courses/${course.slug}`} className="btn-primary"><Icon name="card" size={15} /> Beli Kelas · {fmtMoney(coursePrice(course))}</Link>}
          </div>
        </div>
      </PublicShell>
    );
  }

  const done = (lessonId: ID) => completedLessonIds.includes(lessonId);
  const idx = lesson ? allLessons.findIndex((l) => l.id === lesson.id) : -1;

  return (
    <div className="min-h-screen bg-base-50 dark:bg-base-950">
      <header className="sticky top-0 z-30 border-b border-base-200 dark:border-base-800 bg-white/90 dark:bg-base-925/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <button onClick={() => nav(`/courses/${course.slug}`)} className="btn-ghost btn-sm"><Icon name="arrow-left" size={14} /> Kelas</button>
          <p className="hidden sm:block truncate font-display text-sm font-bold text-base-900 dark:text-base-50">{course.title}</p>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 w-40">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-200 dark:bg-base-800"><div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${prog?.pct ?? 0}%` }} /></div>
              <span className="font-mono text-[11px] font-bold text-brand-600 dark:text-brand-400">{prog?.pct ?? 0}%</span>
            </div>
            {cert
              ? <button className="btn-primary btn-sm" onClick={() => setCertOpen(true)}><Icon name="award" size={13} /> Sertifikat</button>
              : <span className="font-mono text-[10px] uppercase tracking-wide text-base-400 hidden md:block">{prog?.done ?? 0}/{prog?.total ?? 0} materi</span>}
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-20 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-base-200 dark:border-base-800 bg-white dark:bg-base-900">
          <p className="border-b border-base-200 dark:border-base-800 px-4 py-3 font-display text-sm font-bold text-base-900 dark:text-base-50">Kurikulum</p>
          {sections.map((sec, si) => (
            <div key={sec.id}>
              <p className="flex items-center gap-2 bg-base-100/70 dark:bg-base-850 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-base-400">
                {String(si + 1).padStart(2, '0')} · {sec.title}
              </p>
              {sec.lessons.filter((l) => l.status === 'published' || user.id === course.instructorId).map((l) => (
                <button key={l.id} onClick={() => setCurrentLessonId(l.id)}
                  className={`flex w-full items-center gap-2.5 border-l-2 px-4 py-2.5 text-left text-[13px] font-semibold transition-colors cursor-pointer ${lesson?.id === l.id ? 'border-brand-500 bg-brand-500/[0.07] text-brand-700 dark:text-brand-300' : 'border-transparent text-base-600 dark:text-base-300 hover:bg-base-100 dark:hover:bg-base-850'}`}>
                  <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border ${done(l.id) ? 'border-ok-500 bg-ok-500 text-white' : 'border-base-300 dark:border-base-600'}`}>
                    {done(l.id) && <Icon name="check" size={9} />}
                  </span>
                  <span className="flex-1 truncate">{l.title}</span>
                  <span className="font-mono text-[9px] text-base-400">{l.durationMin}m</span>
                </button>
              ))}
            </div>
          ))}
          {quizzes.length > 0 && (
            <div className="border-t border-base-200 dark:border-base-800 p-3">
              {quizzes.map((qz) => {
                const passed = quizPassed(qz.id);
                return (
                  <button key={qz.id} onClick={() => setQuizOpen(qz)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold transition-colors cursor-pointer ${passed ? 'bg-ok-500/10 text-ok-500' : 'bg-accent-400/10 text-accent-500 hover:bg-accent-400/20'}`}>
                    <Icon name={passed ? 'check-circle' : 'target'} size={16} />
                    <span className="flex-1">{qz.title}</span>
                    <Badge tone={passed ? 'ok' : 'warn'}>{passed ? 'Lulus' : 'Quiz'}</Badge>
                  </button>
                );
              })}
            </div>
          )}
          {remoteLives.length > 0 && (
            <div className="border-t border-base-200 dark:border-base-800 p-3">
              <p className="px-3 pb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-base-400">Live Class</p>
              {remoteLives.map((live) => (
                <button key={live.id} onClick={() => { if (live.joinUrl) window.open(live.joinUrl, '_blank', 'noopener,noreferrer'); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold transition-colors cursor-pointer bg-brand-500/10 text-brand-700 dark:text-brand-300 hover:bg-brand-500/20">
                  <Icon name="play" size={16} />
                  <span className="flex-1">{live.title}</span>
                  <Badge tone={live.displayState === 'cancelled' ? 'neutral' : live.displayState === 'in_session_window' ? 'ok' : 'brand'}>
                    {live.displayState === 'in_session_window' ? 'Berlangsung' : live.displayState === 'upcoming' ? 'Akan datang' : live.displayState === 'ended' ? 'Selesai' : 'Batal'}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </aside>
        <main className="min-w-0">
          {status && !cert && status.eligible && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-ok-500/30 bg-ok-500/10 px-4 py-3 anim-rise">
              <Icon name="award" size={18} className="text-ok-500" />
              <p className="flex-1 text-sm font-bold text-ok-500">Semua materi & quiz selesai — sertifikatmu siap diterbitkan.</p>
              <button className="btn-primary btn-sm" disabled={claiming} onClick={claimCertificate}>{claiming ? <Spinner size={13} /> : <Icon name="award" size={13} />} Terbitkan</button>
            </div>
          )}
          {status && !cert && !status.eligible && prog && prog.pct === 100 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent-400/30 bg-accent-400/10 px-4 py-3 text-sm font-semibold text-accent-500 anim-rise">
              <Icon name="info" size={17} /> Semua quiz aktif harus lulus sebelum sertifikat terbit.
            </div>
          )}
          {cert && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-ok-500/30 bg-ok-500/10 px-4 py-3 anim-rise">
              <Icon name="award" size={18} className="text-ok-500" />
              <p className="flex-1 text-sm font-bold text-ok-500">Selamat! Sertifikatmu sudah terbit — {cert.number}</p>
              <button className="btn-primary btn-sm" onClick={() => setCertOpen(true)}>Lihat</button>
            </div>
          )}
          {lesson ? (
            <div className="card overflow-hidden anim-rise" key={lesson.id}>
              <div className="border-b border-base-200 dark:border-base-800 px-6 py-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-base-400">Materi {idx + 1} · {lesson.durationMin} menit</p>
                <h1 className="mt-1 font-display text-xl font-bold text-base-900 dark:text-base-50">{lesson.title}</h1>
              </div>
              <div className="p-6"><LessonContent lesson={lesson} /></div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-200 dark:border-base-800 px-6 py-4">
                <button className="btn-ghost btn-sm" disabled={idx <= 0} onClick={() => setCurrentLessonId(allLessons[idx - 1].id)}><Icon name="arrow-left" size={13} /> Sebelumnya</button>
                <button
                  className={done(lesson.id) ? 'btn-outline btn-sm' : 'btn-primary btn-sm'}
                  onClick={() => {
                    const wasDone = done(lesson.id);
                    if (wasDone) { toast('info', 'Materi ini sudah selesai.'); return; }
                    void api.completeLesson(course.slug, lesson.id).then((response: any) => {
                      setCompletedLessonIds((ids) => ids.includes(lesson.id) ? ids : [...ids, lesson.id]);
                      reloadStatus();
                      toast('success', response?.enrollment?.status === 'completed' ? 'Course selesai. Selamat!' : 'Materi ditandai selesai.');
                    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyimpan progress.'));
                  }}>
                  <Icon name="check-circle" size={14} /> {done(lesson.id) ? 'Sudah Selesai' : 'Tandai Selesai'}
                </button>
                <button className="btn-primary btn-sm" disabled={idx >= allLessons.length - 1} onClick={() => setCurrentLessonId(allLessons[idx + 1].id)}>Lanjut <Icon name="arrow-right" size={13} /></button>
              </div>
            </div>
          ) : (
            <EmptyState icon="book-open" title="Belum ada materi" sub="Instructor belum menambahkan materi ke kelas ini." />
          )}
        </main>
      </div>
      {quizOpen && <QuizPlayer quiz={quizOpen} onClose={() => setQuizOpen(null)} onSubmitted={reloadStatus} />}
      {certOpen && cert && <CertificateModal certificate={cert} open onClose={() => setCertOpen(false)} />}
    </div>
  );
}

/* ================= checkout / payment ================= */

const FINAL_ORDER_STATES = ['paid', 'failed', 'expired', 'cancelled'];

export function CheckoutPage() {
  const { orderId } = useParams();
  const { user, toast } = useApp();
  const nav = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [method, setMethod] = useState('');
  const [stage, setStage] = useState<'method' | 'processing' | 'success' | 'failed'>('method');
  const [payRef, setPayRef] = useState('');
  const [busy, setBusy] = useState(false);
  // Provider, mode and methods come from the server; the buyer only picks a method.
  const options = useRemote(() => api.paymentOptions(), [user?.id]);

  useEffect(() => {
    if (user && orderId) api.order(orderId).then(setOrder).catch(() => setOrder(null)).finally(() => setLoaded(true));
  }, [orderId, user]);

  // While waiting for the provider webhook, poll the server order (every 5 s, up to 10 minutes).
  useEffect(() => {
    if (stage !== 'processing' || !orderId) return;
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      void api.order(orderId).then((fresh) => {
        setOrder(fresh);
        if (fresh.status === 'paid') { setStage('success'); window.clearInterval(timer); }
        else if (FINAL_ORDER_STATES.includes(fresh.status)) { setStage('failed'); window.clearInterval(timer); }
      }).catch(() => undefined);
      if (ticks >= 120) window.clearInterval(timer);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [stage, orderId]);

  if (!loaded && user) {
    return <PublicShell><div className="flex justify-center py-24"><Spinner size={28} /></div></PublicShell>;
  }
  if (!order || (user && order.userId !== user.id)) {
    return <PublicShell><div className="mx-auto max-w-xl px-4 py-24"><EmptyState icon="receipt" title="Order tidak ditemukan" action={<Link to="/" className="btn-primary">Ke Beranda</Link>} /></div></PublicShell>;
  }
  if (order.status === 'paid' && stage !== 'success') {
    return (
      <PublicShell>
        <div className="mx-auto max-w-xl px-4 py-20 text-center anim-scale">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-500/15 text-ok-500"><Icon name="check-circle" size={30} /></span>
          <h1 className="mt-5 font-display text-2xl font-bold text-base-900 dark:text-base-50">Order Sudah Dibayar</h1>
          <p className="mt-2 text-sm text-base-500">Transaksi ini telah selesai dan akses sudah diberikan.</p>
          <Link to={order.type === 'course' ? '/dashboard/my-learning' : '/dashboard/digital'} className="btn-primary mt-6 inline-flex">{order.type === 'course' ? 'Mulai Belajar' : 'Produk Saya'}</Link>
        </div>
      </PublicShell>
    );
  }

  const mode = options.data?.mode ?? 'sandbox';
  const gatewayName = options.data ? options.data.gateway.charAt(0).toUpperCase() + options.data.gateway.slice(1) : '—';

  const pay = async () => {
    if (!order || !method) return;
    setBusy(true);
    try {
      const response = await api.initiatePayment(order.id, method);
      setPayRef(response.payment.reference);
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
        return;
      }
      setStage('processing');
      toast('info', 'Payment dibuat. Menunggu konfirmasi webhook gateway.');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Gagal membuat payment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-base-400 hover:text-brand-500 transition-colors anim-rise"><Icon name="arrow-left" size={14} /> Kembali</Link>
        <h1 className="mt-3 font-display text-2xl font-bold text-base-900 dark:text-base-50 anim-rise">Checkout</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-base-500 anim-rise">
          {options.data && <Badge tone={mode === 'sandbox' ? 'warn' : 'ok'} dot>{mode === 'sandbox' ? 'SANDBOX MODE' : 'LIVE MODE'}</Badge>}
          Pembayaran diproses melalui payment gateway dengan verifikasi webhook.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card p-6 anim-rise">
            {stage === 'method' && (
              <>
                <p className="label">Payment Gateway</p>
                <p className="mb-4 rounded-xl border-2 border-brand-500 bg-brand-500/10 px-4 py-3 text-sm font-bold text-brand-700 dark:text-brand-300">{gatewayName}</p>
                <p className="label">Metode Pembayaran</p>
                <RemoteView remote={options} isEmpty={(o) => o.methods.length === 0} emptyTitle="Metode pembayaran belum tersedia">
                  {(o) => (
                    <div className="space-y-2">
                      {o.methods.map((m) => (
                        <button key={m.key} onClick={() => setMethod(m.key)}
                          className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all cursor-pointer ${method === m.key ? 'border-brand-500 bg-brand-500/10' : 'border-base-200 dark:border-base-700 hover:border-brand-500/50'}`}>
                          <Icon name={m.key.includes('VA') || m.key === 'QRIS' ? 'receipt' : m.key.includes('CARD') || m.key === 'LINK' ? 'card' : 'wallet'} size={18} className={method === m.key ? 'text-brand-500' : 'text-base-400'} />
                          <span className="flex-1 text-sm font-bold text-base-800 dark:text-base-100">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </RemoteView>
                <button className="btn-primary mt-6 w-full py-3" disabled={!method || busy || order.status !== 'pending'} onClick={() => void pay()}>
                  {busy ? <Spinner size={15} /> : <Icon name="card" size={16} />} Bayar {fmtMoney(order.total)}
                </button>
                {order.status !== 'pending' && <p className="mt-2 text-center text-xs text-danger-500">Order berstatus {order.status} dan tidak dapat dibayar.</p>}
                {mode === 'sandbox' && options.data && (
                  <div className="mt-3 rounded-xl border border-warn-400/30 bg-warn-400/[0.07] p-3.5">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent-500">Sandbox</p>
                    <p className="mt-2 text-[11px] leading-4 text-base-400">Mode sandbox tidak menghubungi provider. Status hanya berubah setelah webhook dengan signature terverifikasi.</p>
                  </div>
                )}
              </>
            )}
            {stage === 'processing' && (
              <div className="py-14 text-center">
                <Spinner size={34} />
                <p className="mt-5 font-display text-base font-bold text-base-900 dark:text-base-50">Memproses pembayaran…</p>
                <p className="mt-1 font-mono text-xs text-base-400">{payRef}</p>
                <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-base-400">Menunggu callback webhook dari {gatewayName}. Status diperbarui otomatis.</p>
              </div>
            )}
            {stage === 'success' && (
              <div className="py-10 text-center anim-scale">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-500/15 text-ok-500"><Icon name="check-circle" size={30} /></span>
                <p className="mt-4 font-display text-xl font-bold text-base-900 dark:text-base-50">Pembayaran Berhasil!</p>
                <p className="mt-1 font-mono text-xs text-base-400">{payRef}</p>
                {order.type === 'course' && <p className="mt-2 text-sm text-base-500">Enrollment aktif — materi kelas sudah terbuka.</p>}
                <div className="mt-6 flex justify-center gap-2">
                  {order.type === 'course'
                    ? <button className="btn-primary" onClick={() => nav('/dashboard/my-learning')}><Icon name="play" size={15} /> Mulai Belajar</button>
                    : <button className="btn-primary" onClick={() => nav('/dashboard/digital')}>Produk Saya</button>}
                  <Link to="/dashboard/orders" className="btn-outline">Riwayat Order</Link>
                </div>
              </div>
            )}
            {stage === 'failed' && (
              <div className="py-10 text-center anim-scale">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-500/15 text-danger-500"><Icon name="alert-circle" size={30} /></span>
                <p className="mt-4 font-display text-xl font-bold text-base-900 dark:text-base-50">Pembayaran Gagal</p>
                <p className="mt-1 text-sm text-base-500">Order berstatus {order.status}. Akses belum diberikan.</p>
                <div className="mt-6 flex justify-center gap-2">
                  {order.status === 'pending' && <button className="btn-primary" onClick={() => setStage('method')}><Icon name="refresh" size={15} /> Coba Lagi</button>}
                  <Link to={`/courses`} className="btn-outline">Kembali</Link>
                </div>
              </div>
            )}
          </div>

          <div className="card h-fit p-6 anim-rise" style={{ animationDelay: '100ms' }}>
            <p className="label">{`Ringkasan Order`}</p>
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-base-100 dark:border-base-800">
                <SafeImg src={it.thumbnail} alt={it.title} label={it.title} className="h-12 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-base-800 dark:text-base-100">{it.title}</p>
                  <p className="font-mono text-[10px] text-base-400">{it.kind === 'course' ? 'Course Purchase' : `Shop · ${it.qty}x`}</p>
                </div>
                <span className="font-display text-sm font-bold text-base-900 dark:text-base-50">{fmtMoney(it.price * it.qty)}</span>
              </div>
            ))}
            <div className="mt-3 space-y-1.5 text-sm">
              <p className="flex justify-between text-base-500"><span>Subtotal</span><span className="font-mono">{fmtMoney(order.subtotal)}</span></p>
              {order.discountAmount > 0 && (
                <p className="flex justify-between font-semibold text-ok-500"><span className="flex items-center gap-1.5"><Icon name="tag" size={12} />Voucher {order.voucherCode}</span><span className="font-mono">−{fmtMoney(order.discountAmount)}</span></p>
              )}
              {order.shippingCost > 0 && (
                <p className="flex justify-between text-base-500"><span>Ongkir{order.shippingCourierName ? ` · ${order.shippingCourierName}${order.shippingService ? ` ${order.shippingService}` : ''}` : ''}{order.shippingEtd ? ` · ${order.shippingEtd}` : ''}</span><span className="font-mono">{fmtMoney(order.shippingCost)}</span></p>
              )}
              <p className="flex justify-between border-t border-base-200 dark:border-base-700 pt-2 font-display text-base font-bold text-base-900 dark:text-base-50"><span>Total</span><span>{fmtMoney(order.total)}</span></p>
            </div>
            {order.type === 'shop' && (
              order.needsShipping ? (
                <div className="mt-4 rounded-lg bg-base-100 dark:bg-base-850 p-3.5">
                  <p className="label !mb-1">Kirim ke</p>
                  <p className="text-sm font-bold text-base-800 dark:text-base-100">{order.shippingName} · {order.shippingPhone}</p>
                  <p className="text-xs leading-5 text-base-500">{order.shippingAddress}</p>
                  {(order.shippingCityName || order.shippingProvinceName) && (
                    <p className="text-xs leading-5 text-base-500">
                      {[order.shippingSubdistrictName, order.shippingDistrictName, order.shippingCityName, order.shippingProvinceName].filter(Boolean).join(', ')}
                      {order.shippingPostalCode ? ` ${order.shippingPostalCode}` : ''}
                    </p>
                  )}
                  {(order.shippingCourierName || order.shippingCost > 0) && (
                    <p className="mt-1.5 text-xs font-bold text-base-700 dark:text-base-200">
                      {order.shippingCourierName}{order.shippingService ? ` · ${order.shippingService}` : ''} · {fmtMoney(order.shippingCost)}
                      {order.shippingEtd ? ` · Estimasi ${order.shippingEtd}` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-500/[0.07] border border-brand-500/25 p-3 text-[11px] leading-4 text-brand-700 dark:text-brand-300">
                  <Icon name="download" size={14} className="mt-0.5 shrink-0" />
                  Produk digital — tanpa pengiriman. File & license key otomatis tersedia di Dashboard → Produk Digital setelah pembayaran berhasil.
                </p>
              )
            )}
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-base-100 dark:bg-base-850 p-3 text-[11px] leading-4 text-base-400">
              <Icon name="shield" size={14} className="mt-0.5 shrink-0 text-brand-500" />
              Status diverifikasi via callback/webhook + signature. Proteksi duplikasi aktif — webhook ganda tidak memproses ulang.
            </p>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
