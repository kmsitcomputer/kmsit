import type { CartItem, Certificate, Course, Lesson, Menu, MenuItem, Notification, Order, Payment, Product, ProductVariant, Question, Quiz, Section, User, WalletTx, Withdrawal, WebhookLog } from './db';

const API_PREFIX = '/api/v1';

type ApiError = { message?: string; errors?: Record<string, string[]> };

function toUser(payload: Record<string, unknown>): User {
  return {
    id: String(payload.id),
    name: String(payload.name ?? ''),
    email: String(payload.email ?? ''),
    passwordHash: '',
    salt: '',
    roleKey: (payload.role_key ?? 'student') as User['roleKey'],
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

function toOrder(payload: Record<string, any>): Order {
  return {
    id: String(payload.id), userId: String(payload.user_id), type: payload.type, status: payload.status,
    subtotal: Number(payload.subtotal), discountAmount: Number(payload.discount_amount), voucherCode: payload.voucher_code,
    gatewayFee: Number(payload.gateway_fee), total: Number(payload.total), currency: String(payload.currency),
    items: (payload.items || []).map((item: Record<string, any>) => ({
      kind: item.kind, refId: String(item.ref_id), title: item.title, price: Number(item.price), qty: Number(item.qty),
      instructorId: item.instructor_id ? String(item.instructor_id) : null, thumbnail: item.thumbnail,
      variantId: item.variant_id, variantLabel: item.variant_label, isDigital: Boolean(item.is_digital),
    })),
    paidAt: payload.paid_at ? Date.parse(payload.paid_at) : null, needsShipping: Boolean(payload.needs_shipping),
    shippingName: payload.shipping_name, shippingAddress: payload.shipping_address, shippingPhone: payload.shipping_phone,
    createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0,
  };
}

function toPayment(payload: Record<string, any>): Payment {
  return { id: String(payload.id), orderId: String(payload.order_id), gateway: payload.gateway, mode: payload.mode, method: payload.method, reference: payload.reference, merchantRef: payload.merchant_ref, amount: Number(payload.amount), fee: Number(payload.fee), status: payload.status, signature: payload.signature, events: Array.isArray(payload.events) ? payload.events : [], createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0 };
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

function toCourse(payload: Record<string, any>): Course {
  return { id: String(payload.id), title: payload.title || '', slug: payload.slug || '', shortDescription: payload.short_description || '', description: payload.description || '', thumbnail: payload.thumbnail || null, categoryId: payload.category_id || null, instructorId: String(payload.instructor_id || ''), price: Number(payload.price || 0), discountPrice: Number(payload.discount_price || 0), isFree: Boolean(payload.is_free), level: payload.level || 'beginner', language: payload.language || 'Indonesia', status: payload.status, featured: Boolean(payload.featured), requirements: payload.requirements || [], outcomes: payload.outcomes || [], tags: payload.tags || [], createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0 };
}

export interface ApiCourseDetail { course: Course; enrolled: boolean; instructor?: User; sections: Array<Section & { lessons: Lesson[] }>; lessonCount: number; duration: number; studentsCount: number; }

export interface ApiCartLine { item: CartItem; product: Product; variant: ProductVariant | null; price: number; maxQty: number; }
export interface ApiCart { items: ApiCartLine[]; subtotal: number; count: number; hasPhysical: boolean; hasDigital: boolean; }
export interface ApiWallet { summary: { earned: number; reserved: number; available: number }; ledger: WalletTx[]; withdrawals: Withdrawal[]; }
export type ApiAdminWithdrawal = Withdrawal & { userName?: string; userEmail?: string };
export type ApiDigitalDelivery = { id: string; productId: string; productName: string; licenseKey: string; downloadUrl: string | null; downloads: number; status: 'active' | 'revoked'; createdAt: number };
export type ApiMedia = { id: string; name: string; mime: string; size: number; url: string; createdAt: number };
export type ApiContentRow = { id: string; title: string; slug: string; excerpt?: string; description?: string; content: string; thumbnail?: string | null; categoryId: string | null; status: string; publishedAt: number | null; createdAt: number; authorId: string | null; videoUrl?: string; tags?: string[]; eventDate?: string; eventTime?: string; location?: string; registrationUrl?: string; gallery?: string[] };
export type ApiCertificate = Certificate & { studentName?: string; courseTitle?: string; instructorName?: string; template?: { theme?: string; accent?: string; frame?: string } };

function toWallet(response: any): ApiWallet {
  const ledger = (response.ledger || []).map((tx: any): WalletTx => ({ id: String(tx.id), userId: String(tx.user_id), type: tx.type, refId: tx.ref_id, orderId: tx.order_id, amount: Number(tx.amount), gross: Number(tx.gross), platformFee: Number(tx.platform_fee), paymentFee: Number(tx.payment_fee), status: tx.status, note: tx.note || '', createdAt: tx.created_at ? Date.parse(tx.created_at) : 0, updatedAt: tx.updated_at ? Date.parse(tx.updated_at) : 0 }));
  const withdrawals = (response.withdrawals || []).map((item: any): Withdrawal => ({ id: String(item.id), userId: String(item.user_id), amount: Number(item.amount), bankName: item.bank_name, accountName: item.account_name, accountNumber: item.account_number, notes: item.notes || '', status: item.status, processedBy: item.processed_by, processedAt: item.processed_at ? Date.parse(item.processed_at) : null, adminNote: item.admin_note || '', createdAt: item.created_at ? Date.parse(item.created_at) : 0, updatedAt: item.updated_at ? Date.parse(item.updated_at) : 0 }));
  return { summary: { earned: Number(response.summary?.earned || 0), reserved: Number(response.summary?.reserved || 0), available: Number(response.summary?.available || 0) }, ledger, withdrawals };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body as ApiError;
    throw new Error(error.message || Object.values(error.errors || {})[0]?.[0] || 'Permintaan gagal.');
  }
  return body as T;
}

async function csrfHeaders(): Promise<Record<string, string>> {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  const token = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))?.split('=').slice(1).join('=');
  return token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {};
}

