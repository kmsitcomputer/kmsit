/* ============================================================
   KMSIT Computer — Data Layer
   Relational table store with FK-style relations & cascades.
   Di production Laravel: tabel-tabel ini dipetakan 1:1 ke
   MySQL migrations (lihat README.md & INSTALL.md).
   ============================================================ */

export type ID = string;

export interface Row { id: ID; createdAt: number; updatedAt: number; }

/* ---------------- users & rbac ---------------- */
export type RoleKey = 'super_admin' | 'admin' | 'instructor' | 'student';

export interface Role extends Row { key: RoleKey; name: string; description: string; permissions: string[]; builtin: boolean; }

export interface User extends Row {
  name: string; email: string; passwordHash: string; salt: string;
  roleKey: RoleKey; status: 'active' | 'suspended';
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
  | 'instructors' | 'articles' | 'news' | 'tutorials' | 'activities' | 'cta' | 'text' | 'video' | 'map' | 'custom';
export interface HomeBlock extends Row { type: BlockType; enabled: boolean; order: number; settings: Record<string, string>; }

export interface Menu extends Row { name: string; location: 'header' | 'footer'; }
export interface MenuItem extends Row { menuId: ID; parentId: ID | null; label: string; type: 'home' | 'courses' | 'articles' | 'news' | 'tutorials' | 'activities' | 'about' | 'contact' | 'shop' | 'page' | 'custom'; target: string; order: number; }

export interface MediaItem extends Row { name: string; mime: string; size: number; url: string; uploadedBy: ID | null; }

/* ---------------- commerce ---------------- */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired';
export interface OrderItem { kind: 'course' | 'product'; refId: ID; title: string; price: number; qty: number; instructorId: ID | null; thumbnail?: string | null; }
export interface Order extends Row {
  userId: ID; type: 'course' | 'shop'; status: OrderStatus;
  subtotal: number; gatewayFee: number; total: number; currency: string;
  items: OrderItem[]; paidAt: number | null;
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

export interface Product extends Row {
  name: string; slug: string; description: string; thumbnail?: string | null;
  price: number; discountPrice: number; stock: number; categoryId: ID | null;
  status: ContentStatus; featured: boolean;
}
export interface CartItem extends Row { userId: ID; productId: ID; qty: number; }

/* ---------------- system ---------------- */
export interface Notification extends Row { userId: ID; title: string; body: string; link: string; read: boolean; kind: 'info' | 'success' | 'warning' | 'danger'; }
export interface AuditLog extends Row { userId: ID | null; userName: string; action: string; model: string; modelId: ID | null; detail: string; ip: string; ua: string; }
export interface ContactMessage extends Row { name: string; email: string; subject: string; body: string; read: boolean; }

export interface DBMeta { version: number; installed: boolean; installedAt: number | null; appKey: string; }

/* ============================================================ */

export interface Schema {
  users: User[]; roles: Role[]; sessions: Session[];
  categories: Category[]; courses: Course[]; sections: Section[]; lessons: Lesson[];
  enrollments: Enrollment[]; lessonProgress: LessonProgress[];
  quizzes: Quiz[]; questions: Question[]; quizAttempts: QuizAttempt[];
  certificateTemplates: CertificateTemplate[]; certificates: Certificate[];
  articles: Article[]; news: NewsItem[]; tutorials: Tutorial[]; activities: Activity[]; pages: Page[];
  homepageBlocks: HomeBlock[]; menus: Menu[]; menuItems: MenuItem[]; media: MediaItem[];
  orders: Order[]; payments: Payment[]; webhookLogs: WebhookLog[];
  walletTx: WalletTx[]; withdrawals: Withdrawal[];
  products: Product[]; cartItems: CartItem[];
  notifications: Notification[]; auditLogs: AuditLog[]; contactMessages: ContactMessage[];
  settings: Record<string, string>;
}

export type TableKey = keyof Omit<Schema, 'settings'>;

const DB_KEY = 'kmsit_db_v1';
const META_KEY = 'kmsit_meta_v1';

export const uid = (): ID =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const now = () => Date.now();

const emptyTables = (): Schema => ({
  users: [], roles: [], sessions: [],
  categories: [], courses: [], sections: [], lessons: [],
  enrollments: [], lessonProgress: [],
  quizzes: [], questions: [], quizAttempts: [],
  certificateTemplates: [], certificates: [],
  articles: [], news: [], tutorials: [], activities: [], pages: [],
  homepageBlocks: [], menus: [], menuItems: [], media: [],
  orders: [], payments: [], webhookLogs: [],
  walletTx: [], withdrawals: [],
  products: [], cartItems: [],
  notifications: [], auditLogs: [], contactMessages: [],
  settings: {},
});

let state: Schema = emptyTables();
let meta: DBMeta = { version: 1, installed: false, installedAt: null, appKey: '' };
let loaded = false;
let rev = 0;
const listeners = new Set<() => void>();

function persist() {
  rev += 1;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* storage full — ignore for safety */ }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(DB_KEY);
    const rawMeta = localStorage.getItem(META_KEY);
    if (raw) state = { ...emptyTables(), ...(JSON.parse(raw) as Schema) };
    if (rawMeta) meta = { ...meta, ...(JSON.parse(rawMeta) as DBMeta) };
  } catch { state = emptyTables(); }
}

