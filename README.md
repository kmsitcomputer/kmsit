# KMSIT Computer — LMS + CMS Platform

Platform **Learning Management System (LMS) + Content Management System (CMS)** production-grade: kelas online (gratis & berbayar), quiz engine, sertifikat digital ber-QR + verifikasi publik, instructor wallet & withdrawal, shop, payment gateway (Tripay / Xendit / Stripe), homepage builder block-based, menu manager ala WordPress, multi-role dashboard, audit log, multi-bahasa (ID/EN), dan dark mode.

## Catatan Arsitektur Build Ini

Repositori ini berisi implementasi **full-stack yang berjalan di runtime browser** (React + Vite + Tailwind CSS 4). Seluruh arsitektur yang diminta spesifikasi Laravel/MySQL dipetakan 1:1 ke lapisan yang terisolasi:

| Konsep Laravel (production)        | Implementasi di build ini                          |
| ---------------------------------- | -------------------------------------------------- |
| MySQL + Eloquent migrations        | `src/lib/db.ts` — relational table store (FK, cascade, timestamps, unique slug) |
| Service layer / Business logic     | `src/lib/lms.ts`, `src/lib/commerce.ts`, `src/lib/services.ts` |
| Middleware / Policy / Gate         | Guard route + `can(user, permission)` RBAC (`src/state/store.tsx`, `src/App.tsx`) |
| `.env` + config/                   | Settings tersimpan di tabel `settings` (credential gateway di-mask, tidak pernah di-expose) |
| Webhook payment gateway            | `PaymentService.handleWebhook()` — signature verification + idempotency log |
| Blade views                        | React components (`src/pages/...`)                 |

> Pada deployment Laravel production, tabel-tabel di `db.ts` berkorespondensi 1:1 dengan **`database/schema.sql`** (40+ tabel: `users, roles, permissions, sessions, categories, courses, course_sections, lessons, enrollments, lesson_progress, quizzes, quiz_questions, quiz_options, quiz_attempts, certificates, certificate_templates, articles, news, tutorials, activities, pages, homepage_blocks, menus, menu_items, media, orders, order_items, payments, webhook_logs, instructor_wallet_transactions, withdrawals, products, product_variants, vouchers, cart_items, digital_deliveries, notifications, audit_logs, contact_messages, settings`) — foreign key, index, dan unique constraint anti-duplikasi sudah termasuk. Impor: `mysql -u root -p < database/schema.sql`.

## Fitur

- **Installer ala WordPress** — welcome → system requirements (PASS/FAIL) → konfigurasi MySQL (test connection) → website + Super Admin pertama → migrasi → **installer terkunci**. **Tidak ada demo user.**
- **RBAC 4 role**: Super Admin (full), Admin (konten & operasional), Instructor, Student — proteksi di level route *dan* service (akses URL manual → 403).
- **LMS**: Course → Section → Lesson (teks, YouTube, video, PDF, file, gambar, URL, embed), status Draft/Pending/Published/Rejected/Archived, moderasi admin, preview lesson, progress tracking.
- **Kelas Gratis vs Berbayar** — backend guard: materi hanya terbuka jika `enrollment` valid (bukan sekadar menyembunyikan tombol).
- **Payment**: abstraksi `PaymentGatewayInterface` → Tripay / Xendit / Stripe, mode sandbox & live, biaya per metode, **webhook + signature + proteksi duplikasi** (enrollment/wallet tidak diproses dua kali).
- **Revenue split 15%** fee platform (konfigurable) — gross / platform fee / payment fee / net tercatat di **ledger wallet** yang auditable; withdrawal Pending → Approved → Processing → Completed / Rejected.
- **Quiz**: Pilihan Ganda, Benar/Salah, Jawaban Ganda, Isian Singkat — timer, acak soal, batas percobaan, **scoring di backend/service**.
- **Sertifikat digital**: terbit otomatis (progress 100% + lulus quiz), nomor unik `KMSIT-YYYY-NNNNNN`, QR code, halaman verifikasi publik `/certificate/verify/{number}`, cetak/PDF, status revoke.
- **CMS**: Homepage builder (16 tipe blok: add/edit/duplicate/reorder/enable), Menu manager (nested, lokasi header/footer), About Us 100% CMS, Pages, Artikel/Berita/Tutorial/Kegiatan dengan editor **Tiptap**, Media Library, YouTube auto-embed (sanitized anti-XSS).
- **Shop**: produk, kategori, stok, cart, checkout via payment gateway yang sama.
- **Sistem**: audit log, notifikasi per role, global search, backup export (tanpa credential), maintenance mode, multi-bahasa ID/EN, dark/light/system, SEO fields, responsive penuh.

## Menjalankan

```bash
npm install
npm run dev       # development
npm run build     # production → dist/
```

Saat pertama dibuka: **Installation Wizard** muncul → buat Super Admin → login → redirect `/dashboard` sesuai role.

## Alur Kunci

- **Pembayaran**: Student → Order → `PaymentService.initiate()` → Gateway (sandbox simulator) → `fireSandboxWebhook()` → `handleWebhook()` (verify signature → cek duplikasi → `DB transaction`) → Order PAID → Enrollment → Wallet ledger (net 85%) → Notifikasi → Audit.
- **Sertifikat**: lesson selesai / quiz lulus → `CertificateService.checkAndIssue()` (eligibility check + idempotent) → nomor unik → QR → verifikasi publik.

## Keamanan

Password di-hash (SHA-256 + salt per user), session bertoken dengan expiry, credential gateway hanya di settings ter-mask, webhook wajib signature valid, HTML konten di-sanitize (script/iframe/event-handler dibuang), input tervalidasi, proteksi route berbasis permission, installer terkunci permanen setelah selesai, backup tidak menyertakan hash password/credential.

## API (kontrak REST production — `/api/v1`)

Auth (`POST login/logout/register/forgot-password`), Courses/Lessons/Quiz CRUD, Certificates + `GET /certificates/verify/{number}`, Articles/News/Tutorials, Users, Orders, Payments (`POST /payments/create`, `/payments/callback`, `/payments/webhook`), Instructor (`/instructor/profile|courses|balance|withdrawals`), Student (`/student/enrollments|progress|quiz-results|certificates`) — response konsisten via API Resource, token auth + rate limiting.

## Troubleshooting

- **Ingin mengulang instalasi** → Dashboard → Pengaturan → Sistem & Audit → Danger Zone → Reset Aplikasi.
- **Lupa password Super Admin** → reset via installer ulang (setelah reset) atau reset password oleh Super Admin lain di menu Semua User.
- **Pembayaran tidak masuk** → periksa Dashboard → Pembayaran → Webhook Log (processed / duplicate / invalid).
