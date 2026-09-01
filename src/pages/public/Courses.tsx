import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db, type Course, type Lesson, type Quiz, type ID, type GatewayKey } from '../../lib/db';
import { fmtMoney, youtubeId } from '../../lib/services';
import { CourseService, CategoryService, CurriculumService, EnrollmentService, ProgressService, QuizService, CertificateService, canViewLesson, EnrollmentError } from '../../lib/lms';
import { OrderService, PaymentService, GATEWAYS, activeGateway, gatewayMode } from '../../lib/commerce';
import { useApp, useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import { Badge, Donut, EmptyState, Modal, RichHTML, SafeImg, Select, Spinner, StatusBadge, YouTube } from '../../components/ui';
import { PublicShell } from '../../components/Shell';
import { CourseCard } from './Public';
import { CertificateModal } from './Certificates';

/* ================= catalog ================= */

export function CoursesCatalog() {
  useDB();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = params.get('cat') ?? '';
  const level = params.get('level') ?? '';
  const type = params.get('type') ?? '';
  const sort = params.get('sort') ?? 'latest';

  let list = CourseService.published()
    .filter((c) => (!q || c.title.toLowerCase().includes(q.toLowerCase()) || c.shortDescription.toLowerCase().includes(q.toLowerCase()) || c.tags.some((t) => t.toLowerCase().includes(q.toLowerCase())))
      && (!cat || c.categoryId === cat) && (!level || c.level === level)
      && (!type || (type === 'free' ? c.isFree : !c.isFree)));
  list = [...list].sort((a, b) => sort === 'popular' ? CourseService.studentsCount(b.id) - CourseService.studentsCount(a.id)
    : sort === 'price_asc' ? CourseService.effectivePrice(a) - CourseService.effectivePrice(b)
    : sort === 'price_desc' ? CourseService.effectivePrice(b) - CourseService.effectivePrice(a)
    : b.createdAt - a.createdAt);

  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });

  return (
    <PublicShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 anim-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-500 flex items-center gap-2"><Icon name="book" size={14} /> Katalog</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-base-900 dark:text-base-50">Kelas Online</h1>
          <p className="mt-1 text-sm text-base-500 dark:text-base-400">{list.length} kelas tersedia — gratis & berbayar dengan sertifikat digital.</p>
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2.5 anim-rise">
          <div className="relative min-w-52 flex-1 sm:max-w-sm">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
            <input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Cari kelas, topik, atau tag…" className="input pl-9" />
          </div>
          <Select value={cat} onChange={(e) => set('cat', e.target.value)} className="w-auto">
            <option value="">Semua Kategori</option>
            {CategoryService.byScope('course').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        {list.length === 0 ? (
          <EmptyState icon="book" title={q || cat || level || type ? 'Tidak ada kelas yang cocok' : 'Belum ada kelas tersedia'}
            sub={q || cat || level || type ? 'Coba ubah kata kunci atau filter.' : 'Kelas yang dipublikasikan instructor akan tampil di sini.'} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c, i) => <CourseCard key={c.id} course={c} delay={(i % 3) * 60} />)}
          </div>
        )}
      </div>
    </PublicShell>
  );
}

/* ================= course detail ================= */

