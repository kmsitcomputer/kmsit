import { db, uid, now, type ID, type User, type Course, type Lesson, type Section, type Quiz, type Question, type QuizAttempt, type Certificate, type Category } from './db';
import { audit, notify, notifyAdmins, uniqueSlug } from './services';

/* ================= categories ================= */

export const CategoryService = {
  byScope: (scope: Category['scope']) => db.where('categories', (c) => c.scope === scope),
  name: (id: ID | null) => (id ? db.byId('categories', id)?.name ?? '—' : '—'),
  create(scope: Category['scope'], name: string) {
    return db.insert('categories', { scope, name, slug: uniqueSlug('categories', `${scope}-${name}`) });
  },
  update(id: ID, name: string) { db.update('categories', id, { name, slug: uniqueSlug('categories', name, id) }); },
  remove(id: ID) {
    db.remove('categories', id);
    (['courses', 'articles', 'news', 'tutorials', 'products'] as const).forEach((t) =>
      db.where(t, (r) => (r as { categoryId?: ID | null }).categoryId === id).forEach((r) => db.update(t, r.id, { categoryId: null })));
  },
};

/* ================= courses ================= */

export interface CourseInput {
  title: string; shortDescription: string; description: string; thumbnail?: string | null;
  categoryId: ID | null; price: number; discountPrice: number; isFree: boolean;
  level: Course['level']; language: string; status: Course['status']; featured: boolean;
  requirements: string[]; outcomes: string[]; tags: string[];
}

export const CourseService = {
  list: () => db.all('courses'),
  published: () => db.where('courses', (c) => c.status === 'published'),
  byId: (id: ID) => db.byId('courses', id),
  bySlug: (slug: string) => db.find('courses', (c) => c.slug === slug),
  ofInstructor: (instructorId: ID) => db.where('courses', (c) => c.instructorId === instructorId),
  create(instructorId: ID, data: CourseInput, actor: User) {
    const course = db.insert('courses', { ...data, slug: uniqueSlug('courses', data.title), instructorId });
    audit(actor.id, actor.name, 'create', 'course', course.id, `Membuat kelas "${course.title}"`);
    return course;
  },
  update(id: ID, patch: Partial<Course>, actor?: User) {
    if (patch.title) patch.slug = uniqueSlug('courses', patch.title, id);
    const c = db.update('courses', id, patch);
    if (actor) audit(actor.id, actor.name, 'update', 'course', id, `Memperbarui kelas "${c?.title}"`);
    return c;
  },
  remove(id: ID, actor: User) {
    const c = db.byId('courses', id);
    db.where('sections', (s) => s.courseId === id).forEach((s) => db.remove('sections', s.id));
    db.where('lessons', (l) => l.courseId === id).forEach((l) => db.remove('lessons', l.id));
    db.where('enrollments', (e) => e.courseId === id).forEach((e) => db.remove('enrollments', e.id));
    db.where('lessonProgress', (p) => p.courseId === id).forEach((p) => db.remove('lessonProgress', p.id));
    db.where('quizzes', (q) => q.courseId === id).forEach((q) => QuizService.remove(q.id));
    db.where('certificates', (ct) => ct.courseId === id).forEach((ct) => db.remove('certificates', ct.id));
    db.remove('courses', id);
    audit(actor.id, actor.name, 'delete', 'course', id, `Menghapus kelas "${c?.title}"`);
  },
  submitForReview(id: ID, actor: User) {
    db.update('courses', id, { status: 'pending' });
    notifyAdmins('Kelas menunggu moderasi', `"${db.byId('courses', id)?.title}" diajukan untuk review.`, '/dashboard/courses?status=pending');
    audit(actor.id, actor.name, 'submit_review', 'course', id, 'Mengajukan kelas untuk review');
  },
  approve(id: ID, actor: User) {
    const c = db.update('courses', id, { status: 'published', moderationNote: '' });
    if (c) notify(c.instructorId, 'Kelas disetujui', `"${c.title}" telah dipublikasikan.`, `/dashboard/courses/${c.id}`, 'success');
    audit(actor.id, actor.name, 'approve', 'course', id, `Menyetujui kelas "${c?.title}"`);
  },
  reject(id: ID, note: string, actor: User) {
    const c = db.update('courses', id, { status: 'rejected', moderationNote: note });
    if (c) notify(c.instructorId, 'Kelas ditolak', `"${c.title}" ditolak. Catatan: ${note}`, `/dashboard/courses/${c.id}`, 'danger');
    audit(actor.id, actor.name, 'reject', 'course', id, `Menolak kelas "${c?.title}"`);
  },
  effectivePrice: (c: Course) => (c.isFree ? 0 : c.discountPrice > 0 && c.discountPrice < c.price ? c.discountPrice : c.price),
  duration: (courseId: ID) => db.where('lessons', (l) => l.courseId === courseId).reduce((a, l) => a + (l.durationMin || 0), 0),
  lessonCount: (courseId: ID) => db.count('lessons', (l) => l.courseId === courseId),
  studentsCount: (courseId: ID) => db.count('enrollments', (e) => e.courseId === courseId),
};

