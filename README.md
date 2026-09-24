# KMSIT Computer — LMS + CMS Platform

Platform **Learning Management System (LMS) + Content Management System (CMS) + E-commerce** production-grade: kelas online (gratis & berbayar), quiz engine, sertifikat digital ber-QR + verifikasi publik, instructor wallet & withdrawal, shop, payment gateway (Tripay / Xendit / Stripe), homepage builder block-based, menu manager ala WordPress, multi-role dashboard, audit log, multi-bahasa (ID/EN), dan dark mode.

## Arsitektur

Repo ini berisi implementasi **monolith Laravel (backend) + React SPA (frontend)** yang berjalan sebagai satu proses deploy:

| Layer | Detail |
|---|---|
| **Backend API** | `backend/` — Laravel 13 (PHP 8.3+), MySQL, RESTful API di `/api/v1` |
| **Frontend SPA** | `frontend/` — React 18, TypeScript, Vite, Tailwind CSS 4, HashRouter |
| **Database** | MySQL — skema dari Laravel migration (`backend/database/migrations/`, 27 file); `schema.sql` hanya dump referensi dialek SQLite dan bisa tertinggal dari migration |
| **Build pipeline** | `npm run build` → sync otomatis ke `backend/public/app.html` |

### Struktur Proyek

```
├── backend/              # Laravel monolith
│   ├── app/
│   │   ├── Http/Controllers/Api/V1/  # 30 controller API
│   │   ├── Http/Middleware/          # AuthenticateApiUser, VerifyCsrfTokenForSession, ValidateAuthEpoch, PreventMaintenanceAccess
│   │   ├── Models/                   # 39 model domain
│   │   ├── Policies/                 # UserPolicy (otorisasi user)
│   │   ├── Services/                 # PaymentGatewayManager + 3 gateway, NotificationService, InstructorEarnings, StockReservation, VoucherReservation
│   │   ├── Support/                  # AdminAccess, InstructorAccess, Pagination, OperationsStatus, HtmlSanitizer, FileSecurity, SessionRevoker
│   │   └── Mail/                     # PasswordResetMail
│   ├── config/           # app, auth, cache, database, commerce, mail, payment, queue, session
│   ├── database/
│   │   ├── migrations/   # sumber skema MySQL (LMS, commerce, CMS, certs, notifikasi, dll)
│   │   ├── schema.sql    # dump referensi dialek SQLite — bukan untuk impor MySQL
│   │   └── seeders/
│   ├── routes/
│   │   ├── api.php       # Semua endpoint /api/v1/*
│   │   └── web.php       # SPA fallback + sensitive path protection
│   ├── tests/Feature/    # 214 test PHPUnit (42 file)
│   ├── public/           # Static assets + app.html (hasil build frontend)
│   └── bootstrap/        # Auto .env creation on first boot
├── frontend/             # React SPA
│   ├── src/
│   │   ├── pages/        # Public + Dashboard per role (Overview, Instructor, Learner, Operations, dll)
│   │   ├── components/   # Shell, ui design-system, icons, RichText editor, remote, ThemeVars
│   │   ├── lib/          # api.ts, menu.ts (nav+route guard), pagination.ts, permissions.ts, settings.ts, format.ts, types.ts, theme.ts, i18n.ts
│   │   ├── state/        # store.tsx (AppProvider: user, theme, language, toast)
│   │   └── assets/
│   └── scripts/          # sync-backend-assets.mjs (postbuild), verify-dashboard.mjs (static checks)
├── docs/
│   ├── blueprint.md      # System Blueprint lengkap
│   ├── architecture.md   # Dokumentasi arsitektur sistem
│   └── integrations-status.md # Status integrasi eksternal (implemented/configuration-only/absent)
└── INSTALL.md            # Panduan instalasi production
```

## Fitur Utama

