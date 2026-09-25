/* Domain types mirroring the Laravel API payloads (after api.ts mapping). No runtime data. */

export type ID = string;

export interface Row { id: ID; createdAt: number; updatedAt: number; }

/* ---------------- users & rbac ---------------- */
export type RoleKey = 'super_admin' | 'admin' | 'instructor' | 'student';

export interface Role extends Row { key: RoleKey; name: string; description: string; permissions: string[]; builtin: boolean; }

export interface User extends Row {
  name: string; email: string; passwordHash: string; salt: string;
  roleKey: RoleKey; status: 'active' | 'suspended';
  permissions?: string[];
  phone?: string; avatar?: string | null; bio?: string;
  instructorApproved?: boolean; instructorHeadline?: string;
  lastLoginAt?: number;
}

export interface Session extends Row { token: string; userId: ID; expiresAt: number; remember: boolean; }

/* ---------------- catalog / lms ---------------- */
export interface Category extends Row { scope: 'course' | 'article' | 'news' | 'tutorial' | 'product'; name: string; slug: string; }

export type CourseStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'archived';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Course extends Row {
  title: string; slug: string; shortDescription: string; description: string;
  thumbnail?: string | null; categoryId: ID | null; instructorId: ID;
  price: number; discountPrice: number; isFree: boolean;
  level: CourseLevel; language: string; status: CourseStatus;
  featured: boolean; requirements: string[]; outcomes: string[]; tags: string[];
  moderationNote?: string;
}

export interface Section extends Row { courseId: ID; title: string; order: number; }

export type LessonType = 'text' | 'video' | 'youtube' | 'pdf' | 'file' | 'image' | 'url' | 'embed';
export interface Lesson extends Row {
  courseId: ID; sectionId: ID; title: string; type: LessonType;
  content: string; mediaUrl: string; durationMin: number;
  preview: boolean; status: 'draft' | 'published'; order: number;
}

export interface Enrollment extends Row { userId: ID; courseId: ID; completedAt: number | null; lastLessonId: ID | null; }
export interface LessonProgress extends Row { userId: ID; courseId: ID; lessonId: ID; completedAt: number; }

/* ---------------- quiz ---------------- */
export type QuestionType = 'single' | 'boolean' | 'multiple' | 'short';
export interface Quiz extends Row {
  courseId: ID | null; instructorId: ID; title: string; description: string;
  timeLimitMin: number; passingScore: number; maxAttempts: number;
  randomize: boolean; active: boolean;
}
export interface QuestionOption { id: ID; text: string; }
export interface Question extends Row {
  quizId: ID; type: QuestionType; text: string; options: QuestionOption[];
  correct: string[]; points: number; order: number;
}
export interface QuizAttempt extends Row {
  quizId: ID; userId: ID; startedAt: number; submittedAt: number | null;
  answers: Record<ID, string[]>; score: number; maxScore: number; percent: number;
  passed: boolean; status: 'in_progress' | 'submitted';
}

/* ---------------- certificate ---------------- */
export interface CertificateTemplate extends Row {
  name: string; theme: 'navy' | 'ivory' | 'graphite'; accent: string; frame: 'modern' | 'classic';
}
export interface Certificate extends Row {
  number: string; userId: ID; courseId: ID; templateId: ID;
  issuedAt: number; status: 'issued' | 'revoked'; views: number;
}

/* ---------------- cms ---------------- */
export type ContentStatus = 'draft' | 'published';
export interface Article extends Row {
  title: string; slug: string; excerpt: string; content: string; thumbnail?: string | null;
  categoryId: ID | null; tags: string[]; status: ContentStatus; authorId: ID;
  seoTitle: string; seoDescription: string; publishedAt: number | null; featured: boolean;
}
export interface NewsItem extends Row {
  title: string; slug: string; excerpt: string; content: string; thumbnail?: string | null;
  categoryId: ID | null; videoUrl: string; status: ContentStatus; authorId: ID;
  seoTitle: string; seoDescription: string; publishedAt: number | null;
}
export interface Tutorial extends Row {
  title: string; slug: string; excerpt: string; content: string; thumbnail?: string | null;
  categoryId: ID | null; tags: string[]; videoUrl: string; status: ContentStatus; authorId: ID;
  seoTitle: string; seoDescription: string; publishedAt: number | null;
}
export interface Activity extends Row {
  title: string; slug: string; description: string; content: string; thumbnail?: string | null;
  eventDate: string; eventTime: string; location: string; videoUrl: string; registrationUrl: string;
  gallery: string[]; status: ContentStatus; authorId: ID;
}
export interface Page extends Row {
  title: string; slug: string; content: string; thumbnail?: string | null;
  status: ContentStatus; seoTitle: string; seoDescription: string;
}

