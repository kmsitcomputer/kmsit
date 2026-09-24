import type { CartItem, Certificate, Course, Lesson, Menu, MenuItem, Notification, Order, Payment, Product, ProductVariant, Question, Quiz, Section, User, WalletTx, Withdrawal, WebhookLog } from './types';

import { toPage, pageQuery, type Page } from './pagination';

const API_PREFIX = '/api/v1';

/** Custom error yang membawa HTTP status dan payload backend. */
export class StatusError extends Error {
  public readonly status: number;
  public readonly errors?: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
    Object.setPrototypeOf(this, StatusError.prototype);
  }
}

type ApiError = { message?: string; errors?: Record<string, string[]> };

/**
 * Normalisasi response/error dari endpoint backend.
 * Frontend hanya tampil UX — semua keputusan bisnis tetap di backend.
 */
export function normalizeApiError(err: unknown): StatusError {
  if (err instanceof StatusError) return err;
  const msg = err instanceof Error ? err.message : 'Permintaan gagal.';
  // Jangan bocorkan detail server ke pengguna
  if (msg.includes('Internal') || msg.includes('server') || msg.includes('database')) {
    return new StatusError(500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
  return new StatusError(500, msg);
}

function toUser(payload: Record<string, unknown>): User {
  return {
    id: String(payload.id),
    name: String(payload.name ?? ''),
    email: String(payload.email ?? ''),
    passwordHash: '',
    salt: '',
    roleKey: (payload.role_key ?? 'student') as User['roleKey'],
    permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String) : [],
    status: (payload.status ?? 'active') as User['status'],
    phone: typeof payload.phone === 'string' ? payload.phone : undefined,
    avatar: typeof payload.avatar === 'string' ? payload.avatar : null,
    bio: typeof payload.bio === 'string' ? payload.bio : '',
    instructorApproved: Boolean(payload.instructor_approved),
    instructorHeadline: typeof payload.instructor_headline === 'string' ? payload.instructor_headline : '',
    lastLoginAt: typeof payload.last_login_at === 'string' ? Date.parse(payload.last_login_at) : undefined,
    createdAt: 0,
    updatedAt: 0,
  };
}

export type OrderWithBuyer = Order & { buyerName?: string; buyerEmail?: string };

function toOrder(payload: Record<string, any>): OrderWithBuyer {
  return {
    id: String(payload.id), userId: String(payload.user_id), type: payload.type, status: payload.status,
    subtotal: Number(payload.subtotal), discountAmount: Number(payload.discount_amount), voucherCode: payload.voucher_code,
    gatewayFee: Number(payload.gateway_fee), total: Number(payload.total), currency: String(payload.currency),
    items: (payload.items || []).map((item: Record<string, any>) => ({
      kind: item.kind, refId: String(item.ref_id), title: item.title, price: Number(item.price), qty: Number(item.qty),
      instructorId: item.instructor_id ? String(item.instructor_id) : null, instructorName: item.instructor?.name ?? null, thumbnail: item.thumbnail,
      variantId: item.variant_id, variantLabel: item.variant_label, isDigital: Boolean(item.is_digital),
    })),
    paidAt: payload.paid_at ? Date.parse(payload.paid_at) : null, needsShipping: Boolean(payload.needs_shipping),
    shippingName: payload.shipping_name, shippingAddress: payload.shipping_address, shippingPhone: payload.shipping_phone,
    createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0,
    buyerName: payload.user?.name, buyerEmail: payload.user?.email,
  };
}

export type PaymentWithBuyer = Payment & { buyerName?: string };

function toPayment(payload: Record<string, any>): PaymentWithBuyer {
  return { id: String(payload.id), orderId: String(payload.order_id), gateway: payload.gateway, mode: payload.mode, method: payload.method, reference: payload.reference, merchantRef: payload.merchant_ref, amount: Number(payload.amount), fee: Number(payload.fee), status: payload.status, signature: payload.signature, events: Array.isArray(payload.events) ? payload.events : [], createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0, buyerName: payload.order?.user?.name };
}

function toProduct(payload: Record<string, any>): Product {
  return {
    id: String(payload.id), name: String(payload.name ?? ''), slug: String(payload.slug ?? ''), description: payload.description ?? '', thumbnail: payload.thumbnail ?? null,
    price: Number(payload.price ?? 0), discountPrice: Number(payload.discount_price ?? 0), stock: Number(payload.stock ?? 0), categoryId: payload.category_id ?? null,
    status: payload.status, featured: Boolean(payload.featured), isDigital: Boolean(payload.is_digital), digitalFileUrl: payload.digital_file_url ?? null,
    variants: Array.isArray(payload.variants) ? payload.variants.map((variant: Record<string, any>): ProductVariant => ({ id: String(variant.id), label: variant.label, price: Number(variant.price), stock: Number(variant.stock) })) : null,
    createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0,
  };
}

function toCertificate(payload: any): ApiCertificate {
  return { id: String(payload.id), number: payload.number, userId: String(payload.user_id), courseId: String(payload.course_id), templateId: String(payload.template_id), issuedAt: payload.issued_at ? Date.parse(payload.issued_at) : 0, status: payload.status, views: Number(payload.views || 0), createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0, studentName: payload.user?.name, courseTitle: payload.course?.title, instructorName: payload.course?.instructor?.name, template: payload.template };
}

function toContent(payload: any): ApiContentRow {
  return { id: String(payload.id), title: payload.title || '', slug: payload.slug || '', excerpt: payload.excerpt || '', description: payload.description || '', content: payload.content || '', thumbnail: payload.thumbnail || null, categoryId: payload.category_id || null, status: payload.status || 'published', publishedAt: payload.published_at ? Date.parse(payload.published_at) : null, createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, authorId: payload.author_id || null, videoUrl: payload.video_url || '', tags: payload.tags || [], eventDate: payload.event_date || '', eventTime: payload.event_time || '', location: payload.location || '', registrationUrl: payload.registration_url || '', gallery: payload.gallery || [] };
}

function toQuizPayload(payload: any): { quiz: Quiz; questions: Question[] } {
  const quiz = payload.quiz || payload;
  return { quiz: { id: String(quiz.id), courseId: quiz.course_id || null, instructorId: String(quiz.creator_id || ''), title: quiz.title || '', description: quiz.description || '', timeLimitMin: Number(quiz.time_limit_min || 0), passingScore: Number(quiz.passing_score || 0), maxAttempts: Number(quiz.max_attempts || 0), randomize: Boolean(quiz.randomize), active: Boolean(quiz.active), createdAt: quiz.created_at ? Date.parse(quiz.created_at) : 0, updatedAt: quiz.updated_at ? Date.parse(quiz.updated_at) : 0 }, questions: (quiz.questions || []).map((question: any): Question => ({ id: String(question.id), quizId: String(quiz.id), type: question.type, text: question.text, options: (question.options || []).map((option: any) => ({ id: String(option.id), text: option.text })), correct: [], points: Number(question.points || 0), order: Number(question.sort || 0), createdAt: 0, updatedAt: 0 })) };
}

function toAdminQuiz(payload: Record<string, any>): ApiAdminQuiz {
  return {
    id: String(payload.id), course_id: payload.course_id ? String(payload.course_id) : null, creator_id: String(payload.creator_id || ''),
    title: payload.title || '', description: payload.description ?? null, time_limit_min: Number(payload.time_limit_min || 0),
    passing_score: Number(payload.passing_score || 0), max_attempts: Number(payload.max_attempts || 0),
    randomize: Boolean(payload.randomize), active: Boolean(payload.active),
    questions: payload.questions, questions_count: payload.questions_count, course: payload.course,
    createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0,
  };
}

function toVoucher(payload: Record<string, any>): ApiVoucher {
  return {
    id: String(payload.id), code: payload.code, type: payload.type, value: Number(payload.value || 0),
    min_order: Number(payload.min_order || 0), max_discount: Number(payload.max_discount || 0), usage_limit: Number(payload.usage_limit || 0),
    used_count: Number(payload.used_count || 0), expires_at: payload.expires_at ?? null, active: Boolean(payload.active), note: payload.note ?? null,
    createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0,
  };
}

function toAdminUser(payload: Record<string, any>): ApiAdminUser {
  return {
    id: String(payload.id), name: payload.name || '', email: payload.email || '', role_key: payload.role_key,
    status: payload.status, avatar: payload.avatar ?? null, bio: payload.bio ?? null, phone: payload.phone ?? null,
    instructor_approved: Boolean(payload.instructor_approved), instructor_headline: payload.instructor_headline ?? null,
    created_at: payload.created_at, createdAt: payload.created_at ? Date.parse(payload.created_at) : 0,
    updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0,
  };
}

export type CourseWithMeta = Course & { instructorName?: string; categoryName?: string; enrollmentsCount?: number };

function toCourse(payload: Record<string, any>): CourseWithMeta {
  return { id: String(payload.id), title: payload.title || '', slug: payload.slug || '', shortDescription: payload.short_description || '', description: payload.description || '', thumbnail: payload.thumbnail || null, categoryId: payload.category_id || null, instructorId: String(payload.instructor_id || ''), price: Number(payload.price || 0), discountPrice: Number(payload.discount_price || 0), isFree: Boolean(payload.is_free), level: payload.level || 'beginner', language: payload.language || 'Indonesia', status: payload.status, featured: Boolean(payload.featured), requirements: payload.requirements || [], outcomes: payload.outcomes || [], tags: payload.tags || [], createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0, instructorName: payload.instructor?.name, categoryName: payload.category?.name, enrollmentsCount: payload.enrollments_count != null ? Number(payload.enrollments_count) : undefined };
}

export type CourseQuery = { page?: number; per_page?: number; search?: string; category_id?: string; level?: string; type?: string; sort?: string; exclude?: string; featured?: boolean };
export interface ApiCourseDetail { course: CourseWithMeta; enrolled: boolean; instructor?: User; instructorStats: { courses: number; students: number }; sections: Array<Section & { lessons: Lesson[] }>; lessonCount: number; duration: number; studentsCount: number; }

export interface ApiCartLine { item: CartItem; product: Product; variant: ProductVariant | null; price: number; maxQty: number; }
export interface ApiCart { items: ApiCartLine[]; subtotal: number; count: number; hasPhysical: boolean; hasDigital: boolean; }
export interface ApiWallet { summary: { earned: number; gross: number; platformFee: number; reserved: number; available: number }; ledger: WalletTx[]; withdrawals: Withdrawal[]; }
export type ApiAdminWithdrawal = Withdrawal & { userName?: string; userEmail?: string };
export type ApiDigitalDelivery = { id: string; productId: string; productName: string; licenseKey: string; downloadUrl: string | null; downloads: number; status: 'active' | 'revoked'; createdAt: number };
export type ApiMedia = { id: string; name: string; mime: string; size: number; url: string; createdAt: number };
export type ApiContentRow = { id: string; title: string; slug: string; excerpt?: string; description?: string; content: string; thumbnail?: string | null; categoryId: string | null; status: string; publishedAt: number | null; createdAt: number; authorId: string | null; videoUrl?: string; tags?: string[]; eventDate?: string; eventTime?: string; location?: string; registrationUrl?: string; gallery?: string[] };
export type ApiCertificate = Certificate & { studentName?: string; courseTitle?: string; instructorName?: string; template?: { theme?: string; accent?: string; frame?: string } };
export type ApiDashboardSummary = {
  role: string; summary: Record<string, number>; revenue_chart?: { label: string; value: number }[];
  tasks?: Array<{ key: string; count: number; link: string }>; platform?: OpsStatus;
  recent_orders?: Array<{ id: string; user_name?: string; type: string; total: number; status: string; item_title?: string }>;
  recent_students?: Array<{ id: string; user_name?: string; user_avatar?: string | null; course_title?: string; created_at: string }>;
  in_progress?: Array<{ course_id: string; course_title?: string; course_slug?: string; course_thumbnail?: string | null; progress_pct: number }>;
};
export type ApiAdminCourse = CourseWithMeta & { sections?: Array<{ id: string; title: string; sort: number; lessons: Array<{ id: string; title: string; type: string; content: string | null; media_url: string | null; duration_min: number; preview: boolean; status: string; sort: number }> }>; enrollments_count?: number };
export type ApiAdminQuiz = { id: string; course_id: string | null; creator_id: string; title: string; description: string | null; time_limit_min: number; passing_score: number; max_attempts: number; randomize: boolean; active: boolean; questions?: Array<{ id: string; type: string; text: string; points: number; sort: number; options: Array<{ id: string; text: string; is_correct: boolean }> }>; questions_count?: number; course?: { id: string; title: string }; createdAt: number; updatedAt: number };
export type ApiVoucher = { id: string; code: string; type: 'percent' | 'fixed'; value: number; min_order: number; max_discount: number; usage_limit: number; used_count: number; expires_at: string | null; active: boolean; note: string | null; createdAt: number; updatedAt: number };
export type ApiAdminUser = { id: string; name: string; email: string; role_key: string; status: string; avatar: string | null; bio: string | null; phone: string | null; instructor_approved: boolean; instructor_headline: string | null; created_at: string; createdAt: number; updatedAt: number };

export type OpsStatus = {
  maintenance: boolean; environment: string;
  queue: { connection: string; scheduler_worker: boolean; pending_jobs: number | null; oldest_pending_minutes: number | null; failed_jobs: number | null };
  scheduler: { heartbeat_at: string | null; heartbeat_age_seconds: number | null; healthy: boolean };
  cache: { store: string }; mail: { mailer: string; delivers: boolean }; backup: { last_export_at: string | null };
  integrations: Array<{ key: string; kind: string; status: 'active' | 'not_configured' | 'not_active'; selected: boolean; mode: string | null }>;
  warnings: string[];
};
export type MyEnrollment = { id: string; course_id: string; course_title: string | null; course_slug: string | null; course_thumbnail: string | null; course_published: boolean; instructor_name: string | null; progress_pct: number; status: string; completed_at: string | null; last_activity: string | null };
export type MyQuizAttempt = { id: string; quiz_id: string; quiz_title: string | null; course_title: string | null; course_slug: string | null; score: number; max_score: number; percent: number; passing_score: number; passed: boolean; submitted_at: string | null };
export type LearningStatus = {
  progress: { done: number; total: number; pct: number };
  quizzes: Array<{ id: string; title: string; passing_score: number; max_attempts: number; attempts_used: number; best_percent: number; passed: boolean }>;
  certificate: ApiCertificate | null; eligible: boolean;
};
export type InstructorStudent = { enrollment_id: string; id: string; name: string; email: string; avatar: string | null; status: string; course_id: string; course_title: string | null; course_slug: string | null; progress_pct: number; enrollment_status: string; enrolled_at: string | null; last_activity: string | null };
export type InstructorSale = { id: string; order_id: string; course_id: string; title: string; price: number; qty: number; gross: number; net_earning: number | null; platform_fee: number | null; order_status: string; buyer_name: string | null; paid_at: string | null; ordered_at: string | null };
export type InstructorEarning = { id: string; order_id: string | null; course_id: string | null; course_title: string | null; amount: number; gross: number; platform_fee: number; payment_fee: number; status: string; created_at: string | null };
export type InstructorQuiz = { id: string; course_id: string | null; title: string; active: boolean; max_attempts: number; time_limit_min: number; passing_score: number; questions_count: number; submitted_attempts_count: number; course?: { id: string; title: string } | null };
export type InstructorAttempt = { id: string; quiz_id: string; quiz_title: string | null; course_id: string | null; course_title: string | null; student_id: string; student_name: string | null; score: number; max_score: number; percent: number; passed: boolean; submitted_at: string | null };
export type InstructorCourseStats = { id: string; title: string; slug: string; lessons_total: number; enrolled: number; completed: number; avg_progress: number };
export type InstructorProgressRow = { enrollment_id: string; id: string; name: string; avatar: string | null; progress_pct: number; status: string; completed_at: string | null; last_activity: string | null };

function toWalletTx(tx: any): WalletTx {
  return { id: String(tx.id), userId: String(tx.user_id), type: tx.type, refId: tx.ref_id, orderId: tx.order_id, amount: Number(tx.amount), gross: Number(tx.gross), platformFee: Number(tx.platform_fee), paymentFee: Number(tx.payment_fee), status: tx.status, note: tx.note || '', createdAt: tx.created_at ? Date.parse(tx.created_at) : 0, updatedAt: tx.updated_at ? Date.parse(tx.updated_at) : 0 };
}

function toWithdrawal(item: any): ApiAdminWithdrawal {
  return { id: String(item.id), userId: String(item.user_id), amount: Number(item.amount), bankName: item.bank_name, accountName: item.account_name, accountNumber: item.account_number, notes: item.notes || '', status: item.status, processedBy: item.processed_by, processedAt: item.processed_at ? Date.parse(item.processed_at) : null, adminNote: item.admin_note || '', createdAt: item.created_at ? Date.parse(item.created_at) : 0, updatedAt: item.updated_at ? Date.parse(item.updated_at) : 0, userName: item.user?.name, userEmail: item.user?.email };
}

function toWallet(response: any): ApiWallet {
  return {
    summary: { earned: Number(response.summary?.earned || 0), gross: Number(response.summary?.gross || 0), platformFee: Number(response.summary?.platform_fee || 0), reserved: Number(response.summary?.reserved || 0), available: Number(response.summary?.available || 0) },
    ledger: (response.ledger || []).map(toWalletTx),
    withdrawals: (response.withdrawals || []).map(toWithdrawal),
  };
}

let _csrfPromise: Promise<void> | null = null;

/** Mengambil token CSRF dari cookie XSRF-TOKEN (tanpa request berulang jika sudah ada). */
async function ensureCsrf(): Promise<void> {
  if (_csrfPromise) return _csrfPromise;
  _csrfPromise = (async () => {
    try { await fetch('/sanctum/csrf-cookie', { credentials: 'include' }); }
    catch { /* /sanctum belum tersedia selama installer — abaikan */ }
  })();
  return _csrfPromise.finally(() => { _csrfPromise = null; });
}

/** Membaca nilai cookie XSRF-TOKEN yang sudah didekripsi sesuai standar Laravel Sanctum. */
function readCsrfToken(): string | undefined {
  return document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))?.split('=').slice(1).join('=');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const isFormData = init.body instanceof FormData;

  // Otomatis tambahkan CSRF untuk semua state-changing mutation termasuk upload
  if (!['GET', 'HEAD'].includes(method)) {
    await ensureCsrf();
    const token = readCsrfToken();
    if (token) {
      init.headers = { ...init.headers, 'X-XSRF-TOKEN': decodeURIComponent(token) };
    }
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body as ApiError;
    const message = error.message || Object.values(error.errors || {})[0]?.[0] || 'Permintaan gagal.';
    let userMessage = message;
    if (response.status >= 500) {
      userMessage = 'Terjadi kesalahan pada server. Silakan coba lagi.';
    } else if (response.status === 422 && error.errors) {
      userMessage = Object.values(error.errors).flat().join(' ');
    }
    throw new StatusError(response.status, userMessage, error.errors);
  }
  return body as T;
}