- **Installer ala WordPress** — welcome → system requirements (PASS/FAIL) → konfigurasi DB (test connection) → website + Super Admin pertama → migrasi → **installer terkunci**. **Tidak ada demo user.**
- **RBAC 4 role**: Super Admin (full), Admin (konten & operasional), Instructor (kelas sendiri), Student (belajar) — otorisasi ditegakkan server-side (Policy + helper permission), menu frontend hanya mengatur visibilitas.
- **LMS**: Course → Section → Lesson (teks, YouTube, video, PDF, file, gambar, URL, embed), status Draft/Pending/Published/Rejected/Archived, moderasi admin, preview lesson, progress tracking per siswa.
- **Dashboard Instructor** — daftar siswa, penjualan, earnings, kuis, hasil kuis, dan progres per kelas; seluruh query ter-scope ke kelas milik instructor (kelas orang lain → 404).
- **Area Siswa** — kelas saya, kuis saya, status kursus, dan produk digital (`/api/v1/my/*`).
- **Payment**: kontrak `App\Contracts\PaymentGateway` → Tripay / Xendit / Stripe; **provider & mode dipilih server-side** dari settings (`gateway_active`/`gateway_mode`, fallback env) sehingga payload gateway dari client diabaikan; **webhook + signature + idempotency log** (order/wallet tidak diproses dua kali).
- **Revenue split 15%** fee platform (konfigurable) — gross / platform fee / payment fee / net tercatat di ledger wallet yang auditable; withdrawal Pending → Approved → Processing → Completed / Rejected.
- **Quiz**: Pilihan Ganda, Benar/Salah, Jawaban Ganda, Isian Singkat — timer, acak soal, batas percobaan, scoring di backend.
- **Sertifikat digital**: terbit otomatis (progress 100% + lulus quiz), nomor unik `KMSIT-YYYY-NNNNNN`, QR code, halaman verifikasi publik `/certificate/verify/{number}`, cetak/PDF, status revoke.
- **CMS**: Homepage builder (drag-and-drop @dnd-kit), Menu manager (nested, header/footer), Pages, Artikel/Berita/Tutorial/Kegiatan dengan editor Tiptap WYSIWYG, Media Library, SEO fields.
- **Shop**: Produk fisik & digital, varian produk, stok, cart, checkout via payment gateway, voucher diskon, license key untuk produk digital.
- **Notifikasi & Pesan**: notifikasi in-app idempotent (`NotificationService`, dedupe `event_key` di dalam transaksi bisnis), inbox pesan kontak publik, mark-read individual & batch.
- **Panel Operasional (Super Admin)**: status queue, failed jobs, heartbeat scheduler, backup terakhir, dan status integrasi — integrasi yang belum aktif ditandai **"Belum aktif"**.
- **Sistem**: audit log, global search, backup export (tanpa credential), maintenance mode, multi-bahasa ID/EN, tema visual website & dashboard terpisah, pagination standar (maks 100/halaman), responsive penuh.

## Menjalankan Development

```bash
cd frontend
npm install
npm run dev       # development server :5173
npm run build     # production → dist/ lalu auto-sync ke ../backend/public/
npm run typecheck # TypeScript
node scripts/verify-dashboard.mjs  # static checks (menu/route/i18n/pagination)
```

Saat pertama dibuka (production): **Installation Wizard** muncul → buat Super Admin → login → redirect `/dashboard` sesuai role.

## Alur Kunci

- **Pembayaran**: Student → Order → `PaymentGatewayManager.resolve()` (gateway aktif dipilih server-side) → `createPayment()` → Gateway (live) → `Webhook callback` → verify signature + idempotency check → fulfillment (enrollment/stok/voucher/wallet/delivery) → Notifikasi → Audit log. Mode `sandbox` memakai alur simulasi internal tanpa memanggil provider.
- **Sertifikat**: lesson selesai / quiz lulus → eligibility check (idempotent) → nomor unik + QR → verifikasi publik tanpa login.
- **Revenue**: Order paid → ledger entry (gross → platform_fee 15% → net 85%) → saldo instructor → withdrawal request → admin approval.
- **Retensi order**: order pending punya `expires_at` (TTL) + reservasi voucher/stok; reclaim terjadwal (`orders:reclaim-pending`, `vouchers:reclaim-reservations`) melepas stok/kuota yang kedaluwarsa.