function bump() { persist(); listeners.forEach((l) => l()); }

export const db = {
  all<K extends TableKey>(table: K): Schema[K] { load(); return state[table]; },
  where<K extends TableKey>(table: K, pred: (r: Schema[K][number]) => boolean): Schema[K][number][] {
    return (state[table] as Schema[K][number][]).filter(pred);
  },
  find<K extends TableKey>(table: K, pred: (r: Schema[K][number]) => boolean): Schema[K][number] | undefined {
    return (state[table] as Schema[K][number][]).find(pred);
  },
  byId<K extends TableKey>(table: K, id: ID): Schema[K][number] | undefined {
    return (state[table] as Schema[K][number][]).find((r) => (r as Row).id === id);
  },
  count<K extends TableKey>(table: K, pred?: (r: Schema[K][number]) => boolean): number {
    return pred ? db.where(table, pred).length : (state[table] as unknown[]).length;
  },
  insert<K extends TableKey>(table: K, row: Omit<Schema[K][number], 'id' | 'createdAt' | 'updatedAt'> & { id?: ID }): Schema[K][number] {
    load();
    const full = { ...row, id: row.id ?? uid(), createdAt: now(), updatedAt: now() } as Schema[K][number];
    (state[table] as Schema[K][number][]).push(full);
    bump();
    return full;
  },
  update<K extends TableKey>(table: K, id: ID, patch: Partial<Schema[K][number]>): Schema[K][number] | undefined {
    load();
    const arr = state[table] as Schema[K][number][];
    const i = arr.findIndex((r) => (r as Row).id === id);
    if (i === -1) return undefined;
    arr[i] = { ...arr[i], ...patch, updatedAt: now() } as Schema[K][number];
    bump();
    return arr[i];
  },
  remove<K extends TableKey>(table: K, id: ID): boolean {
    load();
    const arr = state[table] as Schema[K][number][];
    const i = arr.findIndex((r) => (r as Row).id === id);
    if (i === -1) return false;
    arr.splice(i, 1);
    bump();
    return true;
  },
  bulk<K extends TableKey>(table: K, fn: (rows: Schema[K][number][]) => void) { load(); fn(state[table] as Schema[K][number][]); bump(); },
  setSetting(key: string, value: string) { load(); state.settings[key] = value; bump(); },
  setSettings(patch: Record<string, string>) { load(); Object.assign(state.settings, patch); bump(); },
  settings(): Record<string, string> { load(); return state.settings; },
  meta(): DBMeta { load(); return meta; },
  revision(): number { return rev; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  isInstalled(): boolean { load(); return meta.installed; },
  markInstalled(appKey: string) { meta = { ...meta, installed: true, installedAt: now(), appKey }; persist(); listeners.forEach((l) => l()); },
  /** Full reset — used by installer & system settings (danger zone). */
  resetAll() { state = emptyTables(); meta = { version: 1, installed: false, installedAt: null, appKey: '' }; persist(); listeners.forEach((l) => l()); },
};

/* ---------------- default seeds written by the installer ---------------- */

export const PERMISSIONS: Record<RoleKey, string[]> = {
  super_admin: ['*'],
  admin: [
    'dashboard', 'manage_articles', 'manage_news', 'manage_tutorials', 'manage_activities', 'manage_pages',
    'manage_media', 'manage_menus', 'manage_homepage', 'manage_about',
    'manage_courses', 'moderate_courses', 'manage_categories', 'manage_quizzes', 'manage_certificates',
    'manage_students', 'manage_instructors',
    'manage_orders', 'view_payments', 'process_withdrawals', 'manage_shop',
    'view_reports', 'view_messages',
  ],
  instructor: [
    'dashboard', 'instructor_courses', 'instructor_quizzes', 'instructor_students',
    'instructor_wallet', 'instructor_withdrawals', 'instructor_certificates', 'edit_own_profile',
  ],
  student: ['dashboard', 'learn', 'student_orders', 'student_certificates', 'edit_own_profile', 'shop'],
};

export function seedInstaller(config: {
  siteName: string; siteUrl: string; slogan: string; adminName: string; adminEmail: string;
  passwordHash: string; salt: string; timezone: string; language: string; currency: string;
}) {
  load();
  state = emptyTables();
  const t = now();
  const mk = <T extends Row>(base: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): T =>
    ({ ...base, id: uid(), createdAt: t, updatedAt: t } as T);

  (['super_admin', 'admin', 'instructor', 'student'] as RoleKey[]).forEach((key) => {
    state.roles.push(mk<Role>({
      key, builtin: true, permissions: PERMISSIONS[key],
      name: key === 'super_admin' ? 'Super Admin' : key === 'admin' ? 'Admin' : key === 'instructor' ? 'Instructor' : 'Student',
      description: key === 'super_admin' ? 'Akses penuh ke seluruh sistem.' : key === 'admin' ? 'Pengelola konten & operasional.' : key === 'instructor' ? 'Pengajar & pemilik kelas.' : 'Peserta pembelajaran.',
    }));
  });

  state.users.push(mk<User>({
    name: config.adminName, email: config.adminEmail.toLowerCase(), passwordHash: config.passwordHash,
    salt: config.salt, roleKey: 'super_admin', status: 'active', avatar: null, bio: '',
    instructorApproved: true,
  }));

  state.settings = {
    site_name: config.siteName, site_url: config.siteUrl, slogan: config.slogan,
    logo: '', favicon: '', address: 'Jl. Pendidikan No. 12, Palembang, Indonesia',
    map_lat: '-2.976074', map_lng: '104.775431', map_query: 'KMSIT Computer Palembang',
    email: config.adminEmail, phone: '+62 711 000 000', whatsapp: '6281234567890',
    footer_text: '© KMSIT Computer — Belajar komputer, dari dasar sampai mahir.',
    social_facebook: '', social_instagram: '', social_youtube: '', social_tiktok: '',
    seo_title: `${config.siteName} — Kursus Komputer & Sertifikat Digital`,
    seo_description: 'Platform belajar komputer online: kelas interaktif, quiz, sertifikat digital terverifikasi.',
    default_language: config.language, timezone: config.timezone, currency: config.currency,
    allow_registration: '1', maintenance_mode: '0', platform_fee_percent: '15',
    gateway_active: 'tripay', gateway_mode: 'sandbox',
    tripay_api_key: '', tripay_private_key: '', tripay_merchant_code: '',
    xendit_api_key: '', xendit_callback_token: '',
    stripe_publishable_key: '', stripe_secret_key: '', stripe_webhook_secret: '',
    google_maps_api_key: '', mail_driver: 'log', mail_host: '', mail_port: '587', mail_username: '',
    about_hero_title: `Selamat datang di ${config.siteName}`,
    about_hero_subtitle: 'Lembaga kursus komputer yang mencetak talenta digital siap kerja.',
    about_description: '<p>KMSIT Computer adalah lembaga pendidikan non-formal di bidang teknologi informasi. Kami menyelenggarakan pelatihan komputer berbasis kompetensi dengan kurikulum industri, pengajar berpengalaman, dan sertifikat digital yang dapat diverifikasi.</p>',
    about_vision: '<p>Menjadi lembaga pelatihan komputer terdepan yang menghasilkan SDM digital unggul dan berdaya saing global.</p>',
    about_mission: '<ul><li>Menyediakan kurikulum komputer yang relevan dengan kebutuhan industri.</li><li>Membangun ekosistem belajar online yang modern dan mudah diakses.</li><li>Menerbitkan sertifikat digital yang transparan dan terverifikasi.</li></ul>',
    about_history: '', about_team: '[]', about_gallery: '[]', about_video: '',
  };

  state.certificateTemplates.push(mk<CertificateTemplate>({ name: 'KMSIT Signature', theme: 'navy', accent: '#2dd4bf', frame: 'modern' }));
  state.certificateTemplates.push(mk<CertificateTemplate>({ name: 'Ivory Classic', theme: 'ivory', accent: '#b45309', frame: 'classic' }));

  const blocks: Array<[BlockType, Record<string, string>]> = [
    ['hero', { heading: 'Kuasai Skill Komputer,\nRaih Sertifikat Digital', sub: 'Kelas interaktif dengan quiz, materi lengkap, dan sertifikat terverifikasi QR.', search_placeholder: 'Cari kelas… mis. "Excel", "Desain Grafis"' }],
    ['stats', {}],
    ['featured_courses', { title: 'Kelas Unggulan', sub: 'Kurasi kelas terbaik dari para instructor.' }],
    ['categories', { title: 'Jelajahi Kategori' }],
    ['latest_courses', { title: 'Kelas Terbaru', sub: 'Baru ditambahkan ke katalog.' }],
    ['free_courses', { title: 'Kelas Gratis', sub: 'Mulai belajar tanpa biaya.' }],
    ['instructors', { title: 'Instructor Kami', sub: 'Praktisi & pengajar berpengalaman.' }],
    ['tutorials', { title: 'Tutorial Terbaru' }],
    ['articles', { title: 'Artikel & Insight' }],
    ['news', { title: 'Berita Terkini' }],
    ['activities', { title: 'Kegiatan Terbaru' }],
    ['cta', { title: 'Siap mulai belajar hari ini?', sub: 'Daftar gratis dan akses kelas pertamamu dalam hitungan menit.', button_label: 'Lihat Semua Kelas' }],
    ['map', { title: 'Lokasi Kami' }],
  ];
  blocks.forEach(([type, settings], i) => {
    state.homepageBlocks.push(mk<HomeBlock>({ type, enabled: true, order: i, settings }));
  });

  const headerMenu = mk<Menu>({ name: 'Menu Utama', location: 'header' });
  const footerMenu = mk<Menu>({ name: 'Menu Footer', location: 'footer' });
  state.menus.push(headerMenu, footerMenu);
  const items: Array<[string, MenuItem['type'], string]> = [
    ['Beranda', 'home', '/'], ['Kelas', 'courses', '/courses'], ['Tutorial', 'tutorials', '/tutorials'],
    ['Artikel', 'articles', '/articles'], ['Berita', 'news', '/news'], ['Kegiatan', 'activities', '/activities'],
    ['Toko', 'shop', '/shop'], ['Tentang Kami', 'about', '/about'], ['Kontak', 'contact', '/contact'],
  ];
  items.forEach(([label, type, target], i) => {
    state.menuItems.push(mk<MenuItem>({ menuId: headerMenu.id, parentId: null, label, type, target, order: i }));
    if (i >= 1 && i <= 7) state.menuItems.push(mk<MenuItem>({ menuId: footerMenu.id, parentId: null, label, type, target, order: i }));
  });

  const pages: Array<[string, string, string]> = [
    ['Kebijakan Privasi', 'privacy-policy', '<p>Halaman kebijakan privasi — jelaskan bagaimana data pengguna dikelola.</p>'],
    ['Syarat & Ketentuan', 'terms', '<p>Halaman syarat & ketentuan penggunaan platform.</p>'],
    ['FAQ', 'faq', '<p>Pertanyaan yang sering diajukan.</p>'],
  ];
  pages.forEach(([title, slug, content]) => {
    state.pages.push(mk<Page>({ title, slug, content, thumbnail: null, status: 'published', seoTitle: title, seoDescription: '' }));
  });

  meta = { version: 1, installed: true, installedAt: t, appKey: `base64:${config.passwordHash.slice(0, 24)}${uid()}` };
  persist();
  listeners.forEach((l) => l());
}