/* ================= curriculum ================= */

export const CurriculumService = {
  sections: (courseId: ID) => db.where('sections', (s) => s.courseId === courseId).sort((a, b) => a.order - b.order),
  lessons: (courseId: ID) => db.where('lessons', (l) => l.courseId === courseId).sort((a, b) => a.order - b.order),
  lessonsOf: (sectionId: ID) => db.where('lessons', (l) => l.sectionId === sectionId).sort((a, b) => a.order - b.order),
  addSection(courseId: ID, title: string) {
    const order = db.where('sections', (s) => s.courseId === courseId).length;
    return db.insert('sections', { courseId, title, order });
  },
  updateSection(id: ID, title: string) { db.update('sections', id, { title }); },
  moveSection(id: ID, dir: -1 | 1) {
    const s = db.byId('sections', id); if (!s) return;
    const list = CurriculumService.sections(s.courseId);
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir; if (j < 0 || j >= list.length) return;
    db.update('sections', list[i].id, { order: j });
    db.update('sections', list[j].id, { order: i });
  },
  removeSection(id: ID) {
    db.where('lessons', (l) => l.sectionId === id).forEach((l) => db.remove('lessons', l.id));
    db.remove('sections', id);
  },
  addLesson(courseId: ID, sectionId: ID, data: Partial<Lesson>) {
    const order = db.where('lessons', (l) => l.sectionId === sectionId).length;
    return db.insert('lessons', {
      courseId, sectionId, title: data.title || 'Materi baru', type: data.type ?? 'text',
      content: data.content ?? '', mediaUrl: data.mediaUrl ?? '', durationMin: data.durationMin ?? 5,
      preview: data.preview ?? false, status: data.status ?? 'published', order,
    });
  },
  updateLesson(id: ID, patch: Partial<Lesson>) { db.update('lessons', id, patch); },
  moveLesson(id: ID, dir: -1 | 1) {
    const l = db.byId('lessons', id); if (!l) return;
    const list = CurriculumService.lessonsOf(l.sectionId);
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir; if (j < 0 || j >= list.length) return;
    db.update('lessons', list[i].id, { order: j });
    db.update('lessons', list[j].id, { order: i });
  },
  removeLesson(id: ID) {
    db.where('lessonProgress', (p) => p.lessonId === id).forEach((p) => db.remove('lessonProgress', p.id));
    db.remove('lessons', id);
  },
};

/* ================= enrollment ================= */

export class EnrollmentError extends Error {}

