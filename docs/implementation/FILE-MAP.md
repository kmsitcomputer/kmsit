# FILE MAP — KMSIT LMS + CMS + E-Commerce

**Reference**: RECON-BASELINE.md (LOCKED)
**Generated**: 2026-09-25
**Convention**: READ = understand context; MODIFY_CANDIDATES = potential change targets; TESTS = relevant test files; CONFIG = config files to inspect; MIGRATIONS = migration files; DEPENDENCIES = packages; DO_NOT_TOUCH = stable boundaries unless scope requires change

---

## IMP-001 — Architecture Hardening: Redis/cache/queue + targeted RBAC cleanup

### Objective
Move cache and queue defaults from database to Redis (when available); harden session/caching; migrate manual role_key checks to Policy/Gate where feasible.

### READ (understand context)
| File | Reason |
|------|--------|
| backend/config/cache.php | Current cache configuration, driver selection |
| backend/config/queue.php | Queue connections, default driver, scheduler worker |
| backend/config/session.php | Session configuration (driver, lifetime, cookie settings) |
| backend/config/database.php | MySQL connection, Redis connection for cache/queue |
| backend/app/Support/AdminAccess.php | Current permission helper pattern |
| backend/app/Support/InstructorAccess.php | Current instructor scoping pattern |
| backend/app/Policies/UserPolicy.php | Existing policy structure |
| backend/app/Http/Middleware/AuthenticateApiUser.php | Auth middleware (may need adjustments) |
| backend/bootstrap/app.php | Bootstrap config, service provider registration |

### MODIFY_CANDIDATES
| File | Action |
|------|--------|
| backend/.env.production.example | Update QUEUE_CONNECTION/cache default hints |
| backend/app/Http/Controllers/Api/V1/CourseController.php | Review authorizeOwner() for Policy migration |
| backend/app/Http/Controllers/Api/V1/OrderController.php | Review role_key checks for Policy migration |
| backend/app/Http/Controllers/Api/V1/SettingsController.php | Review role_key checks for Policy migration |
| backend/app/Http/Controllers/Api/V1/OperationsController.php | Review role_key checks for Policy migration |
| backend/config/cache.php | Set Redis as default when available |
| backend/config/queue.php | Set Redis as default when available |

### TESTS
| Test File | Scope |
|-----------|-------|
| backend/tests/Feature/CookieSessionRegressionTest.php | Session behavior regression |
| backend/tests/Feature/SuspendAuthenticationRevocationTest.php | Session revocation |
| backend/tests/Feature/SuspendedSessionApiTest.php | Suspended session handling |
| backend/tests/Feature/DashboardPermissionApiTest.php | Permission enforcement |
| backend/tests/Feature/UserAuthorizationPolicyTest.php | User policy tests |
| backend/tests/Feature/AuthApiTest.php | Authentication flow |
| backend/tests/Feature/QueueOperationsTest.php | Queue operations |
| All 42 Feature test files | Regression suite after changes |

### CONFIG
| File | Notes |
|------|-------|
| backend/config/cache.php | Cache driver, Redis connection name |
| backend/config/queue.php | Queue driver, Redis connection name |
| backend/config/session.php | Session driver (database), cookie settings |

### MIGRATIONS
| Migration | Relevance |
|-----------|-----------|
| N/A (no schema change needed) | Configuration-only changes expected |

### DEPENDENCIES
| Package | Note |
|---------|------|
| predis/predis or phpredis | Required for Redis support — verify installed |
| laravel/framework ^13.17 | Already present |

### DO_NOT_TOUCH
| File | Reason |
|------|--------|
| backend/routes/api.php | API contract boundary — do not alter routes |
| backend/routes/web.php | SPA fallback route — do not touch |
| frontend/ | Not in scope for architecture hardening |
| Backend services (PaymentGatewayManager, etc.) | Not affected by cache/queue changes |

---

## IMP-002 — LMS Gap Closure: free enrollment, published-course lifecycle, Course Level verification, idempotency/edge cases

### Objective
Verify and close gaps in LMS features identified in RECON-BASELINE: free enrollment completeness, course moderation lifecycle, quiz attempt limit enforcement, certificate idempotency, progress tracking edge cases.