export const api = {
  async dashboardSummary(): Promise<ApiDashboardSummary> { return request('/dashboard/summary'); },
  async me(): Promise<User | null> {
    try { return toUser((await request<{ user: Record<string, unknown> }>('/auth/me')).user); }
    catch { return null; }
  },
  async login(email: string, password: string): Promise<User> {
    return toUser((await request<{ user: Record<string, unknown> }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).user);
  },
  async register(data: { name: string; email: string; password: string; role: 'student' | 'instructor' }): Promise<User> {
    return toUser((await request<{ user: Record<string, unknown> }>('/auth/register', { method: 'POST', body: JSON.stringify({ ...data, password_confirmation: data.password }) })).user);
  },
  async logout(): Promise<void> { await request('/auth/logout', { method: 'POST' }); },
  /** Public catalog page (server filters/sort; published only). */
  async coursePage(params: CourseQuery = {}): Promise<Page<CourseWithMeta>> {
    return toPage(await request<unknown>(`/courses${pageQuery(params)}`), toCourse);
  },
  async courses(params: CourseQuery = {}): Promise<CourseWithMeta[]> { return (await api.coursePage(params)).items; },
  async course(slug: string): Promise<ApiCourseDetail> {
    const response = await request<{ course: any }>(`/courses/${encodeURIComponent(slug)}`);
    const course = response.course;
    const instructor = course.instructor ? { id: String(course.instructor.id), name: course.instructor.name || '', email: '', passwordHash: '', salt: '', roleKey: 'instructor' as const, status: 'active' as const, avatar: course.instructor.avatar || null, bio: '', instructorApproved: true, instructorHeadline: '', createdAt: 0, updatedAt: 0 } : undefined;
    const sections = (course.sections || []).map((section: any): Section & { lessons: Lesson[] } => ({ id: String(section.id), courseId: String(course.id), title: section.title, order: Number(section.sort || 0), createdAt: section.created_at ? Date.parse(section.created_at) : 0, updatedAt: section.updated_at ? Date.parse(section.updated_at) : 0, lessons: (section.lessons || []).map((lesson: any): Lesson => ({ id: String(lesson.id), courseId: String(course.id), sectionId: String(section.id), title: lesson.title, type: lesson.type, content: lesson.content || '', mediaUrl: lesson.media_url || '', durationMin: Number(lesson.duration_min || 0), preview: Boolean(lesson.preview), status: lesson.status, order: Number(lesson.sort || 0), createdAt: lesson.created_at ? Date.parse(lesson.created_at) : 0, updatedAt: lesson.updated_at ? Date.parse(lesson.updated_at) : 0 })) }));
    return { course: toCourse(course), enrolled: Boolean(course.enrolled), instructor, instructorStats: { courses: Number(course.instructor_stats?.courses || 0), students: Number(course.instructor_stats?.students || 0) }, sections, lessonCount: sections.reduce((total: number, section: Section & { lessons: Lesson[] }) => total + section.lessons.length, 0), duration: sections.reduce((total: number, section: Section & { lessons: Lesson[] }) => total + section.lessons.reduce((sum: number, lesson: Lesson) => sum + lesson.durationMin, 0), 0), studentsCount: Number(course.enrollments_count || 0) };
  },
  async enroll(slug: string): Promise<unknown> { return request(`/courses/${encodeURIComponent(slug)}/enroll`, { method: 'POST' }); },
  async completeLesson(slug: string, lessonId: string): Promise<unknown> {
    return request(`/courses/${encodeURIComponent(slug)}/lessons/${encodeURIComponent(lessonId)}/complete`, { method: 'POST' });
  },
  async courseProgress(slug: string): Promise<{ done: number; total: number; pct: number; completedLessonIds: string[] }> {
    const response = await request<{ progress: { done: number; total: number; pct: number; completed_lesson_ids: string[] } }>(`/courses/${encodeURIComponent(slug)}/progress`);
    return { done: response.progress.done, total: response.progress.total, pct: response.progress.pct, completedLessonIds: response.progress.completed_lesson_ids.map(String) };
  },
  /** Student-owned learning read models (A-24): server is the source of truth. */
  async myEnrollments(params: { page?: number; per_page?: number; status?: string } = {}): Promise<Page<MyEnrollment>> {
    return toPage((await request<{ enrollments: unknown }>(`/my/enrollments${pageQuery(params)}`)).enrollments, (r) => r as MyEnrollment);
  },
  async myQuizAttempts(params: { page?: number; quiz_id?: string; course_id?: string } = {}): Promise<Page<MyQuizAttempt>> {
    return toPage((await request<{ attempts: unknown }>(`/my/quiz-attempts${pageQuery(params)}`)).attempts, (r) => r as MyQuizAttempt);
  },
  async learningStatus(courseId: string): Promise<LearningStatus> {
    const response = await request<{ progress: LearningStatus['progress']; quizzes: LearningStatus['quizzes']; certificate: any | null; eligible: boolean }>(`/my/courses/${encodeURIComponent(courseId)}/status`);
    return { progress: response.progress, quizzes: response.quizzes, certificate: response.certificate ? toCertificate(response.certificate) : null, eligible: response.eligible };
  },
  async opsStatus(): Promise<OpsStatus> { return (await request<{ status: OpsStatus }>('/admin/ops/status')).status; },
  async paymentOptions(): Promise<{ gateway: 'tripay' | 'xendit' | 'stripe'; mode: 'sandbox' | 'live'; methods: Array<{ key: string; label: string }> }> {
    return request('/payments/options');
  },
  async quiz(quizId: string): Promise<{ quiz: Quiz; questions: Question[] }> { return toQuizPayload(await request(`/quizzes/${encodeURIComponent(quizId)}`)); },
  async quizzes(courseId: string): Promise<Quiz[]> {
    const response = await request<{ quizzes: any[] }>(`/courses/${encodeURIComponent(courseId)}/quizzes`);
    return response.quizzes.map((quiz: any) => toQuizPayload({ quiz })).map((result) => result.quiz);
  },
  async certificates(params: { page?: number; status?: string } = {}): Promise<Page<ApiCertificate>> {
    return toPage((await request<{ certificates: unknown }>(`/certificates${pageQuery(params)}`)).certificates, toCertificate);
  },
  async issueCertificate(courseId: string): Promise<ApiCertificate> { return toCertificate((await request<{ certificate: any }>(`/courses/${encodeURIComponent(courseId)}/certificate`, { method: 'POST' })).certificate); },
  async revokeCertificate(id: string): Promise<void> { await request(`/certificates/${encodeURIComponent(id)}/revoke`, { method: 'PATCH' }); },
  async certificateTemplates(): Promise<any[]> { return (await request<{ templates: any[] }>('/certificate-templates')).templates; },
  async createCertificateTemplate(payload: Record<string, unknown>): Promise<void> { await request('/certificate-templates', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateCertificateTemplate(id: string, payload: Record<string, unknown>): Promise<void> { await request(`/certificate-templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async deleteCertificateTemplate(id: string): Promise<void> { await request(`/certificate-templates/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async notifications(params: { page?: number; per_page?: number; is_read?: boolean } = {}): Promise<{ page: Page<Notification>; unread: number }> {
    const response = await request<{ notifications: unknown; unread_count: number }>(`/notifications${pageQuery(params)}`);
    return {
      page: toPage(response.notifications, (item: any): Notification => ({ id: String(item.id), userId: String(item.user_id), title: item.title, body: item.body || '', link: item.link || '', read: Boolean(item.is_read), kind: item.kind, createdAt: item.created_at ? Date.parse(item.created_at) : 0, updatedAt: item.updated_at ? Date.parse(item.updated_at) : 0 })),
      unread: Number(response.unread_count || 0),
    };
  },
  async readNotification(id: string): Promise<void> { await request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }); },
  async readAllNotifications(): Promise<void> { await request('/notifications/read-all', { method: 'POST' }); },
  async updateProfile(payload: { name: string; phone?: string; bio?: string; avatar?: string | null; instructor_headline?: string }): Promise<User> {
    return toUser((await request<{ user: Record<string, unknown> }>('/profile', { method: 'PUT', body: JSON.stringify(payload) })).user);
  },
  async uploadAvatar(file: File): Promise<User> {
    const form = new FormData(); form.append('file', file);
    return toUser((await request<{ user: Record<string, unknown> }>('/profile/avatar', { method: 'POST', body: form })).user);
  },
  async updatePassword(currentPassword: string, password: string): Promise<void> {
    await request('/profile/password', { method: 'PUT', body: JSON.stringify({ current_password: currentPassword, password, password_confirmation: password }) });
  },
  async forgotPassword(email: string): Promise<void> { await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); },
  async resetPassword(email: string, token: string, password: string): Promise<void> { await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, token, password, password_confirmation: password }) }); },
  async installStatus(): Promise<{ installed: boolean; database: string }> { return request('/install/status'); },
  async installRequirements(): Promise<{ checks: Array<{ key: string; label: string; detail: string; ok: boolean }>; ok: boolean }> { return request('/install/requirements'); },
  async installTestDb(payload: { host: string; port: string; database: string; username: string; password: string }): Promise<{ ok: boolean; message: string }> {
    // Dipanggil sebelum .env/APP_KEY ada — tidak pakai csrfHeaders() karena /sanctum/csrf-cookie butuh APP_KEY untuk enkripsi cookie.
    return request('/install/test-db', { method: 'POST', body: JSON.stringify(payload) });
  },
  async installConfigure(payload: { host: string; port: string; database: string; username: string; password: string; site_url?: string }): Promise<{ message: string }> {
    return request('/install/configure', { method: 'POST', body: JSON.stringify(payload) });
  },
  async install(payload: Record<string, unknown>): Promise<void> { await request('/install', { method: 'POST', body: JSON.stringify(payload) }); },
  async search(query: string): Promise<Array<{ group: string; label: string; to: string }>> {
    return (await request<{ results: Array<{ group: string; label: string; to: string }> }>(`/search?q=${encodeURIComponent(query)}`)).results;
  },
  async auditLogs(params: { page?: number; model?: string; action?: string } = {}): Promise<{ page: Page<any>; models: string[] }> {
    const response = await request<{ logs: unknown; models: string[] }>(`/admin/audit-logs${pageQuery(params)}`);
    return { page: toPage(response.logs, (row) => row), models: response.models };
  },
  async backup(): Promise<Record<string, unknown>> { return request('/admin/backup'); },
  async sendContact(payload: { name: string; email: string; subject: string; body: string }): Promise<void> {
    await request('/contact', { method: 'POST', body: JSON.stringify(payload) });
  },
  async verifyCertificate(number: string): Promise<{ valid: boolean; certificate: ApiCertificate }> {
    const response = await request<{ valid: boolean; certificate: any }>(`/certificates/verify/${encodeURIComponent(number)}`);
    return { valid: response.valid, certificate: toCertificate(response.certificate) };
  },
  async startQuiz(quizId: string): Promise<unknown> { return request(`/quizzes/${encodeURIComponent(quizId)}/attempts`, { method: 'POST' }); },
  async submitQuiz(attemptId: string, answers: Record<string, string[]>): Promise<unknown> {
    return request(`/quiz-attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
  },
  async createCourseOrder(courseSlug: string): Promise<unknown> {
    return request('/orders/course', { method: 'POST', body: JSON.stringify({ course_slug: courseSlug }) });
  },
  async createShopOrder(payload: { voucher_code?: string; shipping?: { name: string; address: string; phone: string } }): Promise<unknown> {
    return request('/orders/shop', { method: 'POST', body: JSON.stringify(payload) });
  },
  /** The provider is chosen server-side; only the method key is sent. */
  async initiatePayment(orderId: string, method: string): Promise<{ payment: { reference: string }; checkout_url?: string | null }> {
    return request(`/orders/${encodeURIComponent(orderId)}/payment`, { method: 'POST', body: JSON.stringify({ method }) });
  },
  async order(orderId: string): Promise<OrderWithBuyer> {
    return toOrder((await request<{ order: Record<string, any> }>(`/orders/${encodeURIComponent(orderId)}`)).order);
  },
  /** Own orders; all orders for staff holding manage_orders (server-scoped). */
  async orders(params: { page?: number; status?: string; type?: string } = {}): Promise<Page<OrderWithBuyer>> {
    return toPage(await request<unknown>(`/orders${pageQuery(params)}`), toOrder);
  },
  /** Own payments; all payments for staff holding view_payments (server-scoped). */
  async payments(params: { page?: number; per_page?: number; order_id?: string; status?: string } = {}): Promise<Page<PaymentWithBuyer>> {
    return toPage((await request<{ payments: unknown }>(`/payments${pageQuery(params)}`)).payments, toPayment);
  },
  async webhookLogs(params: { page?: number; result?: string } = {}): Promise<Page<WebhookLog>> {
    return toPage((await request<{ webhook_logs: unknown }>(`/payments/webhook-logs${pageQuery(params)}`)).webhook_logs, (item: any): WebhookLog => ({ id: String(item.id), reference: item.reference, payloadHash: item.payload_hash, gateway: item.gateway, status: item.status, result: item.result, createdAt: item.created_at ? Date.parse(item.created_at) : 0, updatedAt: item.updated_at ? Date.parse(item.updated_at) : 0 }));
  },
  async productPage(params: { page?: number; per_page?: number; search?: string; category_id?: string; kind?: string } = {}): Promise<Page<Product>> {
    return toPage(await request<unknown>(`/shop/products${pageQuery(params)}`), toProduct);
  },
  async cart(): Promise<ApiCart> {
    const response = await request<{ items: Record<string, any>[] }>('/shop/cart');
    const items = response.items.map((line) => {
      const product = toProduct(line.product);
      const variant = line.variant ? { id: String(line.variant.id), label: line.variant.label, price: Number(line.variant.price), stock: Number(line.variant.stock) } : null;
      const item: CartItem = { id: String(line.id), userId: '', productId: product.id, qty: Number(line.qty), variantId: variant?.id ?? null, createdAt: 0, updatedAt: 0 };
      return { item, product, variant, price: Number(line.unit_price), maxQty: Number(line.stock) };
    });
    return { items, subtotal: items.reduce((total, line) => total + line.price * line.item.qty, 0), count: items.reduce((total, line) => total + line.item.qty, 0), hasPhysical: items.some((line) => !line.product.isDigital), hasDigital: items.some((line) => line.product.isDigital) };
  },
  async addToCart(productId: string, qty = 1, variantId?: string): Promise<unknown> {
    return request('/shop/cart', { method: 'POST', body: JSON.stringify({ product_id: productId, qty, variant_id: variantId }) });
  },
  async removeFromCart(itemId: string): Promise<void> {
    await request(`/shop/cart/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  },
  async updateCart(itemId: string, qty: number): Promise<void> {
    await request(`/shop/cart/${encodeURIComponent(itemId)}`, { method: 'PUT', body: JSON.stringify({ qty }) });
  },
  async validateVoucher(code: string, subtotal: number): Promise<{ code: string; discount: number }> {
    return request('/shop/voucher/validate', { method: 'POST', body: JSON.stringify({ code, subtotal }) });
  },
  async digitalDeliveries(params: { page?: number } = {}): Promise<Page<ApiDigitalDelivery>> {
    return toPage((await request<{ deliveries: unknown }>(`/shop/digital-deliveries${pageQuery(params)}`)).deliveries, (item: any): ApiDigitalDelivery => ({ id: String(item.id), productId: String(item.product_id), productName: item.product?.name || 'Produk digital', licenseKey: item.license_key, downloadUrl: item.download_url, downloads: Number(item.downloads), status: item.status, createdAt: item.created_at ? Date.parse(item.created_at) : 0 }));
  },
  digitalDownloadUrl(deliveryId: string): string {
    return `${API_PREFIX}/shop/digital-deliveries/${encodeURIComponent(deliveryId)}/download`;
  },
  async publicSettings(): Promise<Record<string, string | null>> {
    return (await request<{ settings: Record<string, string | null> }>('/settings/public')).settings;
  },
  async adminSettings(): Promise<Record<string, string | null>> {
    return (await request<{ settings: Record<string, string | null> }>('/settings')).settings;
  },
  async updateSetting(key: string, value: string): Promise<unknown> {
    return request('/settings', { method: 'PUT', body: JSON.stringify({ key, value }) });
  },
  async updateSettings(settings: Record<string, string>): Promise<void> {
    await request('/settings/bulk', { method: 'PUT', body: JSON.stringify({ settings }) });
  },
  async paymentSettings(): Promise<{ gateway: 'tripay' | 'xendit' | 'stripe'; mode: 'sandbox' | 'live'; configured: Record<string, boolean> }> {
    return request('/settings/payment');
  },
  async updatePaymentSettings(gateway: 'tripay' | 'xendit' | 'stripe', mode: 'sandbox' | 'live'): Promise<void> {
    await request('/settings/payment', { method: 'PUT', body: JSON.stringify({ gateway, mode }) });
  },
  async uploadMedia(file: File): Promise<unknown> {
    const form = new FormData(); form.append('file', file);
    return request('/media', { method: 'POST', body: form });
  },
  async media(params: { page?: number; per_page?: number; q?: string; mime?: string } = {}): Promise<Page<ApiMedia>> {
    return toPage((await request<{ media: unknown }>(`/media${pageQuery(params)}`)).media, (item: any): ApiMedia => ({ id: String(item.id), name: item.name, mime: item.mime, size: Number(item.size), url: item.url, createdAt: item.created_at ? Date.parse(item.created_at) : 0 }));
  },
  async articles(): Promise<unknown> { return request('/articles'); },
  async article(slug: string): Promise<unknown> { return request(`/articles/${encodeURIComponent(slug)}`); },
  async content(type: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages', search = ''): Promise<any[]> {
    const response = await request<{ data: any[] }>(`/${type}${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return response.data.map((item: any) => ({ id: String(item.id), title: item.title || '', slug: item.slug || '', excerpt: item.excerpt || '', description: item.description || '', content: item.content || '', thumbnail: item.thumbnail || null, categoryId: item.category_id || null, status: item.status || 'published', publishedAt: item.published_at ? Date.parse(item.published_at) : null, createdAt: item.created_at ? Date.parse(item.created_at) : 0, authorId: item.author_id || null, videoUrl: item.video_url || '', tags: item.tags || [], eventDate: item.event_date || '', eventTime: item.event_time || '', location: item.location || '', registrationUrl: item.registration_url || '', gallery: item.gallery || [] }));
  },
  async manageContent(type: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages', params: { page?: number; status?: string; q?: string } = {}): Promise<Page<ApiContentRow>> {
    return toPage((await request<{ content: unknown }>(`/admin/content/${type}${pageQuery(params)}`)).content, toContent);
  },
  async contentDetail(type: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages', slug: string): Promise<any> {
    const response = await request<{ content: any }>(`/${type}/${encodeURIComponent(slug)}`);
    const item = response.content;
    return { id: String(item.id), title: item.title || '', slug: item.slug || '', excerpt: item.excerpt || '', description: item.description || '', content: item.content || '', thumbnail: item.thumbnail || null, categoryId: item.category_id || null, status: item.status || 'published', publishedAt: item.published_at ? Date.parse(item.published_at) : null, createdAt: item.created_at ? Date.parse(item.created_at) : 0, authorId: item.author_id || null, authorName: item.author?.name || '', videoUrl: item.video_url || '', tags: item.tags || [], eventDate: item.event_date || '', eventTime: item.event_time || '', location: item.location || '', registrationUrl: item.registration_url || '', gallery: item.gallery || [] };
  },
  async createContent(type: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages', payload: Record<string, unknown>): Promise<unknown> {
    return request(`/${type}`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateContent(type: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages', id: string, payload: Record<string, unknown>): Promise<unknown> {
    return request(`/${type}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async deleteContent(type: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages', id: string): Promise<void> {
    await request(`/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async manageProducts(params: { page?: number; status?: string; q?: string } = {}): Promise<Page<Product>> {
    return toPage((await request<{ products: unknown }>(`/admin/products${pageQuery(params)}`)).products, toProduct);
  },
  async createProduct(payload: Record<string, unknown>): Promise<void> { await request('/admin/products', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateProduct(id: string, payload: Record<string, unknown>): Promise<void> { await request(`/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async deleteProduct(id: string): Promise<void> { await request(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async categories(scope?: string): Promise<any[]> { return (await request<{ categories: any[] }>(`/categories${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`)).categories; },
  async createCategory(scope: string, name: string): Promise<void> { await request('/categories', { method: 'POST', body: JSON.stringify({ scope, name }) }); },
  async updateCategory(id: string, name: string): Promise<void> { await request(`/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ name }) }); },
  async deleteCategory(id: string): Promise<void> { await request(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async homepageBlocks(): Promise<any[]> {
    return (await request<{ blocks: any[] }>('/homepage/blocks')).blocks;
  },
  async adminHomepageBlocks(): Promise<any[]> { return (await request<{ blocks: any[] }>('/homepage/blocks')).blocks; },
  async updateHomepageBlock(id: string, payload: Record<string, unknown>): Promise<void> { await request(`/homepage/blocks/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async createHomepageBlock(payload: Record<string, unknown>): Promise<void> { await request('/homepage/blocks', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteHomepageBlock(id: string): Promise<void> { await request(`/homepage/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async menus(location: 'header' | 'footer' = 'header'): Promise<any[]> {
    const response = await request<{ menus: any[] }>(`/menus?location=${location}`);
    return response.menus.flatMap((menu: any) => (menu.items || []).map((item: any): MenuItem => ({ id: String(item.id), menuId: String(item.menu_id), parentId: item.parent_id ? String(item.parent_id) : null, label: item.label, type: item.type, target: item.target, order: Number(item.sort || 0), createdAt: item.created_at ? Date.parse(item.created_at) : 0, updatedAt: item.updated_at ? Date.parse(item.updated_at) : 0 })));
  },
  async menuGroups(): Promise<Array<Menu & { items: MenuItem[] }>> {
    const response = await request<{ menus: any[] }>('/admin/menus');
    return response.menus.map((menu: any) => ({ id: String(menu.id), name: menu.name, location: menu.location, createdAt: 0, updatedAt: 0, items: (menu.items || []).map((item: any): MenuItem => ({ id: String(item.id), menuId: String(menu.id), parentId: item.parent_id ? String(item.parent_id) : null, label: item.label, type: item.type, target: item.target, order: Number(item.sort || 0), createdAt: 0, updatedAt: 0 })) }));
  },
  async createMenu(name: string, location: 'header' | 'footer' | 'both'): Promise<Menu & { items: MenuItem[] }> {
    const response = await request<{ menu: any }>('/menus', { method: 'POST', body: JSON.stringify({ name, location }) });
    return { id: String(response.menu.id), name: response.menu.name, location: response.menu.location, createdAt: 0, updatedAt: 0, items: [] };
  },
  async createMenuItem(payload: Record<string, unknown>): Promise<unknown> { return request('/menus/items', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateMenuItem(id: string, payload: Record<string, unknown>): Promise<unknown> { return request(`/menus/items/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async deleteMenuItem(id: string): Promise<void> { await request(`/menus/items/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async wallet(): Promise<ApiWallet> { return toWallet(await request('/wallet')); },
  async walletLedger(params: { page?: number; type?: string } = {}): Promise<Page<WalletTx>> {
    return toPage((await request<{ ledger: unknown }>(`/wallet/ledger${pageQuery(params)}`)).ledger, toWalletTx);
  },
  async myWithdrawals(params: { page?: number; status?: string } = {}): Promise<Page<ApiAdminWithdrawal>> {
    return toPage((await request<{ withdrawals: unknown }>(`/wallet/withdrawals${pageQuery(params)}`)).withdrawals, toWithdrawal);
  },
  async requestWithdrawal(data: { amount: number; bank_name: string; account_name: string; account_number: string; notes?: string }): Promise<unknown> {
    return request('/wallet/withdrawals', { method: 'POST', body: JSON.stringify(data) });
  },
  async adminWithdrawals(params: { page?: number; status?: string } = {}): Promise<Page<ApiAdminWithdrawal>> {
    return toPage((await request<{ withdrawals: unknown }>(`/admin/withdrawals${pageQuery(params)}`)).withdrawals, toWithdrawal);
  },
  async updateWithdrawal(withdrawalId: string, status: Withdrawal['status'], adminNote = ''): Promise<void> {
    await request(`/wallet/withdrawals/${encodeURIComponent(withdrawalId)}`, { method: 'PATCH', body: JSON.stringify({ status, admin_note: adminNote }) });
  },
  async deleteMedia(id: string): Promise<void> { await request(`/media/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async contactMessages(params: { page?: number; is_read?: boolean } = {}): Promise<Page<any>> {
    return toPage((await request<{ messages: unknown }>(`/admin/contact-messages${pageQuery(params)}`)).messages, (row) => row);
  },
  async updateContactMessage(id: string, isRead: boolean): Promise<void> { await request(`/admin/contact-messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_read: isRead }) }); },

  // --- Course admin (instructor + admin) ---
  async adminCourses(params: { page?: number; per_page?: number; status?: string; q?: string } = {}): Promise<Page<ApiAdminCourse>> {
    return toPage((await request<{ courses: unknown }>(`/admin/courses${pageQuery(params)}`)).courses, toCourse);
  },
  /** Filter options: own courses for instructors, all courses for course managers (first 100). */
  async courseOptions(): Promise<Array<{ id: string; title: string }>> {
    return (await api.adminCourses({ per_page: 100 })).items.map((course) => ({ id: course.id, title: course.title }));
  },
  async adminCourse(id: string): Promise<ApiAdminCourse> {
    const course = (await request<{ course: any }>(`/admin/courses/${encodeURIComponent(id)}`)).course;
    return { ...toCourse(course), sections: course.sections };
  },
  async createCourse(payload: Record<string, unknown>): Promise<ApiAdminCourse> { return toCourse((await request<{ course: any }>('/admin/courses', { method: 'POST', body: JSON.stringify(payload) })).course); },
  async updateCourse(id: string, payload: Record<string, unknown>): Promise<ApiAdminCourse> {
    const course = (await request<{ course: any }>(`/admin/courses/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })).course;
    return { ...toCourse(course), sections: course.sections };
  },
  async deleteCourse(id: string): Promise<void> { await request(`/admin/courses/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async submitCourse(id: string): Promise<ApiAdminCourse> { return toCourse((await request<{ course: any }>(`/admin/courses/${encodeURIComponent(id)}/submit`, { method: 'POST' })).course); },
  async moderateCourse(id: string, action: 'approve' | 'reject' | 'archive', rejectNote?: string): Promise<ApiAdminCourse> {
    return toCourse((await request<{ course: any }>(`/admin/courses/${encodeURIComponent(id)}/moderate`, { method: 'PATCH', body: JSON.stringify({ action, reject_note: rejectNote }) })).course);
  },

  // --- Quiz admin (instructor + admin) ---
  async adminQuizzes(params: { page?: number; course_id?: string; q?: string } = {}): Promise<Page<ApiAdminQuiz>> {
    return toPage((await request<{ quizzes: unknown }>(`/admin/quizzes${pageQuery(params)}`)).quizzes, toAdminQuiz);
  },
  async adminQuiz(id: string): Promise<ApiAdminQuiz> { return toAdminQuiz((await request<{ quiz: any }>(`/admin/quizzes/${encodeURIComponent(id)}`)).quiz); },
  async createQuiz(payload: Record<string, unknown>): Promise<ApiAdminQuiz> { return toAdminQuiz((await request<{ quiz: any }>('/admin/quizzes', { method: 'POST', body: JSON.stringify(payload) })).quiz); },
  async updateQuiz(id: string, payload: Record<string, unknown>): Promise<ApiAdminQuiz> { return toAdminQuiz((await request<{ quiz: any }>(`/admin/quizzes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })).quiz); },
  async deleteQuiz(id: string): Promise<void> { await request(`/admin/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async quizAttempts(id: string, params: { page?: number } = {}): Promise<Page<any>> {
    return toPage((await request<{ attempts: unknown }>(`/admin/quizzes/${encodeURIComponent(id)}/attempts${pageQuery(params)}`)).attempts, (row) => row);
  },

  // --- Voucher admin ---
  async adminVouchers(params: { page?: number; q?: string; state?: string } = {}): Promise<{ page: Page<ApiVoucher>; summary: { total: number; active: number; used: number; expired: number } }> {
    const response = await request<{ vouchers: unknown; summary: { total: number; active: number; used: number; expired: number } }>(`/admin/vouchers${pageQuery(params)}`);
    return { page: toPage(response.vouchers, toVoucher), summary: response.summary };
  },
  async createVoucher(payload: Record<string, unknown>): Promise<ApiVoucher> { return toVoucher((await request<{ voucher: any }>('/admin/vouchers', { method: 'POST', body: JSON.stringify(payload) })).voucher); },
  async updateVoucher(id: string, payload: Record<string, unknown>): Promise<ApiVoucher> { return toVoucher((await request<{ voucher: any }>(`/admin/vouchers/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })).voucher); },
  async deleteVoucher(id: string): Promise<void> { await request(`/admin/vouchers/${encodeURIComponent(id)}`, { method: 'DELETE' }); },

  // --- People / user admin ---
  async adminUsers(params: { page?: number; role?: string; status?: string; q?: string } = {}): Promise<Page<ApiAdminUser>> {
    return toPage((await request<{ users: unknown }>(`/admin/users${pageQuery(params)}`)).users, toAdminUser);
  },
  async createUser(payload: Record<string, unknown>): Promise<ApiAdminUser> { return toAdminUser((await request<{ user: any }>('/admin/users', { method: 'POST', body: JSON.stringify(payload) })).user); },
  async updateUser(id: string, payload: Record<string, unknown>): Promise<ApiAdminUser> { return toAdminUser((await request<{ user: any }>(`/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) })).user); },
  async deleteUser(id: string): Promise<void> { await request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async approveInstructor(id: string, approved: boolean): Promise<ApiAdminUser> { return toAdminUser((await request<{ user: any }>(`/admin/users/${encodeURIComponent(id)}/approve-instructor`, { method: 'PATCH', body: JSON.stringify({ approved }) })).user); },

  // --- Instructor dashboard (A-23): ownership-scoped, paginated ---
  async instructorStudents(params: { page?: number; course_id?: string; q?: string } = {}): Promise<Page<InstructorStudent>> {
    return toPage((await request<{ students: unknown }>(`/instructor/students${pageQuery(params)}`)).students, (r) => r as InstructorStudent);
  },
  async instructorSales(params: { page?: number; course_id?: string; status?: string } = {}): Promise<{ page: Page<InstructorSale>; summary: { count: number; gross: number } }> {
    const response = await request<{ sales: unknown; summary: { count: number; gross: number } }>(`/instructor/sales${pageQuery(params)}`);
    return { page: toPage(response.sales, (r) => r as InstructorSale), summary: response.summary };
  },
  async instructorEarnings(params: { page?: number; course_id?: string } = {}): Promise<{ page: Page<InstructorEarning>; summary: { net: number; gross: number; platform_fee: number; payment_fee: number } }> {
    const response = await request<{ earnings: unknown; summary: { net: number; gross: number; platform_fee: number; payment_fee: number } }>(`/instructor/earnings${pageQuery(params)}`);
    return { page: toPage(response.earnings, (r) => r as InstructorEarning), summary: response.summary };
  },
  async instructorQuizzes(params: { page?: number; course_id?: string } = {}): Promise<Page<InstructorQuiz>> {
    return toPage((await request<{ quizzes: unknown }>(`/instructor/quizzes${pageQuery(params)}`)).quizzes, (r) => r as InstructorQuiz);
  },
  async instructorQuizAttempts(params: { page?: number; course_id?: string; quiz_id?: string; passed?: boolean } = {}): Promise<Page<InstructorAttempt>> {
    return toPage((await request<{ attempts: unknown }>(`/instructor/quiz-attempts${pageQuery(params)}`)).attempts, (r) => r as InstructorAttempt);
  },
  async instructorCourseProgress(courseId: string, params: { page?: number; q?: string } = {}): Promise<{ course: InstructorCourseStats; page: Page<InstructorProgressRow> }> {
    const response = await request<{ course: InstructorCourseStats; students_progress: unknown }>(`/instructor/courses/${encodeURIComponent(courseId)}/progress${pageQuery(params)}`);
    return { course: response.course, page: toPage(response.students_progress, (r) => r as InstructorProgressRow) };
  },
};