export type BlockType = 'hero' | 'stats' | 'featured_courses' | 'latest_courses' | 'free_courses' | 'categories'
  | 'instructors' | 'articles' | 'news' | 'tutorials' | 'activities' | 'cta' | 'text' | 'video' | 'map' | 'custom'
  | 'banner' | 'slider' | 'faq' | 'testimonial';
export interface HomeBlock extends Row { type: BlockType; enabled: boolean; order: number; settings: Record<string, string>; }

export interface Menu extends Row { name: string; location: 'header' | 'footer' | 'both'; }
export interface MenuItem extends Row { menuId: ID; parentId: ID | null; label: string; type: 'home' | 'courses' | 'articles' | 'news' | 'tutorials' | 'activities' | 'about' | 'contact' | 'shop' | 'page' | 'custom'; target: string; order: number; }

export interface MediaItem extends Row { name: string; mime: string; size: number; url: string; uploadedBy: ID | null; }

/* ---------------- commerce ---------------- */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired';
export interface OrderItem { kind: 'course' | 'product'; refId: ID; title: string; price: number; qty: number; instructorId: ID | null; instructorName?: string | null; thumbnail?: string | null; variantId?: string | null; variantLabel?: string | null; isDigital?: boolean; }
export interface Order extends Row {
  userId: ID; type: 'course' | 'shop'; status: OrderStatus;
  subtotal: number; discountAmount: number; voucherCode: string | null; gatewayFee: number; total: number; currency: string;
  items: OrderItem[]; paidAt: number | null;
  needsShipping: boolean; shippingName?: string; shippingAddress?: string; shippingPhone?: string;
}

export type GatewayKey = 'tripay' | 'xendit' | 'stripe';
export interface Payment extends Row {
  orderId: ID; gateway: GatewayKey; mode: 'sandbox' | 'live'; method: string;
  reference: string; merchantRef: string; amount: number; fee: number;
  status: 'pending' | 'paid' | 'failed' | 'expired'; signature: string;
  events: { at: number; event: string }[];
}
export interface WebhookLog extends Row { reference: string; payloadHash: string; gateway: GatewayKey; status: string; result: 'processed' | 'duplicate' | 'invalid'; }

export interface WalletTx extends Row {
  userId: ID; type: 'earning' | 'withdrawal' | 'adjustment'; refId: ID | null;
  orderId: ID | null; amount: number; gross: number; platformFee: number; paymentFee: number;
  status: 'pending' | 'completed' | 'rejected'; note: string;
}
export type WithdrawalStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
export interface Withdrawal extends Row {
  userId: ID; amount: number; bankName: string; accountName: string; accountNumber: string;
  notes: string; status: WithdrawalStatus; processedBy: ID | null; processedAt: number | null; adminNote: string;
}

export interface ProductVariant { id: string; label: string; price: number; stock: number; }
export interface Product extends Row {
  name: string; slug: string; description: string; thumbnail?: string | null;
  price: number; discountPrice: number; stock: number; categoryId: ID | null;
  status: ContentStatus; featured: boolean;
  isDigital: boolean; digitalFileUrl?: string | null; variants: ProductVariant[] | null;
}
export interface CartItem extends Row { userId: ID; productId: ID; qty: number; variantId: string | null; }

/* ---------------- shop: voucher & digital delivery ---------------- */
export interface Voucher extends Row {
  code: string; type: 'percent' | 'fixed'; value: number;
  minOrder: number; maxDiscount: number; usageLimit: number; usedCount: number;
  expiresAt: number | null; active: boolean; note: string;
}
export interface DigitalDelivery extends Row {
  userId: ID; productId: ID; orderItemId: ID | null;
  licenseKey: string; downloadUrl: string; downloads: number; status: 'active' | 'revoked';
}

/* ---------------- system ---------------- */
export interface Notification extends Row { userId: ID; title: string; body: string; link: string; read: boolean; kind: 'info' | 'success' | 'warning' | 'danger'; }
export interface AuditLog extends Row { userId: ID | null; userName: string; action: string; model: string; modelId: ID | null; detail: string; ip: string; ua: string; }
export interface ContactMessage extends Row { name: string; email: string; subject: string; body: string; read: boolean; }