### READ (understand context)
| File | Reason |
|------|--------|
| backend/app/Models/Course.php | Course model with lifecycle statuses |
| backend/app/Models/Enrollment.php | Enrollment model, unique constraint |
| backend/app/Models/LessonProgress.php | Progress tracking model |
| backend/app/Models/Quiz.php | Quiz with max_attempts field |
| backend/app/Models/QuizAttempt.php | Quiz attempt record |
| backend/app/Models/Certificate.php | Certificate generation model |
| backend/app/Models/Lesson.php | Lesson types and media URL validation |
| backend/app/Http/Controllers/Api/V1/CourseController.php | Core LMS controller (enroll, completeLesson, progress, submit, moderate) |
| backend/app/Http/Controllers/Api/V1/QuizController.php | Quiz scoring, attempt management |
| backend/app/Http/Controllers/Api/V1/CertificateController.php | Certificate issuance, public verify |
| backend/app/Services/NotificationService.php | LMS notifications (enrollment, completion, certificate) |

### MODIFY_CANDIDATES
| File | Action |
|------|--------|
| backend/app/Http/Controllers/Api/V1/CourseController.php | Verify free enrollment completeness, course editing restrictions post-publication |
| backend/app/Http/Controllers/Api/V1/QuizController.php | Verify max_attempts enforcement in submit action |
| backend/app/Http/Controllers/Api/V1/CertificateController.php | Idempotency check on certificate issuance |
| backend/app/Models/Enrollment.php | Verify unique constraint prevents duplicate enrollments |
| backend/app/Models/Course.php | Verify status transition rules (draft→pending→published/rejected/archived) |

### TESTS
| Test File | Scope |
|-----------|-------|
| backend/tests/Feature/CourseApiTest.php | Course CRUD, moderation, enrollment |
| backend/tests/Feature/QuizApiTest.php | Quiz creation, attempts, scoring |
| backend/tests/Feature/CertificateApiTest.php | Certificate generation, verification, revocation |
| backend/tests/Feature/PaginationAndLearningApiTest.php | Learning endpoints (enrollments, quiz-attempts, status) |
| backend/tests/Feature/WebhookFulfillmentApiTest.php | Payment webhook → enrollment fulfillment |
| backend/tests/Feature/LmsStage4RegressionTest.php | LMS regression coverage |
| backend/tests/Feature/InstructorDashboardApiTest.php | Instructor-scoped queries |
| backend/tests/Feature/CookieSessionRegressionTest.php | Session-based auth for enrolled users |

### CONFIG
| File | Notes |
|------|--------|
| backend/config/auth.php | Guardian configuration for auth |
| backend/config/services.php | Any LMS-related service configs |

### MIGRATIONS
| Migration | Relevance |
|-----------|-----------|
| backend/database/migrations/2026_09_04_000002_create_lms_tables.php | Core LMS table definitions |
| backend/database/migrations/2026_09_04_000003_create_quiz_tables.php | Quiz/question/attempt table definitions |

### DEPENDENCIES
| Package | Note |
|---------|------|
| None new expected | Pure source code gap closure |

### DO_NOT_TOUCH
| File | Reason |
|------|--------|
| backend/routes/api.php | LMS route definitions unchanged |
| backend/app/Services/PaymentGatewayManager.php | Payment gateway logic unaffected |
| frontend/ | Not in scope |
| Commerce tables/controllers | Separate domain — touch only if cross-contamination identified |

---

## IMP-003 — CMS Gap Closure: reconcile baseline CMS features; safe draft/preview/publish

### Objective
Reconcile documented CMS capabilities vs actual implementation; ensure draft/preview/publish workflows are safe and consistent across all CMS content types. Add missing CMS entities if approved by roadmap.

### READ (understand context)
| File | Reason |
|------|--------|
| backend/app/Models/CmsContent.php | Abstract base class for articles/news/tutorials/activities |
| backend/app/Models/Article.php | Blog article model |
| backend/app/Models/News.php | News article model |
| backend/app/Models/Tutorial.php | Tutorial model |
| backend/app/Models/Activity.php | Activity/event model |
| backend/app/Models/Page.php | Static page model |
| backend/app/Models/HomepageBlock.php | Homepage block model |
| backend/app/Models/Category.php | Category with scope enum |
| backend/app/Models/Media.php | Media library model |
| backend/app/Http/Controllers/Api/V1/ContentController.php | Multi-type content CRUD |
| backend/app/Http/Controllers/Api/V1/ArticleController.php | Article-specific endpoints |
| backend/app/Http/Controllers/Api/V1/HomepageController.php | Homepage blocks management |
| backend/app/Http/Controllers/Api/V1/MenuController.php | Menu manager |
| backend/app/Http/Controllers/Api/V1/SettingsController.php | About/content settings |
| backend/app/Support/HtmlSanitizer.php | Content sanitization for rich text |

