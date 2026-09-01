-- ============================================================================
--  KMSIT COMPUTER — LMS + CMS + Online Shop
--  database/schema.sql  ·  MySQL 8.0+ / MariaDB 10.6+
--
--  Skema relational lengkap: normalized, foreign-key constrained, indexed.
--  Konsisten dengan Laravel migration (database/migrations) dan model aplikasi.
--
--  PENTING: Tidak ada seed user/demo. Super Admin pertama WAJIB dibuat
--  melalui Installation Wizard (/install). Password di-hash (bcrypt/argon2).
--
--  Cara pakai:
--    mysql -u root -p < database/schema.sql
--    atau:  mysql -u root -p  →  SOURCE /path/ke/database/schema.sql;
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `kmsit_computer`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `kmsit_computer`;

-- ============================================================================
-- 1. IDENTITAS & OTENTIKASI
-- ============================================================================

CREATE TABLE IF NOT EXISTS `roles` (
  `id`          CHAR(12)     NOT NULL,
  `role_key`    VARCHAR(50)  NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `permissions` JSON         NOT NULL,            -- ["*"] atau daftar permission
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_key` (`role_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id`          CHAR(12)     NOT NULL,
  `perm_key`    VARCHAR(80)  NOT NULL,
  `description` VARCHAR(255) NOT NULL DEFAULT '',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_key` (`perm_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id`                 CHAR(12)     NOT NULL,
  `role_key`           VARCHAR(50)  NOT NULL,
  `name`               VARCHAR(120) NOT NULL,
  `email`              VARCHAR(190) NOT NULL,
  `password_hash`      VARCHAR(255) NOT NULL,
  `salt`               VARCHAR(64)  NOT NULL,
  `status`             ENUM('active','suspended') NOT NULL DEFAULT 'active',
  `avatar`             TEXT         NULL,
  `bio`                TEXT         NULL,
  `phone`              VARCHAR(30)  NULL,
  `instructor_approved` TINYINT(1)  NOT NULL DEFAULT 0,
  `instructor_headline` VARCHAR(190) NULL,
  `last_login_at`      TIMESTAMP    NULL,
  `created_at`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `ix_users_role` (`role_key`),
  KEY `ix_users_status` (`status`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_key`) REFERENCES `roles` (`role_key`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `token`      VARCHAR(128) NOT NULL,
  `user_id`    CHAR(12)     NOT NULL,
  `remember`   TINYINT(1)   NOT NULL DEFAULT 0,
  `expires_at` TIMESTAMP    NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`),
  KEY `ix_sessions_user` (`user_id`),
  KEY `ix_sessions_expires` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. TAXONOMY (kategori bersama: kelas, artikel, berita, tutorial, produk)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `categories` (
  `id`         CHAR(12)     NOT NULL,
  `scope`      ENUM('course','article','news','tutorial','product') NOT NULL,
  `name`       VARCHAR(120) NOT NULL,
  `slug`       VARCHAR(140) NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_scope_slug` (`scope`,`slug`),
  KEY `ix_categories_scope` (`scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. LMS — COURSE, KURIKULUM, ENROLLMENT, PROGRESS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `courses` (
  `id`               CHAR(12)     NOT NULL,
  `slug`             VARCHAR(140) NOT NULL,
  `instructor_id`    CHAR(12)     NOT NULL,
  `category_id`      CHAR(12)     NULL,
  `title`            VARCHAR(190) NOT NULL,
  `short_description` VARCHAR(500) NOT NULL DEFAULT '',
  `description`      LONGTEXT     NULL,
  `thumbnail`        TEXT         NULL,
  `price`            INT UNSIGNED NOT NULL DEFAULT 0,
  `discount_price`   INT UNSIGNED NOT NULL DEFAULT 0,
  `is_free`          TINYINT(1)   NOT NULL DEFAULT 0,
  `level`            ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  `language`         VARCHAR(40)  NOT NULL DEFAULT 'Indonesia',
  `status`           ENUM('draft','pending','published','rejected','archived') NOT NULL DEFAULT 'draft',
  `featured`         TINYINT(1)   NOT NULL DEFAULT 0,
  `requirements`     JSON         NULL,
  `outcomes`         JSON         NULL,
  `tags`             JSON         NULL,
  `reject_note`      VARCHAR(500) NULL,
  `published_at`     TIMESTAMP    NULL,
  `deleted_at`       TIMESTAMP    NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_courses_slug` (`slug`),
  KEY `ix_courses_status` (`status`),
  KEY `ix_courses_instructor` (`instructor_id`),
  KEY `ix_courses_category` (`category_id`),
  KEY `ix_courses_featured` (`featured`),
  FULLTEXT KEY `ft_courses` (`title`,`short_description`),
  CONSTRAINT `fk_courses_instructor` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_courses_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_sections` (
  `id`         CHAR(12)     NOT NULL,
  `course_id`  CHAR(12)     NOT NULL,
  `title`      VARCHAR(190) NOT NULL,
  `sort`       INT          NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_sections_course` (`course_id`,`sort`),
  CONSTRAINT `fk_sections_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lessons` (
  `id`           CHAR(12)     NOT NULL,
  `course_id`    CHAR(12)     NOT NULL,
  `section_id`   CHAR(12)     NOT NULL,
  `title`        VARCHAR(190) NOT NULL,
  `type`         ENUM('text','youtube','video','pdf','file','image','url','embed') NOT NULL DEFAULT 'text',
  `content`      LONGTEXT     NULL,
  `media_url`    TEXT         NULL,
  `duration_min` INT UNSIGNED NOT NULL DEFAULT 0,
  `preview`      TINYINT(1)   NOT NULL DEFAULT 0,
  `status`       ENUM('draft','published') NOT NULL DEFAULT 'published',
  `sort`         INT          NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_lessons_course` (`course_id`),
  KEY `ix_lessons_section` (`section_id`,`sort`),
  CONSTRAINT `fk_lessons_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_lessons_section` FOREIGN KEY (`section_id`) REFERENCES `course_sections` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `enrollments` (
  `id`             CHAR(12)     NOT NULL,
  `user_id`        CHAR(12)     NOT NULL,
  `course_id`      CHAR(12)     NOT NULL,
  `status`         ENUM('active','completed') NOT NULL DEFAULT 'active',
  `progress_pct`   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `last_lesson_id` CHAR(12)     NULL,
  `completed_at`   TIMESTAMP    NULL,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enroll_user_course` (`user_id`,`course_id`),   -- anti enrollment ganda
  KEY `ix_enroll_course` (`course_id`),
  CONSTRAINT `fk_enroll_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_enroll_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lesson_progress` (
  `id`           CHAR(12)   NOT NULL,
  `user_id`      CHAR(12)   NOT NULL,
  `lesson_id`    CHAR(12)   NOT NULL,
  `completed_at` TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at`   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_progress_user_lesson` (`user_id`,`lesson_id`),
  CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_progress_lesson` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. QUIZ — scoring dihitung di backend
-- ============================================================================

CREATE TABLE IF NOT EXISTS `quizzes` (
  `id`             CHAR(12)     NOT NULL,
  `course_id`      CHAR(12)     NULL,
  `creator_id`     CHAR(12)     NOT NULL,
  `title`          VARCHAR(190) NOT NULL,
  `description`    TEXT         NULL,
  `time_limit_min` INT UNSIGNED NOT NULL DEFAULT 10,
  `passing_score`  TINYINT UNSIGNED NOT NULL DEFAULT 70,
  `max_attempts`   INT UNSIGNED NOT NULL DEFAULT 0,          -- 0 = tak terbatas
  `randomize`      TINYINT(1)   NOT NULL DEFAULT 0,
  `active`         TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_quiz_course` (`course_id`),
  CONSTRAINT `fk_quiz_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_quiz_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quiz_questions` (
  `id`         CHAR(12)     NOT NULL,
  `quiz_id`    CHAR(12)     NOT NULL,
  `type`       ENUM('single','multiple','boolean','short') NOT NULL DEFAULT 'single',
  `text`       TEXT         NOT NULL,
  `points`     INT UNSIGNED NOT NULL DEFAULT 10,
  `sort`       INT          NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_question_quiz` (`quiz_id`,`sort`),
  CONSTRAINT `fk_question_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quiz_options` (
  `id`          CHAR(12) NOT NULL,
  `question_id` CHAR(12) NOT NULL,
  `text`        TEXT     NOT NULL,
  `is_correct`  TINYINT(1) NOT NULL DEFAULT 0,
  `sort`        INT      NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_option_question` (`question_id`,`sort`),
  CONSTRAINT `fk_option_question` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quiz_attempts` (
  `id`           CHAR(12)     NOT NULL,
  `quiz_id`      CHAR(12)     NOT NULL,
  `user_id`      CHAR(12)     NOT NULL,
  `status`       ENUM('running','submitted') NOT NULL DEFAULT 'running',
  `answers`      JSON         NULL,                           -- {question_id: [option_id|text]}
  `score`        INT UNSIGNED NOT NULL DEFAULT 0,
  `max_score`    INT UNSIGNED NOT NULL DEFAULT 0,
  `percent`      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `passed`       TINYINT(1)   NOT NULL DEFAULT 0,
  `started_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` TIMESTAMP    NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_attempt_quiz_user` (`quiz_id`,`user_id`),
  KEY `ix_attempt_user` (`user_id`),
  CONSTRAINT `fk_attempt_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_attempt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. SERTIFIKAT DIGITAL + verifikasi publik
-- ============================================================================

CREATE TABLE IF NOT EXISTS `certificate_templates` (
  `id`         CHAR(12)     NOT NULL,
  `name`       VARCHAR(120) NOT NULL,
  `theme`      ENUM('navy','ivory','graphite') NOT NULL DEFAULT 'navy',
  `accent`     VARCHAR(9)   NOT NULL DEFAULT '#2dd4bf',
  `frame`      ENUM('modern','classic') NOT NULL DEFAULT 'modern',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `certificates` (
  `id`          CHAR(12)     NOT NULL,
  `number`      VARCHAR(40)  NOT NULL,                        -- KMSIT-YYYY-NNNNNN (unik, terverifikasi)
  `user_id`     CHAR(12)     NOT NULL,
  `course_id`   CHAR(12)     NOT NULL,
  `template_id` CHAR(12)     NOT NULL,
  `issued_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`      ENUM('issued','revoked') NOT NULL DEFAULT 'issued',
  `views`       INT UNSIGNED NOT NULL DEFAULT 0,
  `revoked_at`  TIMESTAMP    NULL,
  `revoked_by`  CHAR(12)     NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cert_number` (`number`),
  UNIQUE KEY `uq_cert_user_course` (`user_id`,`course_id`),   -- satu sertifikat per student per kelas
  KEY `ix_cert_course` (`course_id`),
  CONSTRAINT `fk_cert_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cert_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cert_template` FOREIGN KEY (`template_id`) REFERENCES `certificate_templates` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. CMS — ARTIKEL, BERITA, TUTORIAL, KEGIATAN, HALAMAN
-- ============================================================================

CREATE TABLE IF NOT EXISTS `articles` (
  `id`               CHAR(12)     NOT NULL,
  `slug`             VARCHAR(140) NOT NULL,
  `title`            VARCHAR(190) NOT NULL,
  `author_id`        CHAR(12)     NULL,
  `category_id`      CHAR(12)     NULL,
  `excerpt`          TEXT         NULL,
  `content`          LONGTEXT     NULL,
  `thumbnail`        TEXT         NULL,
  `tags`             JSON         NULL,
  `status`           ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `featured`         TINYINT(1)   NOT NULL DEFAULT 0,
  `published_at`     TIMESTAMP    NULL,
  `seo_title`        VARCHAR(190) NULL,
  `seo_description`  VARCHAR(500) NULL,
  `deleted_at`       TIMESTAMP    NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_articles_slug` (`slug`),
  KEY `ix_articles_status` (`status`),
  KEY `ix_articles_category` (`category_id`),
  FULLTEXT KEY `ft_articles` (`title`,`excerpt`),
  CONSTRAINT `fk_articles_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_articles_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `news` (
  `id`               CHAR(12)     NOT NULL,
  `slug`             VARCHAR(140) NOT NULL,
  `title`            VARCHAR(190) NOT NULL,
  `author_id`        CHAR(12)     NULL,
  `category_id`      CHAR(12)     NULL,
  `excerpt`          TEXT         NULL,
  `content`          LONGTEXT     NULL,
  `thumbnail`        TEXT         NULL,
  `video_url`        VARCHAR(255) NULL,                       -- YouTube embed (di-sanitasi)
  `status`           ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `published_at`     TIMESTAMP    NULL,
  `seo_title`        VARCHAR(190) NULL,
  `seo_description`  VARCHAR(500) NULL,
  `deleted_at`       TIMESTAMP    NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_news_slug` (`slug`),
  KEY `ix_news_status` (`status`),
  FULLTEXT KEY `ft_news` (`title`,`excerpt`),
  CONSTRAINT `fk_news_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_news_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tutorials` (
  `id`               CHAR(12)     NOT NULL,
  `slug`             VARCHAR(140) NOT NULL,
  `title`            VARCHAR(190) NOT NULL,
  `author_id`        CHAR(12)     NULL,
  `category_id`      CHAR(12)     NULL,
  `excerpt`          TEXT         NULL,
  `content`          LONGTEXT     NULL,
  `thumbnail`        TEXT         NULL,
  `video_url`        VARCHAR(255) NULL,
  `tags`             JSON         NULL,
  `status`           ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `published_at`     TIMESTAMP    NULL,
  `seo_title`        VARCHAR(190) NULL,
  `seo_description`  VARCHAR(500) NULL,
  `deleted_at`       TIMESTAMP    NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tutorials_slug` (`slug`),
  KEY `ix_tutorials_status` (`status`),
  KEY `ix_tutorials_category` (`category_id`),
  FULLTEXT KEY `ft_tutorials` (`title`,`excerpt`),
  CONSTRAINT `fk_tutorials_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_tutorials_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activities` (
  `id`                CHAR(12)     NOT NULL,
  `slug`              VARCHAR(140) NOT NULL,
  `title`             VARCHAR(190) NOT NULL,
  `description`       TEXT         NULL,
  `content`           LONGTEXT     NULL,
  `thumbnail`         TEXT         NULL,
  `event_date`        DATE         NULL,
  `event_time`        TIME         NULL,
  `location`          VARCHAR(190) NULL,
  `video_url`         VARCHAR(255) NULL,
  `registration_url`  VARCHAR(255) NULL,
  `gallery`           JSON         NULL,
  `status`            ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `deleted_at`        TIMESTAMP    NULL,
  `created_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_activities_slug` (`slug`),
  KEY `ix_activities_status` (`status`),
  KEY `ix_activities_date` (`event_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pages` (
  `id`               CHAR(12)     NOT NULL,
  `slug`             VARCHAR(140) NOT NULL,
  `title`            VARCHAR(190) NOT NULL,
  `content`          LONGTEXT     NULL,
  `thumbnail`        TEXT         NULL,
  `status`           ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `seo_title`        VARCHAR(190) NULL,
  `seo_description`  VARCHAR(500) NULL,
  `deleted_at`       TIMESTAMP    NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pages_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. WEBSITE CMS — HOMEPAGE BLOCKS, MENU, MEDIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS `homepage_blocks` (
  `id`         CHAR(12)     NOT NULL,
  `type`       VARCHAR(40)  NOT NULL,                        -- hero|stats|courses|instructors|articles|news|tutorials|activities|cta|map|contact|text|gallery
  `title`      VARCHAR(190) NULL,
  `sub`        VARCHAR(255) NULL,
  `content`    JSON         NULL,
  `enabled`    TINYINT(1)   NOT NULL DEFAULT 1,
  `sort`       INT          NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_blocks_sort` (`sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `menus` (
  `id`         CHAR(12)    NOT NULL,
  `name`       VARCHAR(80) NOT NULL,
  `location`   ENUM('header','footer','both') NOT NULL DEFAULT 'header',
  `created_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menus_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `menu_items` (
  `id`         CHAR(12)     NOT NULL,
  `menu_id`    CHAR(12)     NOT NULL,
  `parent_id`  CHAR(12)     NULL,                             -- nested / dropdown
  `label`      VARCHAR(120) NOT NULL,
  `type`       ENUM('home','courses','articles','news','tutorials','activities','shop','about','contact','page','category','url') NOT NULL DEFAULT 'url',
  `target`     CHAR(12)     NULL,                             -- id page/kategori (bila type page/category)
  `url`        VARCHAR(255) NULL,                             -- custom URL
  `sort`       INT          NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_menuitems_menu` (`menu_id`,`sort`),
  CONSTRAINT `fk_menuitems_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_menuitems_parent` FOREIGN KEY (`parent_id`) REFERENCES `menu_items` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `media` (
  `id`          CHAR(12)     NOT NULL,
  `name`        VARCHAR(190) NOT NULL,
  `mime`        VARCHAR(100) NOT NULL,
  `size`        INT UNSIGNED NOT NULL DEFAULT 0,
  `url`         LONGTEXT     NOT NULL,                       -- path storage, bukan binary
  `uploaded_by` CHAR(12)     NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_media_name` (`name`(100)),
  CONSTRAINT `fk_media_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. COMMERCE — ORDER, PAYMENT, WEBHOOK (idempotent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `orders` (
  `id`               CHAR(12)     NOT NULL,
  `user_id`          CHAR(12)     NOT NULL,
  `type`             ENUM('course','shop') NOT NULL,
  `status`           ENUM('pending','paid','failed','expired') NOT NULL DEFAULT 'pending',
  `subtotal`         INT UNSIGNED NOT NULL DEFAULT 0,
  `discount_amount`  INT UNSIGNED NOT NULL DEFAULT 0,
  `voucher_code`     VARCHAR(40)  NULL,
  `gateway_fee`      INT UNSIGNED NOT NULL DEFAULT 0,
  `total`            INT UNSIGNED NOT NULL DEFAULT 0,
  `currency`         VARCHAR(3)   NOT NULL DEFAULT 'IDR',
  `paid_at`          TIMESTAMP    NULL,
  `needs_shipping`   TINYINT(1)   NOT NULL DEFAULT 0,
  `shipping_name`    VARCHAR(120) NULL,
  `shipping_address` TEXT         NULL,
  `shipping_phone`   VARCHAR(30)  NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_orders_user` (`user_id`),
  KEY `ix_orders_status` (`status`),
  KEY `ix_orders_type` (`type`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id`            CHAR(12)     NOT NULL,
  `order_id`      CHAR(12)     NOT NULL,
  `kind`          ENUM('course','product') NOT NULL,
  `ref_id`        CHAR(12)     NOT NULL,                     -- course_id atau product_id
  `title`         VARCHAR(190) NOT NULL,
  `price`         INT UNSIGNED NOT NULL DEFAULT 0,
  `qty`           INT UNSIGNED NOT NULL DEFAULT 1,
  `instructor_id` CHAR(12)     NULL,
  `thumbnail`     TEXT         NULL,
  `variant_id`    CHAR(12)     NULL,
  `variant_label` VARCHAR(120) NULL,
  `is_digital`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_orderitems_order` (`order_id`),
  KEY `ix_orderitems_ref` (`kind`,`ref_id`),
  CONSTRAINT `fk_orderitems_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
  `id`          CHAR(12)     NOT NULL,
  `order_id`    CHAR(12)     NOT NULL,
  `gateway`     ENUM('tripay','xendit','stripe') NOT NULL,
  `mode`        ENUM('sandbox','live') NOT NULL DEFAULT 'sandbox',
  `method`      VARCHAR(60)  NOT NULL,
  `reference`   VARCHAR(80)  NOT NULL,
  `merchant_ref` VARCHAR(80) NOT NULL,
  `amount`      INT UNSIGNED NOT NULL DEFAULT 0,
  `fee`         INT UNSIGNED NOT NULL DEFAULT 0,
  `status`      ENUM('pending','paid','failed','expired') NOT NULL DEFAULT 'pending',
  `signature`   VARCHAR(128) NOT NULL,
  `events`      JSON         NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_reference` (`reference`),
  KEY `ix_payments_order` (`order_id`),
  KEY `ix_payments_status` (`status`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log webhook: unique payload_hash = proteksi duplikasi (idempotency)
CREATE TABLE IF NOT EXISTS `webhook_logs` (
  `id`           CHAR(12)     NOT NULL,
  `reference`    VARCHAR(80)  NOT NULL,
  `payload_hash` VARCHAR(128) NOT NULL,
  `gateway`      ENUM('tripay','xendit','stripe') NOT NULL,
  `status`       VARCHAR(20)  NOT NULL,
  `result`       ENUM('processed','duplicate','invalid') NOT NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_webhook_payload` (`payload_hash`),
  KEY `ix_webhook_reference` (`reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. INSTRUCTOR WALLET (ledger auditable) & WITHDRAWAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS `instructor_wallet_transactions` (
  `id`           CHAR(12)     NOT NULL,
  `user_id`      CHAR(12)     NOT NULL,
  `type`         ENUM('earning','withdrawal') NOT NULL,
  `ref_id`       CHAR(12)     NULL,
  `order_id`     CHAR(12)     NULL,
  `amount`       INT          NOT NULL DEFAULT 0,            -- netto (bisa minus utk withdrawal)
  `gross`        INT UNSIGNED NOT NULL DEFAULT 0,
  `platform_fee` INT UNSIGNED NOT NULL DEFAULT 0,            -- 15% service fee (konfigurable)
  `payment_fee`  INT UNSIGNED NOT NULL DEFAULT 0,
  `status`       ENUM('pending','completed','rejected') NOT NULL DEFAULT 'completed',
  `note`         VARCHAR(255) NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_wallet_user` (`user_id`),
  KEY `ix_wallet_order` (`order_id`),
  CONSTRAINT `fk_wallet_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id`             CHAR(12)     NOT NULL,
  `user_id`        CHAR(12)     NOT NULL,
  `amount`         INT UNSIGNED NOT NULL,
  `bank_name`      VARCHAR(80)  NOT NULL,
  `account_name`   VARCHAR(120) NOT NULL,
  `account_number` VARCHAR(40)  NOT NULL,
  `notes`          TEXT         NULL,
  `status`         ENUM('pending','approved','processing','completed','rejected') NOT NULL DEFAULT 'pending',
  `processed_by`   CHAR(12)     NULL,
  `processed_at`   TIMESTAMP    NULL,
  `admin_note`     VARCHAR(255) NULL,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_withdraw_user` (`user_id`),
  KEY `ix_withdraw_status` (`status`),
  CONSTRAINT `fk_withdraw_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_withdraw_admin` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. SHOP — PRODUK, VARIAN, VOUCHER, KERANJANG, DELIVERY DIGITAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS `products` (
  `id`               CHAR(12)     NOT NULL,
  `slug`             VARCHAR(140) NOT NULL,
  `name`             VARCHAR(190) NOT NULL,
  `description`      LONGTEXT     NULL,
  `thumbnail`        TEXT         NULL,
  `price`            INT UNSIGNED NOT NULL DEFAULT 0,
  `discount_price`   INT UNSIGNED NOT NULL DEFAULT 0,
  `stock`            INT UNSIGNED NOT NULL DEFAULT 0,        -- auto: total stok varian
  `category_id`      CHAR(12)     NULL,
  `status`           ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `featured`         TINYINT(1)   NOT NULL DEFAULT 0,
  `is_digital`       TINYINT(1)   NOT NULL DEFAULT 0,
  `digital_file_url` TEXT         NULL,                       -- path storage file digital
  `deleted_at`       TIMESTAMP    NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  KEY `ix_products_status` (`status`),
  KEY `ix_products_category` (`category_id`),
  KEY `ix_products_digital` (`is_digital`),
  FULLTEXT KEY `ft_products` (`name`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_variants` (
  `id`         CHAR(12)     NOT NULL,
  `product_id` CHAR(12)     NOT NULL,
  `label`      VARCHAR(120) NOT NULL,                        -- cth: "128 GB", "Merah", "Pro"
  `price`      INT UNSIGNED NOT NULL DEFAULT 0,
  `stock`      INT UNSIGNED NOT NULL DEFAULT 0,
  `sort`       INT          NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_variant_product_label` (`product_id`,`label`),
  CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vouchers` (
  `id`           CHAR(12)     NOT NULL,
  `code`         VARCHAR(40)  NOT NULL,
  `type`         ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  `value`        INT UNSIGNED NOT NULL DEFAULT 0,            -- persen (1-100) atau nominal
  `min_order`    INT UNSIGNED NOT NULL DEFAULT 0,
  `max_discount` INT UNSIGNED NOT NULL DEFAULT 0,            -- 0 = tanpa batas
  `usage_limit`  INT UNSIGNED NOT NULL DEFAULT 0,            -- 0 = tak terbatas
  `used_count`   INT UNSIGNED NOT NULL DEFAULT 0,
  `expires_at`   TIMESTAMP    NULL,
  `active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `note`         VARCHAR(255) NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vouchers_code` (`code`),
  KEY `ix_vouchers_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cart_items` (
  `id`         CHAR(12) NOT NULL,
  `user_id`    CHAR(12) NOT NULL,
  `product_id` CHAR(12) NOT NULL,
  `variant_id` CHAR(12) NULL,
  `qty`        INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart_user_product_variant` (`user_id`,`product_id`,`variant_id`),
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cart_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cart_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Delivery produk digital: terbit otomatis setelah pembayaran valid
CREATE TABLE IF NOT EXISTS `digital_deliveries` (
  `id`            CHAR(12)     NOT NULL,
  `user_id`       CHAR(12)     NOT NULL,
  `product_id`    CHAR(12)     NOT NULL,
  `order_item_id` CHAR(12)     NULL,
  `license_key`   VARCHAR(60)  NOT NULL,
  `download_url`  TEXT         NULL,
  `downloads`     INT UNSIGNED NOT NULL DEFAULT 0,
  `status`        ENUM('active','revoked') NOT NULL DEFAULT 'active',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_delivery_license` (`license_key`),
  KEY `ix_delivery_user` (`user_id`),
  KEY `ix_delivery_product` (`product_id`),
  CONSTRAINT `fk_delivery_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_delivery_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_delivery_orderitem` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. SISTEM — NOTIFIKASI, AUDIT, PESAN, SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         CHAR(12)     NOT NULL,
  `user_id`    CHAR(12)     NOT NULL,
  `title`      VARCHAR(190) NOT NULL,
  `body`       VARCHAR(500) NULL,
  `link`       VARCHAR(255) NULL,
  `kind`       ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
  `is_read`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_notif_user_read` (`user_id`,`is_read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    CHAR(12)     NULL,
  `user_name`  VARCHAR(120) NOT NULL DEFAULT 'system',
  `action`     VARCHAR(60)  NOT NULL,
  `model`      VARCHAR(60)  NOT NULL,
  `model_id`   CHAR(12)     NULL,
  `detail`     VARCHAR(500) NULL,
  `ip`         VARCHAR(45)  NULL,
  `ua`         VARCHAR(255) NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_audit_action` (`action`),
  KEY `ix_audit_model` (`model`),
  KEY `ix_audit_user` (`user_id`),
  KEY `ix_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id`         CHAR(12)     NOT NULL,
  `name`       VARCHAR(120) NOT NULL,
  `email`      VARCHAR(190) NOT NULL,
  `subject`    VARCHAR(190) NULL,
  `body`       TEXT         NOT NULL,
  `is_read`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_contact_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `setting_key`   VARCHAR(100) NOT NULL,
  `setting_value` TEXT         NULL,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- SEED AWAL — struktur & konfigurasi (BUKAN data demo; TIDAK ADA user)
-- ============================================================================

-- Roles (Super Admin = '*', lainnya explicit list)
INSERT INTO `roles` (`id`, `role_key`, `name`, `permissions`) VALUES
('role_super',  'super_admin', 'Super Admin', '["*"]'),
('role_admin',  'admin',       'Admin',       '["manage_articles","manage_news","manage_tutorials","manage_activities","manage_pages","manage_media","manage_menus","manage_homepage","manage_about","manage_courses","moderate_courses","manage_categories","manage_quizzes","manage_certificates","manage_students","manage_instructors","manage_orders","view_payments","process_withdrawals","manage_shop","manage_vouchers","view_reports","view_messages"]'),
('role_instr',  'instructor',  'Instructor',  '["learn","instructor_courses","instructor_quizzes","instructor_students","instructor_wallet","instructor_withdrawals","instructor_certificates","student_orders","create_content"]'),
('role_student','student',     'Student',     '["learn","student_orders"]');

-- Sertifikat template default
INSERT INTO `certificate_templates` (`id`, `name`, `theme`, `accent`, `frame`) VALUES
('ctpl_default', 'KMSIT Modern Navy', 'navy', '#2dd4bf', 'modern');

-- Homepage blocks default (bisa disusun ulang dari dashboard)
INSERT INTO `homepage_blocks` (`id`, `type`, `title`, `sub`, `content`, `enabled`, `sort`) VALUES
('blk_hero',    'hero',       'Kuasai Skill Digital, Mulai Hari Ini', 'Platform belajar komputer & IT dengan kelas terstruktur, quiz, dan sertifikat digital terverifikasi.', '{"terminal":true}', 1, 10),
('blk_stats',   'stats',      NULL, NULL, NULL, 1, 20),
('blk_feat',    'courses',    'Kelas Unggulan', 'Kurasi kelas terbaik dari instructor berpengalaman.', '{"mode":"featured","limit":6}', 1, 30),
('blk_latest',  'courses',    'Kelas Terbaru', NULL, '{"mode":"latest","limit":3}', 1, 40),
('blk_instr',   'instructors','Belajar dari Praktisi', NULL, NULL, 1, 50),
('blk_news',    'news',       'Berita & Informasi', NULL, '{"limit":3}', 1, 60),
('blk_tutor',   'tutorials',  'Tutorial Gratis', NULL, '{"limit":3}', 1, 70),
('blk_act',     'activities', 'Kegiatan', NULL, '{"limit":3}', 1, 80),
('blk_cta',     'cta',        'Siap mulai belajar?', 'Daftar sekarang dan akses kelas gratis pertamamu.', '{"button":"Mulai Belajar","url":"/courses"}', 1, 90),
('blk_contact', 'contact',    'Hubungi Kami', NULL, '{"map":true}', 1, 100);

-- Menu default
INSERT INTO `menus` (`id`, `name`, `location`) VALUES ('menu_primary', 'Menu Utama', 'both');
INSERT INTO `menu_items` (`id`, `menu_id`, `parent_id`, `label`, `type`, `target`, `url`, `sort`) VALUES
('mi_home',   'menu_primary', NULL, 'Beranda',  'home',       NULL, NULL, 10),
('mi_course', 'menu_primary', NULL, 'Kelas',    'courses',    NULL, NULL, 20),
('mi_shop',   'menu_primary', NULL, 'Toko',     'shop',       NULL, NULL, 30),
('mi_tutor',  'menu_primary', NULL, 'Tutorial', 'tutorials',  NULL, NULL, 40),
('mi_news',   'menu_primary', NULL, 'Berita',   'news',       NULL, NULL, 50),
('mi_act',    'menu_primary', NULL, 'Kegiatan', 'activities', NULL, NULL, 60),
('mi_about',  'menu_primary', NULL, 'Tentang',  'about',      NULL, NULL, 70),
('mi_contact','menu_primary', NULL, 'Kontak',   'contact',    NULL, NULL, 80);

-- Settings default (credential gateway KOSONG — diisi via dashboard/.env)
INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
('site_name',           'KMSIT Computer'),
('site_url',            ''),
('slogan',              'Platform Belajar Komputer & IT Modern'),
('logo',                ''),
('favicon',             ''),
('footer_text',         '© KMSIT Computer — Belajar komputer jadi mudah.'),
('email',               ''),
('phone',               ''),
('whatsapp',            ''),
('address',             ''),
('map_lat',             ''),
('map_lng',             ''),
('map_query',           ''),
('google_maps_api_key', ''),
('social_facebook',     ''),
('social_instagram',    ''),
('social_youtube',      ''),
('social_tiktok',       ''),
('seo_title',           'KMSIT Computer — Kursus Komputer & Sertifikat Digital'),
('seo_description',     'Belajar komputer online dengan kelas terstruktur, quiz, dan sertifikat digital terverifikasi.'),
('default_language',    'id'),
('timezone',            'Asia/Jakarta'),
('currency',            'IDR'),
('allow_registration',  '1'),
('maintenance_mode',    '0'),
('platform_fee_percent','15'),
('gateway_active',      'tripay'),
('gateway_mode',        'sandbox'),
('tripay_api_key',      ''),
('tripay_private_key',  ''),
('tripay_merchant_code',''),
('xendit_api_key',      ''),
('xendit_callback_token',''),
('stripe_publishable_key',''),
('stripe_secret_key',   ''),
('stripe_webhook_secret','');

-- ============================================================================
-- SELESAI. Super Admin pertama dibuat melalui /install (password ter-hash).
-- ============================================================================