export const EnrollmentService = {
  has: (userId: ID, courseId: ID) => !!db.find('enrollments', (e) => e.userId === userId && e.courseId === courseId),
  get: (userId: ID, courseId: ID) => db.find('enrollments', (e) => e.userId === userId && e.courseId === courseId),
  mine: (userId: ID) => db.where('enrollments', (e) => e.userId === userId),
  studentsOf: (courseId: ID) => db.where('enrollments', (e) => e.courseId === courseId),
  /** Free-course self enrollment — backend guard: paid courses MUST go through payment. */
  enrollFree(user: User, course: Course) {
    if (!course.isFree) throw new EnrollmentError('Kelas berbayar tidak dapat diikuti tanpa pembayaran.');
    if (EnrollmentService.has(user.id, course.id)) return EnrollmentService.get(user.id, course.id)!;
    const e = db.insert('enrollments', { userId: user.id, courseId: course.id, completedAt: null, lastLessonId: null });
    notify(user.id, 'Pendaftaran berhasil', `Kamu terdaftar di kelas "${course.title}".`, `/learn/${course.slug}`, 'success');
    const instructor = db.byId('users', course.instructorId);
    if (instructor) notify(instructor.id, 'Student baru', `${user.name} mendaftar di "${course.title}".`, `/dashboard/students`, 'info');
    audit(user.id, user.name, 'enroll', 'enrollment', e.id, `Mendaftar kelas gratis "${course.title}"`);
    return e;
  },
  /** Called by payment fulfillment — idempotent. */
  enrollAfterPayment(user: User, course: Course) {
    if (EnrollmentService.has(user.id, course.id)) return EnrollmentService.get(user.id, course.id)!;
    const e = db.insert('enrollments', { userId: user.id, courseId: course.id, completedAt: null, lastLessonId: null });
    notify(user.id, 'Pembayaran berhasil', `Kamu terdaftar di kelas "${course.title}".`, `/learn/${course.slug}`, 'success');
    const instructor = db.byId('users', course.instructorId);
    if (instructor) notify(instructor.id, 'Student baru', `${user.name} membeli "${course.title}".`, `/dashboard/students`, 'info');
    return e;
  },
};

/* ================= progress ================= */

export const ProgressService = {
  isDone: (userId: ID, lessonId: ID) => !!db.find('lessonProgress', (p) => p.userId === userId && p.lessonId === lessonId),
  of(userId: ID, courseId: ID) {
    const lessons = CurriculumService.lessons(courseId).filter((l) => l.status === 'published');
    const done = lessons.filter((l) => ProgressService.isDone(userId, l.id)).length;
    const total = lessons.length;
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  },
  toggle(user: User, lesson: Lesson) {
    const existing = db.find('lessonProgress', (p) => p.userId === user.id && p.lessonId === lesson.id);
    if (existing) {
      db.remove('lessonProgress', existing.id);
    } else {
      db.insert('lessonProgress', { userId: user.id, courseId: lesson.courseId, lessonId: lesson.id, completedAt: now() });
      const enrollment = EnrollmentService.get(user.id, lesson.courseId);
      if (enrollment) db.update('enrollments', enrollment.id, { lastLessonId: lesson.id });
    }
    return CertificateService.checkAndIssue(user, lesson.courseId);
  },
};

/* ================= quiz ================= */