### MODIFY_CANDIDATES
| File | Action |
|------|--------|
| backend/app/Models/CmsContent.php | Consider adding status fields consistently |
| backend/app/Http/Controllers/Api/V1/ContentController.php | Ensure draft/publish workflow consistent across all 4 types |
| backend/app/Http/Controllers/Api/V1/ArticleController.php | Article-specific preview/slug handling |
| backend/app/Http/Controllers/Api/V1/SettingsController.php | SEO field allowlist completeness |

### TESTS
| Test File | Scope |
|-----------|-------|
| backend/tests/Feature/CmsContentTypesApiTest.php | CMS content type CRUD, slug validation |
| backend/tests/Feature/ArticleApiTest.php | Article endpoints |
| backend/tests/Feature/MenuApiTest.php | Menu creation/nesting |
| backend/tests/Feature/MediaApiTest.php | Media upload/destroy |
| backend/tests/Feature/CmsMediaFileSecurityTest.php | Media file security |
| backend/tests/Feature/SettingsPublicApiTest.php | Settings public endpoint allowlist |
| backend/tests/Feature/SettingsSecurityApiTest.php | Settings secret protection |

### CONFIG
| File | Notes |
|------|--------|
| backend/config/app.php | App-wide settings that might affect CMS |

### MIGRATIONS
| Migration | Relevance |
|-----------|-----------|
| backend/database/migrations/2026_09_04_000010_create_articles_table.php | Article table |
| backend/database/migrations/2026_09_04_000011_create_cms_content_tables.php | CMS content base table |
| backend/database/migrations/2026_09_04_000012_create_homepage_blocks_table.php | Homepage blocks |

