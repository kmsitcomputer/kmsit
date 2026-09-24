# KMSIT Computer — System Architecture

**Dokumentasi arsitektur sistem lengkap**
Dibuat: 22 September 2026 · Diperbarui: 24 September 2026 · Platform: LMS + CMS + E-commerce

---

## Daftar Isi

1. [Overview](#1-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Backend Architecture](#3-backend-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Security Architecture](#6-security-architecture)
7. [Payment Architecture](#7-payment-architecture)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Component Diagrams](#9-component-diagrams)

---

## 1. Overview

KMSIT Computer adalah platform **tiga-dalam-satu**: Learning Management System (LMS), Content Management System (CMS), dan e-commerce, diimplementasikan sebagai **monolith Laravel** yang menyajikan API REST sekaligus meng-host SPA React. Satu proses PHP-FPM melayani seluruh traffic — API dan frontend — dari direktori publik yang sama.

### Desain Principles

| Principle | Implementation |
|---|---|
| **Monolithic simplicity** | Satu deploy, satu database, tanpa microservice overhead |
| **Shared hosting friendly** | Installer wizard menulis `.env` tanpa SSH, auto-migrate, shared hosting compatible |
| **API-first backend** | Backend murni sebagai REST API; frontend adalah satu consumer |
| **Row-level RBAC** | Permission dicek per-baris (bukan hanya per-role), inline di controller |
| **Idempotent operations** | Webhook dedupe via `payload_hash`, enrollment/certificate issuance idempotent |
| **Server-driven session** | Autentikasi via cookie session, bukan localStorage JWT |

### Stack Summary

| Layer | Technology |
|---|---|
| **Language** | PHP 8.3+ / JavaScript (TypeScript) |
| **Backend Framework** | Laravel 13 (PHP) |
| **Frontend Framework** | React 18 (TypeScript) |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS 4 (CSS-first, no config) |
| **Database** | MySQL 8.0+ |
| **Routing** | Laravel routes + React Router HashRouter |
| **Editor** | Tiptap (WYSIWYG CMS) |
| **Payment** | Tripay, Xendit, Stripe (custom HTTP impl) |

---

## 2. High-Level Architecture

```
                    ┌─────────────────────────────┐
                    │         Browser              │
                    │                              │
                    │  ┌─────────────────────────┐ │
                    │  │   React 18 SPA           │ │
                    │  │   - HashRouter            │ │
                    │  │   - AppProvider (state)   │ │
                    │  │   - Public pages          │ │
                    │  │   - Dashboard (role-based)│ │
                    │  └─────────────────────────┘ │
                    │         HashRouter (/#...)     │
                    │                              │
                    └──────────┬───────────────────┘
                               │ HTTPS / API calls
                               │
                    ┌──────────▼───────────────────┐
                    │       Web Server             │
                    │    (Apache/Nginx + PHP-FPM)  │
                    │                              │
                    │  DocumentRoot → backend/     │
                    │           public/              │
                    │                              │
                    └──────────┬───────────────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
        ┌─────────▼─────────┐   ┌──────────▼──────────┐
        │    web.php        │   │    api.php            │
        │   (SPA fallback)  │   │   (REST API)          │
        │                   │   │                       │
        │  GET / → app.html │   │  /api/v1/*            │
        │  Catch-all SPA    │   │  Route groups with    │
        │  storage/{path}   │   │  AuthenticateApiUser  │
        └─────────┬─────────┘   └──────────┬──────────┘
                  │                         │
                  │                         ▼
                  │            ┌──────────────────────┐
                  │            │  Controllers (30+)    │
                  │            │  - Auth               │
                  │            │  - Course             │
                  │            │  - Order              │
                  │            │  - Shop               │
                  │            │  - CMS                │
                  │            │  - Admin              │
                  │            └──────────┬───────────┘
                  │                       │
                  │          ┌────────────┴────────────┐
                  │          │    Models (39)          │
                  │          │    - Relationships      │
                  │          │    - Soft deletes       │
                  │          │    - Accessors          │
                  │          └────────────┬────────────┘
                  │                       │
                  │          ┌────────────┴────────────┐
                  │          │    Services             │
                  │          │    - PaymentGatewayMgr  │
                  │          │    - StripeGateway      │
                  │          │    - TripayGateway      │
                  │          │    - XenditGateway      │
                  │          └────────────┬────────────┘
                  │                       │
                  │                       ▼
                  │            ┌──────────────────────┐
                  │            │      MySQL DB        │
                  │            │   (41 domain tables) │
                  │            └──────────────────────┘
                  │
                  │       External Services
                  │  ┌──────┬───────┬───────┐
                  │  │Tripay│Xendit │Stripe │
                  │  │SMTP  │       │       │
                  │  └──────┴───────┴───────┘
                  │
                  └──────────────────────────────┘
```

### Request Flow

1. **Initial Load**: `GET /` → `web.php` catch-all → serves `backend/public/app.html` (React SPA shell)
2. **Hydration**: React `AppProvider` fetches `GET /api/v1/auth/me`, `GET /api/v1/settings/public`, `GET /api/v1/categories`
3. **Client Routing**: `HashRouter` interprets `#/...` fragments, renders matching route component
4. **API Calls**: Fetch requests to `/api/v1/*` with `credentials: 'include'` for session cookies
5. **Auth Flow**: CSRF token from `/sanctum/csrf-cookie` → `X-XSRF-TOKEN` header on mutations
6. **Backend Processing**: Laravel routes → middleware (auth, rate limit) → controller → model → response

---

## 3. Backend Architecture

### Directory Structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/V1/        # 30 API controllers
│   │   │   ├── AuthController         # register, login, logout, me
│   │   │   ├── CourseController       # courses CRUD, enroll, progress
│   │   │   ├── QuizController         # quizzes, attempts, scoring
│   │   │   ├── CertificateController  # issue, verify, revoke
│   │   │   ├── OrderController        # orders, payments, webhook
│   │   │   ├── ShopController         # products, cart, vouchers, delivery
│   │   │   ├── WalletController       # wallet summary, withdrawals
│   │   │   ├── SettingsController     # settings CRUD, payment config
│   │   │   ├── MediaController        # media library, upload, serve
│   │   │   ├── ArticleController      # articles index/show
│   │   │   ├── ContentController      # news/tutorials/activities/pages
│   │   │   ├── HomepageController     # homepage blocks management
│   │   │   ├── MenuController         # menus & menu items
│   │   │   ├── NotificationController # notifications CRUD
│   │   │   ├── SearchController       # global search
│   │   │   ├── AuditController        # audit log viewer
│   │   │   ├── ContactController      # contact messages
│   │   │   ├── ProductController      # product management
│   │   │   ├── CategoryController     # category CRUD
│   │   │   ├── CertificateTemplateController # certificate themes
│   │   │   ├── BackupController       # export backup
│   │   │   ├── ProfileController      # profile update, avatar
│   │   │   ├── InstallController      # installation wizard
│   │   │   ├── PasswordResetController # forgot/reset password
│   │   │   ├── DashboardController    # dashboard summary stats (per role)
│   │   │   ├── InstructorController   # owned students/sales/earnings/quizzes/progress
│   │   │   ├── LearningController     # learner /my/* endpoints
│   │   │   ├── OperationsController   # super-admin operations status
│   │   │   ├── UserController         # user CRUD, approve instructor
│   │   │   └── VoucherController      # voucher management
│   │   ├── Middleware/
│   │   │   ├── AuthenticateApiUser    # auth: sanctum bearer → web session
│   │   │   ├── VerifyCsrfTokenForSession # CSRF for cookie-auth mutations
│   │   │   ├── ValidateAuthEpoch      # invalidate stale sessions (auth_epoch)
│   │   │   └── PreventMaintenanceAccess # maintenance gate (admin bypass)
│   ├── Models/                        # 39 Eloquent models
│   ├── Policies/                      # UserPolicy (user authorization)
│   ├── Services/                      # Business logic services
│   │   ├── PaymentGatewayManager.php  # Gateway selection dispatcher
│   │   ├── StripeGateway.php          # Stripe implementation
│   │   ├── TripayGateway.php          # Tripay implementation
│   │   ├── XenditGateway.php          # Xendit implementation
│   │   ├── NotificationService.php    # idempotent in-app notifications
│   │   ├── InstructorEarnings.php     # wallet credit on paid orders
│   │   ├── StockReservation.php       # stock reserve/confirm/release
│   │   └── VoucherReservation.php     # voucher reserve/consume/release
│   ├── Support/                       # AdminAccess, InstructorAccess, Pagination,
│   │                                  # OperationsStatus, HtmlSanitizer, FileSecurity, SessionRevoker
│   ├── Mail/
│   │   └── PasswordResetMail.php      # Mailable for password reset
│   ├── Contracts/
│   │   └── PaymentGateway.php         # Payment gateway contract
│   └── Providers/
│       └── AppServiceProvider.php     # Bootstrap bindings/repo
├── bootstrap/
│   ├── app.php                        # Auto .env creation
│   └── providers.php                  # Service providers list
├── config/                            # Configuration files
│   ├── app.php, auth.php, cache.php
│   ├── database.php, mail.php
│   ├── commerce.php                   # Order TTL + voucher reservation config
│   ├── payment.php                    # Payment gateway credentials + HTTP timeouts
│   ├── queue.php, session.php, logging.php
├── database/
│   ├── migrations/                    # 27 migration files (schema source of truth)
│   ├── seeders/                       # DatabaseSeeder
│   └── schema.sql                     # SQLite-dialect reference dump (may lag migrations)
├── routes/
│   ├── api.php                        # All /api/v1/* endpoints
│   └── web.php                        # SPA fallback + sensitive paths
├── tests/Feature/                     # PHPUnit feature tests (42 files, 214 tests)
├── public/                            # Static assets + app.html
├── storage/                           # Logs, uploads, cache
├── resources/                         # Views, CSS, JS
├── artisan                            # CLI commands
├── composer.json
└── .env.production.example            # Production environment template
```

### Controller Pattern

Controllers follow a consistent pattern:

```php
// 1. Validate input
$validated = $request->validate([...]);

// 2. Check authorization (inline RBAC)
abort_unless(in_array($user->role_key, [...]), 403);

// 3. Execute business logic (model/service)
$result = Model::where(...)->update($validated);

// 4. Return JSON response
return response()->json([...]);
```

Key differences from typical Laravel apps:
- **Hybrid authorization**: shared helpers (`AdminAccess`, `InstructorAccess`) plus Laravel `UserPolicy` for user management; controllers still verify permission/ownership server-side
- **Custom auth middleware** (`AuthenticateApiUser`): resolves the Sanctum bearer token first, then falls back to the `web` session guard
- **Session-first auth**: cookie session is the primary path; the `sanctum` guard is registered by the package and used as the bearer fallback

### Route Organization

Routes are organized in `routes/api.php` using grouped patterns:

```php
// Auth (separate group, web middleware for sessions + Laravel CSRF)
Route::prefix('v1/auth')->middleware('web')->group(fn() => {...});

// Courses (public read + authenticated mutations)
Route::prefix('v1/courses')->group(fn() => {...});

// Instructor (ownership-scoped)
Route::prefix('v1/instructor')->middleware([EncryptCookies::class, StartSession::class, AuthenticateApiUser::class, VerifyCsrfTokenForSession::class, PreventMaintenanceAccess::class, ValidateAuthEpoch::class])->group(fn() => {
    // /instructor/{students,sales,earnings,quizzes,quiz-attempts,courses/{id}/progress}
});

// Authenticated group (main API block)
Route::prefix('v1')->middleware([EncryptCookies::class, StartSession::class, AuthenticateApiUser::class, VerifyCsrfTokenForSession::class, PreventMaintenanceAccess::class, ValidateAuthEpoch::class])->group(fn() => {
    // Dashboard, /my/* (learner), Quizzes, Certificates, Notifications, Profile
    // Orders, Payments, Shop, Wallet, Settings, Media
    // Admin sections (courses, quizzes, users, products, categories, ops status)
    // CMS content (news, tutorials, activities, pages)
    // Homepage blocks, menus, articles
});

// Public endpoints (no auth required)
Route::post('/v1/payments/webhook/{gateway}', ...);
Route::get('/v1/shop/products', ...);
Route::get('/v1/settings/public', ...);
Route::get('/v1/search', ...);
```

### Middleware Chain

```
Request
  → PreventMaintenanceAccess (global) [503 for public, admin/super_admin bypass]
  → EncryptCookies + StartSession [session hydration]
  → AuthenticateApiUser [sanctum bearer → web session]
  → VerifyCsrfTokenForSession [CSRF for cookie-auth mutations; bearer exempt]
  → PreventMaintenanceAccess + ValidateAuthEpoch [group-level]
  → throttle:N,M [rate limiting per endpoint]
  → Controller
```

### Service Layer Pattern

Business logic is concentrated in `Services/` for payment processing:

```php
interface PaymentGateway {
    public function createPayment(Order $order, string $method): array;
    public function verifyWebhook(array $payload, string $signature): bool;
}

class PaymentGatewayManager {
    public function resolve(string $gateway): PaymentGateway;  // tripay|xendit|stripe
}
```

Additional services: `NotificationService` (idempotent in-app notifications), `InstructorEarnings`
(wallet ledger credit on paid orders), `StockReservation` and `VoucherReservation` (reserve/confirm/release).
Cross-cutting helpers live in `Support/` (`AdminAccess`, `InstructorAccess`, `Pagination`, `OperationsStatus`,
`HtmlSanitizer`, `FileSecurity`, `SessionRevoker`).

---

## 4. Frontend Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router setup + guards
│   ├── index.css                   # Global styles
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── Shell.tsx               # Layout shells (public + dashboard)
│   │   ├── ui.tsx                  # Design system components (Modal, DataTable, etc.)
│   │   ├── icons.tsx               # ~80 SVG icons + color tones
│   │   ├── RichText.tsx            # Tiptap WYSIWYG editor wrapper
│   │   ├── remote.tsx              # useRemote/RemoteView (401/403/5xx states)
│   │   └── ThemeVars.tsx           # Theme variable injector component
│   ├── lib/
│   │   ├── api.ts                  # REST API client (typed functions per domain)
│   │   ├── menu.ts                 # Centralized nav + route guard (role/permission)
│   │   ├── permissions.ts          # can(user, permission) helper
│   │   ├── pagination.ts           # paginator <-> list adapter
│   │   ├── settings.ts             # in-memory public settings (no persistence)
│   │   ├── format.ts               # currency/date formatting helpers
│   │   ├── types.ts                # shared domain types
│   │   ├── i18n.ts                 # Internationalization (ID/EN)
│   │   └── theme.ts                # SurfaceTheme/BlockTokens types
│   ├── state/
│   │   └── store.tsx               # AppProvider context (user, theme, language, toast)
│   ├── pages/
│   │   ├── Installer.tsx           # Installation wizard (step-by-step form)
│   │   ├── Auth.tsx                # Login, Register, ForgotPassword, Profile
│   │   ├── public/                 # 11 public page modules
│   │   │   ├── Public.tsx          # HomePage, Articles, News, Tutorials, etc.
│   │   │   ├── Courses.tsx         # Course catalog, detail, learn, checkout
│   │   │   └── Certificates.tsx    # Verify page
│   │   └── dash/                   # 25+ dashboard page modules
│   │       ├── Overview.tsx        # Role-based dashboard overview
│   │       ├── Instructor.tsx      # Instructor dashboard (owned courses only)
│   │       ├── Learner.tsx         # Learner area (my learning / quizzes)
│   │       ├── Operations.tsx      # Super-admin ops panel (queue/scheduler/integrations)
│   │       ├── Courses.tsx         # Course management
│   │       ├── Quizzes.tsx         # Quiz management
│   │       ├── Cms.tsx             # Content module generic handler
│   │       ├── Crud.tsx            # Generic CRUD table component
│   │       ├── Commerce.tsx        # Orders, payments, wallets, digital deliveries
│   │       ├── People.tsx          # User/Student/Instructor management
│   │       ├── Settings.tsx        # General, payments, integrations, language, system
│   │       ├── SettingsTheme.tsx   # Visual theme editor
│   │       ├── Vouchers.tsx        # Voucher management
│   │       └── ...
│   └── assets/                     # Static images, fonts
├── scripts/
│   ├── sync-backend-assets.mjs     # Postbuild: copy to backend/public
│   └── verify-dashboard.mjs        # Static checks (menu/route/i18n/pagination)
├── package.json
├── tsconfig.json
├── vite.config.js
└── tailwind.config.cjs             # Tailwind configuration
```

### State Management

Single Context Provider pattern:

```typescript
// state/store.tsx
const AppContext = createContext<...>(null);

function AppProvider({ children }) {
    const [user, setUser] = useState<User|null>(null);
    const [theme, setTheme] = useState<'light'|'dark'|'system'>('system');
    const [lang, setLang] = useState<'id'|'en'>('id');
    const [toasts, addToast] = useToastQueue();

    // Hydrate from API on mount
    useEffect(() => { api.authMe().then(setUser); }, []);

    return <AppContext.Provider value={{ user, setUser, theme, setTheme, lang, setLang }}>{children}</AppContext.Provider>;
}
```

State is server-driven: `AppProvider` hydrates from the API (`/auth/me`, `/settings/public`, `/categories`).
No business data is persisted in `localStorage`; only UI preferences (theme/language) are kept in cookies,
while public settings live in memory (`lib/settings.ts`). Session cookies are managed by Laravel.

### Component Architecture

```
App (AppProvider + HashRouter + InstallGate)
├── InstallGate (checks if installed, redirect to /install)
├── Routes
│   ├── Public Routes (PublicShell layout)
│   │   ├── Home, Courses, Learn, Checkout
│   │   ├── Articles, News, Tutorials, Activities
│   │   ├── Pages, About, Contact, Shop
│   │   ├── Certificate Verify
│   │   └── Auth Pages (Login, Register, Forgot)
│   └── Dashboard Routes (DashShell layout + Guard)
│       ├── Overview, Profile
│       ├── Courses, Quizzes, Certificates, Categories
│       ├── CMS Modules (Articles, News, Tutorials, Activities, Pages)
│       ├── Media
│       ├── People (Students, Instructors, Users, Admins)
│       ├── Messages, Orders, Payments
│       ├── Wallet, Withdrawals
│       ├── Products, Vouchers, Digital Deliveries
│       ├── Homepage Builder, Menus, About Editor
│       └── Settings (General, Theme, Payments, Integrations, Language, System)
└── NotFound (catch-all)
```

### Design System

The UI uses a custom design system built on Tailwind CSS 4:

| Component | Purpose |
|---|---|
| `Shell` components | Page layouts (public header/footer vs dashboard sidebar) |
| `ui.tsx` primitives | Button variants, Modal, Form inputs, DataTable, EmptyState, Badge, Spinner |
| `icons.tsx` | ~80 hand-crafted SVG icons with tone-based theming (`iconTone="brand"`) |
| `RichText.tsx` | Tiptap WYSIWYG wrapper for CMS content editing |
| `ThemeVars` | Dynamic CSS variable injection for custom theme colors |
| Charts | Custom SVG bar charts + recharts for line/radar/bar/pie/donut |

### Theming System

Visual themes are stored as JSON in `settings.theme_website` and `settings.theme_dashboard`, then applied at runtime:

```typescript
// lib/theme.ts
type SurfaceTheme = {
    bg: string;           // Background color (hex)
    textPrimary: string;  // Primary text color
    borderColor?: string; // Border color
    borderRadius?: string; // Border radius
    padding?: string;     // Default padding
};

type BlockTokens = Record<string, SurfaceTheme>;
```

`ThemeVars.tsx` component injects these as CSS custom properties into the document root, enabling per-user theme customization without CSS class regeneration.

---

## 5. Data Architecture

### Table Classification (41 domain tables)

| Domain | Tables | Count |
|---|---|---|
| **Identity & Access** | roles, permissions, users, password_reset_tokens, sessions, personal_access_tokens | 6 |
| **Learning (LMS)** | categories, courses, course_sections, lessons, enrollments, lesson_progress | 6 |
| **Assessment** | quizzes, quiz_questions, quiz_options, quiz_attempts | 4 |
| **Commerce Core** | orders, order_items, payments, webhook_logs | 4 |
| **Shop** | products, product_variants, vouchers, cart_items | 4 |
| **Fulfillment** | digital_deliveries, instructor_wallet_transactions, withdrawals | 3 |
| **CMS Content** | articles, news, tutorials, activities, pages, homepage_blocks | 6 |
| **Site Structure** | menus, menu_items, settings, media | 4 |
| **Certification** | certificate_templates, certificates | 2 |
| **System** | notifications, audit_logs, contact_messages | 3 |

### Migration-driven additions (latest)

- `orders`: `expires_at` (pending-order TTL), `stock_reservation_status` (reserved\|confirmed\|released\|shortage), `voucher_id`, `voucher_reservation_status`, `voucher_reserved_until`; enum `status` ditambah `cancelled`.
- `users`: `auth_epoch` (revocation sesi setelah ganti password/suspend).
- `sessions`: `user_id` diselaraskan ke `string(12)` + FK `nullOnDelete` ke `users.id`.
- `notifications`: `event_key` + unique(`user_id`, `event_key`) untuk idempotensi notifikasi.

### ID Strategy

Almost all primary keys are **12-character alphanumeric strings**, not auto-increment integers:

```sql
"id" varchar not null,  -- Generated as unique 12-char string (e.g., "aB3dEf6gHiJk")
```

Exceptions:
- `audit_logs`: bigint PK (high-volume append-only table)
- `settings`: composite key where `setting_key` IS the primary key

### Key Relationships

```
users ──FK──→ roles (role_key defines user role)
users ──FK──→ users (instructor_id links to author)

categories ──has_many──> courses, articles, news, tutorials, products (scope-polymorphic via scope enum)

courses ──has_many──> course_sections ──has_many──> lessons
courses ──has_many──> enrollments ──has_one──> course (via pivot)
enrollments ──has_many──> lesson_progress

courses ──has_many──> quizzes ──has_many──> quiz_questions ──has_many──> quiz_options
quizzes ──has_many──> quiz_attempts

orders ──has_many──> order_items ──has_one──> payments
payments ──many──> webhook_logs (1:1 relationship via reference)

products ──has_many──> product_variants ──has_one──> digital_delivery
cart_items ──unique── (user_id, product_id, variant_id)

wallet_transactions ──belongs_to──> users (instructor)
withdrawals ──belongs_to──> users (processed_by)
```

### Index Strategy

Columns indexed for search performance:
- `slug` columns (courses, categories, articles, pages, etc.)
- `email` (users)
- `reference` (payments)
- `license_key` (digital_deliveries)
- `code` (vouchers)
- `number` (certificates)

Unique constraints prevent duplicates:
- `users.email` (single account per email)
- `enrollments(user_id, course_id)` (one enrollment per student per course)
- `certificates(user_id, course_id)` (one certificate per student per course)
- `webhook_logs.payload_hash` (webhook deduplication)

---

## 6. Security Architecture

### Authentication Flow

```
User enters credentials
  → POST /api/v1/auth/login
  → Laravel creates session (guard: web)
  → Returns JSON: { user: {...}, token: "...", ... }
  → Frontend stores nothing (session lives in browser cookie)
  → Subsequent API requests: credentials: 'include' → session cookie sent automatically
  → CSRF: GET /sanctum/csrf-cookie first → X-XSRF-TOKEN header attached to mutations
```

Middleware chain for API auth:
```
Request → AuthenticateApiUser
  ├─ Attempt guard('sanctum') (token bearer path - NOT ACTIVE)
  └─ Fallback to guard('web') (session cookie - ACTIVE)
```

### Authorization Model (RBAC)

```
roles.permissions (JSON array)
  ├── manage_courses, manage_quizzes, manage_certificates
  ├── manage_articles, manage_news, manage_tutorials, manage_activities, manage_pages
  ├── manage_media, manage_categories, manage_orders, manage_shop, manage_vouchers
  ├── manage_homepage, manage_menus, manage_about
  ├── view_payments, view_messages
  ├── instructor_courses, instructor_students
  ├── process_withdrawals, instructor_wallet
  ├── student_certificates
  └── * (super admin wildcard)

Authorization check: AdminAccess::allows() / InstructorAccess::authorize() (super_admin wildcard) + UserPolicy
```

Authorization combines shared helpers (`AdminAccess`, `InstructorAccess`), a Laravel `UserPolicy` for user
management, and per-endpoint permission/ownership checks. Every decision stays server-side; the frontend
menu merely controls visibility.

### Rate Limiting Matrix

| Tier | Endpoints |
|---|---|
| **3/min** | install/install |
| **5/min** | auth/forgot-password, reset-password, install/configure, contact |
| **6/min** | auth/login, auth/register |
| **10/min** | quiz-attempts/submit, orders/{id}/payment, wallet/withdrawals, install/test-db |
| **20/min** | profile/avatar |
| **30/min** | quizzes/{id}/attempts, voucher/validate, media/upload |
| **60/min** | search, cart/add, lesson/complete |
| **120/min** | payments/webhook/{gateway} |

### Security Layers

| Layer | Mechanism | Purpose |
|---|---|---|
| **Sensitive path blocking** | Explicit 404 routes for `/.env`, `/database/*`, `/backend/*` | Prevent source code exposure |
| **Content sanitization** | Script/iframe/event-handler stripping in rich text | XSS prevention |
| **Gateway credential protection** | Secret keys never accessible via `PUT /settings*` API | Prevent credential theft via compromised admin |
| **Installer lock** | Permanent disable after successful installation | Prevent re-installation attacks |
| **Backup exclusion** | Password hashes and gateway credentials excluded from exports | Protect credentials during backup |
| **Maintenance mode** | Global + group middleware returns 503 to public, admin/super_admin bypass | Emergency site lockdown |
| **Fail-open on fresh install** | Maintenance mode bypasses if settings table doesn't exist | Prevent self-lockout during initial deployment |
| **CSRF (cookie sessions)** | `VerifyCsrfTokenForSession` requires token on cookie-auth mutations; bearer exempt | Prevent cross-site request forgery |
| **Session revocation** | `users.auth_epoch` + `ValidateAuthEpoch` invalidates stale sessions | Kill sessions after password change/suspend |
| **Authz helpers + Policy** | `AdminAccess`/`InstructorAccess` + `UserPolicy` | Consistent server-side permission checks |

---

## 7. Payment Architecture

### Gateway Abstraction

```php
// Contract
interface PaymentGateway {
    public function createPayment(Order $order, string $method): array;
    public function verifyWebhook(array $payload, string $signature): bool;
}

// Manager resolves a configured gateway (throws if credentials are missing)
class PaymentGatewayManager {
    public function resolve(string $gateway): PaymentGateway;  // tripay|xendit|stripe
}
```

> Status integrasi nyata (implemented vs configuration-only/absent) dirangkum di
> `docs/integrations-status.md`. Provider dan mode dipilih server-side dari settings
> (`gateway_active`/`gateway_mode`) dengan fallback env (`PAYMENT_GATEWAY`/`PAYMENT_MODE`); payload gateway
> client diabaikan. Provider HTTP hanya dijalankan saat mode efektif `live`.
> Zoom, Google Meet, RajaOngkir/ongkir, dan OpenRoute/routing **belum** diimplementasikan.

Three gateways implemented manually via Laravel's `Http` facade — **no official SDKs**:

| Gateway | Initiate Method | Webhook Signature |
|---|---|---|
| **Tripay** | Customer creation via API | HMAC-SHA256 verification |
| **Xendit** | Virtual account / payment link | Callback token verification |
| **Stripe** | Checkout session creation | Webhook signature (Stripe-Signature header) |

### Payment Transaction Flow

```
User initiates checkout
  → POST /api/v1/orders/course (or /shop)
  → Order created (status: pending)
  → POST /api/v1/orders/{id}/payment
  → PaymentGatewayManager.resolve() (server-selected gateway) → createPayment()
  → Gateway returns redirect_url / QR / VA number
  → Payment record created (status: pending)
  → User redirected to gateway payment page
  → Gateway sends webhook callback
  → POST /api/v1/payments/webhook/{gateway}
  → Signature verified
  → payload_hash checked for idempotency (UNIQUE constraint)
  → fulfillOrder() executed:
      ├─ Course order → create Enrollment
      ├─ Shop physical → confirm stock reservation (reserve/confirm/release)
      ├─ Shop digital → create DigitalDelivery (license key + download link)
      └─ Wallet → credit instructor net balance (gross - platform_fee - gateway_fee)
  → Notification sent to relevant parties
  → AuditLog entry created
```

### Revenue Split Calculation

Per successful order:
```
Gross amount (order total)
  - Platform fee (default 15%, configurable)
  - Payment gateway fee (varies by method)
  = Net amount (credited to instructor wallet)

Example: Rp100,000 sale
  Gross:       Rp100,000
  Platform:    -Rp15,000 (15%)
  Gateway:     -Rp2,500 (2.5%)
  Instructor:  Rp82,500 credited to wallet_ledger
```

---

## 8. Deployment Architecture

### Single-Process Deploy

The entire application runs as one PHP-FPM process serving both API and static SPA files:

```
Server: kmsit.example.com
DocumentRoot: /var/www/kmsit-computer/public/
  ├── app.html            ← React SPA shell (from Vite build)
  ├── assets/             ← Compiled JS/CSS bundles
  ├── favicon.ico
  ├── index.php           ← Laravel entry point
  ├── robots.txt
  ├── storage/{path}      ← File serving fallback
  └── api/v1/*            ← API routes (handled by index.php)
```

### Build Pipeline

```bash
# Development
cd frontend && npm run dev    # Vite HMR server :5173

# Production
cd frontend && npm run build  # Vite builds to frontend/dist/
  ↓ postbuild hook triggers
scripts/sync-backend-assets.mjs:
  1. Delete old backend/public/assets/*
  2. Copy new dist/* → backend/public/assets/
  3. Rename dist/index.html → backend/public/app.html
```

### Shared Hosting Deployment

```
Local Machine                    Production Server
─────────────                    ───────────────
composer install                Upload backend/ (with vendor/)
npm run build                   Upload backend/public/
                                Create empty MySQL DB
                                Configure DNS → DocumentRoot/public
                                Open https://example.com
                                → /install wizard runs
                                  - Test DB connection
                                  - Write .env
                                  - Run migrations
                                  - Create Super Admin
                                  - Lock installer
```

### Environment Configuration

Production config from `.env.production.example`:

| Variable | Purpose |
|---|---|
| `APP_KEY` | Application encryption key (auto-generated by installer) |
| `DB_*` | Database connection parameters (set in installer or `.env`) |
| `TRIPAY_*` | Tripay API credentials |
| `XENDIT_*` | Xendit API credentials |
| `STRIPE_*` | Stripe API credentials |
| `PAYMENT_MODE` / `PAYMENT_GATEWAY` | Default gateway & mode (dashboard settings can override) |
| `PAYMENT_HTTP_TIMEOUT` / `PAYMENT_HTTP_CONNECT_TIMEOUT` | Provider HTTP limits |
| `MAIL_*` | SMTP email configuration |
| `GOOGLE_MAPS_API_KEY` | Google Maps embed (optional) |

Bootstrap auto-creates `.env` from `.env.production.example` if it doesn't exist — enabling zero-SSH deployment on shared hosting.

---

## 9. Component Diagrams

### Backend Dependency Diagram

```
┌──────────────────────────────────────────────────┐
│                   Routes                         │
│  api.php  │  web.php  │  console.php             │
└────┬─────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────┐
│              Controllers                         │
│  Auth │ Course │ Quiz │ Order │ Shop │ Wallet   │
│  CMS │ Admin │ Settings │ Media │ Backup        │
└────┬─────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────┐
│                Models                            │
│  User │ Role │ Course │ Lesson │ Order │ Product │
│  Certificate │ Article │ Setting │ Media         │
└────┬─────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────┐
│             Services                             │
│  PaymentGatewayManager                          │
│  ├── StripeGateway                              │
│  ├── TripayGateway                              │
│  └── XenditGateway                              │
└────┬─────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────┐
│               Storage                            │
│  Database (MySQL) │ Files (storage/) │ Cache     │
└──────────────────────────────────────────────────┘
```

### Frontend Module Dependency Diagram

```
┌──────────────────────────────────────────────────┐
│                    App.tsx                       │
│  AppProvider + HashRouter + InstallGate + Routes │
└────┬─────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────┐
│                  Pages                           │
│  ┌─────────────┐  ┌───────────────────────────┐  │
│  │ Public      │  │ Dashboard (role-gated)    │  │
│  │ Home        │  │ Overview, Courses, Quizzes│  │
│  │ Courses     │  │ CMS, Media, People        │  │
│  │ Articles    │  │ Orders, Wallet, Products  │  │
│  │ Shop        │  │ Homepage, Menus, Settings │  │
│  └─────────────┘  └───────────────────────────┘  │
└────┬─────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────┐
│                 Components                       │
│  Shell (layout) │ ui (design-system) │ icons     │
│  RichText (editor) │ ThemeVars (theming)         │
└────┬─────────────────────────────────────────────┘
     │
┌────▼─────────────────────────────────────────────┐
│                   Lib                            │
│  api.ts (REST client) │ menu.ts (nav+guard)     │
│  permissions.ts │ settings.ts │ theme.ts │ i18n │
└──────────────────────────────────────────────────┘
```

---

*Dokumen ini merupakan bagian dari dokumentasi KMSIT Computer. Untuk detail teknis lebih lanjut, lihat [blueprint.md](./blueprint.md).*
