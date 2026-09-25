# RECON BASELINE — KMSIT LMS + CMS + E-Commerce

**RECON_STATUS**: LOCKED
**RECON_DATE**: 2026-09-25
**FILES_INSPECTED**: See Section 1 summary table
**PROTOCOL**: RECON ONCE — do not re-audit unless concrete evidence proves this baseline materially wrong

---

## 1. Repository Snapshot

| Metric | Value | Evidence Path |
|--------|-------|---------------|
| PHP version required | ^8.3 | backend/composer.json |
| Laravel framework | ^13.17 | backend/composer.json |
| Sanctum | ^4.3 | backend/composer.json |
| PHPUnit | ^12.5.12 | backend/composer.json |
| Frontend: React + TS | React 18 + TypeScript 5.7+ | frontend/package.json, App.tsx |
| Vite | ^6.3.5 | frontend/package.json |
| Tailwind CSS | ^4.1.7 (CSS-first @theme) | frontend/package.json |
| DB target | MySQL 8 / MariaDB 10.6+ | INSTALL.md §3 |
| Migration count | **27 files** | backend/database/migrations/ (PowerShell verified) |
| Model count | **39 files** | backend/app/Models/ |
| Controller count | **30 files** | backend/app/Http/Controllers/Api/V1/ |
| Test count | **42 Feature + 1 Unit = 43 files** | backend/tests/Feature/* (verified), backend/tests/Unit/* |
| Route definitions | ~40 routes in api.php + web.php SPA fallback | backend/routes/api.php, web.php |
| Custom middleware | 4 files | AuthenticateApiUser, VerifyCsrfTokenForSession, ValidateAuthEpoch, PreventMaintenanceAccess |
| Support utilities | 7 files | AdminAccess, InstructorAccess, HtmlSanitizer, FileSecurity, OperationsStatus, Pagination, SessionRevoker |
| Business services | 8 files | PaymentGatewayManager, TripayGateway, XenditGateway, StripeGateway, NotificationService, InstructorEarnings, StockReservation, VoucherReservation |
| Policies | 1 file | UserPolicy.php |
| Config files | 12 files | app, auth, cache, commerce, database, filesystems, logging, mail, payment, queue, services, session |

---

## 2. Architecture Actual State

### 2.1 Monolith Structure
- **IMPLEMENTED**: Single Laravel monolith serves `/api/v1/` REST + SPA shell from `backend/public/app.html`.
- **IMPLEMENTED**: Build pipeline: `npm run build` → Vite dist/ → postbuild hook (sync-backend-assets.mjs) copies to `backend/public/app.html` + assets folder. Old assets cleaned before copy.
- **IMPLEMENTED**: React HashRouter (`#/...` routing).
- **IMPLEMENTED**: `bootstrap/app.php` auto-creates `.env` from `.env.production.example` on first boot (no SSH needed for shared hosting).
- **PARTIAL**: Cache defaults to `database`. All drivers available (redis, database, memcached, file) but no production default forces Redis. **NEEDS_DECISION for IMP-001**.

### 2.2 Authentication & Authorization
- **IMPLEMENTED**: Session-cookie auth via guard `web` (session stored in DB table sessions).
- **IMPLEMENTED**: Sanctum 4 registered automatically by SanctumServiceProvider (guard `sanctum` active); bearer token fallback available and tested.
- **IMPLEMENTED**: CSRF protection via `VerifyCsrfTokenForSession` middleware — authenticated cookie mutations require `X-XSRF-TOKEN`; Bearer requests exempted.
- **IMPLEMENTED**: Session revocation via `users.auth_epoch` column + `ValidateAuthEpoch` middleware.
- **IMPLEMENTED**: RBAC 4 roles (super_admin/admin/instructor/student) with permissions as JSON array in `roles.permissions`. Synced by migration `2026_09_18_sync_role_permissions`.
- **PARTIAL**: `AdminAccess`/`InstructorAccess` helpers + `UserPolicy` exist; some controllers still use manual `role_key` checks (CourseController, OrderController, SettingsController, OperationsController). Documented in Blueprint §10 #6.
- **IMPLEMENTED**: Maintenance mode via `PreventMaintenanceAccess` middleware — blocks visitors (503), allows admin/super_admin (cookie + bearer). Fails-open if settings table unavailable (fresh install safety).
- **IMPLEMENTED**: Sensitive path blocking: /.env, /composer.json, /package.json, /database/{path}, /backend/{path} return abort(404).
- **IMPLEMENTED**: Storage fallback: MediaController@serve() handles /storage/{path} when symlink missing.

### 2.3 Queue Infrastructure
- **CONFIGURATION_ONLY**: QUEUE_CONNECTION=default reads `database` from env. Redis `redis` driver available in config. Scheduler worker fallback configured.
- **MISSING**: Redis not set as default. Production recommendation is Supervisor/background worker for queue.
- **IMPLEMENTED**: Scheduler worker pattern for shared hosting: `QUEUE_SCHEDULER_WORKER=true`, processes jobs within max_time then exits.

---

## 3. LMS Actual State

| Feature | Status | Evidence |
|---------|--------|----------|
| User model with role_key | IMPLEMENTED | User.php: role_key FK→roles |
| Student role | IMPLEMENTED | sync_role_permissions migration seeds 4 roles |
| Instructor role with approval | IMPLEMENTED | users.instructor_approved; UserController@approveInstructor PATCH endpoint |
| Course with lifecycle statuses | IMPLEMENTED | courses.status: draft/pending/published/rejected/archived |
| Course Category (scope-aware) | IMPLEMENTED | categories.scope enum (course/article/news/tutorial/product); slug unique per scope |
| Course Level | IMPLEMENTED | courses.level validated beginner/intermediate/advanced in validateCourse() |
| Section / Module | IMPLEMENTED | sections.course_id(FK cascade), sort ordering; synced in syncCurriculum() |
| Lesson with 8 types | IMPLEMENTED | lessons.type: text/youtube/video/pdf/file/image/url/embed; media_url validated per type |
| Downloadable material | PARTIAL | downloadLesson() endpoint exists but supports local storage only (no external URL downloads) |
| Enrollment with uniqueness | IMPLEMENTED | firstOrCreate(unique user_id+course_id); unique constraint in migration |
| Free enrollment | IMPLEMENTED | storeCourse(): price===0 → immediate enrollment creation; enroll endpoint returns 402 for paid courses |
| Paid enrollment | IMPLEMENTED | storeShop → create order → initiatePayment → webhook → fulfillment creates Enrollment |
| Course Progress | IMPLEMENTED | lesson_progress.unique(user_id,lesson_id); progress_pct calculated from completed/total published lessons |
| Quiz (4 question types) | IMPLEMENTED | quiz_questions.type: single/multiple/boolean/short; quiz_options.is_correct; Question/QuizOption models |
| Quiz Attempt with scoring | IMPLEMENTED | quiz_attempts.answers(json), percent, passed(bool), status(running/submitted) |
| Server-side scoring | IMPLEMENTED | QuizController@submit performs scoring on backend |
| Attempt limits | PARTIAL | Quiz.max_attempts field present but enforcement logic needs verification |
| Certificate generation | IMPLEMENTED | certificates.unique(user_id,course_id); number format KMSIT-YYYY-NNNNNN; QR code generation |
| Certificate public verification | IMPLEMENTED | GET /v1/certificates/verify/{number} — no login required |
| Certificate templates | IMPLEMENTED | certificate_templates.theme/frame/accent; CRUD endpoints |
| Instructor ownership | IMPLEMENTED | courses.instructor_id; authorizeOwner() pattern; all instructor queries scoped to own courses |
| Course moderation workflow | IMPLEMENTED | submit(draft→pending), moderate(approve→published/reject→rejected/archive→archived) |
| Published-course editing | IMPLEMENTED | authorizeOwner allows owner to edit published courses |
| Student dashboard area | IMPLEMENTED | LearningController(@enrollments, @quizAttempts, @status); frontend MyDigitalPage |
| Instructor dashboard | IMPLEMENTED | InstructorController(@students, @sales, @earnings, @quizzes, @quizAttempts, @courseProgress) — fully owner-scoped |
| Live Class | ABSENT | No LiveClass model/service/provider anywhere |

**NOTE**: Blueprint claims "41 tabel domain". Verified actual: ~36 domain tables (excluding Laravel built-in: migrations, cache, cache_locks, jobs, job_batches, failed_jobs, sessions, personal_access_tokens). Some tables merged during development.

---

## 4. CMS Actual State

| Feature | Status | Evidence |
|---------|--------|----------|
| Homepage Builder (drag-drop) | IMPLEMENTED | homepage_blocks(type/content/enabled/sort); HomepageController CRUD; @dnd-kit frontend |
| Dynamic Blocks | PARTIAL | Generic JSON content per block type; rendering depends on frontend component mapping |
| Pages (static) | IMPLEMENTED | pages.slug(unique), longtext content; public API + admin CRUD |
| Blog Articles | IMPLEMENTED | articles(author_id/tags seo_title/seo_description soft-delete) |
| News | IMPLEMENTED | extends CmsContent base class; status/published_at/video_url |
| Tutorials | IMPLEMENTED | Same News pattern via CmsContent |
| Activities (events) | IMPLEMENTED | event_date/event_time/location/registration_url/gallery(json) |
| Categories (cross-scope) | IMPLEMENTED | scope enum; slug unique within each scope |
| Tags | PARTIAL | articles.tags as JSON; news/tutorials inherit tags via CmsContent abstract |
| Media Library | IMPLEMENTED | media(path/mime/uploaded_by); upload/destroy/index endpoints; storage link fallback |
| Banner | MISSING | No banner model/table/controller |
| Slider | MISSING | No slider entity |
| FAQ | MISSING | No FAQ model/table |
| Testimonials | MISSING | No testimonial entity |
| About page | IMPLEMENTED | Settings controller manages about content; frontend renders AboutPage |
| Contact form + inbox | IMPLEMENTED | contact_messages; public POST /v1/contact; admin inbox view/mark-read |
| Menu manager (nested) | IMPLEMENTED | menus(location:header/footer/both) + menu_items(parent_id self-referencing FK, url, sort) |
| SEO fields | PARTIAL | Only articles has seo_title/seo_description; pages/news/tutorials/activities lack dedicated meta columns |
| Meta Title/Description | PARTIAL | Inconsistent across CMS entities |
| Featured Image | IMPLEMENTED | Thumbnail on courses/products/articles; generic image support via Media Library |
| Landing Page | MISSING | No landing page builder or template system |
| Draft status | IMPLEMENTED | Content entities have status: draft/published; soft-delete for permanent removal |
| Preview | PARTIAL | Public endpoint passes isOwner check for preview; no anonymous preview URL |
| Publish action | IMPLEMENTED | Set status=published, published_at timestamp |
| Content sanitization | IMPLEMENTED | HtmlSanitizer: DOMDocument-based, strict tag allowlist (~30 tags), strips script/style/object/embed/form/input/meta/link, sandbox iframe attributes, allowlist embed hosts (youtube.com, vimeo.com, youtube-nocookie.com) |

---

## 5. E-Commerce Actual State

| Feature | Status | Evidence |
|---------|--------|----------|
| Products (physical) | IMPLEMENTED | products.is_digital=false, stock column |
| Products (digital) | IMPLEMENTED | products.is_digital=true, digital_file_url; auto-delivery on payment success |
| Product Variants | IMPLEMENTED | product_variants(unique product_id,label), price, stock |
| Stock tracking | IMPLEMENTED | Stock decremented on payment fulfillment via StockReservation.confirm() |
| Stock Reservation | IMPLEMENTED | Orders.stock_reservation_status; StockReservation service reserves cart; confirm/release on webhook |
| Cart | IMPLEMENTED | cart_items(user_id/product_id/variant_id unique); add/update/remove endpoints |
| Voucher (discount codes) | IMPLEMENTED | vouchers(code/type/value/usage_limit/used_count/min_order/max_discount/expiry/active) |
| Voucher Reservation | IMPLEMENTED | Orders.voucher_reservation_status + voucher_reserved_until; VoucherReservation(expireDue/cancel/confirm/release) |
| Checkout flow | IMPLEMENTED | storeShop validates cart, stock, voucher address; creates order with TTL expires_at |
| Orders (course + shop) | IMPLEMENTED | orders.type: course/shop; separate creation flows in storeCourse/storeShop |
| Order Items | IMPLEMENTED | order_items(kind/ref_id/title/price/qty/is_digital); snapshot price at order time |
| Payment initiation | IMPLEMENTED | initiatePayment — server-side provider selection from settings; client payload.gateway ignored |
| Webhook processing | IMPLEMENTED | normalizeWebhook per gateway with signature verification; idempotency via payload_hash UNIQUE |
| Digital Delivery | IMPLEMENTED | digital_deliveries(license_key UNIQUE/download_url/status); auto-created on successful payment |
| License Key | IMPLEMENTED | Auto-generated 'KMSIT-' + random UUID on successful digital product payment |
| Instructor Earnings ledger | IMPLEMENTED | WalletTransaction(type:earning/withdrawal, amount signed, platform_fee, payment_fee); creditForOrder() |
| Wallet running balance | PARTIAL | Ledger entries created; no running_balance column; balance computed via SUM aggregation |
| Withdrawal workflow | IMPLEMENTED | withdrawals(pending→approved→processing→completed/rejected; processed_by FK→users) |
| Shipping address collection | IMPLEMENTED | orders.shipping_name/address/phone; validated for physical products in storeShop |
| Shipping calculation | MISSING | Manual address only; no API-based rate lookup |
| Courier integration | MISSING | No courier/shipping provider abstraction |
| Order TTL | IMPLEMENTED | pending_order_ttl_minutes (30 default); orders.expires_at on pending orders |
| Fulfillment | PARTIAL | Digital auto-fulfilled (license key + delivery record); physical requires manual confirmation |
| Revenue split | IMPLEMENTED | Platform fee 15% (configurable) deducted; gross/fee/net recorded in ledger |

---

## 6. Integrations Actual State

| Integration | Status | Source Evidence | Notes |
|-------------|--------|-----------------|-------|
| Tripay | IMPLEMENTED | TripayGateway.php, OrderController::normalizeWebhook(HMAC raw body + private_key, X-Callback-Signature header) | Callback signature with internal fallback; sandbox simulation internally |
| Xendit | IMPLEMENTED | XenditGateway.php, Invoice API, X-Callback-Token match | Reference = invoice id, external_id = order id |
| Stripe | IMPLEMENTED | StripeGateway.php, Checkout Session, Stripe-Signature HMAC(t.payload, 300s tolerance) | Payment Intent-based |
| YouTube embed | IMPLEMENTED | HtmlSanitizer.embedUrl(), videoUrl() allowlist hosts | Iframe rendered with sandbox + referrerpolicy attrs |
| Zoom | CONFIGURATION_ONLY | config/services.php zoom section; ZOOM_* env vars; settings.zoom_* writable keys | No meeting/service/auth/OAuth code anywhere |
| Google Meet | CONFIGURATION_ONLY | settings gmeet_enabled, gmeet_default_url writable | No code reads these values |
| RajaOngkir / shipping | ABSENT | No code, config, model, or migration | IMP-004 planned |
| OpenRoute / routing | ABSENT | No code, config, model, or migration | IMP-005 planned |
| Redis | CONFIGURATION_ONLY | Available as redis driver in queue/cache config; not set as default | Database driver is default |
| Email / SMTP | PARTIAL | PasswordResetMail sent via queue (ShouldQueue but runs inline under sync queue) | Other notifications are in-app only via NotificationService |
| Notifications | IMPLEMENTED | NotificationService(event_key dedupe inside DB transaction); notify() notifyStaff(); mark-read individual + readAll | Staff notification follows permission scope |

---

## 7. Security Actual State

| Aspect | Status | Evidence |
|--------|--------|----------|
| Authentication | IMPLEMENTED | Session-cookie web guard + Sanctum bearer fallback (AuthenticateApiUser) |
| Authorization (RBAC) | PARTIAL | AdminAccess/InstructorAccess helpers + UserPolicy; mixed with manual role_key checks |
| Policy/Gate coverage | PARTIAL | UserPolicy covers basic user CRUD; most other permissions via AdminAccess helper |
| Manual role checks | NEEDS_DETECTION | grep confirms manual role_key in CourseController, OrderController, SettingsController, OperationsController |
| Ownership checks | IMPLEMENTED | authorizeOwner() pattern (owner_id match OR admin access) |
| Request validation | IMPLEMENTED | fillable/guarded models + request->validate() in controllers |
| CSRF protection | IMPLEMENTED | VerifyCsrfTokenForSession on authenticated mutation routes |
| Session revocation | IMPLEMENTED | users.auth_epoch + ValidateAuthEpoch middleware |
| Secret handling | IMPLEMENTED | Gateway secrets in .env/config only; PUT /settings* rejects secret keys; backup excludes credentials |
| Payment verification | IMPLEMENTED | Signature per gateway + amount comparison |
| Webhook signature | IMPLEMENTED | Tripay(HMAC), Xendit(token), Stripe(hmac t+v1) |
| Idempotency | IMPLEMENTED | payload_hash UNIQUE on webhook_logs; Enrollment firstOrCreate |
| Audit log | IMPLEMENTED | audit_logs(action/model/model_id/user_name/ip/ua); writes on sensitive actions |
| Content sanitization | IMPLEMENTED | HtmlSanitizer on all rich text inputs (DOM-based strict allowlist) |
| Sensitive path protection | IMPLEMENTED | Abort 404 for /.env, /composer.json, /database/*, /backend/* |
| Maintenance mode | IMPLEMENTED | PreventMaintenanceAccess blocks non-admin (503); fails-open on fresh install |
| Rate limiting | IMPLEMENTED | Applied to auth, install, quiz-attempts, payments/webhook, media, search, cart-add, profile-avatar |
| Backup privacy | IMPLEMENTED | Password hash excluded from exports; credential-free backup export |

---

## 8. Testing Actual State

| Aspect | Count | Evidence |
|--------|-------|----------|
| PHPUnit Feature tests | 42 files | Verified: backend/tests/Feature/*.php (PowerShell count) |
| PHPUnit Unit tests | 1 file | backend/tests/Unit/ExampleTest.php |
| Total test files | 43 | 42 + 1 |
| Backend regression coverage | Strong | Auth, courses, quizzes, certificates, shop/cart/orders/wallet/payments/webhooks, vouchers, stock-reservation, settings security, profile, media, CMS, installation, maintenance, session revocation, pagination, instructor dashboard, backup security, domain authorization, consent/hardening |
| Frontend automated tests | 0 | No Vitest/Jest config found |
| Static verification | Present | verify-dashboard.mjs: 14 static checks (menu/route/i18n/pagination) |
| TypeScript checks | Present | tsc --noEmit script defined in package.json |
| Production build | Present | npm run build + postbuild sync (verified working) |
| Test execution command | `composer test` | php artisan test defined in composer scripts |

---

## 9. Architecture Mismatches

| ID | Documentation Claim | Actual State | Severity |
|----|---------------------|--------------|----------|
| AM-01 | "214 PHPUnit tests / 42 files" | 214 test methods across 42 Feature files + 1 Unit file = 43 total files | Low — method vs file confusion in docs |
| AM-02 | "Redis is the target cache/queue infrastructure" | Cache defaults to database; queue defaults to database (not Redis) | Medium — IMP-001 addresses this |
| AM-03 | Blueprint §10: "Bundle JS tunggal ±1 MB tanpa code-splitting" | Still valid — no React.lazy()/dynamic import per route | Low — P2 optimization |
| AM-04 | Blueprint §10: "RBAC belum sepenuhnya ke Policy/Gate" | Still valid — manual role_key checks remain in multiple controllers | Medium |
| AM-05 | Blueprint §10: "lucide-react dan @supabase/supabase-js tidak terpakai" | lucide-react dependency confirmed present in package.json; verify if supabase removed | Low |
| AM-06 | Blueprint §3: "41 tabel domain" | ~36 domain tables verified via 27 migration files | Low — documentation was approximate |
| AM-07 | "Fully featured CMS" | Banner, Slider, FAQ, Testimonials, Landing Page are all MISSING | Medium — IMP-003 will reconcile scope |

---

## 10. Business Flow Gaps

| ID | Gap | Impact | IMP Target |
|----|-----|--------|------------|
| BG-01 | No shipping rate API (RajaOngkir) | Physical products ship at flat/manual rate; no cost calc | IMP-004 |
| BG-02 | No route optimization | Logistics planning impossible | IMP-005 |
| BG-03 | Live Class feature absent | No Zoom/Meet integration for real-time classes | IMP-006 |
| BG-04 | No running wallet balance column | Balance computed via SUM aggregation on every read | Technical debt |
| BG-05 | No content preview workflow | Preview gated by authentication; no anonymous preview link | CMS improvement |
| BG-06 | No broadcast email notifications | Users only receive in-app notifications; could miss critical updates | Post-MVP |
| BG-07 | Voucher reservation reclaimed on next checkout cycle | Expired vouchers hold quota until next buyer triggers reclaim | Edge case |
| BG-08 | No automated stock reconciliation | Stock decremented on fulfillment; no background verification against warehouse | Data integrity risk |
| BG-09 | No bulk email/notification capability | Admin cannot notify large audience segments | Post-MVP |

---

## 11. Security Gaps

| ID | Gap | Severity | Details |
|----|-----|----------|---------|
| SG-01 | Manual role_key checks in controllers | Medium | Partially mitigated by middleware auth + ownership checks; should migrate to Policy/Gate |
| SG-02 | Permission table uses JSON column | Low | Permissions stored as JSON array in roles table; harder to audit than relational perms table |
| SG-03 | StartSession middleware attached per-route group | Medium | Redundant on auth groups; indicates possible race condition with session init |
| SG-04 | No CSP headers | Medium | Browser-level XSS protection not implemented; reliant only on HtmlSanitizer |
| SG-05 | No rate limiting on admin mutation endpoints | Low | Admin CRUD trusted boundary; acceptable risk if properly authenticated |
| SG-06 | Sessions stored in DB without GC policy | Low | Laravel sessions grow over time; no explicit cleanup cron defined |

---

## 12. Integration Gaps

| ID | Gap | Priority | IMP Target |
|----|-----|----------|------------|
| IG-01 | RajaOngkir shipping API | High | IMP-004 |
| IG-02 | OpenRoute routing API | Medium | IMP-005 |
| IG-03 | Zoom live class provider | Medium | IMP-006 |
| IG-04 | Google Meet live class provider | Medium | IMP-006 |
| IG-05 | Broadcast email notifications | Low | Post-MVP |
| IG-06 | Automated queue worker (Supervisor/Redis) | High | IMP-001 |

---

## 13. Test Gaps

| ID | Gap | Details |
|----|-----|---------|
| TG-01 | Zero frontend automated tests | No Vitest/Jest config; only static verification script |
| TG-02 | Limited unit test coverage | Only 1 unit test file (ExampleTest.php); business logic lacks unit tests |
| TG-03 | No E2E/browser tests | No Playwright/Cypress configuration |
| TG-04 | Coverage gap on edge cases | Voucher expiration reclaim timing, stock race conditions, concurrent enrollment not explicitly tested |

---

## 14. Technical Debt

| ID | Debt | Impact | IMP Target |
|----|------|--------|------------|
| TD-01 | Cache driver = database (not Redis) | Slower reads for settings/categories/homepage_blocks | IMP-001 |
| TD-02 | Queue default = database (not Redis) | Faster for simple jobs, slower at scale; requires background worker | IMP-001 |
| TD-03 | No code-splitting on frontend | Dashboard bundle loads for all visitors regardless of role | P2 optimization |
| TD-04 | JSON-based RBAC (permissions in roles.permissions) | Harder to audit; cannot granularly revoke specific permissions without full role change | Long-term |
| TD-05 | Mixed ownership pattern | authorizeOwner() + AdminAccess + manual role_key — inconsistent authorization style | Long-term |
| TD-06 | No running wallet balance column | Computed via SUM on every wallet query | Performance concern |
| TD-07 | Unused dependencies (lucide-react) | Icon library not used; icons manually written in icons.tsx | Cleanup |
| TD-08 | StartSession on multiple route groups | Potential session initialization overhead per request | Minor |

---

**RECON_STATUS: LOCKED**

Updated:
- docs/implementation/RECON-BASELINE.md

STOP — awaiting human review before implementation begins.