### DEPENDENCIES
| Package | Note |
|---------|------|
| @tiptap/* packages | Rich text editor for CMS — already present |
| @dnd-kit/* | Drag-drop homepage builder — already present |

### DO_NOT_TOUCH
| File | Reason |
|------|--------|
| frontend/src/pages/dash/*.tsx | CMS UI components — modify only if IMP scope requires |
| LMS controllers/models | Separate domain |
| Commerce models/controllers | Separate domain |
| Payment gateway services | Unaffected |

---

## IMP-004 — Shipping / RajaOngkir

### Objective
Implement RajaOngkir shipping rate calculation behind a ShippingProviderInterface abstraction, similar to existing PaymentGatewayManager pattern. Include server-side shipping cost snapshot at checkout.

### READ (understand context)
| File | Reason |
|------|--------|
| backend/app/Services/PaymentGatewayManager.php | Existing provider abstraction pattern to follow |
| backend/app/Contracts/PaymentGateway.php | Existing contract interface |
| backend/app/Http/Controllers/Api/V1/OrderController.php | Checkout flow where shipping costs must be integrated |
| backend/app/Models/Order.php | Order model — needs shipping_cost column |
| backend/app/Models/ProductVariant.php | Variant weight for shipping calc |
| backend/config/payment.php | Reference for provider config structure |
| backend/routes/api.php | New routing for shipping lookup |

### MODIFY_CANDIDATES
| File | Action |
|------|--------|
| backend/app/Contracts/ShippingProvider.php | NEW — Provider interface |
| backend/app/Services/RajaOngkirProvider.php | NEW — RajaOngkir implementation |
| backend/app/Services/ShippingManager.php | NEW — Factory/resolver for shipping providers |
| backend/app/Http/Controllers/Api/V1/OrderController.php | Integrate shipping cost into storeShop/initiatePayment |
| backend/app/Models/Order.php | Add shipping_cost, courier, service_code columns |
| backend/config/shipping.php | NEW — RajaOngkir credential config |
| backend/database/migrations/ | NEW migration for shipping columns on orders |
| backend/app/Support/HtmlSanitizer.php | Sanitize shipping address input (already handles URLs) |

### TESTS
| Test File | New |
|-----------|-----|
| backend/tests/Feature/ShippingRajaOngkirTest.php | NEW — Shipping rate lookup, cost calculation, provider timeout/error handling |
| backend/tests/Feature/OrderPaymentApiTest.php | Modify — Verify shipping cost included in order total |
| backend/tests/Feature/ShopApiTest.php | Modify — Cart/checkout with shipping |
| backend/tests/Feature/WebhookFulfillmentApiTest.php | Modify — Verify shipping doesn't break fulfillment |

### CONFIG
| File | Notes |
|------|--------|
| backend/config/shipping.php | NEW — RajaOngkir key, origin, carrier config |
| backend/.env.production.example | Add SHIPPIING_* env variables |

### MIGRATIONS
| Migration | Relevance |
|-----------|-----------|
| NEW | Add shipping_cost/courier/service_code/origin_province to orders table |

### DEPENDENCIES
| Package | Note |
|---------|------|
| None new — Http facade sufficient | RajaOngkir HTTP calls via Laravel Http client |

### DO_NOT_TOUCH
| File | Reason |
|------|--------|
| Payment gateway services | Keep payment logic isolated from shipping |
| LMS models/controllers | No shipping impact on courses |
| Digital delivery | Digital products should NOT incur shipping |

---

## IMP-005 — OpenRoute Routing

### Objective
Implement OpenRouteService routing abstraction for logistics/routing calculations. This is separate from shipping calculation (which determines cost).

### READ (understand context)
| File | Reason |
|------|--------|
| backend/app/Contracts/PaymentGateway.php | Pattern reference for provider interface |
| backend/app/Services/PaymentGatewayManager.php | Pattern reference for provider factory |
| backend/app/Http/Controllers/Api/V1/OperationsController.php | Operations panel may show routing status |

### MODIFY_CANDIDATES
| File | Action |
|------|--------|
| backend/app/Contracts/RouteProvider.php | NEW — Provider interface |
| backend/app/Services/OpenRouteProvider.php | NEW — OpenRouteService implementation |
| backend/app/Services/RouteManager.php | NEW — Factory resolver |
| backend/config/route.php | NEW — OpenRoute API key config |
| backend/.env.production.example | Add OPENROUTE_API_KEY env variable |

### TESTS
| Test File | New |
|-----------|-----|
| backend/tests/Feature/OpenRouteRoutingTest.php | NEW — Route calculation, provider timeout/error handling |

### CONFIG
| File | Notes |
|------|--------|
| backend/config/route.php | NEW |
| backend/.env.production.example | Add OPENROUTE config |

### MIGRATIONS
| Migration | Relevance |
|-----------|-----------|
| None expected | Routing is computational, no schema changes |

### DEPENDENCIES
| Package | Note |
|---------|------|
| None new — Http facade sufficient | OpenRouteService REST calls |

### DO_NOT_TOUCH
| File | Reason |
|------|--------|
| IMP-004 shipping files | Keep routing separate from shipping (documented requirement) |
| Payment gateways | Unaffected |
| Frontend | Out of scope for provider abstraction |

---

## IMP-006 — Live Class: Zoom + Google Meet

### Objective
Implement LiveClass provider abstraction behind a LiveClassProviderInterface. Support Zoom Server-to-Server OAuth and Google Meet link generation. Integrate into course curriculum as live session scheduling.

### READ (understand context)
| File | Reason |
|------|--------|
| backend/app/Models/Course.php | Courses may host live sessions |
| backend/app/Models/Lesson.php | Live class lesson type? |
| backend/app/Http/Controllers/Api/V1/CourseController.php | May need live session management endpoints |
| backend/app/Services/PaymentGatewayManager.php | Provider abstraction pattern |
| backend/app/Contracts/PaymentGateway.php | Contract interface pattern |
| backend/config/services.php | Existing zoom config (configuration-only) |
| backend/app/Http/Controllers/Api/V1/SettingsController.php | Zoom/Meet admin settings |

### MODIFY_CANDIDATES
| File | Action |
|------|--------|
| backend/app/Models/LiveClass.php | NEW — Live class session model |
| backend/app/Contracts/LiveClassProvider.php | NEW — Provider interface |
| backend/app/Services/ZoomProvider.php | NEW — Zoom meeting create/join |
| backend/app/Services/GoogleMeetProvider.php | NEW — Google Meet link generation |
| backend/app/Services/LiveClassManager.php | NEW — Provider factory |
| backend/database/migrations/ | NEW — Live classes table |
| backend/config/liveclass.php | NEW — Provider credentials |
| backend/app/Http/Controllers/Api/V1/CourseController.php | Add live session scheduling endpoints |
| backend/routes/api.php | Add live class routes |
| backend/app/Support/HtmlSanitizer.php | Sanitize meeting links |

### TESTS
| Test File | New |
|-----------|-----|
| backend/tests/Feature/LiveClassZoomTest.php | NEW — Zoom meeting creation, token auth, join URL |
| backend/tests/Feature/LiveClassMeetTest.php | NEW — Google Meet link generation |
| backend/tests/Feature/CourseApiTest.php | Modify — Live session on course |

### CONFIG
| File | Notes |
|------|--------|
| backend/config/liveclass.php | NEW — Zoom account_id/client_id/client_secret, Meet config |
| backend/.env.production.example | Add ZOOM_* GMEET_* env variables |

### MIGRATIONS
| Migration | Relevance |
|-----------|-----------|
| NEW | Create live_classes table (course_id, provider, meeting_id/meeting_url, scheduled_at, status) |

### DEPENDENCIES
| Package | Note |
|---------|------|
| None new — Http facade sufficient | Zoom API calls, Google API may need google/apiclient if using Calendar API |

### DO_NOT_TOUCH
| File | Reason |
|------|--------|
| Payment gateways | Live class is free feature (instructor course access) |
| Shipping modules | Independent domain |
| Frontend live class UI | May need updates but out of scope for backend provider abstraction |

---

## IMP-007 — Quality: frontend automated tests, evidence-based performance improvements, final regression/documentation reconciliation

### Objective
Add Vitest frontend tests for cart/voucher/calculations; run full regression; performance profiling; documentation reconciliation between Blueprint/BASELINE/source.

### READ (understand context)
| File | Reason |
|------|--------|
| frontend/package.json | Verify no Vitest config yet |
| frontend/src/lib/api.ts | >90 typed API functions — target for unit testing |
| frontend/src/lib/types.ts | Type definitions — useful test fixtures |
| frontend/src/lib/format.ts | Currency/date formatting — good test target |
| frontend/src/lib/settings.ts | In-memory settings — simple to test |
| frontend/src/components/ui.tsx | UI component primitives |
| frontend/src/state/store.tsx | AppProvider state management |
| frontend/scripts/verify-dashboard.mjs | Existing static checks |
| backend/phpunit.xml | PHPUnit config for test execution |

### MODIFY_CANDIDATES
| File | Action |
|------|--------|
| frontend/package.json | Add vitest devDependency and script |
| frontend/vitest.config.ts | NEW — Vitest configuration |
| frontend/src/lib/__tests__/* | NEW — Unit tests for lib functions |
| README.md | Update if any changes from previous IMPs require doc update |
| docs/blueprint.md | Final reconciliation of Blueprint vs BASELINE |

### TESTS
| Test File | New |
|-----------|-----|
| frontend/src/lib/__tests__/api.test.ts | API wrapper function tests |
| frontend/src/lib/__tests__/format.test.ts | Currency/date format tests |
| frontend/src/lib/__tests__/settings.test.ts | Settings in-memory logic |
| frontend/src/lib/__tests__/permissions.test.ts | Permission checking logic |
| All backend tests | Full regression pass |

### CONFIG
| File | Notes |
|------|--------|
| frontend/tsconfig.json | Ensure strict mode for Vitest integration |

### MIGRATIONS
| Migration | Relevance |
|-----------|-----------|
| None | This IMP is quality/testing focused |

### DEPENDENCIES
| Package | Note |
|---------|------|
| vitest, @testing-library/react, @testing-library/jest-dom | NEW frontend test dependencies |

### DO_NOT_TOUCH
| File | Reason |
|------|--------|
| Production deployment scripts | Out of scope |
| CI/CD pipeline (if exists) | Verify first before modifying |
| backend routes/controllers | Only if regression reveals bugs to fix |

---

## Cross-Cutting Files (all IMPs may reference)

| File | Why |
|------|-----|
| backend/routes/api.php | Route definitions for any new endpoint |
| backend/bootstrap/app.php | Middleware/exception handling configuration |
| backend/config/app.php | App-wide config (timezone, locale, key) |
| backend/config/auth.php | Authentication guards/providers |
| backend/config/mail.php | Email/notification mailer config |
| backend/config/filesystems.php | Storage disk configuration |
| backend/database/migrations/2026_09_18_sync_role_permissions.php | Role/permission seed data |
| backend/tests/Feature/TestCase.php | Base test case shared by all tests |
| backend/app/Support/AdminAccess.php | Permission helper used throughout controllers |
| backend/app/Support/InstructorAccess.php | Instructor scoping helper |
| backend/app/Support/HtmlSanitizer.php | Content sanitization applied broadly |
| backend/app/Support/SessionRevoker.php | Session revocation logic |
| frontend/src/lib/permissions.ts | Frontend permission checking (UI visibility only) |
| frontend/src/lib/menu.ts | Navigation menu + route guard |
| frontend/src/App.tsx | Root app component — imports all pages |

---

**RECON_STATUS**: LOCKED
**FILE-MAP**: Baseline ready for IMP execution.

Agents may expand scope ONLY when concrete dependency evidence requires it. Any expansion must be documented here.

STOP — awaiting human review before IMP execution begins.