export function CourseDetailPage() {
  useDB();
  const { slug } = useParams();
  const { user, toast } = useApp();
  const nav = useNavigate();
  const course = CourseService.bySlug(slug ?? '');
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [certOpenId, setCertOpenId] = useState<string | null>(null);

  if (!course) {
    return <PublicShell><div className="mx-auto max-w-2xl px-4 py-24"><EmptyState icon="alert-circle" title="Kelas tidak ditemukan" action={<Link to="/courses" className="btn-primary">Lihat Katalog</Link>} /></div></PublicShell>;
  }
  const isOwner = user?.id === course.instructorId;
  const isStaff = user?.roleKey === 'super_admin' || user?.roleKey === 'admin';
  if (course.status !== 'published' && !isOwner && !isStaff) {
    return <PublicShell><div className="mx-auto max-w-2xl px-4 py-24"><EmptyState icon="lock" title="Kelas belum tersedia" sub="Kelas ini belum dipublikasikan." action={<Link to="/courses" className="btn-primary">Lihat Katalog</Link>} /></div></PublicShell>;
  }

  const enrolled = user ? EnrollmentService.has(user.id, course.id) : false;
  const prog = user && enrolled ? ProgressService.of(user.id, course.id) : null;
  const price = CourseService.effectivePrice(course);
  const instructor = db.byId('users', course.instructorId);
  const sections = CurriculumService.sections(course.id);
  const cert = user ? CertificateService.activeFor(user.id, course.id) : undefined;

  const enrollFree = () => {
    if (!user) { nav(`/login?next=/courses/${course.slug}`); return; }
    setBusy(true);
    setTimeout(() => {
      try {
        EnrollmentService.enrollFree(user, course);
        toast('success', 'Berhasil mendaftar! Selamat belajar.');
        nav(`/learn/${course.slug}`);
      } catch (e) { toast('error', e instanceof EnrollmentError ? e.message : 'Gagal mendaftar.'); }
      setBusy(false);
    }, 400);
  };

  const buy = () => {
    if (!user) { nav(`/login?next=/courses/${course.slug}`); return; }
    setBusy(true);
    setTimeout(() => {
      const { order } = OrderService.createCourseOrder(user, course);
      nav(`/checkout/${order.id}`);
    }, 300);
  };

  return (
    <PublicShell>
      <section className="relative overflow-hidden border-b border-base-200 dark:border-base-800 bg-base-900 dark:bg-base-925 text-base-100">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-brand-500/12 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="anim-rise">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{CategoryService.name(course.categoryId)}</Badge>
              <Badge tone="neutral"><span className="normal-case">{course.level}</span></Badge>
              {course.status !== 'published' && <StatusBadge status={course.status} />}
            </div>
            <h1 className="mt-4 font-display text-2xl sm:text-4xl font-bold leading-tight text-base-50">{course.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-base-300">{course.shortDescription}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-base-300">
              <span className="flex items-center gap-2"><SafeImg src={instructor?.avatar} alt={instructor?.name ?? ''} label={instructor?.name} className="h-7 w-7 rounded-full object-cover" /><b className="text-base-100">{instructor?.name}</b></span>
              <span className="flex items-center gap-1.5 font-mono text-xs"><Icon name="play" size={13} /> {CourseService.lessonCount(course.id)} materi</span>
              <span className="flex items-center gap-1.5 font-mono text-xs"><Icon name="clock" size={13} /> {CourseService.duration(course.id)} menit</span>
              <span className="flex items-center gap-1.5 font-mono text-xs"><Icon name="users" size={13} /> {CourseService.studentsCount(course.id)} student</span>
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
                      {cert && <button onClick={() => setCertOpenId(cert.id)} className="btn-outline w-full"><Icon name="award" size={15} /> Lihat Sertifikat</button>}
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
              <p className="text-xs text-base-400 font-mono">{sections.length} section · {CourseService.lessonCount(course.id)} materi · {CourseService.duration(course.id)} menit</p>
            </div>
            {sections.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-base-400">Kurikulum sedang disusun.</p>
            ) : sections.map((sec, si) => {
              const lessons = CurriculumService.lessonsOf(sec.id);
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
                        const viewable = canViewLesson(user, course, l);
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
              <div className="rounded-lg bg-base-100 dark:bg-base-850 py-2"><p className="font-display font-bold text-base-900 dark:text-base-50">{db.count('courses', (c) => c.instructorId === course.instructorId && c.status === 'published')}</p><p className="font-mono text-[9px] uppercase text-base-400">Kelas</p></div>
              <div className="rounded-lg bg-base-100 dark:bg-base-850 py-2"><p className="font-display font-bold text-base-900 dark:text-base-50">{db.count('enrollments', (e) => db.byId('courses', e.courseId)?.instructorId === course.instructorId)}</p><p className="font-mono text-[9px] uppercase text-base-400">Student</p></div>
            </div>
          </div>
          <RelatedCourses current={course} />
        </div>
      </div>

      <Modal open={!!previewLesson} onClose={() => setPreviewLesson(null)} title={previewLesson?.title ?? ''} wide>
        {previewLesson && <LessonContent lesson={previewLesson} />}
      </Modal>
      {certOpenId && <CertificateModal certId={certOpenId} open onClose={() => setCertOpenId(null)} />}
    </PublicShell>
  );

  function roleWord(k?: string) { return k === 'instructor' ? 'Instructor' : 'Pengajar'; }
}

function RelatedCourses({ current }: { current: Course }) {
  const related = CourseService.published().filter((c) => c.id !== current.id && (c.categoryId === current.categoryId || c.instructorId === current.instructorId)).slice(0, 3);
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
              <p className="mt-1 font-display text-xs font-bold text-brand-600 dark:text-brand-400">{c.isFree ? 'Gratis' : fmtMoney(CourseService.effectivePrice(c))}</p>
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

export function QuizPlayer({ quiz, courseId, onClose }: { quiz: Quiz; courseId: ID; onClose: () => void }) {
  const { user, toast } = useApp();
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [attemptId, setAttemptId] = useState<ID | null>(null);
  const [answers, setAnswers] = useState<Record<ID, string[]>>({});
  const [qIndex, setQIndex] = useState(0);
  const [remaining, setRemaining] = useState(quiz.timeLimitMin * 60);
  const [result, setResult] = useState<{ percent: number; passed: boolean; score: number; maxScore: number } | null>(null);
  const questions = useMemo(() => {
    let qs = QuizService.questions(quiz.id);
    if (quiz.randomize) qs = [...qs].sort(() => Math.random() - 0.5);
    return qs;
  }, [quiz.id, quiz.randomize, phase === 'run']);
  const submittedRef = useRef(false);

  const myAttempts = user ? QuizService.attemptsOf(user.id, quiz.id).filter((a) => a.status === 'submitted') : [];
  const attemptsLeft = quiz.maxAttempts > 0 ? Math.max(0, quiz.maxAttempts - myAttempts.length) : -1;

  const submit = (auto = false) => {
    if (submittedRef.current || !attemptId) return;
    submittedRef.current = true;
    const r = QuizService.submit(attemptId, answers);
    setResult({ percent: r?.percent ?? 0, passed: r?.passed ?? false, score: r?.score ?? 0, maxScore: r?.maxScore ?? 0 });
    setPhase('result');
    toast(r?.passed ? 'success' : 'warning', auto ? 'Waktu habis — jawaban otomatis dikumpulkan.' : r?.passed ? `Lulus! Skor ${r?.percent}%.` : `Skor ${r?.percent}% — belum mencapai batas lulus ${quiz.passingScore}%.`);
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

  const start = () => {
    if (!user) return;
    const attempt = QuizService.start(user, quiz);
    setAttemptId(attempt.id);
    setAnswers({}); setQIndex(0); setRemaining(quiz.timeLimitMin * 60);
    submittedRef.current = false;
    setPhase('run');
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
  useDB();
  const { slug } = useParams();
  const { user, toast } = useApp();
  const nav = useNavigate();
  const course = CourseService.bySlug(slug ?? '');
  const [currentLessonId, setCurrentLessonId] = useState<ID | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);

  const enrolled = !!user && !!course && EnrollmentService.has(user.id, course.id);
  const sections = course ? CurriculumService.sections(course.id) : [];
  const allLessons = course ? CurriculumService.lessons(course.id).filter((l) => l.status === 'published' || user?.id === course.instructorId) : [];
  const lesson = allLessons.find((l) => l.id === currentLessonId) ?? allLessons[0] ?? null;
  const prog = user && course ? ProgressService.of(user.id, course.id) : null;
  const quizzes = course ? QuizService.byCourse(course.id).filter((qz) => qz.active) : [];
  const cert = user && course ? CertificateService.activeFor(user.id, course.id) : undefined;
  const eligibility = user && course ? CertificateService.eligibility(user, course.id) : null;

  useEffect(() => {
    if (course && user && enrolled && !currentLessonId) {
      const enr = EnrollmentService.get(user.id, course.id);
      if (enr?.lastLessonId && allLessons.some((l) => l.id === enr.lastLessonId)) setCurrentLessonId(enr.lastLessonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, enrolled]);

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
              : <Link to={`/courses/${course.slug}`} className="btn-primary"><Icon name="card" size={15} /> Beli Kelas · {fmtMoney(CourseService.effectivePrice(course))}</Link>}
          </div>
        </div>
      </PublicShell>
    );
  }

  const done = (lessonId: ID) => ProgressService.isDone(user.id, lessonId);
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
              {CurriculumService.lessonsOf(sec.id).filter((l) => l.status === 'published' || user.id === course.instructorId).map((l) => (
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
                const passed = !!QuizService.passedAttempt(user.id, qz.id);
                return (
                  <button key={qz.id} onClick={() => setQuizOpen(true)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold transition-colors cursor-pointer ${passed ? 'bg-ok-500/10 text-ok-500' : 'bg-accent-400/10 text-accent-500 hover:bg-accent-400/20'}`}>
                    <Icon name={passed ? 'check-circle' : 'target'} size={16} />
                    <span className="flex-1">{qz.title}</span>
                    <Badge tone={passed ? 'ok' : 'warn'}>{passed ? 'Lulus' : 'Quiz'}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
        <main className="min-w-0">
          {eligibility && !eligibility.ok && prog && prog.pct === 100 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent-400/30 bg-accent-400/10 px-4 py-3 text-sm font-semibold text-accent-500 anim-rise">
              <Icon name="info" size={17} /> {eligibility.reason}
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
                    const hadCert = !!CertificateService.activeFor(user.id, lesson.courseId);
                    const wasDone = done(lesson.id);
                    const issued = ProgressService.toggle(user, lesson);
                    const newCert = !!issued && !hadCert;
                    toast('success', newCert ? 'Sertifikat diterbitkan! Selamat!' : wasDone ? 'Tandai selesai dibatalkan.' : 'Materi ditandai selesai.');
                    if (newCert) setCertOpen(true);
                  }}>
                  <Icon name={done(lesson.id) ? 'refresh' : 'check-circle'} size={14} /> {done(lesson.id) ? 'Batalkan Selesai' : 'Tandai Selesai'}
                </button>
                <button className="btn-primary btn-sm" disabled={idx >= allLessons.length - 1} onClick={() => setCurrentLessonId(allLessons[idx + 1].id)}>Lanjut <Icon name="arrow-right" size={13} /></button>
              </div>
            </div>
          ) : (
            <EmptyState icon="book-open" title="Belum ada materi" sub="Instructor belum menambahkan materi ke kelas ini." />
          )}
        </main>
      </div>
      {quizOpen && quizzes.length > 0 && <QuizPlayer quiz={quizzes[0]} courseId={course.id} onClose={() => setQuizOpen(false)} />}
      {certOpen && cert && <CertificateModal certId={cert.id} open onClose={() => setCertOpen(false)} />}
    </div>
  );
}

/* ================= checkout / payment ================= */

export function CheckoutPage() {
  useDB();
  const { orderId } = useParams();
  const { user, toast } = useApp();
  const nav = useNavigate();
  const order = OrderService.byId(orderId ?? '');
  const [gwKey, setGwKey] = useState<GatewayKey>(activeGateway().key);
  const [method, setMethod] = useState('');
  const [stage, setStage] = useState<'method' | 'processing' | 'success' | 'failed'>('method');
  const [payRef, setPayRef] = useState('');

  if (!order || (user && order.userId !== user.id)) {
    return <PublicShell><div className="mx-auto max-w-xl px-4 py-24"><EmptyState icon="receipt" title="Order tidak ditemukan" action={<Link to="/" className="btn-primary">Ke Beranda</Link>} /></div></PublicShell>;
  }
  if (order.status === 'paid') {
    return (
      <PublicShell>
        <div className="mx-auto max-w-xl px-4 py-20 text-center anim-scale">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-500/15 text-ok-500"><Icon name="check-circle" size={30} /></span>
          <h1 className="mt-5 font-display text-2xl font-bold text-base-900 dark:text-base-50">Order Sudah Dibayar</h1>
          <p className="mt-2 text-sm text-base-500">Transaksi ini telah selesai dan akses sudah diberikan.</p>
          <Link to={order.type === 'course' ? '/dashboard/my-learning' : '/shop'} className="btn-primary mt-6 inline-flex">{order.type === 'course' ? 'Mulai Belajar' : 'Kembali ke Toko'}</Link>
        </div>
      </PublicShell>
    );
  }

  const gw = GATEWAYS.find((g) => g.key === gwKey)!;
  const mode = gatewayMode();

  const pay = async (outcome: 'paid' | 'failed') => {
    const payment = PaymentService.initiate(order, gwKey, method);
    setPayRef(payment.reference);
    setStage('processing');
    const res = await PaymentService.fireSandboxWebhook(payment.reference, outcome);
    if (res.result === 'processed') {
      setStage(outcome === 'paid' ? 'success' : 'failed');
      toast(outcome === 'paid' ? 'success' : 'error', outcome === 'paid' ? 'Pembayaran berhasil — akses kelas dibuka!' : 'Pembayaran gagal.');
    } else {
      setStage('failed');
    }
  };

  const payable = Math.max(0, order.subtotal - (order.discountAmount || 0));
  const chosenMethod = gw.methods.find((m) => m.key === method);
  const fee = chosenMethod ? (chosenMethod.fee.kind === 'flat' ? chosenMethod.fee.value : Math.round((payable * chosenMethod.fee.value) / 100)) : 0;

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-base-400 hover:text-brand-500 transition-colors anim-rise"><Icon name="arrow-left" size={14} /> Kembali</Link>
        <h1 className="mt-3 font-display text-2xl font-bold text-base-900 dark:text-base-50 anim-rise">Checkout</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-base-500 anim-rise">
          <Badge tone={mode === 'sandbox' ? 'warn' : 'ok'} dot>{mode === 'sandbox' ? 'SANDBOX MODE' : 'LIVE MODE'}</Badge>
          Pembayaran diproses melalui payment gateway dengan verifikasi webhook.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card p-6 anim-rise">
            {stage === 'method' && (
              <>
                <p className="label">1 · Payment Gateway</p>
                <div className="grid grid-cols-3 gap-2">
                  {GATEWAYS.map((g) => (
                    <button key={g.key} onClick={() => { setGwKey(g.key); setMethod(''); }}
                      className={`rounded-xl border-2 px-3 py-3 text-sm font-bold transition-all cursor-pointer ${gwKey === g.key ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-base-200 dark:border-base-700 text-base-500 hover:border-base-300 dark:hover:border-base-600'}`}>
                      {g.name}
                    </button>
                  ))}
                </div>
                <p className="label mt-6">2 · {`Metode Pembayaran`}</p>
                <div className="space-y-2">
                  {gw.methods.map((m) => (
                    <button key={m.key} onClick={() => setMethod(m.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all cursor-pointer ${method === m.key ? 'border-brand-500 bg-brand-500/10' : 'border-base-200 dark:border-base-700 hover:border-brand-500/50'}`}>
                      <Icon name={m.key.includes('VA') || m.key === 'QRIS' ? 'receipt' : m.key.includes('CARD') || m.key === 'LINK' ? 'card' : 'wallet'} size={18} className={method === m.key ? 'text-brand-500' : 'text-base-400'} />
                      <span className="flex-1 text-sm font-bold text-base-800 dark:text-base-100">{m.label}</span>
                      <span className="font-mono text-[10px] text-base-400">+{m.fee.kind === 'flat' ? fmtMoney(m.fee.value) : `${m.fee.value}%`}</span>
                    </button>
                  ))}
                </div>
                <button className="btn-primary mt-6 w-full py-3" disabled={!method} onClick={() => pay('paid')}>
                  <Icon name="card" size={16} /> Bayar {fmtMoney(payable + fee)}
                </button>
                {mode === 'sandbox' && (
                  <div className="mt-3 rounded-xl border border-warn-400/30 bg-warn-400/[0.07] p-3.5">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent-500">Sandbox Testing</p>
                    <div className="mt-2 flex gap-2">
                      <button className="btn-outline btn-sm flex-1" disabled={!method} onClick={() => pay('paid')}><Icon name="check" size={12} className="text-ok-500" /> Simulasi Sukses</button>
                      <button className="btn-outline btn-sm flex-1" disabled={!method} onClick={() => pay('failed')}><Icon name="x" size={12} className="text-danger-500" /> Simulasi Gagal</button>
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-base-400">Webhook dikirim dengan signature terverifikasi & proteksi duplikasi (idempotency) — sama seperti arsitektur production.</p>
                  </div>
                )}
              </>
            )}
            {stage === 'processing' && (
              <div className="py-14 text-center">
                <Spinner size={34} />
                <p className="mt-5 font-display text-base font-bold text-base-900 dark:text-base-50">Memproses pembayaran…</p>
                <p className="mt-1 font-mono text-xs text-base-400">{payRef}</p>
                <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-base-400">Menunggu callback webhook dari {gw.name}. Jangan tutup halaman ini.</p>
              </div>
            )}
            {stage === 'success' && (
              <div className="py-10 text-center anim-scale">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-500/15 text-ok-500"><Icon name="check-circle" size={30} /></span>
                <p className="mt-4 font-display text-xl font-bold text-base-900 dark:text-base-50">Pembayaran Berhasil!</p>
                <p className="mt-1 font-mono text-xs text-base-400">{payRef} · signature valid · webhook processed</p>
                {order.type === 'course' && <p className="mt-2 text-sm text-base-500">Enrollment aktif — materi kelas sudah terbuka.</p>}
                <div className="mt-6 flex justify-center gap-2">
                  {order.type === 'course'
                    ? <button className="btn-primary" onClick={() => { const c = db.byId('courses', order.items[0]?.refId ?? ''); if (c) nav(`/learn/${(c as Course).slug}`); else nav('/dashboard/my-learning'); }}><Icon name="play" size={15} /> Mulai Belajar</button>
                    : <button className="btn-primary" onClick={() => nav('/shop')}>Kembali ke Toko</button>}
                  <Link to="/dashboard/orders" className="btn-outline">Riwayat Order</Link>
                </div>
              </div>
            )}
            {stage === 'failed' && (
              <div className="py-10 text-center anim-scale">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-500/15 text-danger-500"><Icon name="alert-circle" size={30} /></span>
                <p className="mt-4 font-display text-xl font-bold text-base-900 dark:text-base-50">Pembayaran Gagal</p>
                <p className="mt-1 text-sm text-base-500">Webhook mengembalikan status gagal. Akses materi belum diberikan.</p>
                <div className="mt-6 flex justify-center gap-2">
                  <button className="btn-primary" onClick={() => setStage('method')}><Icon name="refresh" size={15} /> Coba Lagi</button>
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
              <p className="flex justify-between text-base-500"><span>Biaya gateway</span><span className="font-mono">{fmtMoney(fee)}</span></p>
              <p className="flex justify-between border-t border-base-200 dark:border-base-700 pt-2 font-display text-base font-bold text-base-900 dark:text-base-50"><span>Total</span><span>{fmtMoney(payable + fee)}</span></p>
            </div>
            {order.type === 'shop' && (
              order.needsShipping ? (
                <div className="mt-4 rounded-lg bg-base-100 dark:bg-base-850 p-3.5">
                  <p className="label !mb-1">Kirim ke</p>
                  <p className="text-sm font-bold text-base-800 dark:text-base-100">{order.shippingName} · {order.shippingPhone}</p>
                  <p className="text-xs leading-5 text-base-500">{order.shippingAddress}</p>
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