export const QuizService = {
  list: () => db.all('quizzes'),
  byId: (id: ID) => db.byId('quizzes', id),
  byCourse: (courseId: ID) => db.where('quizzes', (q) => q.courseId === courseId),
  ofInstructor: (instructorId: ID) => db.where('quizzes', (q) => q.instructorId === instructorId),
  create(instructorId: ID, data: Partial<Quiz>, actor: User) {
    const q = db.insert('quizzes', {
      courseId: data.courseId ?? null, instructorId, title: data.title || 'Quiz baru', description: data.description ?? '',
      timeLimitMin: data.timeLimitMin ?? 10, passingScore: data.passingScore ?? 70, maxAttempts: data.maxAttempts ?? 3,
      randomize: data.randomize ?? false, active: data.active ?? true,
    });
    audit(actor.id, actor.name, 'create', 'quiz', q.id, `Membuat quiz "${q.title}"`);
    return q;
  },
  update(id: ID, patch: Partial<Quiz>) { db.update('quizzes', id, patch); },
  remove(id: ID) {
    db.where('questions', (q) => q.quizId === id).forEach((q) => db.remove('questions', q.id));
    db.where('quizAttempts', (a) => a.quizId === id).forEach((a) => db.remove('quizAttempts', a.id));
    db.remove('quizzes', id);
  },
  questions: (quizId: ID) => db.where('questions', (q) => q.quizId === quizId).sort((a, b) => a.order - b.order),
  addQuestion(quizId: ID, data: Partial<Question>) {
    const order = db.where('questions', (q) => q.quizId === quizId).length;
    return db.insert('questions', {
      quizId, type: data.type ?? 'single', text: data.text ?? '', options: data.options ?? [],
      correct: data.correct ?? [], points: data.points ?? 10, order,
    });
  },
  updateQuestion(id: ID, patch: Partial<Question>) { db.update('questions', id, patch); },
  removeQuestion(id: ID) { db.remove('questions', id); },
  attemptsOf: (userId: ID, quizId: ID) => db.where('quizAttempts', (a) => a.userId === userId && a.quizId === quizId),
  passedAttempt: (userId: ID, quizId: ID) => db.find('quizAttempts', (a) => a.userId === userId && a.quizId === quizId && a.passed),
  canAttempt(user: User, quiz: Quiz): { ok: boolean; reason?: string } {
    if (!quiz.active) return { ok: false, reason: 'Quiz tidak aktif.' };
    const attempts = QuizService.attemptsOf(user.id, quiz.id).filter((a) => a.status === 'submitted');
    if (quiz.maxAttempts > 0 && attempts.length >= quiz.maxAttempts) return { ok: false, reason: 'Batas percobaan tercapai.' };
    return { ok: true };
  },
  start(user: User, quiz: Quiz): QuizAttempt {
    return db.insert('quizAttempts', {
      quizId: quiz.id, userId: user.id, startedAt: now(), submittedAt: null, answers: {},
      score: 0, maxScore: 0, percent: 0, passed: false, status: 'in_progress',
    });
  },
  /** Scoring SELALU di backend/service — frontend hanya mengirim jawaban. */
  submit(attemptId: ID, answers: Record<ID, string[]>) {
    const attempt = db.byId('quizAttempts', attemptId);
    if (!attempt || attempt.status === 'submitted') return attempt;
    const quiz = db.byId('quizzes', attempt.quizId);
    if (!quiz) return attempt;
    const questions = QuizService.questions(quiz.id);
    let score = 0, maxScore = 0;
    questions.forEach((q) => {
      maxScore += q.points;
      const ans = (answers[q.id] ?? []).map((a) => a.trim());
      let ok = false;
      if (q.type === 'single' || q.type === 'boolean') ok = ans.length === 1 && ans[0] === q.correct[0];
      else if (q.type === 'multiple') ok = ans.length > 0 && ans.length === q.correct.length && [...ans].sort().join('|') === [...q.correct].sort().join('|');
      else if (q.type === 'short') {
        const norm = (s: string) => s.toLowerCase().trim();
        ok = q.correct.some((c) => norm(c) === norm(ans[0] ?? ''));
      }
      if (ok) score += q.points;
    });
    const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
    const passed = percent >= quiz.passingScore;
    const updated = db.update('quizAttempts', attemptId, { answers, score, maxScore, percent, passed, submittedAt: now(), status: 'submitted' })!;
    const user = db.byId('users', attempt.userId);
    if (user) {
      notify(user.id, passed ? 'Quiz lulus' : 'Quiz belum lulus',
        `"${quiz.title}" — skor ${percent}% (batas lulus ${quiz.passingScore}%).`,
        quiz.courseId ? `/learn/${db.byId('courses', quiz.courseId)?.slug}` : '/dashboard/quizzes',
        passed ? 'success' : 'warning');
      if (quiz.courseId) CertificateService.checkAndIssue(user, quiz.courseId);
    }
    return updated;
  },
};