export const api = {
  async me(): Promise<User | null> {
    try { return toUser((await request<{ user: Record<string, unknown> }>('/auth/me')).user); }
    catch { return null; }
  },
  async login(email: string, password: string): Promise<User> {
    return toUser((await request<{ user: Record<string, unknown> }>('/auth/login', { method: 'POST', headers: await csrfHeaders(), body: JSON.stringify({ email, password }) })).user);
  },
  async register(data: { name: string; email: string; password: string; role: 'student' | 'instructor' }): Promise<User> {
    return toUser((await request<{ user: Record<string, unknown> }>('/auth/register', { method: 'POST', headers: await csrfHeaders(), body: JSON.stringify({ ...data, password_confirmation: data.password }) })).user);
  },
  async logout(): Promise<void> { await request('/auth/logout', { method: 'POST', headers: await csrfHeaders() }); },
  async courses(search = ''): Promise<Course[]> {
    const response = await request<{ data: any[] }>(`/courses${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return response.data.map(toCourse);
  },
  async course(slug: string): Promise<ApiCourseDetail> {
    const response = await request<{ course: any }>(`/courses/${encodeURIComponent(slug)}`);
    const course = response.course;
    const instructor = course.instructor ? { id: String(course.instructor.id), name: course.instructor.name || '', email: '', passwordHash: '', salt: '', roleKey: 'instructor' as const, status: 'active' as const, avatar: course.instructor.avatar || null, bio: '', instructorApproved: true, instructorHeadline: '', createdAt: 0, updatedAt: 0 } : undefined;
    const sections = (course.sections || []).map((section: any): Section & { lessons: Lesson[] } => ({ id: String(section.id), courseId: String(course.id), title: section.title, order: Number(section.sort || 0), createdAt: section.created_at ? Date.parse(section.created_at) : 0, updatedAt: section.updated_at ? Date.parse(section.updated_at) : 0, lessons: (section.lessons || []).map((lesson: any): Lesson => ({ id: String(lesson.id), courseId: String(course.id), sectionId: String(section.id), title: lesson.title, type: lesson.type, content: lesson.content || '', mediaUrl: lesson.media_url || '', durationMin: Number(lesson.duration_min || 0), preview: Boolean(lesson.preview), status: lesson.status, order: Number(lesson.sort || 0), createdAt: lesson.created_at ? Date.parse(lesson.created_at) : 0, updatedAt: lesson.updated_at ? Date.parse(lesson.updated_at) : 0 })) }));
    return { course: toCourse(course), enrolled: Boolean(course.enrolled), instructor, sections, lessonCount: sections.reduce((total: number, section: Section & { lessons: Lesson[] }) => total + section.lessons.length, 0), duration: sections.reduce((total: number, section: Section & { lessons: Lesson[] }) => total + section.lessons.reduce((sum: number, lesson: Lesson) => sum + lesson.durationMin, 0), 0), studentsCount: Number(course.enrollments_count || 0) };
  },
  async enroll(slug: string): Promise<unknown> { return request(`/courses/${encodeURIComponent(slug)}/enroll`, { method: 'POST' }); },
  async completeLesson(slug: string, lessonId: string): Promise<unknown> {
    return request(`/courses/${encodeURIComponent(slug)}/lessons/${encodeURIComponent(lessonId)}/complete`, { method: 'POST' });
  },
  async courseProgress(slug: string): Promise<{ done: number; total: number; pct: number; completedLessonIds: string[] }> {
    const response = await request<{ progress: { done: number; total: number; pct: number; completed_lesson_ids: string[] } }>(`/courses/${encodeURIComponent(slug)}/progress`);
    return { done: response.progress.done, total: response.progress.total, pct: response.progress.pct, completedLessonIds: response.progress.completed_lesson_ids.map(String) };
  },
  async quiz(quizId: string): Promise<{ quiz: Quiz; questions: Question[] }> { return toQuizPayload(await request(`/quizzes/${encodeURIComponent(quizId)}`)); },
  async quizzes(courseId: string): Promise<Quiz[]> {
    const response = await request<{ quizzes: any[] }>(`/courses/${encodeURIComponent(courseId)}/quizzes`);
    return response.quizzes.map((quiz: any) => toQuizPayload({ quiz })).map((result) => result.quiz);
  },
  async certificates(): Promise<ApiCertificate[]> { return (await request<{ certificates: any[] }>('/certificates')).certificates.map(toCertificate); },
  async issueCertificate(courseId: string): Promise<any> { return (await request<{ certificate: any }>(`/courses/${encodeURIComponent(courseId)}/certificate`, { method: 'POST' })).certificate; },
  async revokeCertificate(id: string): Promise<void> { await request(`/certificates/${encodeURIComponent(id)}/revoke`, { method: 'PATCH' }); },
  async certificateTemplates(): Promise<any[]> { return (await request<{ templates: any[] }>('/certificate-templates')).templates; },
  async createCertificateTemplate(payload: Record<string, unknown>): Promise<void> { await request('/certificate-templates', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateCertificateTemplate(id: string, payload: Record<string, unknown>): Promise<void> { await request(`/certificate-templates/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async deleteCertificateTemplate(id: string): Promise<void> { await request(`/certificate-templates/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async notifications(): Promise<Notification[]> {
    const response = await request<{ notifications: any[] }>('/notifications');
    return response.notifications.map((item: any) => ({ id: String(item.id), userId: String(item.user_id), title: item.title, body: item.body || '', link: item.link || '', read: Boolean(item.is_read), kind: item.kind, createdAt: item.created_at ? Date.parse(item.created_at) : 0, updatedAt: item.updated_at ? Date.parse(item.updated_at) : 0 }));
  },
  async readNotification(id: string): Promise<void> { await request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }); },
  async readAllNotifications(): Promise<void> { await request('/notifications/read-all', { method: 'POST' }); },
  async updateProfile(payload: { name: string; phone?: string; bio?: string; avatar?: string | null; instructor_headline?: string }): Promise<User> {
    return toUser((await request<{ user: Record<string, unknown> }>('/profile', { method: 'PUT', body: JSON.stringify(payload) })).user);
  },
  async updatePassword(currentPassword: string, password: string): Promise<void> {
    await request('/profile/password', { method: 'PUT', body: JSON.stringify({ current_password: currentPassword, password, password_confirmation: password }) });
  },
  async forgotPassword(email: string): Promise<void> { await request('/auth/forgot-password', { method: 'POST', headers: await csrfHeaders(), body: JSON.stringify({ email }) }); },
  async installStatus(): Promise<{ installed: boolean; database: string }> { return request('/install/status'); },
  async install(payload: Record<string, unknown>): Promise<void> { await request('/install', { method: 'POST', headers: await csrfHeaders(), body: JSON.stringify(payload) }); },
  async search(query: string): Promise<Array<{ group: string; label: string; to: string }>> {
    return (await request<{ results: Array<{ group: string; label: string; to: string }> }>(`/search?q=${encodeURIComponent(query)}`)).results;
  },
  async auditLogs(model = ''): Promise<{ logs: any[]; models: string[] }> {
    return request(`/admin/audit-logs${model ? `?model=${encodeURIComponent(model)}` : ''}`);
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
  async initiatePayment(orderId: string, gateway: 'tripay' | 'xendit' | 'stripe', method: string): Promise<unknown> {
    return request(`/orders/${encodeURIComponent(orderId)}/payment`, { method: 'POST', body: JSON.stringify({ gateway, method }) });
  },
  async order(orderId: string): Promise<Order> {
    return toOrder((await request<{ order: Record<string, any> }>(`/orders/${encodeURIComponent(orderId)}`)).order);
  },
  async orders(): Promise<Order[]> {
    const response = await request<{ data: Record<string, any>[] }>('/orders');
    return response.data.map(toOrder);
  },
  async payments(): Promise<Payment[]> {
    const response = await request<{ payments: { data: Record<string, any>[] } }>('/payments');
    return response.payments.data.map(toPayment);
  },
  async webhookLogs(): Promise<WebhookLog[]> {
    const response = await request<{ webhook_logs: any[] }>('/payments/webhook-logs');
    return response.webhook_logs.map((item: any) => ({ id: String(item.id), reference: item.reference, payloadHash: item.payload_hash, gateway: item.gateway, status: item.status, result: item.result, createdAt: item.created_at ? Date.parse(item.created_at) : 0, updatedAt: item.updated_at ? Date.parse(item.updated_at) : 0 }));
  },
  async products(search = ''): Promise<Product[]> {
    const response = await request<{ data: Record<string, any>[] }>(`/shop/products${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return response.data.map(toProduct);
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
  async digitalDeliveries(): Promise<ApiDigitalDelivery[]> {
    const response = await request<{ deliveries: any[] }>('/shop/digital-deliveries');
    return response.deliveries.map((item: any) => ({ id: String(item.id), productId: String(item.product_id), productName: item.product?.name || 'Produk digital', licenseKey: item.license_key, downloadUrl: item.download_url, downloads: Number(item.downloads), status: item.status, createdAt: item.created_at ? Date.parse(item.created_at) : 0 }));
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
  async media(): Promise<ApiMedia[]> {
    const response = await request<{ media: { data: any[] } }>('/media');
    return response.media.data.map((item: any) => ({ id: String(item.id), name: item.name, mime: item.mime, size: Number(item.size), url: item.url, createdAt: item.created_at ? Date.parse(item.created_at) : 0 }));
  },
  async articles(): Promise<unknown> { return request('/articles'); },
  async article(slug: string): Promise<unknown> { return request(`/articles/${encodeURIComponent(slug)}`); },
  async content(type: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages', search = ''): Promise<any[]> {
    const response = await request<{ data: any[] }>(`/${type}${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    return response.data.map((item: any) => ({ id: String(item.id), title: item.title || '', slug: item.slug || '', excerpt: item.excerpt || '', description: item.description || '', content: item.content || '', thumbnail: item.thumbnail || null, categoryId: item.category_id || null, status: item.status || 'published', publishedAt: item.published_at ? Date.parse(item.published_at) : null, createdAt: item.created_at ? Date.parse(item.created_at) : 0, authorId: item.author_id || null, videoUrl: item.video_url || '', tags: item.tags || [], eventDate: item.event_date || '', eventTime: item.event_time || '', location: item.location || '', registrationUrl: item.registration_url || '', gallery: item.gallery || [] }));
  },
  async manageContent(type: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages'): Promise<any[]> {
    const response = await request<{ content: { data: any[] } }>(`/admin/content/${type}`);
    return response.content.data.map(toContent);
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
  async manageProducts(): Promise<Product[]> {
    const response = await request<{ products: { data: any[] } }>('/admin/products');
    return response.products.data.map(toProduct);
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
    const response = await request<{ menus: any[] }>('/menus?location=header');
    return response.menus.map((menu: any) => ({ id: String(menu.id), name: menu.name, location: menu.location, createdAt: 0, updatedAt: 0, items: (menu.items || []).map((item: any): MenuItem => ({ id: String(item.id), menuId: String(menu.id), parentId: item.parent_id ? String(item.parent_id) : null, label: item.label, type: item.type, target: item.target, order: Number(item.sort || 0), createdAt: 0, updatedAt: 0 })) }));
  },
  async createMenuItem(payload: Record<string, unknown>): Promise<unknown> { return request('/menus/items', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateMenuItem(id: string, payload: Record<string, unknown>): Promise<unknown> { return request(`/menus/items/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async deleteMenuItem(id: string): Promise<void> { await request(`/menus/items/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async wallet(): Promise<ApiWallet> { return toWallet(await request('/wallet')); },
  async requestWithdrawal(data: { amount: number; bank_name: string; account_name: string; account_number: string; notes?: string }): Promise<unknown> {
    return request('/wallet/withdrawals', { method: 'POST', body: JSON.stringify(data) });
  },
  async adminWithdrawals(): Promise<ApiAdminWithdrawal[]> {
    const response = await request<{ withdrawals: any[] }>('/admin/withdrawals');
    return response.withdrawals.map((item: any): ApiAdminWithdrawal => ({ id: String(item.id), userId: String(item.user_id), amount: Number(item.amount), bankName: item.bank_name, accountName: item.account_name, accountNumber: item.account_number, notes: item.notes || '', status: item.status, processedBy: item.processed_by, processedAt: item.processed_at ? Date.parse(item.processed_at) : null, adminNote: item.admin_note || '', createdAt: item.created_at ? Date.parse(item.created_at) : 0, updatedAt: item.updated_at ? Date.parse(item.updated_at) : 0, userName: item.user?.name, userEmail: item.user?.email }));
  },
  async updateWithdrawal(withdrawalId: string, status: Withdrawal['status'], adminNote = ''): Promise<void> {
    await request(`/wallet/withdrawals/${encodeURIComponent(withdrawalId)}`, { method: 'PATCH', body: JSON.stringify({ status, admin_note: adminNote }) });
  },
};
