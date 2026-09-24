CREATE TABLE "migrations"(
  "id" integer primary key autoincrement not null,
  "migration" varchar not null,
  "batch" integer not null
);
CREATE TABLE "roles"(
  "id" varchar not null,
  "role_key" varchar not null,
  "name" varchar not null,
  "permissions" text not null,
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE UNIQUE INDEX "roles_role_key_unique" on "roles"("role_key");
CREATE TABLE "permissions"(
  "id" varchar not null,
  "perm_key" varchar not null,
  "description" varchar not null default '',
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE UNIQUE INDEX "permissions_perm_key_unique" on "permissions"("perm_key");
CREATE TABLE "users"(
  "id" varchar not null,
  "role_key" varchar not null,
  "name" varchar not null,
  "email" varchar not null,
  "email_verified_at" datetime,
  "password_hash" varchar not null,
  "salt" varchar,
  "status" varchar check("status" in('active', 'suspended')) not null default 'active',
  "avatar" text,
  "bio" text,
  "phone" varchar,
  "instructor_approved" tinyint(1) not null default '0',
  "instructor_headline" varchar,
  "last_login_at" datetime,
  "remember_token" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("role_key") references "roles"("role_key") on delete restrict on update cascade,
  primary key("id")
);
CREATE INDEX "users_role_key_status_index" on "users"("role_key", "status");
CREATE UNIQUE INDEX "users_email_unique" on "users"("email");
CREATE TABLE "password_reset_tokens"(
  "email" varchar not null,
  "token" varchar not null,
  "created_at" datetime,
  primary key("email")
);
CREATE TABLE "sessions"(
  "id" varchar not null,
  "user_id" integer,
  "ip_address" varchar,
  "user_agent" text,
  "payload" text not null,
  "last_activity" integer not null,
  primary key("id")
);
CREATE INDEX "sessions_user_id_index" on "sessions"("user_id");
CREATE INDEX "sessions_last_activity_index" on "sessions"("last_activity");
CREATE TABLE "cache"(
  "key" varchar not null,
  "value" text not null,
  "expiration" integer not null,
  primary key("key")
);
CREATE INDEX "cache_expiration_index" on "cache"("expiration");
CREATE TABLE "cache_locks"(
  "key" varchar not null,
  "owner" varchar not null,
  "expiration" integer not null,
  primary key("key")
);
CREATE INDEX "cache_locks_expiration_index" on "cache_locks"("expiration");
CREATE TABLE "jobs"(
  "id" integer primary key autoincrement not null,
  "queue" varchar not null,
  "payload" text not null,
  "attempts" integer not null,
  "reserved_at" integer,
  "available_at" integer not null,
  "created_at" integer not null
);
CREATE INDEX "jobs_queue_index" on "jobs"("queue");
CREATE TABLE "job_batches"(
  "id" varchar not null,
  "name" varchar not null,
  "total_jobs" integer not null,
  "pending_jobs" integer not null,
  "failed_jobs" integer not null,
  "failed_job_ids" text not null,
  "options" text,
  "cancelled_at" integer,
  "created_at" integer not null,
  "finished_at" integer,
  primary key("id")
);
CREATE TABLE "failed_jobs"(
  "id" integer primary key autoincrement not null,
  "uuid" varchar not null,
  "connection" varchar not null,
  "queue" varchar not null,
  "payload" text not null,
  "exception" text not null,
  "failed_at" datetime not null default CURRENT_TIMESTAMP
);
CREATE INDEX "failed_jobs_connection_queue_failed_at_index" on "failed_jobs"(
  "connection",
  "queue",
  "failed_at"
);
CREATE UNIQUE INDEX "failed_jobs_uuid_unique" on "failed_jobs"("uuid");
CREATE TABLE "personal_access_tokens"(
  "id" integer primary key autoincrement not null,
  "tokenable_type" varchar not null,
  "tokenable_id" integer not null,
  "name" varchar not null,
  "token" varchar not null,
  "abilities" text,
  "last_used_at" datetime,
  "expires_at" datetime,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE INDEX "personal_access_tokens_tokenable_type_tokenable_id_index" on "personal_access_tokens"(
  "tokenable_type",
  "tokenable_id"
);
CREATE UNIQUE INDEX "personal_access_tokens_token_unique" on "personal_access_tokens"(
  "token"
);
CREATE TABLE "categories"(
  "id" varchar not null,
  "scope" varchar check("scope" in('course', 'article', 'news', 'tutorial', 'product')) not null,
  "name" varchar not null,
  "slug" varchar not null,
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE UNIQUE INDEX "categories_scope_slug_unique" on "categories"(
  "scope",
  "slug"
);
CREATE INDEX "categories_scope_index" on "categories"("scope");
CREATE TABLE "courses"(
  "id" varchar not null,
  "slug" varchar not null,
  "instructor_id" varchar not null,
  "category_id" varchar,
  "title" varchar not null,
  "short_description" varchar not null default '',
  "description" text,
  "thumbnail" text,
  "price" integer not null default '0',
  "discount_price" integer not null default '0',
  "is_free" tinyint(1) not null default '0',
  "level" varchar check("level" in('beginner', 'intermediate', 'advanced')) not null default 'beginner',
  "language" varchar not null default 'Indonesia',
  "status" varchar check("status" in('draft', 'pending', 'published', 'rejected', 'archived')) not null default 'draft',
  "featured" tinyint(1) not null default '0',
  "requirements" text,
  "outcomes" text,
  "tags" text,
  "reject_note" varchar,
  "published_at" datetime,
  "deleted_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("instructor_id") references "users"("id") on delete cascade,
  foreign key("category_id") references "categories"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "courses_status_featured_index" on "courses"(
  "status",
  "featured"
);
CREATE UNIQUE INDEX "courses_slug_unique" on "courses"("slug");
CREATE TABLE "course_sections"(
  "id" varchar not null,
  "course_id" varchar not null,
  "title" varchar not null,
  "sort" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("course_id") references "courses"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "course_sections_course_id_sort_index" on "course_sections"(
  "course_id",
  "sort"
);
CREATE TABLE "lessons"(
  "id" varchar not null,
  "course_id" varchar not null,
  "section_id" varchar not null,
  "title" varchar not null,
  "type" varchar check("type" in('text', 'youtube', 'video', 'pdf', 'file', 'image', 'url', 'embed')) not null default 'text',
  "content" text,
  "media_url" text,
  "duration_min" integer not null default '0',
  "preview" tinyint(1) not null default '0',
  "status" varchar check("status" in('draft', 'published')) not null default 'published',
  "sort" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("course_id") references "courses"("id") on delete cascade,
  foreign key("section_id") references "course_sections"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "lessons_section_id_sort_index" on "lessons"(
  "section_id",
  "sort"
);
CREATE TABLE "enrollments"(
  "id" varchar not null,
  "user_id" varchar not null,
  "course_id" varchar not null,
  "status" varchar check("status" in('active', 'completed')) not null default 'active',
  "progress_pct" integer not null default '0',
  "last_lesson_id" varchar,
  "completed_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("course_id") references "courses"("id") on delete cascade,
  primary key("id")
);
CREATE UNIQUE INDEX "enrollments_user_id_course_id_unique" on "enrollments"(
  "user_id",
  "course_id"
);
CREATE INDEX "enrollments_course_id_index" on "enrollments"("course_id");
CREATE TABLE "lesson_progress"(
  "id" varchar not null,
  "user_id" varchar not null,
  "lesson_id" varchar not null,
  "completed_at" datetime not null default CURRENT_TIMESTAMP,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("lesson_id") references "lessons"("id") on delete cascade,
  primary key("id")
);
CREATE UNIQUE INDEX "lesson_progress_user_id_lesson_id_unique" on "lesson_progress"(
  "user_id",
  "lesson_id"
);
CREATE TABLE "quizzes"(
  "id" varchar not null,
  "course_id" varchar,
  "creator_id" varchar not null,
  "title" varchar not null,
  "description" text,
  "time_limit_min" integer not null default '10',
  "passing_score" integer not null default '70',
  "max_attempts" integer not null default '0',
  "randomize" tinyint(1) not null default '0',
  "active" tinyint(1) not null default '1',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("course_id") references "courses"("id") on delete cascade,
  foreign key("creator_id") references "users"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "quizzes_course_id_active_index" on "quizzes"(
  "course_id",
  "active"
);
CREATE TABLE "quiz_questions"(
  "id" varchar not null,
  "quiz_id" varchar not null,
  "type" varchar check("type" in('single', 'multiple', 'boolean', 'short')) not null default 'single',
  "text" text not null,
  "points" integer not null default '10',
  "sort" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("quiz_id") references "quizzes"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "quiz_questions_quiz_id_sort_index" on "quiz_questions"(
  "quiz_id",
  "sort"
);
CREATE TABLE "quiz_options"(
  "id" varchar not null,
  "question_id" varchar not null,
  "text" text not null,
  "is_correct" tinyint(1) not null default '0',
  "sort" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("question_id") references "quiz_questions"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "quiz_options_question_id_sort_index" on "quiz_options"(
  "question_id",
  "sort"
);
CREATE TABLE "quiz_attempts"(
  "id" varchar not null,
  "quiz_id" varchar not null,
  "user_id" varchar not null,
  "status" varchar check("status" in('running', 'submitted')) not null default 'running',
  "answers" text,
  "score" integer not null default '0',
  "max_score" integer not null default '0',
  "percent" integer not null default '0',
  "passed" tinyint(1) not null default '0',
  "started_at" datetime not null default CURRENT_TIMESTAMP,
  "submitted_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("quiz_id") references "quizzes"("id") on delete cascade,
  foreign key("user_id") references "users"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "quiz_attempts_quiz_id_user_id_index" on "quiz_attempts"(
  "quiz_id",
  "user_id"
);
CREATE TABLE "orders"(
  "id" varchar not null,
  "user_id" varchar not null,
  "type" varchar check("type" in('course', 'shop')) not null,
  "status" varchar check("status" in('pending', 'paid', 'failed', 'expired', 'cancelled')) not null default 'pending',
  "subtotal" integer not null default '0',
  "discount_amount" integer not null default '0',
  "voucher_code" varchar,
  "gateway_fee" integer not null default '0',
  "total" integer not null default '0',
  "currency" varchar not null default 'IDR',
  "paid_at" datetime,
  "needs_shipping" tinyint(1) not null default '0',
  "shipping_name" varchar,
  "shipping_address" text,
  "shipping_phone" varchar,
  "voucher_id" varchar,
  "voucher_reservation_status" varchar check("voucher_reservation_status" in('reserved', 'consumed', 'released')),
  "voucher_reserved_until" datetime,
  "stock_reservation_status" varchar check("stock_reservation_status" in('reserved', 'confirmed', 'released', 'shortage')),
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "orders_user_id_status_index" on "orders"("user_id", "status");
CREATE INDEX "orders_voucher_reservation_index" on "orders"("voucher_id", "voucher_reservation_status", "voucher_reserved_until");
CREATE INDEX "orders_voucher_due_index" on "orders"("voucher_reservation_status", "voucher_reserved_until");
CREATE TABLE "order_items"(
  "id" varchar not null,
  "order_id" varchar not null,
  "kind" varchar check("kind" in('course', 'product')) not null,
  "ref_id" varchar not null,
  "title" varchar not null,
  "price" integer not null default '0',
  "qty" integer not null default '1',
  "instructor_id" varchar,
  "thumbnail" text,
  "variant_id" varchar,
  "variant_label" varchar,
  "is_digital" tinyint(1) not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("order_id") references "orders"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "order_items_kind_ref_id_index" on "order_items"(
  "kind",
  "ref_id"
);
CREATE TABLE "payments"(
  "id" varchar not null,
  "order_id" varchar not null,
  "gateway" varchar check("gateway" in('tripay', 'xendit', 'stripe')) not null,
  "mode" varchar check("mode" in('sandbox', 'live')) not null default 'sandbox',
  "method" varchar not null,
  "reference" varchar not null,
  "merchant_ref" varchar not null,
  "amount" integer not null default '0',
  "fee" integer not null default '0',
  "status" varchar check("status" in('pending', 'paid', 'failed', 'expired')) not null default 'pending',
  "signature" varchar not null,
  "events" text,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("order_id") references "orders"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "payments_order_id_status_index" on "payments"(
  "order_id",
  "status"
);
CREATE UNIQUE INDEX "payments_reference_unique" on "payments"("reference");
CREATE INDEX "payments_gateway_merchant_ref_index" on "payments"("gateway", "merchant_ref");
CREATE TABLE "webhook_logs"(
  "id" varchar not null,
  "reference" varchar not null,
  "payload_hash" varchar not null,
  "gateway" varchar check("gateway" in('tripay', 'xendit', 'stripe')) not null,
  "status" varchar not null,
  "result" varchar check("result" in('processed', 'duplicate', 'invalid')) not null,
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE INDEX "webhook_logs_reference_index" on "webhook_logs"("reference");
CREATE UNIQUE INDEX "webhook_logs_payload_hash_unique" on "webhook_logs"(
  "payload_hash"
);
CREATE TABLE "products"(
  "id" varchar not null,
  "slug" varchar not null,
  "name" varchar not null,
  "description" text,
  "thumbnail" text,
  "price" integer not null default '0',
  "discount_price" integer not null default '0',
  "stock" integer not null default '0',
  "category_id" varchar,
  "status" varchar check("status" in('draft', 'published')) not null default 'draft',
  "featured" tinyint(1) not null default '0',
  "is_digital" tinyint(1) not null default '0',
  "digital_file_url" text,
  "deleted_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("category_id") references "categories"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "products_status_featured_index" on "products"(
  "status",
  "featured"
);
CREATE UNIQUE INDEX "products_slug_unique" on "products"("slug");
CREATE TABLE "product_variants"(
  "id" varchar not null,
  "product_id" varchar not null,
  "label" varchar not null,
  "price" integer not null default '0',
  "stock" integer not null default '0',
  "sort" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("product_id") references "products"("id") on delete cascade,
  primary key("id")
);
CREATE UNIQUE INDEX "product_variants_product_id_label_unique" on "product_variants"(
  "product_id",
  "label"
);
CREATE TABLE "vouchers"(
  "id" varchar not null,
  "code" varchar not null,
  "type" varchar check("type" in('percent', 'fixed')) not null default 'percent',
  "value" integer not null default '0',
  "min_order" integer not null default '0',
  "max_discount" integer not null default '0',
  "usage_limit" integer not null default '0',
  "used_count" integer not null default '0',
  "expires_at" datetime,
  "active" tinyint(1) not null default '1',
  "note" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE UNIQUE INDEX "vouchers_code_unique" on "vouchers"("code");
CREATE TABLE "cart_items"(
  "id" varchar not null,
  "user_id" varchar not null,
  "product_id" varchar not null,
  "variant_id" varchar,
  "qty" integer not null default '1',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("product_id") references "products"("id") on delete cascade,
  foreign key("variant_id") references "product_variants"("id") on delete cascade,
  primary key("id")
);
CREATE UNIQUE INDEX "cart_items_user_id_product_id_variant_id_unique" on "cart_items"(
  "user_id",
  "product_id",
  "variant_id"
);
CREATE TABLE "digital_deliveries"(
  "id" varchar not null,
  "user_id" varchar not null,
  "product_id" varchar not null,
  "order_item_id" varchar,
  "license_key" varchar not null,
  "download_url" text,
  "downloads" integer not null default '0',
  "status" varchar check("status" in('active', 'revoked')) not null default 'active',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("product_id") references "products"("id") on delete cascade,
  foreign key("order_item_id") references "order_items"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "digital_deliveries_user_id_status_index" on "digital_deliveries"(
  "user_id",
  "status"
);
CREATE UNIQUE INDEX "digital_deliveries_license_key_unique" on "digital_deliveries"(
  "license_key"
);
CREATE TABLE "instructor_wallet_transactions"(
  "id" varchar not null,
  "user_id" varchar not null,
  "type" varchar check("type" in('earning', 'withdrawal')) not null,
  "ref_id" varchar,
  "order_id" varchar,
  "amount" integer not null default '0',
  "gross" integer not null default '0',
  "platform_fee" integer not null default '0',
  "payment_fee" integer not null default '0',
  "status" varchar check("status" in('pending', 'completed', 'rejected')) not null default 'completed',
  "note" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("order_id") references "orders"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "instructor_wallet_transactions_user_id_status_index" on "instructor_wallet_transactions"(
  "user_id",
  "status"
);
CREATE UNIQUE INDEX "wallet_earning_idempotency_unique" on "instructor_wallet_transactions"("order_id", "user_id", "type", "ref_id");
CREATE TABLE "withdrawals"(
  "id" varchar not null,
  "user_id" varchar not null,
  "amount" integer not null,
  "bank_name" varchar not null,
  "account_name" varchar not null,
  "account_number" varchar not null,
  "notes" text,
  "status" varchar check("status" in('pending', 'approved', 'processing', 'completed', 'rejected')) not null default 'pending',
  "processed_by" varchar,
  "processed_at" datetime,
  "admin_note" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("processed_by") references "users"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "withdrawals_user_id_status_index" on "withdrawals"(
  "user_id",
  "status"
);
CREATE TABLE "settings"(
  "setting_key" varchar not null,
  "setting_value" text,
  "updated_at" datetime not null default CURRENT_TIMESTAMP,
  primary key("setting_key")
);
CREATE TABLE "media"(
  "id" varchar not null,
  "name" varchar not null,
  "mime" varchar not null,
  "size" integer not null default '0',
  "path" varchar not null,
  "uploaded_by" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("uploaded_by") references "users"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "media_name_index" on "media"("name");
CREATE TABLE "articles"(
  "id" varchar not null,
  "slug" varchar not null,
  "title" varchar not null,
  "author_id" varchar,
  "category_id" varchar,
  "excerpt" text,
  "content" text,
  "thumbnail" text,
  "tags" text,
  "status" varchar check("status" in('draft', 'published')) not null default 'draft',
  "featured" tinyint(1) not null default '0',
  "published_at" datetime,
  "seo_title" varchar,
  "seo_description" varchar,
  "deleted_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("author_id") references "users"("id") on delete set null,
  foreign key("category_id") references "categories"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "articles_status_featured_index" on "articles"(
  "status",
  "featured"
);
CREATE UNIQUE INDEX "articles_slug_unique" on "articles"("slug");
CREATE TABLE "news"(
  "id" varchar not null,
  "slug" varchar not null,
  "title" varchar not null,
  "author_id" varchar,
  "category_id" varchar,
  "excerpt" text,
  "content" text,
  "thumbnail" text,
  "video_url" varchar,
  "tags" text,
  "status" varchar check("status" in('draft', 'published')) not null default 'draft',
  "published_at" datetime,
  "seo_title" varchar,
  "seo_description" varchar,
  "deleted_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("author_id") references "users"("id") on delete set null,
  foreign key("category_id") references "categories"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "news_status_index" on "news"("status");
CREATE UNIQUE INDEX "news_slug_unique" on "news"("slug");
CREATE TABLE "tutorials"(
  "id" varchar not null,
  "slug" varchar not null,
  "title" varchar not null,
  "author_id" varchar,
  "category_id" varchar,
  "excerpt" text,
  "content" text,
  "thumbnail" text,
  "video_url" varchar,
  "tags" text,
  "status" varchar check("status" in('draft', 'published')) not null default 'draft',
  "published_at" datetime,
  "seo_title" varchar,
  "seo_description" varchar,
  "deleted_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("author_id") references "users"("id") on delete set null,
  foreign key("category_id") references "categories"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "tutorials_status_index" on "tutorials"("status");
CREATE UNIQUE INDEX "tutorials_slug_unique" on "tutorials"("slug");
CREATE TABLE "activities"(
  "id" varchar not null,
  "slug" varchar not null,
  "title" varchar not null,
  "description" text,
  "content" text,
  "thumbnail" text,
  "event_date" date,
  "event_time" varchar,
  "location" varchar,
  "video_url" varchar,
  "registration_url" varchar,
  "gallery" text,
  "status" varchar check("status" in('draft', 'published')) not null default 'draft',
  "author_id" varchar,
  "deleted_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("author_id") references "users"("id") on delete set null,
  primary key("id")
);
CREATE INDEX "activities_status_event_date_index" on "activities"(
  "status",
  "event_date"
);
CREATE UNIQUE INDEX "activities_slug_unique" on "activities"("slug");
CREATE TABLE "pages"(
  "id" varchar not null,
  "slug" varchar not null,
  "title" varchar not null,
  "content" text,
  "thumbnail" text,
  "status" varchar check("status" in('draft', 'published')) not null default 'draft',
  "seo_title" varchar,
  "seo_description" varchar,
  "deleted_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE INDEX "pages_status_index" on "pages"("status");
CREATE UNIQUE INDEX "pages_slug_unique" on "pages"("slug");
CREATE TABLE "homepage_blocks"(
  "id" varchar not null,
  "type" varchar not null,
  "title" varchar,
  "sub" varchar,
  "content" text,
  "enabled" tinyint(1) not null default '1',
  "sort" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE INDEX "homepage_blocks_enabled_sort_index" on "homepage_blocks"(
  "enabled",
  "sort"
);
CREATE TABLE "menus"(
  "id" varchar not null,
  "name" varchar not null,
  "location" varchar check("location" in('header', 'footer', 'both')) not null default 'header',
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE UNIQUE INDEX "menus_name_unique" on "menus"("name");
CREATE TABLE "menu_items"(
  "id" varchar not null,
  "menu_id" varchar not null,
  "parent_id" varchar,
  "label" varchar not null,
  "type" varchar not null default 'url',
  "target" varchar,
  "url" varchar,
  "sort" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("menu_id") references "menus"("id") on delete cascade,
  foreign key("parent_id") references "menu_items"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "menu_items_menu_id_sort_index" on "menu_items"(
  "menu_id",
  "sort"
);
CREATE TABLE "certificate_templates"(
  "id" varchar not null,
  "name" varchar not null,
  "theme" varchar check("theme" in('navy', 'ivory', 'graphite')) not null default 'navy',
  "accent" varchar not null default '#2dd4bf',
  "frame" varchar check("frame" in('modern', 'classic')) not null default 'modern',
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE TABLE "certificates"(
  "id" varchar not null,
  "number" varchar not null,
  "user_id" varchar not null,
  "course_id" varchar not null,
  "template_id" varchar not null,
  "issued_at" datetime not null default CURRENT_TIMESTAMP,
  "status" varchar check("status" in('issued', 'revoked')) not null default 'issued',
  "views" integer not null default '0',
  "revoked_at" datetime,
  "revoked_by" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("course_id") references "courses"("id") on delete cascade,
  foreign key("template_id") references "certificate_templates"("id") on delete restrict,
  foreign key("revoked_by") references "users"("id") on delete set null,
  primary key("id")
);
CREATE UNIQUE INDEX "certificates_user_id_course_id_unique" on "certificates"(
  "user_id",
  "course_id"
);
CREATE UNIQUE INDEX "certificates_number_unique" on "certificates"("number");
CREATE TABLE "notifications"(
  "id" varchar not null,
  "user_id" varchar not null,
  "title" varchar not null,
  "body" varchar,
  "link" varchar,
  "kind" varchar check("kind" in('info', 'success', 'warning', 'danger')) not null default 'info',
  "is_read" tinyint(1) not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  primary key("id")
);
CREATE INDEX "notifications_user_id_is_read_index" on "notifications"(
  "user_id",
  "is_read"
);
CREATE TABLE "audit_logs"(
  "id" integer primary key autoincrement not null,
  "user_id" varchar,
  "user_name" varchar not null default 'system',
  "action" varchar not null,
  "model" varchar not null,
  "model_id" varchar,
  "detail" varchar,
  "ip" varchar,
  "ua" varchar,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE INDEX "audit_logs_model_created_at_index" on "audit_logs"(
  "model",
  "created_at"
);
CREATE INDEX "audit_logs_user_id_created_at_index" on "audit_logs"(
  "user_id",
  "created_at"
);
CREATE TABLE "contact_messages"(
  "id" varchar not null,
  "name" varchar not null,
  "email" varchar not null,
  "subject" varchar,
  "body" text not null,
  "is_read" tinyint(1) not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  primary key("id")
);
CREATE INDEX "contact_messages_is_read_index" on "contact_messages"("is_read");