/* ================= certificates ================= */

export const CertificateService = {
  list: () => db.all('certificates'),
  byNumber: (num: string) => db.find('certificates', (c) => c.number.toLowerCase() === num.trim().toLowerCase()),
  ofUser: (userId: ID) => db.where('certificates', (c) => c.userId === userId),
  activeFor: (userId: ID, courseId: ID) => db.find('certificates', (c) => c.userId === userId && c.courseId === courseId && c.status === 'issued'),
  eligibility(user: User, courseId: ID): { ok: boolean; reason: string } {
    if (!EnrollmentService.has(user.id, courseId)) return { ok: false, reason: 'Belum terdaftar di kelas ini.' };
    const prog = ProgressService.of(user.id, courseId);
    if (prog.total === 0) return { ok: false, reason: 'Kelas belum memiliki materi.' };
    if (prog.pct < 100) return { ok: false, reason: `Selesaikan seluruh materi (progress ${prog.pct}%).` };
    const quizzes = QuizService.byCourse(courseId).filter((q) => q.active);
    for (const q of quizzes) {
      if (!QuizService.passedAttempt(user.id, q.id)) return { ok: false, reason: `Lulus quiz "${q.title}" (min. ${q.passingScore}%).` };
    }
    return { ok: true, reason: '' };
  },
  /** Issue if eligible — idempotent per user+course. */
  checkAndIssue(user: User, courseId: ID): Certificate | null {
    const existing = CertificateService.activeFor(user.id, courseId);
    if (existing) return existing;
    const elig = CertificateService.eligibility(user, courseId);
    if (!elig.ok) return null;
    const course = db.byId('courses', courseId);
    if (!course) return null;
    const templates = db.all('certificateTemplates');
    const template = templates[0];
    if (!template) return null;
    const year = new Date().getFullYear();
    const serial = `${Math.floor(100000 + Math.random() * 900000)}`;
    const cert = db.insert('certificates', {
      number: `KMSIT-${year}-${serial}`, userId: user.id, courseId, templateId: template.id,
      issuedAt: now(), status: 'issued', views: 0,
    });
    db.update('enrollments', EnrollmentService.get(user.id, courseId)!.id, { completedAt: now() });
    notify(user.id, 'Sertifikat diterbitkan', `Selamat! Sertifikat "${course.title}" siap diunduh. Nomor: ${cert.number}`, `/dashboard/certificates`, 'success');
    const instructor = db.byId('users', course.instructorId);
    if (instructor) notify(instructor.id, 'Sertifikat baru', `${user.name} menyelesaikan "${course.title}".`, '/dashboard/certificates', 'info');
    audit(user.id, user.name, 'issue', 'certificate', cert.id, `Sertifikat ${cert.number} untuk ${course.title}`);
    return cert;
  },
  verify(num: string) {
    const cert = CertificateService.byNumber(num);
    if (cert) db.update('certificates', cert.id, { views: cert.views + 1 });
    return cert ?? null;
  },
  revoke(id: ID, actor: User) {
    db.update('certificates', id, { status: 'revoked' });
    audit(actor.id, actor.name, 'revoke', 'certificate', id, 'Mencabut sertifikat');
  },
};

/* ================= access guards (backend protection) ================= */

export function canAccessCourse(user: User | null, course: Course): boolean {
  if (!user) return false;
  if (user.roleKey === 'super_admin' || user.roleKey === 'admin') return true;
  if (user.id === course.instructorId) return true;
  return EnrollmentService.has(user.id, course.id);
}

export function canViewLesson(user: User | null, course: Course, lesson: Lesson): boolean {
  if (lesson.status !== 'published') {
    if (!user) return false;
    if (user.id === course.instructorId || user.roleKey === 'super_admin' || user.roleKey === 'admin') return true;
    return false;
  }
  if (canAccessCourse(user, course)) return true;
  return lesson.preview === true;
}