## Keamanan

- Password di-hash dengan Laravel Hash (bcrypt, tanpa salt kolom terpisah); sesi memakai cookie session Laravel (guard `web`).
- **CSRF**: middleware `VerifyCsrfTokenForSession` mewajibkan token pada mutasi terautentikasi cookie (`X-CSRF-TOKEN`/`X-XSRF-TOKEN`); request Bearer token dikecualikan karena tidak memakai credential ambient. Endpoint auth memakai CSRF bawaan Laravel.
- **Otorisasi berlapis**: `UserPolicy` + helper `AdminAccess`/`InstructorAccess`; semua keputusan di server, bukan dari frontend.
- **Revocation sesi**: kolom `users.auth_epoch` + middleware `ValidateAuthEpoch` membatalkan sesi lama setelah ganti password/suspend.
- **Maintenance**: `PreventMaintenanceAccess` memblokir pengunjung (503) tetapi mengizinkan admin/super_admin (termasuk lewat sesi cookie).
- Kredensial gateway hanya di `.env` / environment, tidak pernah tersimpan di database atau diubah lewat API biasa; payload gateway dari client diabaikan.
- Webhook wajib signature valid, `payload_hash` unique constraint anti-duplikasi.
- HTML konten di-sanitize (script/iframe/event-handler dibuang), input divalidasi ketat; upload media divalidasi MIME/ekstensi.
- Installer terkunci permanen setelah selesai.
- Backup tidak menyertakan hash password/credential.
- Path sensitif (`/.env`, `/database`, `/backend`) diblok 404 secara eksplisit.

## API (REST — `/api/v1`)

- **Auth**: login, logout, register, forgot-password, reset-password, profile CRUD, avatar upload
- **LMS**: courses index/show/enroll, lessons complete, progress tracking, quizzes, certificates
- **Instructor**: `/instructor/students`, `/instructor/sales`, `/instructor/earnings`, `/instructor/quizzes`, `/instructor/quiz-attempts`, `/instructor/courses/{id}/progress` (hanya kelas miliknya)
- **Siswa**: `/my/enrollments`, `/my/quiz-attempts`, `/my/courses/{id}/status`
- **Commerce**: orders course/shop (`/orders/course`, `/orders/shop`, cancel), payments webhook, products, cart, vouchers, wallet, withdrawals, digital delivery
- **CMS**: articles, news, tutorials, activities, pages, homepage blocks, menus, categories, media
- **Admin**: users CRUD, audit logs, backup export, contact messages, settings (public/admin/payment/theme), **operations status** (`/admin/ops/status`, super_admin)
- **Public**: search, contact form, certificate verification, health check

Autentikasi via session-cookie Laravel (guard `web`) dengan token Bearer Sanctum sebagai fallback; CSRF diterapkan pada mutasi cookie. Rate limiting diterapkan per grup endpoint.

## Troubleshooting

- **Ingin mengulang instalasi** → Dashboard → Pengaturan → Sistem & Audit → Danger Zone → Reset Aplikasi.
- **Lupa password Super Admin** → reset via installer ulang (setelah reset) atau reset password oleh Super Admin lain di menu Semua User.
- **Pembayaran tidak masuk** → periksa Dashboard → Pembayaran → Webhook Log (processed / duplicate / invalid).
- **File unggahan 404** → jalankan `php artisan storage:link` (atau biarkan installer menjalankannya).

## Referensi

- [System Blueprint](docs/blueprint.md) — dokumentasi teknis lengkap (skema data, peta API, arsitektur detail, risiko)
- [System Architecture](docs/architecture.md) — dokumentasi arsitektur sistem
- [Integrations Status](docs/integrations-status.md) — status integrasi eksternal (implemented / configuration-only / absent)
- [INSTALL.md](INSTALL.md) — panduan instalasi production
- [Migrations](backend/database/migrations/) — sumber skema MySQL (jalankan `php artisan migrate --force`)
